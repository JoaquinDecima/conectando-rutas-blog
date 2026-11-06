/**
 * Build-time generator for the static SVG map on /rutas.
 *
 * Reglas del mapa (definidas por el usuario):
 * - Los países que aparecen en el mapa se derivan de las historias: el campo
 *   `country` del frontmatter de los artículos en src/content/blog/. Cada país
 *   nuevo que tengan una historia, aparece solo en el mapa.
 * - MANUAL_MAP_COUNTRIES en src/data/route.ts permite forzar países a mano
 *   (países de paso sin historia aún).
 * - Las rutas y los pins de src/data/route.ts llevan su campo `country`; se
 *   renderizan solo si ese país está activo.
 *
 * Datos subyacentes: siluetas de países de Natural Earth 110m (world-atlas) y
 * geometría de rutas de OSRM (cached en .cache/route-osrm.json, gitignored).
 * Todo se proyecta una sola vez en build; el runtime renderiza SVG estático
 * puro: sin librería de mapas, sin tiles, sin zoom/pan, sin JS de mapa.
 *
 * Uso: bun scripts/generate-map-data.ts
 */
import { readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoAzimuthalEqualArea, geoPath } from 'd3-geo';
import { ROUTES, POINTS, MANUAL_MAP_COUNTRIES } from '../src/data/route';

const POSTS_DIR = new URL('../src/content/blog/', import.meta.url);
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 30_000;
const GEOMETRY_DECIMALS = 5;
const VIEW_PADDING = 40; // px alrededor del contenido en el viewBox
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 1240;
const DP_TOLERANCE_DEG = 0.005;
const MAX_ROUTE_POINTS = 600;

interface Position {
	0: number;
	1: number;
}

type LatLon = [number, number];

interface OsrmResponse {
	code: string;
	routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
}

const require = createRequire(import.meta.url);
const cacheUrl = new URL('../.cache/route-osrm.json', import.meta.url);
const outputUrl = new URL('../src/data/map-data.json', import.meta.url);
const legacyGeometryUrl = new URL('../src/data/route-geometry.json', import.meta.url);

function round(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

// --- Lectura del país de cada historia --------------------------------------

function postCountries(dir: URL): string[] {
	const countries = new Set<string>();
	for (const file of readdirSync(dir)) {
		if (!file.endsWith('.md') && !file.endsWith('.mdx')) continue;
		const text = readFileSync(new URL(file, dir), 'utf8');
		const fm = text.match(/^---\n([\s\S]*?)\n---/);
		if (!fm) continue;
		for (const line of fm[1].split('\n')) {
			const m = line.match(/^country:\s*(.*)/i);
			if (!m) continue;
			let val = m[1].trim().replace(/^['"]|['"]$/g, '');
			if (val) countries.add(val);
		}
	}
	return [...countries].sort();
}

// readdir/readFile sincrónicos para no complicar el script top-level
import { readdirSync, readFileSync } from 'node:fs';

// --- Geometría de rutas (OSRM con caché) ------------------------------------

async function readJsonMap(url: URL): Promise<{ data: Record<string, LatLon[]>; existed: boolean }> {
	try {
		return { data: JSON.parse(await readFile(url, 'utf8')) as Record<string, LatLon[]>, existed: true };
	} catch {
		return { data: {}, existed: false };
	}
}

function buildOsrmUrl(coordinates: LatLon[]): string {
	const waypoints = coordinates.map(([lat, lng]) => `${lng},${lat}`);
	return `${OSRM_BASE}/${waypoints.join(';')}?overview=full&geometries=geojson&continue_straight=false`;
}

async function fetchSegment(id: string, coordinates: LatLon[]): Promise<LatLon[] | null> {
	const url = buildOsrmUrl(coordinates);
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = (await response.json()) as OsrmResponse;
			const geometry = data.routes?.[0]?.geometry?.coordinates;
			if (data.code !== 'Ok' || !geometry?.length) throw new Error(`OSRM code=${data.code}`);
			return geometry.map(([lng, lat]) => [round(lat, GEOMETRY_DECIMALS), round(lng, GEOMETRY_DECIMALS)]);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`[map:generate] "${id}" OSRM intento ${attempt}/${MAX_ATTEMPTS} falló: ${message}`);
			if (attempt < MAX_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
		}
	}
	return null;
}

// --- Simplificación (Douglas-Peucker, espacio de grados) -------------------

function perpendicularDistance(p: LatLon, a: LatLon, b: LatLon): number {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const denom = Math.hypot(dx, dy);
	if (denom === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
	return Math.abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / denom;
}

function douglasPeucker(points: LatLon[], tolerance: number): LatLon[] {
	if (points.length <= 2) return points.slice();
	const keep = new Uint8Array(points.length);
	keep[0] = 1;
	keep[points.length - 1] = 1;
	const stack: Array<[number, number]> = [[0, points.length - 1]];
	while (stack.length > 0) {
		const [start, end] = stack.pop() as [number, number];
		let maxDist = 0;
		let index = -1;
		for (let i = start + 1; i < end; i++) {
			const dist = perpendicularDistance(points[i], points[start], points[end]);
			if (dist > maxDist) {
				maxDist = dist;
				index = i;
			}
		}
		if (index >= 0 && maxDist > tolerance) {
			keep[index] = 1;
			stack.push([start, index], [index, end]);
		}
	}
	return points.filter((_, i) => keep[i] === 1);
}

function simplifyRoute(points: LatLon[]): { simplified: LatLon[]; tolerance: number } {
	let tolerance = DP_TOLERANCE_DEG;
	let simplified = douglasPeucker(points, tolerance);
	while (simplified.length > MAX_ROUTE_POINTS && tolerance < 1) {
		tolerance *= 1.6;
		simplified = douglasPeucker(points, tolerance);
	}
	return { simplified, tolerance };
}

// --- Helpers de proyección y path -------------------------------------------

class RoundedPath {
	private parts: string[] = [];
	private current: string | null = null;

	private flush(): void {
		if (this.current !== null) {
			this.parts.push(this.current);
			this.current = null;
		}
	}

	moveTo(x: number, y: number): void {
		this.flush();
		this.current = `M${round(x, 1)} ${round(y, 1)}`;
	}

	lineTo(x: number, y: number): void {
		if (this.current === null) this.current = `M${round(x, 1)} ${round(y, 1)}`;
		else this.current += `L${round(x, 1)} ${round(y, 1)}`;
	}

	arc(): void {}

	closePath(): void {
		if (this.current !== null) this.current += 'Z';
		this.flush();
	}

	toString(): string {
		this.flush();
		return this.parts.join('');
	}
}

function pathFor(geo: unknown, projection: ReturnType<typeof geoAzimuthalEqualArea>): string {
	const context = new RoundedPath();
	geoPath(projection as never, context as never)(geo as never);
	return context.toString();
}

// --- Países del mundo -------------------------------------------------------

function polygonBounds(rings: Position[][]): { minLon: number; minLat: number; maxLon: number; maxLat: number } {
	let minLon = 180;
	let maxLon = -180;
	let minLat = 90;
	let maxLat = -90;
	for (const [lon, lat] of rings[0]) {
		if (lon < minLon) minLon = lon;
		if (lon > maxLon) maxLon = lon;
		if (lat < minLat) minLat = lat;
		if (lat > maxLat) maxLat = lat;
	}
	return { minLon, minLat, maxLon, maxLat };
}

const LATAM_BBOX = { minLon: -118, minLat: -58, maxLon: -30, maxLat: 33 };
function intersectsLatam(bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number }): boolean {
	return bounds.minLon <= LATAM_BBOX.maxLon && bounds.maxLon >= LATAM_BBOX.minLon && bounds.minLat <= LATAM_BBOX.maxLat && bounds.maxLat >= LATAM_BBOX.minLat;
}

async function loadLatamCountries(): Promise<Array<{ name: string; geometry: unknown }>> {
	const topology = JSON.parse(await readFile(require.resolve('world-atlas/countries-110m.json'), 'utf8')) as { objects: { countries: never } };
	const collection = feature(topology as never, topology.objects.countries) as never as {
		features: Array<{ properties?: { name?: string }; geometry: { type: string; coordinates: unknown } }>;
	};
	const selected: Array<{ name: string; geometry: unknown }> = [];

	for (const item of collection.features) {
		const name = item.properties?.name ?? '';
		if (name === 'France') {
			// La Guayana Francesa viaja dentro del multipolygon de Francia en 110m:
			// mantenemos solo los polígonos que intersectan el bbox de LATAM.
			const polygons =
				item.geometry.type === 'MultiPolygon'
					? (item.geometry.coordinates as Position[][][])
					: [item.geometry.coordinates as Position[][]];
			const kept = polygons.filter((rings) => intersectsLatam(polygonBounds(rings)));
			if (kept.length > 0) {
				selected.push({ name: 'French Guiana', geometry: { type: 'MultiPolygon', coordinates: kept } });
			}
			continue;
		}
		selected.push({ name, geometry: item.geometry });
	}

	return selected.sort((a, b) => a.name.localeCompare(b.name));
}

// --- Main -------------------------------------------------------------------

async function main(): Promise<number> {
	console.log('[map:generate] Leyendo países de las historias…');
	const fromPosts = postCountries(POSTS_DIR);
	const active = new Set([...fromPosts, ...MANUAL_MAP_COUNTRIES]);
	console.log(`[map:generate] Países activos: ${[...active].join(', ') || '(ninguno)'}`);

	console.log('[map:generate] Cargando siluetas Natural Earth 110m…');
	const allCountries = await loadLatamCountries();
	const countries = allCountries.filter((c) => active.has(c.name));
	const missing = [...active].filter((name) => !countries.some((c) => c.name === name));
	if (missing.length) {
		console.warn(`[map:generate] AVISO: países no encontrados en los datos (revisar escritura): ${missing.join(', ')}`);
	}

	const projection = geoAzimuthalEqualArea().rotate([65, 20]);
	projection.fitExtent(
		[[VIEW_PADDING, VIEW_PADDING], [VIEW_WIDTH - VIEW_PADDING, VIEW_HEIGHT - VIEW_PADDING]],
		{ type: 'FeatureCollection', features: countries.map((c) => ({ type: 'Feature', geometry: c.geometry, properties: {} })) } as never,
	);

	const countryPaths = countries.map((c) => ({ name: c.name, d: pathFor(c.geometry, projection) }));

	console.log('[map:generate] Resolviendo geometría de rutas (caché → OSRM)…');
	const { data: cache, existed: cacheExisted } = await readJsonMap(cacheUrl);
	const freshCache: Record<string, LatLon[]> = {};
	let fetched = 0;
	let failed = 0;
	const routes: Array<{ id: string; country: string; name: string; d: string }> = [];

	for (const segment of ROUTES) {
		if (segment.country && !active.has(segment.country)) continue;

		let geometry = cache[segment.id] ?? null;
		if (!geometry) {
			process.stdout.write(`[map:generate] ${segment.id}: obteniendo de OSRM… `);
			geometry = await fetchSegment(segment.id, segment.coordinates);
			if (geometry) {
				freshCache[segment.id] = geometry;
				fetched++;
				process.stdout.write(`ok, ${geometry.length} puntos\n`);
			} else {
				failed++;
				process.stdout.write('falló, usando waypoints directos\n');
			}
		} else {
			process.stdout.write(`[map:generate] ${segment.id}: usando caché (${geometry.length} puntos)\n`);
		}

		const source = geometry ?? segment.coordinates;
		const { simplified } = simplifyRoute(source);
		const line = { type: 'LineString', coordinates: simplified.map(([lat, lng]) => [lng, lat]) };
		routes.push({ id: segment.id, country: segment.country ?? '', name: segment.name, d: pathFor(line, projection) });
		if (geometry) {
			process.stdout.write(`[map:generate] ${segment.id}: simplificado ${source.length} → ${simplified.length} puntos\n`);
		}
	}

	if (fetched > 0 || (!cacheExisted && Object.keys(cache).length === 0)) {
		await new URL('.', cacheUrl).toString(); // no-op placeholder
		const dir = new URL('.', cacheUrl);
		try {
			await writeFile(cacheUrl, `${JSON.stringify({ ...cache, ...freshCache }, null, '\t')}\n`, 'utf8');
			console.log(`[map:generate] Caché OSRM actualizado en ${cacheUrl.pathname}`);
		} catch {
			// .cache puede no ser escribible en algunos entornos; no es crítico
		}
	}

	// Elimina el legado committed si existe (ya no se usa en runtime)
	try {
		await rm(legacyGeometryUrl);
		console.log(`[map:generate] Eliminado legado src/data/route-geometry.json`);
	} catch {
		// no existía, ok
	}

	const points = POINTS.filter((p) => !p.country || active.has(p.country)).map((point) => {
		const [x, y] = projection([point.coordinates[1], point.coordinates[0]]) as [number, number];
		return {
			id: point.id,
			name: point.name,
			description: point.description,
			x: round(x, 1),
			y: round(y, 1),
			...(point.country ? { country: point.country } : {}),
			...(point.href ? { href: point.href } : {}),
		};
	});

	const mapData = {
		viewBox: [VIEW_WIDTH, VIEW_HEIGHT],
		countries: countryPaths,
		routes,
		points,
	};

	await writeFile(outputUrl, `${JSON.stringify(mapData)}\n`, 'utf8');
	const sizeKb = (JSON.stringify(mapData).length / 1024).toFixed(1);
	console.log(`[map:generate] Escrito ${outputUrl.pathname}: ${countryPaths.length} países, ${routes.length} rutas, ${points.length} puntos (${sizeKb} KB)`);
	return 0;
}

process.exit(await main());

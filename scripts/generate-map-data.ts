/**
 * Build-time generator for the static SVG map on /rutas.
 *
 * 1. Country silhouettes: Natural Earth 110m (world-atlas TopoJSON), filtered
 *    to Latin America. An explicit country allowlist keeps the continent
 *    clean; French Guiana (stored inside the France multipolygon in
 *    world-atlas) is recovered with a per-polygon bbox filter, so
 *    metropolitan France and non-LATAM islands (Florida, Cuba, Cape Verde…)
 *    never leak in.
 * 2. Route geometry: OSRM demo server per ROUTES segment. Responses are
 *    cached in `.cache/route-osrm.json` (gitignored) so the map can be
 *    regenerated offline; the legacy committed `src/data/route-geometry.json`
 *    is honored as a seed and migrated into the cache.
 * 3. Routes are simplified with Douglas-Peucker (degree space, capped point
 *    count) and everything is projected once at build time. The result is
 *    written to `src/data/map-data.json` (committed; runtime renders pure
 *    static SVG, no map library, no tiles, no JS).
 *
 * Usage: bun scripts/generate-map-data.ts
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { geoAzimuthalEqualArea, geoPath } from 'd3-geo';
import { ROUTES, POINTS } from '../src/data/route';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const REQUEST_TIMEOUT_MS = 30_000;
const GEOMETRY_DECIMALS = 5;

// ViewBox is vertical: Latin America is taller than wide.
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 1240;
const VIEW_PADDING = 10;

// Approximate LATAM bbox in lon/lat, only used to rescue French Guiana
// from the France multipolygon.
const LATAM_BBOX = { minLon: -118, minLat: -58, maxLon: -30, maxLat: 33 };

// Natural Earth country names.
const COUNTRY_NAMES = [
	'Mexico',
	'Guatemala',
	'Belize',
	'Honduras',
	'El Salvador',
	'Nicaragua',
	'Costa Rica',
	'Panama',
	'Colombia',
	'Venezuela',
	'Ecuador',
	'Peru',
	'Bolivia',
	'Brazil',
	'Paraguay',
	'Chile',
	'Argentina',
	'Uruguay',
	'Guyana',
	'Suriname',
];

// Douglas-Peucker: start tolerance in degrees (~550 m) and tighten the cap.
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
const legacyGeometryUrl = new URL('../src/data/route-geometry.json', import.meta.url);
const outputUrl = new URL('../src/data/map-data.json', import.meta.url);

function round(value: number, decimals: number): number {
	const factor = 10 ** decimals;
	return Math.round(value * factor) / factor;
}

// --- Geometry sources -------------------------------------------------------

async function readJsonMap(
	url: URL,
): Promise<{ data: Record<string, LatLon[]>; existed: boolean }> {
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

async function fetchSegment(
	id: string,
	coordinates: LatLon[],
): Promise<LatLon[] | null> {
	const url = buildOsrmUrl(coordinates);
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = (await response.json()) as OsrmResponse;
			const geometry = data.routes?.[0]?.geometry?.coordinates;
			if (data.code !== 'Ok' || !geometry?.length) {
				throw new Error(`OSRM code=${data.code}`);
			}
			return geometry.map(([lng, lat]) => [
				round(lat, GEOMETRY_DECIMALS),
				round(lng, GEOMETRY_DECIMALS),
			]);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`[map:generate] "${id}" OSRM attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`);
			if (attempt < MAX_ATTEMPTS) {
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
			}
		}
	}
	return null;
}

// --- Simplification (Douglas-Peucker, degree space) --------------------------

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

// --- Projection helpers ------------------------------------------------------

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

// --- Country filtering -------------------------------------------------------

interface CountryPoly {
	name: string;
	// GeoJSON Polygon coordinates: [outerRing, ...holes]
	rings: Position[][];
}

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

function intersectsLatam(bounds: { minLon: number; minLat: number; maxLon: number; maxLat: number }): boolean {
	return (
		bounds.minLon <= LATAM_BBOX.maxLon &&
		bounds.maxLon >= LATAM_BBOX.minLon &&
		bounds.minLat <= LATAM_BBOX.maxLat &&
		bounds.maxLat >= LATAM_BBOX.minLat
	);
}

async function loadLatamCountries(): Promise<Array<{ name: string; geometry: unknown }>> {
	const topology = JSON.parse(
		await readFile(require.resolve('world-atlas/countries-110m.json'), 'utf8'),
	) as { objects: { countries: never } };
	const collection = feature(topology as never, topology.objects.countries) as never as {
		features: Array<{ properties?: { name?: string }; geometry: { type: string; coordinates: unknown } }>;
	};
	const allow = new Set(COUNTRY_NAMES);
	const selected: Array<{ name: string; geometry: unknown }> = [];

	for (const item of collection.features) {
		const name = item.properties?.name ?? '';
		if (allow.has(name)) {
			selected.push({ name, geometry: item.geometry });
			continue;
		}
		// French Guiana ships inside the France multipolygon: keep only the
		// polygons that intersect the LATAM bbox.
		if (name === 'France') {
			const polygons =
				item.geometry.type === 'MultiPolygon'
					? (item.geometry.coordinates as Position[][][])
					: [item.geometry.coordinates as Position[][]];
			const kept = polygons.filter((rings) => intersectsLatam(polygonBounds(rings)));
			if (kept.length > 0) {
				selected.push({
					name: 'French Guiana',
					geometry: { type: 'MultiPolygon', coordinates: kept },
				});
			}
		}
	}

	if (selected.length < COUNTRY_NAMES.length) {
		const found = new Set(selected.map((c) => c.name));
		const missing = COUNTRY_NAMES.filter((n) => !found.has(n));
		throw new Error(`Missing countries in world-atlas data: ${missing.join(', ')}`);
	}

	return selected.sort((a, b) => a.name.localeCompare(b.name));
}

// --- Main ---------------------------------------------------------------------

async function main(): Promise<number> {
	console.log('[map:generate] Loading Natural Earth 110m silhouettes…');
	const countries = await loadLatamCountries();

	// d3-geo convention: to center the projection at (lon -65, lat -20),
	// rotate by the negated angles. rotate([-65, -20]) would mirror the
	// continent east-west.
	const projection = geoAzimuthalEqualArea().rotate([65, 20]);
	projection.fitExtent(
		[
			[VIEW_PADDING, VIEW_PADDING],
			[VIEW_WIDTH - VIEW_PADDING, VIEW_HEIGHT - VIEW_PADDING],
		],
		{ type: 'FeatureCollection', features: countries.map((c) => ({ type: 'Feature', geometry: c.geometry, properties: {} })) } as never,
	);

	const countryPaths = countries.map((c) => ({ name: c.name, d: pathFor(c.geometry, projection) }));

	console.log('[map:generate] Resolving route geometry (cache → legacy → OSRM)…');
	const { data: cache, existed: cacheExisted } = await readJsonMap(cacheUrl);
	const { data: legacy } = await readJsonMap(legacyGeometryUrl);
	const freshCache: Record<string, LatLon[]> = {};
	let fetched = 0;
	let usedLegacy = false;
	const routes: Array<{ id: string; name: string; d: string }> = [];

	for (const segment of ROUTES) {
		let geometry = cache[segment.id] ?? null;
		if (!geometry && legacy[segment.id]) {
			geometry = legacy[segment.id];
			usedLegacy = true;
		}
		if (!geometry) {
			process.stdout.write(`[map:generate] ${segment.id}: fetching from OSRM… `);
			geometry = await fetchSegment(segment.id, segment.coordinates);
			if (geometry) {
				freshCache[segment.id] = geometry;
				fetched++;
				process.stdout.write(`ok, ${geometry.length} points\n`);
			} else {
				failed++;
				process.stdout.write('failed, falling back to straight waypoints\n');
			}
		} else {
			process.stdout.write(`[map:generate] ${segment.id}: using cached geometry (${geometry.length} points)\n`);
		}

		const source = geometry ?? segment.coordinates;
		const { simplified, tolerance } = simplifyRoute(source);
		const line = {
			type: 'LineString',
			coordinates: simplified.map(([lat, lng]) => [lng, lat]),
		};
		routes.push({ id: segment.id, name: segment.name, d: pathFor(line, projection) });
		if (geometry) {
			process.stdout.write(
				`[map:generate] ${segment.id}: simplified ${source.length} → ${simplified.length} points (tolerance ${tolerance.toFixed(4)}°)\n`,
			);
		}
	}

	// Seed the cache with legacy data so the repo can drop route-geometry.json
	// and still regenerate offline; fresh OSRM responses are cached too.
	if (fetched > 0 || (usedLegacy && !cacheExisted)) {
		await mkdir(new URL('.', cacheUrl), { recursive: true });
		await writeFile(
			cacheUrl,
			`${JSON.stringify({ ...legacy, ...cache, ...freshCache }, null, '\t')}\n`,
			'utf8',
		);
		console.log(`[map:generate] OSRM cache updated at ${cacheUrl.pathname}`);
	}

	const points = POINTS.map((point) => {
		const [x, y] = projection([point.coordinates[1], point.coordinates[0]]) as [number, number];
		return {
			id: point.id,
			name: point.name,
			description: point.description,
			x: round(x, 1),
			y: round(y, 1),
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
	console.log(
		`[map:generate] Wrote ${outputUrl.pathname}: ${countryPaths.length} countries, ${routes.length} routes, ${points.length} points (${sizeKb} KB)`,
	);
	return 0;
}

process.exit(await main());

/**
 * Build-time generator for real route geometry.
 *
 * Queries the public OSRM demo server for each segment of `ROUTES`
 * (waypoints are stored as [lat, lng], OSRM expects [lng, lat]) and writes
 * `src/data/route-geometry.json` as `{ [segmentId]: [lat, lng][] }`.
 * The JSON is committed so the runtime never calls external APIs.
 *
 * Usage: bun scripts/generate-route-geometry.ts
 */
import { writeFile } from 'node:fs/promises';
import { ROUTES } from '../src/data/route';

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const DECIMALS = 5;
const REQUEST_TIMEOUT_MS = 30_000;

interface OsrmResponse {
	code: string;
	routes?: Array<{
		geometry?: { coordinates?: [number, number][] };
	}>;
}

function round(value: number): number {
	return Number(value.toFixed(DECIMALS));
}

function buildUrl(coordinates: [number, number][]): string {
	const waypoints = coordinates.map(([lat, lng]) => `${lng},${lat}`);
	return `${OSRM_BASE}/${waypoints.join(';')}?overview=full&geometries=geojson&continue_straight=false`;
}

async function fetchSegment(id: string, coordinates: [number, number][]): Promise<[number, number][] | null> {
	const url = buildUrl(coordinates);
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const data = (await response.json()) as OsrmResponse;
			const geometry = data.routes?.[0]?.geometry?.coordinates;
			if (data.code !== 'Ok' || !geometry?.length) {
				throw new Error(`OSRM code=${data.code}`);
			}
			return geometry.map(([lng, lat]) => [round(lat), round(lng)]);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`[routes:generate] "${id}" attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`);
			if (attempt < MAX_ATTEMPTS) {
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
			}
		}
	}
	return null;
}

async function main(): Promise<number> {
	console.log(`[routes:generate] Fetching real geometry for ${ROUTES.length} segment(s) from OSRM demo server…`);
	const geometry: Record<string, [number, number][]> = {};
	let failed = 0;

	for (const segment of ROUTES) {
		process.stdout.write(`[routes:generate] ${segment.id} (${segment.coordinates.length} waypoints)… `);
		const path = await fetchSegment(segment.id, segment.coordinates);
		if (!path) {
			failed++;
			process.stdout.write(`OMITTED (map will fall back to straight waypoints)\n`);
			continue;
		}
		geometry[segment.id] = path;
		process.stdout.write(`ok, ${path.length} points\n`);
	}

	if (failed === ROUTES.length) {
		console.error(`[routes:generate] All segments failed: route-geometry.json was NOT written.`);
		return 1;
	}

	const outPath = new URL('../src/data/route-geometry.json', import.meta.url);
	await writeFile(outPath, `${JSON.stringify(geometry, null, '\t')}\n`, 'utf8');
	console.log(`[routes:generate] Wrote ${Object.keys(geometry).length}/${ROUTES.length} segment(s) to ${outPath.pathname}`);
	return 0;
}

process.exit(await main());

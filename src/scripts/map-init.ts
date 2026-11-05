import leafletCss from 'leaflet/dist/leaflet.css?inline';
import L from 'leaflet';
import geometryData from '../data/route-geometry.json';
import { POINTS, ROUTES } from '../data/route';
import type { RoutePoint } from '../data/route';

// Leaflet ships unlayered CSS that would override the Once UI theming in
// global.css, so it is injected inside the pre-declared `leaflet` cascade
// layer (see `@layer` statement at the top of global.css).
function injectLeafletStyles(): void {
	if (document.querySelector('style[data-leaflet]')) return;
	const style = document.createElement('style');
	style.dataset.leaflet = '';
	style.textContent = `@layer leaflet { ${leafletCss} }`;
	document.head.appendChild(style);
}

const ACCENT_FALLBACK = '#deb574';
const CASING_FALLBACK = '#ffffff';

// Real road geometry generated at build time by `bun routes:generate`
// (OSRM demo server) and committed, so the runtime never calls external
// APIs. Keys are segment ids; values are already [lat, lng] for Leaflet.
const ROUTE_GEOMETRY = geometryData as Record<string, [number, number][]>;

const LATIN_AMERICA_BOUNDS: L.LatLngBoundsExpression = [
	[-56, -118],
	[32, -30],
];

const PIN_SVG = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" fill="var(--accent-solid-strong)" stroke="var(--page-background)" stroke-width="1.5"/><circle cx="12" cy="10" r="3" fill="var(--page-background)"/></svg>`;

function readToken(name: string, fallback: string): string {
	return (
		getComputedStyle(document.documentElement)
			.getPropertyValue(name)
			.trim() || fallback
	);
}

function createPinIcon(): L.DivIcon {
	return L.divIcon({
		html: PIN_SVG,
		className: 'route-map-pin',
		iconSize: [24, 24],
		iconAnchor: [12, 22],
		popupAnchor: [0, -22],
	});
}

function createPopupHtml(point: RoutePoint): string {
	const link = point.href
		? `<a class="route-map-popup-link" href="${point.href}">Leer el artículo →</a>`
		: '';
	return `<p class="route-map-popup-title">${point.name}</p><p class="route-map-popup-description">${point.description}</p>${link}`;
}

export function initRouteMap(containerId: string): void {
	const container = document.getElementById(containerId);
	if (!container || container.dataset.mapInitialized) return;
	container.dataset.mapInitialized = 'true';

	injectLeafletStyles();

	const map = L.map(container, { scrollWheelZoom: false });

	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution:
			'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	}).addTo(map);

	map.fitBounds(LATIN_AMERICA_BOUNDS);

	const casing = readToken('--neutral-background-weak', CASING_FALLBACK);
	const accent = readToken('--accent-solid-strong', ACCENT_FALLBACK);
	const pageBackground = readToken('--page-background', CASING_FALLBACK);

	for (const segment of ROUTES) {
		const path = ROUTE_GEOMETRY[segment.id] ?? segment.coordinates;

		// GPS-style casing so the route stays legible over any tile/theme.
		L.polyline(path, {
			color: casing,
			weight: 7,
			opacity: 0.85,
			lineJoin: 'round',
			lineCap: 'round',
			interactive: false,
		}).addTo(map);

		L.polyline(path, {
			color: accent,
			weight: 3.5,
			opacity: 1,
			lineJoin: 'round',
			lineCap: 'round',
			interactive: false,
		}).addTo(map);

		L.polyline(path, {
			color: pageBackground,
			weight: 1.5,
			opacity: 0.5,
			lineJoin: 'round',
			lineCap: 'round',
			interactive: false,
		}).addTo(map);
	}

	const markers = L.layerGroup(
		POINTS.map((point) =>
			L.marker(point.coordinates, { icon: createPinIcon() }).bindPopup(
				createPopupHtml(point),
			),
		),
	).addTo(map);

	const toggleButton = document.getElementById('route-points-toggle');
	if (toggleButton instanceof HTMLButtonElement) {
		let pointsVisible = true;
		toggleButton.disabled = false;
		toggleButton.addEventListener('click', () => {
			pointsVisible = !pointsVisible;
			if (pointsVisible) {
				markers.addTo(map);
			} else {
				map.removeLayer(markers);
			}
			toggleButton.setAttribute('aria-pressed', String(!pointsVisible));
			toggleButton.textContent = pointsVisible ? 'Ocultar puntos' : 'Mostrar puntos';
		});
	}
}

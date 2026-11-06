// TODO: reemplazar con el recorrido real de la familia
// Los viajes (trip) y sus coordenadas se derivan ahora del frontmatter de cada
// artículo en src/content/blog/ (campos `trip`, `country` y `coordinates`).
// Este archivo solo conserva los tipos y los países forzados a mano.

export interface RoutePoint {
	id: string;
	name: string;
	description: string;
	coordinates: [number, number]; // [latitud, longitud]
	country: string;
	href: string;
	trip: string;
	pubDate: string;
}

// Países que se fuerzan a aparecer en el mapa aunque no tengan artículo propio
// (ej. países de paso sin historia aún). Agregar nombres en inglés (Natural Earth).
export const MANUAL_MAP_COUNTRIES: string[] = [];

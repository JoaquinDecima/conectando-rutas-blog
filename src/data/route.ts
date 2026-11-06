// TODO: reemplazar con el recorrido real de la familia

export interface RouteSegment {
	id: string;
	name: string;
	region: string;
	coordinates: [number, number][];
}

export interface RoutePoint {
	id: string;
	name: string;
	description: string;
	coordinates: [number, number];
	href?: string;
}

export const ROUTES: RouteSegment[] = [
	{
		id: 'ruta-40-patagonica',
		country: 'Argentina',
		name: 'Ruta 40 patagónica',
		region: 'Sudamérica',
		coordinates: [
			[-41.13, -71.31],
			[-42.18, -71.49],
			[-42.9, -71.31],
			[-46.57, -70.93],
			[-48.75, -69.19],
			[-49.33, -72.89],
			[-50.34, -72.27],
		],
	},
];

export const POINTS: RoutePoint[] = [
	{
		id: 'bariloche',
		name: 'Bariloche',
		description:
			'Base de nuestro roadtrip por la Ruta 40: lagos, chocolate y el arranque de la Patagonia.',
			country: 'Argentina',
		coordinates: [-41.13, -71.31],
		href: '/blog/itinerario-patagonia-ruta-40/',
	},
	{
		id: 'el-chalten',
		name: 'El Chaltén',
		description:
			'Capital nacional del trekking: Fitz Roy, lagunas y senderos para toda la familia.',
			country: 'Argentina',
		coordinates: [-49.33, -72.89],
		href: '/blog/itinerario-patagonia-ruta-40/',
	},
	{
		id: 'el-calafate',
		name: 'El Calafate',
		description:
			'Puerta del glaciar Perito Moreno, la parada más austral de nuestra ruta.',
			country: 'Argentina',
		coordinates: [-50.34, -72.27],
	},
];

// Países extra a incluir en el mapa manualmente (ej. países de paso sin puntos cargados)
export const MANUAL_MAP_COUNTRIES: string[] = [];

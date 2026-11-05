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
	{
		id: 'sierra-del-peru',
		name: 'Sierra del Perú',
		region: 'Sudamérica',
		coordinates: [
			[-12.05, -77.04],
			[-13.53, -71.97],
			[-13.16, -72.55],
		],
	},
];

export const POINTS: RoutePoint[] = [
	{
		id: 'bariloche',
		name: 'Bariloche',
		description:
			'Base de nuestro roadtrip por la Ruta 40: lagos, chocolate y el arranque de la Patagonia.',
		coordinates: [-41.13, -71.31],
		href: '/blog/itinerario-patagonia-ruta-40/',
	},
	{
		id: 'el-chalten',
		name: 'El Chaltén',
		description:
			'Capital nacional del trekking: Fitz Roy, lagunas y senderos para toda la familia.',
		coordinates: [-49.33, -72.89],
		href: '/blog/itinerario-patagonia-ruta-40/',
	},
	{
		id: 'el-calafate',
		name: 'El Calafate',
		description:
			'Puerta del glaciar Perito Moreno, la parada más austral de nuestra ruta.',
		coordinates: [-50.34, -72.27],
	},
	{
		id: 'cusco',
		name: 'Cusco',
		description:
			'Cuatro días entre ciudad imperial, Valle Sagrado y sitios arqueológicos.',
		coordinates: [-13.53, -71.97],
		href: '/blog/itinerario-cusco-4-dias/',
	},
	{
		id: 'machu-picchu',
		name: 'Machu Picchu',
		description:
			'La ciudadela inca: entradas, horarios y los errores que evitaremos la próxima vez.',
		coordinates: [-13.16, -72.55],
		href: '/blog/consejos-visitar-machu-picchu/',
	},
	{
		id: 'santiago-de-chile',
		name: 'Santiago de Chile',
		description:
			'Punto de partida de nuestro viaje mochilero por Chile, con presupuesto real por día.',
		coordinates: [-33.45, -70.67],
		href: '/blog/presupuesto-mochilero-chile/',
	},
];

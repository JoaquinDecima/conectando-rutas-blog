// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Conectando Rutas';
export const SITE_DESCRIPTION =
	'Rutas, destinos y consejos de viaje para descubrir el mundo kilómetro a kilómetro.';

export const NAV_LINKS = [
	{ label: 'Inicio', href: '/' },
	{ label: 'Blog', href: '/blog' },
	{ label: 'Destinos', href: '/destinos' },
	{ label: 'Rutas', href: '/rutas' },
	{ label: 'Nosotros', href: '/about' },
	{ label: 'Contacto', href: '/contacto' },
] as const;

export type CategorySlug = 'itinerarios' | 'consejos' | 'presupuestos' | 'requisitos';

export interface Category {
	slug: CategorySlug;
	label: string;
	description: string;
}

export const CATEGORIES: Category[] = [
	{
		slug: 'itinerarios',
		label: 'Itinerarios',
		description: 'Rutas día por día con distancias, etapas y tiempos.',
	},
	{
		slug: 'consejos',
		label: 'Consejos',
		description: 'Tips prácticos que aprendimos viajando para que no repitas nuestros errores.',
	},
	{
		slug: 'presupuestos',
		label: 'Presupuestos',
		description: 'Cuánto cuesta cada destino: gastos reales desglosados por día.',
	},
	{
		slug: 'requisitos',
		label: 'Requisitos',
		description: 'Documentación, visas y trámites para cruzar fronteras sin sorpresas.',
	},
];

export const SOCIAL_LINKS: {
	label: string;
	href: string;
	icon: 'tiktok' | 'instagram' | 'youtube';
}[] = [
	{ label: 'TikTok', href: 'https://www.tiktok.com/', icon: 'tiktok' },
	{ label: 'Instagram', href: 'https://www.instagram.com/conectando.rutas', icon: 'instagram' },
	{ label: 'YouTube', href: 'https://www.youtube.com/', icon: 'youtube' },
];

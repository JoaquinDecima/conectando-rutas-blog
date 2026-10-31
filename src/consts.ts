// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Conectando Rutas';
export const SITE_DESCRIPTION =
	'Rutas, destinos y consejos de viaje para descubrir el mundo kilómetro a kilómetro.';

export const NAV_LINKS = [
	{ label: 'Inicio', href: '/' },
	{ label: 'Blog', href: '/blog' },
	{ label: 'Nosotros', href: '/about' },
] as const;

export const SOCIAL_LINKS: {
	label: string;
	href: string;
	icon: 'tiktok' | 'instagram' | 'youtube';
}[] = [
	{ label: 'TikTok', href: 'https://www.tiktok.com/', icon: 'tiktok' },
	{ label: 'Instagram', href: 'https://www.instagram.com/', icon: 'instagram' },
	{ label: 'YouTube', href: 'https://www.youtube.com/', icon: 'youtube' },
];

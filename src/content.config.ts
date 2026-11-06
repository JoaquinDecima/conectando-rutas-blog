import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// Transform string to Date object
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
			category: z.enum(['itinerarios', 'consejos', 'presupuestos', 'requisitos']),
			country: z.string().optional(),
			region: z.string().optional(),
			tags: z.array(z.string()).optional(),
			// Viaje al que pertenece este artículo (agrupa puntos en una línea de ruta distinta en el mapa)
			trip: z.string().optional(),
			// Coordenadas [latitud, longitud] del artículo para pin y línea de ruta
			coordinates: z.array(z.number()).length(2).optional(),
		}),
});

export const collections = { blog };

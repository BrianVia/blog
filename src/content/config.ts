import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/pages/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    createdAt: z.coerce.date().optional(),
    slug: z.string(),
    tags: z.array(z.string()).optional(),
    heroImageUrl: z.string().optional(),
    heroImageAlt: z.string().optional(),
    published: z.boolean().optional(),
  }),
});

export const collections = { blog };

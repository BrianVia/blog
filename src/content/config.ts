import { defineCollection, z } from "astro:content";
import { fileToImageAsset, notionLoader, notionPageSchema } from "notion-astro-loader";
import { transformedPropertySchema } from "notion-astro-loader/schemas";

const database = defineCollection({
  loader: notionLoader({
    auth: import.meta.env.NOTION_API_KEY,
    database_id: import.meta.env.NOTION_DATABASE_ID,
    filter: {
      and: [
        {
          property: "Published",
          checkbox: {
            equals: true,
          },
        },
        {
          property: "Publication",
          select: {
            equals: "Personal Blog",
          },
        },
      ],
    },
  }),
  schema: notionPageSchema({
    properties: z.object({
      Name: transformedPropertySchema.title,
      Description: transformedPropertySchema.rich_text,
      slug: transformedPropertySchema.rich_text,
      Published: transformedPropertySchema.checkbox,
      Created: transformedPropertySchema.created_time,
      LastEdited: transformedPropertySchema.created_time.optional(),
      CoverImage: transformedPropertySchema.url.optional(),
      Publication: transformedPropertySchema.select,
      Tags: transformedPropertySchema.multi_select,
      heroImageUrl: transformedPropertySchema.url.optional(),
    }),
  }),
  type: "content_layer",
});

export const collections = { database };

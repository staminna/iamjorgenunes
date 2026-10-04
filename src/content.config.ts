import { defineCollection } from "astro:content";
import config from ".astro/config.generated.json";
import { button, sectionsSchema } from "./sections.schema";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import {
  directusLoader,
  rewriteDirectusUrl,
  resolveItemImage,
  resolveItemGallery,
} from "./lib/directus-loader";
// Importing the loader runs its dotenv side-effect, so process.env now
// reflects the .env file values regardless of the parent shell state.

const portfolioFolder = config.settings.portfolioFolder || "portfolio";
const servicesFolder = config.settings.servicesFolder || "services";

const useDirectus = !!(process.env.DIRECTUS_URL && process.env.DIRECTUS_TOKEN);

// Universal Page Schema
export const page = z.object({
  title: z.string(),
  author: z.string().optional(),
  categories: z.array(z.string()).default(["others"]).optional(),
  tags: z.array(z.string()).default(["others"]).optional(),
  date: z.coerce.date().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  draft: z.boolean().optional(),
  button: button.optional(),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
  robots: z.string().optional(),
  excludeFromSitemap: z.boolean().optional(),
  excludeFromCollection: z.boolean().optional(),
  customSlug: z.string().optional(),
  weight: z.number().optional(),
  canonical: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  disableTagline: z.boolean().optional(),
  ...sectionsSchema,
});

// ----- Pages collection ---------------------------------------------------
const pagesCollection = defineCollection({
  loader: useDirectus
    ? directusLoader({
        collection: "pages",
        sort: "title",
        renderMarkdownBody: true,
        transform: (item: any) => ({
          idSuffix: item.slug,
          data: {
            title: item.title,
            metaDescription: item.meta_description ?? undefined,
            draft: false,
          },
        }),
      })
    : glob({ base: "./src/content/pages", pattern: "**/*.{md,mdx}" }),
  schema: page,
});

// ----- Services collection ------------------------------------------------
const serviceCollection = defineCollection({
  loader: useDirectus
    ? directusLoader({
        collection: "services",
        sort: "sort,date,id",
        fields: "*",
        renderMarkdownBody: true,
        transform: (item: any) => ({
          idSuffix: item.slug,
          data: {
            title: item.title,
            customSlug: item.slug,
            description: item.description ?? undefined,
            icon: rewriteDirectusUrl(item.icon),
            image: resolveItemImage(item),
            date: item.date ?? undefined,
          },
        }),
      })
    : glob({
        base: `./src/content/${servicesFolder}`,
        pattern: "**/*.{md,mdx}",
      }),
  schema: page.extend({
    icon: z.string().optional(),
  }),
});

// ----- Portfolio collection -----------------------------------------------
const portfolioCollection = defineCollection({
  loader: useDirectus
    ? directusLoader({
        collection: "portfolio",
        sort: "sort,date,id",
        fields: "*,gallery.directus_files_id",
        renderMarkdownBody: true,
        transform: (item: any) => {
          const cover = resolveItemImage(item);
          const gallery = resolveItemGallery(item);
          // Cover always first; dedupe so the swiper doesn't show duplicates.
          const allImages = cover
            ? [cover, ...gallery.filter((g) => g !== cover)]
            : gallery;
          return {
            idSuffix: item.slug,
            data: {
              title: item.title,
              customSlug: item.slug,
              description: item.description ?? undefined,
              date: item.date ?? undefined,
              image: cover,
              images: allImages.length ? allImages : undefined,
              categories: item.categories ?? undefined,
              information: item.information ?? undefined,
            },
          };
        },
      })
    : glob({
        base: `./src/content/${portfolioFolder}`,
        pattern: "**/*.{md,mdx}",
      }),
  schema: page.extend({
    images: z.array(z.string()).min(1).optional(),
    options: z
      .object({
        layout: z.enum(["masonry", "grid", "full-width", "slider"]),
        appearance: z.enum(["dark", "light"]).optional(),
        limit: z.union([z.number().int(), z.literal(false)]).optional(),
      })
      .optional(),
    information: z
      .array(
        z.object({
          label: z.string(),
          value: z.string(),
        }),
      )
      .optional(),
  }),
});

// ----- Sections + homepage stay as glob (layout/options/form schema) ------
export const collections = {
  [servicesFolder]: serviceCollection,
  services: serviceCollection,
  [portfolioFolder]: portfolioCollection,
  portfolio: portfolioCollection,
  pages: pagesCollection,
  sections: defineCollection({
    loader: glob({ base: "./src/content/sections", pattern: "**/*.{md,mdx}" }),
  }),
  homepage: defineCollection({
    loader: glob({ base: "./src/content/homepage", pattern: "**/*.{md,mdx}" }),
  }),
};

import type { Loader, LoaderContext } from "astro/loaders";
import { marked } from "marked";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Force-reload `.env` from project root with override so a stale shell var
// (e.g. DIRECTUS_URL=http://localhost:8065 from a prior session) cannot
// poison the build.
const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../.env"), override: true });

const DIRECTUS_URL = process.env.DIRECTUS_URL || "";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN || "";

/**
 * Rewrites a Directus asset URL (https://nowos.varrho.com/assets/<uuid>) to
 * the local cached path (/images/cms/<uuid>.jpg) populated by
 * `scripts/cms-cache-images.mjs`. Non-Directus URLs and falsy values pass
 * through unchanged. This keeps the browser away from the private CMS.
 */
export function rewriteDirectusUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (!DIRECTUS_URL) return value;
  const prefix = `${DIRECTUS_URL}/assets/`;
  if (!value.startsWith(prefix)) return value;
  const uuid = value.slice(prefix.length).split("?")[0];
  return `/images/cms/${uuid}.jpg`;
}

/** Convert a Directus file UUID to the cached local path. */
export function fileUuidToLocalPath(uuid?: string | null): string | undefined {
  if (!uuid) return undefined;
  return `/images/cms/${uuid}.jpg`;
}

/** Resolve a portfolio/work item's "image" — prefers new file_picker UUID
 * over the legacy `image` URL string. Returns the cached local path. */
export function resolveItemImage(item: {
  image_file?: string | null;
  image?: string | null;
}): string | undefined {
  return (
    fileUuidToLocalPath(item.image_file) || rewriteDirectusUrl(item.image)
  );
}

/** Map an expanded gallery (M2M to directus_files) to local image paths.
 * Falls back to the legacy `images` string array when the gallery is empty. */
export function resolveItemGallery(item: {
  gallery?: Array<{ directus_files_id?: string | null } | string> | null;
  images?: Array<string | null> | null;
}): string[] {
  if (Array.isArray(item.gallery) && item.gallery.length) {
    return item.gallery
      .map((row) => {
        if (typeof row === "string") return fileUuidToLocalPath(row);
        return fileUuidToLocalPath(row?.directus_files_id);
      })
      .filter((s): s is string => !!s);
  }
  if (Array.isArray(item.images)) {
    return item.images
      .map((s) => rewriteDirectusUrl(s))
      .filter((s): s is string => !!s);
  }
  return [];
}

interface DirectusItem {
  id: string | number;
  status?: string;
  sort?: number | null;
  slug?: string;
  title?: string;
  body?: string;
  [key: string]: unknown;
}

interface DirectusLoaderOptions<T extends DirectusItem> {
  collection: string;
  /** Sort param sent to Directus (default: "sort,date,id"). */
  sort?: string;
  /** Optional ?fields= query (e.g. to expand M2M relations). */
  fields?: string;
  /** Map a Directus row → { idSuffix, data }. idSuffix becomes the part after "english/". */
  transform: (item: T) => { idSuffix: string; data: Record<string, unknown> };
  /** When true, render `body` markdown to HTML and attach as rendered.html. */
  renderMarkdownBody?: boolean;
}

async function fetchAll<T>(
  collection: string,
  sort: string,
  fields?: string,
): Promise<T[]> {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
    throw new Error(
      "DIRECTUS_URL or DIRECTUS_TOKEN not set — cannot load CMS content.",
    );
  }
  const url = new URL(`/items/${collection}`, DIRECTUS_URL);
  url.searchParams.set("limit", "-1");
  url.searchParams.set("sort", sort);
  url.searchParams.set("filter[status][_eq]", "published");
  if (fields) url.searchParams.set("fields", fields);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(
      `Directus ${collection} fetch failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { data: T[] };
  return json.data;
}

async function fetchSingleton<T>(collection: string): Promise<T> {
  if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
    throw new Error(
      "DIRECTUS_URL or DIRECTUS_TOKEN not set — cannot load CMS content.",
    );
  }
  const res = await fetch(`${DIRECTUS_URL}/items/${collection}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(
      `Directus singleton ${collection} fetch failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export function directusLoader<T extends DirectusItem>(
  opts: DirectusLoaderOptions<T>,
): Loader {
  return {
    name: `directus:${opts.collection}`,
    load: async ({ store, parseData, generateDigest, logger }: LoaderContext) => {
      logger.info(`Loading ${opts.collection} from Directus`);
      const items = await fetchAll<T>(
        opts.collection,
        opts.sort || "sort,date,id",
        opts.fields,
      );
      store.clear();
      for (const item of items) {
        const { idSuffix, data } = opts.transform(item);
        const id = `english/${idSuffix}`;
        const body = (item.body as string | undefined) || "";
        const parsed = await parseData({ id, data });
        const entry: Parameters<typeof store.set>[0] = {
          id,
          data: parsed,
          body,
          digest: generateDigest({ ...parsed, body }),
        };
        if (opts.renderMarkdownBody && body) {
          entry.rendered = {
            html: marked.parse(body, { async: false }) as string,
            metadata: {},
          };
        }
        store.set(entry);
      }
      logger.info(`  ↳ ${items.length} item(s)`);
    },
  };
}

/** Memoised getter for the homepage singleton (banner copy, section titles, CTA, contact). */
let _homepageCache: any | null = null;
export async function getHomepageCMS() {
  if (_homepageCache) return _homepageCache;
  try {
    _homepageCache = await fetchSingleton("homepage");
  } catch (err) {
    console.warn(
      "[directus] homepage singleton fetch failed — falling back to defaults:",
      (err as Error).message,
    );
    _homepageCache = {};
  }
  return _homepageCache;
}

/** Memoised getter for site_settings singleton. */
let _settingsCache: any | null = null;
export async function getSiteSettingsCMS() {
  if (_settingsCache) return _settingsCache;
  try {
    _settingsCache = await fetchSingleton("site_settings");
  } catch (err) {
    console.warn(
      "[directus] site_settings singleton fetch failed — falling back to defaults:",
      (err as Error).message,
    );
    _settingsCache = {};
  }
  return _settingsCache;
}

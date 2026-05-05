// Download Directus image assets to src/assets/images/cms/ so Astro Image
// can optimise + serve them from our own origin (no client-side CORS / auth).
// Runs as a prebuild step.

import dotenv from "dotenv";
dotenv.config({ override: true });

import { promises as fs } from "node:fs";
import path from "node:path";

const DIRECTUS_URL = process.env.DIRECTUS_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const CACHE_DIR = path.join(ROOT, "src/assets/images/cms");

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.warn("[cms-cache-images] DIRECTUS_URL / DIRECTUS_TOKEN not set — skipping.");
  process.exit(0);
}

async function api(p) {
  const res = await fetch(`${DIRECTUS_URL}${p}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (!res.ok) throw new Error(`${p} -> ${res.status}`);
  return res.json();
}

function extractUuid(url) {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith(`${DIRECTUS_URL}/assets/`)) return null;
  return url.split("/assets/")[1].split("?")[0];
}

async function downloadAsset(uuid) {
  const target = path.join(CACHE_DIR, `${uuid}.jpg`);
  try {
    await fs.access(target);
    return target; // already cached
  } catch {}
  const res = await fetch(`${DIRECTUS_URL}/assets/${uuid}`, {
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${uuid}: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(target, buf);
  console.log(`  ↓ ${uuid}.jpg (${(buf.length / 1024).toFixed(0)}KB)`);
  return target;
}

async function main() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  console.log(`Caching Directus assets to ${path.relative(ROOT, CACHE_DIR)}/`);

  const uuids = new Set();
  for (const collection of ["portfolio", "services"]) {
    let json;
    try {
      json = await api(`/items/${collection}?limit=-1&fields=image,images`);
    } catch (err) {
      console.warn(`  ! could not list ${collection}: ${err.message}`);
      continue;
    }
    for (const item of json.data || []) {
      const u1 = extractUuid(item.image);
      if (u1) uuids.add(u1);
      for (const img of item.images || []) {
        const u2 = extractUuid(img);
        if (u2) uuids.add(u2);
      }
    }
  }

  for (const uuid of uuids) {
    try {
      await downloadAsset(uuid);
    } catch (err) {
      console.warn(`  ! ${uuid}: ${err.message}`);
    }
  }
  console.log(`Cached ${uuids.size} asset(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

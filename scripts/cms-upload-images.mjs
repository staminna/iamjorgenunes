// Upload + resize portfolio cover images to Directus.
// Idempotent: skips items that already point to a Directus asset.
// Re-uploads if --force is passed.

import dotenv from "dotenv";
dotenv.config({ override: true });

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const DIRECTUS_URL = process.env.DIRECTUS_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");
const FORCE = process.argv.includes("--force");
const TARGET_WIDTH = 1600; // CMS-friendly portfolio cover width
const TARGET_QUALITY = 82;

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error("Missing DIRECTUS_URL or DIRECTUS_TOKEN.");
  process.exit(1);
}

async function api(method, p, body) {
  const res = await fetch(`${DIRECTUS_URL}${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `${method} ${p} -> ${res.status}: ${JSON.stringify(json.errors || json).slice(0, 600)}`,
    );
  }
  return json;
}

async function uploadFile(buffer, filename, title) {
  const form = new FormData();
  form.append("title", title);
  form.append(
    "file",
    new Blob([buffer], { type: "image/jpeg" }),
    filename,
  );
  const res = await fetch(`${DIRECTUS_URL}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  return json.data;
}

async function processItem(item) {
  const localMatch = /^\/(?:src\/assets\/)?images\/(.+)$/.exec(item.image || "");
  const isDirectus = (item.image || "").startsWith(`${DIRECTUS_URL}/assets/`);

  if (isDirectus && !FORCE) {
    console.log(`  · ${item.slug} already in Directus`);
    return;
  }

  let sourcePath;
  if (localMatch) {
    sourcePath = path.join(ROOT, "src/assets/images", localMatch[1]);
  } else if (isDirectus && FORCE) {
    // Download current Directus file, re-resize, re-upload
    const uuid = item.image.split("/assets/")[1].split("?")[0];
    const r = await fetch(`${DIRECTUS_URL}/assets/${uuid}`, {
      headers: { Authorization: `Bearer ${DIRECTUS_TOKEN}` },
    });
    if (!r.ok) throw new Error(`Fetch existing asset failed: ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    sourcePath = `__inline__:${uuid}`;
    await processBuffer(item, buf, `${item.slug}.jpg`);
    return;
  } else {
    console.log(`  ! ${item.slug} has no usable image (${item.image || "empty"}) — skipping`);
    return;
  }

  let raw;
  try {
    raw = await fs.readFile(sourcePath);
  } catch {
    console.log(`  ! ${item.slug}: source not found at ${sourcePath} — skipping`);
    return;
  }
  await processBuffer(item, raw, `${item.slug}.jpg`);
}

async function processBuffer(item, raw, filename) {
  const meta = await sharp(raw).metadata();
  const resized = await sharp(raw)
    .rotate()
    .resize({
      width: Math.min(TARGET_WIDTH, meta.width || TARGET_WIDTH),
      withoutEnlargement: true,
    })
    .jpeg({ quality: TARGET_QUALITY, mozjpeg: true })
    .toBuffer();

  const uploaded = await uploadFile(resized, filename, item.title);
  const url = `${DIRECTUS_URL}/assets/${uploaded.id}`;
  await api("PATCH", `/items/portfolio/${item.id}`, {
    image: url,
    images: [url],
  });
  console.log(
    `  ↑ ${item.slug}: ${(raw.length / 1024).toFixed(0)}KB → ${(resized.length / 1024).toFixed(0)}KB @ ${meta.width}×${meta.height} → uploaded as ${uploaded.id}`,
  );
}

async function main() {
  console.log(`Uploading & resizing portfolio cover images (target ${TARGET_WIDTH}px, q=${TARGET_QUALITY})${FORCE ? " [--force]" : ""}`);
  const all = await api("GET", "/items/portfolio?limit=-1&sort=sort,id");
  for (const item of all.data) {
    await processItem(item);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Add proper Directus file-picker fields to portfolio + services so editors
// can pick images from the CMS Library instead of pasting URLs. Idempotent.
//
//   portfolio.image_file  -> single file (FK to directus_files)
//   portfolio.gallery     -> M2M to directus_files (junction: portfolio_files)
//   services.image_file   -> single file (FK to directus_files)
//
// Also: migrates existing string `image` URLs into image_file as a UUID, then
// hides the legacy string field from the admin UI.

import dotenv from "dotenv";
dotenv.config({ override: true });

const DIRECTUS_URL = process.env.DIRECTUS_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

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
    const err = new Error(
      `${method} ${p} -> ${res.status}: ${JSON.stringify(json.errors || json).slice(0, 600)}`,
    );
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function ensureFileField(collection, field) {
  try {
    await api("GET", `/fields/${collection}/${field}`);
    console.log(`  · ${collection}.${field} exists`);
    return;
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
  }
  await api("POST", `/fields/${collection}`, {
    field,
    type: "uuid",
    meta: {
      interface: "file-image",
      display: "image",
      special: ["file"],
      width: "full",
      note: "Pick an image from the Directus File Library or upload a new one.",
    },
    schema: {
      foreign_key_table: "directus_files",
      foreign_key_column: "id",
    },
  });
  // Relation
  try {
    await api("POST", `/relations`, {
      collection,
      field,
      related_collection: "directus_files",
    });
  } catch (e) {
    if (e.status !== 400) throw e; // 400 likely "already exists"
  }
  console.log(`  ✓ ${collection}.${field} (file picker)`);
}

async function ensureJunctionM2M(collection, field, junctionName) {
  // 1. Junction collection
  try {
    await api("GET", `/collections/${junctionName}`);
    console.log(`  · junction ${junctionName} exists`);
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
    await api("POST", "/collections", {
      collection: junctionName,
      meta: { hidden: true, icon: "import_export" },
      schema: { name: junctionName },
      fields: [
        {
          field: "id",
          type: "integer",
          meta: { hidden: true, interface: "input", readonly: true },
          schema: { is_primary_key: true, has_auto_increment: true },
        },
      ],
    });
    console.log(`  ✓ created junction ${junctionName}`);
  }

  // 2. portfolio_id FK (junction → parent)
  try {
    await api("GET", `/fields/${junctionName}/${collection}_id`);
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
    await api("POST", `/fields/${junctionName}`, {
      field: `${collection}_id`,
      type: "integer",
      meta: { interface: "select-dropdown-m2o", hidden: true },
      schema: { is_nullable: true },
    });
  }

  // 3. directus_files_id FK (junction → file)
  try {
    await api("GET", `/fields/${junctionName}/directus_files_id`);
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
    await api("POST", `/fields/${junctionName}`, {
      field: "directus_files_id",
      type: "uuid",
      meta: { interface: "select-dropdown-m2o", hidden: true },
      schema: { is_nullable: true },
    });
  }

  // 4. Sort field on junction
  try {
    await api("GET", `/fields/${junctionName}/sort`);
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
    await api("POST", `/fields/${junctionName}`, {
      field: "sort",
      type: "integer",
      meta: { interface: "input", hidden: true },
      schema: { is_nullable: true },
    });
  }

  // 5. Alias field on parent (the M2M from the parent's POV)
  try {
    await api("GET", `/fields/${collection}/${field}`);
    console.log(`  · ${collection}.${field} exists`);
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
    await api("POST", `/fields/${collection}`, {
      field,
      type: "alias",
      meta: {
        interface: "list-m2m",
        special: ["m2m"],
        options: {
          enableCreate: false,
          enableSelect: true,
          template: "{{ directus_files_id.title }}",
        },
        display: "related-values",
        display_options: {
          template: "{{ directus_files_id.title }}",
        },
        note: "Add multiple gallery images (drag to reorder).",
      },
    });
    console.log(`  ✓ ${collection}.${field} (M2M alias)`);
  }

  // 6. Two relations
  try {
    await api("POST", `/relations`, {
      collection: junctionName,
      field: `${collection}_id`,
      related_collection: collection,
      meta: {
        one_field: field,
        sort_field: "sort",
        junction_field: "directus_files_id",
      },
    });
  } catch (e) {
    if (e.status !== 400) throw e;
  }
  try {
    await api("POST", `/relations`, {
      collection: junctionName,
      field: "directus_files_id",
      related_collection: "directus_files",
      meta: {
        junction_field: `${collection}_id`,
      },
    });
  } catch (e) {
    if (e.status !== 400) throw e;
  }
  console.log(`  ✓ ${collection}.${field} relations wired`);
}

async function hideField(collection, field) {
  try {
    await api("PATCH", `/fields/${collection}/${field}`, {
      meta: {
        hidden: true,
        note: "Legacy text field — use the file picker above instead.",
      },
    });
    console.log(`  ↓ hid ${collection}.${field} from admin`);
  } catch (e) {
    console.warn(`  ! could not hide ${collection}.${field}: ${e.message}`);
  }
}

function extractUuidFromUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (!url.startsWith(`${DIRECTUS_URL}/assets/`)) return null;
  return url.split("/assets/")[1].split("?")[0];
}

async function migrateImagesToFilePicker(collection, fileField, galleryField) {
  console.log(`Migrating ${collection} legacy URLs → ${fileField}/${galleryField || "(no gallery)"}…`);
  const list = await api("GET", `/items/${collection}?limit=-1`);
  for (const item of list.data || []) {
    const patch = {};
    const uuid = extractUuidFromUrl(item.image);
    if (uuid && !item[fileField]) {
      patch[fileField] = uuid;
    }
    if (galleryField && Array.isArray(item.images) && item.images.length) {
      const galleryUuids = item.images
        .map(extractUuidFromUrl)
        .filter(Boolean);
      if (galleryUuids.length) {
        patch[galleryField] = galleryUuids.map((id) => ({
          directus_files_id: id,
        }));
      }
    }
    if (Object.keys(patch).length === 0) continue;
    try {
      await api("PATCH", `/items/${collection}/${item.id}`, patch);
      console.log(
        `  ↻ ${collection}/${item.slug || item.id}: ${Object.keys(patch).join(", ")}`,
      );
    } catch (e) {
      console.warn(`  ! ${item.slug || item.id}: ${e.message}`);
    }
  }
}

async function main() {
  console.log(`File-picker setup at ${DIRECTUS_URL}`);
  await ensureFileField("portfolio", "image_file");
  await ensureJunctionM2M("portfolio", "gallery", "portfolio_files");
  await ensureFileField("services", "image_file");

  await migrateImagesToFilePicker("portfolio", "image_file", "gallery");
  await migrateImagesToFilePicker("services", "image_file", null);

  await hideField("portfolio", "image");
  await hideField("portfolio", "images");
  await hideField("services", "image");

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

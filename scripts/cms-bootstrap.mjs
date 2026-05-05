// Bootstrap Directus collections + fields for the Astro CV site.
// Idempotent: skips collections/fields that already exist.

import dotenv from "dotenv";
dotenv.config({ override: true });

const DIRECTUS_URL = process.env.DIRECTUS_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error("Missing DIRECTUS_URL or DIRECTUS_TOKEN in env.");
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`${DIRECTUS_URL}${path}`, {
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
      `${method} ${path} -> ${res.status}: ${JSON.stringify(json.errors || json)}`,
    );
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function ensureCollection(name, meta = {}, schemaPatch = {}) {
  try {
    await api("GET", `/collections/${name}`);
    console.log(`  · collection ${name} exists`);
    return;
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
  }
  await api("POST", "/collections", {
    collection: name,
    meta: {
      icon: "article",
      sort: null,
      hidden: false,
      singleton: false,
      ...meta,
    },
    schema: { name, ...schemaPatch },
    fields: [
      {
        field: "id",
        type: "integer",
        meta: { hidden: true, interface: "input", readonly: true },
        schema: { is_primary_key: true, has_auto_increment: true },
      },
    ],
  });
  console.log(`  ✓ created collection ${name}`);
}

async function ensureSingleton(name, meta = {}) {
  try {
    await api("GET", `/collections/${name}`);
    console.log(`  · singleton ${name} exists`);
    return;
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
  }
  await api("POST", "/collections", {
    collection: name,
    meta: {
      icon: "settings",
      singleton: true,
      hidden: false,
      ...meta,
    },
    schema: { name },
    fields: [
      {
        field: "id",
        type: "integer",
        meta: { hidden: true, interface: "input", readonly: true },
        schema: { is_primary_key: true, has_auto_increment: true },
      },
    ],
  });
  console.log(`  ✓ created singleton ${name}`);
}

async function ensureField(collection, field, def) {
  try {
    await api("GET", `/fields/${collection}/${field}`);
    console.log(`    · ${collection}.${field} exists`);
    return;
  } catch (e) {
    if (e.status !== 403 && e.status !== 404) throw e;
  }
  await api("POST", `/fields/${collection}`, { field, ...def });
  console.log(`    ✓ ${collection}.${field}`);
}

const STATUS_FIELD = {
  type: "string",
  meta: {
    interface: "select-dropdown",
    options: {
      choices: [
        { text: "Published", value: "published" },
        { text: "Draft", value: "draft" },
        { text: "Archived", value: "archived" },
      ],
    },
    width: "half",
    display: "labels",
    display_options: {
      choices: [
        { text: "Published", value: "published", foreground: "#FFFFFF", background: "#2ECDA7" },
        { text: "Draft", value: "draft", foreground: "#18222F", background: "#D3DAE4" },
        { text: "Archived", value: "archived", foreground: "#FFFFFF", background: "#A2B5CD" },
      ],
    },
  },
  schema: { default_value: "published", is_nullable: false },
};

const SORT_FIELD = {
  type: "integer",
  meta: { interface: "input", hidden: false, width: "half" },
  schema: { is_nullable: true },
};

async function bootstrap() {
  console.log(`Bootstrapping Directus at ${DIRECTUS_URL}`);

  // 1. site_settings (singleton)
  await ensureSingleton("site_settings", { icon: "tune", note: "Global site identity, contact info, and social links displayed across the CV site." });
  await ensureField("site_settings", "site_title", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("site_settings", "tagline", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("site_settings", "description", { type: "text", meta: { interface: "input-multiline" }, schema: {} });
  await ensureField("site_settings", "footer_description", { type: "text", meta: { interface: "input-multiline" }, schema: {} });
  await ensureField("site_settings", "owner_name", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("site_settings", "owner_email", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("site_settings", "owner_phone", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("site_settings", "owner_location", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("site_settings", "linkedin_url", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("site_settings", "github_url", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("site_settings", "cv_pdf_url", { type: "string", meta: { interface: "input", note: "Public path to the CV PDF, e.g. /JorgeNunes_AI_Engineer.pdf" }, schema: {} });
  await ensureField("site_settings", "copyright_text", { type: "text", meta: { interface: "input-multiline" }, schema: {} });

  // 2. homepage (singleton) — meta + banner + section titles
  await ensureSingleton("homepage", { icon: "home", note: "Hero/banner copy and homepage section titles." });
  await ensureField("homepage", "meta_title", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("homepage", "meta_description", { type: "text", meta: { interface: "input-multiline" }, schema: {} });
  await ensureField("homepage", "banner_title", { type: "text", meta: { interface: "input-multiline", note: "HTML allowed (e.g. <br />)." }, schema: {} });
  await ensureField("homepage", "banner_description", { type: "text", meta: { interface: "input-multiline" }, schema: {} });
  await ensureField("homepage", "banner_button_label", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("homepage", "banner_button_url", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("homepage", "services_section_title", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("homepage", "portfolio_section_title", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("homepage", "cta_title", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("homepage", "cta_description", { type: "text", meta: { interface: "input-multiline" }, schema: {} });
  await ensureField("homepage", "contact_title", { type: "string", meta: { interface: "input" }, schema: {} });
  await ensureField("homepage", "contact_description", { type: "text", meta: { interface: "input-multiline" }, schema: {} });

  // 3. services (collection)
  await ensureCollection("services", { icon: "design_services", note: "Skill areas / services rendered on the homepage." });
  await ensureField("services", "status", STATUS_FIELD);
  await ensureField("services", "sort", SORT_FIELD);
  await ensureField("services", "title", { type: "string", meta: { interface: "input", required: true }, schema: { is_nullable: false } });
  await ensureField("services", "slug", { type: "string", meta: { interface: "input", required: true, note: "URL slug (used in /services/<slug>/)." }, schema: { is_nullable: false, is_unique: true } });
  await ensureField("services", "description", { type: "text", meta: { interface: "input-multiline" }, schema: {} });
  await ensureField("services", "icon", { type: "string", meta: { interface: "input", note: "Path to icon SVG (e.g. /images/icons/svg/services/brand.svg)." }, schema: {} });
  await ensureField("services", "image", { type: "string", meta: { interface: "input", note: "Hero image path." }, schema: {} });
  await ensureField("services", "date", { type: "date", meta: { interface: "datetime", note: "Used for sorting." }, schema: {} });
  await ensureField("services", "body", { type: "text", meta: { interface: "input-rich-text-md" }, schema: {} });

  // 4. portfolio (collection)
  await ensureCollection("portfolio", { icon: "work", note: "Work experience and projects rendered as portfolio entries." });
  await ensureField("portfolio", "status", STATUS_FIELD);
  await ensureField("portfolio", "sort", SORT_FIELD);
  await ensureField("portfolio", "title", { type: "string", meta: { interface: "input", required: true }, schema: { is_nullable: false } });
  await ensureField("portfolio", "slug", { type: "string", meta: { interface: "input", required: true, note: "URL slug (used in /portfolio/<slug>/)." }, schema: { is_nullable: false, is_unique: true } });
  await ensureField("portfolio", "description", { type: "text", meta: { interface: "input-multiline" }, schema: {} });
  await ensureField("portfolio", "date", { type: "date", meta: { interface: "datetime", note: "Newer first." }, schema: {} });
  await ensureField("portfolio", "image", { type: "string", meta: { interface: "input", note: "Cover image path." }, schema: {} });
  await ensureField("portfolio", "images", { type: "json", meta: { interface: "tags", options: { placeholder: "Add image path" } }, schema: {} });
  await ensureField("portfolio", "categories", { type: "json", meta: { interface: "tags", options: { placeholder: "Add category" } }, schema: {} });
  await ensureField("portfolio", "information", { type: "json", meta: { interface: "list", options: { fields: [ { field: "label", name: "Label", type: "string", meta: { interface: "input", width: "half" } }, { field: "value", name: "Value", type: "string", meta: { interface: "input", width: "half" } } ] } }, schema: {} });
  await ensureField("portfolio", "body", { type: "text", meta: { interface: "input-rich-text-md" }, schema: {} });

  // 5. pages (collection) — about / studies / certificates / extra
  await ensureCollection("pages", { icon: "article", note: "Long-form pages (About, Studies, Certificates)." });
  await ensureField("pages", "status", STATUS_FIELD);
  await ensureField("pages", "title", { type: "string", meta: { interface: "input", required: true }, schema: { is_nullable: false } });
  await ensureField("pages", "slug", { type: "string", meta: { interface: "input", required: true, note: "URL slug (used as /<slug>/)." }, schema: { is_nullable: false, is_unique: true } });
  await ensureField("pages", "meta_description", { type: "text", meta: { interface: "input-multiline" }, schema: {} });
  await ensureField("pages", "body", { type: "text", meta: { interface: "input-rich-text-md" }, schema: {} });

  // 6. social_links (collection)
  await ensureCollection("social_links", { icon: "share", note: "Social profiles displayed in the header offcanvas and footer." });
  await ensureField("social_links", "status", STATUS_FIELD);
  await ensureField("social_links", "sort", SORT_FIELD);
  await ensureField("social_links", "label", { type: "string", meta: { interface: "input", required: true }, schema: { is_nullable: false } });
  await ensureField("social_links", "url", { type: "string", meta: { interface: "input", required: true }, schema: { is_nullable: false } });
  await ensureField("social_links", "icon", { type: "string", meta: { interface: "input", note: "Path to SVG icon (e.g. /images/icons/svg/github.svg)." }, schema: {} });

  // 7. menu_items (collection) — header navigation
  await ensureCollection("menu_items", { icon: "menu", note: "Header navigation items." });
  await ensureField("menu_items", "status", STATUS_FIELD);
  await ensureField("menu_items", "sort", SORT_FIELD);
  await ensureField("menu_items", "name", { type: "string", meta: { interface: "input", required: true }, schema: { is_nullable: false } });
  await ensureField("menu_items", "url", { type: "string", meta: { interface: "input", required: true }, schema: { is_nullable: false } });

  console.log("Done.");
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});

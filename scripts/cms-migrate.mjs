// Migrate local markdown content to Directus.
// Idempotent: upserts by slug for collections; replaces singletons.

import dotenv from "dotenv";
dotenv.config({ override: true });

import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import toml from "toml";

const DIRECTUS_URL = process.env.DIRECTUS_URL;
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;
const ROOT = path.resolve(new URL(".", import.meta.url).pathname, "..");

if (!DIRECTUS_URL || !DIRECTUS_TOKEN) {
  console.error("Missing DIRECTUS_URL or DIRECTUS_TOKEN.");
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
    throw new Error(
      `${method} ${path} -> ${res.status}: ${JSON.stringify(json.errors || json).slice(0, 600)}`,
    );
  }
  return json;
}

async function upsertSingleton(name, data) {
  await api("PATCH", `/items/${name}`, data);
  console.log(`✓ singleton ${name}`);
}

async function upsertBySlug(collection, slug, data) {
  const existing = await api(
    "GET",
    `/items/${collection}?filter[slug][_eq]=${encodeURIComponent(slug)}&limit=1`,
  );
  const item = existing.data?.[0];
  if (item) {
    await api("PATCH", `/items/${collection}/${item.id}`, data);
    console.log(`  ↻ ${collection}/${slug} (id=${item.id})`);
  } else {
    const created = await api("POST", `/items/${collection}`, data);
    console.log(`  + ${collection}/${slug} (id=${created.data.id})`);
  }
}

async function readMarkdown(file) {
  const raw = await fs.readFile(file, "utf8");
  return matter(raw);
}

async function migrateSiteSettings() {
  console.log("→ site_settings");
  const tomlPath = path.join(ROOT, "src/config/config.toml");
  const cfg = toml.parse(await fs.readFile(tomlPath, "utf8"));
  await upsertSingleton("site_settings", {
    site_title: cfg.site.title,
    tagline: cfg.site.tagline,
    description: cfg.site.description,
    footer_description: cfg.settings.footerDescription,
    owner_name: "Jorge Domingues Nunes",
    owner_email: "stamina.nunes@gmail.com",
    owner_phone: "+351 914 764 120",
    owner_location: "Pombal, Portugal",
    linkedin_url: "https://www.linkedin.com/in/stamina/",
    github_url: "https://www.github.com/staminna",
    cv_pdf_url: "/JorgeNunes_AI_Engineer.pdf",
    copyright_text: cfg.settings.copyright?.text || "",
  });
}

async function migrateHomepage() {
  console.log("→ homepage");
  const home = await readMarkdown(
    path.join(ROOT, "src/content/homepage/english/-index.md"),
  );
  const banner = await readMarkdown(
    path.join(ROOT, "src/content/sections/english/banner.md"),
  );
  const services = await readMarkdown(
    path.join(ROOT, "src/content/sections/english/services-section.md"),
  );
  const portfolio = await readMarkdown(
    path.join(ROOT, "src/content/sections/english/portfolio-section.md"),
  );
  const cta = await readMarkdown(
    path.join(ROOT, "src/content/sections/english/call-to-action.md"),
  );
  const contact = await readMarkdown(
    path.join(ROOT, "src/content/sections/english/contact-section.md"),
  );

  await upsertSingleton("homepage", {
    meta_title: home.data.title,
    meta_description: home.data.metaDescription,
    banner_title: banner.data.title,
    banner_description: banner.data.description,
    banner_button_label: banner.data.button?.label || "",
    banner_button_url: banner.data.button?.url || "",
    services_section_title: services.data.title || "What I Build",
    portfolio_section_title: portfolio.data.title || "Selected Work & Projects",
    cta_title: cta.data.title,
    cta_description: typeof cta.data.description === "string"
      ? cta.data.description
      : (cta.data.description || ""),
    contact_title: contact.data.title,
    contact_description: contact.data.description,
  });
}

async function migrateServices() {
  console.log("→ services");
  const dir = path.join(ROOT, "src/content/services/english");
  const files = (await fs.readdir(dir))
    .filter((f) => f.startsWith("service-") && /\.(md|mdx)$/.test(f))
    .sort();
  let sort = 1;
  for (const file of files) {
    const m = await readMarkdown(path.join(dir, file));
    const slug =
      m.data.customSlug || file.replace(/\.(md|mdx)$/, "");
    await upsertBySlug("services", slug, {
      status: "published",
      sort: sort++,
      title: m.data.title,
      slug,
      description: m.data.description,
      icon: m.data.icon,
      image: m.data.image,
      date: m.data.date
        ? new Date(m.data.date).toISOString().slice(0, 10)
        : null,
      body: m.content.trim(),
    });
  }
}

async function migratePortfolio() {
  console.log("→ portfolio");
  const dir = path.join(ROOT, "src/content/portfolio/english");
  const files = (await fs.readdir(dir))
    .filter((f) => f.startsWith("portfolio-") && /\.(md|mdx)$/.test(f))
    .sort();
  let sort = 1;
  for (const file of files) {
    const m = await readMarkdown(path.join(dir, file));
    const slug =
      m.data.customSlug || file.replace(/\.(md|mdx)$/, "");
    await upsertBySlug("portfolio", slug, {
      status: "published",
      sort: sort++,
      title: m.data.title,
      slug,
      description: m.data.description,
      date: m.data.date
        ? new Date(m.data.date).toISOString().slice(0, 10)
        : null,
      image: m.data.image,
      images: m.data.images || [],
      categories: m.data.categories || [],
      information: m.data.information || [],
      body: m.content.trim(),
    });
  }
}

async function migratePages() {
  console.log("→ pages");
  const dir = path.join(ROOT, "src/content/pages/english");
  const files = (await fs.readdir(dir)).filter((f) =>
    /\.(md|mdx)$/.test(f),
  );
  for (const file of files) {
    const m = await readMarkdown(path.join(dir, file));
    const slug = file.replace(/\.(md|mdx)$/, "");
    await upsertBySlug("pages", slug, {
      status: "published",
      title: m.data.title,
      slug,
      meta_description: m.data.metaDescription,
      body: m.content.trim(),
    });
  }
}

async function migrateSocialLinks() {
  console.log("→ social_links");
  const social = JSON.parse(
    await fs.readFile(path.join(ROOT, "src/config/social.json"), "utf8"),
  );
  let sort = 1;
  for (const link of social.main) {
    if (!link.enable) continue;
    // upsert by label (treat label as slug-ish)
    const existing = await api(
      "GET",
      `/items/social_links?filter[label][_eq]=${encodeURIComponent(link.label)}&limit=1`,
    );
    const payload = {
      status: "published",
      sort: sort++,
      label: link.label,
      url: link.url,
      icon: link.icon,
    };
    const item = existing.data?.[0];
    if (item) {
      await api("PATCH", `/items/social_links/${item.id}`, payload);
      console.log(`  ↻ social_links/${link.label}`);
    } else {
      await api("POST", `/items/social_links`, payload);
      console.log(`  + social_links/${link.label}`);
    }
  }
}

async function migrateMenu() {
  console.log("→ menu_items");
  const menu = JSON.parse(
    await fs.readFile(path.join(ROOT, "src/config/menu.en.json"), "utf8"),
  );
  let sort = 1;
  for (const item of menu.headerPrimary) {
    if (!item.enable) continue;
    const existing = await api(
      "GET",
      `/items/menu_items?filter[name][_eq]=${encodeURIComponent(item.name)}&limit=1`,
    );
    const payload = {
      status: "published",
      sort: sort++,
      name: item.name,
      url: item.url,
    };
    const found = existing.data?.[0];
    if (found) {
      await api("PATCH", `/items/menu_items/${found.id}`, payload);
      console.log(`  ↻ menu_items/${item.name}`);
    } else {
      await api("POST", `/items/menu_items`, payload);
      console.log(`  + menu_items/${item.name}`);
    }
  }
}

const STEPS = {
  site_settings: migrateSiteSettings,
  homepage: migrateHomepage,
  services: migrateServices,
  portfolio: migratePortfolio,
  pages: migratePages,
  social_links: migrateSocialLinks,
  menu: migrateMenu,
};

async function main() {
  const onlyArg = process.argv.find((a) => a.startsWith("--only="));
  const selected = onlyArg
    ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()).filter(Boolean)
    : Object.keys(STEPS);
  const unknown = selected.filter((s) => !(s in STEPS));
  if (unknown.length) {
    console.error(`Unknown step(s): ${unknown.join(", ")}. Valid: ${Object.keys(STEPS).join(", ")}`);
    process.exit(1);
  }
  for (const step of selected) await STEPS[step]();
  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

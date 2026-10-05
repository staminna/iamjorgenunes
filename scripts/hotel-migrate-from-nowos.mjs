// Copy the "Hotel & Bookings" schema + data from nowos to the dedicated hotel instance.
//   node scripts/hotel-migrate-from-nowos.mjs            dry run (shows the schema diff)
//   node scripts/hotel-migrate-from-nowos.mjs --apply    apply schema, copy rows (ids preserved)
// Source credentials: .env (DIRECTUS_URL / DIRECTUS_TOKEN). Target: .env.hotel (same names).
// Personal_website and every non-hotel collection are left out. nowos is only read.
import fs from 'node:fs';

const loadEnv = file => Object.fromEntries(fs.readFileSync(file, 'utf8').split('\n')
  .filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
const SRC = loadEnv('.env'), DST = loadEnv('.env.hotel');
const APPLY = process.argv[2] === '--apply';
const api = ({ DIRECTUS_URL: U, DIRECTUS_TOKEN: T }) => async (method, path, body) => {
  const r = await fetch(U + path, { method, headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${U}${path} -> ${r.status} ${t}`);
  return t ? JSON.parse(t).data : null;
};
const src = api(SRC), dst = api(DST);

// 1. Hotel part of the nowos schema: the "hotel" folder tree and everything inside it.
const s = await src('GET', '/schema/snapshot');
const inHotel = new Set(['hotel']);
for (let grew = true; grew;) { grew = false; for (const c of s.collections) if (!inHotel.has(c.collection) && inHotel.has(c.meta?.group)) { inHotel.add(c.collection); grew = true; } }
const tables = s.collections.filter(c => inHotel.has(c.collection) && c.schema).map(c => c.collection);
const part = {
  collections: s.collections.filter(c => inHotel.has(c.collection)),
  fields: s.fields.filter(f => inHotel.has(f.collection)),
  relations: s.relations.filter(r => inHotel.has(r.collection)),
};
const outside = part.relations.filter(r => r.related_collection && !inHotel.has(r.related_collection) && !r.related_collection.startsWith('directus_'));
if (outside.length) throw new Error(`hotel relations point outside the hotel folder: ${outside.map(r => `${r.collection}.${r.field}`)}`);
console.log(`hotel tree: ${part.collections.length} collections (${tables.length} tables), ${part.fields.length} fields, ${part.relations.length} relations`);

// 2. Diff against the (empty) target and apply.
const t = await dst('GET', '/schema/snapshot');
if (t.directus !== s.directus) throw new Error(`version mismatch: nowos ${s.directus}, hotel ${t.directus}`);
const diff = await dst('POST', '/schema/diff', { ...t, collections: [...t.collections, ...part.collections], fields: [...t.fields, ...part.fields], relations: [...t.relations, ...part.relations] });
if (!diff) { console.log('schema already in place'); }
else {
  console.log(`diff: +${diff.diff.collections.length} collections, +${diff.diff.fields.length} fields, +${diff.diff.relations.length} relations`);
  if (APPLY) { await dst('POST', '/schema/apply', diff); console.log('schema applied'); }
}
if (!APPLY) { console.log('(dry run)'); process.exit(0); }

// 3. Copy rows, parents before children, real columns only (no alias lists, no audit fields — the target sets those).
const ORDER = ['brands', 'properties', 'room_types', 'rooms', 'staff', 'guests', 'services', 'cancellation_policies', 'rate_plans', 'rates',
  'bookings', 'booking_guests', 'service_orders', 'invoices', 'room_maintenance'];
const AUDIT = new Set(['user_created', 'user_updated', 'date_created', 'date_updated']);
const ordered = [...ORDER.filter(c => tables.includes(c)), ...tables.filter(c => !ORDER.includes(c))];
for (const c of ordered) {
  const cols = part.fields.filter(f => f.collection === c && f.schema && !AUDIT.has(f.field)).map(f => f.field);
  const rows = await src('GET', `/items/${c}?limit=-1&fields=${cols.join(',')}&sort=${cols.includes('sort') ? 'sort,' : ''}id`);
  const have = Number((await dst('GET', `/items/${c}?aggregate[count]=*`))[0].count);
  if (rows.length && !have) await dst('POST', `/items/${c}`, rows);
  const now = Number((await dst('GET', `/items/${c}?aggregate[count]=*`))[0].count);
  console.log(`${c.padEnd(22)} nowos ${String(rows.length).padStart(3)} -> hotel ${String(now).padStart(3)}${now === rows.length ? '' : '   MISMATCH'}`);
}

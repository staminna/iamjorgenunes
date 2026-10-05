// Remove the "Hotel & Bookings" tree from nowos after it was migrated to hotel.varrho.com.
//   node scripts/hotel-remove-from-nowos.mjs           dry run
//   node scripts/hotel-remove-from-nowos.mjs --apply
// Refuses to run unless every hotel table on the hotel instance has at least as many rows.
import fs from 'node:fs';
const loadEnv = f => Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const api = ({ DIRECTUS_URL: U, DIRECTUS_TOKEN: T }) => async (m, p) => { const r = await fetch(U + p, { method: m, headers: { Authorization: `Bearer ${T}` } }); const t = await r.text(); if (!r.ok) throw new Error(`${m} ${p} -> ${r.status} ${t}`); return t ? JSON.parse(t).data : null; };
const nowos = api(loadEnv('.env')), hotel = api(loadEnv('.env.hotel'));
const APPLY = process.argv[2] === '--apply';

const cols = await nowos('GET', '/collections');
const tree = new Set(['hotel']);
for (let grew = true; grew;) { grew = false; for (const c of cols) if (!tree.has(c.collection) && tree.has(c.meta?.group)) { tree.add(c.collection); grew = true; } }
if ([...tree].some(c => c === 'Personal_website' || cols.find(x => x.collection === c)?.meta?.group === 'Personal_website')) throw new Error('tree touches Personal_website');
const tables = cols.filter(c => tree.has(c.collection) && c.schema).map(c => c.collection);
const folders = cols.filter(c => tree.has(c.collection) && !c.schema).map(c => c.collection);
const count = async (a, c) => Number((await a('GET', `/items/${c}?aggregate[count]=*`))[0].count);
for (const c of tables) {
  const [n, h] = [await count(nowos, c), await count(hotel, c)];
  console.log(`${c.padEnd(22)} nowos ${String(n).padStart(3)}  hotel ${String(h).padStart(3)}${h >= n ? '' : '  <-- NOT MIGRATED'}`);
  if (h < n) throw new Error(`${c} has fewer rows on hotel — aborting`);
}
const ORDER = ['room_maintenance', 'invoices', 'service_orders', 'booking_guests', 'bookings', 'rates', 'rate_plans', 'cancellation_policies', 'rooms', 'room_types', 'guests', 'services', 'staff', 'properties', 'brands'];
const order = [...ORDER.filter(c => tables.includes(c)), ...tables.filter(c => !ORDER.includes(c)), ...folders.filter(f => f !== 'hotel'), 'hotel'];
console.log(`${APPLY ? 'deleting' : 'would delete'}: ${order.join(', ')}`);
if (APPLY) { for (const c of order) await nowos('DELETE', `/collections/${c}`); console.log('removed'); }

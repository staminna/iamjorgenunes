// Hotel & Bookings schema improvements on nowos (Directus 12). Leaves Personal_website alone.
const { DIRECTUS_URL: U, DIRECTUS_TOKEN: T } = process.env;
const APPLY = process.argv[2] === '--apply';
const call = async (method, path, body) => {
  const r = await fetch(U + path, { method, headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${t}`);
  return t ? JSON.parse(t).data : null;
};
const ops = [];
const op = (desc, fn) => ops.push({ desc, fn });

const collections = new Set((await call('GET', '/collections')).map(c => c.collection));
const fieldsOf = async c => new Set((await call('GET', `/fields/${c}`)).map(f => f.field));
const F = {};
for (const c of ['bookings', 'guests', 'booking_guests', 'rooms', 'room_types', 'invoices', 'service_orders', 'services', 'staff']) F[c] = await fieldsOf(c);

const addField = (c, field, def) => { if (!F[c].has(field)) op(`+ field ${c}.${field}`, () => call('POST', `/fields/${c}`, { field, ...def })); };
const addM2O = (c, field, related, { template, on_delete = 'NO ACTION', note, required = false, width = 'half' } = {}) => {
  if (F[c].has(field)) return;
  op(`+ m2o ${c}.${field} -> ${related} (on_delete ${on_delete})`, async () => {
    await call('POST', `/fields/${c}`, { field, type: 'uuid', schema: {}, meta: { interface: 'select-dropdown-m2o', special: ['m2o'], options: template ? { template } : null, display: 'related-values', display_options: template ? { template } : null, note, required, width } });
    await call('POST', '/relations', { collection: c, field, related_collection: related, schema: { on_delete }, meta: { sort_field: null } });
  });
};
const addO2M = (c, field, template) => addField(c, field, { type: 'alias', schema: null, meta: { interface: 'list-o2m', special: ['o2m'], options: { template }, display: 'related-values', display_options: { template } } });
const tracking = c => {
  addField(c, 'date_created', { type: 'timestamp', schema: {}, meta: { special: ['date-created'], interface: 'datetime', readonly: true, hidden: true, width: 'half', display: 'datetime', display_options: { relative: true } } });
  addField(c, 'date_updated', { type: 'timestamp', schema: {}, meta: { special: ['date-updated'], interface: 'datetime', readonly: true, hidden: true, width: 'half', display: 'datetime', display_options: { relative: true } } });
  for (const [field, special] of [['user_created', 'user-created'], ['user_updated', 'user-updated']]) {
    if (F[c].has(field)) continue;
    op(`+ ${c}.${field} -> directus_users`, async () => {
      await call('POST', `/fields/${c}`, { field, type: 'uuid', schema: {}, meta: { special: [special], interface: 'select-dropdown-m2o', options: { template: '{{avatar}} {{first_name}} {{last_name}}' }, readonly: true, hidden: true, width: 'half', display: 'user' } });
      await call('POST', '/relations', { collection: c, field, related_collection: 'directus_users', schema: { on_delete: 'SET NULL' } });
    });
  }
};
const patchField = (c, field, body, desc) => op(`~ ${c}.${field}: ${desc}`, () => call('PATCH', `/fields/${c}/${field}`, body));

// 1. Folder group "Hotel & Bookings" (Personal_website untouched)
const order = ['bookings', 'guests', 'booking_guests', 'rooms', 'room_types', 'room_maintenance', 'services', 'service_orders', 'invoices', 'staff'];
if (!collections.has('hotel')) op('+ folder hotel ("Hotel & Bookings")', () => call('POST', '/collections', { collection: 'hotel', schema: null, meta: { icon: 'hotel', color: '#2ECDA7', note: 'Hotel & booking system: rooms, guests, bookings, services, invoicing and staff', sort: 10, collapse: 'open', translations: [{ language: 'en-US', translation: 'Hotel & Bookings' }] } }));
order.forEach((c, i) => op(`~ move ${c} into hotel (sort ${i + 1})`, () => call('PATCH', `/collections/${c}`, { meta: { group: 'hotel', sort: i + 1, ...(c === 'booking_guests' ? { hidden: true } : {}) } })));
op('~ bookings display template', () => call('PATCH', '/collections/bookings', { meta: { display_template: '{{booking_number}} · {{primary_guest.first_name}} {{primary_guest.last_name}}', archive_field: 'status', archive_value: 'cancelled', unarchive_value: 'reserved', archive_app_filter: true } }));

// 2. One bookings <-> guests junction: drop the duplicate, wire M2M through booking_guests
if (collections.has('booking_guest_junction')) op('- drop duplicate junction booking_guest_junction (0 rows)', () => call('DELETE', '/collections/booking_guest_junction'));
op('~ wire M2M bookings.guests / guests.bookings through booking_guests', async () => {
  const bf = await fieldsOf('bookings'), gf = await fieldsOf('guests');
  if (!bf.has('guests')) await call('POST', '/fields/bookings', { field: 'guests', type: 'alias', schema: null, meta: { interface: 'list-m2m', special: ['m2m'], options: { template: '{{guest_id.first_name}} {{guest_id.last_name}}' }, display: 'related-values', display_options: { template: '{{guest_id.first_name}} {{guest_id.last_name}}' }, note: 'All guests staying on this booking (the lead guest goes in Primary guest)' } });
  if (!gf.has('bookings')) await call('POST', '/fields/guests', { field: 'bookings', type: 'alias', schema: null, meta: { interface: 'list-m2m', special: ['m2m'], options: { template: '{{booking_id.booking_number}}' }, display: 'related-values', display_options: { template: '{{booking_id.booking_number}}' } } });
  // Meta only: sending schema.on_delete here makes Directus drop the FK without
  // recreating it. The CASCADE FKs live in scripts/hotel-fix-junction-fks.sql.
  await call('PATCH', '/relations/booking_guests/booking_id', { meta: { one_field: 'guests', junction_field: 'guest_id', sort_field: 'sort', one_deselect_action: 'delete' } });
  await call('PATCH', '/relations/booking_guests/guest_id', { meta: { one_field: 'bookings', junction_field: 'booking_id', one_deselect_action: 'delete' } });
});

// 3. Missing O2M list fields (relations already declared these one_fields)
addO2M('bookings', 'invoices', 'Invoice #{{invoice_number}} · {{status}}');
addO2M('bookings', 'service_orders', '{{service_id.name}} × {{quantity}} · {{status}}');
addO2M('rooms', 'bookings', '{{booking_number}} · {{check_in_date}} → {{check_out_date}}');
addO2M('services', 'orders', '{{booking_id.booking_number}} × {{quantity}}');

// 4. Bookings
patchField('bookings', 'booking_number', { schema: { is_nullable: false, is_unique: true }, meta: { required: true, width: 'half' } }, 'required + unique');
patchField('bookings', 'status', { schema: { default_value: 'reserved', is_nullable: false }, meta: { required: true, width: 'half', options: { choices: [
  { text: 'Reserved', value: 'reserved' }, { text: 'Checked In', value: 'checked_in' }, { text: 'Checked Out', value: 'checked_out' }, { text: 'Cancelled', value: 'cancelled' }, { text: 'No-show', value: 'no_show' }] } } }, 'default reserved, + no_show');
patchField('bookings', 'room_id', { meta: { note: 'Assigned room (can be set at check-in). Overlapping active bookings on the same room are rejected by the database.', width: 'half' } }, 'note');
addM2O('bookings', 'primary_guest', 'guests', { template: '{{first_name}} {{last_name}}', note: 'Lead guest / booker', required: true });
addM2O('bookings', 'room_type', 'room_types', { template: '{{name}}', note: 'Requested room type (before a room is assigned)' });
addField('bookings', 'adults', { type: 'integer', schema: { default_value: 1, is_nullable: false }, meta: { interface: 'input', options: { min: 1 }, width: 'quarter', required: true } });
addField('bookings', 'children', { type: 'integer', schema: { default_value: 0, is_nullable: false }, meta: { interface: 'input', options: { min: 0 }, width: 'quarter' } });
addField('bookings', 'channel', { type: 'string', schema: { default_value: 'direct' }, meta: { interface: 'select-dropdown', width: 'half', note: 'Where the booking came from', options: { choices: [
  { text: 'Direct', value: 'direct' }, { text: 'Booking.com', value: 'booking_com' }, { text: 'Expedia', value: 'expedia' }, { text: 'Airbnb', value: 'airbnb' }, { text: 'Phone', value: 'phone' }, { text: 'Walk-in', value: 'walk_in' }] }, display: 'labels' } });
addField('bookings', 'nightly_rate', { type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 }, meta: { interface: 'input', options: { min: 0 }, width: 'half' } });
addField('bookings', 'total_amount', { type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 }, meta: { interface: 'input', options: { min: 0 }, width: 'half' } });
tracking('bookings');

// 5. Guests, rooms, room types
addField('guests', 'country', { type: 'string', schema: {}, meta: { interface: 'input', width: 'half' } });
addField('guests', 'notes', { type: 'text', schema: {}, meta: { interface: 'input-multiline' } });
tracking('guests');
patchField('rooms', 'room_number', { schema: { is_nullable: false, is_unique: true }, meta: { required: true, width: 'half' } }, 'required + unique');
patchField('rooms', 'status', { schema: { default_value: 'available' } }, 'default available');
addField('rooms', 'floor', { type: 'integer', schema: {}, meta: { interface: 'input', width: 'half' } });
patchField('room_types', 'name', { schema: { is_nullable: false, is_unique: true }, meta: { required: true } }, 'required + unique');
addField('room_types', 'max_occupancy', { type: 'integer', schema: { default_value: 2 }, meta: { interface: 'input', options: { min: 1 }, width: 'half' } });

// 6. Billing & services
patchField('invoices', 'invoice_number', { schema: { is_nullable: false, is_unique: true }, meta: { required: true, width: 'half' } }, 'required + unique');
patchField('invoices', 'booking_id', { meta: { required: true } }, 'required');
tracking('invoices');
patchField('service_orders', 'booking_id', { meta: { required: true, width: 'half' } }, 'required');
patchField('service_orders', 'service_id', { meta: { required: true, width: 'half' } }, 'required');
addField('service_orders', 'unit_price', { type: 'decimal', schema: { numeric_precision: 10, numeric_scale: 2 }, meta: { interface: 'input', options: { min: 0 }, width: 'half', note: 'Price at the time of the order (services.price can change later)' } });
tracking('service_orders');
patchField('services', 'name', { schema: { is_nullable: false }, meta: { required: true } }, 'required');

// 7. Staff can log in
addM2O('staff', 'user', 'directus_users', { template: '{{email}}', on_delete: 'SET NULL', note: 'Directus login for this staff member' });

console.log(`${ops.length} operations${APPLY ? '' : ' (dry run)'}:`);
for (const o of ops) { console.log(' ', o.desc); if (APPLY) await o.fn(); }
if (APPLY) console.log('applied');

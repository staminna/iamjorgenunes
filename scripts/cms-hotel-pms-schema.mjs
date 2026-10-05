// PMS / booking engine / channel manager / white-label schema for the Hotel & Bookings
// collections on nowos (Directus 12). Idempotent: skips what already exists.
//   node --env-file=.env scripts/cms-hotel-pms-schema.mjs           dry run
//   node --env-file=.env scripts/cms-hotel-pms-schema.mjs --apply
// Relations are created with POST only (PATCHing schema.on_delete drops FKs in Directus 12).
// Composite uniques, CHECKs and NOT NULLs live in scripts/hotel-pms-constraints.sql.
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
const fieldCache = {};
const hasField = async (c, f) => {
  if (!collections.has(c)) return false;
  fieldCache[c] ??= new Set((await call('GET', `/fields/${c}`)).map(x => x.field));
  return fieldCache[c].has(f);
};

// ---- field builders -------------------------------------------------------
const choices = list => list.map(v => (Array.isArray(v) ? { value: v[0], text: v[1] } : { value: v, text: v.replace(/_/g, ' ').replace(/^./, s => s.toUpperCase()) }));
const meta = (o, extra = {}) => ({ width: o.width || 'half', required: !!o.required, note: o.note ?? null, hidden: !!o.hidden, readonly: !!o.readonly, ...extra });
const F = {
  pk: () => ({ field: 'id', type: 'uuid', meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] }, schema: { is_primary_key: true, length: 36, has_auto_increment: false } }),
  string: (field, o = {}) => ({ field, type: 'string', meta: meta(o, { interface: o.interface || 'input', options: o.options ?? null }), schema: { is_unique: !!o.unique, default_value: o.default ?? null } }),
  text: (field, o = {}) => ({ field, type: 'text', meta: meta({ width: 'full', ...o }, { interface: o.interface || 'input-multiline', options: o.options ?? null }), schema: {} }),
  int: (field, o = {}) => ({ field, type: 'integer', meta: meta(o, { interface: 'input', options: o.min != null ? { min: o.min } : null }), schema: { default_value: o.default ?? null } }),
  dec: (field, o = {}) => ({ field, type: 'decimal', meta: meta(o, { interface: 'input', options: o.min != null ? { min: o.min } : null }), schema: { numeric_precision: o.precision || 10, numeric_scale: o.scale ?? 2, default_value: o.default ?? null } }),
  bool: (field, o = {}) => ({ field, type: 'boolean', meta: meta(o, { interface: 'boolean', special: ['cast-boolean'], options: { label: o.label || null } }), schema: { default_value: o.default ?? false } }),
  date: (field, o = {}) => ({ field, type: 'date', meta: meta(o, { interface: 'datetime' }), schema: {} }),
  ts: (field, o = {}) => ({ field, type: 'timestamp', meta: meta(o, { interface: 'datetime' }), schema: {} }),
  time: (field, o = {}) => ({ field, type: 'time', meta: meta(o, { interface: 'datetime' }), schema: { default_value: o.default ?? null } }),
  select: (field, list, o = {}) => ({ field, type: 'string', meta: meta(o, { interface: 'select-dropdown', options: { choices: choices(list) }, display: 'labels' }), schema: { default_value: o.default ?? null } }),
  color: (field, o = {}) => ({ field, type: 'string', meta: meta(o, { interface: 'select-color', display: 'color' }), schema: { default_value: o.default ?? null } }),
  json: (field, o = {}) => ({ field, type: 'json', meta: meta({ width: 'full', ...o }, { interface: 'input-code', special: ['cast-json'], options: { language: 'json' } }), schema: {} }),
  created: () => ({ field: 'date_created', type: 'timestamp', meta: { special: ['date-created'], interface: 'datetime', readonly: true, hidden: true, width: 'half', display: 'datetime', display_options: { relative: true } }, schema: {} }),
};

// ---- operations -----------------------------------------------------------
const folder = (collection, label, icon, sort, note) => {
  if (collections.has(collection)) return;
  op(`+ folder ${collection} ("${label}")`, () => call('POST', '/collections', { collection, schema: null, meta: { icon, note, sort, group: 'hotel', collapse: 'open', translations: [{ language: 'en-US', translation: label }] } }));
};
const collection = (name, m, fields) => {
  if (collections.has(name)) {
    for (const fd of fields) op(`+ field ${name}.${fd.field} (if missing)`, async () => { if (!(await hasField(name, fd.field))) await call('POST', `/fields/${name}`, fd); });
    return;
  }
  op(`+ collection ${name} (${fields.length + 1} fields)`, () => call('POST', '/collections', { collection: name, schema: {}, meta: { accountability: 'all', ...m }, fields: [F.pk(), ...fields] }));
};
const addField = (c, fd) => op(`+ field ${c}.${fd.field}`, async () => { if (!(await hasField(c, fd.field))) await call('POST', `/fields/${c}`, fd); });
const m2o = (c, field, related, o = {}) => op(`+ m2o ${c}.${field} -> ${related}${o.one_field ? ` (list ${related}.${o.one_field})` : ''} on_delete ${o.on_delete || 'NO ACTION'}`, async () => {
  if (!(await hasField(c, field))) {
    const file = related === 'directus_files';
    await call('POST', `/fields/${c}`, { field, type: o.type || 'uuid', schema: {}, meta: { ...meta(o), interface: file ? 'file-image' : 'select-dropdown-m2o', special: [file ? 'file' : 'm2o'], options: o.template ? { template: o.template } : null, display: file ? 'image' : 'related-values', display_options: o.template ? { template: o.template } : null } });
    await call('POST', '/relations', { collection: c, field, related_collection: related, schema: { on_delete: o.on_delete || 'NO ACTION' }, meta: { one_field: o.one_field || null, sort_field: null, one_deselect_action: 'nullify' } });
  }
  if (o.one_field && !(await hasField(related, o.one_field)))
    await call('POST', `/fields/${related}`, { field: o.one_field, type: 'alias', schema: null, meta: { interface: 'list-o2m', special: ['o2m'], options: { template: o.list_template || null }, display: 'related-values', display_options: { template: o.list_template || null } } });
});
const move = (c, group, sort, extra = {}) => op(`~ ${c} -> ${group} (${sort})`, () => call('PATCH', `/collections/${c}`, { meta: { group, sort, ...extra } }));

// 1. Sub-folders inside "Hotel & Bookings"
folder('hotel_tenancy', 'Brands & Properties', 'domain', 1, 'White-label brands and the properties (tenants) that belong to them');
folder('hotel_front_office', 'Front Office (PMS)', 'concierge', 2, 'Reservations, guests, rooms, housekeeping and night audit');
folder('hotel_revenue', 'Rates & Availability', 'sell', 3, 'Rate plans, cancellation policies and the ARI calendar');
folder('hotel_distribution', 'Channel Manager', 'hub', 4, 'OTA / GDS connections, room & rate mappings and the sync log');
folder('hotel_billing', 'Folio & Payments', 'point_of_sale', 5, 'Invoices (folio), folio lines, payments, extras');

// 2. New collections (scalar fields; relations below)
collection('brands', { icon: 'palette', note: 'White-label brand: resolved at runtime by the request host (primary_domain)', display_template: '{{name}}', group: 'hotel_tenancy', sort: 1 }, [
  F.string('name', { required: true, unique: true }),
  F.select('status', ['active', 'inactive'], { default: 'active' }),
  F.string('primary_domain', { unique: true, note: 'Host that resolves this brand, e.g. book.seaside.example' }),
  F.color('primary_color', { default: '#1F4FD8' }),
  F.color('secondary_color', { default: '#F6F5F3' }),
  F.string('font_family', { note: 'CSS font stack for the booking engine and e-mails' }),
  F.select('default_language', [['en-US', 'English'], ['pt-PT', 'Portuguese'], ['es-ES', 'Spanish'], ['fr-FR', 'French'], ['de-DE', 'German']], { default: 'en-US' }),
  F.select('default_currency', ['EUR', 'GBP', 'USD'], { default: 'EUR' }),
  F.string('email_from_name'),
  F.string('email_from_address'),
  F.json('email_templates', { note: 'Transactional e-mail templates per brand: booking_confirmation, cancellation, pre_arrival' }),
]);
collection('properties', { icon: 'apartment', note: 'A property is a tenant: every operational record is scoped to one property', display_template: '{{name}}', group: 'hotel_tenancy', sort: 2 }, [
  F.string('name', { required: true }),
  F.string('slug', { required: true, unique: true }),
  F.select('status', ['onboarding', 'active', 'inactive'], { default: 'active' }),
  F.select('property_type', ['hotel', 'aparthotel', 'hostel', ['short_term_rental', 'Short-term rental']], { default: 'hotel' }),
  F.string('city'),
  F.string('country'),
  F.text('address', { width: 'half' }),
  F.string('timezone', { default: 'Europe/Lisbon' }),
  F.select('currency', ['EUR', 'GBP', 'USD'], { default: 'EUR' }),
  F.time('check_in_time', { default: '15:00:00' }),
  F.time('check_out_time', { default: '11:00:00' }),
  F.dec('city_tax_per_person_night', { min: 0, note: 'Tourist tax posted to the folio by the night audit' }),
  F.bool('booking_engine_enabled', { default: true, label: 'Direct booking engine live' }),
]);
collection('cancellation_policies', { icon: 'policy', display_template: '{{name}}', group: 'hotel_revenue', sort: 2 }, [
  F.string('name', { required: true }),
  F.string('code', { required: true }),
  F.int('free_cancellation_hours', { min: 0, note: 'Free cancellation until this many hours before arrival (0 = never free)' }),
  F.select('penalty_type', ['none', 'first_night', 'percentage', 'full_stay'], { default: 'first_night' }),
  F.dec('penalty_percent', { min: 0, scale: 2, precision: 5 }),
  F.select('no_show_penalty', ['none', 'first_night', 'full_stay'], { default: 'first_night' }),
  F.text('description'),
]);
collection('rate_plans', { icon: 'sell', display_template: '{{code}} · {{name}}', group: 'hotel_revenue', sort: 1 }, [
  F.string('code', { required: true, note: 'Short code sent to channels, e.g. BAR, NRF' }),
  F.string('name', { required: true }),
  F.select('status', ['active', 'inactive'], { default: 'active' }),
  F.select('meal_plan', [['room_only', 'Room only'], ['breakfast', 'Bed & breakfast'], ['half_board', 'Half board'], ['full_board', 'Full board']], { default: 'room_only' }),
  F.select('adjustment_type', ['none', 'percent', 'amount'], { default: 'none', note: 'Derived rate: parent price adjusted by this' }),
  F.dec('adjustment_value', { note: 'e.g. -10 (percent) or 28 (amount per night)' }),
  F.int('min_stay', { min: 1, default: 1 }),
  F.bool('bookable_online', { default: true, label: 'Sold on the direct booking engine' }),
  F.text('description'),
]);
collection('rates', { icon: 'calendar_month', note: 'ARI — price and restrictions per room type × rate plan × date', display_template: '{{date}} · {{room_type.name}} · {{rate_plan.code}} · {{price}}', group: 'hotel_revenue', sort: 3 }, [
  F.date('date', { required: true }),
  F.dec('price', { required: true, min: 0 }),
  F.int('min_stay', { min: 1 }),
  F.bool('closed_to_arrival', { label: 'CTA' }),
  F.bool('closed_to_departure', { label: 'CTD' }),
  F.bool('stop_sell', { label: 'Stop sell' }),
]);
collection('availability', { icon: 'event_available', note: 'ARI — sellable inventory per room type × date (pushed to every channel)', display_template: '{{date}} · {{room_type.name}} · {{available}} left', group: 'hotel_revenue', sort: 4 }, [
  F.date('date', { required: true }),
  F.int('total_rooms', { min: 0 }),
  F.int('booked', { min: 0, default: 0 }),
  F.int('out_of_order', { min: 0, default: 0 }),
  F.int('available', { note: 'total_rooms − booked − out_of_order' }),
  F.bool('stop_sell', { label: 'Stop sell' }),
  F.ts('last_pushed_at', { readonly: true }),
]);
collection('channels', { icon: 'hub', note: 'Distribution channels (OTAs, GDS, wholesalers, direct and offline sources)', display_template: '{{name}}', group: 'hotel_distribution', sort: 1 }, [
  F.string('name', { required: true, unique: true }),
  F.string('code', { required: true, unique: true }),
  F.select('type', [['ota', 'OTA'], ['gds', 'GDS'], 'wholesaler', 'direct', 'offline'], { default: 'ota' }),
  F.select('protocol', [['ota_xml', 'OpenTravel (OTA) XML'], ['htng', 'HTNG'], ['rest_json', 'REST / JSON'], ['ical', 'iCal'], 'none'], { default: 'ota_xml' }),
  F.select('sync_mode', [['push_pull', 'Push ARI / pull reservations'], 'webhook', 'polling', 'none'], { default: 'push_pull' }),
  F.dec('default_commission_percent', { min: 0, precision: 5 }),
  F.bool('active', { default: true }),
]);
collection('channel_connections', { icon: 'cable', note: 'One connection per property × channel', display_template: '{{property.name}} ↔ {{channel.name}}', group: 'hotel_distribution', sort: 2 }, [
  F.select('status', ['onboarding', 'active', 'paused', 'error'], { default: 'onboarding' }),
  F.string('external_hotel_code', { note: 'Property ID on the channel side' }),
  F.string('credentials_ref', { note: 'Name of the secret in the vault — never store credentials here' }),
  F.dec('commission_percent', { min: 0, precision: 5 }),
  F.ts('last_ari_push_at', { readonly: true }),
  F.ts('last_reservation_pull_at', { readonly: true }),
  F.text('last_error'),
]);
collection('channel_mappings', { icon: 'swap_horiz', note: 'Our room type × rate plan ↔ the channel\'s room and rate codes', display_template: '{{room_type.name}} / {{rate_plan.code}} ↔ {{external_room_code}} / {{external_rate_code}}', group: 'hotel_distribution', sort: 3 }, [
  F.string('external_room_code', { required: true }),
  F.string('external_rate_code', { required: true }),
  F.bool('active', { default: true }),
]);
collection('channel_sync_log', { icon: 'sync_alt', note: 'Every ARI push and reservation message; idempotency_key makes retries safe', display_template: '{{message_type}} · {{status}}', group: 'hotel_distribution', sort: 4, sort_field: null }, [
  F.select('direction', ['outbound', 'inbound'], { required: true }),
  F.select('message_type', [['ari_availability', 'ARI availability (OTA_HotelAvailNotifRQ)'], ['ari_rates', 'ARI rates (OTA_HotelRateAmountNotifRQ)'], ['reservation_new', 'New reservation (OTA_HotelResNotifRQ)'], ['reservation_modify', 'Modification (OTA_HotelResModifyNotifRQ)'], ['reservation_cancel', 'Cancellation (OTA_CancelRQ)'], ['reconciliation', 'Reconciliation']], { required: true }),
  F.string('idempotency_key', { required: true, unique: true, note: 'Channel message ID or reservation ID + version — processed exactly once' }),
  F.string('external_reservation_id'),
  F.select('status', ['received', 'processed', 'failed', 'retrying', ['ignored_duplicate', 'Ignored (duplicate)']], { default: 'received' }),
  F.int('attempts', { min: 1, default: 1 }),
  F.text('payload', { interface: 'input-code', options: { language: 'xml' } }),
  F.text('error'),
  F.ts('received_at'),
  F.ts('processed_at'),
  F.created(),
]);
collection('payments', { icon: 'payments', display_template: '{{type}} · {{amount}} {{currency}} · {{status}}', group: 'hotel_billing', sort: 3 }, [
  F.select('type', [['pre_authorization', 'Pre-authorisation'], 'capture', 'payment', 'deposit', 'refund', 'void'], { required: true }),
  F.select('method', ['card', ['ota_virtual_card', 'OTA virtual card'], ['mb_way', 'MB WAY'], 'multibanco', ['bank_transfer', 'Bank transfer'], 'cash']),
  F.select('provider', ['stripe', 'ifthenpay', 'adyen', ['ota', 'OTA (collected by channel)'], 'manual']),
  F.select('status', ['pending', 'authorized', 'captured', 'succeeded', 'failed', 'voided', 'refunded'], { default: 'pending' }),
  F.dec('amount', { required: true }),
  F.select('currency', ['EUR', 'GBP', 'USD'], { default: 'EUR' }),
  F.string('provider_reference'),
  F.string('idempotency_key', { unique: true, note: 'Sent to the provider so a retried request never charges twice' }),
  F.ts('authorized_at'),
  F.ts('captured_at'),
  F.text('notes'),
  F.created(),
]);
collection('invoice_lines', { icon: 'list_alt', note: 'Folio lines: room nights (posted by the night audit), extras, city tax, adjustments', display_template: '{{date}} · {{description}} · {{amount}}', group: 'hotel_billing', sort: 2 }, [
  F.date('date', { note: 'Business date the charge belongs to' }),
  F.select('line_type', ['room', 'service', ['city_tax', 'City tax'], 'fee', 'discount', 'adjustment'], { required: true }),
  F.string('description', { width: 'full' }),
  F.dec('quantity', { default: 1 }),
  F.dec('unit_price'),
  F.dec('amount', { note: 'quantity × unit_price' }),
  F.dec('tax_rate', { precision: 5, note: 'VAT %, e.g. 6 for accommodation in Portugal' }),
]);
collection('night_audits', { icon: 'nightlight', note: 'Daily close: posts room charges and city tax, marks no-shows, freezes KPIs', display_template: '{{business_date}} · {{status}}', group: 'hotel_front_office', sort: 9 }, [
  F.date('business_date', { required: true }),
  F.select('status', ['open', ['in_progress', 'In progress'], 'closed'], { default: 'open' }),
  F.ts('started_at'),
  F.ts('closed_at'),
  F.int('rooms_available', { min: 0, width: 'quarter' }),
  F.int('rooms_occupied', { min: 0, width: 'quarter' }),
  F.int('arrivals', { min: 0, width: 'quarter' }),
  F.int('departures', { min: 0, width: 'quarter' }),
  F.int('no_shows', { min: 0, width: 'quarter' }),
  F.dec('occupancy_percent', { precision: 5, width: 'quarter' }),
  F.dec('adr', { note: 'Average daily rate = room revenue / rooms occupied', width: 'quarter' }),
  F.dec('revpar', { note: 'Revenue per available room = room revenue / rooms available', width: 'quarter' }),
  F.dec('room_revenue'),
  F.dec('other_revenue'),
  F.text('notes'),
]);
collection('housekeeping_tasks', { icon: 'cleaning_services', display_template: 'Room {{room.room_number}} · {{task_type}} · {{status}}', group: 'hotel_front_office', sort: 6 }, [
  F.date('date', { required: true }),
  F.select('task_type', [['departure_clean', 'Departure clean'], 'stayover', 'inspection', 'turndown', ['deep_clean', 'Deep clean']], { required: true }),
  F.select('status', ['pending', ['in_progress', 'In progress'], 'done', 'inspected'], { default: 'pending' }),
  F.select('priority', ['normal', 'high'], { default: 'normal' }),
  F.ts('completed_at'),
  F.text('notes'),
]);

// 3. Relations (all FKs created by Directus with the on_delete shown)
m2o('properties', 'brand', 'brands', { required: true, template: '{{name}}', one_field: 'properties', list_template: '{{name}}' });
m2o('brands', 'logo', 'directus_files', { on_delete: 'SET NULL' });
for (const c of ['room_types', 'rooms', 'bookings', 'services', 'staff', 'rate_plans', 'cancellation_policies', 'rates', 'availability', 'channel_connections', 'night_audits']) {
  const lists = { room_types: ['room_types', '{{name}}'], rooms: ['rooms', 'Room {{room_number}}'], rate_plans: ['rate_plans', '{{code}} · {{name}}'], channel_connections: ['channel_connections', '{{channel.name}} · {{status}}'], night_audits: ['night_audits', '{{business_date}} · {{status}}'] }[c];
  m2o(c, 'property', 'properties', { required: true, template: '{{name}}', note: 'Tenant', ...(lists ? { one_field: lists[0], list_template: lists[1] } : {}) });
}
m2o('guests', 'brand', 'brands', { template: '{{name}}', note: 'Guest profiles are shared by the properties of a brand' });
addField('guests', F.bool('marketing_consent', { label: 'Opted in to marketing e-mails' }));
m2o('rate_plans', 'cancellation_policy', 'cancellation_policies', { template: '{{name}}' });
m2o('rate_plans', 'parent_rate_plan', 'rate_plans', { template: '{{code}}', on_delete: 'SET NULL', note: 'Derived from this plan (see adjustment)' });
m2o('rates', 'room_type', 'room_types', { required: true, template: '{{name}}', on_delete: 'CASCADE' });
m2o('rates', 'rate_plan', 'rate_plans', { required: true, template: '{{code}}', on_delete: 'CASCADE' });
m2o('availability', 'room_type', 'room_types', { required: true, template: '{{name}}', on_delete: 'CASCADE' });
m2o('channel_connections', 'channel', 'channels', { required: true, template: '{{name}}', one_field: 'connections', list_template: '{{property.name}} · {{status}}' });
m2o('channel_mappings', 'connection', 'channel_connections', { required: true, template: '{{channel.name}}', on_delete: 'CASCADE', one_field: 'mappings', list_template: '{{room_type.name}} / {{rate_plan.code}} ↔ {{external_room_code}} / {{external_rate_code}}' });
m2o('channel_mappings', 'room_type', 'room_types', { required: true, template: '{{name}}', on_delete: 'CASCADE' });
m2o('channel_mappings', 'rate_plan', 'rate_plans', { required: true, template: '{{code}}', on_delete: 'CASCADE' });
m2o('channel_sync_log', 'connection', 'channel_connections', { required: true, template: '{{channel.name}}', on_delete: 'CASCADE', one_field: 'sync_log', list_template: '{{message_type}} · {{status}}' });
m2o('channel_sync_log', 'booking', 'bookings', { template: '{{booking_number}}', on_delete: 'SET NULL' });
m2o('bookings', 'rate_plan', 'rate_plans', { template: '{{code}} · {{name}}' });
m2o('bookings', 'channel_id', 'channels', { template: '{{name}}', note: 'Source channel' });
addField('bookings', F.string('external_reference', { note: 'Confirmation number on the channel (unique per channel — makes OTA re-deliveries idempotent)' }));
addField('bookings', F.ts('cancellation_deadline', { note: 'Free cancellation until (from the rate plan policy)' }));
addField('bookings', F.ts('cancelled_at'));
m2o('payments', 'booking', 'bookings', { required: true, template: '{{booking_number}}', one_field: 'payments', list_template: '{{type}} · {{amount}} · {{status}}' });
m2o('payments', 'invoice', 'invoices', { template: 'Invoice #{{invoice_number}}', on_delete: 'SET NULL', one_field: 'payments', list_template: '{{type}} · {{amount}} · {{status}}' });
m2o('invoice_lines', 'invoice', 'invoices', { required: true, template: 'Invoice #{{invoice_number}}', on_delete: 'CASCADE', one_field: 'lines', list_template: '{{date}} · {{description}} · {{amount}}' });
m2o('invoice_lines', 'service_order', 'service_orders', { template: '{{service_id.name}}', on_delete: 'SET NULL' });
m2o('invoice_lines', 'night_audit', 'night_audits', { template: '{{business_date}}', on_delete: 'SET NULL', note: 'Posted by this night audit' });
m2o('night_audits', 'closed_by', 'staff', { type: 'integer', template: '{{first_name}} {{last_name}}', on_delete: 'SET NULL' });
m2o('housekeeping_tasks', 'room', 'rooms', { required: true, template: 'Room {{room_number}}', on_delete: 'CASCADE', one_field: 'housekeeping_tasks', list_template: '{{date}} · {{task_type}} · {{status}}' });
m2o('housekeeping_tasks', 'assigned_to', 'staff', { type: 'integer', template: '{{first_name}} {{last_name}}', on_delete: 'SET NULL' });
addField('rooms', F.select('housekeeping_status', ['clean', 'dirty', 'inspected', ['out_of_order', 'Out of order']], { default: 'clean' }));
addField('services', F.select('pricing_unit', [['per_stay', 'Per stay'], ['per_night', 'Per night'], ['per_person', 'Per person'], ['per_person_per_night', 'Per person per night']], { default: 'per_stay' }));
addField('services', F.bool('bookable_online', { default: true, label: 'Offered as an upsell in the booking engine' }));

// 4. bookings.channel (free text) -> bookings.channel_id (relation to channels)
const CHANNELS = [
  ['Direct (booking engine)', 'DIRECT', 'direct', 'none', 'none', 0],
  ['Booking.com', 'BDC', 'ota', 'ota_xml', 'push_pull', 15],
  ['Expedia', 'EXP', 'ota', 'ota_xml', 'push_pull', 18],
  ['Airbnb', 'ABB', 'ota', 'rest_json', 'webhook', 15],
  ['Hotelbeds', 'HBD', 'wholesaler', 'ota_xml', 'push_pull', 20],
  ['GDS (Sabre / Amadeus)', 'GDS', 'gds', 'htng', 'push_pull', 10],
  ['Phone', 'PHONE', 'offline', 'none', 'none', 0],
  ['Walk-in', 'WALKIN', 'offline', 'none', 'none', 0],
];
const LEGACY = { direct: 'DIRECT', booking_com: 'BDC', expedia: 'EXP', airbnb: 'ABB', phone: 'PHONE', walk_in: 'WALKIN' };
op('= channels reference rows (by code)', async () => {
  const have = new Set((await call('GET', '/items/channels?limit=-1&fields=code')).map(c => c.code));
  const rows = CHANNELS.filter(c => !have.has(c[1])).map(([name, code, type, protocol, sync_mode, default_commission_percent]) => ({ name, code, type, protocol, sync_mode, default_commission_percent, active: true }));
  if (rows.length) await call('POST', '/items/channels', rows);
});
op('~ migrate bookings.channel -> channel_id, then drop bookings.channel', async () => {
  if (!(await hasField('bookings', 'channel'))) return;
  const byCode = Object.fromEntries((await call('GET', '/items/channels?limit=-1&fields=id,code')).map(c => [c.code, c.id]));
  for (const b of await call('GET', '/items/bookings?limit=-1&fields=id,channel,channel_id'))
    if (b.channel && !b.channel_id) await call('PATCH', `/items/bookings/${b.id}`, { channel_id: byCode[LEGACY[b.channel]] });
  const left = (await call('GET', '/items/bookings?limit=-1&fields=id,channel,channel_id')).filter(b => b.channel && !b.channel_id);
  if (left.length) throw new Error(`${left.length} bookings could not be mapped; keeping bookings.channel`);
  await call('DELETE', '/fields/bookings/channel');
});

// 5. Place every hotel collection in its sub-folder
[['bookings', 1], ['booking_guests', 2, { hidden: true }], ['guests', 3], ['rooms', 4], ['room_types', 5], ['room_maintenance', 7], ['staff', 8]].forEach(([c, s, x]) => move(c, 'hotel_front_office', s, x));
[['invoices', 1], ['services', 4], ['service_orders', 5]].forEach(([c, s]) => move(c, 'hotel_billing', s));

console.log(`${ops.length} operations${APPLY ? '' : ' (dry run)'}:`);
for (const o of ops) { console.log(' ', o.desc); if (APPLY) await o.fn(); }
if (APPLY) console.log('applied');

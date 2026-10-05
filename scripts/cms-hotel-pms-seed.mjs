// Example data (English) for the PMS / booking engine / channel manager / white-label collections
// on the hotel instance. Builds on scripts/cms-hotel-seed.mjs (rooms, guests, bookings, invoices…).
//   node --env-file=.env.hotel scripts/cms-hotel-pms-seed.mjs            dry run
//   node --env-file=.env.hotel scripts/cms-hotel-pms-seed.mjs --apply    (brands must be empty)
// Two tenants: "Seaside Lisbon" (brand Seaside Collection) gets all existing data;
// "Alma Comporta Villas" (brand Alma Stays) is a small short-term-rental tenant.
const { DIRECTUS_URL: U, DIRECTUS_TOKEN: T } = process.env;
const APPLY = process.argv[2] === '--apply';
const call = async (method, path, body) => {
  const r = await fetch(U + path, { method, headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${t}`);
  return t ? JSON.parse(t).data : null;
};
const get = (c, q = '') => call('GET', `/items/${c}?limit=-1${q}`);
const create = (c, item) => call('POST', `/items/${c}`, item);
const createMany = async (c, rows) => { const out = []; for (let i = 0; i < rows.length; i += 100) out.push(...(await create(c, rows.slice(i, i + 100)))); return out; };
const patch = (c, id, data) => call('PATCH', `/items/${c}/${id}`, data);
const round2 = n => Math.round(n * 100) / 100;
const days = (from, to) => { const out = []; for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10)); return out; };
const OCT = days('2026-10-01', '2026-10-31');
const EVENT = new Set(['2026-10-16', '2026-10-17']); // marathon weekend: +25%, min stay 2, CTA on Saturday

// ---- existing data -------------------------------------------------------
const [roomTypes, rooms, bookings, guests, services, staff, invoices, orders, channels] = await Promise.all([
  get('room_types', '&fields=id,name,base_price'), get('rooms', '&fields=id,room_number,status,room_type.name'),
  get('bookings', '&fields=id,booking_number,status,room_type.name,room_id.room_number,check_in_date,check_out_date,nightly_rate,adults,children,channel_id.code&sort=booking_number'),
  get('guests', '&fields=id,email'), get('services', '&fields=id,name,price'), get('staff', '&fields=id,email'),
  get('invoices', '&fields=id,invoice_number,booking_id.booking_number'), get('service_orders', '&fields=id,quantity,unit_price,status,service_id.name,booking_id.booking_number'),
  get('channels', '&fields=id,code'),
]);
const by = (list, key) => Object.fromEntries(list.map(x => [key(x), x]));
const RT = by(roomTypes, x => x.name), RM = by(rooms, x => x.room_number), BK = by(bookings, x => x.booking_number), SV = by(services, x => x.name), ST = by(staff, x => x.email), INV = by(invoices, x => x.invoice_number), CH = by(channels, x => x.code);
const nightsOf = b => days(b.check_in_date.slice(0, 10), b.check_out_date.slice(0, 10)).slice(0, -1);
const occupies = s => ['reserved', 'checked_in', 'checked_out'].includes(s);

console.log(`existing: ${roomTypes.length} room types, ${rooms.length} rooms, ${bookings.length} bookings, ${invoices.length} invoices, ${channels.length} channels`);
if (!APPLY) { console.log('(dry run) would add 2 brands, 2 properties, 4+1 cancellation policies, 4+1 rate plans, ~530 rates, ~155 availability rows, 7 channel connections, 25 mappings, 9 sync-log messages, 6 payments, folio lines, 5 night audits, 6 housekeeping tasks'); process.exit(0); }
if ((await get('brands', '&fields=id')).length) throw new Error('brands is not empty; not seeding');

// ---- 1. brands & properties (white-label / multi-tenant) -----------------
const seasideBrand = await create('brands', {
  name: 'Seaside Collection', status: 'active', primary_domain: 'book.seaside.example', primary_color: '#0E5E6F', secondary_color: '#F4EDE4',
  font_family: 'Fraunces, Georgia, serif', default_language: 'en-US', default_currency: 'EUR',
  email_from_name: 'Seaside Collection Reservations', email_from_address: 'reservations@seaside.example',
  email_templates: {
    booking_confirmation: { subject: 'Your stay at {{property.name}} is confirmed — {{booking.booking_number}}', heading: 'See you soon, {{guest.first_name}}' },
    cancellation: { subject: 'Booking {{booking.booking_number}} cancelled', heading: 'Your booking has been cancelled' },
    pre_arrival: { subject: '3 days to go — check in online', heading: 'Ready for the sea breeze?' },
  },
});
const almaBrand = await create('brands', {
  name: 'Alma Stays', status: 'active', primary_domain: 'stays.alma.example', primary_color: '#7A3E2B', secondary_color: '#FFF8F0',
  font_family: 'Inter, system-ui, sans-serif', default_language: 'pt-PT', default_currency: 'EUR',
  email_from_name: 'Alma Stays', email_from_address: 'hello@alma.example',
  email_templates: { booking_confirmation: { subject: 'Reserva confirmada — {{booking.booking_number}}', heading: 'Olá {{guest.first_name}}' } },
});
const lisbon = await create('properties', {
  brand: seasideBrand.id, name: 'Seaside Lisbon', slug: 'seaside-lisbon', status: 'active', property_type: 'hotel', city: 'Lisbon', country: 'Portugal',
  address: 'Avenida do Exemplo 100\n1200-000 Lisboa', timezone: 'Europe/Lisbon', currency: 'EUR', check_in_time: '15:00:00', check_out_time: '11:00:00',
  city_tax_per_person_night: 4, booking_engine_enabled: true,
});
const alma = await create('properties', {
  brand: almaBrand.id, name: 'Alma Comporta Villas', slug: 'alma-comporta', status: 'onboarding', property_type: 'short_term_rental', city: 'Comporta', country: 'Portugal',
  address: 'Estrada do Exemplo, Comporta', timezone: 'Europe/Lisbon', currency: 'EUR', check_in_time: '16:00:00', check_out_time: '10:00:00',
  city_tax_per_person_night: 0, booking_engine_enabled: false,
});
console.log('brands & properties');

// Existing operational data belongs to Seaside Lisbon.
for (const c of ['room_types', 'rooms', 'services', 'staff']) for (const x of await get(c, '&fields=id')) await patch(c, x.id, { property: lisbon.id });
const MARKETING = new Set(['emma.thompson@example.com', 'chloe.martin@example.com', 'sanne.devries@example.com']);
for (const g of guests) await patch('guests', g.id, { brand: seasideBrand.id, marketing_consent: MARKETING.has(g.email) });
const SERVICE_META = { 'Breakfast buffet': 'per_person_per_night', 'Airport transfer': 'per_stay', 'Late check-out (14:00)': 'per_stay', 'Spa day pass': 'per_person', Parking: 'per_night', 'Bike rental': 'per_night' };
for (const [name, pricing_unit] of Object.entries(SERVICE_META)) if (SV[name]) await patch('services', SV[name].id, { pricing_unit, bookable_online: true });

// Alma: one villa type, two villas.
const villaType = await create('room_types', { property: alma.id, name: 'Two-bedroom Villa', base_price: 280, max_occupancy: 4, description: 'Private pool, garden and fully equipped kitchen. Minimum stay 3 nights.' });
await create('rooms', [{ property: alma.id, room_number: 'V1', room_type: villaType.id, floor: 0, status: 'available' }, { property: alma.id, room_number: 'V2', room_type: villaType.id, floor: 0, status: 'available' }]);

// ---- 2. cancellation policies & rate plans --------------------------------
const policies = by(await create('cancellation_policies', [
  { property: lisbon.id, code: 'FLEX48', name: 'Flexible — free until 48 h', free_cancellation_hours: 48, penalty_type: 'first_night', no_show_penalty: 'first_night', description: 'Free cancellation until 48 hours before arrival; afterwards the first night is charged.' },
  { property: lisbon.id, code: 'NRF', name: 'Non-refundable', free_cancellation_hours: 0, penalty_type: 'full_stay', no_show_penalty: 'full_stay', description: 'Charged in full at booking; no refunds.' },
  { property: lisbon.id, code: 'CORP24', name: 'Corporate — free until 24 h', free_cancellation_hours: 24, penalty_type: 'first_night', no_show_penalty: 'first_night', description: 'For contracted companies.' },
]), x => x.code); // Directus returns created items in its own order — resolve by code
const { FLEX48: flex, NRF: nrf, CORP24: corp24 } = policies;
const almaPolicy = await create('cancellation_policies', { property: alma.id, code: 'MOD5D', name: 'Moderate — free until 5 days', free_cancellation_hours: 120, penalty_type: 'percentage', penalty_percent: 50, no_show_penalty: 'full_stay', description: '50% charged if cancelled within 5 days of arrival.' });
const bar = await create('rate_plans', { property: lisbon.id, code: 'BAR', name: 'Best Available Rate', meal_plan: 'room_only', cancellation_policy: flex.id, adjustment_type: 'none', min_stay: 1, bookable_online: true, description: 'Flexible public rate; every other plan is derived from it.' });
const derived = by(await create('rate_plans', [
  { property: lisbon.id, code: 'NRF', name: 'Non-refundable −10%', meal_plan: 'room_only', cancellation_policy: nrf.id, parent_rate_plan: bar.id, adjustment_type: 'percent', adjustment_value: -10, min_stay: 1, bookable_online: true },
  { property: lisbon.id, code: 'BB', name: 'Bed & Breakfast', meal_plan: 'breakfast', cancellation_policy: flex.id, parent_rate_plan: bar.id, adjustment_type: 'amount', adjustment_value: 28, min_stay: 1, bookable_online: true, description: 'BAR + breakfast for two.' },
  { property: lisbon.id, code: 'CORP', name: 'Corporate −15%', meal_plan: 'room_only', cancellation_policy: corp24.id, parent_rate_plan: bar.id, adjustment_type: 'percent', adjustment_value: -15, min_stay: 1, bookable_online: false, description: 'Not public: booked by phone or with a company code.' },
]), x => x.code);
const { NRF: nrfPlan, BB: bbPlan, CORP: corpPlan } = derived;
const almaStd = await create('rate_plans', { property: alma.id, code: 'STD', name: 'Standard', meal_plan: 'room_only', cancellation_policy: almaPolicy.id, adjustment_type: 'none', min_stay: 3, bookable_online: false });
const PLANS = [bar, nrfPlan, bbPlan, corpPlan];
console.log('policies & rate plans');

// ---- 3. ARI: rates and availability for October 2026 ---------------------
const priceFor = (plan, base, date) => {
  const barPrice = round2(base * (EVENT.has(date) ? 1.25 : 1));
  if (plan.adjustment_type === 'percent') return round2(barPrice * (1 + Number(plan.adjustment_value) / 100)); // decimals arrive as strings
  if (plan.adjustment_type === 'amount') return round2(barPrice + Number(plan.adjustment_value));
  return barPrice;
};
const rateRows = [];
for (const rt of roomTypes) for (const plan of PLANS) for (const date of OCT)
  rateRows.push({ property: lisbon.id, room_type: rt.id, rate_plan: plan.id, date, price: priceFor(plan, Number(rt.base_price), date), min_stay: EVENT.has(date) ? 2 : 1, closed_to_arrival: date === '2026-10-17', closed_to_departure: false, stop_sell: false });
for (const date of OCT) rateRows.push({ property: alma.id, room_type: villaType.id, rate_plan: almaStd.id, date, price: 280, min_stay: 3, closed_to_arrival: false, closed_to_departure: false, stop_sell: false });
await createMany('rates', rateRows);

const outOfOrder = (typeName, date) => (typeName === 'Deluxe Sea View' && date >= '2026-10-04' && date <= '2026-10-07' ? 1 : 0); // room 203 AC repair
const availRows = [];
for (const rt of roomTypes) {
  const total = rooms.filter(r => r.room_type?.name === rt.name).length;
  for (const date of OCT) {
    const booked = bookings.filter(b => occupies(b.status) && b.room_type?.name === rt.name && nightsOf(b).includes(date)).length;
    const ooo = outOfOrder(rt.name, date);
    availRows.push({ property: lisbon.id, room_type: rt.id, date, total_rooms: total, booked, out_of_order: ooo, available: total - booked - ooo, stop_sell: false, last_pushed_at: '2026-10-05T06:00:00' });
  }
}
for (const date of OCT) availRows.push({ property: alma.id, room_type: villaType.id, date, total_rooms: 2, booked: 0, out_of_order: 0, available: 2, stop_sell: false });
await createMany('availability', availRows);
console.log(`ARI: ${rateRows.length} rates, ${availRows.length} availability rows`);

// ---- 4. channel manager --------------------------------------------------
const conn = {};
const connRows = [
  ['DIRECT', lisbon, 'active', 'SEASIDE-LIS', null, 0],
  ['BDC', lisbon, 'active', '1234567', 'vault://channels/bdc/seaside-lisbon', 15],
  ['EXP', lisbon, 'active', '998877', 'vault://channels/expedia/seaside-lisbon', 18],
  ['ABB', lisbon, 'active', 'host-55501', 'vault://channels/airbnb/seaside-lisbon', 15],
  ['HBD', lisbon, 'onboarding', null, null, 20],
  ['ABB', alma, 'active', 'host-77801', 'vault://channels/airbnb/alma-comporta', 15],
  ['DIRECT', alma, 'onboarding', 'ALMA-CMP', null, 0],
];
for (const [code, prop, status, external_hotel_code, credentials_ref, commission_percent] of connRows) {
  const c = await create('channel_connections', { property: prop.id, channel: CH[code].id, status, external_hotel_code, credentials_ref, commission_percent,
    last_ari_push_at: status === 'active' && code !== 'DIRECT' ? '2026-10-05T06:00:00' : null, last_reservation_pull_at: status === 'active' && code !== 'DIRECT' ? '2026-10-05T12:55:00' : null,
    last_error: code === 'EXP' ? 'HTTP 503 from Expedia EQC on availability push at 12:40 — retrying with backoff' : null });
  conn[`${code}:${prop.slug}`] = c;
}
const mapRows = [];
roomTypes.forEach((rt, i) => {
  const n = i + 1;
  for (const [plan, code] of [[bar, 'BAR-RO'], [nrfPlan, 'NRF-RO'], [bbPlan, 'BAR-BB']]) mapRows.push({ connection: conn['BDC:seaside-lisbon'].id, room_type: rt.id, rate_plan: plan.id, external_room_code: `12345670${n}`, external_rate_code: code, active: true });
  for (const [plan, code] of [[bar, `2001${n}0`], [nrfPlan, `2001${n}1`]]) mapRows.push({ connection: conn['EXP:seaside-lisbon'].id, room_type: rt.id, rate_plan: plan.id, external_room_code: `20010${n}`, external_rate_code: code, active: true });
  mapRows.push({ connection: conn['ABB:seaside-lisbon'].id, room_type: rt.id, rate_plan: bar.id, external_room_code: `listing-5550${n}`, external_rate_code: 'default', active: true });
});
mapRows.push({ connection: conn['ABB:alma-comporta'].id, room_type: villaType.id, rate_plan: almaStd.id, external_room_code: 'listing-77801', external_rate_code: 'default', active: true });
await createMany('channel_mappings', mapRows);

// OTA references on the bookings that came from channels.
const EXT = { 'BK-2026-0002': '4012345678', 'BK-2026-0006': '4019876543', 'BK-2026-0003': '72631950', 'BK-2026-0004': 'HMABCD1234' };
const xml = (rq, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<${rq} xmlns="http://www.opentravel.org/OTA/2003/05" Version="1.0">\n${body}\n</${rq}>`;
await create('channel_sync_log', [
  { connection: conn['BDC:seaside-lisbon'].id, direction: 'outbound', message_type: 'ari_availability', idempotency_key: 'BDC-avail-2026-10-05T06:00Z', status: 'processed', attempts: 1, received_at: '2026-10-05T06:00:00', processed_at: '2026-10-05T06:00:02',
    payload: xml('OTA_HotelAvailNotifRQ', '  <AvailStatusMessages HotelCode="1234567">\n    <AvailStatusMessage BookingLimit="1">\n      <StatusApplicationControl Start="2026-10-05" End="2026-10-05" InvTypeCode="123456703"/>\n    </AvailStatusMessage>\n  </AvailStatusMessages>') },
  { connection: conn['BDC:seaside-lisbon'].id, direction: 'outbound', message_type: 'ari_rates', idempotency_key: 'BDC-rates-2026-10-05T06:00Z', status: 'processed', attempts: 1, received_at: '2026-10-05T06:00:03', processed_at: '2026-10-05T06:00:05',
    payload: xml('OTA_HotelRateAmountNotifRQ', '  <RateAmountMessages HotelCode="1234567">\n    <RateAmountMessage>\n      <StatusApplicationControl Start="2026-10-16" End="2026-10-17" InvTypeCode="123456703" RatePlanCode="BAR-RO"/>\n      <Rates><Rate><BaseByGuestAmts><BaseByGuestAmt AmountAfterTax="206.25" CurrencyCode="EUR"/></BaseByGuestAmts></Rate></Rates>\n    </RateAmountMessage>\n  </RateAmountMessages>') },
  { connection: conn['BDC:seaside-lisbon'].id, direction: 'inbound', message_type: 'reservation_new', idempotency_key: 'BDC-4012345678-v1', external_reservation_id: '4012345678', booking: BK['BK-2026-0002'].id, status: 'processed', attempts: 1, received_at: '2026-09-21T18:04:11', processed_at: '2026-09-21T18:04:12',
    payload: xml('OTA_HotelResNotifRQ', '  <HotelReservations><HotelReservation ResStatus="Commit">\n    <UniqueID Type="14" ID="4012345678"/>\n  </HotelReservation></HotelReservations>') },
  { connection: conn['BDC:seaside-lisbon'].id, direction: 'inbound', message_type: 'reservation_modify', idempotency_key: 'BDC-4012345678-v2', external_reservation_id: '4012345678', booking: BK['BK-2026-0002'].id, status: 'processed', attempts: 1, received_at: '2026-09-28T10:30:00', processed_at: '2026-09-28T10:30:01',
    error: null, payload: xml('OTA_HotelResModifyNotifRQ', '  <HotelResModifies><HotelResModify ResStatus="Modify">\n    <UniqueID Type="14" ID="4012345678"/><!-- second guest added: Anna Becker -->\n  </HotelResModify></HotelResModifies>') },
  { connection: conn['BDC:seaside-lisbon'].id, direction: 'inbound', message_type: 'reservation_cancel', idempotency_key: 'BDC-4019876543-v2', external_reservation_id: '4019876543', booking: BK['BK-2026-0006'].id, status: 'processed', attempts: 1, received_at: '2026-10-02T09:12:00', processed_at: '2026-10-02T09:12:01',
    payload: xml('OTA_CancelRQ', '  <UniqueID Type="14" ID="4019876543"/>') },
  { connection: conn['EXP:seaside-lisbon'].id, direction: 'inbound', message_type: 'reservation_new', idempotency_key: 'EXP-72631950-v1', external_reservation_id: '72631950', booking: BK['BK-2026-0003'].id, status: 'processed', attempts: 2, received_at: '2026-09-30T22:15:40', processed_at: '2026-09-30T22:16:45',
    error: 'Attempt 1: timeout sending OTA_HotelResNotifRS acknowledgement; Expedia re-delivered the same message and it was matched by idempotency_key — no duplicate booking.' },
  { connection: conn['EXP:seaside-lisbon'].id, direction: 'outbound', message_type: 'ari_availability', idempotency_key: 'EXP-avail-2026-10-05T12:40Z', status: 'retrying', attempts: 3, received_at: '2026-10-05T12:40:00', error: 'HTTP 503 Service Unavailable from Expedia EQC — exponential backoff, next attempt 13:10' },
  { connection: conn['ABB:seaside-lisbon'].id, direction: 'inbound', message_type: 'reservation_new', idempotency_key: 'ABB-HMABCD1234-v1', external_reservation_id: 'HMABCD1234', booking: BK['BK-2026-0004'].id, status: 'processed', attempts: 1, received_at: '2026-10-01T14:02:09', processed_at: '2026-10-01T14:02:10',
    payload: JSON.stringify({ event: 'reservation.created', confirmation_code: 'HMABCD1234', listing_id: 'listing-55502', check_in: '2026-10-10', check_out: '2026-10-13', guests: 2 }, null, 2) },
  { connection: conn['EXP:seaside-lisbon'].id, direction: 'inbound', message_type: 'reconciliation', idempotency_key: 'EXP-reconcile-2026-10-05', status: 'processed', attempts: 1, received_at: '2026-10-05T05:00:00', processed_at: '2026-10-05T05:00:40',
    error: null, payload: 'Compared 14 Expedia reservations for 2026-10-01 → 2026-11-30 against the PMS: 0 missing, 0 status mismatches.' },
]);
console.log(`channels: ${connRows.length} connections, ${mapRows.length} mappings, 9 sync messages`);

// ---- 5. bookings: tenant, rate plan, OTA reference, cancellation deadline -
const PLAN_OF = { 'BK-2026-0005': corpPlan };
const POLICY_HOURS = { [bar.id]: 48, [nrfPlan.id]: 0, [bbPlan.id]: 48, [corpPlan.id]: 24 };
for (const b of bookings) {
  const plan = PLAN_OF[b.booking_number] || bar;
  const arrival = new Date(`${b.check_in_date.slice(0, 19)}Z`);
  const deadline = POLICY_HOURS[plan.id] ? new Date(arrival - POLICY_HOURS[plan.id] * 3600e3).toISOString().slice(0, 19) : null;
  const data = { property: lisbon.id, rate_plan: plan.id, external_reference: EXT[b.booking_number] ?? null, cancellation_deadline: deadline };
  if (b.booking_number === 'BK-2026-0005') { const rate = priceFor(corpPlan, 165, '2026-10-20'); Object.assign(data, { nightly_rate: rate, total_amount: round2(rate * 3) }); }
  if (b.status === 'cancelled') data.cancelled_at = '2026-10-02T09:12:00';
  await patch('bookings', b.id, data);
}

// ---- 6. night audits (Oct 1–4 closed, Oct 5 open) and folio lines --------
const audits = {};
const nextDay = d => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
for (const date of ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']) {
  const closed = date < '2026-10-05';
  const inHouse = bookings.filter(b => ['checked_in', 'checked_out'].includes(b.status) && nightsOf(b).includes(date));
  const ooo = outOfOrder('Deluxe Sea View', date);
  const roomRevenue = round2(inHouse.reduce((s, b) => s + Number(b.nightly_rate), 0));
  const available = rooms.length - ooo;
  audits[date] = await create('night_audits', {
    property: lisbon.id, business_date: date, status: closed ? 'closed' : 'open',
    started_at: closed ? `${nextDay(date)}T00:05:00` : null, closed_at: closed ? `${nextDay(date)}T00:20:00` : null,
    closed_by: closed ? ST[date === '2026-10-02' ? 'tiago.ferreira@hotel.example.com' : 'sofia.almeida@hotel.example.com'].id : null,
    rooms_available: available, rooms_occupied: inHouse.length,
    arrivals: bookings.filter(b => b.check_in_date.startsWith(date) && occupies(b.status)).length,
    departures: bookings.filter(b => b.check_out_date.startsWith(date) && occupies(b.status)).length,
    no_shows: bookings.filter(b => b.status === 'no_show' && b.check_in_date.startsWith(date)).length,
    room_revenue: closed ? roomRevenue : null, other_revenue: null,
    occupancy_percent: closed ? round2((inHouse.length / available) * 100) : null,
    adr: closed && inHouse.length ? round2(roomRevenue / inHouse.length) : null,
    revpar: closed ? round2(roomRevenue / available) : null,
    notes: closed ? null : 'Business day in progress — runs after midnight.',
  });
}
const tax = { room: 6, service: 23, city_tax: 0, fee: 6 };
const line = (invoice, date, line_type, description, quantity, unit_price, extra = {}) =>
  ({ invoice: INV[invoice].id, date, line_type, description, quantity, unit_price, amount: round2(quantity * unit_price), tax_rate: tax[line_type], ...extra });
const orderOf = (bk, svc) => orders.find(o => o.booking_id?.booking_number === bk && o.service_id?.name === svc);
const lines = [];
for (const d of ['2026-10-01', '2026-10-02', '2026-10-03']) {
  lines.push(line('INV-2026-0001', d, 'room', 'Standard Double — room night (BAR)', 1, 95, { night_audit: audits[d].id }));
  lines.push(line('INV-2026-0001', d, 'city_tax', 'Lisbon city tax — 1 guest', 1, 4, { night_audit: audits[d].id }));
}
lines.push(line('INV-2026-0001', '2026-10-04', 'service', 'Late check-out (14:00)', 1, 25, { service_order: orderOf('BK-2026-0001', 'Late check-out (14:00)')?.id }));
for (const d of ['2026-10-03', '2026-10-04']) {
  lines.push(line('INV-2026-0002', d, 'room', 'Deluxe Sea View — room night (BAR, Booking.com)', 1, 165, { night_audit: audits[d].id }));
  lines.push(line('INV-2026-0002', d, 'city_tax', 'Lisbon city tax — 2 guests', 2, 4, { night_audit: audits[d].id }));
}
lines.push(line('INV-2026-0002', '2026-10-04', 'service', 'Spa day pass × 2', 2, 30, { service_order: orderOf('BK-2026-0002', 'Spa day pass')?.id }));
lines.push(line('INV-2026-0002', '2026-10-04', 'service', 'Breakfast buffet — 2 guests', 2, 14, { service_order: orderOf('BK-2026-0002', 'Breakfast buffet')?.id }));
lines.push(line('INV-2026-0002', '2026-10-05', 'service', 'Breakfast buffet — 2 guests', 2, 14, { service_order: orderOf('BK-2026-0002', 'Breakfast buffet')?.id }));
lines.push(line('INV-2026-0003', '2026-10-02', 'fee', 'No-show fee — first night (FLEX48 policy)', 1, 95, { night_audit: audits['2026-10-02'].id }));
await create('invoice_lines', lines);
const totals = {};
for (const l of lines) totals[l.invoice] = round2((totals[l.invoice] || 0) + l.amount);
for (const inv of invoices) await patch('invoices', inv.id, { total_amount: totals[inv.id] ?? 0 });
console.log(`night audits: 5, folio lines: ${lines.length}`);

// ---- 7. payments (pre-authorisation → capture, OTA virtual card, OTA-collected) ----
const invTotal = n => totals[INV[n].id];
await create('payments', [
  { booking: BK['BK-2026-0001'].id, invoice: INV['INV-2026-0001'].id, type: 'pre_authorization', method: 'card', provider: 'stripe', status: 'captured', amount: 285, currency: 'EUR', provider_reference: 'pi_example_0001', idempotency_key: 'pay-BK-2026-0001-preauth', authorized_at: '2026-10-01T15:20:00', captured_at: '2026-10-04T11:05:00', notes: 'Card pre-authorised at check-in; captured at check-out.' },
  { booking: BK['BK-2026-0001'].id, invoice: INV['INV-2026-0001'].id, type: 'capture', method: 'card', provider: 'stripe', status: 'succeeded', amount: invTotal('INV-2026-0001'), currency: 'EUR', provider_reference: 'ch_example_0001', idempotency_key: 'pay-INV-2026-0001-capture', captured_at: '2026-10-04T11:05:00' },
  { booking: BK['BK-2026-0002'].id, invoice: INV['INV-2026-0002'].id, type: 'pre_authorization', method: 'ota_virtual_card', provider: 'stripe', status: 'authorized', amount: 864, currency: 'EUR', provider_reference: 'pi_example_vcc_0002', idempotency_key: 'pay-BK-2026-0002-vcc', authorized_at: '2026-10-03T15:40:00', notes: 'Booking.com virtual card, valid from arrival date. Captured at check-out.' },
  { booking: BK['BK-2026-0004'].id, type: 'payment', method: 'card', provider: 'ota', status: 'succeeded', amount: 330, currency: 'EUR', provider_reference: 'HMABCD1234', idempotency_key: 'pay-BK-2026-0004-airbnb', captured_at: '2026-10-01T14:02:10', notes: 'Collected by Airbnb; payout to the host 24 h after check-in (minus 15% commission).' },
  { booking: BK['BK-2026-0005'].id, type: 'pre_authorization', method: 'card', provider: 'stripe', status: 'authorized', amount: round2(priceFor(corpPlan, 165, '2026-10-20')), currency: 'EUR', provider_reference: 'pi_example_0005', idempotency_key: 'pay-BK-2026-0005-guarantee', authorized_at: '2026-10-05T09:00:00', notes: 'First-night guarantee from the booking engine (CORP24).' },
  { booking: BK['BK-2026-0007'].id, invoice: INV['INV-2026-0003'].id, type: 'capture', method: 'card', provider: 'stripe', status: 'succeeded', amount: invTotal('INV-2026-0003'), currency: 'EUR', provider_reference: 'ch_example_0007', idempotency_key: 'pay-INV-2026-0003-noshow', captured_at: '2026-10-03T00:05:00', notes: 'No-show fee captured by the night audit.' },
]);
console.log('payments: 6');

// ---- 8. housekeeping (business date 2026-10-05) ---------------------------
const HK = [
  ['101', 'departure_clean', 'inspected', 'normal', 'rui.costa@hotel.example.com', '2026-10-04T13:30:00', 'Departure clean after BK-2026-0001; inspected by the front desk.'],
  ['201', 'stayover', 'in_progress', 'normal', 'rui.costa@hotel.example.com', null, 'Anniversary guests — leave the card and chocolates.'],
  ['301', 'stayover', 'pending', 'normal', 'rui.costa@hotel.example.com', null, 'Family with two children; extra towels.'],
  ['102', 'inspection', 'done', 'normal', 'rui.costa@hotel.example.com', '2026-10-03T10:00:00', 'Checked after the no-show; untouched.'],
  ['203', 'deep_clean', 'pending', 'high', 'rui.costa@hotel.example.com', null, 'After the AC repair — before returning to inventory on 2026-10-08.'],
  ['202', 'turndown', 'pending', 'normal', 'rui.costa@hotel.example.com', null, null],
];
await create('housekeeping_tasks', HK.map(([room, task_type, status, priority, who, completed_at, notes]) => ({ room: RM[room].id, date: '2026-10-05', task_type, status, priority, assigned_to: ST[who].id, completed_at, notes })));
const HKS = { '101': 'inspected', '201': 'dirty', '301': 'dirty', '203': 'out_of_order' };
for (const r of rooms) await patch('rooms', r.id, { housekeeping_status: HKS[r.room_number] || 'clean' });
console.log('housekeeping: 6 tasks');
console.log('seeded');

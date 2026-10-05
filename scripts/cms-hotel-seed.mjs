// Example data (English) for the Hotel & Bookings collections on nowos.
//   node --env-file=.env scripts/cms-hotel-seed.mjs            dry run
//   node --env-file=.env scripts/cms-hotel-seed.mjs --apply    insert (tables must be empty)
//   node --env-file=.env scripts/cms-hotel-seed.mjs --remove   delete exactly these rows
// Stay dates are around 2026-10-05 so checked-in / upcoming / past bookings read naturally.
const { DIRECTUS_URL: U, DIRECTUS_TOKEN: T } = process.env;
const MODE = process.argv[2] || '--dry-run';
const call = async (method, path, body) => {
  const r = await fetch(U + path, { method, headers: { Authorization: `Bearer ${T}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const t = await r.text();
  if (!r.ok) { const e = new Error(`${method} ${path} -> ${r.status} ${t}`); e.status = r.status; throw e; }
  return t ? JSON.parse(t).data : null;
};
const create = (c, item) => call('POST', `/items/${c}`, item);

const roomTypes = [
  { name: 'Standard Double', base_price: 95, max_occupancy: 2, description: 'Queen bed, city view, rain shower. Our entry rate for direct and OTA bookings.' },
  { name: 'Superior Twin', base_price: 110, max_occupancy: 2, description: 'Two single beds, work desk and Nespresso machine. Popular with business travellers.' },
  { name: 'Deluxe Sea View', base_price: 165, max_occupancy: 2, description: 'King bed, private balcony facing the Atlantic, bathtub.' },
  { name: 'Family Suite', base_price: 240, max_occupancy: 4, description: 'Two bedrooms (king + bunk beds), living area and kitchenette.' },
];
const rooms = [
  ['101', 'Standard Double', 1, 'available'], ['102', 'Standard Double', 1, 'available'], ['103', 'Standard Double', 1, 'available'],
  ['104', 'Superior Twin', 1, 'available'], ['105', 'Superior Twin', 1, 'available'],
  ['201', 'Deluxe Sea View', 2, 'occupied'], ['202', 'Deluxe Sea View', 2, 'available'], ['203', 'Deluxe Sea View', 2, 'maintenance'],
  ['301', 'Family Suite', 3, 'occupied'], ['302', 'Family Suite', 3, 'available'],
];
const staff = [
  { first_name: 'Helena', last_name: 'Marques', email: 'helena.marques@hotel.example.com', phone: '+351 210 000 101', position: 'manager', hire_date: '2021-03-01', notes: 'General manager; approves rate changes and refunds.' },
  { first_name: 'Tiago', last_name: 'Ferreira', email: 'tiago.ferreira@hotel.example.com', phone: '+351 210 000 102', position: 'receptionist', hire_date: '2023-05-15', notes: 'Morning shift front desk.' },
  { first_name: 'Sofia', last_name: 'Almeida', email: 'sofia.almeida@hotel.example.com', phone: '+351 210 000 103', position: 'receptionist', hire_date: '2024-02-01', notes: 'Evening shift front desk; night audit on Fridays.' },
  { first_name: 'Rui', last_name: 'Costa', email: 'rui.costa@hotel.example.com', phone: '+351 210 000 104', position: 'housekeeper', hire_date: '2022-06-10', notes: 'Floors 1 and 2.' },
  { first_name: 'Miguel', last_name: 'Santos', email: 'miguel.santos@hotel.example.com', phone: '+351 210 000 105', position: 'maintenance', hire_date: '2020-09-01', notes: 'HVAC and plumbing.' },
];
const guests = [
  { first_name: 'Emma', last_name: 'Thompson', email: 'emma.thompson@example.com', phone: '+44 20 7946 0001', country: 'United Kingdom', notes: 'Returning guest; prefers a high floor.' },
  { first_name: 'Lukas', last_name: 'Becker', email: 'lukas.becker@example.com', phone: '+49 30 0000 0002', country: 'Germany' },
  { first_name: 'Anna', last_name: 'Becker', email: 'anna.becker@example.com', phone: '+49 30 0000 0003', country: 'Germany' },
  { first_name: 'Carlos', last_name: 'García', email: 'carlos.garcia@example.com', phone: '+34 91 000 0004', country: 'Spain', notes: 'Travelling with two children (ages 6 and 9).' },
  { first_name: 'Chloé', last_name: 'Martin', email: 'chloe.martin@example.com', phone: '+33 1 00 00 00 05', country: 'France' },
  { first_name: 'James', last_name: 'Walker', email: 'james.walker@example.com', phone: '+1 202 555 0106', country: 'United States', notes: 'Corporate traveller; invoice to company.' },
  { first_name: 'Sanne', last_name: 'de Vries', email: 'sanne.devries@example.com', phone: '+31 20 000 0007', country: 'Netherlands' },
  { first_name: 'Beatriz', last_name: 'Oliveira', email: 'beatriz.oliveira@example.com', phone: '+55 11 0000 0008', country: 'Brazil' },
];
const services = [
  { name: 'Breakfast buffet', price: 14, description: 'Per person per day, 07:00–10:30.' },
  { name: 'Airport transfer', price: 35, description: 'One way, up to 3 passengers with luggage.' },
  { name: 'Late check-out (14:00)', price: 25, description: 'Subject to availability on the day.' },
  { name: 'Spa day pass', price: 30, description: 'Pool, sauna and steam room, per person.' },
  { name: 'Parking', price: 12, description: 'Covered garage, per night.' },
  { name: 'Bike rental', price: 15, description: 'Per bike per day, helmet included.' },
];
// [number, status, channel, room|null, roomType, primary guest email, companions, adults, children, in, out, rate, requests]
const bookings = [
  ['BK-2026-0001', 'checked_out', 'direct', '101', 'Standard Double', 'emma.thompson@example.com', [], 1, 0, '2026-10-01', '2026-10-04', 95, 'Quiet room away from the lift.'],
  ['BK-2026-0002', 'checked_in', 'booking_com', '201', 'Deluxe Sea View', 'lukas.becker@example.com', ['anna.becker@example.com'], 2, 0, '2026-10-03', '2026-10-07', 165, 'Anniversary — bottle of wine on arrival.'],
  ['BK-2026-0003', 'checked_in', 'expedia', '301', 'Family Suite', 'carlos.garcia@example.com', [], 2, 2, '2026-10-04', '2026-10-08', 240, 'Extra cot not needed; bunk beds are fine.'],
  ['BK-2026-0004', 'reserved', 'airbnb', '104', 'Superior Twin', 'chloe.martin@example.com', [], 2, 0, '2026-10-10', '2026-10-13', 110, null],
  ['BK-2026-0005', 'reserved', 'direct', null, 'Deluxe Sea View', 'james.walker@example.com', [], 1, 0, '2026-10-20', '2026-10-23', 150, 'Corporate rate. Room to be assigned at check-in.'],
  ['BK-2026-0006', 'cancelled', 'booking_com', '201', 'Deluxe Sea View', 'sanne.devries@example.com', [], 2, 0, '2026-10-05', '2026-10-06', 165, 'Cancelled by guest via Booking.com (free cancellation window).'],
  ['BK-2026-0007', 'no_show', 'phone', '102', 'Standard Double', 'beatriz.oliveira@example.com', [], 1, 0, '2026-10-02', '2026-10-03', 95, 'Guaranteed by card; first night charged as no-show fee.'],
  ['BK-2026-0008', 'reserved', 'direct', '201', 'Deluxe Sea View', 'emma.thompson@example.com', [], 1, 0, '2026-10-07', '2026-10-09', 165, 'Back-to-back with BK-2026-0002 in the same room.'],
];
// [booking, service, qty, status, notes]
const orders = [
  ['BK-2026-0001', 'Late check-out (14:00)', 1, 'completed', null],
  ['BK-2026-0002', 'Breakfast buffet', 8, 'in_progress', '2 guests × 4 days'],
  ['BK-2026-0002', 'Spa day pass', 2, 'completed', null],
  ['BK-2026-0003', 'Airport transfer', 1, 'completed', 'Arrival LIS 13:40'],
  ['BK-2026-0003', 'Parking', 4, 'in_progress', null],
  ['BK-2026-0004', 'Bike rental', 2, 'pending', 'Requested via Airbnb message'],
];
// [number, booking, issue, due, status, payment date, method, notes]
const invoices = [
  ['INV-2026-0001', 'BK-2026-0001', '2026-10-04', '2026-10-04', 'paid', '2026-10-04', 'credit_card', 'Folio closed at check-out.'],
  ['INV-2026-0002', 'BK-2026-0002', '2026-10-03', '2026-10-07', 'pending', null, null, 'Open folio — settles at check-out. OTA commission handled by Booking.com.'],
  ['INV-2026-0003', 'BK-2026-0007', '2026-10-03', '2026-10-03', 'paid', '2026-10-03', 'credit_card', 'No-show fee: first night.'],
];
const maintenance = [
  ['203', 'emergency', 'Air conditioning not cooling; compressor fault suspected.', '2026-10-04T09:30:00', null, 'in_progress', 'miguel.santos@hotel.example.com', 180],
  ['102', 'scheduled', 'Deep clean and grout repair in shower.', '2026-10-03T10:00:00', '2026-10-03T16:00:00', 'completed', 'rui.costa@hotel.example.com', 40],
  ['302', 'regular', 'Replace bunk-bed mattress protectors.', '2026-10-12T10:00:00', null, 'scheduled', 'rui.costa@hotel.example.com', null],
];

const nights = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const serviceTotal = n => orders.filter(o => o[0] === n).reduce((s, o) => s + services.find(x => x.name === o[1]).price * o[2], 0);
const bookingTotal = b => nights(b[9], b[10]) * b[11];

if (MODE === '--remove') {
  const del = async (c, filter) => {
    const ids = (await call('GET', `/items/${c}?limit=-1&fields=id&filter=${encodeURIComponent(JSON.stringify(filter))}`)).map(x => x.id);
    if (ids.length) await call('DELETE', `/items/${c}`, ids);
    console.log(`- ${c}: ${ids.length}`);
  };
  const bn = bookings.map(b => b[0]);
  await del('invoices', { invoice_number: { _in: invoices.map(i => i[0]) } });
  await del('service_orders', { booking_id: { booking_number: { _in: bn } } });
  await del('room_maintenance', { room_id: { room_number: { _in: rooms.map(r => r[0]) } } });
  await del('bookings', { booking_number: { _in: bn } }); // booking_guests rows cascade
  await del('services', { name: { _in: services.map(s => s.name) } });
  await del('guests', { email: { _in: guests.map(g => g.email) } });
  await del('rooms', { room_number: { _in: rooms.map(r => r[0]) } });
  await del('room_types', { name: { _in: roomTypes.map(r => r.name) } });
  await del('staff', { email: { _in: staff.map(s => s.email) } });
  process.exit(0);
}

console.log(`${roomTypes.length} room types, ${rooms.length} rooms, ${staff.length} staff, ${guests.length} guests, ${services.length} services, ${bookings.length} bookings, ${orders.length} service orders, ${invoices.length} invoices, ${maintenance.length} maintenance records`);
for (const b of bookings) console.log(`  ${b[0]} ${b[1].padEnd(11)} ${b[2].padEnd(11)} room ${b[3] ?? '—'} ${b[9]}→${b[10]} ${nights(b[9], b[10])}n × ${b[11]} = ${bookingTotal(b)} + extras ${serviceTotal(b[0])}`);
if (MODE !== '--apply') { console.log('(dry run)'); process.exit(0); }

const existing = (await call('GET', '/items/bookings?aggregate[count]=*'))[0].count;
if (Number(existing) > 0) throw new Error(`bookings is not empty (${existing}); not seeding`);

const id = { type: {}, room: {}, staff: {}, guest: {}, service: {}, booking: {} };
for (const t of roomTypes) id.type[t.name] = (await create('room_types', t)).id;
for (const [n, t, floor, status] of rooms) id.room[n] = (await create('rooms', { room_number: n, room_type: id.type[t], floor, status })).id;
for (const s of staff) id.staff[s.email] = (await create('staff', { ...s, is_active: true })).id;
for (const g of guests) id.guest[g.email] = (await create('guests', g)).id;
for (const s of services) id.service[s.name] = (await create('services', { ...s, active: true })).id;
for (const b of bookings) {
  const [number, status, channel, room, type, primary, companions, adults, children, inD, outD, rate, requests] = b;
  id.booking[number] = (await create('bookings', {
    booking_number: number, status, channel, room_id: room ? id.room[room] : null, room_type: id.type[type],
    primary_guest: id.guest[primary], adults, children, check_in_date: `${inD}T15:00:00`, check_out_date: `${outD}T11:00:00`,
    nightly_rate: rate, total_amount: bookingTotal(b) + serviceTotal(number), special_requests: requests,
  })).id;
  for (const [i, email] of [primary, ...companions].entries()) await create('booking_guests', { booking_id: id.booking[number], guest_id: id.guest[email], sort: i + 1 });
}
for (const [bk, svc, quantity, status, notes] of orders) {
  const b = bookings.find(x => x[0] === bk);
  await create('service_orders', { booking_id: id.booking[bk], service_id: id.service[svc], quantity, unit_price: services.find(s => s.name === svc).price, status, notes, order_date: `${b[9]}T18:00:00` });
}
for (const [number, bk, issue, due, status, paid, method, notes] of invoices) {
  const b = bookings.find(x => x[0] === bk);
  const total = b[1] === 'no_show' ? b[11] : bookingTotal(b) + serviceTotal(bk);
  await create('invoices', { invoice_number: number, booking_id: id.booking[bk], issue_date: `${issue}T12:00:00`, due_date: `${due}T12:00:00`, total_amount: total, status, payment_date: paid && `${paid}T12:00:00`, payment_method: method, notes });
}
for (const [room, maintenance_type, description, scheduled, completed, status, who, cost] of maintenance)
  await create('room_maintenance', { room_id: id.room[room], maintenance_type, description, scheduled_date: scheduled, completed_date: completed, status, assigned_to: id.staff[who], cost });
console.log('seeded');

// The database must refuse a second *active* booking on room 201 overlapping BK-2026-0002.
try {
  const probe = await create('bookings', { booking_number: 'BK-OVERLAP-TEST', status: 'reserved', channel: 'expedia', room_id: id.room['201'], room_type: id.type['Deluxe Sea View'], primary_guest: id.guest['sanne.devries@example.com'], adults: 1, children: 0, check_in_date: '2026-10-05T15:00:00', check_out_date: '2026-10-06T11:00:00' });
  await call('DELETE', `/items/bookings/${probe.id}`);
  console.log('overlap check: FAILED — overlapping booking was accepted (removed again)');
} catch (e) {
  console.log(`overlap check: rejected as expected (HTTP ${e.status})`);
}

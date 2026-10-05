-- Database-level integrity for the Hotel & Bookings collections on nowos.
-- Run AFTER scripts/cms-hotel-schema.mjs (needs bookings.adults/children/nightly_rate/total_amount).
-- Safe to re-run: each constraint is dropped (if present) and re-added.
\set ON_ERROR_STOP on
BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_dates_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_dates_check
  CHECK (check_out_date > check_in_date);
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_occupancy_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_occupancy_check
  CHECK (adults >= 1 AND children >= 0);
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_amounts_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_amounts_check
  CHECK (coalesce(nightly_rate, 0) >= 0 AND coalesce(total_amount, 0) >= 0);

-- No two active bookings may overlap on the same room (check-out day is free for the next arrival).
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (room_id WITH =, tsrange(check_in_date, check_out_date, '[)') WITH &&)
  WHERE (room_id IS NOT NULL AND status NOT IN ('cancelled', 'no_show'));

ALTER TABLE service_orders DROP CONSTRAINT IF EXISTS service_orders_quantity_check;
ALTER TABLE service_orders ADD CONSTRAINT service_orders_quantity_check
  CHECK (quantity >= 1);
COMMIT;

-- Restore the booking_guests foreign keys (dropped by the relation PATCH in
-- cms-hotel-schema.mjs on 2026-10-05). Junction rows follow their booking/guest.
-- Safe to re-run: each constraint is dropped (if present) and re-added.
\set ON_ERROR_STOP on
BEGIN;
ALTER TABLE booking_guests DROP CONSTRAINT IF EXISTS booking_guests_booking_id_foreign;
ALTER TABLE booking_guests DROP CONSTRAINT IF EXISTS booking_guests_guest_id_foreign;
ALTER TABLE booking_guests
  ADD CONSTRAINT booking_guests_booking_id_foreign
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  ADD CONSTRAINT booking_guests_guest_id_foreign
    FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE;
COMMIT;

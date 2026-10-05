-- Database-level integrity for the PMS / channel manager / multi-tenant collections (hotel instance).
-- Run AFTER scripts/cms-hotel-pms-schema.mjs and the seed (the NOT NULLs need every row to have a property).
-- Safe to re-run: each constraint / index is dropped (if present) and re-added.
\set ON_ERROR_STOP on
BEGIN;

-- Multi-tenancy: numbering is unique per property, not globally.
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_number_unique;
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_property_room_number_unique;
ALTER TABLE rooms ADD CONSTRAINT rooms_property_room_number_unique UNIQUE (property, room_number);
ALTER TABLE room_types DROP CONSTRAINT IF EXISTS room_types_name_unique;
ALTER TABLE room_types DROP CONSTRAINT IF EXISTS room_types_property_name_unique;
ALTER TABLE room_types ADD CONSTRAINT room_types_property_name_unique UNIQUE (property, name);
ALTER TABLE rate_plans DROP CONSTRAINT IF EXISTS rate_plans_property_code_unique;
ALTER TABLE rate_plans ADD CONSTRAINT rate_plans_property_code_unique UNIQUE (property, code);
ALTER TABLE cancellation_policies DROP CONSTRAINT IF EXISTS cancellation_policies_property_code_unique;
ALTER TABLE cancellation_policies ADD CONSTRAINT cancellation_policies_property_code_unique UNIQUE (property, code);

-- Every operational row belongs to exactly one tenant.
ALTER TABLE room_types            ALTER COLUMN property SET NOT NULL;
ALTER TABLE rooms                 ALTER COLUMN property SET NOT NULL;
ALTER TABLE bookings              ALTER COLUMN property SET NOT NULL;
ALTER TABLE services              ALTER COLUMN property SET NOT NULL;
ALTER TABLE staff                 ALTER COLUMN property SET NOT NULL;
ALTER TABLE rate_plans            ALTER COLUMN property SET NOT NULL;
ALTER TABLE cancellation_policies ALTER COLUMN property SET NOT NULL;
ALTER TABLE rates                 ALTER COLUMN property SET NOT NULL;
ALTER TABLE availability          ALTER COLUMN property SET NOT NULL;
ALTER TABLE channel_connections   ALTER COLUMN property SET NOT NULL;
ALTER TABLE night_audits          ALTER COLUMN property SET NOT NULL;
ALTER TABLE properties            ALTER COLUMN brand    SET NOT NULL;

-- Required links (a missing parent is always a bug, never a valid state).
ALTER TABLE channel_connections ALTER COLUMN channel    SET NOT NULL;
ALTER TABLE channel_mappings    ALTER COLUMN connection SET NOT NULL;
ALTER TABLE channel_mappings    ALTER COLUMN room_type  SET NOT NULL;
ALTER TABLE channel_mappings    ALTER COLUMN rate_plan  SET NOT NULL;
ALTER TABLE channel_sync_log    ALTER COLUMN connection SET NOT NULL;
ALTER TABLE rates               ALTER COLUMN room_type  SET NOT NULL;
ALTER TABLE rates               ALTER COLUMN rate_plan  SET NOT NULL;
ALTER TABLE availability        ALTER COLUMN room_type  SET NOT NULL;
ALTER TABLE invoice_lines       ALTER COLUMN invoice    SET NOT NULL;
ALTER TABLE payments            ALTER COLUMN booking    SET NOT NULL;
ALTER TABLE housekeeping_tasks  ALTER COLUMN room       SET NOT NULL;

-- ARI: one price per room type × rate plan × day, one inventory row per room type × day.
ALTER TABLE rates DROP CONSTRAINT IF EXISTS rates_room_type_rate_plan_date_unique;
ALTER TABLE rates ADD CONSTRAINT rates_room_type_rate_plan_date_unique UNIQUE (room_type, rate_plan, date);
ALTER TABLE rates DROP CONSTRAINT IF EXISTS rates_price_check;
ALTER TABLE rates ADD CONSTRAINT rates_price_check CHECK (price >= 0 AND coalesce(min_stay, 1) >= 1);
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_room_type_date_unique;
ALTER TABLE availability ADD CONSTRAINT availability_room_type_date_unique UNIQUE (room_type, date);
ALTER TABLE availability DROP CONSTRAINT IF EXISTS availability_counts_check;
ALTER TABLE availability ADD CONSTRAINT availability_counts_check
  CHECK (total_rooms >= 0 AND booked >= 0 AND out_of_order >= 0 AND available >= 0
         AND available = total_rooms - booked - out_of_order);

-- Channel manager: one connection per property × channel, unambiguous mappings,
-- and an OTA reservation can exist only once per channel (idempotent re-deliveries).
ALTER TABLE channel_connections DROP CONSTRAINT IF EXISTS channel_connections_property_channel_unique;
ALTER TABLE channel_connections ADD CONSTRAINT channel_connections_property_channel_unique UNIQUE (property, channel);
ALTER TABLE channel_mappings DROP CONSTRAINT IF EXISTS channel_mappings_internal_unique;
ALTER TABLE channel_mappings ADD CONSTRAINT channel_mappings_internal_unique UNIQUE (connection, room_type, rate_plan);
ALTER TABLE channel_mappings DROP CONSTRAINT IF EXISTS channel_mappings_external_unique;
ALTER TABLE channel_mappings ADD CONSTRAINT channel_mappings_external_unique UNIQUE (connection, external_room_code, external_rate_code);
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_channel_external_reference_unique;
ALTER TABLE bookings ADD CONSTRAINT bookings_channel_external_reference_unique UNIQUE (channel_id, external_reference);

-- Night audit: one business date per property; KPIs within range.
ALTER TABLE night_audits DROP CONSTRAINT IF EXISTS night_audits_property_business_date_unique;
ALTER TABLE night_audits ADD CONSTRAINT night_audits_property_business_date_unique UNIQUE (property, business_date);
ALTER TABLE night_audits DROP CONSTRAINT IF EXISTS night_audits_kpi_check;
ALTER TABLE night_audits ADD CONSTRAINT night_audits_kpi_check
  CHECK (coalesce(occupancy_percent, 0) BETWEEN 0 AND 100 AND coalesce(rooms_occupied, 0) <= coalesce(rooms_available, rooms_occupied, 0));

-- Folio & payments.
ALTER TABLE invoice_lines DROP CONSTRAINT IF EXISTS invoice_lines_amount_check;
ALTER TABLE invoice_lines ADD CONSTRAINT invoice_lines_amount_check
  CHECK (unit_price IS NULL OR quantity IS NULL OR amount = round(quantity * unit_price, 2));
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_amount_check;
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);

-- Indexes for the date-range queries the booking engine and channel sync run all day.
DROP INDEX IF EXISTS bookings_property_stay_idx;
CREATE INDEX bookings_property_stay_idx ON bookings (property, check_in_date, check_out_date);
DROP INDEX IF EXISTS rates_property_date_idx;
CREATE INDEX rates_property_date_idx ON rates (property, date);
DROP INDEX IF EXISTS availability_property_date_idx;
CREATE INDEX availability_property_date_idx ON availability (property, date);
DROP INDEX IF EXISTS channel_sync_log_connection_received_idx;
CREATE INDEX channel_sync_log_connection_received_idx ON channel_sync_log (connection, received_at DESC);

COMMIT;

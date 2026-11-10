-- Guest profile fields + bookings. Additive only (existing users/sessions rows are untouched).
ALTER TABLE users
  ADD COLUMN country             text,
  ADD COLUMN address_line1       text,
  ADD COLUMN address_line2       text,
  ADD COLUMN city                text,
  ADD COLUMN state               text,
  ADD COLUMN postcode            text,
  ADD COLUMN preferences         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN marketing_opt_in    boolean NOT NULL DEFAULT false,
  ADD COLUMN marketing_opt_in_at timestamptz;

CREATE TABLE bookings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference               text NOT NULL UNIQUE CHECK (reference ~ '^(HDH|TM|BK)-[A-HJ-NP-Z2-9]{6}$'),
  user_id                 uuid REFERENCES users(id) ON DELETE SET NULL,   -- NULL = anonymised (deleted account)
  client_request_id       uuid,
  room_id                 text NOT NULL,            -- 'deluxe' | 'super-deluxe' (validated in app, not CHECK: rooms will change)
  room_name               text NOT NULL,            -- snapshot
  room_count              integer NOT NULL CHECK (room_count BETWEEN 1 AND 5),
  check_in                date NOT NULL,
  check_out               date NOT NULL,
  nights                  integer NOT NULL CHECK (nights BETWEEN 1 AND 30),
  adults                  integer NOT NULL CHECK (adults >= 1),
  children                integer NOT NULL DEFAULT 0 CHECK (children BETWEEN 0 AND 10),
  extra_bed               boolean NOT NULL DEFAULT false,
  special_requests        text CHECK (char_length(special_requests) <= 500),
  rate_per_night          integer NOT NULL CHECK (rate_per_night > 0),   -- snapshot, whole rupees
  total_amount            integer NOT NULL CHECK (total_amount >= 0),    -- server-computed, excludes taxes and extra bed
  currency                text NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  payment_status          text NOT NULL DEFAULT 'pay_at_hotel' CHECK (payment_status IN ('unpaid','pay_at_hotel','paid','refunded')),
  status                  text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  cancelled_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  external_hms_booking_id text,   -- HMS seam: set by admin PATCH today, by the future HMS sync later
  external_pos_folio_id   text,   -- POS seam
  CHECK (check_out > check_in),
  CHECK (nights = check_out - check_in),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE INDEX bookings_user_checkin_idx   ON bookings (user_id, check_in DESC);
CREATE INDEX bookings_user_created_idx   ON bookings (user_id, created_at DESC);
CREATE INDEX bookings_status_checkin_idx ON bookings (status, check_in);
CREATE INDEX bookings_created_idx        ON bookings (created_at DESC);
CREATE UNIQUE INDEX bookings_user_request_key ON bookings (user_id, client_request_id) WHERE client_request_id IS NOT NULL;
CREATE UNIQUE INDEX bookings_ext_hms_key ON bookings (external_hms_booking_id) WHERE external_hms_booking_id IS NOT NULL;
CREATE UNIQUE INDEX bookings_ext_pos_key ON bookings (external_pos_folio_id)   WHERE external_pos_folio_id   IS NOT NULL;

-- Manual rollback (there are no automatic down migrations; also delete the 0002 row from schema_migrations):
--   DROP TABLE bookings;
--   ALTER TABLE users DROP COLUMN country, DROP COLUMN address_line1, DROP COLUMN address_line2, DROP COLUMN city,
--     DROP COLUMN state, DROP COLUMN postcode, DROP COLUMN preferences, DROP COLUMN marketing_opt_in,
--     DROP COLUMN marketing_opt_in_at;

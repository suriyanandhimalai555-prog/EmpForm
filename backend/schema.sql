-- ============================================================
--  Customer Entry Form – PostgreSQL Schema
--  Run once to initialize. Safe to re-run (IF NOT EXISTS).
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_entries (
  id                      SERIAL PRIMARY KEY,

  -- Core fields
  serial_number           TEXT UNIQUE,
  entry_date              DATE          NOT NULL,
  branch_name             TEXT          NOT NULL,
  customer_name           TEXT          NOT NULL,
  phone_number            TEXT          NOT NULL,
  amount_paid             NUMERIC(12,2) NOT NULL,
  payment_mode            TEXT          NOT NULL
                            CHECK (payment_mode IN ('Cash', 'Bank', 'GPay')),
  transaction_details     TEXT,
  scheme_type             TEXT          NOT NULL,

  -- Referred By
  referred_by             TEXT,
  referred_by_emp_id      TEXT,

  -- Higher Official
  higher_official         TEXT,
  higher_official_emp_id  TEXT,

  notes                   TEXT,

  -- Land Scheme specific (NULL when scheme_type != 'LAND')
  land_kind_of_payment    TEXT  CHECK (land_kind_of_payment IN ('Advance', 'Full')),
  land_site_name          TEXT,
  land_site_number        TEXT,
  land_layout             TEXT,

  -- Gold / Jewel Savings specific
  gold_package            TEXT  CHECK (gold_package IN ('Single', 'Full')),

  -- Metadata
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Safely add new columns if upgrading an existing table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='referred_by_emp_id'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN referred_by_emp_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='higher_official_emp_id'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN higher_official_emp_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='land_site_number'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN land_site_number TEXT;
  END IF;

  -- Add unique constraint to serial_number if not already present
  -- This is tricky in PG if it's already there, but we can add a named constraint
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name='customer_entries' AND constraint_name='customer_entries_serial_number_key'
  ) THEN
    BEGIN
      ALTER TABLE customer_entries ADD CONSTRAINT customer_entries_serial_number_key UNIQUE (serial_number);
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not add unique constraint to serial_number, possibly due to duplicate data.';
    END;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ce_branch_date  ON customer_entries (branch_name, entry_date);
CREATE INDEX IF NOT EXISTS idx_ce_scheme       ON customer_entries (scheme_type);
CREATE INDEX IF NOT EXISTS idx_ce_created_at   ON customer_entries (created_at DESC);

-- Branch Users
CREATE TABLE IF NOT EXISTS branch_users (
  id              SERIAL PRIMARY KEY,
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  branch_name     TEXT NOT NULL
);

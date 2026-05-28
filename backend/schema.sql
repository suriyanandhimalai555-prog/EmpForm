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
                            CHECK (payment_mode IN ('Cash', 'Bank', 'GPay', 'Cash+Bank')),
  transaction_details     TEXT,
  scheme_type             TEXT          NOT NULL,

  -- Referred By
  referred_by             TEXT,
  referred_by_emp_id      TEXT,
  referred_by_role        TEXT,

  -- Higher Official
  higher_official         TEXT,
  higher_official_emp_id  TEXT,
  higher_official_role    TEXT,

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
    WHERE table_name='customer_entries' AND column_name='referred_by_role'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN referred_by_role TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='higher_official_emp_id'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN higher_official_emp_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='higher_official_role'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN higher_official_role TEXT;
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

-- ── Serial number: per-branch-per-day uniqueness ─────────────────────────────
-- Migrate from global UNIQUE(serial_number) → composite UNIQUE(branch,date,serial)
DO $$
BEGIN
  -- Drop old global unique constraint if present
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'customer_entries'
      AND constraint_name = 'customer_entries_serial_number_key'
      AND constraint_type = 'UNIQUE'
  ) THEN
    ALTER TABLE customer_entries DROP CONSTRAINT customer_entries_serial_number_key;
  END IF;

  -- Add composite unique constraint (branch + date + serial)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'customer_entries'
      AND constraint_name = 'uq_ce_branch_date_serial'
  ) THEN
    ALTER TABLE customer_entries
      ADD CONSTRAINT uq_ce_branch_date_serial
      UNIQUE (branch_name, entry_date, serial_number);
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
  branch_name     TEXT NOT NULL,
  role            TEXT NOT NULL DEFAULT 'branch'
                    CHECK (role IN ('branch', 'md', 'management'))
);

-- Safely add role column if upgrading an existing table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='branch_users' AND column_name='role'
  ) THEN
    ALTER TABLE branch_users ADD COLUMN role TEXT NOT NULL DEFAULT 'branch'
      CHECK (role IN ('branch', 'md', 'management'));
  END IF;
END $$;

-- Migrate existing ALL-branch users to md role (idempotent)
UPDATE branch_users SET role = 'md' WHERE UPPER(branch_name) = 'ALL' AND role = 'branch';

-- Add updated_at column to customer_entries for edit audit trail
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='updated_at'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN updated_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add proof_url for S3-stored payment proof attachments (GPay / Bank)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='proof_url'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN proof_url TEXT;
  END IF;
END $$;

-- Add gold_quantity for Gold Coin Savings (max 15) and Jewel Savings (max 19) Single packages
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='gold_quantity'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN gold_quantity INTEGER;
  END IF;
END $$;

-- Add cash_amount + bank_amount for split "Cash+Bank" payments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='cash_amount'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN cash_amount NUMERIC(12,2);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='customer_entries' AND column_name='bank_amount'
  ) THEN
    ALTER TABLE customer_entries ADD COLUMN bank_amount NUMERIC(12,2);
  END IF;
END $$;

-- Extend payment_mode CHECK to allow 'Cash+Bank'
DO $$
DECLARE
  conname text;
BEGIN
  SELECT con.conname INTO conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
   WHERE rel.relname = 'customer_entries'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%payment_mode%';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE customer_entries DROP CONSTRAINT %I', conname);
  END IF;
  ALTER TABLE customer_entries
    ADD CONSTRAINT customer_entries_payment_mode_check
    CHECK (payment_mode IN ('Cash', 'Bank', 'GPay', 'Cash+Bank'));
END $$;

#!/usr/bin/env node
/**
 * Create the Follow Up account.
 *
 * Usage:
 *   node scripts/seed-followup.js
 *
 * Creates: followup@avgprimetech.com / Followup@2026
 * Role: followup  (read-only dashboard — shows which branches haven't submitted)
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    // Expand the role check constraint to include 'followup'
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE branch_users DROP CONSTRAINT IF EXISTS branch_users_role_check;
        ALTER TABLE branch_users ADD CONSTRAINT branch_users_role_check
          CHECK (role IN ('branch', 'md', 'management', 'followup'));
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not update role constraint: %', SQLERRM;
      END $$;
    `);

    const email    = "followup@avgprimetech.com";
    const password = "Followup@2026";
    const hash     = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO branch_users (email, password_hash, branch_name, role)
       VALUES ($1, $2, 'FOLLOWUP', 'followup')
       ON CONFLICT (email) DO UPDATE SET role = 'followup', password_hash = $2`,
      [email, hash]
    );

    console.log("Follow Up account created:");
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Branch:   FOLLOWUP`);
    console.log(`  Role:     followup`);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

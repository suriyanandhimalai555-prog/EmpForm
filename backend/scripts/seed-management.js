#!/usr/bin/env node
/**
 * Create or promote the management account.
 *
 * Usage:
 *   node scripts/seed-management.js
 *
 * - If an ALL-branch user already exists, it gets role='management'
 * - Otherwise creates: management@avgprimetech.com / Management@2026
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
    // First: ensure the role column exists
    await pool.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name='branch_users' AND column_name='role'
        ) THEN
          ALTER TABLE branch_users ADD COLUMN role TEXT NOT NULL DEFAULT 'branch'
            CHECK (role IN ('branch', 'md', 'management'));
        END IF;
      END $$;
    `);

    // Check if a management user already exists
    const existing = await pool.query(
      "SELECT id, email FROM branch_users WHERE role = 'management'"
    );
    if (existing.rowCount > 0) {
      console.log("Management user already exists:", existing.rows.map(r => r.email).join(", "));
      await pool.end();
      return;
    }

    // Create new management account
    const email = "management@avgprimetech.com";
    const password = "Management@2026";
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
      "INSERT INTO branch_users (email, password_hash, branch_name, role) VALUES ($1, $2, 'ALL', 'management') ON CONFLICT (email) DO UPDATE SET role = 'management'",
      [email, hash]
    );

    console.log(`Management account created:`);
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`  Branch:   ALL`);
    console.log(`  Role:     management`);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

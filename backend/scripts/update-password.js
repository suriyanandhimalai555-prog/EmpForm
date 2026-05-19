#!/usr/bin/env node
/**
 * Update a branch user's password.
 *
 * Usage:
 *   node scripts/update-password.js <email> <new-password>
 *
 * Example:
 *   node scripts/update-password.js panruti@gmail.com Panruti@2026
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error("Usage: node scripts/update-password.js <email> <new-password>");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

(async () => {
  try {
    const newHash = await bcrypt.hash(newPassword, 10);
    const res = await pool.query(
      "UPDATE branch_users SET password_hash = $1 WHERE email = $2 RETURNING id, email, branch_name",
      [newHash, email]
    );

    if (res.rowCount === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const user = res.rows[0];
    console.log(`Password updated for ${user.email} (branch: ${user.branch_name})`);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

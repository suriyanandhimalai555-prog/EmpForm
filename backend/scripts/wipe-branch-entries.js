#!/usr/bin/env node
/**
 * Permanently delete all customer_entries for a specific branch.
 *
 * Usage:
 *   node scripts/wipe-branch-entries.js <BRANCH_NAME>
 *
 * Example:
 *   node scripts/wipe-branch-entries.js VEPPUR
 *
 * - Branch name is case-insensitive (VEPPUR, veppur, Veppur all work)
 * - Prints a count of rows that will be deleted and requires you to type
 *   the branch name again to confirm before anything is touched
 * - Does NOT delete the branch user account, only the entry records
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const readline = require("readline");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const branch = (process.argv[2] || "").trim().toUpperCase();

if (!branch) {
  console.error("Usage: node scripts/wipe-branch-entries.js <BRANCH_NAME>");
  process.exit(1);
}

(async () => {
  try {
    // Count rows first so the operator knows what they're about to delete
    const { rows } = await pool.query(
      "SELECT COUNT(*) AS cnt FROM customer_entries WHERE UPPER(branch_name) = $1",
      [branch]
    );
    const count = parseInt(rows[0].cnt);

    if (count === 0) {
      console.log(`No entries found for branch "${branch}". Nothing to delete.`);
      await pool.end();
      return;
    }

    console.log(`\n⚠️  WARNING: This will permanently delete ${count} entry/entries for branch "${branch}".`);
    console.log("This action cannot be undone.\n");

    // Require the operator to type the branch name to confirm
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`Type the branch name to confirm ("${branch}"): `, async (answer) => {
      rl.close();

      if (answer.trim().toUpperCase() !== branch) {
        console.log("Branch name did not match. Aborting — no data was deleted.");
        await pool.end();
        return;
      }

      const result = await pool.query(
        "DELETE FROM customer_entries WHERE UPPER(branch_name) = $1",
        [branch]
      );
      console.log(`\n✅  Deleted ${result.rowCount} entry/entries for branch "${branch}".`);
      await pool.end();
    });
  } catch (err) {
    console.error("Error:", err.message);
    await pool.end();
    process.exit(1);
  }
})();

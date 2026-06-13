#!/usr/bin/env node
/**
 * reseed-hierarchy-2026.js
 * Non-destructive one-time script to bring director / GM branch lists in line
 * with the revised Agila Vetri Groups org chart (June 2026).
 *
 * What this script does:
 *   1. Updates the role-check DB constraint to cover all existing roles (incl. gm).
 *   2. Updates branch lists for all 9 Directors (passwords untouched).
 *   3. Updates branch lists for 29 existing GM logins (passwords untouched).
 *      - 24 unchanged-name GMs
 *      - 5 confirmed same-person renames (old login kept, new branches applied)
 *   4. Inserts 2 brand-new GM accounts (new hires).
 *   5. Neutralises 2 departed GM accounts (branch list → []).
 *   6. Reports flagged items: neutralised accounts, unassigned branches.
 *
 * What this script does NOT do:
 *   - Does not delete any account.
 *   - Does not touch customer_entries, branch accounts, or any other table.
 *   - Does not change any password.
 *
 * Safe to re-run (idempotent).
 *
 * Usage:  node scripts/reseed-hierarchy-2026.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ── Hierarchy data ────────────────────────────────────────────────────────────
// All branch names use the canonical spellings from App.jsx / the live DB.

const DIRECTORS = [
  {
    email: "thirupathi.director@avgprimetech.com",
    name:  "M. THIRUPATHI",
    branches: [
      "ULUNDURPET", "SANKARAPURAM",
      "PERAMBALUR", "ARIYALUR", "MELMALAIYANUR",
      "MANDYA", "GOWRIBIDANUR", "BELLARY",
    ],
  },
  {
    email: "subramaniyan.director@avgprimetech.com",
    name:  "P. SUBRAMANIYAN",
    branches: [
      "VILLUPURAM", "DEVANUR",
      "KARAIKAL", "NEYVELI",
      "THIRUPATHI", "CHITTOOR",
      "KANDACHIPURAM", "GINGEE",
    ],
  },
  {
    email: "kamaraj.director@avgprimetech.com",
    name:  "A. KAMARAJ",
    branches: [
      "OTTACHATHIRAM", "UDUMALPET",
      "VEPPUR", "VIRUTHACHALAM",
      "NELLORE", "ONGOLE", "GUDUR",
    ],
  },
  {
    email: "muthusamy.director@avgprimetech.com",
    name:  "A. MUTHUSAMY",
    branches: [
      "TIRUVANNAMALAI", "THENMATHIMANGALAM",
      "POLUR", "AARANI",
      "ANEKAL", "ATTIBELE", "MYSORE",
    ],
  },
  {
    email: "cperumal.director@avgprimetech.com",
    name:  "C. PERUMAL",
    branches: [
      "KALLAKURICHI", "THIRUKOVILUR",
      "THANDARAMPATTU", "CHENGAM", "MOONGIL THURAIPATTU",
      "PUTTUR", "ELURU", "VIJAYAWADA",
    ],
  },
  {
    email: "krishnasamy.director@avgprimetech.com",
    name:  "S. KRISHNASAMY",
    branches: [
      "TINDIVANAM", "ANDIMADAM", "THITAKUDI",
      "CUDDALORE", "PANRUTI",
      "SURYAPET", "MIRIYALAGUDA", "NALGONDA",
    ],
  },
  {
    email: "amurugan.director@avgprimetech.com",
    name:  "A. MURUGAN",
    branches: [
      "ARIYANKUPPAM", "VILLIANUR",
      "THIRUKKANUR", "NETTAPAKKAM",
      "RANIPET", "THIRUTHANI",
      "NAIDUPETA", "SULLURPET", "KALAHASTHI",
    ],
  },
  {
    email: "umamageshwari.director@avgprimetech.com",
    name:  "D. UMAMAHESHWARI",
    branches: [
      "DHARAPURAM", "DINDIGUL",
      "PALANI", "TIRUPUR",
      "THALAIVASAL", "ATTUR",
      "AVALURPET", "JAMUNAMARATHUR", "KANIYAMBADI",
    ],
  },
  {
    email: "vinothkumar.director@avgprimetech.com",
    name:  "S. VINOTHKUMAR",
    branches: [
      "PAPPREDY PATTI", "DHARMAPURI", "PALACODE",
      "UTHANGARAI", "HARUR",
      "BANGARUPALAYAM", "PALAMANER", "V KOTA",
      "KRISHNAGIRI", "THIRUPATHUR",
    ],
  },
];

// GMs whose existing login is kept and branches are simply updated.
// Includes:
//   - 24 unchanged-name GMs (same name → same email → same login)
//   - 5 confirmed same-person renames (old email kept, new branches applied)
//     marked with [note] comments below.
const GM_UPDATES = [
  // ── THIRUPATHI's GMs ────────────────────────────────────────────────────────
  { email: "p.ramesh.gm@avgprimetech.com",       branches: ["ULUNDURPET", "SANKARAPURAM"] },
  { email: "mohan.gm@avgprimetech.com",           branches: ["PERAMBALUR", "ARIYALUR", "MELMALAIYANUR"] },
  { email: "sundaravel.gm@avgprimetech.com",      branches: ["MANDYA", "GOWRIBIDANUR", "BELLARY"] },

  // ── SUBRAMANIYAN's GMs ──────────────────────────────────────────────────────
  { email: "rajalakshmi.gm@avgprimetech.com",     branches: ["VILLUPURAM", "DEVANUR"] },
  { email: "prabhu.gm@avgprimetech.com",          branches: ["KARAIKAL", "NEYVELI"] },
  { email: "ramesh.kumar.gm@avgprimetech.com",    branches: ["KANDACHIPURAM", "GINGEE"] },

  // ── KAMARAJ's GMs ───────────────────────────────────────────────────────────
  { email: "elumalai.gm@avgprimetech.com",        branches: ["OTTACHATHIRAM", "UDUMALPET"] },
  { email: "gomathi.gm@avgprimetech.com",         branches: ["VEPPUR", "VIRUTHACHALAM"] },
  { email: "hazarth.gm@avgprimetech.com",         branches: ["NELLORE", "ONGOLE", "GUDUR"] },

  // ── MUTHUSAMY's GMs ─────────────────────────────────────────────────────────
  { email: "siva.gm@avgprimetech.com",            branches: ["TIRUVANNAMALAI", "THENMATHIMANGALAM"] },
  { email: "kavitha.gm@avgprimetech.com",         branches: ["POLUR", "AARANI"] },
  // RAMESH → same person as RAMESH KARNATAKA (user-confirmed)
  { email: "ramesh.gm@avgprimetech.com",          branches: ["ANEKAL", "ATTIBELE", "MYSORE"] },

  // ── C PERUMAL's GMs ─────────────────────────────────────────────────────────
  { email: "antony.sagayaraj.gm@avgprimetech.com", branches: ["KALLAKURICHI", "THIRUKOVILUR"] },
  // VENKATESAN → same person as VENKATESH (user-confirmed)
  { email: "venkatesan.gm@avgprimetech.com",      branches: ["THANDARAMPATTU", "CHENGAM", "MOONGIL THURAIPATTU"] },

  // ── S KRISHNASAMY's GMs ─────────────────────────────────────────────────────
  { email: "sivaraman.gm@avgprimetech.com",       branches: ["TINDIVANAM", "ANDIMADAM", "THITAKUDI"] },
  { email: "murthy.gm@avgprimetech.com",          branches: ["CUDDALORE", "PANRUTI"] },
  // VENKATRAMANA → same person as VENKATRAMAIAH (user-confirmed)
  { email: "venkatramana.gm@avgprimetech.com",    branches: ["SURYAPET", "MIRIYALAGUDA", "NALGONDA"] },

  // ── A MURUGAN's GMs ─────────────────────────────────────────────────────────
  { email: "sathya.gm@avgprimetech.com",          branches: ["ARIYANKUPPAM", "VILLIANUR"] },
  { email: "sivasakthi.gm@avgprimetech.com",      branches: ["THIRUKKANUR", "NETTAPAKKAM"] },
  // YASHODA → same person as YASODHA (user-confirmed)
  { email: "yashoda.gm@avgprimetech.com",         branches: ["RANIPET", "THIRUTHANI"] },
  { email: "vani.gm@avgprimetech.com",            branches: ["NAIDUPETA", "SULLURPET", "KALAHASTHI"] },

  // ── D UMAMAHESHWARI's GMs ───────────────────────────────────────────────────
  { email: "sameetha.banu.gm@avgprimetech.com",   branches: ["DHARAPURAM", "DINDIGUL"] },
  { email: "velmurugan.gm@avgprimetech.com",      branches: ["PALANI", "TIRUPUR"] },
  // SARGUNAM → same person as SURGUNAM (user-confirmed)
  { email: "sargunam.gm@avgprimetech.com",        branches: ["THALAIVASAL", "ATTUR"] },
  { email: "sarathy.gm@avgprimetech.com",         branches: ["AVALURPET", "JAMUNAMARATHUR", "KANIYAMBADI"] },

  // ── S VINOTHKUMAR's GMs ─────────────────────────────────────────────────────
  { email: "sudha.gm@avgprimetech.com",           branches: ["PAPPREDY PATTI", "DHARMAPURI", "PALACODE"] },
  { email: "malligasri.gm@avgprimetech.com",      branches: ["UTHANGARAI", "HARUR"] },
  { email: "sivakumar.gm@avgprimetech.com",       branches: ["BANGARUPALAYAM", "PALAMANER", "V KOTA"] },
  { email: "lakshmanan.gm@avgprimetech.com",      branches: ["KRISHNAGIRI", "THIRUPATHUR"] },
];

// New hire GMs — full INSERT (email + hashed password derived from name).
const GM_NEW_HIRES = [
  // VIJAYASHANTHI — under SUBRAMANIYAN
  { name: "VIJAYASHANTHI", branches: ["THIRUPATHI", "CHITTOOR"] },
  // Y DINESH — under C PERUMAL
  { name: "Y DINESH",      branches: ["PUTTUR", "ELURU", "VIJAYAWADA"] },
];

// Departed GMs — neutralised (branch list → []).  Account row is NOT deleted.
const GM_DEPARTED_EMAILS = [
  "sunitha.gm@avgprimetech.com",       // previously: THIRUPATHI, PUTTUR, BANGARUPALAYAM
  "ramachandran.gm@avgprimetech.com",  // previously: TIRUVANNAMALAI, AARANI
];

// Branches dropped from hierarchy (no director/GM assigned in new org chart).
// Their customer_entries rows are untouched; they are flagged for manual review.
const UNASSIGNED_BRANCHES = ["TIRUCHI", "KODAD", "HASAN"];

// ── Helpers (mirror seed-gms.js logic) ───────────────────────────────────────
const emailFor = (name) =>
  name.trim().toLowerCase().replace(/\s+/g, ".") + ".gm@avgprimetech.com";

const passwordFor = (name) => {
  const s = name.replace(/\s+/g, "");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() + "@2026";
};

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  try {
    // 1. Fix the role-check constraint once so running directors or GMs in any
    //    order doesn't accidentally drop a valid role value.
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE branch_users DROP CONSTRAINT IF EXISTS branch_users_role_check;
        ALTER TABLE branch_users ADD CONSTRAINT branch_users_role_check
          CHECK (role IN ('branch', 'md', 'management', 'followup', 'director', 'gm'));
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not update role constraint: %', SQLERRM;
      END $$;
    `);
    console.log("✅  Role constraint refreshed (branch/md/management/followup/director/gm)");

    // ── 2. Update Directors ───────────────────────────────────────────────────
    console.log("\n─── Updating Directors ────────────────────────────────────────");
    let dirUpdated = 0;
    let dirMissed  = 0;
    for (const { email, name, branches } of DIRECTORS) {
      const result = await pool.query(
        `UPDATE branch_users SET branch_name = $1 WHERE email = $2 AND role = 'director'`,
        [JSON.stringify(branches), email]
      );
      if (result.rowCount > 0) {
        console.log(`  ✅  ${name} (${email})`);
        console.log(`       Branches: ${branches.join(", ")}`);
        dirUpdated++;
      } else {
        console.warn(`  ⚠️  NOT FOUND: ${email} — row missing or role not 'director'`);
        dirMissed++;
      }
    }
    console.log(`\n  → ${dirUpdated} directors updated, ${dirMissed} not found.`);

    // ── 3. Update existing GM branch lists ────────────────────────────────────
    console.log("\n─── Updating existing GMs ─────────────────────────────────────");
    let gmUpdated = 0;
    let gmMissed  = 0;
    for (const { email, branches } of GM_UPDATES) {
      const result = await pool.query(
        `UPDATE branch_users SET branch_name = $1 WHERE email = $2 AND role = 'gm'`,
        [JSON.stringify(branches), email]
      );
      if (result.rowCount > 0) {
        console.log(`  ✅  ${email} → ${branches.join(", ")}`);
        gmUpdated++;
      } else {
        console.warn(`  ⚠️  NOT FOUND: ${email} — row missing or role not 'gm'`);
        gmMissed++;
      }
    }
    console.log(`\n  → ${gmUpdated} GM branch lists updated, ${gmMissed} not found.`);

    // ── 4. Insert new-hire GMs ────────────────────────────────────────────────
    console.log("\n─── Inserting new-hire GMs ────────────────────────────────────");
    const newCredentials = [];
    for (const { name, branches } of GM_NEW_HIRES) {
      const email    = emailFor(name);
      const password = passwordFor(name);
      const hash     = await bcrypt.hash(password, 10);

      const result = await pool.query(
        `INSERT INTO branch_users (email, password_hash, branch_name, role)
         VALUES ($1, $2, $3, 'gm')
         ON CONFLICT (email) DO UPDATE SET branch_name = $3, role = 'gm'`,
        [email, hash, JSON.stringify(branches)]
      );
      const action = result.command === "INSERT" ? "INSERTED" : "UPSERTED (already existed)";
      console.log(`  ✅  ${action}: ${name} — ${email}`);
      newCredentials.push({ name, email, password, branches: branches.join(", ") });
    }

    // ── 5. Neutralise departed GMs ────────────────────────────────────────────
    console.log("\n─── Neutralising departed GMs ─────────────────────────────────");
    const neutralised = [];
    for (const email of GM_DEPARTED_EMAILS) {
      const result = await pool.query(
        `UPDATE branch_users SET branch_name = $1 WHERE email = $2 AND role = 'gm'`,
        [JSON.stringify([]), email]
      );
      if (result.rowCount > 0) {
        console.log(`  ✅  Neutralised (branch list cleared): ${email}`);
        neutralised.push(email);
      } else {
        console.warn(`  ⚠️  NOT FOUND: ${email} — already removed or role changed`);
      }
    }

    // ── Summary ───────────────────────────────────────────────────────────────
    if (newCredentials.length > 0) {
      console.log("\n════════════════════════════════════════════════════════════");
      console.log("  NEW-HIRE GM CREDENTIALS  (share securely)");
      console.log("════════════════════════════════════════════════════════════");
      newCredentials.forEach((c, i) => {
        console.log(`\n  ${i + 1}. ${c.name}`);
        console.log(`     Email   : ${c.email}`);
        console.log(`     Password: ${c.password}`);
        console.log(`     Branches: ${c.branches}`);
      });
    }

    console.log("\n════════════════════════════════════════════════════════════");
    console.log("  ⚠️  FLAGGED FOR REVIEW");
    console.log("════════════════════════════════════════════════════════════");
    if (neutralised.length > 0) {
      console.log("\n  Neutralised accounts (can still log in, but see no data):");
      neutralised.forEach(e => console.log(`    - ${e}`));
      console.log("  Action: reassign or deactivate via the Management → Assignments UI.");
    }
    if (UNASSIGNED_BRANCHES.length > 0) {
      console.log("\n  Branches not assigned to any Director/GM in this hierarchy:");
      UNASSIGNED_BRANCHES.forEach(b => console.log(`    - ${b}`));
      console.log("  Action: if these branches have entries, assign them via the Assignments UI.");
    }

    console.log("\n🎉  Reseed complete. Verify by logging in as a spot-checked GM/Director.");
  } catch (err) {
    console.error("\n❌  Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

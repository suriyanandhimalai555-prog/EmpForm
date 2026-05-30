#!/usr/bin/env node
/**
 * Create GM (General Manager) accounts. GMs sit below Directors and can only see
 * entries from their assigned branches — same branch-list filtering as directors.
 *
 * Email   : "<name with dots>.gm@avgprimetech.com" (login derives the display name)
 * Password: "<Namewithoutspaces>@2026"
 *
 * Branch names below MUST match the canonical names stored in the system; four were
 * corrected from the request so the GM actually sees data:
 *   OTTANCHATHIRAM  -> OTTACHATHIRAM
 *   VILLIYANUR      -> VILLIANUR
 *   PAPPIREDDY PATTI-> PAPPREDY PATTI
 *   MIRYALAGUDA     -> MIRIYALAGUDA
 *
 * Usage:  node scripts/seed-gms.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// GM display name → branches they oversee (canonical branch spellings)
const GMS = [
  { name: "P RAMESH",         branches: ["KALLAKURICHI", "THIRUKOVILUR"] },
  { name: "SIVA",             branches: ["THANDARAMPATTU", "CHENGAM", "MOONGIL THURAIPATTU"] },
  { name: "SIVAKUMAR",        branches: ["ONGOLE", "ELURU", "VIJAYAWADA"] },
  { name: "ELUMALAI",         branches: ["TIRUCHI", "UDUMALPET", "OTTACHATHIRAM"] },
  { name: "GOMATHI",          branches: ["VEPPUR", "VIRUTHACHALAM"] },
  { name: "HAZARTH",          branches: ["NAIDUPETA", "CHITTOOR", "GUDUR"] },
  { name: "SIVASAKTHI",       branches: ["VILLIANUR", "ARIYANKUPPAM"] },
  { name: "SATHYA",           branches: ["THIRUKKANUR", "NETTAPAKKAM"] },
  { name: "SARATHY",          branches: ["JAMUNAMARATHUR", "RANIPET", "THIRUTHANI", "KANIYAMBADI"] },
  { name: "VANI",             branches: ["NELLORE", "SULLURPET", "KALAHASTHI"] },
  { name: "RAJALAKSHMI",      branches: ["VILLUPURAM", "DEVANUR"] },
  { name: "PRABHU",           branches: ["NEYVELI", "KARAIKAL"] },
  { name: "SUNITHA",          branches: ["THIRUPATHI", "PUTTUR", "BANGARUPALAYAM"] },
  { name: "RAMESH KUMAR",     branches: ["KANDACHIPURAM", "GINGEE"] },
  { name: "VENKATESAN",       branches: ["ULUNDURPET", "SANKARAPURAM"] },
  { name: "SARGUNAM",         branches: ["PERAMBALUR", "ARIYALUR"] },
  { name: "SUNDARAVEL",       branches: ["MANDYA", "BELLARY", "GOWRIBIDANUR"] },
  { name: "RAMACHANDRAN",     branches: ["TIRUVANNAMALAI", "AARANI"] },
  { name: "KAVITHA",          branches: ["POLUR", "THENMATHIMANGALAM"] },
  { name: "RAMESH",           branches: ["ANEKAL", "ATTIBELE", "MYSORE"] },
  { name: "SUDHA",            branches: ["PALACODE", "DHARMAPURI", "PAPPREDY PATTI"] },
  { name: "MALLIGASRI",       branches: ["UTHANGARAI", "KRISHNAGIRI"] },
  { name: "YASHODA",          branches: ["PALAMANER", "V KOTA"] },
  { name: "LAKSHMANAN",       branches: ["THIRUPATHUR", "HARUR"] },
  { name: "VELMURUGAN",       branches: ["PALANI", "DINDIGUL"] },
  { name: "SAMEETHA BANU",    branches: ["DHARAPURAM", "TIRUPUR"] },
  { name: "ANTONY SAGAYARAJ", branches: ["ATTUR", "THALAIVASAL"] },
  { name: "MOHAN",            branches: ["AVALURPET", "MELMALAIYANUR"] },
  { name: "SIVARAMAN",        branches: ["THITAKUDI", "TINDIVANAM", "ANDIMADAM"] },
  { name: "MURTHY",           branches: ["PANRUTI", "CUDDALORE"] },
  { name: "VENKATRAMANA",     branches: ["SURYAPET", "KODAD", "NALGONDA", "MIRIYALAGUDA"] },
];

const emailFor = (name) => name.trim().toLowerCase().replace(/\s+/g, ".") + ".gm@avgprimetech.com";
const passwordFor = (name) => {
  const s = name.replace(/\s+/g, "");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() + "@2026";
};

(async () => {
  try {
    // Expand role check constraint to include 'gm'
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE branch_users DROP CONSTRAINT IF EXISTS branch_users_role_check;
        ALTER TABLE branch_users ADD CONSTRAINT branch_users_role_check
          CHECK (role IN ('branch', 'md', 'management', 'followup', 'director', 'gm'));
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not update role constraint: %', SQLERRM;
      END $$;
    `);
    console.log("✅  Role constraint updated to include 'gm'");

    const credentials = [];
    for (const { name, branches } of GMS) {
      const email = emailFor(name);
      const password = passwordFor(name);
      const hash = await bcrypt.hash(password, 10);
      const branchNameValue = JSON.stringify(branches); // branches as JSON array, like directors

      await pool.query(
        `INSERT INTO branch_users (email, password_hash, branch_name, role)
         VALUES ($1, $2, $3, 'gm')
         ON CONFLICT (email) DO UPDATE SET password_hash = $2, branch_name = $3, role = 'gm'`,
        [email, hash, branchNameValue]
      );

      credentials.push({ name, email, password, branches: branches.join(", ") });
    }

    console.log("\n========== GM CREDENTIALS ==========");
    credentials.forEach((c, i) => {
      console.log(`\n${i + 1}. GM: ${c.name}`);
      console.log(`   Email:    ${c.email}`);
      console.log(`   Password: ${c.password}`);
      console.log(`   Branches: ${c.branches}`);
    });
    console.log(`\n🎉  All ${credentials.length} GMs seeded successfully!`);
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

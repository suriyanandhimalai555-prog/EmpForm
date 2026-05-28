#!/usr/bin/env node
/**
 * Create Director accounts.
 * Each director can only see entries from their assigned branches.
 *
 * Usage:
 *   node scripts/seed-directors.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Director name → email, password, branches they oversee
const DIRECTORS = [
  {
    name: "C PERUMAL",
    email: "cperumal.director@avgprimetech.com",
    password: "Cperumal@2026",
    branches: ["KALLAKURICHI", "THIRUKOVILUR", "THANDARAMPATTU", "CHENGAM", "MOONGIL THURAIPATTU", "ONGOLE", "ELURU", "VIJAYAWADA"],
  },
  {
    name: "KAMARAJ",
    email: "kamaraj.director@avgprimetech.com",
    password: "Kamaraj@2026",
    branches: ["TIRUCHI", "UDUMALPET", "OTTACHATHIRAM", "VEPPUR", "VIRUTHACHALAM", "NAIDUPETA", "CHITTOOR", "GUDUR"],
  },
  {
    name: "A MURUGAN",
    email: "amurugan.director@avgprimetech.com",
    password: "Amurugan@2026",
    branches: ["VILLIANUR", "ARIYANKUPPAM", "THIRUKKANUR", "NETTAPAKKAM", "JAMUNAMARATHUR", "RANIPET", "THIRUTHANI", "KANIYAMBADI", "NELLORE", "SULLURPET", "KALAHASTHI"],
  },
  {
    name: "SUBRAMANIYAN",
    email: "subramaniyan.director@avgprimetech.com",
    password: "Subramaniyan@2026",
    branches: ["VILLUPURAM", "DEVANUR", "NEYVELI", "KARAIKAL", "THIRUPATHI", "PUTTUR", "BANGARUPALAYAM", "KANDACHIPURAM", "GINGEE"],
  },
  {
    name: "THIRUPATHI",
    email: "thirupathi.director@avgprimetech.com",
    password: "Thirupathi@2026",
    branches: ["ULUNDURPET", "SANKARAPURAM", "PERAMBALUR", "ARIYALUR", "MANDYA", "BELLARY", "GOWRIBIDANUR"],
  },
  {
    name: "MUTHUSAMY",
    email: "muthusamy.director@avgprimetech.com",
    password: "Muthusamy@2026",
    branches: ["TIRUVANNAMALAI", "AARANI", "POLUR", "THENMATHIMANGALAM", "ANEKAL", "ATTIBELE", "MYSORE"],
  },
  {
    name: "VINOTHKUMAR",
    email: "vinothkumar.director@avgprimetech.com",
    password: "Vinothkumar@2026",
    branches: ["PALACODE", "DHARMAPURI", "PAPPREDY PATTI", "UTHANGARAI", "KRISHNAGIRI", "PALAMANER", "V KOTA", "THIRUPATHUR", "HARUR"],
  },
  {
    name: "D UMAMAGESHWARI",
    email: "umamageshwari.director@avgprimetech.com",
    password: "Umamageshwari@2026",
    branches: ["PALANI", "DINDIGUL", "DHARAPURAM", "TIRUPUR", "ATTUR", "THALAIVASAL", "AVALURPET", "MELMALAIYANUR"],
  },
  {
    name: "S KRISHNASAMY",
    email: "krishnasamy.director@avgprimetech.com",
    password: "Krishnasamy@2026",
    branches: ["THITAKUDI", "TINDIVANAM", "ANDIMADAM", "PANRUTI", "CUDDALORE", "SURYAPET", "KODAD", "NALGONDA", "MIRIYALAGUDA"],
  },
];

(async () => {
  try {
    // Expand role check constraint to include 'director'
    await pool.query(`
      DO $$ BEGIN
        ALTER TABLE branch_users DROP CONSTRAINT IF EXISTS branch_users_role_check;
        ALTER TABLE branch_users ADD CONSTRAINT branch_users_role_check
          CHECK (role IN ('branch', 'md', 'management', 'followup', 'director'));
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not update role constraint: %', SQLERRM;
      END $$;
    `);
    console.log("✅  Role constraint updated to include 'director'");

    for (const { name, email, password, branches } of DIRECTORS) {
      const hash = await bcrypt.hash(password, 10);
      // Store branches as JSON array in branch_name for directors
      const branchNameValue = JSON.stringify(branches);

      await pool.query(
        `INSERT INTO branch_users (email, password_hash, branch_name, role)
         VALUES ($1, $2, $3, 'director')
         ON CONFLICT (email) DO UPDATE SET password_hash = $2, branch_name = $3, role = 'director'`,
        [email, hash, branchNameValue]
      );

      console.log(`\n✅  Director created: ${name}`);
      console.log(`   Email:    ${email}`);
      console.log(`   Password: ${password}`);
      console.log(`   Branches: ${branches.join(", ")}`);
    }

    console.log("\n🎉  All directors seeded successfully!");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();

require("dotenv").config();
const { Pool } = require("pg");

// Load the DB connection directly from .env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Railway
});

async function wipeEntries() {
  try {
    console.log("Connecting to Database to wipe data...");
    
    // TRUNCATE empties the table and resets the state. 
    // Restart identity resets any auto-incrementing IDs back to 1.
    await pool.query("TRUNCATE TABLE customer_entries RESTART IDENTITY CASCADE");
    
    console.log("✅ Successfully wiped all records from `customer_entries`!");
    console.log("   (IDs have been reset to 1)");
  } catch (err) {
    console.error("❌ Error wiping entries:", err.message);
  } finally {
    pool.end();
  }
}

wipeEntries();

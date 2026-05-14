/**
 * server.js – EMP Customer Entry Form Backend
 * Stack : Node.js + Express + pg (node-postgres) → Railway PostgreSQL
 */

require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const { Pool }  = require("pg");
const fs        = require("fs");
const path      = require("path");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "super-secure-prime-secret-2026";

// ── PostgreSQL pool ───────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 50 // Allows up to 50 concurrent database connections
});

pool.connect()
  .then((c) => { console.log("✅  Connected to PostgreSQL (Railway)"); c.release(); })
  .catch((err) => { console.error("❌  DB connection failed:", err.message); process.exit(1); });

// ── Schema bootstrap ──────────────────────────────────────────────────────────
async function initSchema() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  try {
    await pool.query(sql);
    console.log("✅  Schema applied");
    
    // Seeding logic removed - users and MD are already populated in DB.
  } catch (err) {
    console.error("❌  Schema error:", err.message);
    process.exit(1);
  }
}

// ── Express ───────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "https://empform.avgprimetech.com"
];

console.log(`🔒 CORS: Allowing only specific origins:`, allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Explicitly handle preflight requests

app.use(express.json());

// ── Validation ────────────────────────────────────────────────────────────────
function validateEntry(body) {
  const required = ["entry_date","branch_name","customer_name","phone_number","amount_paid","payment_mode","scheme_type"];
  const missing  = required.filter((k) => !body[k] && body[k] !== 0);
  if (missing.length) return `Missing required fields: ${missing.join(", ")}`;
  if (!["Cash","Bank","GPay"].includes(body.payment_mode))
    return "payment_mode must be one of: Cash, Bank, GPay";
  return null;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, error: "Missing email or password" });
  
  try {
    const { rows } = await pool.query("SELECT * FROM branch_users WHERE email = $1", [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, error: "Invalid email or password" });
    
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, error: "Invalid email or password" });
    
    const token = jwt.sign({ id: user.id, branch: user.branch_name, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ success: true, token, branch: user.branch_name, email: user.email });
  } catch(e) {
    console.error("Login error:", e.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST /api/change-password
app.post("/api/change-password", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  if (!email || !currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: "Missing fields" });
  }

  try {
    const { rows } = await pool.query("SELECT * FROM branch_users WHERE email = $1", [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, error: "Invalid email or current password" });
    
    const user = rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) return res.status(401).json({ success: false, error: "Invalid email or current password" });
    
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE branch_users SET password_hash = $1 WHERE id = $2", [newHash, user.id]);
    
    return res.json({ success: true, message: "Password updated successfully" });
  } catch (e) {
    console.error("Change password error:", e.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST /api/entries
app.post("/api/entries", async (req, res) => {
  const err = validateEntry(req.body);
  if (err) return res.status(400).json({ success: false, error: err });

  const {
    serial_number, entry_date, branch_name, customer_name,
    phone_number, amount_paid, payment_mode, transaction_details,
    scheme_type,
    referred_by, referred_by_emp_id, referred_by_role,
    higher_official, higher_official_emp_id, higher_official_role,
    notes,
    land_kind_of_payment, land_site_name, land_site_number, land_layout,
    gold_package,
  } = req.body;

  const sql = `
    INSERT INTO customer_entries (
      serial_number, entry_date, branch_name, customer_name,
      phone_number, amount_paid, payment_mode, transaction_details,
      scheme_type,
      referred_by, referred_by_emp_id, referred_by_role,
      higher_official, higher_official_emp_id, higher_official_role,
      notes,
      land_kind_of_payment, land_site_name, land_site_number, land_layout,
      gold_package
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
    ) RETURNING id`;

  try {
    const result = await pool.query(sql, [
      serial_number || null, entry_date, branch_name, customer_name,
      phone_number, Number(amount_paid), payment_mode, transaction_details || null,
      scheme_type,
      referred_by || null, referred_by_emp_id || null, referred_by_role || null,
      higher_official || null, higher_official_emp_id || null, higher_official_role || null,
      notes || null,
      land_kind_of_payment || null, land_site_name || null, land_site_number || null, land_layout || null,
      gold_package || null,
    ]);
    return res.status(201).json({ success: true, message: "Entry saved successfully", id: result.rows[0].id });
  } catch (e) {
    if (e.code === '23505') { // PostgreSQL unique violation code
      return res.status(400).json({ success: false, error: "An entry with this S.No already exists. Please use a unique S.No." });
    }
    console.error("DB insert error:", e.message);
    return res.status(500).json({ success: false, error: "Database error" });
  }
});

// GET /api/entries
app.get("/api/entries", async (req, res) => {
  const { branch, filterBranch, scheme, date_from, date_to } = req.query;
  const conditions = ["1=1"];
  const params = [];

  if (branch && branch !== 'ALL') {
    params.push(branch);
    conditions.push(`branch_name = $${params.length}`);
  } else if (branch === 'ALL' && filterBranch) {
    params.push(filterBranch);
    conditions.push(`branch_name = $${params.length}`);
  }

  if (scheme)    { params.push(scheme);    conditions.push(`scheme_type = $${params.length}`); }
  if (date_from) { params.push(date_from); conditions.push(`entry_date >= $${params.length}`); }
  if (date_to)   { params.push(date_to);   conditions.push(`entry_date <= $${params.length}`); }

  const sql = `SELECT * FROM customer_entries WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC`;
  try {
    const result = await pool.query(sql, params);
    return res.json({ success: true, count: result.rowCount, data: result.rows });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Database error" });
  }
});

// GET /api/entries/:id
app.get("/api/entries/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM customer_entries WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: "Not found" });
    return res.json({ success: true, data: result.rows[0] });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Database error" });
  }
});

// DELETE /api/entries/:id
app.delete("/api/entries/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM customer_entries WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: "Not found" });
    return res.json({ success: true, message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Database error" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// ── Boot ──────────────────────────────────────────────────────────────────────
initSchema().then(() => {
  const server = app.listen(PORT, () =>
    console.log(`🚀  Backend running → http://localhost:${PORT}`)
  );
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`❌  Port ${PORT} is already in use. Kill the old process or set PORT= in .env`);
      process.exit(1);
    }
  });
});

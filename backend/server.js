/**
 * server.js – EMP Customer Entry Form Backend
 * Stack : Node.js + Express + pg (node-postgres) → Railway PostgreSQL
 */

require("dotenv").config();

const express   = require("express");
const cors      = require("cors");
const { Pool, types }  = require("pg");
types.setTypeParser(1082, val => val); // Return DATE as raw "YYYY-MM-DD" string (prevents timezone shift)
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
  "https://empform.avgprimetech.com",
  "http://localhost:5173",
  "http://localhost:5174"
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
  const entryYear = new Date(body.entry_date).getFullYear();
  if (entryYear < 2024 || entryYear > 2100)
    return "entry_date year must be between 2024 and 2100";
  return null;
}

// ── Auth Middleware ───────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ success: false, error: "Authentication required" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, error: "Invalid or expired token" });
  }
}

function requireManagement(req, res, next) {
  if (req.user.role !== "management") {
    return res.status(403).json({ success: false, error: "Management access required" });
  }
  next();
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
    
    const role = user.role || 'branch';
    const token = jwt.sign({ id: user.id, branch: user.branch_name.toUpperCase(), email: user.email, role }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ success: true, token, branch: user.branch_name.toUpperCase(), email: user.email, role });
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
    entry_date, branch_name, customer_name,
    phone_number, amount_paid, payment_mode, transaction_details,
    scheme_type,
    referred_by, referred_by_emp_id, referred_by_role,
    higher_official, higher_official_emp_id, higher_official_role,
    notes,
    land_kind_of_payment, land_site_name, land_site_number, land_layout,
    gold_package,
  } = req.body;

  const normalizedBranch = branch_name ? branch_name.toUpperCase() : branch_name;

  const insertSql = `
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Advisory lock scoped to (branch, entry_date) — serial number is based
    // on the form's entry_date so each date has its own sequence.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [`${normalizedBranch}:${entry_date}`]
    );

    // Serial number counts entries for the same branch + entry_date,
    // so viewing by form date shows unique serial numbers.
    const { rows: snRows } = await client.query(
      `SELECT COALESCE(MAX(
         CASE WHEN serial_number ~ '^[0-9]+$' THEN serial_number::integer ELSE 0 END
       ), 0) + 1 AS next_sn
       FROM customer_entries
       WHERE branch_name = $1 AND entry_date = $2`,
      [normalizedBranch, entry_date]
    );
    const nextSerial = String(snRows[0].next_sn);

    const result = await client.query(insertSql, [
      nextSerial, entry_date, normalizedBranch, customer_name,
      phone_number, Number(amount_paid), payment_mode, transaction_details || null,
      scheme_type,
      referred_by || null, referred_by_emp_id || null, referred_by_role || null,
      higher_official || null, higher_official_emp_id || null, higher_official_role || null,
      notes || null,
      land_kind_of_payment || null, land_site_name || null, land_site_number || null, land_layout || null,
      gold_package || null,
    ]);

    await client.query("COMMIT");
    return res.status(201).json({
      success: true,
      message: "Entry saved successfully",
      id: result.rows[0].id,
      serial_number: nextSerial,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("DB insert error:", e.message);
    return res.status(500).json({ success: false, error: "Database error" });
  } finally {
    client.release();
  }
});

// GET /api/entries
app.get("/api/entries", async (req, res) => {
  const { branch, filterBranch, scheme, date_from, date_to } = req.query;
  const conditions = ["1=1"];
  const params = [];

  if (branch && branch !== 'ALL') {
    params.push(branch.toUpperCase());
    conditions.push(`UPPER(branch_name) = $${params.length}`);
  } else if (branch === 'ALL' && filterBranch) {
    params.push(filterBranch.toUpperCase());
    conditions.push(`UPPER(branch_name) = $${params.length}`);
  }

  if (scheme)    { params.push(scheme);    conditions.push(`scheme_type = $${params.length}`); }
  if (date_from) { params.push(date_from); conditions.push(`entry_date >= $${params.length}`); }
  if (date_to)   { params.push(date_to);   conditions.push(`entry_date <= $${params.length}`); }

  const sql = `SELECT * FROM customer_entries WHERE ${conditions.join(" AND ")} ORDER BY entry_date ASC, branch_name ASC, (CASE WHEN serial_number ~ '^[0-9]+$' THEN serial_number::integer ELSE 0 END) ASC, created_at ASC`;
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

// DELETE /api/entries/:id (management only)
app.delete("/api/entries/:id", authenticateToken, requireManagement, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM customer_entries WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: "Not found" });
    return res.json({ success: true, message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Database error" });
  }
});

// PUT /api/entries/:id (management only)
app.put("/api/entries/:id", authenticateToken, requireManagement, async (req, res) => {
  const entryId = req.params.id;
  const err = validateEntry(req.body);
  if (err) return res.status(400).json({ success: false, error: err });

  const {
    entry_date, branch_name, customer_name,
    phone_number, amount_paid, payment_mode, transaction_details,
    scheme_type,
    referred_by, referred_by_emp_id, referred_by_role,
    higher_official, higher_official_emp_id, higher_official_role,
    notes,
    land_kind_of_payment, land_site_name, land_site_number, land_layout,
    gold_package,
  } = req.body;

  const normalizedBranch = branch_name ? branch_name.toUpperCase() : branch_name;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Fetch current entry to check if branch or date changed
    const { rows: current } = await client.query(
      "SELECT branch_name, entry_date, serial_number FROM customer_entries WHERE id = $1",
      [entryId]
    );
    if (current.length === 0) {
      await client.query("ROLLBACK");
      client.release();
      return res.status(404).json({ success: false, error: "Entry not found" });
    }

    const old = current[0];
    const branchChanged = old.branch_name !== normalizedBranch;
    const dateChanged   = String(old.entry_date).slice(0,10) !== String(entry_date).slice(0,10);
    let serialNumber    = old.serial_number;

    // If branch or date changed, reassign serial number for the new branch+date
    if (branchChanged || dateChanged) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [`${normalizedBranch}:${entry_date}`]
      );
      const { rows: snRows } = await client.query(
        `SELECT COALESCE(MAX(
           CASE WHEN serial_number ~ '^[0-9]+$' THEN serial_number::integer ELSE 0 END
         ), 0) + 1 AS next_sn
         FROM customer_entries
         WHERE branch_name = $1 AND entry_date = $2 AND id != $3`,
        [normalizedBranch, entry_date, entryId]
      );
      serialNumber = String(snRows[0].next_sn);
    }

    await client.query(
      `UPDATE customer_entries SET
        serial_number=$1, entry_date=$2, branch_name=$3, customer_name=$4,
        phone_number=$5, amount_paid=$6, payment_mode=$7, transaction_details=$8,
        scheme_type=$9,
        referred_by=$10, referred_by_emp_id=$11, referred_by_role=$12,
        higher_official=$13, higher_official_emp_id=$14, higher_official_role=$15,
        notes=$16,
        land_kind_of_payment=$17, land_site_name=$18, land_site_number=$19, land_layout=$20,
        gold_package=$21, updated_at=NOW()
      WHERE id=$22`,
      [
        serialNumber, entry_date, normalizedBranch, customer_name,
        phone_number, Number(amount_paid), payment_mode, transaction_details || null,
        scheme_type,
        referred_by || null, referred_by_emp_id || null, referred_by_role || null,
        higher_official || null, higher_official_emp_id || null, higher_official_role || null,
        notes || null,
        land_kind_of_payment || null, land_site_name || null, land_site_number || null, land_layout || null,
        gold_package || null,
        entryId,
      ]
    );

    await client.query("COMMIT");
    return res.json({ success: true, message: "Entry updated successfully" });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("DB update error:", e.message);
    return res.status(500).json({ success: false, error: "Database error" });
  } finally {
    client.release();
  }
});

// GET /api/users (management only)
app.get("/api/users", authenticateToken, requireManagement, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, branch_name, role FROM branch_users ORDER BY branch_name ASC"
    );
    return res.json({ success: true, data: result.rows });
  } catch (e) {
    console.error("Fetch users error:", e.message);
    return res.status(500).json({ success: false, error: "Database error" });
  }
});

// POST /api/admin/reset-password (management only)
app.post("/api/admin/reset-password", authenticateToken, requireManagement, async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) {
    return res.status(400).json({ success: false, error: "Missing userId or newPassword" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: "Password must be at least 6 characters" });
  }

  try {
    const newHash = await bcrypt.hash(newPassword, 10);
    const result = await pool.query(
      "UPDATE branch_users SET password_hash = $1 WHERE id = $2 RETURNING id, email, branch_name",
      [newHash, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: "User not found" });
    return res.json({ success: true, message: `Password reset for ${result.rows[0].email}` });
  } catch (e) {
    console.error("Admin reset password error:", e.message);
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

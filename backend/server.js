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
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const { createPresignedPost }        = require("@aws-sdk/s3-presigned-post");
const { getSignedUrl }               = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 }                 = require("uuid");

const JWT_SECRET = process.env.JWT_SECRET || "super-secure-prime-secret-2026";

// ── S3 client ────────────────────────────────────────────────────────────────
const AWS_REGION  = process.env.AWS_REGION  || "ap-south-1";
const S3_BUCKET   = process.env.S3_BUCKET   || "empform-bucket";
const s3 = new S3Client({ region: AWS_REGION });

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
  const ALL_MODES = ["Cash", "Bank", "GPay", "Cash+Bank"];
  if (!ALL_MODES.includes(body.payment_mode))
    return "payment_mode must be one of: " + ALL_MODES.join(", ");
  if (body.payment_mode === "Cash+Bank") {
    const cash  = Number(body.cash_amount);
    const bank  = Number(body.bank_amount);
    const total = Number(body.amount_paid);
    if (!(cash > 0) || !(bank > 0))
      return "Cash+Bank requires both cash_amount and bank_amount > 0";
    if (Math.abs((cash + bank) - total) > 0.01)
      return "amount_paid must equal cash_amount + bank_amount";
  }
  const entryYear = new Date(body.entry_date).getFullYear();
  if (entryYear < 2024 || entryYear > 2100)
    return "entry_date year must be between 2024 and 2100";
  if (body.gold_quantity !== undefined && body.gold_quantity !== null && body.gold_quantity !== "") {
    const qty = parseInt(body.gold_quantity);
    if (isNaN(qty) || qty < 1) return "gold_quantity must be a positive number";
    if (body.scheme_type === "GOLD COIN SAVINGS" && qty > 15) return "gold_quantity cannot exceed 15 for Gold Coin Savings";
    if (body.scheme_type === "JEWEL SAVINGS"     && qty > 19) return "gold_quantity cannot exceed 19 for Jewel Savings";
  }
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
    return res.status(401).json({ success: false, error: "Invalid or expired token" });
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
    // Case-insensitive, whitespace-tolerant email match so login never depends on how it's typed.
    const { rows } = await pool.query("SELECT * FROM branch_users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
    if (rows.length === 0) return res.status(401).json({ success: false, error: "Invalid email or password" });
    
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ success: false, error: "Invalid email or password" });
    
    const role = user.role || 'branch';
    // For directors: branch_name stores a JSON array of branches
    let branchValue = user.branch_name.toUpperCase();
    let directorBranches = null;
    if (role === 'director') {
      try {
        directorBranches = JSON.parse(user.branch_name); // array of branch strings
        branchValue = 'DIRECTOR';
      } catch (e) {
        directorBranches = [user.branch_name.toUpperCase()];
      }
    }
    const token = jwt.sign({ id: user.id, branch: branchValue, email: user.email, role, directorBranches }, JWT_SECRET, { expiresIn: '12d' });
    // Derive readable director name from email (e.g. "cperumal.director@..." → "C PERUMAL")
    const directorName = role === 'director'
      ? user.email.split('@')[0].replace('.director', '').replace(/\./g, ' ').toUpperCase()
      : undefined;
    return res.json({ success: true, token, branch: branchValue, email: user.email, role, directorBranches, ...(directorName ? { directorName } : {}) });
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
    const { rows } = await pool.query("SELECT * FROM branch_users WHERE LOWER(email) = LOWER($1)", [email.trim()]);
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
    gold_package, gold_quantity,
    proof_url, cash_amount, bank_amount,
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
      gold_package, gold_quantity, proof_url, cash_amount, bank_amount
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25
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
      gold_package || null, (gold_quantity !== undefined && gold_quantity !== "" ? parseInt(gold_quantity) : null), proof_url || null,
      payment_mode === "Cash+Bank" ? Number(cash_amount) : null,
      payment_mode === "Cash+Bank" ? Number(bank_amount) : null,
    ]);

    // If branch had marked "no collections" for this entry's date, clear it — a submitted entry proves otherwise
    await client.query(
      "DELETE FROM branch_no_collection_days WHERE branch_name=$1 AND marked_date=$2",
      [normalizedBranch, entry_date]
    );

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
  const { branch, filterBranch, scheme, date_from, date_to, directorBranches, page, pageSize } = req.query;

  // Build branch + date filters for one table. `dateCol` is the column that the
  // date range applies to (entry_date for real entries, marked_date for no-collection
  // days). Placeholders are numbered starting at `startIdx + 1`. includeScheme adds the
  // scheme filter (only customer_entries has a scheme).
  const buildFilter = (startIdx, dateCol, includeScheme) => {
    const conditions = ["1=1"];
    const params = [];
    const p = (v) => { params.push(v); return `$${startIdx + params.length}`; };
    if (directorBranches) {
      const branchList = directorBranches.split(',').map(b => b.trim().toUpperCase()).filter(Boolean);
      const filterBranchUpper = filterBranch ? filterBranch.toUpperCase() : null;
      if (filterBranchUpper && branchList.includes(filterBranchUpper)) {
        conditions.push(`UPPER(branch_name) = ${p(filterBranchUpper)}`);
      } else {
        const placeholders = branchList.map(b => p(b)).join(', ');
        conditions.push(`UPPER(branch_name) IN (${placeholders})`);
      }
    } else if (branch && branch !== 'ALL') {
      conditions.push(`UPPER(branch_name) = ${p(branch.toUpperCase())}`);
    } else if (branch === 'ALL' && filterBranch) {
      conditions.push(`UPPER(branch_name) = ${p(filterBranch.toUpperCase())}`);
    }
    if (includeScheme && scheme) conditions.push(`scheme_type = ${p(scheme)}`);
    if (date_from) conditions.push(`${dateCol} >= ${p(date_from)}`);
    if (date_to)   conditions.push(`${dateCol} <= ${p(date_to)}`);
    return { clause: conditions.join(" AND "), params };
  };

  // No-collection rows are excluded when a scheme filter is active (they have no scheme).
  const includeNc = !scheme;

  const entriesFilter = buildFilter(0, "entry_date", true);
  const ncFilter = includeNc ? buildFilter(entriesFilter.params.length, "marked_date", false) : null;
  const allParams = ncFilter ? [...entriesFilter.params, ...ncFilter.params] : [...entriesFilter.params];

  // Synthetic no-collection rows are merged with real entries via UNION ALL.
  // to_jsonb(ce) keeps the merge robust to schema changes (no column enumeration).
  const ncUnion = ncFilter ? `
      UNION ALL
      SELECT jsonb_build_object(
               'id', 'nc-' || branch_name || '-' || marked_date,
               'entry_date', marked_date,
               'branch_name', branch_name,
               'customer_name', 'NO COLLECTIONS',
               'is_no_collection', true
             ) AS j, marked_date AS sort_date, 0 AS sn, branch_name AS sort_branch, marked_at AS sort_created
      FROM branch_no_collection_days WHERE ${ncFilter.clause}` : "";

  const mergedCTE = `
    WITH merged AS (
      SELECT to_jsonb(ce) AS j, ce.entry_date AS sort_date,
             (CASE WHEN ce.serial_number ~ '^[0-9]+$' THEN ce.serial_number::integer ELSE 0 END) AS sn,
             ce.branch_name AS sort_branch, ce.created_at AS sort_created
      FROM customer_entries ce WHERE ${entriesFilter.clause}${ncUnion}
    )`;
  const orderClause = `ORDER BY sort_date ASC, sort_branch ASC, sn ASC, sort_created ASC`;

  // Combined total = entries matching + no-collection days matching
  const countSql = `SELECT (SELECT COUNT(*) FROM customer_entries WHERE ${entriesFilter.clause})`
    + (ncFilter ? ` + (SELECT COUNT(*) FROM branch_no_collection_days WHERE ${ncFilter.clause})` : "")
    + ` AS total`;

  try {
    // Server-side pagination when page & pageSize are provided
    if (page && pageSize) {
      const pg = Math.max(1, parseInt(page));
      const ps = Math.max(1, Math.min(200, parseInt(pageSize)));
      const offset = (pg - 1) * ps;

      const countResult = await pool.query(countSql, allParams);
      const totalCount = parseInt(countResult.rows[0].total);

      const paginatedParams = [...allParams, ps, offset];
      const sql = `${mergedCTE} SELECT j FROM merged ${orderClause} LIMIT $${paginatedParams.length - 1} OFFSET $${paginatedParams.length}`;
      const result = await pool.query(sql, paginatedParams);

      return res.json({
        success: true,
        data: result.rows.map(r => r.j),
        count: result.rowCount,
        totalCount,
        page: pg,
        pageSize: ps,
      });
    }

    // No pagination — return all (backward compatible)
    const sql = `${mergedCTE} SELECT j FROM merged ${orderClause}`;
    const result = await pool.query(sql, allParams);
    return res.json({ success: true, count: result.rowCount, data: result.rows.map(r => r.j) });
  } catch (e) {
    console.error("Entries query error:", e.message);
    return res.status(500).json({ success: false, error: "Database error" });
  }
});

// GET /api/entries/stats — lightweight aggregated stats (no row data)
app.get("/api/entries/stats", async (req, res) => {
  const { directorBranches, filterBranch, branch, date_from, date_to, today, periodStart, periodEnd } = req.query;
  const conditions = ["1=1"];
  const params = [];

  // Branch filtering (same logic as entries)
  if (directorBranches) {
    const branchList = directorBranches.split(',').map(b => b.trim().toUpperCase()).filter(Boolean);
    const filterBranchUpper = filterBranch ? filterBranch.toUpperCase() : null;
    if (filterBranchUpper && branchList.includes(filterBranchUpper)) {
      params.push(filterBranchUpper);
      conditions.push(`UPPER(branch_name) = $${params.length}`);
    } else {
      const placeholders = branchList.map((_, i) => `$${params.length + i + 1}`).join(', ');
      params.push(...branchList);
      conditions.push(`UPPER(branch_name) IN (${placeholders})`);
    }
  } else if (branch && branch !== 'ALL') {
    params.push(branch.toUpperCase());
    conditions.push(`UPPER(branch_name) = $${params.length}`);
  } else if (branch === 'ALL' && filterBranch) {
    params.push(filterBranch.toUpperCase());
    conditions.push(`UPPER(branch_name) = $${params.length}`);
  }

  if (date_from) { params.push(date_from); conditions.push(`entry_date >= $${params.length}`); }
  if (date_to)   { params.push(date_to);   conditions.push(`entry_date <= $${params.length}`); }

  const whereClause = conditions.join(" AND ");

  try {
    // Total entries & revenue for the filtered range
    const totalsRes = await pool.query(
      `SELECT COUNT(*) AS total_entries, COALESCE(SUM(amount_paid), 0) AS total_revenue FROM customer_entries WHERE ${whereClause}`,
      params
    );
    const { total_entries, total_revenue } = totalsRes.rows[0];

    // Today's stats (needs today param)
    let todayCount = 0, todayRevenue = 0;
    const todayByScheme = {};
    if (today) {
      const todayParams = [...params, today];
      const todayRes = await pool.query(
        `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_paid), 0) AS rev FROM customer_entries WHERE ${whereClause} AND entry_date = $${todayParams.length}`,
        todayParams
      );
      todayCount = parseInt(todayRes.rows[0].cnt);
      todayRevenue = parseFloat(todayRes.rows[0].rev);

      // Today by scheme
      const todaySchemeRes = await pool.query(
        `SELECT scheme_type, COALESCE(SUM(amount_paid), 0) AS rev FROM customer_entries WHERE ${whereClause} AND entry_date = $${todayParams.length} GROUP BY scheme_type`,
        todayParams
      );
      todaySchemeRes.rows.forEach(r => { todayByScheme[r.scheme_type] = parseFloat(r.rev); });
    }

    // Period stats (needs periodStart, periodEnd)
    let periodRevenue = 0;
    if (periodStart && periodEnd) {
      const periodParams = [...params, periodStart, periodEnd];
      const periodRes = await pool.query(
        `SELECT COALESCE(SUM(amount_paid), 0) AS rev FROM customer_entries WHERE ${whereClause} AND entry_date >= $${periodParams.length - 1} AND entry_date <= $${periodParams.length}`,
        periodParams
      );
      periodRevenue = parseFloat(periodRes.rows[0].rev);
    }

    // Revenue by scheme
    const schemeRes = await pool.query(
      `SELECT scheme_type, COUNT(*) AS cnt, COALESCE(SUM(amount_paid), 0) AS rev FROM customer_entries WHERE ${whereClause} GROUP BY scheme_type ORDER BY rev DESC`,
      params
    );
    const revenueByScheme = {};
    const countByScheme = {};
    schemeRes.rows.forEach(r => {
      revenueByScheme[r.scheme_type] = parseFloat(r.rev);
      countByScheme[r.scheme_type] = parseInt(r.cnt);
    });

    // Unique branch count
    const branchCountRes = await pool.query(
      `SELECT COUNT(DISTINCT branch_name) AS cnt FROM customer_entries WHERE ${whereClause}`,
      params
    );
    const uniqueBranchCount = parseInt(branchCountRes.rows[0].cnt);

    return res.json({
      success: true,
      totalEntries: parseInt(total_entries),
      totalRevenue: parseFloat(total_revenue),
      todayCount,
      todayRevenue,
      periodRevenue,
      revenueByScheme,
      countByScheme,
      todayByScheme,
      uniqueBranchCount,
    });
  } catch (e) {
    console.error("Stats query error:", e.message);
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
    gold_package, gold_quantity,
    proof_url, cash_amount, bank_amount,
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
        gold_package=$21, gold_quantity=$22, proof_url=$23,
        cash_amount=$24, bank_amount=$25, updated_at=NOW()
      WHERE id=$26`,
      [
        serialNumber, entry_date, normalizedBranch, customer_name,
        phone_number, Number(amount_paid), payment_mode, transaction_details || null,
        scheme_type,
        referred_by || null, referred_by_emp_id || null, referred_by_role || null,
        higher_official || null, higher_official_emp_id || null, higher_official_role || null,
        notes || null,
        land_kind_of_payment || null, land_site_name || null, land_site_number || null, land_layout || null,
        gold_package || null, (gold_quantity !== undefined && gold_quantity !== "" ? parseInt(gold_quantity) : null), proof_url || null,
        payment_mode === "Cash+Bank" ? Number(cash_amount) : null,
        payment_mode === "Cash+Bank" ? Number(bank_amount) : null,
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
app.get("/api/users", authenticateToken, requireManagement, async (_req, res) => {
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

// Helper: today in IST as YYYY-MM-DD
function todayIST() {
  return new Date().toLocaleString("en-CA", { timeZone: "Asia/Kolkata" }).split(",")[0];
}

// GET /api/today — authoritative current date (IST). The form trusts this over the
// device clock so a misconfigured branch device can't save a wrong entry_date.
app.get("/api/today", (_req, res) => {
  return res.json({ success: true, date: todayIST() });
});

// Validate a YYYY-MM-DD string; return it or null
function normalizeDate(value) {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(v + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return v;
}

// GET /api/no-collection/me — branch reads its marked no-collection dates
app.get("/api/no-collection/me", authenticateToken, async (req, res) => {
  if (req.user.role !== "branch") return res.status(403).json({ success: false, error: "Branch role only" });
  const branch = (req.user.branch || "").toUpperCase();
  const { rows } = await pool.query(
    "SELECT marked_date FROM branch_no_collection_days WHERE UPPER(branch_name)=$1 ORDER BY marked_date DESC",
    [branch]
  );
  const dates = rows.map(r => String(r.marked_date).slice(0, 10));
  return res.json({ success: true, today: todayIST(), dates });
});

// POST /api/no-collection — branch marks a date (default today) as no collections
app.post("/api/no-collection", authenticateToken, async (req, res) => {
  if (req.user.role !== "branch") return res.status(403).json({ success: false, error: "Branch role only" });
  const date   = req.body?.date ? normalizeDate(req.body.date) : todayIST();
  const branch = (req.user.branch || "").toUpperCase();
  if (!date) return res.status(400).json({ success: false, error: "Invalid date" });
  if (date > todayIST()) return res.status(400).json({ success: false, error: "Cannot mark a future date" });
  // Block if entries already exist for this form date (entry_date) — not when they were typed in
  const { rows: existing } = await pool.query(
    "SELECT 1 FROM customer_entries WHERE UPPER(branch_name)=$1 AND entry_date = $2::date LIMIT 1",
    [branch, date]
  );
  if (existing.length) return res.status(400).json({ success: false, error: `Cannot mark — entries already exist for ${date}` });
  await pool.query(
    `INSERT INTO branch_no_collection_days (branch_name, marked_date, marked_by, note)
     VALUES ($1, $2, $3, $4) ON CONFLICT (branch_name, marked_date) DO NOTHING`,
    [branch, date, req.user.id || null, req.body?.note || null]
  );
  return res.json({ success: true, date, marked: true });
});

// DELETE /api/no-collection — branch undoes a date's mark (default today)
app.delete("/api/no-collection", authenticateToken, async (req, res) => {
  if (req.user.role !== "branch") return res.status(403).json({ success: false, error: "Branch role only" });
  const raw    = req.body?.date || req.query?.date;
  const date   = raw ? normalizeDate(raw) : todayIST();
  const branch = (req.user.branch || "").toUpperCase();
  if (!date) return res.status(400).json({ success: false, error: "Invalid date" });
  await pool.query(
    "DELETE FROM branch_no_collection_days WHERE UPPER(branch_name)=$1 AND marked_date=$2",
    [branch, date]
  );
  return res.json({ success: true, date, marked: false });
});

// GET /api/follow-up?date=YYYY-MM-DD  (followup / md / management)
app.get("/api/follow-up", authenticateToken, async (req, res) => {
  const allowed = ["followup", "md", "management"];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ success: false, error: "Access denied" });
  }

  const date = req.query.date || todayIST();

  try {
    // Active branch accounts (role = 'branch') — these are the ones who should submit
    const { rows: branchRows } = await pool.query(
      "SELECT UPPER(branch_name) AS branch_name FROM branch_users WHERE role = 'branch' ORDER BY branch_name ASC"
    );
    const allBranches = [...new Set(branchRows.map(r => r.branch_name))];

    // Branches that submitted for this date — by FORM date (entry_date), not when typed in
    const { rows: submittedRows } = await pool.query(
      "SELECT DISTINCT UPPER(branch_name) AS branch_name FROM customer_entries WHERE entry_date = $1::date",
      [date]
    );
    const submittedSet = new Set(submittedRows.map(r => r.branch_name));

    // Branches that have ever entered any data
    const { rows: everRows } = await pool.query(
      "SELECT DISTINCT UPPER(branch_name) AS branch_name FROM customer_entries"
    );
    const everSet = new Set(everRows.map(r => r.branch_name));

    // Branches that marked themselves as having no collections for this date
    const { rows: noCollRows } = await pool.query(
      "SELECT UPPER(branch_name) AS branch_name FROM branch_no_collection_days WHERE marked_date = $1::date",
      [date]
    );
    const noCollSet = new Set(noCollRows.map(r => r.branch_name));

    const submitted    = allBranches.filter(b => submittedSet.has(b));
    const noCollection = allBranches.filter(b => noCollSet.has(b) && !submittedSet.has(b));
    const missing      = allBranches.filter(b => !submittedSet.has(b) && !noCollSet.has(b));
    const neverEntered = allBranches.filter(b => !everSet.has(b));

    return res.json({
      success: true,
      date,
      submitted,
      missing,
      noCollection,
      neverEntered,
      submittedCount:      submitted.length,
      missingCount:        missing.length,
      noCollectionCount:   noCollection.length,
      neverEnteredCount:   neverEntered.length,
      totalBranches:       allBranches.length,
    });
  } catch (e) {
    console.error("Follow-up error:", e.message);
    return res.status(500).json({ success: false, error: "Database error" });
  }
});

// POST /api/uploads/presign — generate S3 presigned POST URL for proof uploads
const ALLOWED_CONTENT_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/pdf"];
const ALLOWED_PAYMENT_MODES  = ["GPay", "Bank", "Cash+Bank"];

app.post("/api/uploads/presign", authenticateToken, async (req, res) => {
  const { filename, contentType, paymentMode } = req.body;

  if (!ALLOWED_PAYMENT_MODES.includes(paymentMode))
    return res.status(400).json({ success: false, error: "paymentMode must be GPay, Bank, or Cash+Bank" });
  if (!ALLOWED_CONTENT_TYPES.includes(contentType))
    return res.status(400).json({ success: false, error: "Unsupported file type" });
  if (!filename || typeof filename !== "string" || filename.length > 200)
    return res.status(400).json({ success: false, error: "Invalid filename" });

  const prefix    = paymentMode === "GPay" ? "gpay-proofs" : "Bank-proofs";
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key       = `${prefix}/${uuidv4()}-${sanitized}`;

  try {
    const { url, fields } = await createPresignedPost(s3, {
      Bucket: S3_BUCKET,
      Key: key,
      Conditions: [
        ["content-length-range", 0, 5 * 1024 * 1024],
        ["eq", "$Content-Type", contentType],
      ],
      Fields: { "Content-Type": contentType },
      Expires: 300,
    });

    const fileUrl = `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    return res.json({ success: true, uploadUrl: url, fields, fileUrl, key });
  } catch (e) {
    console.error("Presign error:", e.message);
    return res.status(500).json({ success: false, error: "Could not generate upload URL" });
  }
});

// GET /api/uploads/sign-get?key=... — return a short-lived signed GET URL for proof viewing
app.get("/api/uploads/sign-get", authenticateToken, async (req, res) => {
  const { key } = req.query;
  if (!key || !/^(gpay-proofs|Bank-proofs)\/.+/.test(key))
    return res.status(400).json({ success: false, error: "Invalid key" });

  try {
    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
      { expiresIn: 300 }
    );
    return res.json({ success: true, url: signedUrl });
  } catch (e) {
    console.error("Sign GET error:", e.message);
    return res.status(500).json({ success: false, error: "Could not generate signed URL" });
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

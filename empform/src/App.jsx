import { useState, useEffect, useRef } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "http://localhost:5000/api";

async function authFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    const sentAuth = !!(options.headers && (options.headers.Authorization || options.headers.authorization));
    if (sentAuth) {
      localStorage.removeItem("token");
      localStorage.removeItem("branch");
      localStorage.removeItem("role");
      localStorage.removeItem("directorBranches");
      localStorage.removeItem("directorName");
      window.dispatchEvent(new Event("auth:logout"));
    }
  }
  return res;
}

const branches = [
  "AARANI", "ANDIMADAM", "ANEKAL", "ARIYALUR", "ARIYANKUPPAM", "ATTIBELE", "ATTUR",
  "AVALURPET", "BANGARUPALAYAM", "BELLARY", "CHENGAM", "CHITTOOR", "CUDDALORE",
  "DEVANUR", "DHARAPURAM", "DHARMAPURI", "DINDIGUL", "ELURU", "GINGEE", "GOWRIBIDANUR",
  "GUDUR", "HARUR", "HASAN", "JAMUNAMARATHUR", "KALAHASTHI", "KALLAKURICHI",
  "KANDACHIPURAM", "KANIYAMBADI", "KARAIKAL", "KODAD","KRISHNAGIRI", "MANDYA", "MELMALAIYANUR",
  "MIRIYALAGUDA", "MOONGIL THURAIPATTU", "MYSORE", "NAIDUPETA", "NALGONDA", "NELLORE",
  "NETTAPAKKAM", "NEYVELI", "ONGOLE", "OTTACHATHIRAM", "PALACODE", "PALAMANER", "PALANI",
  "PANRUTI", "PAPPREDY PATTI", "PERAMBALUR", "POLUR", "PUTTUR", "RANIPET", "SANKARAPURAM",
  "SULLURPET", "SURYAPET", "THALAIVASAL", "THANDARAMPATTU", "THENMATHIMANGALAM",
  "THIRUKKANUR", "THIRUKOVILUR", "THIRUPATHI", "THIRUPATHUR", "THIRUTHANI", "THITAKUDI",
  "TINDIVANAM", "TIRUCHI", "TIRUPUR", "TIRUVANNAMALAI", "UDUMALPET", "ULUNDURPET", "UTHANGARAI",
  "V KOTA", "VEPPUR", "VIJAYAWADA", "VILLIANUR", "VILLUPURAM", "VIRUTHACHALAM",
];

const schemes = [
  "MONTHLY GOLD RENEWAL", "MONTHLY GOLD NEW", "GOLD COIN SAVINGS", "JEWEL SAVINGS",
  "GLOBAL VETRI CHIT NEW", "GLOBAL VETRI CHIT RENEWAL", "TRADING", "LAND", "BUILDERS",
];

const veppurOptions = ["Krishna Garden 3", "Narayanapuram", "Vasantha Garden", "AVG Nagar"];
const melmalaiyanurOpts = ["VRJ City"];
const kandapankurichiOpts = ["Andal Nagar"];

const SCHEME_COLORS = {
  "MONTHLY GOLD RENEWAL": "#f59e0b",
  "MONTHLY GOLD NEW": "#d97706",
  "GOLD COIN SAVINGS": "#b45309",
  "JEWEL SAVINGS": "#7c3aed",
  "GLOBAL VETRI CHIT NEW": "#2563eb",
  "GLOBAL VETRI CHIT RENEWAL": "#1d4ed8",
  "TRADING": "#0891b2",
  "LAND": "#059669",
  "BUILDERS": "#dc2626",
};

const formatDateToDDMMYYYY = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

// Today's date as YYYY-MM-DD in India time (IST), independent of the device timezone.
const todayISTStr = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
// A timestamp's calendar date in IST (used to compare created_at against the form date).
const dateInIST = (value) => new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const exportToCSV = (entries) => {
  if (!entries || entries.length === 0) { alert("No entries to export."); return; }
  const headers = [
    "S.No", "Date", "Branch", "Customer Name", "Phone", "Amount Paid",
    "Cash Amount", "Bank Amount",
    "Payment Mode", "Transaction Details", "Scheme",
    "Referred By", "Referrer Emp ID", "Referrer Role",
    "Higher Official", "Official Emp ID", "Official Role",
    "Land Kind of Payment", "Land Site Name", "Land Layout", "Land Site Number",
    "Gold/Jewel Package", "Gold/Jewel Quantity", "Notes",
  ];
  const rows = entries.map(e => [
    e.serial_number || "", formatDateToDDMMYYYY(e.entry_date), e.branch_name || "",
    e.customer_name || "", e.phone_number || "", e.amount_paid || "",
    e.cash_amount || "", e.bank_amount || "",
    e.payment_mode || "", e.transaction_details || "", e.scheme_type || "",
    e.referred_by || "", e.referred_by_emp_id || "", e.referred_by_role || "",
    e.higher_official || "", e.higher_official_emp_id || "", e.higher_official_role || "",
    e.land_kind_of_payment || "", e.land_site_name || "", e.land_layout || "", e.land_site_number || "",
    e.gold_package || "", e.gold_quantity || "", (e.notes || "").replace(/,/g, " "),
  ]);
  // Wrap date column (index 1) as Excel text formula ="DD/MM/YYYY" to prevent auto-formatting
  const csv = [
    headers.join(","),
    ...rows.map(r => r.map((v, i) => i === 1 ? `"=""${v}"""` : `"${v}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.setAttribute("download", `emp_entries_${todayISTStr()}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// ── Login ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPwd] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const endpoint = mode === "login" ? "/login" : "/change-password";
      const body = mode === "login"
        ? { email, password }
        : { email, currentPassword: password, newPassword };
      const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || (mode === "login" ? "Login failed" : "Password change failed"));
      } else if (mode === "login") {
        localStorage.setItem("token", data.token);
        localStorage.setItem("branch", data.branch);
        localStorage.setItem("role", data.role || "branch");
        onLogin(data);
      } else {
        setSuccess("Password updated! Please login.");
        setMode("login"); setPassword(""); setNewPwd("");
      }
    } catch { setError("Network error."); }
    setLoading(false);
  };

  return (
    <div className="page-bg" style={{ alignItems: "center" }}>
      <div className="form-card" style={{ maxWidth: "400px" }}>
        <div className="form-header">
          <img src="/AVG_logo.jpeg" alt="Logo" className="brand-logo" />
          <h1 className="form-title" style={{ marginTop: "1rem" }}>
            {mode === "login" ? "Staff Login" : "Change Password"}
          </h1>
          <p className="form-subtitle">Agilavetri PrimeTech</p>
        </div>
        <form onSubmit={handleSubmit} className="field-group" style={{ gap: "1rem" }}>
          {error && <div className="status-banner error" style={{ marginBottom: 0, padding: "0.75rem" }}>{error}</div>}
          {success && <div className="status-banner success" style={{ marginBottom: 0, padding: "0.75rem" }}>{success}</div>}
          <div className="field-group">
            <label className="field-label">Email</label>
            <input type="email" className="field-input" required value={email} onChange={e => setEmail(e.target.value)} placeholder="branch@gmail.com" />
          </div>
          <div className="field-group">
            <label className="field-label">{mode === "login" ? "Password" : "Current Password"}</label>
            <div style={{ position: "relative" }}>
              <input type={showPwd ? "text" : "password"} className="field-input" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: "2.5rem" }} />
              <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showPwd ? "var(--primary)" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {showPwd ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>
          {mode === "change_password" && (
            <div className="field-group">
              <label className="field-label">New Password</label>
              <div style={{ position: "relative" }}>
                <input type={showNewPwd ? "text" : "password"} className="field-input" required value={newPassword} onChange={e => setNewPwd(e.target.value)} placeholder="••••••••" style={{ paddingRight: "2.5rem" }} />
                <button type="button" onClick={() => setShowNewPwd(v => !v)} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={showNewPwd ? "var(--primary)" : "#9ca3af"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {showNewPwd ? (
                      <>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </>
                    ) : (
                      <>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>
          )}
          <button type="submit" className="submit-btn" disabled={loading} style={{ width: "100%", marginTop: "0.5rem", justifyContent: "center" }}>
            {loading ? "Processing…" : (mode === "login" ? "Login" : "Change Password")}
          </button>
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button type="button"
              onClick={() => { setMode(m => m === "login" ? "change_password" : "login"); setError(""); setSuccess(""); setPassword(""); setNewPwd(""); }}
              style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", textDecoration: "underline", fontSize: "0.9rem" }}>
              {mode === "login" ? "Change your password?" : "Back to login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shared field components ───────────────────────────────────────────────────
function FieldLabel({ children, required }) {
  return <label className="field-label">{children}{required && <span className="required-star"> *</span>}</label>;
}
function TextInput({ label, required, ...props }) {
  // For number fields, stop the mouse wheel from changing the value — only typing should.
  const numberProps = props.type === "number" ? { onWheel: (e) => e.currentTarget.blur() } : {};
  return (
    <div className="field-group">
      <FieldLabel required={required}>{label}</FieldLabel>
      <input className="field-input" {...props} {...numberProps} />
    </div>
  );
}
function SelectInput({ label, required, options, placeholder, ...props }) {
  return (
    <div className="field-group">
      <FieldLabel required={required}>{label}</FieldLabel>
      <select className="field-input" {...props}>
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map(o => typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
function PersonRow({ nameLabel, nameProps, empIdProps, roleProps, required }) {
  return (
    <div className="person-row">
      <div className="field-group">
        <FieldLabel required={required}>{nameLabel}</FieldLabel>
        <input className="field-input" {...nameProps} />
      </div>
      <div className="field-group emp-id-group">
        <FieldLabel>Employee ID</FieldLabel>
        <input className="field-input emp-id-input" {...empIdProps} placeholder="EMP-XXXX" />
      </div>
      <div className="field-group role-group">
        <FieldLabel>Role</FieldLabel>
        <select className="field-input role-input" {...roleProps}>
          <option value="">Select Role</option>
          <option value="BM">BM</option>
          <option value="ABM">ABM</option>
          <option value="OA">OA</option>
          <option value="SO">SO</option>
          <option value="GM">GM</option>
          <option value="Director">Director</option>
          <option value="admin">admin</option>
        </select>
      </div>
    </div>
  );
}
function SectionTitle({ icon, title }) {
  return (
    <div className="section-title">
      <span className="section-icon">{icon}</span>
      <span>{title}</span>
    </div>
  );
}

// Returns the current billing period (7th of month → 6th of next month)
function getCurrentBillingPeriod(now) {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const day = now.getDate();
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let startYear, startMonth, endYear, endMonth;
  if (day >= 7) {
    startYear = year; startMonth = month;
    const endDate = new Date(year, month + 1, 6);
    endYear = endDate.getFullYear(); endMonth = endDate.getMonth();
  } else {
    const startDate = new Date(year, month - 1, 7);
    startYear = startDate.getFullYear(); startMonth = startDate.getMonth();
    endYear = year; endMonth = month;
  }

  const periodStart = `${startYear}-${String(startMonth + 1).padStart(2, "0")}-07`;
  const periodEnd = `${endYear}-${String(endMonth + 1).padStart(2, "0")}-06`;
  const periodLabel = `${MONTHS[startMonth]} 7 – ${MONTHS[endMonth]} 6, ${endYear}`;

  return { periodStart, periodEnd, periodLabel };
}

// Drag-to-resize column widths hook
function useResizableColumns(initWidths) {
  const [widths, setWidths] = useState(initWidths);
  const resizingRef = useRef(null);

  const startResize = (idx, e) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = { idx, startX: e.clientX, startW: widths[idx] };

    const onMove = (ev) => {
      if (!resizingRef.current) return;
      const { idx, startX, startW } = resizingRef.current;
      setWidths(prev => {
        const next = [...prev];
        next[idx] = Math.max(50, startW + ev.clientX - startX);
        return next;
      });
    };
    const onUp = () => {
      resizingRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return [widths, startResize];
}

function ResizeHandle({ onMouseDown }) {
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "5px",
        cursor: "col-resize", zIndex: 2, background: "transparent",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.background = "rgba(59,130,246,0.45)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
    />
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────
function Pagination({ total, page, pageSize, onPage, onPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <div className="pagination-bar">
      <span className="pagination-info">
        {total === 0 ? "No entries" : `${from}–${to} of ${total}`}
      </span>
      <div className="pagination-controls">
        <button className="page-btn" onClick={() => onPage(1)} disabled={page === 1}>«</button>
        <button className="page-btn" onClick={() => onPage(page - 1)} disabled={page === 1}>‹</button>
        <span className="page-label">Page {page} / {totalPages}</span>
        <button className="page-btn" onClick={() => onPage(page + 1)} disabled={page >= totalPages}>›</button>
        <button className="page-btn" onClick={() => onPage(totalPages)} disabled={page >= totalPages}>»</button>
      </div>
      <div className="pagination-size">
        <label>Rows</label>
        <select value={pageSize} onChange={e => { onPageSize(Number(e.target.value)); onPage(1); }}>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={250}>250</option>
        </select>
      </div>
    </div>
  );
}

// ── MD Dashboard ──────────────────────────────────────────────────────────────
function MDDashboard({ onLogout }) {
  const now = new Date();
  const today = todayISTStr();
  const { periodStart, periodEnd, periodLabel } = getCurrentBillingPeriod(now);
  const monthName = periodLabel;

  const [filterBranch, setFilterBranch] = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const isFiltered = filterBranch || dateFrom || dateTo;
  const clearFilters = () => { setFilterBranch(""); setDateFrom(""); setDateTo(""); };

  const [stats, setStats]           = useState(null);
  const [entries, setEntries]       = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statsLoading, setStatsLoading]     = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [exporting, setExporting]           = useState(false);

  const [colWidths, startResize] = useResizableColumns([60, 100, 140, 160, 120, 110, 90, 70, 185, 170, 170, 160, 130]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(50);

  useEffect(() => { setCurrentPage(1); }, [filterBranch, dateFrom, dateTo]);

  const baseParams = () =>
    `branch=ALL${filterBranch ? `&filterBranch=${encodeURIComponent(filterBranch)}` : ""}${dateFrom ? `&date_from=${dateFrom}` : ""}${dateTo ? `&date_to=${dateTo}` : ""}`;

  useEffect(() => {
    setStatsLoading(true);
    fetch(`${API_BASE}/entries/stats?${baseParams()}&today=${today}&periodStart=${periodStart}&periodEnd=${periodEnd}`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [filterBranch, dateFrom, dateTo]);

  useEffect(() => {
    setEntriesLoading(true);
    fetch(`${API_BASE}/entries?${baseParams()}&page=${currentPage}&pageSize=${pageSize}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setEntries(d.data); setTotalCount(d.totalCount || 0); } })
      .catch(() => {})
      .finally(() => setEntriesLoading(false));
  }, [filterBranch, dateFrom, dateTo, currentPage, pageSize]);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res  = await fetch(`${API_BASE}/entries?${baseParams()}`);
      const data = await res.json();
      if (data.success) exportToCSV(data.data);
    } catch {}
    setExporting(false);
  };

  const totalEntries      = stats?.totalEntries    ?? 0;
  const totalRevenue      = stats?.totalRevenue    ?? 0;
  const todayCount        = stats?.todayCount      ?? 0;
  const todayRevenue      = stats?.todayRevenue    ?? 0;
  const thisMonthRevenue  = stats?.periodRevenue   ?? 0;
  const revenueByScheme   = stats?.revenueByScheme ?? {};
  const countByScheme     = stats?.countByScheme   ?? {};
  const todayByScheme     = stats?.todayByScheme   ?? {};
  const uniqueBranchCount = stats?.uniqueBranchCount ?? 0;
  const schemeCount       = Object.keys(revenueByScheme).length;

  return (
    <div className="admin-layout">
      {/* Top Bar */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <img src="/AVG_logo.jpeg" alt="Logo" className="admin-logo" />
          <div className="admin-brand">
            <span className="admin-brand-name">Agilavetri PrimeTech</span>
            <span className="admin-brand-sub">MD Dashboard</span>
          </div>
        </div>
        <div className="admin-topbar-right">
          <div className="admin-user-badge">
            <span>👑</span>
            <span>MD / Admin</span>
          </div>
          <button className="admin-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main className="admin-main">

        {/* Filter Bar */}
        <div className="admin-filter-bar">
          <div className="admin-filter-label">
            <span>🔍</span>
            <span>Filters</span>
            {isFiltered && <span className="filter-active-badge">Active</span>}
          </div>
          <div className="admin-filter-controls">
            <div className="field-group" style={{ minWidth: "180px", flex: 1 }}>
              <label className="field-label">Branch</label>
              <select className="field-input" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="field-group" style={{ minWidth: "150px", flex: 1 }}>
              <label className="field-label">From Date</label>
              <input type="date" className="field-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="field-group" style={{ minWidth: "150px", flex: 1 }}>
              <label className="field-label">To Date</label>
              <input type="date" className="field-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            {isFiltered && (
              <button className="admin-clear-btn" onClick={clearFilters}>✕ Clear</button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card" data-color="blue">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-blue">📋</span>
              <span className="kpi-badge">{isFiltered ? "Filtered" : "All time"}</span>
            </div>
            <div className="kpi-value">{statsLoading ? "…" : totalEntries.toLocaleString()}</div>
            <div className="kpi-label">Total Entries</div>
          </div>
          <div className="kpi-card" data-color="purple">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-purple">📅</span>
              <span className="kpi-badge">{isFiltered ? monthName : "All time"}</span>
            </div>
            <div className="kpi-value">₹{statsLoading ? "…" : (isFiltered ? thisMonthRevenue : totalRevenue).toLocaleString()}</div>
            <div className="kpi-label">{isFiltered ? "This Period" : "All Time Revenue"}</div>
          </div>
          <div className="kpi-card" data-color="green">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-green">💰</span>
              <span className="kpi-badge">{isFiltered ? "Filtered" : monthName}</span>
            </div>
            <div className="kpi-value">₹{statsLoading ? "…" : (isFiltered ? totalRevenue : thisMonthRevenue).toLocaleString()}</div>
            <div className="kpi-label">{isFiltered ? "Filtered Revenue" : "Period Revenue"}</div>
          </div>
          <div className="kpi-card" data-color="orange">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-orange">⚡</span>
              <span className="kpi-badge">{todayCount} entries</span>
            </div>
            <div className="kpi-value">₹{statsLoading ? "…" : todayRevenue.toLocaleString()}</div>
            <div className="kpi-label">Today's Revenue</div>
          </div>
        </div>

        {/* Middle Row: Scheme Breakdown + Overview */}
        <div className="admin-mid-row">

          {/* Scheme Breakdown */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <div className="admin-panel-title">Revenue by Scheme</div>
                <div className="admin-panel-sub">{schemeCount} active scheme{schemeCount !== 1 ? "s" : ""}</div>
              </div>
            </div>
            {schemeCount === 0 ? (
              <div className="admin-empty">{statsLoading ? "Loading…" : "No revenue data yet."}</div>
            ) : (
              <div className="scheme-list">
                {Object.entries(revenueByScheme)
                  .sort(([, a], [, b]) => b - a)
                  .map(([scheme, total]) => {
                    const pct   = totalRevenue > 0 ? Math.round((total / totalRevenue) * 100) : 0;
                    const color = SCHEME_COLORS[scheme] || "#6b7280";
                    return (
                      <div key={scheme} className="scheme-row">
                        <div className="scheme-row-top">
                          <span className="scheme-dot" style={{ background: color }} />
                          <span className="scheme-name">{scheme}</span>
                          <span className="scheme-count-pill">{countByScheme[scheme]}</span>
                          <span className="scheme-amount">₹{total.toLocaleString()}</span>
                        </div>
                        <div className="scheme-bar-track">
                          <div className="scheme-bar-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <div className="scheme-pct-label">{pct}%</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Overview + Today's Breakdown */}
          <div className="admin-panel admin-panel-sm">
            <div className="admin-panel-header">
              <div className="admin-panel-title">Overview</div>
            </div>
            <div className="overview-list">
              <div className="overview-row">
                <span className="overview-label">Active Branches</span>
                <span className="overview-value">{uniqueBranchCount}</span>
              </div>
              <div className="overview-row">
                <span className="overview-label">Schemes Active</span>
                <span className="overview-value">{schemeCount}</span>
              </div>
              <div className="overview-row">
                <span className="overview-label">Entries Today</span>
                <span className="overview-value">{todayCount}</span>
              </div>
            </div>

            <div className="today-section">
              <div className="today-section-title">Today by Scheme</div>
              {Object.keys(todayByScheme).length === 0 ? (
                <div className="admin-empty-sm">{statsLoading ? "Loading…" : "No entries recorded today."}</div>
              ) : (
                <div className="today-list">
                  {Object.entries(todayByScheme)
                    .sort(([, a], [, b]) => b - a)
                    .map(([scheme, amt]) => (
                      <div key={scheme} className="today-row">
                        <span className="today-dot" style={{ background: SCHEME_COLORS[scheme] || "#6b7280" }} />
                        <span className="today-scheme">{scheme}</span>
                        <span className="today-amt">₹{amt.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Entries Table */}
        <div className="admin-panel admin-table-panel">
          <div className="admin-table-header">
            <div>
              <div className="admin-panel-title">
                All Entries
                <span className="entry-count-badge">{totalCount}</span>
              </div>
              <div className="admin-panel-sub">
                {isFiltered
                  ? [filterBranch || "All Branches", dateFrom && `From ${dateFrom}`, dateTo && `To ${dateTo}`].filter(Boolean).join(" · ")
                  : "All branches · All time"}
              </div>
            </div>
            {totalCount > 0 && (
              <button className="export-btn" onClick={handleExportCSV} disabled={exporting}>
                {exporting ? "Exporting…" : "📥 Export CSV"}
              </button>
            )}
          </div>

          {entriesLoading ? (
            <div className="admin-empty" style={{ padding: "3rem" }}>Loading entries…</div>
          ) : totalCount === 0 ? (
            <div className="admin-empty" style={{ padding: "3rem" }}>
              No entries found. Adjust filters or add data from a branch.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w + "px" }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {["S.No", "Date", "Branch", "Customer", "Phone", "Amount", "Mode", "Proof", "Scheme", "Referred By", "Higher Official", "Land / Gold", "Notes"].map((h, i) => (
                      <th key={h} style={{ position: "relative" }}>
                        {h}<ResizeHandle onMouseDown={e => startResize(i, e)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, idx) => {
                    const color   = SCHEME_COLORS[e.scheme_type] || "#6b7280";
                    const landInfo = e.land_kind_of_payment
                      ? [e.land_kind_of_payment, e.land_site_name, e.land_layout, e.land_site_number && `#${e.land_site_number}`].filter(Boolean).join(" · ")
                      : e.gold_package ? `Gold: ${e.gold_package}${e.gold_quantity ? ` ×${e.gold_quantity}` : ""}` : "-";
                    if (e.is_no_collection) return <NoCollectionRow key={e.id} entry={e} blankCols={9} />;
                    return (
                      <tr key={e.id} className={idx % 2 === 0 ? "tr-even" : "tr-odd"}>
                        <td className="td-mono">{e.serial_number || "-"}</td>
                        <td className="td-nowrap">{formatDateToDDMMYYYY(e.entry_date)}</td>
                        <td className="td-branch">{e.branch_name}</td>
                        <td>{e.customer_name}</td>
                        <td className="td-mono">{e.phone_number}</td>
                        <td className="td-amount">
                          ₹{Number(e.amount_paid).toLocaleString()}
                          {e.payment_mode === "Cash+Bank" && (
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted, #6b7280)" }}>
                              C ₹{Number(e.cash_amount).toLocaleString()} / B ₹{Number(e.bank_amount).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`mode-badge mode-${(e.payment_mode || "").toLowerCase().replace(/\+/g, "")}`}>
                            {e.payment_mode}
                          </span>
                        </td>
                        <td><ProofLink proofUrl={e.proof_url} proofUrls={e.proof_urls} /></td>
                        <td>
                          <span className="scheme-tag" style={{ background: `${color}18`, color, borderColor: `${color}40` }}>
                            {e.scheme_type}
                          </span>
                        </td>
                        <td className="td-clip">
                          {e.referred_by ? `${e.referred_by}${e.referred_by_role ? ` (${e.referred_by_role})` : ""}` : "-"}
                        </td>
                        <td className="td-clip">
                          {e.higher_official ? `${e.higher_official}${e.higher_official_role ? ` (${e.higher_official_role})` : ""}` : "-"}
                        </td>
                        <td className="td-clip">{landInfo}</td>
                        <td className="td-notes">{e.notes || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                total={totalCount}
                page={currentPage}
                pageSize={pageSize}
                onPage={setCurrentPage}
                onPageSize={setPageSize}
              />
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, onConfirm, onCancel, loading }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card confirm-card" onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem" }}>{title}</h3>
        <p style={{ margin: "0 0 1.5rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>{message}</p>
        <div className="modal-actions">
          <button className="cancel-btn" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="danger-btn" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Proof Uploader ────────────────────────────────────────────────────────────
const PROOF_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif", "application/pdf"];
const PROOF_MAX_BYTES = 5 * 1024 * 1024;
const PROOF_MAX_COUNT = 3;

// Derive a friendly display name from a stored S3 URL (strips the "<uuid>-" prefix)
const proofUrlName = (url) => url.split("/").pop().slice(37) || url.split("/").pop();

// Upload one File to S3 via the presign endpoint; resolves to the public file URL.
async function uploadProofFile(file, paymentMode, token) {
  const presignRes = await authFetch(`${API_BASE}/uploads/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify({ filename: file.name, contentType: file.type, paymentMode: paymentMode === "Cash+Bank" ? "Bank" : paymentMode }),
  });
  const presignData = await presignRes.json();
  if (!presignData.success) throw new Error(presignData.error || "Failed to prepare upload");
  const { uploadUrl, fields, fileUrl } = presignData;
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  fd.append("file", file);
  const uploadRes = await fetch(uploadUrl, { method: "POST", body: fd });
  if (!uploadRes.ok) throw new Error("Proof upload failed. Please try again.");
  return fileUrl;
}

// Supports up to 3 payment proofs. existingUrls = already-saved S3 URLs (edit mode),
// pendingFiles = File objects not yet uploaded. Combined count is capped at PROOF_MAX_COUNT.
function ProofUploader({ paymentMode, pendingFiles = [], existingUrls = [], onAddFiles, onRemovePending, onRemoveExisting }) {
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  const total = pendingFiles.length + existingUrls.length;

  const handleChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (inputRef.current) inputRef.current.value = "";
    if (!files.length) return;
    setError("");
    let room = PROOF_MAX_COUNT - total;
    if (room <= 0) { setError(`You can attach up to ${PROOF_MAX_COUNT} proofs only`); return; }
    const accepted = [];
    for (const file of files) {
      if (accepted.length >= room) { setError(`You can attach up to ${PROOF_MAX_COUNT} proofs only`); break; }
      if (file.size > PROOF_MAX_BYTES) { setError(`${file.name}: must be under 5 MB`); continue; }
      if (!PROOF_ALLOWED_TYPES.includes(file.type)) { setError(`${file.name}: only images (PNG, JPG, WebP, GIF) and PDFs are allowed`); continue; }
      accepted.push(file);
    }
    if (accepted.length) onAddFiles(accepted);
  };

  return (
    <div className="proof-uploader">
      <div className="field-label">
        Payment Proof <span style={{ color: "#dc2626" }}>*</span>
        <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> (up to {PROOF_MAX_COUNT})</span>
      </div>
      {total > 0 && (
        <div className="proof-chip-list">
          {existingUrls.map((url, i) => (
            <div className="proof-chip" key={`u-${i}`}>
              <span className="proof-filename">{proofUrlName(url)}</span>
              <button type="button" className="proof-remove-btn" onClick={() => onRemoveExisting(i)}>&times;</button>
            </div>
          ))}
          {pendingFiles.map((file, i) => (
            <div className="proof-chip" key={`f-${i}`}>
              <span className="proof-filename">{file.name}</span>
              <button type="button" className="proof-remove-btn" onClick={() => onRemovePending(i)}>&times;</button>
            </div>
          ))}
        </div>
      )}
      {total < PROOF_MAX_COUNT && (
        <label className="proof-upload-label">
          <>📎 {total === 0 ? `Choose ${paymentMode} proof` : "Add another proof"} (image or PDF, max 5 MB)</>
          <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,application/pdf"
            onChange={handleChange} style={{ display: "none" }} />
        </label>
      )}
      {error && <div className="proof-error">{error}</div>}
    </div>
  );
}

// ── Proof Link (view signed S3 URL) ──────────────────────────────────────────
// Single proof: renders one "View" button. Multiple proofs: "View 1", "View 2"…
function ProofViewButton({ proofUrl, label }) {
  const [loading, setLoading] = useState(false);

  const handleView = async () => {
    setLoading(true);
    // Open the tab synchronously inside the click gesture so mobile browsers
    // (iOS Safari especially) don't block it as a popup. We redirect it once
    // the signed URL resolves. Falls back to the current tab if blocked.
    const win = window.open("about:blank", "_blank");
    try {
      const token = localStorage.getItem("token");
      const key   = proofUrl.replace(/^https?:\/\/[^/]+\//, "");
      const res   = await authFetch(`${API_BASE}/uploads/sign-get?key=${encodeURIComponent(key)}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.url) {
        if (win) { win.opener = null; win.location.href = data.url; }
        else { window.location.href = data.url; }
      } else if (win) {
        win.close();
      }
    } catch {
      if (win) win.close();
    } finally { setLoading(false); }
  };

  return (
    <button className="proof-view-btn" onClick={handleView} disabled={loading}>
      {loading ? "…" : label}
    </button>
  );
}

// Accepts the legacy single `proofUrl` and/or the new `proofUrls` array.
function ProofLink({ proofUrl, proofUrls }) {
  const urls = (Array.isArray(proofUrls) && proofUrls.length)
    ? proofUrls
    : (proofUrl ? [proofUrl] : []);
  if (!urls.length) return <span style={{ color: "var(--text-muted)" }}>-</span>;
  return (
    <div className="proof-view-list">
      {urls.map((u, i) => (
        <ProofViewButton key={i} proofUrl={u} label={urls.length > 1 ? `View ${i + 1}` : "View"} />
      ))}
    </div>
  );
}

// ── No Collection Toggle ─────────────────────────────────────────────────────
function NoCollectionToggle({ token, refreshKey, onChange }) {
  const today = todayISTStr();
  const [dates, setDates]   = useState(null);   // array of marked YYYY-MM-DD, null = loading
  const [open, setOpen]     = useState(false);
  const [pick, setPick]     = useState(today);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [msg, setMsg]       = useState("");

  const load = () => {
    authFetch(`${API_BASE}/no-collection/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setDates(d.dates || []); })
      .catch(() => setDates([]));
  };
  useEffect(() => { load(); }, [token, refreshKey]);

  const mark = async () => {
    setBusy(true); setError(""); setMsg("");
    try {
      const res = await authFetch(`${API_BASE}/no-collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ date: pick }),
      });
      const d = await res.json();
      if (d.success) {
        setMsg(`${formatDateToDDMMYYYY(d.date)} marked as no collections`);
        setOpen(false);
        load();
        onChange?.();
      } else setError(d.error || "Failed");
    } catch { setError("Network error"); }
    setBusy(false);
  };

  const undo = async (date) => {
    setBusy(true); setError(""); setMsg("");
    try {
      const res = await authFetch(`${API_BASE}/no-collection?date=${date}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (d.success) { load(); onChange?.(); }
      else setError(d.error || "Failed");
    } catch { setError("Network error"); }
    setBusy(false);
  };

  if (dates === null) return null;
  return (
    <div className="ncc">
      <button
        onClick={() => { setOpen(o => !o); setError(""); setMsg(""); }}
        className={`ncc-btn ncc-trigger${open ? " open" : ""}`}
        aria-expanded={open}
      >
        <span className="ncc-trigger-icon">⊘</span> Mark No Collection
      </button>

      {open && (
        <div className="ncc-panel">
          <label className="ncc-field">
            <span className="ncc-label">Select date</span>
            <input
              type="date"
              className="ncc-date"
              value={pick}
              max={today}
              onChange={e => setPick(e.target.value)}
            />
          </label>
          <div className="ncc-actions">
            <button onClick={mark} disabled={busy} className="ncc-btn ncc-confirm">
              {busy ? "Marking…" : "Mark"}
            </button>
            <button onClick={() => setOpen(false)} disabled={busy} className="ncc-btn ncc-cancel">
              Cancel
            </button>
          </div>
        </div>
      )}

      {msg && <div className="ncc-msg">✓ {msg}</div>}
      {error && <div className="ncc-err">{error}</div>}

      {dates.length > 0 && (
        <div className="ncc-list">
          <span className="ncc-list-title">No-collection days</span>
          <div className="ncc-chips">
            {dates.map(dt => (
              <span key={dt} className="ncc-chip">
                {formatDateToDDMMYYYY(dt)}
                <button
                  onClick={() => undo(dt)}
                  disabled={busy}
                  className="ncc-chip-x"
                  aria-label={`Remove ${formatDateToDDMMYYYY(dt)}`}
                  title="Remove"
                >✕</button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── No Collection synthetic row (shared by all entry tables) ─────────────────
// Renders a "NO COLLECTIONS" day as a normal row: Date + Branch filled, the label
// in the Customer column, and `blankCols` empty cells for the remaining columns.
function NoCollectionRow({ entry, blankCols }) {
  return (
    <tr style={{ background: "#fffbeb" }}>
      <td style={{ padding: "0.5rem" }}>-</td>
      <td style={{ padding: "0.5rem", whiteSpace: "nowrap" }}>{formatDateToDDMMYYYY(entry.entry_date)}</td>
      <td style={{ padding: "0.5rem" }}>{entry.branch_name}</td>
      <td style={{ padding: "0.5rem", fontWeight: 600, color: "#b45309" }}>NO COLLECTIONS</td>
      {Array.from({ length: blankCols }).map((_, i) => <td key={i} style={{ padding: "0.5rem" }} />)}
    </tr>
  );
}

// ── Edit Entry Modal ─────────────────────────────────────────────────────────
function EditEntryModal({ entry, onClose, onSave, token }) {
  const [form, setForm] = useState({
    entry_date: String(entry.entry_date).slice(0, 10),
    branch_name: entry.branch_name || "",
    customer_name: entry.customer_name || "",
    phone_number: entry.phone_number || "",
    amount_paid: entry.amount_paid || "",
    payment_mode: entry.payment_mode || "",
    transaction_details: entry.transaction_details || "",
    scheme_type: entry.scheme_type || "",
    referred_by: entry.referred_by || "",
    referred_by_emp_id: entry.referred_by_emp_id || "",
    referred_by_role: entry.referred_by_role || "",
    higher_official: entry.higher_official || "",
    higher_official_emp_id: entry.higher_official_emp_id || "",
    higher_official_role: entry.higher_official_role || "",
    notes: entry.notes || "",
    land_kind_of_payment: entry.land_kind_of_payment || "",
    land_site_name: entry.land_site_name || "",
    land_layout: entry.land_layout || "",
    land_site_number: entry.land_site_number || "",
    gold_package: entry.gold_package || "",
    gold_quantity: entry.gold_quantity || "",
    proof_url: entry.proof_url || "",
    cash_amount: entry.cash_amount || "",
    bank_amount: entry.bank_amount || "",
  });
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState("");
  // Already-saved proofs (S3 URLs) vs newly-picked files awaiting upload.
  const [existingProofUrls, setExistingProofUrls] = useState(
    Array.isArray(entry.proof_urls) && entry.proof_urls.length
      ? entry.proof_urls
      : (entry.proof_url ? [entry.proof_url] : [])
  );
  const [pendingProofFiles, setPendingProofFiles] = useState([]);

  const set = (field) => (e) => setForm(prev => ({
    ...prev,
    [field]: e.target.value,
    ...(field === "scheme_type" ? { land_kind_of_payment: "", land_site_name: "", land_layout: "", land_site_number: "", gold_package: "", gold_quantity: "" } : {}),
    ...(field === "land_site_name" ? { land_layout: "" } : {}),
    ...(field === "payment_mode" && e.target.value !== "Cash+Bank" ? { cash_amount: "", bank_amount: "" } : {}),
    ...(field === "gold_package" && e.target.value !== "Single" ? { gold_quantity: "" } : {}),
  }));

  const handleSave = async () => {
    setSaving(true); setError("");

    if (form.payment_mode === "Cash+Bank") {
      const c = Number(form.cash_amount), b = Number(form.bank_amount);
      if (!(c > 0) || !(b > 0)) {
        setError("Cash and Bank amounts must both be greater than 0.");
        setSaving(false); return;
      }
    }

    let proofUrls = [...existingProofUrls];
    if (pendingProofFiles.length) {
      try {
        for (const file of pendingProofFiles) {
          proofUrls.push(await uploadProofFile(file, form.payment_mode, token));
        }
      } catch (err) { setError(err.message || "Upload error. Check your connection."); setSaving(false); return; }
    }
    proofUrls = proofUrls.slice(0, PROOF_MAX_COUNT);

    try {
      const res = await authFetch(`${API_BASE}/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ ...form, proof_url: proofUrls[0] || null, proof_urls: proofUrls }),
      });
      const data = await res.json();
      if (data.success) { onSave(); onClose(); }
      else setError(data.error || "Update failed");
    } catch { setError("Network error"); }
    setSaving(false);
  };

  const isLand = form.scheme_type === "LAND";
  const isGoldOrJewel = form.scheme_type === "GOLD COIN SAVINGS" || form.scheme_type === "JEWEL SAVINGS";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem" }}>Edit Entry #{entry.serial_number}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
        </div>

        {error && <div className="status-banner error" style={{ marginBottom: "1rem", padding: "0.75rem" }}>{error}</div>}

        <SectionTitle icon="📋" title="Basic Details" />
        <div className="grid-2">
          <TextInput label="Date" required type="date" value={form.entry_date} onChange={set("entry_date")} min="2024-01-01" max={todayISO()} />
          <SelectInput label="Branch Name" required value={form.branch_name} onChange={set("branch_name")} options={branches} />
          <TextInput label="Customer Name" required value={form.customer_name} onChange={set("customer_name")} placeholder="Full name" />
          <TextInput label="Phone Number" required type="tel" value={form.phone_number} onChange={set("phone_number")} placeholder="+91 XXXXX XXXXX" />
          <SelectInput label="Payment Mode" required value={form.payment_mode}
            onChange={e => { set("payment_mode")(e); if (e.target.value === "Cash") { setPendingProofFiles([]); setExistingProofUrls([]); } }}
            options={["Cash", "Bank", "GPay", "Cash+Bank"]} />
          {form.payment_mode === "Cash+Bank" ? (
            <>
              <TextInput label="Cash Amount (₹)" required type="number" value={form.cash_amount}
                onChange={e => {
                  const cash = e.target.value;
                  const total = (Number(cash) || 0) + (Number(form.bank_amount) || 0);
                  setForm(f => ({ ...f, cash_amount: cash, amount_paid: total ? String(total) : "" }));
                }} placeholder="0.00" />
              <TextInput label="Bank Amount (₹)" required type="number" value={form.bank_amount}
                onChange={e => {
                  const bank = e.target.value;
                  const total = (Number(form.cash_amount) || 0) + (Number(bank) || 0);
                  setForm(f => ({ ...f, bank_amount: bank, amount_paid: total ? String(total) : "" }));
                }} placeholder="0.00" />
              <TextInput label="Total (₹)" disabled value={form.amount_paid} />
            </>
          ) : (
            <TextInput label="Amount Paid" required type="number" value={form.amount_paid} onChange={set("amount_paid")} placeholder="0.00" />
          )}
          <TextInput label="Transaction Details" value={form.transaction_details} onChange={set("transaction_details")} placeholder="Ref / UTR / cheque no." />
          <SelectInput label="Scheme Type" required value={form.scheme_type} onChange={set("scheme_type")} options={schemes} />
        </div>

        {(form.payment_mode === "GPay" || form.payment_mode === "Bank" || form.payment_mode === "Cash+Bank") && (
          <div style={{ marginTop: "1rem" }}>
            <ProofUploader
              paymentMode={form.payment_mode === "Cash+Bank" ? "Bank" : form.payment_mode}
              pendingFiles={pendingProofFiles}
              existingUrls={existingProofUrls}
              onAddFiles={(files) => setPendingProofFiles(prev => [...prev, ...files])}
              onRemovePending={(i) => setPendingProofFiles(prev => prev.filter((_, idx) => idx !== i))}
              onRemoveExisting={(i) => setExistingProofUrls(prev => prev.filter((_, idx) => idx !== i))}
            />
          </div>
        )}

        <SectionTitle icon="🤝" title="Reference & Officials" />
        <div className="grid-2">
          <PersonRow
            nameLabel="Referred By"
            nameProps={{ value: form.referred_by, onChange: set("referred_by"), placeholder: "Referrer name" }}
            empIdProps={{ value: form.referred_by_emp_id, onChange: set("referred_by_emp_id") }}
            roleProps={{ value: form.referred_by_role, onChange: set("referred_by_role") }}
          />
          <PersonRow
            nameLabel="Higher Official"
            nameProps={{ value: form.higher_official, onChange: set("higher_official"), placeholder: "Official name" }}
            empIdProps={{ value: form.higher_official_emp_id, onChange: set("higher_official_emp_id") }}
            roleProps={{ value: form.higher_official_role, onChange: set("higher_official_role") }}
          />
        </div>
        <div className="field-group full-width" style={{ marginTop: "0.5rem" }}>
          <FieldLabel>Notes</FieldLabel>
          <textarea className="field-input" rows="3" placeholder="Any additional remarks…" value={form.notes} onChange={set("notes")} />
        </div>

        {isLand && (
          <div className="sub-section land-section">
            <SectionTitle icon="🏡" title="Land Scheme Details" />
            <div className="grid-2">
              <SelectInput label="Kind of Payment" value={form.land_kind_of_payment} onChange={set("land_kind_of_payment")} options={["Advance", "Full"]} />
              <SelectInput label="Name of Site" value={form.land_site_name} onChange={set("land_site_name")}
                options={["Maiylam", "Sunrise City", "Veppur Site", "SR Grand City 2", "Melmalaiyanur Site", "SIV City", "Uchimadu", "Kandapankurichi Site"]} />
              <TextInput label="Site Number" value={form.land_site_number} onChange={set("land_site_number")} placeholder="e.g. Plot 42" />
              {form.land_site_name === "Veppur Site" && (
                <SelectInput label="Veppur Layout" value={form.land_layout} onChange={set("land_layout")} options={veppurOptions} />
              )}
              {form.land_site_name === "Melmalaiyanur Site" && (
                <SelectInput label="Melmalaiyanur Layout" value={form.land_layout} onChange={set("land_layout")} options={melmalaiyanurOpts} />
              )}
              {form.land_site_name === "Kandapankurichi Site" && (
                <SelectInput label="Kandapankurichi Layout" value={form.land_layout} onChange={set("land_layout")} options={kandapankurichiOpts} />
              )}
            </div>
          </div>
        )}

        {isGoldOrJewel && (
          <div className="sub-section gold-section">
            <SectionTitle icon="💎" title="Gold / Jewel Savings Details" />
            <div className="grid-2">
              <SelectInput label="Package" value={form.gold_package} onChange={set("gold_package")} options={["Single", "Full"]} />
              {form.gold_package === "Single" && (
                <TextInput
                  label="Quantity"
                  type="number"
                  value={form.gold_quantity}
                  onChange={set("gold_quantity")}
                  min="1"
                  max={form.scheme_type === "GOLD COIN SAVINGS" ? 15 : 19}
                  placeholder={`1 – ${form.scheme_type === "GOLD COIN SAVINGS" ? 15 : 19}`}
                />
              )}
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
          <button className="cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="submit-btn" onClick={handleSave} disabled={saving} style={{ minWidth: "120px", justifyContent: "center" }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Management Panel ────────────────────────────────────────────────────
function UserManagementPanel({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    authFetch(`${API_BASE}/users`, { headers: { "Authorization": `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.success) setUsers(data.data); })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [token]);

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setFeedback({ type: "error", msg: "Password must be at least 6 characters" });
      return;
    }
    setResetting(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ userId: resetTarget.id, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", msg: data.message });
        setResetTarget(null); setNewPassword(""); setShowPwd(false);
      } else {
        setFeedback({ type: "error", msg: data.error });
      }
    } catch { setFeedback({ type: "error", msg: "Network error" }); }
    setResetting(false);
  };

  return (
    <div className="admin-panel" style={{ marginTop: "1.5rem" }}>
      <div className="admin-panel-header">
        <div>
          <div className="admin-panel-title">User Management</div>
          <div className="admin-panel-sub">{users.length} users</div>
        </div>
      </div>

      {feedback && (
        <div className={`status-banner ${feedback.type}`} style={{ margin: "0 0 1rem", padding: "0.75rem" }}>
          {feedback.msg}
          <button onClick={() => setFeedback(null)} style={{ float: "right", background: "none", border: "none", cursor: "pointer", fontWeight: "bold" }}>&times;</button>
        </div>
      )}

      {loading ? (
        <div className="admin-empty">Loading users...</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table user-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Branch</th>
                <th>Role</th>
                <th style={{ width: "220px" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="tr-even">
                  <td>{u.email}</td>
                  <td className="td-branch">{u.branch_name}</td>
                  <td>
                    <span className={`role-badge role-${u.role}`}>{u.role}</span>
                  </td>
                  <td>
                    {resetTarget?.id === u.id ? (
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <div style={{ position: "relative", flex: 1 }}>
                          <input
                            type={showPwd ? "text" : "password"}
                            className="field-input"
                            placeholder="New password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            style={{ fontSize: "0.8rem", padding: "0.3rem 2rem 0.3rem 0.5rem" }}
                          />
                          <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position: "absolute", right: "0.4rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "0.75rem" }}>
                            {showPwd ? "🙈" : "👁"}
                          </button>
                        </div>
                        <button className="action-btn edit-btn" onClick={handleReset} disabled={resetting}>
                          {resetting ? "..." : "Set"}
                        </button>
                        <button className="action-btn delete-btn" onClick={() => { setResetTarget(null); setNewPassword(""); setShowPwd(false); }}>
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button className="action-btn edit-btn" onClick={() => { setResetTarget(u); setNewPassword(""); setFeedback(null); setShowPwd(false); }}>
                        Reset Password
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Management Dashboard ─────────────────────────────────────────────────────
function ManagementDashboard({ onLogout, token }) {
  const now = new Date();
  const today = todayISTStr();
  const { periodStart, periodEnd, periodLabel } = getCurrentBillingPeriod(now);
  const monthName = periodLabel;

  const [filterBranch, setFilterBranch] = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");
  const isFiltered = filterBranch || dateFrom || dateTo;
  const clearFilters = () => { setFilterBranch(""); setDateFrom(""); setDateTo(""); };

  const [stats, setStats]           = useState(null);
  const [entries, setEntries]       = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statsLoading, setStatsLoading]     = useState(true);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [exporting, setExporting]           = useState(false);
  const [refetchKey, setRefetchKey]         = useState(0);

  const [activeTab, setActiveTab]         = useState("dashboard");
  const [editingEntry, setEditingEntry]   = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting]           = useState(false);
  const [feedback, setFeedback]           = useState(null);

  const [colWidths, startResize] = useResizableColumns([60, 100, 140, 160, 120, 110, 90, 70, 185, 170, 170, 160, 130, 110]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize]       = useState(50);

  useEffect(() => { setCurrentPage(1); }, [filterBranch, dateFrom, dateTo]);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const baseParams = () =>
    `branch=ALL${filterBranch ? `&filterBranch=${encodeURIComponent(filterBranch)}` : ""}${dateFrom ? `&date_from=${dateFrom}` : ""}${dateTo ? `&date_to=${dateTo}` : ""}`;

  useEffect(() => {
    setStatsLoading(true);
    fetch(`${API_BASE}/entries/stats?${baseParams()}&today=${today}&periodStart=${periodStart}&periodEnd=${periodEnd}`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [filterBranch, dateFrom, dateTo, refetchKey]);

  useEffect(() => {
    setEntriesLoading(true);
    fetch(`${API_BASE}/entries?${baseParams()}&page=${currentPage}&pageSize=${pageSize}`)
      .then(r => r.json())
      .then(d => { if (d.success) { setEntries(d.data); setTotalCount(d.totalCount || 0); } })
      .catch(() => {})
      .finally(() => setEntriesLoading(false));
  }, [filterBranch, dateFrom, dateTo, currentPage, pageSize, refetchKey]);

  const refetchAll = () => setRefetchKey(k => k + 1);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res  = await fetch(`${API_BASE}/entries?${baseParams()}`);
      const data = await res.json();
      if (data.success) exportToCSV(data.data);
    } catch {}
    setExporting(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res  = await authFetch(`${API_BASE}/entries/${deleteConfirm.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", msg: "Entry deleted successfully" });
        refetchAll();
      } else {
        setFeedback({ type: "error", msg: data.error });
      }
    } catch { setFeedback({ type: "error", msg: "Network error" }); }
    setDeleteConfirm(null);
    setDeleting(false);
  };

  const totalEntries      = stats?.totalEntries    ?? 0;
  const totalRevenue      = stats?.totalRevenue    ?? 0;
  const todayCount        = stats?.todayCount      ?? 0;
  const todayRevenue      = stats?.todayRevenue    ?? 0;
  const thisMonthRevenue  = stats?.periodRevenue   ?? 0;
  const revenueByScheme   = stats?.revenueByScheme ?? {};
  const countByScheme     = stats?.countByScheme   ?? {};
  const todayByScheme     = stats?.todayByScheme   ?? {};
  const uniqueBranchCount = stats?.uniqueBranchCount ?? 0;
  const schemeCount       = Object.keys(revenueByScheme).length;

  return (
    <div className="admin-layout">
      {/* Feedback Toast */}
      {feedback && (
        <div className={`feedback-toast ${feedback.type}`}>{feedback.msg}</div>
      )}

      {/* Edit Modal */}
      {editingEntry && (
        <EditEntryModal
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSave={() => { setFeedback({ type: "success", msg: "Entry updated successfully" }); refetchAll(); }}
          token={token}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <ConfirmDialog
          title="Delete Entry"
          message={`Are you sure you want to delete entry #${deleteConfirm.serial_number} for "${deleteConfirm.customer_name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(null)}
          loading={deleting}
        />
      )}

      {/* Top Bar */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <img src="/AVG_logo.jpeg" alt="Logo" className="admin-logo" />
          <div className="admin-brand">
            <span className="admin-brand-name">Agilavetri PrimeTech</span>
            <span className="admin-brand-sub">Management Dashboard</span>
          </div>
        </div>
        <div className="admin-topbar-center">
          <div className="mgmt-tabs">
            <button className={`mgmt-tab ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>
              Dashboard
            </button>
            <button className={`mgmt-tab ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>
              User Management
            </button>
          </div>
        </div>
        <div className="admin-topbar-right">
          <div className="admin-user-badge mgmt-badge">
            <span>🛡</span>
            <span>Management</span>
          </div>
          <button className="admin-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main className="admin-main">
        {activeTab === "users" ? (
          <UserManagementPanel token={token} />
        ) : (
          <>
            {/* Filter Bar */}
            <div className="admin-filter-bar">
              <div className="admin-filter-label">
                <span>🔍</span>
                <span>Filters</span>
                {isFiltered && <span className="filter-active-badge">Active</span>}
              </div>
              <div className="admin-filter-controls">
                <div className="field-group" style={{ minWidth: "180px", flex: 1 }}>
                  <label className="field-label">Branch</label>
                  <select className="field-input" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="field-group" style={{ minWidth: "150px", flex: 1 }}>
                  <label className="field-label">From Date</label>
                  <input type="date" className="field-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div className="field-group" style={{ minWidth: "150px", flex: 1 }}>
                  <label className="field-label">To Date</label>
                  <input type="date" className="field-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
                {isFiltered && (
                  <button className="admin-clear-btn" onClick={clearFilters}>✕ Clear</button>
                )}
              </div>
            </div>

            {/* KPI Cards */}
            <div className="kpi-grid">
              <div className="kpi-card" data-color="blue">
                <div className="kpi-top">
                  <span className="kpi-icon-wrap kpi-icon-blue">📋</span>
                  <span className="kpi-badge">{isFiltered ? "Filtered" : "All time"}</span>
                </div>
                <div className="kpi-value">{statsLoading ? "…" : totalEntries.toLocaleString()}</div>
                <div className="kpi-label">Total Entries</div>
              </div>
              <div className="kpi-card" data-color="purple">
                <div className="kpi-top">
                  <span className="kpi-icon-wrap kpi-icon-purple">📅</span>
                  <span className="kpi-badge">{isFiltered ? monthName : "All time"}</span>
                </div>
                <div className="kpi-value">₹{statsLoading ? "…" : (isFiltered ? thisMonthRevenue : totalRevenue).toLocaleString()}</div>
                <div className="kpi-label">{isFiltered ? "This Period" : "All Time Revenue"}</div>
              </div>
              <div className="kpi-card" data-color="green">
                <div className="kpi-top">
                  <span className="kpi-icon-wrap kpi-icon-green">💰</span>
                  <span className="kpi-badge">{isFiltered ? "Filtered" : monthName}</span>
                </div>
                <div className="kpi-value">₹{statsLoading ? "…" : (isFiltered ? totalRevenue : thisMonthRevenue).toLocaleString()}</div>
                <div className="kpi-label">{isFiltered ? "Filtered Revenue" : "Period Revenue"}</div>
              </div>
              <div className="kpi-card" data-color="orange">
                <div className="kpi-top">
                  <span className="kpi-icon-wrap kpi-icon-orange">⚡</span>
                  <span className="kpi-badge">{todayCount} entries</span>
                </div>
                <div className="kpi-value">₹{statsLoading ? "…" : todayRevenue.toLocaleString()}</div>
                <div className="kpi-label">Today's Revenue</div>
              </div>
            </div>

            {/* Middle Row: Scheme Breakdown + Overview */}
            <div className="admin-mid-row">
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <div className="admin-panel-title">Revenue by Scheme</div>
                    <div className="admin-panel-sub">{schemeCount} active scheme{schemeCount !== 1 ? "s" : ""}</div>
                  </div>
                </div>
                {schemeCount === 0 ? (
                  <div className="admin-empty">{statsLoading ? "Loading…" : "No revenue data yet."}</div>
                ) : (
                  <div className="scheme-list">
                    {Object.entries(revenueByScheme)
                      .sort(([, a], [, b]) => b - a)
                      .map(([scheme, total]) => {
                        const pct   = totalRevenue > 0 ? Math.round((total / totalRevenue) * 100) : 0;
                        const color = SCHEME_COLORS[scheme] || "#6b7280";
                        return (
                          <div key={scheme} className="scheme-row">
                            <div className="scheme-row-top">
                              <span className="scheme-dot" style={{ background: color }} />
                              <span className="scheme-name">{scheme}</span>
                              <span className="scheme-count-pill">{countByScheme[scheme]}</span>
                              <span className="scheme-amount">₹{total.toLocaleString()}</span>
                            </div>
                            <div className="scheme-bar-track">
                              <div className="scheme-bar-fill" style={{ width: `${pct}%`, background: color }} />
                            </div>
                            <div className="scheme-pct-label">{pct}%</div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="admin-panel admin-panel-sm">
                <div className="admin-panel-header">
                  <div className="admin-panel-title">Overview</div>
                </div>
                <div className="overview-list">
                  <div className="overview-row">
                    <span className="overview-label">Active Branches</span>
                    <span className="overview-value">{uniqueBranchCount}</span>
                  </div>
                  <div className="overview-row">
                    <span className="overview-label">Schemes Active</span>
                    <span className="overview-value">{schemeCount}</span>
                  </div>
                  <div className="overview-row">
                    <span className="overview-label">Entries Today</span>
                    <span className="overview-value">{todayCount}</span>
                  </div>
                </div>
                <div className="today-section">
                  <div className="today-section-title">Today by Scheme</div>
                  {Object.keys(todayByScheme).length === 0 ? (
                    <div className="admin-empty-sm">{statsLoading ? "Loading…" : "No entries recorded today."}</div>
                  ) : (
                    <div className="today-list">
                      {Object.entries(todayByScheme)
                        .sort(([, a], [, b]) => b - a)
                        .map(([scheme, amt]) => (
                          <div key={scheme} className="today-row">
                            <span className="today-dot" style={{ background: SCHEME_COLORS[scheme] || "#6b7280" }} />
                            <span className="today-scheme">{scheme}</span>
                            <span className="today-amt">₹{amt.toLocaleString()}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Entries Table with Edit/Delete */}
            <div className="admin-panel admin-table-panel">
              <div className="admin-table-header">
                <div>
                  <div className="admin-panel-title">
                    All Entries
                    <span className="entry-count-badge">{totalCount}</span>
                  </div>
                  <div className="admin-panel-sub">
                    {isFiltered
                      ? [filterBranch || "All Branches", dateFrom && `From ${dateFrom}`, dateTo && `To ${dateTo}`].filter(Boolean).join(" · ")
                      : "All branches · All time"}
                  </div>
                </div>
                {totalCount > 0 && (
                  <button className="export-btn" onClick={handleExportCSV} disabled={exporting}>
                    {exporting ? "Exporting…" : "📥 Export CSV"}
                  </button>
                )}
              </div>

              {entriesLoading ? (
                <div className="admin-empty" style={{ padding: "3rem" }}>Loading entries…</div>
              ) : totalCount === 0 ? (
                <div className="admin-empty" style={{ padding: "3rem" }}>
                  No entries found. Adjust filters or add data from a branch.
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table" style={{ tableLayout: "fixed" }}>
                    <colgroup>
                      {colWidths.map((w, i) => <col key={i} style={{ width: w + "px" }} />)}
                    </colgroup>
                    <thead>
                      <tr>
                        {["S.No", "Date", "Branch", "Customer", "Phone", "Amount", "Mode", "Proof", "Scheme", "Referred By", "Higher Official", "Land / Gold", "Notes", "Actions"].map((h, i) => (
                          <th key={h} style={{ position: "relative" }}>
                            {h}<ResizeHandle onMouseDown={e => startResize(i, e)} />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e, idx) => {
                        const color    = SCHEME_COLORS[e.scheme_type] || "#6b7280";
                        const landInfo = e.land_kind_of_payment
                          ? [e.land_kind_of_payment, e.land_site_name, e.land_layout, e.land_site_number && `#${e.land_site_number}`].filter(Boolean).join(" · ")
                          : e.gold_package ? `Gold: ${e.gold_package}${e.gold_quantity ? ` ×${e.gold_quantity}` : ""}` : "-";
                        if (e.is_no_collection) return <NoCollectionRow key={e.id} entry={e} blankCols={10} />;
                        return (
                          <tr key={e.id} className={idx % 2 === 0 ? "tr-even" : "tr-odd"}>
                            <td className="td-mono">{e.serial_number || "-"}</td>
                            <td className="td-nowrap">{formatDateToDDMMYYYY(e.entry_date)}</td>
                            <td className="td-branch">{e.branch_name}</td>
                            <td>{e.customer_name}</td>
                            <td className="td-mono">{e.phone_number}</td>
                            <td className="td-amount">
                          ₹{Number(e.amount_paid).toLocaleString()}
                          {e.payment_mode === "Cash+Bank" && (
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted, #6b7280)" }}>
                              C ₹{Number(e.cash_amount).toLocaleString()} / B ₹{Number(e.bank_amount).toLocaleString()}
                            </div>
                          )}
                        </td>
                            <td>
                              <span className={`mode-badge mode-${(e.payment_mode || "").toLowerCase().replace(/\+/g, "")}`}>
                                {e.payment_mode}
                              </span>
                            </td>
                            <td><ProofLink proofUrl={e.proof_url} proofUrls={e.proof_urls} /></td>
                            <td>
                              <span className="scheme-tag" style={{ background: `${color}18`, color, borderColor: `${color}40` }}>
                                {e.scheme_type}
                              </span>
                            </td>
                            <td className="td-clip">
                              {e.referred_by ? `${e.referred_by}${e.referred_by_role ? ` (${e.referred_by_role})` : ""}` : "-"}
                            </td>
                            <td className="td-clip">
                              {e.higher_official ? `${e.higher_official}${e.higher_official_role ? ` (${e.higher_official_role})` : ""}` : "-"}
                            </td>
                            <td className="td-clip">{landInfo}</td>
                            <td className="td-notes">{e.notes || "-"}</td>
                            <td>
                              <button className="action-btn edit-btn" onClick={() => setEditingEntry(e)}>Edit</button>
                              <button className="action-btn delete-btn" onClick={() => setDeleteConfirm(e)}>Delete</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pagination
                    total={totalCount}
                    page={currentPage}
                    pageSize={pageSize}
                    onPage={setCurrentPage}
                    onPageSize={setPageSize}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Director Dashboard ────────────────────────────────────────────────────────
function DirectorDashboard({ onLogout, directorBranches, directorName, roleLabel = "Director" }) {
  const now = new Date();
  const today = todayISTStr();
  const { periodStart, periodEnd, periodLabel } = getCurrentBillingPeriod(now);
  const monthName = periodLabel;

  // Self-managed state
  const [filterBranch, setFilterBranch] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState(periodStart);
  const [filterDateTo, setFilterDateTo] = useState(periodEnd);
  const [entries, setEntries] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [colWidths, startResize] = useResizableColumns([60, 100, 140, 160, 120, 110, 90, 70, 185, 170, 170, 160, 130]);

  const isFiltered = filterBranch || filterDateFrom || filterDateTo;
  const myBranches = directorBranches || [];
  const branchesParam = myBranches.join(",");

  // Build common query string for director branch + date filters
  const buildFilterQS = () => {
    let qs = `directorBranches=${encodeURIComponent(branchesParam)}`;
    if (filterBranch) qs += `&filterBranch=${encodeURIComponent(filterBranch)}`;
    if (filterDateFrom) qs += `&date_from=${filterDateFrom}`;
    if (filterDateTo) qs += `&date_to=${filterDateTo}`;
    return qs;
  };

  // Fetch paginated entries
  useEffect(() => {
    setLoading(true);
    const url = `${API_BASE}/entries?${buildFilterQS()}&page=${currentPage}&pageSize=${pageSize}`;
    fetch(url).then(r => r.json()).then(data => {
      if (data.success) { setEntries(data.data); setTotalCount(data.totalCount || 0); }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [filterBranch, filterDateFrom, filterDateTo, currentPage, pageSize]);

  // Fetch stats (lightweight aggregates)
  useEffect(() => {
    const qs = buildFilterQS();
    const url = `${API_BASE}/entries/stats?${qs}&today=${today}&periodStart=${periodStart}&periodEnd=${periodEnd}`;
    fetch(url).then(r => r.json()).then(data => { if (data.success) setStats(data); }).catch(() => {});
  }, [filterBranch, filterDateFrom, filterDateTo]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [filterBranch, filterDateFrom, filterDateTo]);

  // Export ALL matching entries (no pagination)
  const handleExport = async () => {
    try {
      const url = `${API_BASE}/entries?${buildFilterQS()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) exportToCSV(data.data);
    } catch { alert("Export failed"); }
  };

  const clearFilters = () => { setFilterBranch(""); setFilterDateFrom(""); setFilterDateTo(""); };

  // Derive display values from stats
  const totalEntries = stats?.totalEntries || 0;
  const totalRevenue = stats?.totalRevenue || 0;
  const todayCount = stats?.todayCount || 0;
  const todayRevenue = stats?.todayRevenue || 0;
  const thisMonthRevenue = stats?.periodRevenue || 0;
  const revenueByScheme = stats?.revenueByScheme || {};
  const countByScheme = stats?.countByScheme || {};
  const todayByScheme = stats?.todayByScheme || {};
  const uniqueBranchCount = stats?.uniqueBranchCount || 0;
  const schemeCount = Object.keys(revenueByScheme).length;

  return (
    <div className="admin-layout">
      {/* Top Bar */}
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <img src="/AVG_logo.jpeg" alt="Logo" className="admin-logo" />
          <div className="admin-brand">
            <span className="admin-brand-name">Agilavetri PrimeTech</span>
            <span className="admin-brand-sub">{roleLabel} Dashboard — {directorName}</span>
          </div>
        </div>
        <div className="admin-topbar-right">
          <div className="admin-user-badge" style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
            <span>🏢</span>
            <span>{roleLabel}</span>
          </div>
          <button className="admin-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main className="admin-main">

        {/* Filter Bar */}
        <div className="admin-filter-bar">
          <div className="admin-filter-label">
            <span>🔍</span>
            <span>Filters</span>
            {isFiltered && <span className="filter-active-badge">Active</span>}
          </div>
          <div className="admin-filter-controls">
            <div className="field-group" style={{ minWidth: "180px", flex: 1 }}>
              <label className="field-label">Branch</label>
              <select className="field-input" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                <option value="">All My Branches</option>
                {myBranches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="field-group" style={{ minWidth: "150px", flex: 1 }}>
              <label className="field-label">From Date</label>
              <input type="date" className="field-input" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="field-group" style={{ minWidth: "150px", flex: 1 }}>
              <label className="field-label">To Date</label>
              <input type="date" className="field-input" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            {isFiltered && (
              <button className="admin-clear-btn" onClick={clearFilters}>✕ Clear</button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card" data-color="blue">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-blue">📋</span>
              <span className="kpi-badge">{isFiltered ? "Filtered" : "All time"}</span>
            </div>
            <div className="kpi-value">{totalEntries.toLocaleString()}</div>
            <div className="kpi-label">Total Entries</div>
          </div>
          <div className="kpi-card" data-color="purple">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-purple">📅</span>
              <span className="kpi-badge">{isFiltered ? monthName : "All time"}</span>
            </div>
            <div className="kpi-value">₹{(isFiltered ? thisMonthRevenue : totalRevenue).toLocaleString()}</div>
            <div className="kpi-label">{isFiltered ? "This Period" : "All Time Revenue"}</div>
          </div>
          <div className="kpi-card" data-color="green">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-green">💰</span>
              <span className="kpi-badge">{isFiltered ? "Filtered" : monthName}</span>
            </div>
            <div className="kpi-value">₹{(isFiltered ? totalRevenue : thisMonthRevenue).toLocaleString()}</div>
            <div className="kpi-label">{isFiltered ? "Filtered Revenue" : "Period Revenue"}</div>
          </div>
          <div className="kpi-card" data-color="orange">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-orange">⚡</span>
              <span className="kpi-badge">{todayCount} entries</span>
            </div>
            <div className="kpi-value">₹{todayRevenue.toLocaleString()}</div>
            <div className="kpi-label">Today's Revenue</div>
          </div>
        </div>

        {/* Middle Row: Scheme Breakdown + Overview */}
        <div className="admin-mid-row">

          {/* Scheme Breakdown */}
          <div className="admin-panel">
            <div className="admin-panel-header">
              <div>
                <div className="admin-panel-title">Revenue by Scheme</div>
                <div className="admin-panel-sub">{schemeCount} active scheme{schemeCount !== 1 ? "s" : ""}</div>
              </div>
            </div>
            {schemeCount === 0 ? (
              <div className="admin-empty">No revenue data yet.</div>
            ) : (
              <div className="scheme-list">
                {Object.entries(revenueByScheme)
                  .sort(([, a], [, b]) => b - a)
                  .map(([scheme, total]) => {
                    const pct = totalRevenue > 0 ? Math.round((total / totalRevenue) * 100) : 0;
                    const color = SCHEME_COLORS[scheme] || "#6b7280";
                    return (
                      <div key={scheme} className="scheme-row">
                        <div className="scheme-row-top">
                          <span className="scheme-dot" style={{ background: color }} />
                          <span className="scheme-name">{scheme}</span>
                          <span className="scheme-count-pill">{countByScheme[scheme]}</span>
                          <span className="scheme-amount">₹{total.toLocaleString()}</span>
                        </div>
                        <div className="scheme-bar-track">
                          <div className="scheme-bar-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <div className="scheme-pct-label">{pct}%</div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Overview + Today's Breakdown */}
          <div className="admin-panel admin-panel-sm">
            <div className="admin-panel-header">
              <div className="admin-panel-title">Overview</div>
            </div>
            <div className="overview-list">
              <div className="overview-row">
                <span className="overview-label">My Branches</span>
                <span className="overview-value">{myBranches.length}</span>
              </div>
              <div className="overview-row">
                <span className="overview-label">Active Branches</span>
                <span className="overview-value">{uniqueBranchCount}</span>
              </div>
              <div className="overview-row">
                <span className="overview-label">Entries Today</span>
                <span className="overview-value">{todayCount}</span>
              </div>
            </div>

            <div className="today-section">
              <div className="today-section-title">Today by Scheme</div>
              {Object.keys(todayByScheme).length === 0 ? (
                <div className="admin-empty-sm">No entries recorded today.</div>
              ) : (
                <div className="today-list">
                  {Object.entries(todayByScheme)
                    .sort(([, a], [, b]) => b - a)
                    .map(([scheme, amt]) => (
                      <div key={scheme} className="today-row">
                        <span className="today-dot" style={{ background: SCHEME_COLORS[scheme] || "#6b7280" }} />
                        <span className="today-scheme">{scheme}</span>
                        <span className="today-amt">₹{amt.toLocaleString()}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Entries Table */}
        <div className="admin-panel admin-table-panel">
          <div className="admin-table-header">
            <div>
              <div className="admin-panel-title">
                All Entries
                <span className="entry-count-badge">{totalCount}</span>
              </div>
              <div className="admin-panel-sub">
                {isFiltered
                  ? [filterBranch || "All My Branches", filterDateFrom && `From ${filterDateFrom}`, filterDateTo && `To ${filterDateTo}`].filter(Boolean).join(" · ")
                  : `All my branches · All time`}
              </div>
            </div>
            {totalCount > 0 && (
              <button className="export-btn" onClick={handleExport}>
                📥 Export CSV
              </button>
            )}
          </div>

          {totalCount === 0 && !loading ? (
            <div className="admin-empty" style={{ padding: "3rem" }}>
              No entries found. Adjust filters or wait for branch data.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  {colWidths.map((w, i) => <col key={i} style={{ width: w + "px" }} />)}
                </colgroup>
                <thead>
                  <tr>
                    {["S.No", "Date", "Branch", "Customer", "Phone", "Amount", "Mode", "Proof", "Scheme", "Referred By", "Higher Official", "Land / Gold", "Notes"].map((h, i) => (
                      <th key={h} style={{ position: "relative" }}>
                        {h}<ResizeHandle onMouseDown={e => startResize(i, e)} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, idx) => {
                    const color = SCHEME_COLORS[e.scheme_type] || "#6b7280";
                    const landInfo = e.land_kind_of_payment
                      ? [e.land_kind_of_payment, e.land_site_name, e.land_layout, e.land_site_number && `#${e.land_site_number}`].filter(Boolean).join(" · ")
                      : e.gold_package ? `Gold: ${e.gold_package}${e.gold_quantity ? ` ×${e.gold_quantity}` : ""}` : "-";
                    if (e.is_no_collection) return <NoCollectionRow key={e.id} entry={e} blankCols={9} />;
                    return (
                      <tr key={e.id} className={idx % 2 === 0 ? "tr-even" : "tr-odd"}>
                        <td className="td-mono">{e.serial_number || "-"}</td>
                        <td className="td-nowrap">{formatDateToDDMMYYYY(e.entry_date)}</td>
                        <td className="td-branch">{e.branch_name}</td>
                        <td>{e.customer_name}</td>
                        <td className="td-mono">{e.phone_number}</td>
                        <td className="td-amount">
                          ₹{Number(e.amount_paid).toLocaleString()}
                          {e.payment_mode === "Cash+Bank" && (
                            <div style={{ fontSize: "0.7rem", color: "var(--text-muted, #6b7280)" }}>
                              C ₹{Number(e.cash_amount).toLocaleString()} / B ₹{Number(e.bank_amount).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`mode-badge mode-${(e.payment_mode || "").toLowerCase().replace(/\+/g, "")}`}>
                            {e.payment_mode}
                          </span>
                        </td>
                        <td><ProofLink proofUrl={e.proof_url} proofUrls={e.proof_urls} /></td>
                        <td>
                          <span className="scheme-tag" style={{ background: `${color}18`, color, borderColor: `${color}40` }}>
                            {e.scheme_type}
                          </span>
                        </td>
                        <td className="td-clip">
                          {e.referred_by ? `${e.referred_by}${e.referred_by_role ? ` (${e.referred_by_role})` : ""}` : "-"}
                        </td>
                        <td className="td-clip">
                          {e.higher_official ? `${e.higher_official}${e.higher_official_role ? ` (${e.higher_official_role})` : ""}` : "-"}
                        </td>
                        <td className="td-clip">{landInfo}</td>
                        <td className="td-notes">{e.notes || "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                total={totalCount}
                page={currentPage}
                pageSize={pageSize}
                onPage={setCurrentPage}
                onPageSize={setPageSize}
              />
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

// ── Follow Up Dashboard ───────────────────────────────────────────────────────
function FollowUpDashboard({ onLogout }) {
  const today = todayISTStr();
  const [date, setDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const token = localStorage.getItem("token");

  const fetchData = async (d) => {
    setLoading(true); setError("");
    try {
      const res = await authFetch(`${API_BASE}/follow-up?date=${d}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) { onLogout(); return; }
      const json = await res.json();
      if (json.success) setData(json);
      else setError(json.error || "Failed to load data");
    } catch { setError("Network error"); }
    setLoading(false);
  };

  useEffect(() => { fetchData(date); }, [date]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => fetchData(date), 60000);
    return () => clearInterval(id);
  }, [date]);

  const isToday = date === today;
  const pct = data ? Math.round((data.submittedCount / Math.max((data.totalBranches || 1) - (data.noCollectionCount || 0), 1)) * 100) : 0;

  return (
    <div className="admin-layout">
      <header className="admin-topbar">
        <div className="admin-topbar-left">
          <img src="/AVG_logo.jpeg" alt="Logo" className="admin-logo" />
          <div className="admin-brand">
            <span className="admin-brand-name">Agilavetri PrimeTech</span>
            <span className="admin-brand-sub">Follow Up Dashboard</span>
          </div>
        </div>
        <div className="admin-topbar-right">
          <div className="admin-user-badge" style={{ background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
            <span>📋</span>
            <span>Follow Up</span>
          </div>
          <button className="admin-logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <main className="admin-main">
        {/* Date + Refresh bar */}
        <div className="fu-date-bar">
          <label style={{ fontWeight: 600, color: "var(--text-muted)", fontSize: "0.9rem" }}>Check Date:</label>
          <input
            type="date"
            className="field-input"
            value={date}
            max={today}
            onChange={e => setDate(e.target.value)}
            style={{ maxWidth: "180px", width: "100%" }}
          />
          {!isToday && (
            <button
              onClick={() => setDate(today)}
              style={{ background: "none", border: "1px solid var(--border-light)", borderRadius: "6px", padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-muted)" }}
            >
              Back to Today
            </button>
          )}
          <button
            onClick={() => fetchData(date)}
            disabled={loading}
            style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: "6px", padding: "0.4rem 0.9rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>Auto-refreshes every 60s</span>
        </div>

        {error && <div className="status-banner error" style={{ marginBottom: "1rem", padding: "0.75rem" }}>{error}</div>}

        {data && (
          <>
            {/* KPI Cards */}
            <div className="kpi-grid fu-kpi-grid">
              <div className="kpi-card" data-color="blue">
                <div className="kpi-top"><span className="kpi-icon-wrap kpi-icon-blue">🏢</span></div>
                <div className="kpi-value">{data.totalBranches}</div>
                <div className="kpi-label">Total Active Branches</div>
              </div>
              <div className="kpi-card" data-color="green">
                <div className="kpi-top"><span className="kpi-icon-wrap kpi-icon-green">✅</span></div>
                <div className="kpi-value">{data.submittedCount}</div>
                <div className="kpi-label">Submitted</div>
              </div>
              <div className="kpi-card" data-color="orange">
                <div className="kpi-top"><span className="kpi-icon-wrap kpi-icon-orange">⚠️</span></div>
                <div className="kpi-value">{data.missingCount}</div>
                <div className="kpi-label">Not Submitted</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-top"><span className="kpi-icon-wrap" style={{ background: "#f3f4f6" }}>🚫</span></div>
                <div className="kpi-value">{data.noCollectionCount || 0}</div>
                <div className="kpi-label">No Collections</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ margin: "1.25rem 0", background: "var(--surface-alt)", borderRadius: "8px", padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem", fontSize: "0.85rem", fontWeight: 600 }}>
                <span style={{ color: "#059669" }}>Submitted {data.submittedCount}</span>
                <span style={{ color: "#dc2626" }}>Missing {data.missingCount}</span>
                <span style={{ color: "#6b7280" }}>No Collections {data.noCollectionCount || 0}</span>
              </div>
              <div style={{ height: "10px", borderRadius: "99px", background: "#fee2e2", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "#059669", borderRadius: "99px", transition: "width 0.5s" }} />
              </div>
              <div style={{ textAlign: "center", marginTop: "0.4rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {pct}% branches submitted for {date}
              </div>
            </div>

            {/* Two-column: Missing | Submitted */}
            <div className="fu-two-col">

              {/* Missing */}
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <div className="admin-panel-title" style={{ color: "#dc2626" }}>
                      Not Submitted &nbsp;<span style={{ fontSize: "1rem" }}>({data.missingCount})</span>
                    </div>
                    <div className="admin-panel-sub">Branches with no entry for {date}</div>
                  </div>
                </div>
                {data.missingCount === 0 ? (
                  <div className="admin-empty" style={{ color: "#059669" }}>All branches have submitted!</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0.25rem 0" }}>
                    {data.missing.map(b => (
                      <span key={b} style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.82rem", fontWeight: 600 }}>
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Submitted */}
              <div className="admin-panel">
                <div className="admin-panel-header">
                  <div>
                    <div className="admin-panel-title" style={{ color: "#059669" }}>
                      Submitted &nbsp;<span style={{ fontSize: "1rem" }}>({data.submittedCount})</span>
                    </div>
                    <div className="admin-panel-sub">Branches with entries for {date}</div>
                  </div>
                </div>
                {data.submittedCount === 0 ? (
                  <div className="admin-empty">No branches have submitted yet.</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0.25rem 0" }}>
                    {data.submitted.map(b => (
                      <span key={b} style={{ background: "#dcfce7", color: "#059669", border: "1px solid #86efac", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.82rem", fontWeight: 600 }}>
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* No Collections Today */}
            {data.noCollection && data.noCollection.length > 0 && (
              <div className="admin-panel" style={{ marginTop: "1.5rem" }}>
                <div className="admin-panel-header">
                  <div>
                    <div className="admin-panel-title" style={{ color: "#6b7280" }}>
                      No Collections Today &nbsp;<span style={{ fontSize: "1rem" }}>({data.noCollectionCount})</span>
                    </div>
                    <div className="admin-panel-sub">Branches that marked themselves as having no collections for {date}</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0.25rem 0" }}>
                  {data.noCollection.map(b => (
                    <span key={b} style={{ background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.82rem", fontWeight: 600 }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Never Entered */}
            {data.neverEntered && data.neverEntered.length > 0 && (
              <div className="admin-panel" style={{ marginTop: "1.5rem" }}>
                <div className="admin-panel-header">
                  <div>
                    <div className="admin-panel-title" style={{ color: "#7c3aed" }}>
                      Never Submitted &nbsp;<span style={{ fontSize: "1rem" }}>({data.neverEnteredCount})</span>
                    </div>
                    <div className="admin-panel-sub">These branches have never entered any data</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "0.25rem 0" }}>
                  {data.neverEntered.map(b => (
                    <span key={b} style={{ background: "#ede9fe", color: "#7c3aed", border: "1px solid #c4b5fd", borderRadius: "6px", padding: "0.4rem 0.75rem", fontSize: "0.82rem", fontWeight: 600 }}>
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {loading && !data && <div className="admin-empty">Loading…</div>}
      </main>
    </div>
  );
}

// ── Branch Stats ─────────────────────────────────────────────────────────────
function BranchStats({ branch, refreshKey, filterDate }) {
  const now = new Date();
  const today = todayISTStr();
  const { periodStart, periodEnd, periodLabel } = getCurrentBillingPeriod(now);
  const monthName = periodLabel;
  const selectedDate = filterDate || today;
  const isToday = selectedDate === today;

  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/entries/stats?branch=${encodeURIComponent(branch)}&today=${selectedDate}&periodStart=${periodStart}&periodEnd=${periodEnd}`)
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d); })
      .catch(() => {});
  }, [branch, refreshKey, selectedDate]);

  if (!stats || stats.totalEntries === 0) return null;

  const totalEntries   = stats.totalEntries;
  const totalRevenue   = stats.totalRevenue;
  const thisMonthRevenue = stats.periodRevenue;
  const todayRevenue   = stats.todayRevenue;
  const todayCount     = stats.todayCount;
  const revenueByScheme = stats.revenueByScheme ?? {};
  const countByScheme   = stats.countByScheme   ?? {};

  return (
    <div className="branch-stats">
      <div className="branch-stats-header">
        <span className="branch-stats-title">📊 Branch Overview</span>
        <span className="branch-stats-sub">Your branch statistics</span>
      </div>

      <div className="bkpi-grid">
        <div className="bkpi-card bkpi-blue">
          <div className="bkpi-icon">📋</div>
          <div className="bkpi-value">{totalEntries.toLocaleString()}</div>
          <div className="bkpi-label">Total Entries</div>
        </div>
        <div className="bkpi-card bkpi-green">
          <div className="bkpi-icon">💰</div>
          <div className="bkpi-value">₹{thisMonthRevenue.toLocaleString()}</div>
          <div className="bkpi-label">{monthName}</div>
        </div>
        <div className="bkpi-card bkpi-purple">
          <div className="bkpi-icon">📅</div>
          <div className="bkpi-value">₹{totalRevenue.toLocaleString()}</div>
          <div className="bkpi-label">All Time Revenue</div>
        </div>
        <div className="bkpi-card bkpi-orange">
          <div className="bkpi-icon">⚡</div>
          <div className="bkpi-value">₹{todayRevenue.toLocaleString()}</div>
          <div className="bkpi-label">{isToday ? "Today" : selectedDate} · {todayCount} {todayCount === 1 ? "entry" : "entries"}</div>
        </div>
      </div>

      {Object.keys(revenueByScheme).length > 0 && (
        <div className="bscheme-section">
          <div className="bscheme-title">Revenue by Scheme</div>
          <div className="bscheme-list">
            {Object.entries(revenueByScheme)
              .sort(([, a], [, b]) => b - a)
              .map(([scheme, total]) => {
                const color = SCHEME_COLORS[scheme] || "#6b7280";
                const pct   = totalRevenue > 0 ? Math.round((total / totalRevenue) * 100) : 0;
                return (
                  <div key={scheme} className="bscheme-row">
                    <span className="bscheme-dot" style={{ background: color }} />
                    <span className="bscheme-name">{scheme}</span>
                    <span className="bscheme-count-pill">{countByScheme[scheme]}</span>
                    <div className="bscheme-bar-track">
                      <div className="bscheme-bar-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="bscheme-pct">{pct}%</span>
                    <span className="bscheme-amt">₹{total.toLocaleString()}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Branch EntriesTable ───────────────────────────────────────────────────────
function EntriesTable({ branch, refreshKey, filterDate, setFilterDate }) {
  const todayLocal = todayISTStr();
  const [entries, setEntries]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [colWidths, startResize]    = useResizableColumns([60, 105, 130, 160, 120, 100, 90, 70, 140, 185, 175, 175, 165, 80, 155]);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/entries?branch=${encodeURIComponent(branch)}&date_from=${filterDate}&date_to=${filterDate}`)
      .then(r => r.json())
      .then(d => { if (d.success) setEntries(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [branch, filterDate, refreshKey]);

  return (
    <div className="table-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <SectionTitle icon="📊" title={`Recent Entries (${branch})`} />
        {entries.length > 0 && (
          <button onClick={() => exportToCSV(entries)} style={{ background: "var(--accent-green)", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "0.9rem" }}>
            📥 Export to Excel
          </button>
        )}
      </div>

      {/* Date filter */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", whiteSpace: "nowrap" }}>View Date:</label>
        <input
          type="date"
          className="field-input"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          style={{ maxWidth: "180px" }}
        />
        {filterDate !== todayLocal && (
          <button
            onClick={() => setFilterDate(todayLocal)}
            style={{ background: "none", border: "1px solid var(--border-light)", borderRadius: "6px", padding: "0.3rem 0.7rem", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-muted)" }}
          >
            Back to Today
          </button>
        )}
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          {loading ? "Loading…" : `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`}
        </span>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "1rem" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginTop: "1rem" }}>No entries for this date.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", marginTop: "1rem", fontSize: "0.85rem", textAlign: "left", whiteSpace: "nowrap" }}>
          <colgroup>
            {colWidths.map((w, i) => <col key={i} style={{ width: w + "px" }} />)}
          </colgroup>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
              {["S.No", "Date", "Branch", "Customer", "Phone", "Amount (₹)", "Pay Mode", "Proof", "Txn Details", "Scheme", "Referred By", "Official", "Land Info", "Pkg / Qty", "Notes"].map((h, i) => (
                <th key={h} style={{ padding: "0.5rem", position: "relative", background: "#f8fafc" }}>
                  {h}<ResizeHandle onMouseDown={e => startResize(i, e)} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(e => {
              const entryDateStr   = String(e.entry_date).slice(0, 10);
              const createdDateStr = dateInIST(e.created_at);
              const createdLater   = createdDateStr > entryDateStr;
              if (e.is_no_collection) return <NoCollectionRow key={e.id} entry={e} blankCols={11} />;
              return (
                <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.5rem" }}>{e.serial_number || "-"}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {formatDateToDDMMYYYY(e.entry_date)}
                    {createdLater && (
                      <div style={{ fontSize: "0.72rem", color: "#d97706", marginTop: "2px", whiteSpace: "normal", lineHeight: 1.3 }}>
                        Created on {formatDateToDDMMYYYY(createdDateStr)}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{e.branch_name}</td>
                  <td style={{ padding: "0.5rem" }}>{e.customer_name}</td>
                  <td style={{ padding: "0.5rem" }}>{e.phone_number}</td>
                  <td style={{ padding: "0.5rem", color: "var(--accent-green)", fontWeight: 600 }}>
                    {Number(e.amount_paid).toLocaleString()}
                    {e.payment_mode === "Cash+Bank" && (
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted, #6b7280)", fontWeight: 400 }}>
                        C ₹{Number(e.cash_amount).toLocaleString()} / B ₹{Number(e.bank_amount).toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{e.payment_mode}</td>
                  <td style={{ padding: "0.5rem" }}><ProofLink proofUrl={e.proof_url} proofUrls={e.proof_urls} /></td>
                  <td style={{ padding: "0.5rem" }}>{e.transaction_details || "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{e.scheme_type}</td>
                  <td style={{ padding: "0.5rem" }}>{e.referred_by ? `${e.referred_by}${e.referred_by_emp_id ? ` (${e.referred_by_emp_id})` : ""} - ${e.referred_by_role || "No Role"}` : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{e.higher_official ? `${e.higher_official}${e.higher_official_emp_id ? ` (${e.higher_official_emp_id})` : ""} - ${e.higher_official_role || "No Role"}` : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{e.land_kind_of_payment ? `${e.land_kind_of_payment} | ${e.land_site_name || ""} ${e.land_layout || ""} ${e.land_site_number ? `(#${e.land_site_number})` : ""}` : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{e.gold_package ? `${e.gold_package}${e.gold_quantity ? ` ×${e.gold_quantity}` : ""}` : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{e.notes || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const todayISO = () => todayISTStr();

const initialForm = {
  entry_date: todayISO(), branch_name: "", customer_name: "",
  phone_number: "", amount_paid: "", payment_mode: "", transaction_details: "",
  scheme_type: "",
  referred_by: "", referred_by_emp_id: "", referred_by_role: "",
  higher_official: "", higher_official_emp_id: "", higher_official_role: "",
  notes: "",
  land_kind_of_payment: "", land_site_name: "", land_layout: "", land_site_number: "",
  gold_package: "", gold_quantity: "",
  cash_amount: "", bank_amount: "",
};

export default function CustomerEntryForm() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    const branch = localStorage.getItem("branch");
    const role = localStorage.getItem("role") || "branch";
    const directorBranchesRaw = localStorage.getItem("directorBranches");
    const directorName = localStorage.getItem("directorName") || "";
    const directorBranches = directorBranchesRaw ? JSON.parse(directorBranchesRaw) : null;
    return token ? { token, branch, role, directorBranches, directorName } : null;
  });

  const [form, setForm] = useState({ ...initialForm, branch_name: localStorage.getItem("branch") || "" });
  const [status, setStatus]             = useState(null);
  const [loading, setLoading]           = useState(false);
  const [branchRefreshKey, setBranchRefreshKey] = useState(0);
  const [filterDate, setFilterDate]     = useState(todayISTStr());
  const [proofFiles, setProofFiles]     = useState([]);
  const [serverToday, setServerToday]   = useState(todayISTStr());

  // Trust the server's IST date for the form so a wrong device clock/timezone can't
  // save an entry under the wrong date. Falls back to the client IST value if offline.
  useEffect(() => {
    fetch(`${API_BASE}/today`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.date) {
          setServerToday(d.date);
          // Only adopt it as the default if the user hasn't picked a date yet.
          setForm(f => (f.entry_date === todayISO() ? { ...f, entry_date: d.date } : f));
        }
      })
      .catch(() => {});
  }, []);

  // Force logout when any authFetch detects an expired/invalid token
  useEffect(() => {
    const onForceLogout = () => setUser(null);
    window.addEventListener("auth:logout", onForceLogout);
    return () => window.removeEventListener("auth:logout", onForceLogout);
  }, []);

  // Sync form branch when user changes (login / logout)
  useEffect(() => {
    if (user) setForm(prev => ({ ...prev, branch_name: user.branch }));
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("branch");
    localStorage.removeItem("role");
    localStorage.removeItem("directorBranches");
    localStorage.removeItem("directorName");
    setUser(null);
  };

  const set = (field) => (e) =>
    setForm(prev => ({
      ...prev,
      [field]: e.target.value,
      ...(field === "scheme_type" ? { land_kind_of_payment: "", land_site_name: "", land_layout: "", land_site_number: "", gold_package: "", gold_quantity: "" } : {}),
      ...(field === "land_site_name" ? { land_layout: "" } : {}),
      ...(field === "gold_package" && e.target.value !== "Single" ? { gold_quantity: "" } : {}),
      ...(field === "payment_mode" && e.target.value !== "Cash+Bank" ? { cash_amount: "", bank_amount: "" } : {}),
    }));

  const handleSubmit = async () => {
    setStatus(null);

    // Client-side validation — mirrors backend required fields so upload never starts on bad data
    const requiredFields = [
      ["entry_date",     "Date"],
      ["branch_name",    "Branch Name"],
      ["customer_name",  "Customer Name"],
      ["phone_number",   "Phone Number"],
      ["payment_mode",   "Payment Mode"],
      ["scheme_type",    "Scheme Type"],
    ];
    if (form.payment_mode !== "Cash+Bank") requiredFields.push(["amount_paid", "Amount Paid"]);
    for (const [key, label] of requiredFields) {
      if (!form[key]) {
        setStatus({ type: "error", msg: `${label} is required.` });
        return;
      }
    }
    if (form.payment_mode === "Cash+Bank") {
      const c = Number(form.cash_amount), b = Number(form.bank_amount);
      if (!(c > 0) || !(b > 0)) {
        setStatus({ type: "error", msg: "Cash and Bank amounts must both be greater than 0." });
        return;
      }
    }
    if (form.gold_package === "Single" && form.gold_quantity) {
      const qty = parseInt(form.gold_quantity);
      const max = form.scheme_type === "GOLD COIN SAVINGS" ? 15 : 19;
      if (isNaN(qty) || qty < 1) {
        setStatus({ type: "error", msg: "Quantity must be a positive number." });
        return;
      }
      if (qty > max) {
        setStatus({ type: "error", msg: `Quantity cannot exceed ${max} for ${form.scheme_type === "GOLD COIN SAVINGS" ? "Gold Coin Savings" : "Jewel Savings"}.` });
        return;
      }
    }
    if (["GPay", "Bank", "Cash+Bank"].includes(form.payment_mode) && proofFiles.length === 0) {
      setStatus({ type: "error", msg: "Please upload at least one payment proof for GPay / Bank transactions." });
      return;
    }

    setLoading(true);

    let proofUrls = [];
    if (proofFiles.length) {
      try {
        for (const file of proofFiles) {
          proofUrls.push(await uploadProofFile(file, form.payment_mode, user.token));
        }
      } catch (err) {
        setStatus({ type: "error", msg: err.message || "Upload error. Check your connection." });
        setLoading(false); return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/entries`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, proof_url: proofUrls[0] || null, proof_urls: proofUrls }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type: "success", msg: `Entry saved! S.No ${data.serial_number}` });
        setForm({ ...initialForm, entry_date: serverToday, branch_name: user.branch });
        setProofFiles([]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        setBranchRefreshKey(k => k + 1);
      } else {
        setStatus({ type: "error", msg: data.error });
      }
    } catch {
      setStatus({ type: "error", msg: "Cannot reach the backend." });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return <Login onLogin={(u) => {
    // Persist director/GM info to localStorage when logging in (both use a branch list)
    if ((u.role === "director" || u.role === "gm") && u.directorBranches) {
      localStorage.setItem("directorBranches", JSON.stringify(u.directorBranches));
      localStorage.setItem("directorName", u.directorName || "");
    }
    setUser(u);
  }} />;

  if ((user.role === "director" || user.role === "gm") && user.directorBranches) {
    const isGM = user.role === "gm";
    return (
      <DirectorDashboard
        onLogout={handleLogout}
        directorBranches={user.directorBranches}
        directorName={user.directorName || (isGM ? "GM" : "Director")}
        roleLabel={isGM ? "GM" : "Director"}
      />
    );
 }

  if (user.role === "followup") {
    return <FollowUpDashboard onLogout={handleLogout} />;
  }

  if (user.role === "management") {
    return (
      <ManagementDashboard
        onLogout={handleLogout}
        token={user.token}
      />
    );
  }

  if (user.branch === "ALL") {
    return (
      <MDDashboard
        onLogout={handleLogout}
      />
    );
  }

  const isLand = form.scheme_type === "LAND";
  const isGoldOrJewel = form.scheme_type === "GOLD COIN SAVINGS" || form.scheme_type === "JEWEL SAVINGS";

  return (
    <div className="page-bg">
      <div className="form-card">
        {/* Header */}
        <div className="form-header" style={{ position: "relative" }}>
          <button onClick={handleLogout} style={{ position: "absolute", top: 0, right: 0, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>
            Logout
          </button>
          <img src="/AVG_logo.jpeg" alt="Agilavetri PrimeTech Logo" className="brand-logo" />
          <div>
            <h1 className="form-title">Customer Entry Form</h1>
            <p className="form-subtitle">Branch: {user.branch}</p>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className={`status-banner ${status.type}`}>
            <span className="status-icon">{status.type === "success" ? "✓" : "✕"}</span>
            {status.msg}
          </div>
        )}

        {/* Section 1 */}
        <SectionTitle icon="📋" title="Basic Details" />
        <div className="grid-2">
          <TextInput label="Date" required type="date" value={form.entry_date} onChange={set("entry_date")} min="2024-01-01" max={serverToday} />
          <SelectInput label="Branch Name" required value={form.branch_name} onChange={set("branch_name")} options={branches} disabled />
          <TextInput label="Customer Name" required value={form.customer_name} onChange={set("customer_name")} placeholder="Full name" />
          <TextInput label="Phone Number" required type="tel" value={form.phone_number} onChange={set("phone_number")} placeholder="+91 XXXXX XXXXX" />
          <SelectInput label="Payment Mode" required value={form.payment_mode}
            onChange={e => { set("payment_mode")(e); if (e.target.value === "Cash") setProofFiles([]); }}
            options={["Cash", "Bank", "GPay", "Cash+Bank"]} placeholder="Select mode" />
          {form.payment_mode === "Cash+Bank" ? (
            <>
              <TextInput label="Cash Amount (₹)" required type="number" value={form.cash_amount}
                onChange={e => {
                  const cash = e.target.value;
                  const total = (Number(cash) || 0) + (Number(form.bank_amount) || 0);
                  setForm(f => ({ ...f, cash_amount: cash, amount_paid: total ? String(total) : "" }));
                }} placeholder="0.00" />
              <TextInput label="Bank Amount (₹)" required type="number" value={form.bank_amount}
                onChange={e => {
                  const bank = e.target.value;
                  const total = (Number(form.cash_amount) || 0) + (Number(bank) || 0);
                  setForm(f => ({ ...f, bank_amount: bank, amount_paid: total ? String(total) : "" }));
                }} placeholder="0.00" />
              <TextInput label="Total (₹)" disabled value={form.amount_paid} />
            </>
          ) : (
            <TextInput label="Amount Paid (₹)" required type="number" value={form.amount_paid} onChange={set("amount_paid")} placeholder="0.00" />
          )}
          <TextInput label="Transaction Details" value={form.transaction_details} onChange={set("transaction_details")} placeholder="Ref / UTR / cheque no." />
          <SelectInput label="Scheme Type" required value={form.scheme_type} onChange={set("scheme_type")} options={schemes} placeholder="Select scheme" />
        </div>

        {(form.payment_mode === "GPay" || form.payment_mode === "Bank" || form.payment_mode === "Cash+Bank") && (
          <div style={{ marginTop: "1rem" }}>
            <ProofUploader
              paymentMode={form.payment_mode === "Cash+Bank" ? "Bank" : form.payment_mode}
              pendingFiles={proofFiles}
              existingUrls={[]}
              onAddFiles={(files) => setProofFiles(prev => [...prev, ...files].slice(0, PROOF_MAX_COUNT))}
              onRemovePending={(i) => setProofFiles(prev => prev.filter((_, idx) => idx !== i))}
              onRemoveExisting={() => {}}
            />
          </div>
        )}

        {/* Section 2 */}
        <SectionTitle icon="🤝" title="Reference & Officials" />
        <div className="grid-2">
          <PersonRow
            nameLabel="Referred By"
            nameProps={{ value: form.referred_by, onChange: set("referred_by"), placeholder: "Referrer name" }}
            empIdProps={{ value: form.referred_by_emp_id, onChange: set("referred_by_emp_id") }}
            roleProps={{ value: form.referred_by_role, onChange: set("referred_by_role") }}
          />
          <PersonRow
            nameLabel="Higher Official"
            nameProps={{ value: form.higher_official, onChange: set("higher_official"), placeholder: "Official name" }}
            empIdProps={{ value: form.higher_official_emp_id, onChange: set("higher_official_emp_id") }}
            roleProps={{ value: form.higher_official_role, onChange: set("higher_official_role") }}
          />
        </div>

        <div className="field-group full-width" style={{ marginTop: "0.5rem" }}>
          <FieldLabel>Notes</FieldLabel>
          <textarea className="field-input" rows="3" placeholder="Any additional remarks…" value={form.notes} onChange={set("notes")} />
        </div>

        {/* Section 3: Land */}
        {isLand && (
          <div className="sub-section land-section">
            <SectionTitle icon="🏡" title="Land Scheme Details" />
            <div className="grid-2">
              <SelectInput label="Kind of Payment" value={form.land_kind_of_payment} onChange={set("land_kind_of_payment")} options={["Advance", "Full"]} placeholder="Select type" />
              <SelectInput
                label="Name of Site"
                value={form.land_site_name} onChange={set("land_site_name")}
                options={["Maiylam", "Sunrise City", "Veppur Site", "SR Grand City 2", "Melmalaiyanur Site", "SIV City", "Uchimadu", "Kandapankurichi Site"]}
                placeholder="Select site"
              />
              <TextInput label="Site Number" value={form.land_site_number} onChange={set("land_site_number")} placeholder="e.g. Plot 42 / SN-007" />
              {form.land_site_name === "Veppur Site" && (
                <SelectInput label="Veppur Layout" value={form.land_layout} onChange={set("land_layout")} options={veppurOptions} placeholder="Select layout" />
              )}
              {form.land_site_name === "Melmalaiyanur Site" && (
                <SelectInput label="Melmalaiyanur Layout" value={form.land_layout} onChange={set("land_layout")} options={melmalaiyanurOpts} placeholder="Select layout" />
              )}
              {form.land_site_name === "Kandapankurichi Site" && (
                <SelectInput label="Kandapankurichi Layout" value={form.land_layout} onChange={set("land_layout")} options={kandapankurichiOpts} placeholder="Select layout" />
              )}
            </div>
          </div>
        )}

        {/* Section 4: Gold */}
        {isGoldOrJewel && (
          <div className="sub-section gold-section">
            <SectionTitle icon="💎" title="Gold / Jewel Savings Details" />
            <div className="grid-2">
              <SelectInput label="Package" value={form.gold_package} onChange={set("gold_package")} options={["Single", "Full"]} placeholder="Select package" />
              {form.gold_package === "Single" && (
                <TextInput
                  label="Quantity"
                  type="number"
                  value={form.gold_quantity}
                  onChange={set("gold_quantity")}
                  min="1"
                  max={form.scheme_type === "GOLD COIN SAVINGS" ? 15 : 19}
                  placeholder={`1 – ${form.scheme_type === "GOLD COIN SAVINGS" ? 15 : 19}`}
                />
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="submit-row">
          <button className="submit-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? <><span className="spinner" /> Saving…</> : <><span className="btn-icon">→</span> Submit Entry</>}
          </button>
        </div>
      </div>

      <div className="ncc-card">
        <NoCollectionToggle token={user.token} refreshKey={branchRefreshKey} onChange={() => setBranchRefreshKey(k => k + 1)} />
      </div>

      <BranchStats branch={user.branch} refreshKey={branchRefreshKey} filterDate={filterDate} />
      <EntriesTable branch={user.branch} refreshKey={branchRefreshKey} filterDate={filterDate} setFilterDate={setFilterDate} />
    </div>
  );
}

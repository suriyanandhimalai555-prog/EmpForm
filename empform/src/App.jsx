import { useState, useEffect } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "https://api.avgupi.com/api";

const branches = [
  "AARANI","ANDIMADAM","ANEKAL","ARIYALUR","ARIYANKUPPAM","ATTIBELE","ATTUR",
  "AVALURPET","BANGARUPALAYAM","BELLARY","CHENGAM","CHITTOOR","CUDDALORE",
  "DEVANUR","DHARAPURAM","DHARMAPURI","DINDIGUL","ELURU","GINGEE","GOWRIBIDANUR",
  "GUDUR","HARUR","HASAN","JAMUNAMARATHUR","KALAHASTHI","KALLAKURICHI",
  "KANDACHIPURAM","KANIYAMBADI","KARAIKAL","KRISHNAGIRI","MANDYA","MELMALAIYANUR",
  "MIRIYALAGUDA","MOONGIL THURAIPATTU","MYSORE","NAIDUPETA","NALGONDA","NELLORE",
  "NETTAPAKKAM","NEYVELI","ONGOLE","OTTACHATHIRAM","PALACODE","PALAMANER","PALANI",
  "PANRUTI","PAPPREDY PATTI","PERAMBALUR","POLUR","PUTTUR","RANIPET","SANKARAPURAM",
  "SULLURPET","SURYAPET","THALAIVASAL","THANDARAMPATTU","THENMATHIMANGALAM",
  "THIRUKKANUR","THIRUKOVILUR","THIRUPATHI","THIRUPATHUR","THIRUTHANI","THITAKUDI",
  "TINDIVANAM","TIRUCHI","TIRUPUR","TIRUVANNAMALAI","ULUNDURPET","UTHANGARAI",
  "V KOTA","VEPPUR","VIJAYAWADA","VILLIANUR","VILLUPURAM","VIRUTHACHALAM",
];

const schemes = [
  "MONTHLY GOLD RENEWAL","MONTHLY GOLD NEW","GOLD COIN SAVINGS","JEWEL SAVINGS",
  "GLOBAL VETRI CHIT NEW","GLOBAL VETRI CHIT RENEWAL","TRADING","LAND","BUILDERS",
];

const veppurOptions     = ["Krishna Garden 3","Narayanapuram","Vasantha Garden"];
const melmalaiyanurOpts = ["VRJ City"];

const SCHEME_COLORS = {
  "MONTHLY GOLD RENEWAL":     "#f59e0b",
  "MONTHLY GOLD NEW":         "#d97706",
  "GOLD COIN SAVINGS":        "#b45309",
  "JEWEL SAVINGS":            "#7c3aed",
  "GLOBAL VETRI CHIT NEW":    "#2563eb",
  "GLOBAL VETRI CHIT RENEWAL":"#1d4ed8",
  "TRADING":                  "#0891b2",
  "LAND":                     "#059669",
  "BUILDERS":                 "#dc2626",
};

const formatDateToDDMMYYYY = (isoString) => {
  if (!isoString) return "";
  const d = new Date(isoString);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};

const exportToCSV = (entries) => {
  if (!entries || entries.length === 0) { alert("No entries to export."); return; }
  const headers = [
    "S.No","Date","Branch","Customer Name","Phone","Amount Paid",
    "Payment Mode","Transaction Details","Scheme",
    "Referred By","Referrer Emp ID","Referrer Role",
    "Higher Official","Official Emp ID","Official Role",
    "Land Kind of Payment","Land Site Name","Land Layout","Land Site Number",
    "Gold Package","Notes",
  ];
  const rows = entries.map(e => [
    e.serial_number||"", formatDateToDDMMYYYY(e.entry_date), e.branch_name||"",
    e.customer_name||"", e.phone_number||"", e.amount_paid||"",
    e.payment_mode||"", e.transaction_details||"", e.scheme_type||"",
    e.referred_by||"", e.referred_by_emp_id||"", e.referred_by_role||"",
    e.higher_official||"", e.higher_official_emp_id||"", e.higher_official_role||"",
    e.land_kind_of_payment||"", e.land_site_name||"", e.land_layout||"", e.land_site_number||"",
    e.gold_package||"", (e.notes||"").replace(/,/g," "),
  ]);
  // Wrap date column (index 1) as Excel text formula ="DD/MM/YYYY" to prevent auto-formatting
  const csv = [
    headers.join(","),
    ...rows.map(r => r.map((v, i) => i === 1 ? `"=""${v}"""` : `"${v}"`).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.setAttribute("download", `emp_entries_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

// ── Login ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [mode, setMode]           = useState("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [newPassword, setNewPwd]  = useState("");
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [showPwd, setShowPwd]     = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess(""); setLoading(true);
    try {
      const endpoint = mode === "login" ? "/login" : "/change-password";
      const body     = mode === "login"
        ? { email, password }
        : { email, currentPassword: password, newPassword };
      const res  = await fetch(`${API_BASE}${endpoint}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
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
    <div className="page-bg" style={{ alignItems:"center" }}>
      <div className="form-card" style={{ maxWidth:"400px" }}>
        <div className="form-header">
          <img src="/AVG_logo.jpeg" alt="Logo" className="brand-logo" />
          <h1 className="form-title" style={{ marginTop:"1rem" }}>
            {mode === "login" ? "Staff Login" : "Change Password"}
          </h1>
          <p className="form-subtitle">Agilavetri PrimeTech</p>
        </div>
        <form onSubmit={handleSubmit} className="field-group" style={{ gap:"1rem" }}>
          {error   && <div className="status-banner error"   style={{ marginBottom:0, padding:"0.75rem" }}>{error}</div>}
          {success && <div className="status-banner success" style={{ marginBottom:0, padding:"0.75rem" }}>{success}</div>}
          <div className="field-group">
            <label className="field-label">Email</label>
            <input type="email" className="field-input" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="branch@gmail.com" />
          </div>
          <div className="field-group">
            <label className="field-label">{mode === "login" ? "Password" : "Current Password"}</label>
            <div style={{ position:"relative" }}>
              <input type={showPwd ? "text" : "password"} className="field-input" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight:"2.5rem" }} />
              <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position:"absolute", right:"0.75rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center" }}>
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
              <div style={{ position:"relative" }}>
                <input type={showNewPwd ? "text" : "password"} className="field-input" required value={newPassword} onChange={e=>setNewPwd(e.target.value)} placeholder="••••••••" style={{ paddingRight:"2.5rem" }} />
                <button type="button" onClick={() => setShowNewPwd(v => !v)} style={{ position:"absolute", right:"0.75rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center" }}>
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
          <button type="submit" className="submit-btn" disabled={loading} style={{ width:"100%", marginTop:"0.5rem", justifyContent:"center" }}>
            {loading ? "Processing…" : (mode === "login" ? "Login" : "Change Password")}
          </button>
          <div style={{ textAlign:"center", marginTop:"1rem" }}>
            <button type="button"
              onClick={() => { setMode(m => m==="login" ? "change_password" : "login"); setError(""); setSuccess(""); setPassword(""); setNewPwd(""); }}
              style={{ background:"none", border:"none", color:"var(--primary)", cursor:"pointer", textDecoration:"underline", fontSize:"0.9rem" }}>
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
  return (
    <div className="field-group">
      <FieldLabel required={required}>{label}</FieldLabel>
      <input className="field-input" {...props} />
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

// ── MD Dashboard ──────────────────────────────────────────────────────────────
function MDDashboard({ entries, onLogout, mdFilterBranch, setMdFilterBranch, mdFilterDateFrom, setMdFilterDateFrom, mdFilterDateTo, setMdFilterDateTo }) {
  const now          = new Date();
  const today        = now.toLocaleDateString("en-CA"); // YYYY-MM-DD in local timezone
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  const monthName    = now.toLocaleString("default", { month:"long", year:"numeric" });
  const isFiltered   = mdFilterBranch || mdFilterDateFrom || mdFilterDateTo;

  // All stats derived from the already-filtered entries array
  const totalEntries = entries.length;
  const totalRevenue = entries.reduce((s, e) => s + (Number(e.amount_paid) || 0), 0);

  // Filter by entry_date (form date) for all dashboard stats
  const todayEntries = entries.filter(e => String(e.entry_date).slice(0,10) === today);
  const todayRevenue = todayEntries.reduce((s, e) => s + (Number(e.amount_paid) || 0), 0);
  const todayCount   = todayEntries.length;

  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const thisMonthRevenue = entries
    .filter(e => String(e.entry_date).slice(0,7) === currentMonthKey)
    .reduce((s, e) => s + (Number(e.amount_paid) || 0), 0);

  const revenueByScheme = {};
  const countByScheme   = {};
  entries.forEach(e => {
    const amt = Number(e.amount_paid) || 0;
    revenueByScheme[e.scheme_type] = (revenueByScheme[e.scheme_type] || 0) + amt;
    countByScheme[e.scheme_type]   = (countByScheme[e.scheme_type]   || 0) + 1;
  });

  const todayByScheme = {};
  todayEntries.forEach(e => {
    const amt = Number(e.amount_paid) || 0;
    todayByScheme[e.scheme_type] = (todayByScheme[e.scheme_type] || 0) + amt;
  });

  const uniqueBranchCount  = new Set(entries.map(e => e.branch_name).filter(Boolean)).size;
  const schemeCount        = Object.keys(revenueByScheme).length;

  const clearFilters = () => { setMdFilterBranch(""); setMdFilterDateFrom(""); setMdFilterDateTo(""); };

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
            <div className="field-group" style={{ minWidth:"180px", flex:1 }}>
              <label className="field-label">Branch</label>
              <select className="field-input" value={mdFilterBranch} onChange={e => setMdFilterBranch(e.target.value)}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="field-group" style={{ minWidth:"150px", flex:1 }}>
              <label className="field-label">From Date</label>
              <input type="date" className="field-input" value={mdFilterDateFrom} onChange={e => setMdFilterDateFrom(e.target.value)} />
            </div>
            <div className="field-group" style={{ minWidth:"150px", flex:1 }}>
              <label className="field-label">To Date</label>
              <input type="date" className="field-input" value={mdFilterDateTo} onChange={e => setMdFilterDateTo(e.target.value)} />
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
          <div className="kpi-card" data-color="green">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-green">💰</span>
              <span className="kpi-badge">{isFiltered ? "Filtered" : "All time"}</span>
            </div>
            <div className="kpi-value">₹{totalRevenue.toLocaleString()}</div>
            <div className="kpi-label">Total Revenue</div>
          </div>
          <div className="kpi-card" data-color="purple">
            <div className="kpi-top">
              <span className="kpi-icon-wrap kpi-icon-purple">📅</span>
              <span className="kpi-badge">{monthName}</span>
            </div>
            <div className="kpi-value">₹{thisMonthRevenue.toLocaleString()}</div>
            <div className="kpi-label">This Month</div>
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
                          <div className="scheme-bar-fill" style={{ width:`${pct}%`, background:color }} />
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
                <span className="entry-count-badge">{totalEntries}</span>
              </div>
              <div className="admin-panel-sub">
                {isFiltered
                  ? [mdFilterBranch || "All Branches", mdFilterDateFrom && `From ${mdFilterDateFrom}`, mdFilterDateTo && `To ${mdFilterDateTo}`].filter(Boolean).join(" · ")
                  : "All branches · All time"}
              </div>
            </div>
            {totalEntries > 0 && (
              <button className="export-btn" onClick={() => exportToCSV(entries)}>
                📥 Export CSV
              </button>
            )}
          </div>

          {totalEntries === 0 ? (
            <div className="admin-empty" style={{ padding:"3rem" }}>
              No entries found. Adjust filters or add data from a branch.
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>S.No</th>
                    <th>Date</th>
                    <th>Branch</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Amount</th>
                    <th>Mode</th>
                    <th>Scheme</th>
                    <th>Referred By</th>
                    <th>Higher Official</th>
                    <th>Land / Gold</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, idx) => {
                    const color = SCHEME_COLORS[e.scheme_type] || "#6b7280";
                    const landInfo = e.land_kind_of_payment
                      ? [e.land_kind_of_payment, e.land_site_name, e.land_layout, e.land_site_number && `#${e.land_site_number}`].filter(Boolean).join(" · ")
                      : e.gold_package ? `Gold: ${e.gold_package}` : "-";
                    return (
                      <tr key={e.id} className={idx % 2 === 0 ? "tr-even" : "tr-odd"}>
                        <td className="td-mono">{e.serial_number || "-"}</td>
                        <td className="td-nowrap">{formatDateToDDMMYYYY(e.entry_date)}</td>
                        <td className="td-branch">{e.branch_name}</td>
                        <td>{e.customer_name}</td>
                        <td className="td-mono">{e.phone_number}</td>
                        <td className="td-amount">₹{Number(e.amount_paid).toLocaleString()}</td>
                        <td>
                          <span className={`mode-badge mode-${(e.payment_mode||"").toLowerCase()}`}>
                            {e.payment_mode}
                          </span>
                        </td>
                        <td>
                          <span className="scheme-tag" style={{ background:`${color}18`, color, borderColor:`${color}40` }}>
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
        <h3 style={{ margin:"0 0 0.75rem", fontSize:"1.1rem" }}>{title}</h3>
        <p style={{ margin:"0 0 1.5rem", color:"var(--text-secondary)", fontSize:"0.9rem" }}>{message}</p>
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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");

  const set = (field) => (e) => setForm(prev => ({
    ...prev,
    [field]: e.target.value,
    ...(field === "scheme_type"    ? { land_kind_of_payment:"", land_site_name:"", land_layout:"", land_site_number:"", gold_package:"" } : {}),
    ...(field === "land_site_name" ? { land_layout:"" } : {}),
  }));

  const handleSave = async () => {
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/entries/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type":"application/json", "Authorization":`Bearer ${token}` },
        body: JSON.stringify(form),
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
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
          <h2 style={{ margin:0, fontSize:"1.2rem" }}>Edit Entry #{entry.serial_number}</h2>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:"1.5rem", cursor:"pointer", color:"var(--text-muted)" }}>&times;</button>
        </div>

        {error && <div className="status-banner error" style={{ marginBottom:"1rem", padding:"0.75rem" }}>{error}</div>}

        <SectionTitle icon="📋" title="Basic Details" />
        <div className="grid-2">
          <TextInput label="Date" required type="date" value={form.entry_date} onChange={set("entry_date")} />
          <SelectInput label="Branch Name" required value={form.branch_name} onChange={set("branch_name")} options={branches} />
          <TextInput label="Customer Name" required value={form.customer_name} onChange={set("customer_name")} placeholder="Full name" />
          <TextInput label="Phone Number" required type="tel" value={form.phone_number} onChange={set("phone_number")} placeholder="+91 XXXXX XXXXX" />
          <TextInput label="Amount Paid" required type="number" value={form.amount_paid} onChange={set("amount_paid")} placeholder="0.00" />
          <SelectInput label="Payment Mode" required value={form.payment_mode} onChange={set("payment_mode")} options={["Cash","Bank","GPay"]} />
          <TextInput label="Transaction Details" value={form.transaction_details} onChange={set("transaction_details")} placeholder="Ref / UTR / cheque no." />
          <SelectInput label="Scheme Type" required value={form.scheme_type} onChange={set("scheme_type")} options={schemes} />
        </div>

        <SectionTitle icon="🤝" title="Reference & Officials" />
        <div className="grid-2">
          <PersonRow
            nameLabel="Referred By"
            nameProps={{ value:form.referred_by, onChange:set("referred_by"), placeholder:"Referrer name" }}
            empIdProps={{ value:form.referred_by_emp_id, onChange:set("referred_by_emp_id") }}
            roleProps={{ value:form.referred_by_role, onChange:set("referred_by_role") }}
          />
          <PersonRow
            nameLabel="Higher Official"
            nameProps={{ value:form.higher_official, onChange:set("higher_official"), placeholder:"Official name" }}
            empIdProps={{ value:form.higher_official_emp_id, onChange:set("higher_official_emp_id") }}
            roleProps={{ value:form.higher_official_role, onChange:set("higher_official_role") }}
          />
        </div>
        <div className="field-group full-width" style={{ marginTop:"0.5rem" }}>
          <FieldLabel>Notes</FieldLabel>
          <textarea className="field-input" rows="3" placeholder="Any additional remarks…" value={form.notes} onChange={set("notes")} />
        </div>

        {isLand && (
          <div className="sub-section land-section">
            <SectionTitle icon="🏡" title="Land Scheme Details" />
            <div className="grid-2">
              <SelectInput label="Kind of Payment" value={form.land_kind_of_payment} onChange={set("land_kind_of_payment")} options={["Advance","Full"]} />
              <SelectInput label="Name of Site" value={form.land_site_name} onChange={set("land_site_name")}
                options={["Maiylam","Sunrise City","Veppur Site","SR Grand City 2","Melmalaiyanur Site","SIV City","Uchimadu"]} />
              <TextInput label="Site Number" value={form.land_site_number} onChange={set("land_site_number")} placeholder="e.g. Plot 42" />
              {form.land_site_name === "Veppur Site" && (
                <SelectInput label="Veppur Layout" value={form.land_layout} onChange={set("land_layout")} options={veppurOptions} />
              )}
              {form.land_site_name === "Melmalaiyanur Site" && (
                <SelectInput label="Melmalaiyanur Layout" value={form.land_layout} onChange={set("land_layout")} options={melmalaiyanurOpts} />
              )}
            </div>
          </div>
        )}

        {isGoldOrJewel && (
          <div className="sub-section gold-section">
            <SectionTitle icon="💎" title="Gold / Jewel Savings Details" />
            <div className="grid-2">
              <SelectInput label="Package" value={form.gold_package} onChange={set("gold_package")} options={["Single","Full"]} />
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop:"1.5rem" }}>
          <button className="cancel-btn" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="submit-btn" onClick={handleSave} disabled={saving} style={{ minWidth:"120px", justifyContent:"center" }}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Management Panel ────────────────────────────────────────────────────
function UserManagementPanel({ token }) {
  const [users, setUsers]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [resetTarget, setResetTarget] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [feedback, setFeedback]       = useState(null);
  const [resetting, setResetting]     = useState(false);
  const [showPwd, setShowPwd]         = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/users`, { headers: { "Authorization": `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.success) setUsers(data.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      setFeedback({ type:"error", msg:"Password must be at least 6 characters" });
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(`${API_BASE}/admin/reset-password`, {
        method: "POST",
        headers: { "Content-Type":"application/json", "Authorization":`Bearer ${token}` },
        body: JSON.stringify({ userId: resetTarget.id, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type:"success", msg: data.message });
        setResetTarget(null); setNewPassword(""); setShowPwd(false);
      } else {
        setFeedback({ type:"error", msg: data.error });
      }
    } catch { setFeedback({ type:"error", msg:"Network error" }); }
    setResetting(false);
  };

  return (
    <div className="admin-panel" style={{ marginTop:"1.5rem" }}>
      <div className="admin-panel-header">
        <div>
          <div className="admin-panel-title">User Management</div>
          <div className="admin-panel-sub">{users.length} users</div>
        </div>
      </div>

      {feedback && (
        <div className={`status-banner ${feedback.type}`} style={{ margin:"0 0 1rem", padding:"0.75rem" }}>
          {feedback.msg}
          <button onClick={() => setFeedback(null)} style={{ float:"right", background:"none", border:"none", cursor:"pointer", fontWeight:"bold" }}>&times;</button>
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
                <th style={{ width:"220px" }}>Actions</th>
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
                      <div style={{ display:"flex", gap:"0.4rem", alignItems:"center" }}>
                        <div style={{ position:"relative", flex:1 }}>
                          <input
                            type={showPwd ? "text" : "password"}
                            className="field-input"
                            placeholder="New password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            style={{ fontSize:"0.8rem", padding:"0.3rem 2rem 0.3rem 0.5rem" }}
                          />
                          <button type="button" onClick={() => setShowPwd(v => !v)} style={{ position:"absolute", right:"0.4rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", padding:0, fontSize:"0.75rem" }}>
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
function ManagementDashboard({ entries, onLogout, mdFilterBranch, setMdFilterBranch, mdFilterDateFrom, setMdFilterDateFrom, mdFilterDateTo, setMdFilterDateTo, token, onEntriesChange }) {
  const [activeTab, setActiveTab]       = useState("dashboard");
  const [editingEntry, setEditingEntry] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting]         = useState(false);
  const [feedback, setFeedback]         = useState(null);

  // Auto-clear feedback toast
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/entries/${deleteConfirm.id}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type:"success", msg:"Entry deleted successfully" });
        onEntriesChange();
      } else {
        setFeedback({ type:"error", msg: data.error });
      }
    } catch { setFeedback({ type:"error", msg:"Network error" }); }
    setDeleteConfirm(null);
    setDeleting(false);
  };

  const now          = new Date();
  const today        = now.toLocaleDateString("en-CA");
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  const monthName    = now.toLocaleString("default", { month:"long", year:"numeric" });
  const isFiltered   = mdFilterBranch || mdFilterDateFrom || mdFilterDateTo;

  const totalEntries = entries.length;
  const totalRevenue = entries.reduce((s, e) => s + (Number(e.amount_paid) || 0), 0);
  const todayEntries = entries.filter(e => String(e.entry_date).slice(0,10) === today);
  const todayRevenue = todayEntries.reduce((s, e) => s + (Number(e.amount_paid) || 0), 0);
  const todayCount   = todayEntries.length;

  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const thisMonthRevenue = entries
    .filter(e => String(e.entry_date).slice(0,7) === currentMonthKey)
    .reduce((s, e) => s + (Number(e.amount_paid) || 0), 0);

  const revenueByScheme = {};
  const countByScheme   = {};
  entries.forEach(e => {
    const amt = Number(e.amount_paid) || 0;
    revenueByScheme[e.scheme_type] = (revenueByScheme[e.scheme_type] || 0) + amt;
    countByScheme[e.scheme_type]   = (countByScheme[e.scheme_type]   || 0) + 1;
  });

  const todayByScheme = {};
  todayEntries.forEach(e => {
    const amt = Number(e.amount_paid) || 0;
    todayByScheme[e.scheme_type] = (todayByScheme[e.scheme_type] || 0) + amt;
  });

  const uniqueBranchCount = new Set(entries.map(e => e.branch_name).filter(Boolean)).size;
  const schemeCount       = Object.keys(revenueByScheme).length;

  const clearFilters = () => { setMdFilterBranch(""); setMdFilterDateFrom(""); setMdFilterDateTo(""); };

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
          onSave={() => { setFeedback({ type:"success", msg:"Entry updated successfully" }); onEntriesChange(); }}
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
                <div className="field-group" style={{ minWidth:"180px", flex:1 }}>
                  <label className="field-label">Branch</label>
                  <select className="field-input" value={mdFilterBranch} onChange={e => setMdFilterBranch(e.target.value)}>
                    <option value="">All Branches</option>
                    {branches.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="field-group" style={{ minWidth:"150px", flex:1 }}>
                  <label className="field-label">From Date</label>
                  <input type="date" className="field-input" value={mdFilterDateFrom} onChange={e => setMdFilterDateFrom(e.target.value)} />
                </div>
                <div className="field-group" style={{ minWidth:"150px", flex:1 }}>
                  <label className="field-label">To Date</label>
                  <input type="date" className="field-input" value={mdFilterDateTo} onChange={e => setMdFilterDateTo(e.target.value)} />
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
              <div className="kpi-card" data-color="green">
                <div className="kpi-top">
                  <span className="kpi-icon-wrap kpi-icon-green">💰</span>
                  <span className="kpi-badge">{isFiltered ? "Filtered" : "All time"}</span>
                </div>
                <div className="kpi-value">₹{totalRevenue.toLocaleString()}</div>
                <div className="kpi-label">Total Revenue</div>
              </div>
              <div className="kpi-card" data-color="purple">
                <div className="kpi-top">
                  <span className="kpi-icon-wrap kpi-icon-purple">📅</span>
                  <span className="kpi-badge">{monthName}</span>
                </div>
                <div className="kpi-value">₹{thisMonthRevenue.toLocaleString()}</div>
                <div className="kpi-label">This Month</div>
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
                              <div className="scheme-bar-fill" style={{ width:`${pct}%`, background:color }} />
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

            {/* Entries Table with Edit/Delete */}
            <div className="admin-panel admin-table-panel">
              <div className="admin-table-header">
                <div>
                  <div className="admin-panel-title">
                    All Entries
                    <span className="entry-count-badge">{totalEntries}</span>
                  </div>
                  <div className="admin-panel-sub">
                    {isFiltered
                      ? [mdFilterBranch || "All Branches", mdFilterDateFrom && `From ${mdFilterDateFrom}`, mdFilterDateTo && `To ${mdFilterDateTo}`].filter(Boolean).join(" · ")
                      : "All branches · All time"}
                  </div>
                </div>
                {totalEntries > 0 && (
                  <button className="export-btn" onClick={() => exportToCSV(entries)}>
                    📥 Export CSV
                  </button>
                )}
              </div>

              {totalEntries === 0 ? (
                <div className="admin-empty" style={{ padding:"3rem" }}>
                  No entries found. Adjust filters or add data from a branch.
                </div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>S.No</th>
                        <th>Date</th>
                        <th>Branch</th>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Amount</th>
                        <th>Mode</th>
                        <th>Scheme</th>
                        <th>Referred By</th>
                        <th>Higher Official</th>
                        <th>Land / Gold</th>
                        <th>Notes</th>
                        <th style={{ width:"110px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e, idx) => {
                        const color = SCHEME_COLORS[e.scheme_type] || "#6b7280";
                        const landInfo = e.land_kind_of_payment
                          ? [e.land_kind_of_payment, e.land_site_name, e.land_layout, e.land_site_number && `#${e.land_site_number}`].filter(Boolean).join(" · ")
                          : e.gold_package ? `Gold: ${e.gold_package}` : "-";
                        return (
                          <tr key={e.id} className={idx % 2 === 0 ? "tr-even" : "tr-odd"}>
                            <td className="td-mono">{e.serial_number || "-"}</td>
                            <td className="td-nowrap">{formatDateToDDMMYYYY(e.entry_date)}</td>
                            <td className="td-branch">{e.branch_name}</td>
                            <td>{e.customer_name}</td>
                            <td className="td-mono">{e.phone_number}</td>
                            <td className="td-amount">₹{Number(e.amount_paid).toLocaleString()}</td>
                            <td>
                              <span className={`mode-badge mode-${(e.payment_mode||"").toLowerCase()}`}>
                                {e.payment_mode}
                              </span>
                            </td>
                            <td>
                              <span className="scheme-tag" style={{ background:`${color}18`, color, borderColor:`${color}40` }}>
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
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Branch Stats ─────────────────────────────────────────────────────────────
function BranchStats({ entries, filterDate }) {
  const now          = new Date();
  const today        = now.toLocaleDateString("en-CA"); // YYYY-MM-DD in local timezone
  const currentMonth = now.getMonth();
  const currentYear  = now.getFullYear();
  const monthName    = now.toLocaleString("default", { month:"long", year:"numeric" });

  const totalEntries    = entries.length;
  const totalRevenue    = entries.reduce((s, e) => s + (Number(e.amount_paid) || 0), 0);

  // Use filterDate from EntriesTable if provided, else fall back to today
  const selectedDate    = filterDate || today;
  const isToday         = selectedDate === today;
  const selectedEntries = entries.filter(e => String(e.entry_date).slice(0,10) === selectedDate);
  const todayRevenue    = selectedEntries.reduce((s, e) => s + (Number(e.amount_paid) || 0), 0);
  const todayCount      = selectedEntries.length;

  const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
  const thisMonthRevenue = entries
    .filter(e => String(e.entry_date).slice(0,7) === currentMonthKey)
    .reduce((s, e) => s + (Number(e.amount_paid) || 0), 0);

  const revenueByScheme = {};
  const countByScheme   = {};
  entries.forEach(e => {
    const amt = Number(e.amount_paid) || 0;
    revenueByScheme[e.scheme_type] = (revenueByScheme[e.scheme_type] || 0) + amt;
    countByScheme[e.scheme_type]   = (countByScheme[e.scheme_type]   || 0) + 1;
  });

  if (totalEntries === 0) return null;

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
          <div className="bkpi-value">₹{totalRevenue.toLocaleString()}</div>
          <div className="bkpi-label">Total Revenue</div>
        </div>
        <div className="bkpi-card bkpi-purple">
          <div className="bkpi-icon">📅</div>
          <div className="bkpi-value">₹{thisMonthRevenue.toLocaleString()}</div>
          <div className="bkpi-label">{monthName}</div>
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
                      <div className="bscheme-bar-fill" style={{ width:`${pct}%`, background: color }} />
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
function EntriesTable({ entries, branch, filterDate, setFilterDate }) {
  const todayLocal = new Date().toLocaleDateString("en-CA");

  const filtered = filterDate
    ? entries.filter(e => String(e.entry_date).slice(0,10) === filterDate)
    : entries;

  return (
    <div className="table-card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
        <SectionTitle icon="📊" title={`Recent Entries (${branch})`} />
        {filtered.length > 0 && (
          <button onClick={() => exportToCSV(filtered)} style={{ background:"var(--accent-green)", color:"white", border:"none", padding:"0.5rem 1rem", borderRadius:"6px", cursor:"pointer", fontWeight:"600", fontSize:"0.9rem" }}>
            📥 Export to Excel
          </button>
        )}
      </div>

      {/* Date filter */}
      <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"1rem", flexWrap:"wrap" }}>
        <label style={{ fontSize:"0.85rem", fontWeight:600, color:"var(--text-muted)", whiteSpace:"nowrap" }}>View Date:</label>
        <input
          type="date"
          className="field-input"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          style={{ maxWidth:"180px" }}
        />
        {filterDate !== todayLocal && (
          <button
            onClick={() => setFilterDate(todayLocal)}
            style={{ background:"none", border:"1px solid var(--border-light)", borderRadius:"6px", padding:"0.3rem 0.7rem", cursor:"pointer", fontSize:"0.8rem", color:"var(--text-muted)" }}
          >
            Back to Today
          </button>
        )}
        <span style={{ fontSize:"0.82rem", color:"var(--text-muted)" }}>
          {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {entries.length === 0 ? (
        <p style={{ color:"var(--text-muted)", fontSize:"0.9rem", marginTop:"1rem" }}>No entries found yet.</p>
      ) : filtered.length === 0 ? (
        <p style={{ color:"var(--text-muted)", fontSize:"0.9rem", marginTop:"1rem" }}>No entries for this date.</p>
      ) : (
        <table style={{ width:"100%", borderCollapse:"collapse", marginTop:"1rem", fontSize:"0.85rem", textAlign:"left", whiteSpace:"nowrap" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid var(--border-light)" }}>
              {["S.No","Date","Branch","Customer","Phone","Amount (₹)","Pay Mode","Txn Details","Scheme","Referred By","Official","Land Info","Gold Pkg","Notes"].map(h => (
                <th key={h} style={{ padding:"0.5rem" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => {
              const entryDateStr   = String(e.entry_date).slice(0,10);
              const createdDateStr = new Date(e.created_at).toLocaleDateString("en-CA");
              const createdLater   = createdDateStr > entryDateStr;
              return (
              <tr key={e.id} style={{ borderBottom:"1px solid #f3f4f6" }}>
                <td style={{ padding:"0.5rem" }}>{e.serial_number||"-"}</td>
                <td style={{ padding:"0.5rem" }}>
                  {formatDateToDDMMYYYY(e.entry_date)}
                  {createdLater && (
                    <div style={{ fontSize:"0.72rem", color:"#d97706", marginTop:"2px", whiteSpace:"normal", lineHeight:1.3 }}>
                      Created on {formatDateToDDMMYYYY(createdDateStr)}
                    </div>
                  )}
                </td>
                <td style={{ padding:"0.5rem" }}>{e.branch_name}</td>
                <td style={{ padding:"0.5rem" }}>{e.customer_name}</td>
                <td style={{ padding:"0.5rem" }}>{e.phone_number}</td>
                <td style={{ padding:"0.5rem", color:"var(--accent-green)", fontWeight:600 }}>{Number(e.amount_paid).toLocaleString()}</td>
                <td style={{ padding:"0.5rem" }}>{e.payment_mode}</td>
                <td style={{ padding:"0.5rem" }}>{e.transaction_details||"-"}</td>
                <td style={{ padding:"0.5rem" }}>{e.scheme_type}</td>
                <td style={{ padding:"0.5rem" }}>{e.referred_by ? `${e.referred_by}${e.referred_by_emp_id ? ` (${e.referred_by_emp_id})` : ""} - ${e.referred_by_role||"No Role"}` : "-"}</td>
                <td style={{ padding:"0.5rem" }}>{e.higher_official ? `${e.higher_official}${e.higher_official_emp_id ? ` (${e.higher_official_emp_id})` : ""} - ${e.higher_official_role||"No Role"}` : "-"}</td>
                <td style={{ padding:"0.5rem" }}>{e.land_kind_of_payment ? `${e.land_kind_of_payment} | ${e.land_site_name||""} ${e.land_layout||""} ${e.land_site_number ? `(#${e.land_site_number})` : ""}` : "-"}</td>
                <td style={{ padding:"0.5rem" }}>{e.gold_package||"-"}</td>
                <td style={{ padding:"0.5rem" }}>{e.notes||"-"}</td>
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
const todayISO = () => new Date().toISOString().split("T")[0];

const initialForm = {
  entry_date: todayISO(), branch_name:"", customer_name:"",
  phone_number:"", amount_paid:"", payment_mode:"", transaction_details:"",
  scheme_type:"",
  referred_by:"", referred_by_emp_id:"", referred_by_role:"",
  higher_official:"", higher_official_emp_id:"", higher_official_role:"",
  notes:"",
  land_kind_of_payment:"", land_site_name:"", land_layout:"", land_site_number:"",
  gold_package:"",
};

export default function CustomerEntryForm() {
  const [user, setUser] = useState(() => {
    const token  = localStorage.getItem("token");
    const branch = localStorage.getItem("branch");
    const role   = localStorage.getItem("role") || "branch";
    return token ? { token, branch, role } : null;
  });

  const [form,            setForm]            = useState({ ...initialForm, branch_name: localStorage.getItem("branch") || "" });
  const [status,          setStatus]          = useState(null);
  const [loading,         setLoading]         = useState(false);
  const [entries,         setEntries]         = useState([]);
  const [mdFilterBranch,  setMdFilterBranch]  = useState("");
  const [mdFilterDateFrom,setMdFilterDateFrom]= useState("");
  const [mdFilterDateTo,  setMdFilterDateTo]  = useState("");
  const [filterDate,      setFilterDate]      = useState(new Date().toLocaleDateString("en-CA"));

  // Sync form branch when user changes (login / logout)
  useEffect(() => {
    if (user) setForm(prev => ({ ...prev, branch_name: user.branch }));
  }, [user]);

  // Re-fetch entries whenever user or any MD filter changes
  useEffect(() => {
    if (!user) return;
    const fetchEntries = async () => {
      try {
        const isAdmin = user.branch === "ALL" || user.role === "management";
        let url = `${API_BASE}/entries?branch=${encodeURIComponent(user.branch)}`;
        if (isAdmin && mdFilterBranch)   url += `&filterBranch=${encodeURIComponent(mdFilterBranch)}`;
        if (isAdmin && mdFilterDateFrom) url += `&date_from=${mdFilterDateFrom}`;
        if (isAdmin && mdFilterDateTo)   url += `&date_to=${mdFilterDateTo}`;
        const res  = await fetch(url);
        const data = await res.json();
        if (data.success) setEntries(data.data);
      } catch (err) {
        console.error("Failed to fetch entries", err);
      }
    };
    fetchEntries();
  }, [user, mdFilterBranch, mdFilterDateFrom, mdFilterDateTo]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("branch");
    localStorage.removeItem("role");
    setUser(null);
    setEntries([]);
  };

  const set = (field) => (e) =>
    setForm(prev => ({
      ...prev,
      [field]: e.target.value,
      ...(field === "scheme_type"    ? { land_kind_of_payment:"", land_site_name:"", land_layout:"", land_site_number:"", gold_package:"" } : {}),
      ...(field === "land_site_name" ? { land_layout:"" } : {}),
    }));

  const handleSubmit = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/entries`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type:"success", msg:`Entry saved! S.No ${data.serial_number}` });
        setForm({ ...initialForm, entry_date: todayISO(), branch_name: user.branch });
        window.scrollTo({ top:0, behavior:"smooth" });
        // Re-trigger fetch by touching a dummy flag — actually just call directly
        const url = `${API_BASE}/entries?branch=${encodeURIComponent(user.branch)}`;
        const r   = await fetch(url);
        const d   = await r.json();
        if (d.success) setEntries(d.data);
      } else {
        setStatus({ type:"error", msg: data.error });
      }
    } catch {
      setStatus({ type:"error", msg:"Cannot reach the backend." });
    } finally {
      setLoading(false);
    }
  };

  const refetchEntries = async () => {
    const isAdmin = user?.branch === "ALL" || user?.role === "management";
    let url = `${API_BASE}/entries?branch=${encodeURIComponent(user.branch)}`;
    if (isAdmin && mdFilterBranch)   url += `&filterBranch=${encodeURIComponent(mdFilterBranch)}`;
    if (isAdmin && mdFilterDateFrom) url += `&date_from=${mdFilterDateFrom}`;
    if (isAdmin && mdFilterDateTo)   url += `&date_to=${mdFilterDateTo}`;
    try {
      const res  = await fetch(url);
      const data = await res.json();
      if (data.success) setEntries(data.data);
    } catch (err) { console.error("Failed to fetch entries", err); }
  };

  if (!user) return <Login onLogin={setUser} />;

  if (user.role === "management") {
    return (
      <ManagementDashboard
        entries={entries}
        onLogout={handleLogout}
        mdFilterBranch={mdFilterBranch}
        setMdFilterBranch={setMdFilterBranch}
        mdFilterDateFrom={mdFilterDateFrom}
        setMdFilterDateFrom={setMdFilterDateFrom}
        mdFilterDateTo={mdFilterDateTo}
        setMdFilterDateTo={setMdFilterDateTo}
        token={user.token}
        onEntriesChange={refetchEntries}
      />
    );
  }

  if (user.branch === "ALL") {
    return (
      <MDDashboard
        entries={entries}
        onLogout={handleLogout}
        mdFilterBranch={mdFilterBranch}
        setMdFilterBranch={setMdFilterBranch}
        mdFilterDateFrom={mdFilterDateFrom}
        setMdFilterDateFrom={setMdFilterDateFrom}
        mdFilterDateTo={mdFilterDateTo}
        setMdFilterDateTo={setMdFilterDateTo}
      />
    );
  }

  const isLand        = form.scheme_type === "LAND";
  const isGoldOrJewel = form.scheme_type === "GOLD COIN SAVINGS" || form.scheme_type === "JEWEL SAVINGS";

  return (
    <div className="page-bg">
      <div className="form-card">
        {/* Header */}
        <div className="form-header" style={{ position:"relative" }}>
          <button onClick={handleLogout} style={{ position:"absolute", top:0, right:0, background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:"0.85rem", textDecoration:"underline" }}>
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
          <TextInput label="Date" required type="date" value={form.entry_date} onChange={set("entry_date")} max={todayISO()} />
          <SelectInput label="Branch Name" required value={form.branch_name} onChange={set("branch_name")} options={branches} disabled />
          <TextInput label="Customer Name" required value={form.customer_name} onChange={set("customer_name")} placeholder="Full name" />
          <TextInput label="Phone Number" required type="tel" value={form.phone_number} onChange={set("phone_number")} placeholder="+91 XXXXX XXXXX" />
          <TextInput label="Amount Paid (₹)" required type="number" value={form.amount_paid} onChange={set("amount_paid")} placeholder="0.00" />
          <SelectInput label="Payment Mode" required value={form.payment_mode} onChange={set("payment_mode")} options={["Cash","Bank","GPay"]} placeholder="Select mode" />
          <TextInput label="Transaction Details" value={form.transaction_details} onChange={set("transaction_details")} placeholder="Ref / UTR / cheque no." />
          <SelectInput label="Scheme Type" required value={form.scheme_type} onChange={set("scheme_type")} options={schemes} placeholder="Select scheme" />
        </div>

        {/* Section 2 */}
        <SectionTitle icon="🤝" title="Reference & Officials" />
        <div className="grid-2">
          <PersonRow
            nameLabel="Referred By"
            nameProps={{ value:form.referred_by, onChange:set("referred_by"), placeholder:"Referrer name" }}
            empIdProps={{ value:form.referred_by_emp_id, onChange:set("referred_by_emp_id") }}
            roleProps={{ value:form.referred_by_role, onChange:set("referred_by_role") }}
          />
          <PersonRow
            nameLabel="Higher Official"
            nameProps={{ value:form.higher_official, onChange:set("higher_official"), placeholder:"Official name" }}
            empIdProps={{ value:form.higher_official_emp_id, onChange:set("higher_official_emp_id") }}
            roleProps={{ value:form.higher_official_role, onChange:set("higher_official_role") }}
          />
        </div>

        <div className="field-group full-width" style={{ marginTop:"0.5rem" }}>
          <FieldLabel>Notes</FieldLabel>
          <textarea className="field-input" rows="3" placeholder="Any additional remarks…" value={form.notes} onChange={set("notes")} />
        </div>

        {/* Section 3: Land */}
        {isLand && (
          <div className="sub-section land-section">
            <SectionTitle icon="🏡" title="Land Scheme Details" />
            <div className="grid-2">
              <SelectInput label="Kind of Payment" value={form.land_kind_of_payment} onChange={set("land_kind_of_payment")} options={["Advance","Full"]} placeholder="Select type" />
              <SelectInput
                label="Name of Site"
                value={form.land_site_name} onChange={set("land_site_name")}
                options={["Maiylam","Sunrise City","Veppur Site","SR Grand City 2","Melmalaiyanur Site","SIV City","Uchimadu"]}
                placeholder="Select site"
              />
              <TextInput label="Site Number" value={form.land_site_number} onChange={set("land_site_number")} placeholder="e.g. Plot 42 / SN-007" />
              {form.land_site_name === "Veppur Site" && (
                <SelectInput label="Veppur Layout" value={form.land_layout} onChange={set("land_layout")} options={veppurOptions} placeholder="Select layout" />
              )}
              {form.land_site_name === "Melmalaiyanur Site" && (
                <SelectInput label="Melmalaiyanur Layout" value={form.land_layout} onChange={set("land_layout")} options={melmalaiyanurOpts} placeholder="Select layout" />
              )}
            </div>
          </div>
        )}

        {/* Section 4: Gold */}
        {isGoldOrJewel && (
          <div className="sub-section gold-section">
            <SectionTitle icon="💎" title="Gold / Jewel Savings Details" />
            <div className="grid-2">
              <SelectInput label="Package" value={form.gold_package} onChange={set("gold_package")} options={["Single","Full"]} placeholder="Select package" />
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

      <BranchStats entries={entries} filterDate={filterDate} />
      <EntriesTable entries={entries} branch={user.branch} filterDate={filterDate} setFilterDate={setFilterDate} />
    </div>
  );
}

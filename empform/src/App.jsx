import React, { useState, useEffect } from "react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api`
  : "http://localhost:5000/api";

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

const veppurOptions    = ["Krishna Garden 3","Narayanapuram","Vasantha Garden"];
const melmalaiyanurOpts = ["VRJ City"];

// ── Login Component ─────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [mode, setMode] = useState("login"); // "login" or "change_password"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "login") {
      try {
        const res = await fetch(`${API_BASE}/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.error || "Login failed");
        } else {
          localStorage.setItem("token", data.token);
          localStorage.setItem("branch", data.branch);
          onLogin(data);
        }
      } catch (err) {
        setError("Network error.");
      }
    } else {
      try {
        const res = await fetch(`${API_BASE}/change-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, currentPassword: password, newPassword })
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.error || "Password change failed");
        } else {
          setSuccess("Password updated successfully! Please login.");
          setMode("login");
          setPassword("");
          setNewPassword("");
        }
      } catch (err) {
        setError("Network error.");
      }
    }
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
          {error && <div className="status-banner error" style={{ marginBottom: "0", padding: "0.75rem" }}>{error}</div>}
          {success && <div className="status-banner" style={{ marginBottom: "0", padding: "0.75rem", background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0" }}>{success}</div>}
          
          <div className="field-group">
            <label className="field-label">Email</label>
            <input type="email" className="field-input" required value={email} onChange={e => setEmail(e.target.value)} placeholder="branch@gmail.com" />
          </div>
          
          <div className="field-group">
            <label className="field-label">{mode === "login" ? "Password" : "Current Password"}</label>
            <input type="password" className="field-input" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          {mode === "change_password" && (
            <div className="field-group">
              <label className="field-label">New Password</label>
              <input type="password" className="field-input" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
            </div>
          )}

          <button type="submit" className="submit-btn" disabled={loading} style={{ width: "100%", marginTop: "0.5rem", justifyContent: "center" }}>
            {loading ? "Processing..." : (mode === "login" ? "Login" : "Change Password")}
          </button>
          
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button 
              type="button" 
              onClick={() => {
                setMode(mode === "login" ? "change_password" : "login");
                setError("");
                setSuccess("");
                setPassword("");
                setNewPassword("");
              }}
              style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", textDecoration: "underline", fontSize: "0.9rem" }}
            >
              {mode === "login" ? "Change your password?" : "Back to login"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main App Component ──────────────────────────────────────────────────────
const initialForm = {
  serial_number:"", entry_date:"", branch_name:"", customer_name:"",
  phone_number:"", amount_paid:"", payment_mode:"", transaction_details:"",
  scheme_type:"",
  referred_by:"", referred_by_emp_id:"",
  higher_official:"", higher_official_emp_id:"",
  notes:"",
  land_kind_of_payment:"", land_site_name:"", land_layout:"", land_site_number:"",
  gold_package:"",
};

// Reusable field components
function FieldLabel({ children, required }) {
  return (
    <label className="field-label">
      {children}
      {required && <span className="required-star"> *</span>}
    </label>
  );
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
        {options.map((o) =>
          typeof o === "string"
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>
        )}
      </select>
    </div>
  );
}

// A paired row: Name + Employee ID side by side
function PersonRow({ nameLabel, nameProps, empIdProps, required }) {
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
    </div>
  );
}

export default function CustomerEntryForm() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem("token");
    const branch = localStorage.getItem("branch");
    return token ? { token, branch } : null;
  });

  const [form, setForm] = useState({ ...initialForm, branch_name: user?.branch || "" });
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (user) {
      setForm(prev => ({ ...prev, branch_name: user.branch }));
      fetchEntries();
    }
  }, [user]);

  const fetchEntries = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_BASE}/entries?branch=${encodeURIComponent(user.branch)}`);
      const data = await res.json();
      if (data.success) setEntries(data.data);
    } catch (err) {
      console.error("Failed to fetch entries", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("branch");
    setUser(null);
  };

  const set = (field) => (e) =>
    setForm((prev) => ({
      ...prev,
      [field]: e.target.value,
      ...(field === "scheme_type"   ? { land_kind_of_payment:"", land_site_name:"", land_layout:"", land_site_number:"", gold_package:"" } : {}),
      ...(field === "land_site_name" ? { land_layout:"" } : {}),
    }));

  const handleSubmit = async () => {
    setStatus(null);
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/entries`, {
        method : "POST",
        headers: { "Content-Type": "application/json" },
        body   : JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setStatus({ type:"success", msg:`Entry saved! (ID #${data.id})` });
        setForm({ ...initialForm, branch_name: user.branch });
        window.scrollTo({ top:0, behavior:"smooth" });
        fetchEntries(); // Refresh table
      } else {
        setStatus({ type:"error", msg: data.error });
      }
    } catch {
      setStatus({ type:"error", msg:"Cannot reach the backend." });
    } finally {
      setLoading(false);
    }
  };

  const isLand       = form.scheme_type === "LAND";
  const isGoldOrJewel = form.scheme_type === "GOLD COIN SAVINGS" || form.scheme_type === "JEWEL SAVINGS";

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="page-bg">
      <div className="form-card">
        {/* Header */}
        <div className="form-header" style={{ position: "relative" }}>
          <button 
            onClick={handleLogout} 
            style={{ position: "absolute", top: 0, right: 0, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}
          >
            Logout
          </button>
          <img src="/AVG_logo.jpeg" alt="Agilavetri PrimeTech Logo" className="brand-logo" />
          <div>
            <h1 className="form-title">Customer Entry Form</h1>
            <p className="form-subtitle">Branch: {user.branch}</p>
          </div>
        </div>

        {/* Status banner */}
        {status && (
          <div className={`status-banner ${status.type}`}>
            <span className="status-icon">{status.type === "success" ? "✓" : "✕"}</span>
            {status.msg}
          </div>
        )}

        {/* ── Section 1: Basic Details ─────────────────────── */}
        <SectionTitle icon="📋" title="Basic Details" />
        <div className="grid-2">
          <TextInput label="S.No" value={form.serial_number} onChange={set("serial_number")} placeholder="Auto / manual" />
          <TextInput label="Date" required type="date" value={form.entry_date} onChange={set("entry_date")} />
          <SelectInput label="Branch Name" required value={form.branch_name} onChange={set("branch_name")} options={branches} disabled />
          <TextInput label="Customer Name" required value={form.customer_name} onChange={set("customer_name")} placeholder="Full name" />
          <TextInput label="Phone Number" required type="tel" value={form.phone_number} onChange={set("phone_number")} placeholder="+91 XXXXX XXXXX" />
          <TextInput label="Amount Paid (₹)" required type="number" value={form.amount_paid} onChange={set("amount_paid")} placeholder="0.00" />
          <SelectInput
            label="Payment Mode" required
            value={form.payment_mode} onChange={set("payment_mode")}
            options={["Cash","Bank","GPay"]}
            placeholder="Select mode"
          />
          <TextInput label="Transaction Details" value={form.transaction_details} onChange={set("transaction_details")} placeholder="Ref / UTR / cheque no." />
          <SelectInput
            label="Scheme Type" required
            value={form.scheme_type} onChange={set("scheme_type")}
            options={schemes} placeholder="Select scheme"
          />
        </div>

        {/* ── Section 2: Reference ─────────────────────────── */}
        <SectionTitle icon="🤝" title="Reference & Officials" />
        <div className="grid-2">
          <PersonRow
            nameLabel="Referred By"
            nameProps={{ value: form.referred_by, onChange: set("referred_by"), placeholder: "Referrer name" }}
            empIdProps={{ value: form.referred_by_emp_id, onChange: set("referred_by_emp_id") }}
          />
          <PersonRow
            nameLabel="Higher Official"
            nameProps={{ value: form.higher_official, onChange: set("higher_official"), placeholder: "Official name" }}
            empIdProps={{ value: form.higher_official_emp_id, onChange: set("higher_official_emp_id") }}
          />
        </div>

        {/* Notes */}
        <div className="field-group full-width" style={{ marginTop: "0.5rem" }}>
          <FieldLabel>Notes</FieldLabel>
          <textarea
            className="field-input"
            rows="3"
            placeholder="Any additional remarks…"
            value={form.notes}
            onChange={set("notes")}
          />
        </div>

        {/* ── Section 3: Land ──────────────────────────────── */}
        {isLand && (
          <div className="sub-section land-section">
            <SectionTitle icon="🏡" title="Land Scheme Details" />
            <div className="grid-2">
              <SelectInput
                label="Kind of Payment"
                value={form.land_kind_of_payment} onChange={set("land_kind_of_payment")}
                options={["Advance","Full"]} placeholder="Select type"
              />
              <SelectInput
                label="Name of Site"
                value={form.land_site_name} onChange={set("land_site_name")}
                options={["Maiylam","Sunrise City","Veppur Site","SR Grand City 2","Melmalaiyanur Site","SIV City","Uchimadu"]}
                placeholder="Select site"
              />
              <TextInput
                label="Site Number"
                value={form.land_site_number}
                onChange={set("land_site_number")}
                placeholder="e.g. Plot 42 / SN-007"
              />
              {form.land_site_name === "Veppur Site" && (
                <SelectInput label="Veppur Layout" value={form.land_layout} onChange={set("land_layout")} options={veppurOptions} placeholder="Select layout" />
              )}
              {form.land_site_name === "Melmalaiyanur Site" && (
                <SelectInput label="Melmalaiyanur Layout" value={form.land_layout} onChange={set("land_layout")} options={melmalaiyanurOpts} placeholder="Select layout" />
              )}
            </div>
          </div>
        )}

        {/* ── Section 4: Gold / Jewel ──────────────────────── */}
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
            {loading ? (
              <><span className="spinner" /> Saving…</>
            ) : (
              <><span className="btn-icon">→</span> Submit Entry</>
            )}
          </button>
        </div>
      </div>

      {/* ── Recent Entries Table ─────────────────────────────── */}
      <div className="form-card" style={{ marginTop: "2rem", overflowX: "auto" }}>
        <SectionTitle icon="📊" title="Recent Entries (Your Branch)" />
        {entries.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>No entries found for {user.branch} yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem", fontSize: "0.85rem", textAlign: "left", whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-light)" }}>
                <th style={{ padding: "0.5rem" }}>S.No</th>
                <th style={{ padding: "0.5rem" }}>Date</th>
                <th style={{ padding: "0.5rem" }}>Customer</th>
                <th style={{ padding: "0.5rem" }}>Phone</th>
                <th style={{ padding: "0.5rem" }}>Amount (₹)</th>
                <th style={{ padding: "0.5rem" }}>Pay Mode</th>
                <th style={{ padding: "0.5rem" }}>Txn Details</th>
                <th style={{ padding: "0.5rem" }}>Scheme</th>
                <th style={{ padding: "0.5rem" }}>Referred By</th>
                <th style={{ padding: "0.5rem" }}>Official</th>
                <th style={{ padding: "0.5rem" }}>Land Info</th>
                <th style={{ padding: "0.5rem" }}>Gold Pkg</th>
                <th style={{ padding: "0.5rem" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "0.5rem" }}>{e.serial_number || "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{new Date(e.entry_date).toLocaleDateString()}</td>
                  <td style={{ padding: "0.5rem" }}>{e.customer_name}</td>
                  <td style={{ padding: "0.5rem" }}>{e.phone_number}</td>
                  <td style={{ padding: "0.5rem", color: "var(--accent-green)", fontWeight: 600 }}>{Number(e.amount_paid).toLocaleString()}</td>
                  <td style={{ padding: "0.5rem" }}>{e.payment_mode}</td>
                  <td style={{ padding: "0.5rem" }}>{e.transaction_details || "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{e.scheme_type}</td>
                  <td style={{ padding: "0.5rem" }}>{e.referred_by ? `${e.referred_by} (${e.referred_by_emp_id})` : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{e.higher_official ? `${e.higher_official} (${e.higher_official_emp_id})` : "-"}</td>
                  <td style={{ padding: "0.5rem" }}>
                    {e.land_kind_of_payment ? `${e.land_kind_of_payment} | ${e.land_site_name || ""} ${e.land_layout || ""} ${e.land_site_number ? `(#${e.land_site_number})` : ""}` : "-"}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{e.gold_package || "-"}</td>
                  <td style={{ padding: "0.5rem" }}>{e.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
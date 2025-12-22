import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ReportCategory,
  CorpsMemberEntry,
  DauraLga,
  UserRole,
} from "./types";
import {
  PlusIcon,
  TrashIcon,
  LogOutIcon,
  SearchIcon,
} from "./components/Icons";
import {
  initFirebase,
  subscribeToReports,
  addReport,
  updateReport,
  deleteReport,
} from "./services/firebaseService";

/* ================= CONFIG ================= */

const firebaseConfig = {
  apiKey: "AIzaSyA4Jk01ZevFJ0KjpCPysA9oWMeN56_QLcQ",
  authDomain: "weeklyreport-a150a.firebaseapp.com",
  projectId: "weeklyreport-a150a",
  storageBucket: "weeklyreport-a150a.firebasestorage.app",
  messagingSenderId: "225162027576",
  appId: "1:225162027576:web:410acb6dc77acc0ecebccd",
};

const DAURA_ZONE_LGAS: DauraLga[] = [
  "Daura","Baure","Zango","Sandamu","Mai’Adua","Mashi","Dutsi","Mani","Bindawa"
];

const SECURITY_PINS: Record<string, string> = {
  ZI: "0000",
  Daura: "1111",
  Baure: "2222",
  Zango: "3333",
  Sandamu: "4444",
  "Mai’Adua": "5555",
  Mashi: "6666",
  Dutsi: "7777",
  Mani: "8888",
  Bindawa: "9999",
};

type View = "DASHBOARD" | "FORM";

/* ================= APP ================= */

const App: React.FC = () => {
  const [auth, setAuth] = useState(localStorage.getItem("daura_auth") === "true");
  const [role, setRole] = useState<UserRole | null>(
    localStorage.getItem("daura_role") as UserRole
  );
  const [lga, setLga] = useState<DauraLga | null>(
    localStorage.getItem("daura_lga") as DauraLga
  );

  const [entries, setEntries] = useState<CorpsMemberEntry[]>([]);
  const [view, setView] = useState<View>("DASHBOARD");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<CorpsMemberEntry | null>(null);

  const [form, setForm] = useState({
    name: "",
    stateCode: "",
    category: ReportCategory.SICK,
    details: "",
  });

  const db = useRef<any>(null);

  /* ===== FIREBASE ===== */
  useEffect(() => {
    if (!auth) return;
    db.current = initFirebase(firebaseConfig);
    return subscribeToReports(db.current, setEntries);
  }, [auth]);

  /* ===== FILTER ===== */
  const visible = useMemo(() => {
    const base =
      role === "ZI" ? entries : entries.filter((e) => e.lga === lga);
    return base.filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.stateCode.toLowerCase().includes(search.toLowerCase())
    );
  }, [entries, role, lga, search]);

  /* ===== LOGIN ===== */
  const login = (r: UserRole, l: DauraLga | null, pin: string) => {
    const key = r === "ZI" ? "ZI" : l;
    if (!key || SECURITY_PINS[key] !== pin) return alert("Invalid PIN");

    localStorage.setItem("daura_auth", "true");
    localStorage.setItem("daura_role", r);
    if (l) localStorage.setItem("daura_lga", l);

    setRole(r);
    setLga(l);
    setAuth(true);
  };

  const logout = () => {
    localStorage.clear();
    location.reload();
  };

  /* ===== SAVE / UPDATE ===== */
  const save = async () => {
    const payload = {
      name: form.name,
      stateCode: form.stateCode,
      category: form.category,
      lga: lga,
      details: form.details,
      dateAdded: new Date().toISOString(),
    };

    if (editing) {
      await updateReport(db.current, editing.id, payload);
    } else {
      await addReport(db.current, payload);
    }

    setForm({ name: "", stateCode: "", category: ReportCategory.SICK, details: "" });
    setEditing(null);
    setView("DASHBOARD");
  };

  /* ===== LOGIN UI ===== */
  if (!auth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-purple-700 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-10 w-full max-w-md shadow-2xl">
          <h1 className="text-2xl font-black text-center">
            NYSC DAURA ZONAL HQ
          </h1>
          <p className="text-xs text-center text-gray-500 mb-8">
            Official Weekly Compliance Reporting System
          </p>

          {/* Simple demo login */}
          <button
            className="w-full bg-indigo-600 text-white py-3 rounded-xl"
            onClick={() => login("ZI", null, "0000")}
          >
            Login as ZI (Demo)
          </button>
        </div>
      </div>
    );
  }

  /* ===== MAIN UI ===== */
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-4 flex justify-between">
        <h1>{role === "ZI" ? "Zonal Inspector Dashboard" : `${lga} LGI Terminal`}</h1>
        <button onClick={logout}><LogOutIcon /></button>
      </header>

      {view === "DASHBOARD" && (
        <main className="p-6 space-y-4">
          <div className="flex gap-2">
            <SearchIcon />
            <input
              className="border p-2 flex-1 rounded-xl"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={() => setView("FORM")} className="bg-indigo-600 text-white px-4 rounded-xl">
              <PlusIcon />
            </button>
          </div>

          <table className="w-full bg-white rounded-xl overflow-hidden">
            <thead className="bg-slate-100">
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>LGA</th>
                <th>Date</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.category}</td>
                  <td>{e.lga}</td>
                  <td>{new Date(e.dateAdded).toLocaleDateString()}</td>
                  <td className="flex gap-2">
                    <button onClick={() => { setEditing(e); setForm(e as any); setView("FORM"); }}>
                      ✏️
                    </button>
                    {role === "ZI" && (
                      <button onClick={() => deleteReport(db.current, e.id)}>
                        <TrashIcon />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      )}

      {view === "FORM" && (
        <main className="p-6 max-w-xl mx-auto">
          <h2 className="text-xl font-black mb-4">
            {editing ? "Update Record" : "New Record"}
          </h2>

          <input className="input" placeholder="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} />

          <input className="input" placeholder="State Code"
            value={form.stateCode}
            onChange={(e) => setForm({ ...form, stateCode: e.target.value })} />

          <select className="input"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as ReportCategory })}>
            {Object.values(ReportCategory).map(c => <option key={c}>{c}</option>)}
          </select>

          <textarea className="input h-28"
            placeholder="Details (illness, duration, date, cause)"
            value={form.details}
            onChange={(e) => setForm({ ...form, details: e.target.value })} />

          <div className="flex gap-3 mt-4">
            <button className="btn-primary" onClick={save}>
              {editing ? "Update" : "Save"}
            </button>
            <button className="btn-secondary" onClick={() => setView("DASHBOARD")}>
              Cancel
            </button>
          </div>
        </main>
      )}
    </div>
  );
};

export default App;

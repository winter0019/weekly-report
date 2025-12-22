import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ReportCategory,
  CorpsMemberEntry,
  DauraLga,
  UserRole
} from "./types";
import {
  initFirebase,
  subscribeToReports,
  addReport,
  updateReport,
  deleteReport
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

const LGAS: DauraLga[] = [
  "Daura","Baure","Zango","Sandamu","Mai’Adua","Mashi","Dutsi","Mani","Bindawa"
];

const PINS: Record<string,string> = {
  ZI:"0000", Daura:"1111", Baure:"2222", Zango:"3333", Sandamu:"4444",
  "Mai’Adua":"5555", Mashi:"6666", Dutsi:"7777", Mani:"8888", Bindawa:"9999"
};

type View = "DASHBOARD" | "FORM";

/* ================= APP ================= */

const App: React.FC = () => {
  const [auth, setAuth] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [lga, setLga] = useState<DauraLga | null>(null);

  const [entries, setEntries] = useState<CorpsMemberEntry[]>([]);
  const [view, setView] = useState<View>("DASHBOARD");

  const [editing, setEditing] = useState<CorpsMemberEntry | null>(null);

  const [form, setForm] = useState<any>({
    name: "",
    stateCode: "",
    category: ReportCategory.SICK,
    detail: "",
    hospitalized: false
  });

  const dbRef = useRef<any>(null);

  /* ===== INIT ===== */
  useEffect(() => {
    if (!auth) return;
    dbRef.current = initFirebase(firebaseConfig);
    return subscribeToReports(dbRef.current, setEntries);
  }, [auth]);

  /* ===== FILTER ===== */
  const visible = useMemo(() => {
    if (role === "ZI") return entries;
    return entries.filter(e => e.lga === lga);
  }, [entries, role, lga]);

  /* ===== LOGIN ===== */
  const login = (r: UserRole, lg: DauraLga | null, pin: string) => {
    const key = r === "ZI" ? "ZI" : lg!;
    if (PINS[key] !== pin) return alert("Wrong PIN");

    setAuth(true);
    setRole(r);
    setLga(lg);
  };

  /* ===== SAVE / UPDATE ===== */
  const save = async () => {
    if (!lga) return;

    const payload = {
      name: form.name,
      stateCode: form.stateCode,
      lga,
      category: form.category,
      detail: form.detail,
      hospitalized: form.hospitalized || false,
      dateAdded: editing ? editing.dateAdded : new Date().toISOString()
    };

    if (editing) {
      await updateReport(dbRef.current, editing.id, payload);
    } else {
      await addReport(dbRef.current, payload);
    }

    setEditing(null);
    setForm({ name:"", stateCode:"", category:ReportCategory.SICK, detail:"" });
    setView("DASHBOARD");
  };

  /* ===== UI ===== */
  if (!auth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-xl shadow w-96 space-y-4">
          <h2 className="font-bold text-lg text-center">NYSC LOGIN</h2>

          <select onChange={e => setRole(e.target.value as UserRole)} className="w-full p-2 border rounded">
            <option value="">Role</option>
            <option value="ZI">Zonal Inspector</option>
            <option value="LGI">LGI</option>
          </select>

          {role === "LGI" && (
            <select onChange={e => setLga(e.target.value as DauraLga)} className="w-full p-2 border rounded">
              <option value="">Select LGA</option>
              {LGAS.map(l => <option key={l}>{l}</option>)}
            </select>
          )}

          <input id="pin" placeholder="PIN" className="w-full p-2 border rounded text-center" />

          <button
            onClick={() => login(role!, lga, (document.getElementById("pin") as HTMLInputElement).value)}
            className="w-full bg-slate-900 text-white p-2 rounded"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      {view === "DASHBOARD" && (
        <>
          <div className="flex justify-between mb-4">
            <h1 className="font-bold text-xl">
              {role === "ZI" ? "DAURA ZONAL HQ" : `${lga} LGI`}
            </h1>
            <button onClick={() => setView("FORM")} className="bg-emerald-600 text-white px-4 py-2 rounded">
              + New / Update
            </button>
          </div>

          <table className="w-full bg-white rounded shadow">
            <thead>
              <tr className="bg-slate-100">
                <th>Name</th><th>Category</th><th>LGA</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(e => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.category}</td>
                  <td>{e.lga}</td>
                  <td>
                    <button
                      onClick={() => {
                        setEditing(e);
                        setForm(e as any);
                        setView("FORM");
                      }}
                      className="text-blue-600 mr-2"
                    >
                      Edit
                    </button>
                    {role === "ZI" && (
                      <button onClick={() => deleteReport(dbRef.current, e.id)} className="text-red-600">
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {view === "FORM" && (
        <div className="max-w-xl bg-white p-6 rounded shadow">
          <h2 className="font-bold mb-4">{editing ? "Update Record" : "New Record"}</h2>

          <input placeholder="Full Name" className="w-full p-2 border mb-2"
            value={form.name} onChange={e => setForm({...form, name:e.target.value})} />

          <input placeholder="State Code" className="w-full p-2 border mb-2"
            value={form.stateCode} onChange={e => setForm({...form, stateCode:e.target.value})} />

          <select className="w-full p-2 border mb-2"
            value={form.category}
            onChange={e => setForm({...form, category:e.target.value})}>
            {Object.values(ReportCategory).map(c => <option key={c}>{c}</option>)}
          </select>

          <textarea placeholder="Details" className="w-full p-2 border mb-4"
            value={form.detail} onChange={e => setForm({...form, detail:e.target.value})} />

          <div className="flex gap-2">
            <button onClick={save} className="bg-emerald-600 text-white px-4 py-2 rounded">
              {editing ? "Update" : "Save"}
            </button>
            <button onClick={() => setView("DASHBOARD")} className="px-4 py-2 border rounded">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

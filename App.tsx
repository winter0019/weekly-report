import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ReportCategory,
  CorpsMemberEntry,
  DauraLga,
  UserRole,
} from "./types";
import {
  PlusIcon,
  DownloadIcon,
  ShareIcon,
  LogOutIcon,
  TrashIcon,
  FileTextIcon,
  SearchIcon,
  DashboardIcon,
} from "./components/Icons";
import { summarizeReport } from "./services/geminiService";
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
  "Daura",
  "Baure",
  "Zango",
  "Sandamu",
  "Mai’Adua",
  "Mashi",
  "Dutsi",
  "Mani",
  "Bindawa",
];

/* ================= APP ================= */

type ViewMode = "DASHBOARD" | "FORM" | "SUMMARY";

const App: React.FC = () => {
  const [entries, setEntries] = useState<CorpsMemberEntry[]>([]);
  const [editingEntry, setEditingEntry] = useState<CorpsMemberEntry | null>(null);

  const [currentView, setCurrentView] = useState<ViewMode>("DASHBOARD");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState<any>({
    name: "",
    stateCode: "",
    category: ReportCategory.ABSCONDED,
    detail: "",
  });

  const dbRef = useRef<any>(null);

  /* ============ FIREBASE ============ */

  useEffect(() => {
    dbRef.current = initFirebase(firebaseConfig);
    return subscribeToReports(dbRef.current, setEntries);
  }, []);

  /* ============ FILTER ============ */

  const filteredEntries = useMemo(() => {
    if (!searchQuery) return entries;
    return entries.filter(
      (e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.stateCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [entries, searchQuery]);

  /* ============ SUBMIT (ADD / UPDATE) ============ */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      name: formData.name,
      stateCode: formData.stateCode,
      category: formData.category,
      lga: editingEntry?.lga || "Mani",
      dateAdded: editingEntry?.dateAdded || new Date().toISOString(),
      detail: formData.detail,
    };

    if (editingEntry) {
      await updateReport(dbRef.current, editingEntry.id, payload);
    } else {
      await addReport(dbRef.current, payload);
    }

    setEditingEntry(null);
    setFormData({ name: "", stateCode: "", category: ReportCategory.ABSCONDED, detail: "" });
    setCurrentView("DASHBOARD");
  };

  /* ============ EDIT ============ */

  const startEdit = (entry: CorpsMemberEntry) => {
    setEditingEntry(entry);
    setFormData({
      name: entry.name,
      stateCode: entry.stateCode,
      category: entry.category,
      detail: (entry as any).detail || "",
    });
    setCurrentView("FORM");
  };

  /* ============ UI ============ */

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-4 flex justify-between">
        <h1 className="font-bold">NYSC ZONAL HQ PORTAL</h1>
        <LogOutIcon />
      </header>

      {currentView === "DASHBOARD" && (
        <main className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              className="border p-2 flex-1"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button onClick={() => setCurrentView("FORM")}>
              <PlusIcon /> Add
            </button>
          </div>

          <table className="w-full bg-white">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>LGA</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.category}</td>
                  <td>{e.lga}</td>
                  <td>{new Date(e.dateAdded).toLocaleDateString()}</td>
                  <td className="flex gap-2">
                    <button onClick={() => startEdit(e)}>Edit</button>
                    <button onClick={() => deleteReport(dbRef.current, e.id)}>
                      <TrashIcon />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      )}

      {currentView === "FORM" && (
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-w-xl">
          <h2 className="font-bold">
            {editingEntry ? "Update Record" : "New Record"}
          </h2>

          <input
            required
            placeholder="Full Name"
            className="border p-2 w-full"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />

          <input
            required
            placeholder="State Code"
            className="border p-2 w-full"
            value={formData.stateCode}
            onChange={(e) =>
              setFormData({ ...formData, stateCode: e.target.value })
            }
          />

          <select
            className="border p-2 w-full"
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
          >
            {Object.values(ReportCategory).map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <textarea
            className="border p-2 w-full"
            placeholder="Details"
            value={formData.detail}
            onChange={(e) =>
              setFormData({ ...formData, detail: e.target.value })
            }
          />

          <div className="flex gap-2">
            <button type="submit" className="bg-slate-900 text-white p-2">
              {editingEntry ? "Update" : "Save"}
            </button>
            <button type="button" onClick={() => setCurrentView("DASHBOARD")}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default App;

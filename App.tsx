import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  ReportCategory,
  CorpsMemberEntry,
  DauraLga,
  UserRole,
} from "./types";
import {
  DownloadIcon,
  ShareIcon,
  LogOutIcon,
  TrashIcon,
  SearchIcon,
} from "./components/Icons";
import { summarizeReport } from "./services/geminiService";
import {
  initFirebase,
  subscribeToReports,
  addReport,
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

type ViewMode = "DASHBOARD" | "SUMMARY";

/* ================= APP ================= */

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("daura_auth") === "true"
  );
  const [userRole, setUserRole] = useState<UserRole | null>(
    localStorage.getItem("daura_role") as UserRole
  );
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(
    localStorage.getItem("daura_lga") as DauraLga
  );

  const [entries, setEntries] = useState<CorpsMemberEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentView, setCurrentView] = useState<ViewMode>("DASHBOARD");
  const [summary, setSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const dbRef = useRef<any>(null);

  /* ========== LOGIN STATE ========== */
  const [roleInput, setRoleInput] = useState<UserRole | "">("");
  const [lgaInput, setLgaInput] = useState<DauraLga | "">("");
  const [pinInput, setPinInput] = useState("");

  /* ========== FIREBASE ========== */
  useEffect(() => {
    if (!isAuthenticated) return;

    dbRef.current = initFirebase(firebaseConfig);
    return subscribeToReports(dbRef.current, (data) => setEntries(data));
  }, [isAuthenticated]);

  /* ========== FILTER DATA ========== */
  const visibleEntries = useMemo(() => {
    const base =
      userRole === "ZI"
        ? entries
        : entries.filter((e) => e.lga === lgaContext);

    if (!searchQuery) return base;

    return base.filter(
      (e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.stateCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [entries, userRole, lgaContext, searchQuery]);

  /* ========== EXPORT / SHARE ========== */
  const exportCSV = () => {
    if (!visibleEntries.length) return;

    const headers = ["Name", "State Code", "Category", "LGA", "Date"];
    const rows = visibleEntries.map((e) => [
      e.name,
      e.stateCode,
      e.category,
      e.lga,
      new Date(e.dateAdded).toLocaleDateString(),
    ]);

    const csv =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map((r) => r.join(",")).join("\n");

    const a = document.createElement("a");
    a.href = encodeURI(csv);
    a.download = `NYSC_${userRole === "ZI" ? "ZONE" : lgaContext}_REPORT.csv`;
    a.click();
  };

  const shareWhatsApp = () => {
    const text = `NYSC ${userRole === "ZI" ? "DAURA ZONE" : lgaContext} REPORT\nTotal Records: ${visibleEntries.length}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  /* ========== LOGIN ========== */
  const handleLogin = () => {
    const key = roleInput === "ZI" ? "ZI" : lgaInput;
    if (!key || SECURITY_PINS[key] !== pinInput) {
      alert("Invalid PIN");
      return;
    }

    localStorage.setItem("daura_auth", "true");
    localStorage.setItem("daura_role", roleInput);
    if (roleInput === "LGI") localStorage.setItem("daura_lga", lgaInput);

    setIsAuthenticated(true);
    setUserRole(roleInput as UserRole);
    setLgaContext(roleInput === "LGI" ? (lgaInput as DauraLga) : null);
  };

  const handleLogout = () => {
    localStorage.clear();
    location.reload();
  };

  /* ========== AI SUMMARY ========== */
  const handleSummarize = async () => {
    setIsGenerating(true);
    const text = await summarizeReport(
      visibleEntries,
      userRole === "ZI" ? "Daura Zone" : `${lgaContext} LGA`
    );
    setSummary(text);
    setCurrentView("SUMMARY");
    setIsGenerating(false);
  };

  /* ================= LOGIN UI ================= */
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="bg-white p-6 rounded-xl w-full max-w-sm space-y-4">
          <h2 className="font-bold text-center">NYSC WEEKLY REPORT</h2>

          <select
            className="w-full border p-2"
            value={roleInput}
            onChange={(e) => setRoleInput(e.target.value as UserRole)}
          >
            <option value="">Select Role</option>
            <option value="ZI">Zonal Inspector</option>
            <option value="LGI">Local Govt Inspector</option>
          </select>

          {roleInput === "LGI" && (
            <select
              className="w-full border p-2"
              value={lgaInput}
              onChange={(e) => setLgaInput(e.target.value as DauraLga)}
            >
              <option value="">Select LGA</option>
              {DAURA_ZONE_LGAS.map((lga) => (
                <option key={lga} value={lga}>
                  {lga}
                </option>
              ))}
            </select>
          )}

          <input
            type="password"
            className="w-full border p-2 text-center"
            placeholder="Enter PIN"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
          />

          <button
            onClick={handleLogin}
            className="w-full bg-slate-900 text-white p-2 rounded"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  /* ================= DASHBOARD ================= */
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-4 flex justify-between">
        <h1 className="font-bold">
          {userRole === "ZI" ? "DAURA ZONAL HQ" : `${lgaContext} LGI TERMINAL`}
        </h1>
        <button onClick={handleLogout}>
          <LogOutIcon />
        </button>
      </header>

      {currentView === "DASHBOARD" && (
        <main className="p-4 space-y-4">
          <div className="flex gap-2">
            <input
              className="border p-2 flex-1"
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button onClick={exportCSV}><DownloadIcon /></button>
            <button onClick={shareWhatsApp}><ShareIcon /></button>
            <button onClick={() => window.print()}>Print</button>
            <button onClick={handleSummarize} disabled={isGenerating}>
              AI
            </button>
          </div>

          <table className="w-full bg-white border">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>LGA</th>
                <th>Date</th>
                {userRole === "ZI" && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.category}</td>
                  <td>{e.lga}</td>
                  <td>{new Date(e.dateAdded).toLocaleDateString()}</td>
                  {userRole === "ZI" && (
                    <td>
                      <button onClick={() => deleteReport(dbRef.current, e.id)}>
                        <TrashIcon />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      )}

      {currentView === "SUMMARY" && summary && (
        <div className="p-6 bg-white">
          <pre>{summary}</pre>
          <button onClick={() => setCurrentView("DASHBOARD")}>Back</button>
        </div>
      )}
    </div>
  );
};

export default App;

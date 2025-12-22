import React, { useState, useEffect, useMemo, useRef } from "react";
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
  AbscondedIcon,
  SickIcon,
  KidnappedIcon,
  MissingIcon,
  DeceasedIcon,
  DashboardIcon,
} from "./components/Icons";
import { summarizeReport } from "./services/geminiService";
import {
  initFirebase,
  subscribeToReports,
  addReport,
  deleteReport,
} from "./services/firebaseService";

/* ================== CONFIG ================== */

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

/* ================== APP ================== */

type ViewMode = "DASHBOARD" | "FORM" | "SUCCESS" | "SUMMARY" | "STAT_REPORT";

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
  const dbRef = useRef<any>(null);

  const [currentView, setCurrentView] = useState<ViewMode>("DASHBOARD");
  const [searchQuery, setSearchQuery] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  /* ============ FIREBASE INIT ============ */

  useEffect(() => {
    if (!isAuthenticated) return;

    dbRef.current = initFirebase(firebaseConfig);
    return subscribeToReports(dbRef.current, (data) => setEntries(data));
  }, [isAuthenticated]);

  /* ============ FILTERED DATA ============ */

  const visibleEntries = useMemo(() => {
    let data =
      userRole === "ZI"
        ? entries
        : entries.filter((e) => e.lga === lgaContext);

    if (!searchQuery) return data;

    return data.filter(
      (e) =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.stateCode.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [entries, userRole, lgaContext, searchQuery]);

  /* ============ EXPORT / SHARE ============ */

  const exportCSV = () => {
    if (visibleEntries.length === 0) return;

    const headers = [
      "Name",
      "State Code",
      "Category",
      "LGA",
      "Date",
      "Details",
    ];

    const rows = visibleEntries.map((e) => [
      e.name,
      e.stateCode,
      e.category,
      e.lga,
      new Date(e.dateAdded).toLocaleDateString(),
      (e as any).period ||
        (e as any).illness ||
        (e as any).dateKidnapped ||
        (e as any).dateMissing ||
        (e as any).dateOfDeath ||
        "",
    ]);

    const csv =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      rows.map((r) => r.join(",")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download = `NYSC_${userRole === "ZI" ? "ZONE" : lgaContext}_REPORT.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareWhatsApp = () => {
    const text = `NYSC ${userRole === "ZI" ? "DAURA ZONE" : lgaContext} REPORT\n\nTotal Records: ${visibleEntries.length}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  /* ============ LOGIN ============ */

  const handleLogin = (
    role: UserRole,
    lga: DauraLga | null,
    pin: string
  ) => {
    const key = role === "ZI" ? "ZI" : lga;
    if (!key || SECURITY_PINS[key] !== pin) return alert("Invalid PIN");

    localStorage.setItem("daura_auth", "true");
    localStorage.setItem("daura_role", role);
    if (lga) localStorage.setItem("daura_lga", lga);

    setIsAuthenticated(true);
    setUserRole(role);
    setLgaContext(lga);
  };

  const handleLogout = () => {
    localStorage.clear();
    location.reload();
  };

  /* ============ AI SUMMARY ============ */

  const handleSummarize = async () => {
    setIsGenerating(true);
    const result = await summarizeReport(
      visibleEntries,
      userRole === "ZI" ? "Daura Zone" : `${lgaContext} LGA`
    );
    setSummary(result);
    setCurrentView("SUMMARY");
    setIsGenerating(false);
  };

  /* ================== UI ================== */

  if (!isAuthenticated) {
    return <div className="p-10 text-center">LOGIN SCREEN (UNCHANGED)</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="bg-slate-900 text-white p-4 flex justify-between">
        <h1 className="font-bold">
          {userRole === "ZI" ? "DAURA ZONAL HQ" : `${lgaContext} LGI TERMINAL`}
        </h1>
        <button onClick={handleLogout}>
          <LogOutIcon />
        </button>
      </header>

      {/* DASHBOARD */}
      {currentView === "DASHBOARD" && (
        <main className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              className="border p-2 flex-1"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button onClick={exportCSV} className="btn">
              <DownloadIcon /> CSV
            </button>
            <button onClick={() => window.print()} className="btn">
              Print
            </button>
            <button onClick={shareWhatsApp} className="btn">
              <ShareIcon /> WhatsApp
            </button>
          </div>

          <table className="w-full bg-white">
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

      {/* SUMMARY */}
      {currentView === "SUMMARY" && summary && (
        <div className="p-10 bg-white">
          <pre>{summary}</pre>
          <button onClick={() => setCurrentView("DASHBOARD")}>Back</button>
        </div>
      )}
    </div>
  );
};

export default App;

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

type ViewMode = "DASHBOARD" | "FORM" | "SUMMARY";

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
    return subscribeToReports(dbRef.current, setEntries);
  }, [isAuthenticated]);

  /* ============ FILTER DATA (ZI vs LGI) ============ */

  const visibleEntries = useMemo(() => {
    const data =
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

  /* ============ SUBMIT (THIS IS WHERE LGI UPDATES ARE SAVED) ============ */

  const submitUpdate = async (
    category: ReportCategory,
    payload: Record<string, any>
  ) => {
    if (!lgaContext) return;

    await addReport(dbRef.current, {
      name: payload.name,
      stateCode: payload.stateCode,
      lga: lgaContext,
      category,
      dateAdded: new Date().toISOString(),

      // CATEGORY-SPECIFIC DATA
      ...payload,
    });
  };

  /* ============ EXPORT ============ */

  const exportCSV = () => {
    if (!visibleEntries.length) return;

    const rows = visibleEntries.map((e) => ({
      Name: e.name,
      Code: e.stateCode,
      Category: e.category,
      LGA: e.lga,
      Date: new Date(e.dateAdded).toLocaleDateString(),
    }));

    const csv =
      "data:text/csv;charset=utf-8," +
      Object.keys(rows[0]).join(",") +
      "\n" +
      rows.map((r) => Object.values(r).join(",")).join("\n");

    const a = document.createElement("a");
    a.href = encodeURI(csv);
    a.download = "NYSC_Report.csv";
    a.click();
  };

  /* ============ SUMMARY ============ */

  const generateSummary = async () => {
    setIsGenerating(true);
    const text = await summarizeReport(
      visibleEntries,
      userRole === "ZI" ? "Daura Zone" : `${lgaContext} LGA`
    );
    setSummary(text);
    setCurrentView("SUMMARY");
    setIsGenerating(false);
  };

  /* ============ LOGIN ============ */

  if (!isAuthenticated) {
    return <div className="p-10 text-center">LOGIN SCREEN (UNCHANGED)</div>;
  }

  /* ============ UI ============ */

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-4 flex justify-between">
        <h1>{userRole === "ZI" ? "DAURA ZONAL HQ" : `${lgaContext} LGI TERMINAL`}</h1>
        <button
          onClick={() => {
            localStorage.clear();
            location.reload();
          }}
        >
          <LogOutIcon />
        </button>
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
            <button onClick={exportCSV}>
              <DownloadIcon /> CSV
            </button>
            {userRole === "ZI" && (
              <button onClick={generateSummary}>
                <FileTextIcon /> AI
              </button>
            )}
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
                      <button
                        onClick={() => deleteReport(dbRef.current, e.id)}
                      >
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
        <pre className="p-10 bg-white">{summary}</pre>
      )}
    </div>
  );
};

export default App;

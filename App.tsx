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

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: "AIzaSyA4Jk01ZevFJ0KjpCPysA9oWMeN56_QLcQ",
  authDomain: "weeklyreport-a150a.firebaseapp.com",
  projectId: "weeklyreport-a150a",
  storageBucket: "weeklyreport-a150a.firebasestorage.app",
  messagingSenderId: "225162027576",
  appId: "1:225162027576:web:410acb6dc77acc0ecebccd",
};

/* ================= CONSTANTS ================= */

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

const CATEGORY_ICONS: Record<string, JSX.Element> = {
  [ReportCategory.ABSCONDED]: <AbscondedIcon />,
  [ReportCategory.SICK]: <SickIcon />,
  [ReportCategory.KIDNAPPED]: <KidnappedIcon />,
  [ReportCategory.MISSING]: <MissingIcon />,
  [ReportCategory.DECEASED]: <DeceasedIcon />,
};

type ViewMode = "DASHBOARD" | "FORM" | "SUMMARY";

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
  const [view, setView] = useState<ViewMode>("DASHBOARD");
  const [search, setSearch] = useState("");
  const [summary, setSummary] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);

  const dbRef = useRef<any>(null);

  /* ================= FIRESTORE ================= */

  useEffect(() => {
    if (!auth) return;

    dbRef.current = initFirebase(firebaseConfig);
    return subscribeToReports(dbRef.current, setEntries);
  }, [auth]);

  /* ================= FILTER ================= */

  const visibleEntries = useMemo(() => {
    const base =
      role === "ZI" ? entries : entries.filter((e) => e.lga === lga);

    return base.filter(
      (e) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.stateCode.toLowerCase().includes(search.toLowerCase())
    );
  }, [entries, role, lga, search]);

  /* ================= LOGIN ================= */

  const login = (r: UserRole, l: DauraLga | null, pin: string) => {
    const key = r === "ZI" ? "ZI" : l;
    if (!key || SECURITY_PINS[key] !== pin) {
      alert("Invalid PIN");
      return;
    }

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

  /* ================= EXPORT ================= */

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
    a.download = `NYSC_${role === "ZI" ? "ZONE" : lga}_REPORT.csv`;
    a.click();
  };

  /* ================= AI ================= */

  const generateSummary = async () => {
    setLoadingAI(true);
    const text = await summarizeReport(
      visibleEntries,
      role === "ZI" ? "Daura Zone" : `${lga} LGA`
    );
    setSummary(text);
    setView("SUMMARY");
    setLoadingAI(false);
  };

  /* ================= LOGIN SCREEN ================= */

  if (!auth) {
    const [r, setR] = useState<UserRole>("LGI");
    const [l, setL] = useState<DauraLga>("Daura");
    const [p, setP] = useState("");

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow w-96 space-y-4">
          <h2 className="text-xl font-bold text-center">NYSC LOGIN</h2>

          <select
            className="w-full border p-2"
            onChange={(e) => setR(e.target.value as UserRole)}
          >
            <option value="LGI">LGI</option>
            <option value="ZI">ZI</option>
          </select>

          {r === "LGI" && (
            <select
              className="w-full border p-2"
              onChange={(e) => setL(e.target.value as DauraLga)}
            >
              {DAURA_ZONE_LGAS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          )}

          <input
            type="password"
            placeholder="PIN"
            className="w-full border p-2 text-center"
            value={p}
            onChange={(e) => setP(e.target.value)}
          />

          <button
            className="w-full bg-emerald-600 text-white p-2"
            onClick={() => login(r, r === "ZI" ? null : l, p)}
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  /* ================= MAIN ================= */

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white p-4 flex justify-between">
        <h1>{role === "ZI" ? "DAURA ZONAL HQ" : `${lga} LGI`}</h1>
        <button onClick={logout}>
          <LogOutIcon />
        </button>
      </header>

      {view === "DASHBOARD" && (
        <main className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              className="border p-2 flex-1"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button onClick={exportCSV}>
              <DownloadIcon />
            </button>
            {role === "ZI" && (
              <button onClick={generateSummary} disabled={loadingAI}>
                <FileTextIcon />
              </button>
            )}
          </div>

          <table className="w-full bg-white border">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>LGA</th>
                <th>Date</th>
                {role === "ZI" && <th />}
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e) => (
                <tr key={e.id}>
                  <td>{e.name}</td>
                  <td>{e.category}</td>
                  <td>{e.lga}</td>
                  <td>{new Date(e.dateAdded).toLocaleDateString()}</td>
                  {role === "ZI" && (
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

      {view === "SUMMARY" && (
        <div className="p-10 bg-white">
          <pre className="whitespace-pre-wrap">{summary}</pre>
          <button onClick={() => setView("DASHBOARD")}>Back</button>
        </div>
      )}
    </div>
  );
};

export default App;

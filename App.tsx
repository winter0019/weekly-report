import React, { useEffect, useMemo, useRef, useState } from "react";
import { ReportCategory, CorpsMemberEntry, DauraLga, UserRole } from "./types";
import { initFirebase, subscribeToReports, addReport, updateReport } from "./services/firebaseService";

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

/* ================= APP ================= */

const App: React.FC = () => {
  const [auth,setAuth] = useState(localStorage.getItem("auth")==="true");
  const [role,setRole] = useState<UserRole|null>(localStorage.getItem("role") as UserRole);
  const [lga,setLga] = useState<DauraLga|null>(localStorage.getItem("lga") as DauraLga);

  const [reports,setReports] = useState<CorpsMemberEntry[]>([]);
  const db = useRef<any>(null);

  /* Firebase */
  useEffect(()=>{
    if(!auth) return;
    db.current = initFirebase(firebaseConfig);
    return subscribeToReports(db.current,setReports);
  },[auth]);

  /* ================= ZI VIEW ================= */

  const groupedByCategory = useMemo(()=>{
    const groups: Record<string,CorpsMemberEntry[]> = {};
    Object.values(ReportCategory).forEach(c=>groups[c]=[]);
    reports.forEach(r=>groups[r.category].push(r));
    return groups;
  },[reports]);

  /* ================= LGI VIEW ================= */

  const myReports = useMemo(()=>{
    return reports.filter(r=>r.lga===lga);
  },[reports,lga]);

  /* ================= LOGIN ================= */

  if(!auth){
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-emerald-800">
        <div className="bg-white p-8 rounded-2xl w-full max-w-md shadow-xl">
          <h1 className="text-xl font-black text-center mb-2">
            NYSC DAURA ZONAL HQ
          </h1>
          <p className="text-xs text-center mb-6 text-slate-500">
            Official Weekly Compliance Reporting System
          </p>

          {/* SIMPLE LOGIN */}
          <button
            className="w-full bg-slate-900 text-white p-3 rounded-xl"
            onClick={()=>{
              localStorage.setItem("auth","true");
              localStorage.setItem("role","ZI");
              setRole("ZI"); setAuth(true);
            }}
          >
            Login as ZI (Demo)
          </button>
        </div>
      </div>
    );
  }

  /* ================= DASHBOARDS ================= */

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="flex justify-between mb-6">
        <h2 className="font-black text-lg">
          {role==="ZI" ? "ZI DASHBOARD" : `${lga} LGI DASHBOARD`}
        </h2>
        <button
          className="text-red-600"
          onClick={()=>{localStorage.clear();location.reload();}}
        >
          Logout
        </button>
      </header>

      {/* ZI DASHBOARD */}
      {role==="ZI" && (
        <div className="grid md:grid-cols-3 gap-4">
          {Object.entries(groupedByCategory).map(([cat,list])=>(
            <div key={cat} className="bg-white rounded-xl p-4 shadow">
              <h3 className="font-bold mb-2">{cat}</h3>
              <p className="text-sm text-slate-500">
                {list.length} reports
              </p>
            </div>
          ))}
        </div>
      )}

      {/* LGI DASHBOARD */}
      {role==="LGI" && (
        <div className="space-y-4">
          {myReports.map(r=>(
            <div key={r.id} className="bg-white p-4 rounded-xl shadow">
              <div className="font-bold">{r.name}</div>
              <div className="text-xs text-slate-500">{r.category}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;

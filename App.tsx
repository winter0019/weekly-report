
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ReportCategory, 
  CorpsMemberEntry, 
  DauraLga,
  UserRole,
  Division,
  CIMClearance,
  SAEDCenter,
  CDRCase,
  CDRStatus,
  CDSGroup,
  CDSPersonalProject,
  CIMBatchDisposition,
  StationDisposition
} from './types';
import { 
  WhatsAppIcon, 
  LogOutIcon, 
  TrashIcon, 
  FileTextIcon, 
  SearchIcon, 
  DashboardIcon, 
  DownloadIcon,
  ShareIcon,
  SpreadsheetIcon,
  PlusIcon
} from './components/Icons';
import { initFirebase, subscribeToCollection, addData, updateData, deleteData } from './services/firebaseService';
import { generateDisciplinaryQuery } from './services/geminiService';
import { generateOfficialPDF } from './services/pdfService';
import { downloadCSV, shareData } from './services/exportService';

const firebaseConfig = {
  apiKey: "AIzaSyA4Jk01ZevFJ0KjpCPysA9oWMeN56_QLcQ",
  authDomain: "weeklyreport-a150a.firebaseapp.com",
  projectId: "weeklyreport-a150a",
  storageBucket: "weeklyreport-a150a.firebasestorage.app",
  messagingSenderId: "225162027576",
  appId: "1:225162027576:web:410acb6dc77acc0ecebccd"
};

const LGAS: DauraLga[] = ['Daura', 'Baure', 'Zango', 'Sandamu', 'Mai’Adua', 'Mashi', 'Dutsi', 'Mani', 'Bindawa'];
const SECURITY_PINS: Record<string, string> = {
  'ZI': '0000', 'Daura': '1111', 'Baure': '2222', 'Zango': '3333', 'Sandamu': '4444', 
  'Mai’Adua': '5555', 'Mashi': '6666', 'Dutsi': '7777', 'Mani': '8888', 'Bindawa': '9999'
};

const DIVISION_LABELS: Record<Division, string> = {
  'CWHS': 'CW&HS', 'CIM': 'CIM', 'CDR': 'CD&R', 'CDS': 'CD', 'SAED': 'SAED'
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => window.localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => window.localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => window.localStorage.getItem('daura_lga') as DauraLga);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [division, setDivision] = useState<Division>('CIM');
  const [cwhsEntries, setCwhsEntries] = useState<CorpsMemberEntry[]>([]);
  const [cimEntries, setCimEntries] = useState<CIMClearance[]>([]);
  const [saedEntries, setSAEDEntries] = useState<SAEDCenter[]>([]);
  const [cdrEntries, setCdrEntries] = useState<CDRCase[]>([]);
  const [cdsGroups, setCdsGroups] = useState<CDSGroup[]>([]);
  const [cdsProjects, setCdsProjects] = useState<CDSPersonalProject[]>([]);
  const [stationDispositions, setStationDispositions] = useState<StationDisposition[]>([]);
  
  const dbRef = useRef<any>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingLogin, setPendingLogin] = useState<any>(null);

  useEffect(() => {
    if (isAuthenticated) {
      let active = true;
      const unsubs: (() => void)[] = [];
      const startServices = async () => {
        try {
          const db = initFirebase(firebaseConfig);
          dbRef.current = db;
          if (db) {
            unsubs.push(subscribeToCollection(db, "nysc_reports", (data) => active && setCwhsEntries(data)));
            unsubs.push(subscribeToCollection(db, "cim_clearance", (data) => active && setCimEntries(data)));
            unsubs.push(subscribeToCollection(db, "saed_centers", (data) => active && setSAEDEntries(data)));
            unsubs.push(subscribeToCollection(db, "cdr_cases", (data) => active && setCdrEntries(data)));
            unsubs.push(subscribeToCollection(db, "cds_groups", (data) => active && setCdsGroups(data)));
            unsubs.push(subscribeToCollection(db, "cds_projects", (data) => active && setCdsProjects(data)));
            unsubs.push(subscribeToCollection(db, "station_disposition", (data) => active && setStationDispositions(data)));
            setTimeout(() => { if (active) setIsDbLoaded(true); }, 500);
          }
        } catch (err) { console.error(err); if (active) setIsDbLoaded(true); }
      };
      startServices();
      return () => { active = false; unsubs.forEach(u => u()); };
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    window.localStorage.clear();
    window.location.reload();
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filterFn = (items: any[]) => {
      let filtered = items;
      if (userRole === 'LGI') filtered = filtered.filter(i => i.lga === lgaContext);
      return filtered.filter(item => {
        if (!q) return true;
        return [item.name, item.cmName, item.groupName, item.stateCode, item.lga, (item as any).ppa]
          .some(s => String(s || '').toLowerCase().includes(q));
      });
    };
    return {
      cwhs: filterFn(cwhsEntries),
      cim: filterFn(cimEntries),
      saed: filterFn(saedEntries),
      cdr: filterFn(cdrEntries),
      cdsGroups: filterFn(cdsGroups),
      cdsProjects: filterFn(cdsProjects)
    };
  }, [cwhsEntries, cimEntries, saedEntries, cdrEntries, cdsGroups, cdsProjects, userRole, lgaContext, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-950 via-slate-900 to-black">
        <form onSubmit={(e) => {
          e.preventDefault();
          const target = pendingLogin?.role === 'ZI' ? 'ZI' : pendingLogin?.lga;
          if (target && pin === SECURITY_PINS[target]) {
            setIsAuthenticated(true);
            setUserRole(pendingLogin.role);
            setLgaContext(pendingLogin.lga);
            window.localStorage.setItem('daura_auth', 'true');
            window.localStorage.setItem('daura_role', pendingLogin.role);
            if (pendingLogin.lga) window.localStorage.setItem('daura_lga', pendingLogin.lga);
          } else { window.alert("PIN Rejected."); }
        }} className="bg-white p-5 rounded-lg shadow-xl w-full max-w-xs space-y-4 animate-official">
          <div className="text-center">
            <div className="w-10 h-10 bg-[#004d40] rounded-md mx-auto mb-2 flex items-center justify-center text-white font-serif-heading text-lg font-black">NYSC</div>
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Access Terminal</h1>
          </div>
          <div className="space-y-2">
            <select required className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 outline-none" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Station...</option>
                <option value="ZI">Zonal Inspectorate</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Command</option>)}
            </select>
            <input type="password" required placeholder="Security PIN" className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center text-lg font-black tracking-[0.4em] outline-none" value={pin} onChange={e => setPin(e.target.value)} />
          </div>
          <button className="w-full bg-[#004d40] text-white p-2.5 rounded font-bold uppercase tracking-wider text-[10px]">Verify</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-6">
      <nav className="fixed top-0 left-0 right-0 z-[100] glass-nav flex justify-center no-print px-4 items-center">
        <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
          {(Object.keys(DIVISION_LABELS) as Division[]).map(id => (
            <button key={id} onClick={() => setDivision(id)} className={`px-4 py-1 rounded transition-all font-bold uppercase text-[9px] tracking-wider ${division === id ? 'bg-[#004d40] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{DIVISION_LABELS[id]}</button>
          ))}
        </div>
      </nav>

      <div className="pt-14 px-4 sm:px-6 max-w-[1100px] mx-auto w-full">
        <header className="bg-[#004d40] text-white p-4 shadow rounded-lg flex items-center justify-between no-print gap-4 mb-5 animate-official">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center border border-white/10"><DashboardIcon /></div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-tight font-serif-heading">NYSC DAURA COMMAND</h1>
              <p className="text-[7px] font-bold text-emerald-300 tracking-wider uppercase opacity-50">Secretariat Portal Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSc_Y9YyX-ExampleForm" target="_blank" rel="noopener noreferrer" className="bg-emerald-500/20 hover:bg-emerald-500/40 px-3 py-1 rounded text-[8px] font-bold uppercase tracking-wider border border-white/10 transition-colors flex items-center gap-1">
              <PlusIcon /> Google Form
            </a>
            <div className="bg-black/20 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider border border-white/5">{userRole === 'LGI' ? `${lgaContext} Unit` : 'Zonal HQ Dashboard'}</div>
            <button onClick={handleLogout} className="w-7 h-7 bg-red-600/10 hover:bg-red-600 rounded transition-all flex items-center justify-center"><LogOutIcon /></button>
          </div>
        </header>

        <div className="mb-5 flex justify-center no-print">
          <div className="bg-white p-0.5 rounded shadow-sm w-full max-w-sm border border-slate-200 flex items-center group">
            <div className="ml-3 mr-2 text-slate-300 scale-75"><SearchIcon /></div>
            <input type="text" placeholder="Quick find..." className="bg-transparent p-1.5 text-[11px] w-full outline-none font-medium text-slate-600" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <main className="flex flex-col lg:flex-row gap-5">
          {!isDbLoaded ? (
            <div className="w-full flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-[#004d40] rounded-full animate-spin"></div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Syncing Terminal...</p>
            </div>
          ) : (
            <>
              {division === 'CWHS' && <CWHSModule entries={filteredData.cwhs} lga={lgaContext!} db={dbRef.current} />}
              {division === 'CIM' && <CIMModule entries={filteredData.cim} lga={lgaContext!} db={dbRef.current} userRole={userRole} stationDispositions={stationDispositions} />}
              {division === 'CDR' && <CDRModule entries={filteredData.cdr} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
              {division === 'CDS' && <CDSModule groups={filteredData.cdsGroups} projects={filteredData.cdsProjects} lga={lgaContext!} db={dbRef.current} />}
              {division === 'SAED' && <SAEDModule entries={filteredData.saed} lga={lgaContext!} db={dbRef.current} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

/* --- CIM Module --- */
const CIMModule = ({ entries, db, lga, userRole, stationDispositions }: any) => {
  const [formData, setFormData] = useState({ month: '' });
  const [clearedBatches, setClearedBatches] = useState<CIMBatchDisposition[]>([]);
  const [newClearedBatch, setNewClearedBatch] = useState({ batch: '', males: 0, females: 0 });
  const [tempUnclearedList, setTempUnclearedList] = useState<{name: string, code: string, reason: string, ppa?: string}[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDispBreakdownOpen, setIsDispBreakdownOpen] = useState(false);
  const [isLgaDetailOpen, setIsLgaDetailOpen] = useState(false);

  const currentStationDisp = stationDispositions.find((d: any) => d.lga === (userRole === 'LGI' ? lga : null) || d.lga === lga);
  const [tempBatches, setTempBatches] = useState<CIMBatchDisposition[]>([]);
  const [newBatch, setNewBatch] = useState({ batch: '', males: 0, females: 0 });

  useEffect(() => {
    if (currentStationDisp?.batches) setTempBatches(currentStationDisp.batches);
    else setTempBatches([]);
  }, [currentStationDisp]);

  const handleSaveStationDisposition = async () => {
    const data = { lga, batches: tempBatches, totalMales: tempBatches.reduce((a,b)=>a+b.males,0), totalFemales: tempBatches.reduce((a,b)=>a+b.females,0), lastUpdated: new Date().toISOString() };
    try {
      if (currentStationDisp) await updateData(db, "station_disposition", currentStationDisp.id, data);
      else await addData(db, "station_disposition", data);
      window.alert("Saved.");
    } catch { window.alert("Fail."); }
  };

  const handleIssueQuery = async (cm: any) => {
    setIsGenerating(true);
    try {
      const ppaVal = cm.ppa || `LGA HQ: ${cm.lga || lga}`;
      const content = await generateDisciplinaryQuery(cm.name, cm.code, cm.lga || lga, `Biometric Default (${cm.month})`, ppaVal);
      const payload = { 
        name: cm.name, stateCode: cm.code, lga: cm.lga || lga, ppa: ppaVal, 
        misconduct: `BIOMETRIC DEFAULT - ${cm.month}`, status: 'Pending' as CDRStatus,
        responseContent: content, month: cm.month, dateOfInfraction: new Date().toISOString()
      };
      await addData(db, "cdr_cases", payload);
      generateOfficialPDF(payload, 'DISCIPLINARY_QUERY');
      window.alert("Query Issued.");
    } catch { window.alert("Error."); } finally { setIsGenerating(false); }
  };

  const handleAuditMinute = async (auditId: string, minuteText: string) => {
    await updateData(db, "cim_clearance", auditId, { ziMinute: minuteText });
  };

  const handleDefaulterMinute = async (auditId: string, cmCode: string, minuteText: string) => {
    const audit = entries.find((e: any) => e.id === auditId);
    if (!audit) return;
    const newList = audit.unclearedList.map((cm: any) => cm.code === cmCode ? { ...cm, ziMinute: minuteText } : cm);
    await updateData(db, "cim_clearance", auditId, { unclearedList: newList });
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const totalM = clearedBatches.reduce((a,b)=>a+b.males,0);
    const totalF = clearedBatches.reduce((a,b)=>a+b.females,0);
    const data = { month: formData.month, lga, maleCount: totalM, femaleCount: totalF, clearedCount: totalM+totalF, totalCMs: totalM+totalF+tempUnclearedList.length, unclearedList: tempUnclearedList.map(u => ({...u, month: formData.month})), batchClearance: clearedBatches, dateAdded: new Date().toISOString() };
    await addData(db, "cim_clearance", data);
    setFormData({month:''}); setClearedBatches([]); setTempUnclearedList([]);
  };

  const aggregates = useMemo(() => {
    const totalCleared = entries.reduce((acc: number, e: any) => acc + (e.clearedCount || 0), 0);
    const totalDefaulters = entries.reduce((acc: number, e: any) => acc + (e.unclearedList?.length || 0), 0);
    const uniqueLgas = new Set(entries.map((e: any) => e.lga)).size;

    const totalDispMales = stationDispositions.reduce((acc: number, d: any) => acc + (d.totalMales || 0), 0);
    const totalDispFemales = stationDispositions.reduce((acc: number, d: any) => acc + (d.totalFemales || 0), 0);

    const zonalBatches: Record<string, {males: number, females: number}> = {};
    stationDispositions.forEach((disp: any) => {
      disp.batches?.forEach((b: any) => {
        if (!zonalBatches[b.batch]) zonalBatches[b.batch] = {males: 0, females: 0};
        zonalBatches[b.batch].males += b.males || 0;
        zonalBatches[b.batch].females += b.females || 0;
      });
    });

    return { totalCleared, totalDefaulters, uniqueLgas, totalDispMales, totalDispFemales, zonalBatches };
  }, [entries, stationDispositions]);

  if (userRole === 'ZI') {
    return (
      <div className="w-full flex flex-col gap-5 animate-official">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 shadow-xl flex flex-col items-center relative overflow-hidden text-white">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Zonal Population Aggregate</span>
            <span className="text-3xl font-black font-serif-heading">{(aggregates.totalDispMales + aggregates.totalDispFemales).toLocaleString()}</span>
            <div className="flex gap-4 mt-1 border-t border-white/10 pt-1 w-full justify-center">
               <span className="text-[10px] font-bold text-blue-400">Males: {aggregates.totalDispMales.toLocaleString()}</span>
               <span className="text-[10px] font-bold text-pink-400">Females: {aggregates.totalDispFemales.toLocaleString()}</span>
            </div>
            <div className="absolute bottom-1 right-1 flex gap-1">
               <button onClick={() => downloadCSV(Object.entries(aggregates.zonalBatches).map(([b, c]) => ({ Batch: b, ...(c as any) })), "Zonal_Batch_Distribution")} className="p-1 hover:bg-white/10 rounded"><SpreadsheetIcon /></button>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Cleared (Monthly)</span>
            <span className="text-3xl font-black text-emerald-600 font-serif-heading">{aggregates.totalCleared.toLocaleString()}</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Biometric Defaulters</span>
            <span className="text-3xl font-black text-red-600 font-serif-heading">{aggregates.totalDefaulters.toLocaleString()}</span>
          </div>
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active Stations</span>
            <span className="text-3xl font-black text-[#004d40] font-serif-heading">{aggregates.uniqueLgas} / {LGAS.length}</span>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-3 bg-slate-800 text-white flex justify-between items-center cursor-pointer hover:bg-black transition-all" onClick={() => setIsDispBreakdownOpen(!isDispBreakdownOpen)}>
              <div className="flex items-center gap-3">
                 <DashboardIcon />
                 <h3 className="text-[11px] font-black uppercase tracking-widest">Global Zonal Batch Distribution</h3>
              </div>
              <span className="text-xs font-bold">{isDispBreakdownOpen ? '− Hide' : '+ Show Detail'}</span>
           </div>
           {isDispBreakdownOpen && (
             <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 bg-slate-50 animate-official border-b">
                {Object.entries(aggregates.zonalBatches).map(([batch, counts]: [string, any]) => (
                  <div key={batch} className="p-3 bg-white rounded border border-slate-200 shadow-sm flex flex-col items-center">
                     <p className="text-[10px] font-black text-slate-800 uppercase mb-2 text-center border-b border-slate-100 pb-1 w-full">{batch}</p>
                     <div className="flex justify-between w-full text-[12px] font-black">
                        <span className="text-blue-600">M: {counts.males}</span>
                        <span className="text-pink-600">F: {counts.females}</span>
                     </div>
                     <p className="text-[8px] font-bold text-slate-400 uppercase mt-2">Zone Total: {counts.males + counts.females}</p>
                  </div>
                ))}
             </div>
           )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-3 bg-emerald-700 text-white flex justify-between items-center cursor-pointer hover:bg-emerald-800 transition-all" onClick={() => setIsLgaDetailOpen(!isLgaDetailOpen)}>
              <div className="flex items-center gap-3">
                 <FileTextIcon />
                 <h3 className="text-[11px] font-black uppercase tracking-widest">Per-Command Batch breakdown</h3>
              </div>
              <span className="text-xs font-bold">{isLgaDetailOpen ? '− Hide' : '+ View LGA Batches'}</span>
           </div>
           {isLgaDetailOpen && (
             <div className="p-4 bg-white space-y-4 animate-official">
                {LGAS.map(lgaName => {
                  const disp = stationDispositions.find((d: any) => d.lga === lgaName);
                  return (
                    <div key={lgaName} className="border border-slate-100 rounded-lg overflow-hidden shadow-sm">
                       <div className="bg-slate-50 px-3 py-2 border-b flex justify-between items-center">
                          <h4 className="text-[11px] font-black text-slate-700 uppercase">{lgaName} Command</h4>
                          <div className="flex gap-3 text-[10px] font-black">
                             <span className="text-blue-600">Males: {disp?.totalMales || 0}</span>
                             <span className="text-pink-600">Females: {disp?.totalFemales || 0}</span>
                          </div>
                       </div>
                       <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-2">
                          {disp?.batches?.map((b: any, i: number) => (
                            <div key={i} className="p-2 bg-white rounded border border-slate-100 text-center">
                               <p className="text-[8px] font-black text-slate-400 uppercase">{b.batch}</p>
                               <p className="text-[10px] font-black flex justify-between px-1">
                                  <span className="text-blue-500">M:{b.males}</span>
                                  <span className="text-pink-500">F:{b.females}</span>
                               </p>
                            </div>
                          )) || <p className="col-span-full text-center text-[9px] text-slate-300 py-2">No records.</p>}
                       </div>
                    </div>
                  );
                })}
             </div>
           )}
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#004d40] p-3 text-white flex justify-between items-center">
             <h3 className="text-[11px] font-bold uppercase tracking-widest">Zonal Audit Ledger</h3>
             <div className="flex gap-2">
                <button onClick={() => downloadCSV(entries, "Global_Audit")} className="p-1 hover:bg-white/10 rounded"><SpreadsheetIcon /></button>
                <button onClick={() => setIsLedgerOpen(true)} className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-[9px] font-bold uppercase border border-white/20">Defaulter Registry</button>
             </div>
          </div>
          <div className="overflow-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[9px] font-bold uppercase text-slate-400 text-left">
                  <th className="p-3">Command</th>
                  <th className="p-3">M/F Totals</th>
                  <th className="p-3">Audit Month</th>
                  <th className="p-3 text-center">Cleared</th>
                  <th className="p-3 text-center">Defaulters</th>
                  <th className="p-3">Directive</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {LGAS.map(lgaName => {
                  const lgaEntries = entries.filter((e: any) => e.lga === lgaName);
                  const lgaDisp = stationDispositions.find((d: any) => d.lga === lgaName);
                  const latest = lgaEntries[0];
                  return (
                    <tr key={lgaName} className={`hover:bg-slate-50 transition-all ${lgaEntries.length === 0 ? 'opacity-40' : ''}`}>
                      <td className="p-3 font-bold text-slate-800">{lgaName}</td>
                      <td className="p-3">
                         {lgaDisp ? (
                           <div className="flex gap-2 text-[10px] font-black">
                             <span className="text-blue-600">M: {lgaDisp.totalMales}</span>
                             <span className="text-pink-600">F: {lgaDisp.totalFemales}</span>
                           </div>
                         ) : <span className="text-[9px] text-slate-300">--</span>}
                      </td>
                      <td className="p-3 font-medium text-slate-600">{latest?.month || 'N/A'}</td>
                      <td className="p-3 text-center font-black text-emerald-600">{latest?.clearedCount || 0}</td>
                      <td className="p-3 text-center font-black text-red-600">{latest?.unclearedList?.length || 0}</td>
                      <td className="p-3">
                        <textarea className="w-full bg-slate-50 border p-1 rounded text-[8px] h-10 outline-none" placeholder="Directive..." defaultValue={latest?.ziMinute} onBlur={(e) => latest && handleAuditMinute(latest.id, e.target.value)} />
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          {latest && (
                            <>
                              <button onClick={() => generateOfficialPDF(latest, 'CIM_AUDIT')} className="p-1.5 text-slate-400 hover:text-[#004d40]"><DownloadIcon /></button>
                              <button onClick={() => shareData(`Audit: ${lgaName}`, `Month: ${latest.month}`)} className="p-1.5 text-slate-400 hover:text-[#004d40]"><ShareIcon /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {isLedgerOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-lg shadow-2xl flex flex-col h-[85vh]">
              <div className="bg-[#004d40] p-4 text-white flex justify-between items-center shrink-0">
                 <h3 className="text-[14px] font-black uppercase tracking-tight">Personnel Defaulter Registry</h3>
                 <button onClick={() => setIsLedgerOpen(false)} className="text-xl">✕</button>
              </div>
              <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                 <table className="w-full">
                    <thead className="text-[8px] font-bold uppercase text-slate-400 text-left border-b"><tr className="pb-1"><th>Personnel</th><th>Station</th><th>ZI Directive</th><th className="text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {entries.reduce((acc: any[], entry: any) => [...acc, ...(entry.unclearedList || []).map((cm: any) => ({ ...cm, lga: entry.lga, month: entry.month, auditId: entry.id }))], []).map((cm: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-all">
                            <td className="py-2">
                              <p className="font-bold text-slate-700 text-[11px] uppercase">{cm.name}</p>
                              <p className="text-[8px] font-bold text-emerald-800 opacity-60 uppercase">{cm.code} • {cm.month}</p>
                            </td>
                            <td className="py-2 text-[9px] font-bold text-slate-400 uppercase">{cm.ppa || cm.lga}</td>
                            <td className="py-2">
                               <textarea className="w-full p-1 bg-white border rounded text-[9px] outline-none h-12" placeholder="Add directive..." defaultValue={cm.ziMinute} onBlur={(e) => handleDefaulterMinute(cm.auditId, cm.code, e.target.value)} />
                            </td>
                            <td className="py-2 text-right">
                               <div className="flex items-center justify-end gap-1.5">
                                 <button onClick={() => handleIssueQuery(cm)} disabled={isGenerating} className="px-3 py-1 bg-[#004d40] text-white text-[8px] font-bold uppercase rounded hover:bg-black disabled:opacity-50">Query</button>
                                 <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Notice: ${cm.name} (${cm.code}) defaulted in ${cm.month} clearance.`)}`)} className="w-6 h-6 flex items-center justify-center text-emerald-600 bg-white border rounded"><WhatsAppIcon /></button>
                               </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                 </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="w-full lg:w-[280px] flex flex-col gap-4 no-print shrink-0">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <h3 className="font-bold uppercase text-[7px] mb-3 text-slate-400 text-center tracking-widest">Station Population Console</h3>
          <div className="space-y-1 mb-3 max-h-[140px] overflow-auto pr-1 custom-scrollbar">
            {tempBatches.map((b, i) => (
              <div key={i} className="p-2 bg-slate-50 rounded border border-slate-100 flex justify-between items-center group">
                <div className="flex flex-col">
                  <p className="text-[9px] font-black text-slate-800 uppercase leading-none">{b.batch}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">M: {b.males} | F: {b.females}</p>
                </div>
                <button onClick={() => setTempBatches(tempBatches.filter((_, idx) => idx !== i))} className="text-red-200 hover:text-red-500"><TrashIcon /></button>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 bg-slate-50 p-2 rounded border border-slate-100">
             <input placeholder="BATCH NAME" className="w-full p-1.5 bg-white rounded border border-slate-200 text-[10px] uppercase outline-none font-bold" value={newBatch.batch} onChange={e => setNewBatch({...newBatch, batch: e.target.value.toUpperCase()})} />
             <div className="grid grid-cols-2 gap-1.5">
                <input type="number" placeholder="Males" className="p-1.5 bg-white rounded border border-slate-200 text-[10px] font-bold" value={newBatch.males || ''} onChange={e => setNewBatch({...newBatch, males: parseInt(e.target.value) || 0})} />
                <input type="number" placeholder="Females" className="p-1.5 bg-white rounded border border-slate-200 text-[10px] font-bold" value={newBatch.females || ''} onChange={e => setNewBatch({...newBatch, females: parseInt(e.target.value) || 0})} />
             </div>
             <button onClick={() => { if(newBatch.batch) {setTempBatches([...tempBatches, newBatch]); setNewBatch({batch:'',males:0,females:0});} }} className="w-full py-1.5 bg-[#004d40] text-white rounded text-[8px] font-bold uppercase flex items-center justify-center gap-1"><PlusIcon /> Add Batch</button>
          </div>
          <button onClick={handleSaveStationDisposition} className="w-full mt-2 bg-emerald-700 text-white p-2 rounded font-bold uppercase text-[8px] shadow-sm">Sync Final Disposition</button>
        </div>
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <h3 className="font-bold uppercase text-[7px] mb-3 text-slate-400 text-center tracking-widest">Publish Monthly Audit</h3>
          <form onSubmit={handleSubmit} className="space-y-2">
            <input required placeholder="MONTH (e.g. JUNE 2025)" className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-[10px] font-bold uppercase outline-none" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value.toUpperCase()})} />
            <div className="p-2 bg-emerald-50/40 rounded border border-emerald-100 space-y-1.5">
               <label className="text-[7px] font-bold uppercase text-emerald-800">Assign Cleared Batch</label>
               <select className="w-full p-1.5 bg-white rounded border border-slate-200 text-[9px] font-bold uppercase" onChange={e => setNewClearedBatch({...newClearedBatch, batch: e.target.value})} value={newClearedBatch.batch}>
                 <option value="">Select...</option>
                 {tempBatches.map(b => <option key={b.batch} value={b.batch}>{b.batch}</option>)}
               </select>
               <div className="grid grid-cols-2 gap-1.5">
                  <input type="number" placeholder="M" className="p-1.5 bg-white rounded border border-slate-200 text-[9px] font-bold" value={newClearedBatch.males || ''} onChange={e => setNewClearedBatch({...newClearedBatch, males: parseInt(e.target.value) || 0})} />
                  <input type="number" placeholder="F" className="p-1.5 bg-white rounded border border-slate-200 text-[9px] font-bold" value={newClearedBatch.females || ''} onChange={e => setNewClearedBatch({...newClearedBatch, females: parseInt(e.target.value) || 0})} />
               </div>
               <button type="button" onClick={() => { if(newClearedBatch.batch) { setClearedBatches([...clearedBatches, newClearedBatch]); setNewClearedBatch({batch:'',males:0,females:0}); } }} className="w-full py-1 bg-[#004d40] text-white rounded text-[8px] font-bold uppercase">Include Batch</button>
            </div>
            <button className="w-full bg-[#004d40] text-white p-2 rounded font-bold uppercase text-[8px] shadow-sm">Submit to HQ</button>
          </form>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div className="bg-slate-900 rounded-lg shadow-xl p-5 text-white flex flex-col md:flex-row justify-between items-center gap-6 animate-official relative overflow-hidden">
           <div className="absolute right-0 top-0 opacity-10 scale-150 -translate-y-4 translate-x-4"><DashboardIcon /></div>
           <div className="z-10 text-center md:text-left">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">Local Station Population</h2>
              <div className="flex items-baseline gap-2">
                 <span className="text-4xl font-black font-serif-heading">{(currentStationDisp?.totalMales + currentStationDisp?.totalFemales || 0).toLocaleString()}</span>
                 <span className="text-[8px] font-bold uppercase tracking-widest opacity-40">Registered CMS</span>
              </div>
           </div>
           <div className="flex gap-8 z-10 border-l border-white/10 pl-8">
              <div className="text-center">
                 <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Males</p>
                 <p className="text-2xl font-black text-blue-400">{(currentStationDisp?.totalMales || 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                 <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-1">Females</p>
                 <p className="text-2xl font-black text-pink-400">{(currentStationDisp?.totalFemales || 0).toLocaleString()}</p>
              </div>
           </div>
           <div className="flex items-center gap-2 z-10">
              <button onClick={() => downloadCSV(tempBatches, `${lga}_Distribution`)} className="p-2 bg-white/10 hover:bg-white/20 rounded border border-white/20"><SpreadsheetIcon /></button>
              <button onClick={() => setIsLedgerOpen(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded text-[9px] font-black uppercase shadow-lg transition-all">Defaulter Logs</button>
           </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden animate-official">
           <div className="p-3 bg-slate-100 border-b flex justify-between items-center">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-slate-500">Personnel Distribution Detail ({lga})</h3>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1 p-1">
              {tempBatches.map((b, i) => (
                <div key={i} className="p-3 bg-slate-50/50 rounded border border-slate-100 flex flex-col items-center">
                   <p className="text-[10px] font-black text-slate-700 uppercase mb-2">{b.batch}</p>
                   <div className="flex justify-between w-full text-[11px] font-black">
                      <span className="text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-50">M: {b.males}</span>
                      <span className="text-pink-600 bg-white px-2 py-0.5 rounded border border-pink-50">F: {b.females}</span>
                   </div>
                   <p className="text-[8px] font-bold text-slate-300 uppercase mt-2">Agg: {b.males + b.females}</p>
                </div>
              ))}
              {tempBatches.length === 0 && <p className="col-span-full text-center text-[9px] text-slate-300 py-4">No disposition records found.</p>}
           </div>
        </div>

        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1 px-1">Submitted Monthly Audits</p>
          {entries.map((e: CIMClearance) => (
            <div key={e.id} className="bg-white p-3 rounded border border-slate-200 flex flex-col hover:bg-slate-50 transition-all group shadow-sm">
               <div className="flex justify-between items-center mb-2">
                 <div>
                   <h4 className="text-[12px] font-black uppercase text-slate-800 leading-none">{e.month}</h4>
                   <p className="text-[7px] font-bold text-slate-400 uppercase mt-1">Audit Record • {new Date(e.dateAdded).toLocaleDateString()}</p>
                 </div>
                 <div className="flex gap-4 items-center">
                   <div className="text-center">
                     <span className="block text-[14px] font-black text-emerald-600 leading-none">{e.clearedCount}</span>
                     <span className="text-[7px] font-bold text-slate-300 uppercase block">Cleared</span>
                   </div>
                   <div className="text-center">
                     <span className="block text-[14px] font-black text-red-600 leading-none">{e.unclearedList?.length || 0}</span>
                     <span className="text-[7px] font-bold text-slate-300 uppercase block">Defaulters</span>
                   </div>
                   <div className="flex gap-1 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => shareData(`Report for ${e.month}`, `Cleared: ${e.clearedCount}`)} className="w-6 h-6 flex items-center justify-center text-blue-600 bg-blue-50 rounded border scale-75"><ShareIcon /></button>
                     <button onClick={() => generateOfficialPDF(e, 'CIM_AUDIT')} className="w-6 h-6 flex items-center justify-center text-emerald-600 bg-emerald-50 rounded border scale-75"><DownloadIcon /></button>
                     <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="w-6 h-6 flex items-center justify-center text-red-200 bg-red-50/10 rounded border scale-75 hover:bg-red-600 hover:text-white transition-all"><TrashIcon /></button>
                   </div>
                 </div>
               </div>
               {e.ziMinute && (
                 <div className="p-2 bg-emerald-50 rounded border border-emerald-100 mt-1 relative">
                   <p className="text-[7px] font-black text-emerald-800 uppercase tracking-widest mb-1">Zonal Directive:</p>
                   <p className="text-[10px] text-slate-600 leading-relaxed italic">"{e.ziMinute}"</p>
                 </div>
               )}
            </div>
          ))}
        </div>
      </div>
      
      {isLedgerOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-2xl flex flex-col h-[75vh]">
            <div className="bg-[#004d40] p-4 text-white flex justify-between items-center shrink-0">
               <h3 className="text-[14px] font-black uppercase tracking-tight">Personnel Exception Registry</h3>
               <button onClick={() => setIsLedgerOpen(false)} className="text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
               <table className="w-full">
                  <thead className="text-[8px] font-bold uppercase text-slate-400 text-left border-b"><tr className="pb-1"><th>Corps Member</th><th>Station</th><th className="text-right">Action Desk</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {entries.reduce((acc: any[], entry: any) => [...acc, ...(entry.unclearedList || []).map((cm: any) => ({ ...cm, lga: entry.lga, month: entry.month }))], []).map((cm: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-all">
                          <td className="py-2">
                            <p className="font-bold text-slate-700 text-[11px] uppercase">{cm.name}</p>
                            <p className="text-[8px] font-bold text-emerald-800 opacity-60 uppercase">{cm.code} • {cm.month}</p>
                          </td>
                          <td className="py-2 text-[8px] font-bold text-slate-300 uppercase">{cm.ppa || cm.lga}</td>
                          <td className="py-2 text-right">
                             <div className="flex items-center justify-end gap-1.5">
                               <button onClick={() => handleIssueQuery(cm)} disabled={isGenerating} className="px-3 py-1 bg-[#004d40] text-white text-[8px] font-bold uppercase rounded hover:bg-black disabled:opacity-50">Query</button>
                               <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Administrative Notice: ${cm.name} (${cm.code}) defaulted in biometric clearance for ${cm.month}.`)}`)} className="w-6 h-6 flex items-center justify-center text-emerald-600 bg-white border rounded"><WhatsAppIcon /></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
               </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

/* --- CD&R Module --- */
const CDRModule = ({ entries, lga, db, userRole }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "cdr_cases", { ...formData, lga: lga || 'Daura', status: 'Pending' as CDRStatus });
    setFormData({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  };
  
  const handleFileUpload = async (id: string, field: 'responseImage' | 'evidenceDocuments', files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      if (field === 'responseImage') {
        const base64 = await fileToBase64(files[0]);
        await updateData(db, "cdr_cases", id, { [field]: base64, status: 'Responded' as CDRStatus });
      } else {
        const existingDocs = entries.find((e: any) => e.id === id)?.evidenceDocuments || [];
        const newBase64s = await Promise.all(Array.from(files).map(f => fileToBase64(f)));
        await updateData(db, "cdr_cases", id, { evidenceDocuments: [...existingDocs, ...newBase64s] });
      }
      window.alert("Uploaded.");
    } catch { window.alert("Failed."); } finally { setIsUploading(false); }
  };

  const handleStatusUpdate = async (id: string, status: CDRStatus) => { await updateData(db, "cdr_cases", id, { status }); };
  const handleMinuteUpdate = async (id: string, field: string, text: string) => { await updateData(db, "cdr_cases", id, { [field]: text }); };

  return (
    <>
      <div className="w-full lg:w-[280px] shrink-0 no-print">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 lg:sticky lg:top-14">
          <h3 className="font-bold uppercase text-[8px] text-slate-400 tracking-widest mb-3">Register Dossier</h3>
          <form onSubmit={handleSubmit} className="space-y-2">
            <input required placeholder="PERSONNEL NAME" className="w-full p-2 bg-slate-50 border rounded text-[10px] uppercase outline-none font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-2 bg-slate-50 border rounded text-[10px] uppercase outline-none font-bold" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <input required placeholder="PPA / STATION" className="w-full p-2 bg-slate-50 border rounded text-[10px] uppercase outline-none font-bold" value={formData.ppa} onChange={e => setFormData({...formData, ppa: e.target.value.toUpperCase()})} />
            <textarea required placeholder="MISCONDUCT NARRATIVE..." className="w-full p-2 bg-slate-50 border rounded h-20 text-[10px] outline-none" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-2 rounded font-bold uppercase text-[8px] shadow-sm flex items-center justify-center gap-1"><PlusIcon /> Log New Case</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {entries.map((cm: CDRCase) => (
          <div key={cm.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm relative animate-official group">
             <div className="absolute top-4 right-4 flex items-center gap-2 no-print">
                <span className={`px-2 py-0.5 rounded text-[7px] font-bold uppercase border tracking-widest ${
                  cm.status === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                  cm.status === 'Responded' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                  'bg-slate-900 text-white'
                }`}>{cm.status?.replace(/_/g, ' ') || 'Pending'}</span>
                <button onClick={() => deleteData(db, "cdr_cases", cm.id)} className="text-slate-200 hover:text-red-500 scale-75"><TrashIcon /></button>
             </div>
             <div className="mb-3">
               <h4 className="text-[13px] font-black uppercase tracking-tight text-slate-800 leading-none">{cm.name}</h4>
               <p className="text-[9px] font-bold text-emerald-800 opacity-60 mt-1 uppercase">{cm.stateCode}</p>
             </div>
             
             <div className="p-3 bg-slate-50 rounded border border-slate-100 mb-3 relative overflow-hidden">
                <p className="text-slate-600 text-[11px] font-medium italic leading-relaxed">"{cm.misconduct}"</p>
                {cm.ppa && <p className="mt-2 text-[7px] font-bold text-slate-400 uppercase tracking-widest">PPA: {cm.ppa} • {cm.lga}</p>}
             </div>

             {(cm.responseImage || (cm.evidenceDocuments && cm.evidenceDocuments.length > 0)) && (
               <div className="mb-3 p-3 bg-slate-50 rounded border border-slate-200">
                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Docket Evidence</p>
                 <div className="flex flex-wrap gap-2">
                   {cm.responseImage && (
                     <button onClick={() => setPreviewImage(cm.responseImage!)} className="px-3 py-1 bg-white border rounded text-[8px] font-bold uppercase hover:bg-slate-100">Statement</button>
                   )}
                   {cm.evidenceDocuments?.map((doc, i) => (
                     <button key={i} onClick={() => setPreviewImage(doc)} className="px-3 py-1 bg-white border rounded text-[8px] font-bold uppercase hover:bg-slate-100">Exhibit #{i+1}</button>
                   ))}
                 </div>
               </div>
             )}

             {userRole === 'LGI' && (cm.status === 'Pending' || cm.status === 'Responded' || cm.status === 'Minuted_back_to_LGI') && (
               <div className="p-3 bg-blue-50/10 rounded border border-blue-100 mb-3">
                  <p className="text-[8px] font-black text-blue-800 uppercase tracking-widest mb-3">LGI Actions</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                    <input type="file" className="text-[8px] text-slate-500 w-full" onChange={(e) => handleFileUpload(cm.id, 'responseImage', e.target.files)} />
                  </div>
                  <textarea className="w-full p-2.5 bg-white rounded border border-blue-100 text-[10px] h-20 outline-none mb-2" placeholder="LGI Remark..." defaultValue={cm.lgiMinute} onBlur={(e) => handleMinuteUpdate(cm.id, 'lgiMinute', e.target.value)} />
                  <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_ZI')} className="w-full py-2 bg-blue-600 text-white rounded text-[8px] font-black uppercase tracking-widest shadow-sm">Forward to Zonal HQ</button>
               </div>
             )}

             {userRole === 'ZI' && cm.status !== 'Forwarded_to_CDR' && (
               <div className="p-3 bg-emerald-50/20 rounded border border-emerald-100 mb-3">
                  <p className="text-[8px] font-black text-emerald-800 uppercase tracking-widest mb-2">ZI Administrative Directive</p>
                  <textarea className="w-full p-2.5 bg-white rounded border border-emerald-100 text-[10px] h-20 outline-none mb-2" placeholder="ZI official minute..." defaultValue={cm.ziMinute} onBlur={(e) => handleMinuteUpdate(cm.id, 'ziMinute', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_to_CIM')} className="py-2 bg-emerald-700 text-white rounded text-[8px] font-black uppercase">Minute to CIM</button>
                    <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_CDR')} className="py-2 bg-slate-900 text-white rounded text-[8px] font-black uppercase">Finalize Case</button>
                  </div>
               </div>
             )}

             <div className="flex justify-end items-center border-t border-slate-50 pt-3 gap-3 no-print">
               <button onClick={() => shareData(`Docket: ${cm.name}`, cm.misconduct)} className="w-8 h-8 flex items-center justify-center text-blue-600 bg-white border rounded scale-75"><ShareIcon /></button>
               <button onClick={() => generateOfficialPDF(cm, 'CDR_CASE')} className="w-8 h-8 flex items-center justify-center text-slate-400 bg-white border rounded scale-75"><DownloadIcon /></button>
               <button className="w-8 h-8 flex items-center justify-center text-emerald-600 bg-white border rounded scale-75" onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Administrative Record Updated for ${cm.name}.`)}`)}><WhatsAppIcon /></button>
             </div>
          </div>
        ))}
      </div>

      {previewImage && (
        <div className="fixed inset-0 bg-slate-950/90 z-[3000] flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
          <div className="max-w-4xl w-full max-h-[90vh] flex flex-col items-center gap-4">
             <img src={previewImage} className="max-w-full max-h-full rounded shadow-2xl border-4 border-white/10 object-contain" alt="Asset" />
             <button className="px-6 py-2 bg-white text-black font-bold uppercase text-[10px] rounded">Close Exhibit</button>
          </div>
        </div>
      )}
    </>
  );
};

/* --- CDS Module --- */
const CDSModule = ({ groups, projects, lga, db }: any) => {
  const [groupForm, setGroupForm] = useState({ groupName: '', meetingDay: 'Wednesday' });
  return (
    <>
      <div className="w-full lg:w-[280px] flex flex-col gap-4 no-print shrink-0">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <h3 className="font-bold uppercase text-[7px] text-slate-400 tracking-widest mb-3">Register CDS Unit</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_groups", { ...groupForm, lga }); setGroupForm({groupName:'',meetingDay:'Wednesday'}); }} className="space-y-2">
            <input required placeholder="UNIT NAME" className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-[10px] font-bold uppercase outline-none" value={groupForm.groupName} onChange={e => setGroupForm({...groupForm, groupName: e.target.value.toUpperCase()})} />
            <select className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-[10px] font-bold uppercase outline-none" value={groupForm.meetingDay} onChange={e => setGroupForm({...groupForm, meetingDay: e.target.value})}>
              <option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option>
            </select>
            <button className="w-full bg-[#004d40] text-white p-2 rounded font-bold uppercase text-[8px] flex items-center justify-center gap-1"><PlusIcon /> Initialize Unit</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
        {groups.map((g: any) => (
          <div key={g.id} className="bg-white p-3 rounded border border-slate-200 relative group animate-official shadow-sm overflow-hidden h-fit">
            <div className="absolute left-0 top-0 w-1 h-full bg-[#004d40]"></div>
            <h4 className="text-[11px] font-black uppercase text-slate-800 leading-tight pl-2">{g.groupName}</h4>
            <div className="flex items-center gap-2 text-[7px] font-bold text-emerald-800 tracking-wider uppercase pl-2 mt-1.5">
              <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">{g.meetingDay}</span>
              <span className="text-slate-300">Command: {g.lga}</span>
            </div>
            <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => shareData(`CDS Unit: ${g.groupName}`, `Meeting Day: ${g.meetingDay}`)} className="text-blue-500 scale-75"><ShareIcon /></button>
              <button onClick={() => deleteData(db, "cds_groups", g.id)} className="text-red-500 scale-75"><TrashIcon /></button>
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="col-span-full text-center text-slate-400 py-10">No records found.</p>}
      </div>
    </>
  );
};

/* --- SAED Module --- */
const SAEDModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  return (
    <>
      <div className="w-full lg:w-[280px] flex flex-col gap-4 no-print shrink-0">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
          <h3 className="font-bold uppercase text-[7px] text-slate-400 tracking-widest mb-3">Register Skill Hub</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "saed_centers", { ...formData, lga }); setFormData({centerName:'',address:'',cmCount:0,fee:0}); }} className="space-y-2">
            <input required placeholder="HUB NAME" className="w-full p-2 bg-slate-50 rounded border text-[10px] outline-none font-bold uppercase" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
            <input required placeholder="STATION/ADDRESS" className="w-full p-2 bg-slate-50 rounded border text-[10px] outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
            <div className="grid grid-cols-2 gap-2">
               <input type="number" placeholder="CMS" className="w-full p-2 bg-white rounded border text-[10px] font-black" value={formData.cmCount || ''} onChange={e => setFormData({...formData, cmCount: parseInt(e.target.value) || 0})} />
               <input type="number" placeholder="₦ FEE" className="w-full p-2 bg-white rounded border text-[10px] font-black" value={formData.fee || ''} onChange={e => setFormData({...formData, fee: parseInt(e.target.value) || 0})} />
            </div>
            <button className="w-full bg-[#004d40] text-white p-2.5 rounded font-black uppercase text-[8px] tracking-widest shadow-sm flex items-center justify-center gap-1"><PlusIcon /> Confirm Skill Hub</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
        {entries.map((c: any) => (
          <div key={c.id} className="bg-white p-4 rounded border border-slate-100 relative group animate-official hover:shadow overflow-hidden h-fit">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#004d40]"></div>
            <h4 className="text-[12px] font-black uppercase text-slate-800 leading-tight">{c.centerName}</h4>
            <p className="text-[8px] font-bold text-slate-400 uppercase mt-1 leading-none">{c.address}</p>
            <div className="flex gap-6 pt-3 border-t border-slate-50 mt-3">
               <div><p className="text-[7px] font-bold text-slate-300 mb-0.5 uppercase tracking-widest">Census</p><p className="text-[14px] font-black text-[#004d40]">{c.cmCount}</p></div>
               <div><p className="text-[7px] font-bold text-slate-300 mb-0.5 uppercase tracking-widest">Fee</p><p className="text-[14px] font-black text-emerald-600">₦{Number(c.fee).toLocaleString()}</p></div>
            </div>
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => shareData(`SAED Hub: ${c.centerName}`, `Fee: ₦${c.fee}`)} className="text-blue-500 scale-75"><ShareIcon /></button>
              <button onClick={() => deleteData(db, "saed_centers", c.id)} className="text-red-500 scale-75"><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

/* --- CWHS Module --- */
const CWHSModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.ABSCONDED, details: '' });
  return (
    <>
      <div className="w-full lg:w-[280px] shrink-0 no-print">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 lg:sticky lg:top-14">
          <h3 className="font-bold uppercase text-[7px] text-slate-400 tracking-widest mb-3">Register CM Incident</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "nysc_reports", { ...formData, lga }); setFormData({name:'',stateCode:'',category:ReportCategory.ABSCONDED,details:''}); }} className="space-y-2">
            <input required placeholder="CM NAME" className="w-full p-2 bg-slate-50 rounded border text-[10px] font-black uppercase" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-2 bg-slate-50 rounded border text-[10px] font-black uppercase" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <select className="w-full p-2 bg-slate-50 rounded border text-[10px] font-black uppercase" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ReportCategory})}>
              {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea placeholder="INCIDENT BRIEF..." className="w-full p-2 bg-slate-50 rounded border h-20 text-[10px]" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-2 rounded font-black uppercase text-[8px] flex items-center justify-center gap-1"><PlusIcon /> File Incident</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
        {entries.map((e: any) => (
          <div key={e.id} className="bg-white p-4 rounded border border-slate-200 relative group animate-official shadow-sm overflow-hidden h-fit">
            <h4 className="text-[12px] font-black uppercase text-slate-800 leading-tight">{e.name}</h4>
            <p className="text-[8px] font-bold text-emerald-800 opacity-60 mt-1 uppercase leading-none">{e.stateCode}</p>
            <div className="p-2 bg-slate-50 rounded border border-slate-100 my-2.5 shadow-inner"><p className="text-[10px] text-slate-600 italic leading-tight">"{e.details || 'No details provided.'}"</p></div>
            <div className="flex justify-between items-center border-t border-slate-50 pt-2.5">
               <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{e.category} | Command: {e.lga}</span>
               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => shareData(`Incident: ${e.name}`, e.details)} className="text-blue-500 scale-75"><ShareIcon /></button>
                 <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="text-red-500 scale-75"><TrashIcon /></button>
               </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="col-span-full text-center text-slate-400 py-10">No records filed.</p>}
      </div>
    </>
  );
};

export default App;

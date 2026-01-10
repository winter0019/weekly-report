
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
  PlusIcon,
  AbscondedIcon,
  SickIcon,
  KidnappedIcon,
  MissingIcon,
  DeceasedIcon
} from './components/Icons';
import { initFirebase, subscribeToCollection, addData, updateData, deleteData } from './services/firebaseService';
import { generateDisciplinaryQuery } from './services/geminiService';
import { generateOfficialPDF } from './services/pdfService';

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
  const [ziStationFilter, setZiStationFilter] = useState<string>('all');
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
            setTimeout(() => { if (active) setIsDbLoaded(true); }, 400);
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
      else if (userRole === 'ZI' && ziStationFilter !== 'all') filtered = filtered.filter(i => i.lga === ziStationFilter);
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
  }, [cwhsEntries, cimEntries, saedEntries, cdrEntries, cdsGroups, cdsProjects, userRole, lgaContext, ziStationFilter, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-950 via-slate-900 to-black">
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
          } else { window.alert("Invalid Security PIN."); }
        }} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md space-y-6 animate-official border-4 border-emerald-900/10">
          <div className="text-center">
            <div className="w-14 h-14 bg-[#004d40] rounded-xl mx-auto mb-4 flex items-center justify-center shadow-lg text-white font-serif-heading text-2xl font-black">NYSC</div>
            <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Command Portal</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.3em]">Access Restricted</p>
          </div>
          <div className="space-y-4">
            <select required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Command Center...</option>
                <option value="ZI">Zonal Office (ZI)</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Station (LGI)</option>)}
            </select>
            <input type="password" required placeholder="PIN" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-2xl font-black tracking-[0.5em] outline-none" value={pin} onChange={e => setPin(e.target.value)} />
          </div>
          <button className="w-full bg-[#004d40] text-white p-4 rounded-xl font-bold uppercase shadow-lg hover:bg-black transition-all tracking-widest text-sm">Authenticate</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-inter pb-10">
      <nav className="fixed top-0 left-0 right-0 z-[100] glass-nav pt-4 flex justify-center no-print px-4 h-16 items-center">
        <div className="flex bg-slate-200/50 p-1 rounded-full shadow-inner">
          {(Object.keys(DIVISION_LABELS) as Division[]).map(id => (
            <button key={id} onClick={() => setDivision(id)} className={`px-5 sm:px-8 py-2 rounded-full transition-all font-bold uppercase text-[10px] tracking-wider ${division === id ? 'bg-[#004d40] text-white shadow' : 'text-slate-500 hover:text-slate-900'}`}>{DIVISION_LABELS[id]}</button>
          ))}
        </div>
      </nav>

      <div className="pt-20 px-4 sm:px-6 max-w-[1400px] mx-auto w-full">
        <header className="bg-[#004d40] text-white p-6 sm:p-8 shadow-xl rounded-2xl flex flex-col md:flex-row items-center justify-between no-print gap-6 mb-8 animate-official border-b-4 border-black/10">
          <div className="flex items-center gap-5 w-full md:w-auto">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10 shadow-lg"><DashboardIcon /></div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight font-serif-heading">NYSC DAURA COMMAND</h1>
              <p className="text-[9px] font-bold text-emerald-300 tracking-[0.2em] uppercase opacity-70">Secretariat Portal Hub</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 w-full md:w-auto">
            <div className="bg-black/20 px-4 py-2 rounded-lg border border-white/5 text-[10px] font-bold uppercase tracking-wider">{userRole === 'LGI' ? `STATION: ${String(lgaContext).toUpperCase()}` : 'ZONAL HQ'}</div>
            <button onClick={handleLogout} className="w-10 h-10 bg-red-600/20 hover:bg-red-600 rounded-lg border border-white/10 transition-all flex items-center justify-center"><LogOutIcon /></button>
          </div>
        </header>

        <div className="mb-8 flex justify-center no-print">
          <div className="bg-white p-1 rounded-full shadow-md w-full max-w-2xl border border-slate-200 flex items-center group">
            <div className="ml-5 mr-3 text-slate-300 group-focus-within:text-emerald-500 transition-colors"><SearchIcon /></div>
            <input type="text" placeholder="Search registry..." className="bg-transparent p-3 text-sm w-full outline-none font-medium text-slate-600" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <main className="flex flex-col lg:flex-row gap-8">
          {!isDbLoaded ? (
            <div className="w-full flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-[#004d40] rounded-full animate-spin"></div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Synchronizing Command Data...</p>
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
  const [unclearedInput, setUnclearedInput] = useState({ name: '', code: '', reason: '', ppa: '' });
  const [tempUnclearedList, setTempUnclearedList] = useState<{name: string, code: string, reason: string, ppa?: string}[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentStationDisp = stationDispositions.find((d: any) => d.lga === lga);
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
      window.alert("Registry Updated.");
    } catch { window.alert("Update Failed."); }
  };

  const handleIssueQuery = async (cm: any) => {
    setIsGenerating(true);
    try {
      const ppaVal = cm.ppa || "LGA HQ: " + (cm.lga || lga);
      const content = await generateDisciplinaryQuery(cm.name, cm.code, cm.lga || lga, `Biometric Default (${cm.month})`, ppaVal);
      const payload = { 
        name: cm.name, stateCode: cm.code, lga: cm.lga || lga, ppa: ppaVal, 
        misconduct: `BIOMETRIC DEFAULT - ${cm.month}`, status: 'Pending' as CDRStatus,
        responseContent: content, month: cm.month, dateOfInfraction: new Date().toISOString()
      };
      await addData(db, "cdr_cases", payload);
      generateOfficialPDF(payload, 'DISCIPLINARY_QUERY');
      window.alert("Query Issued and forwarded to CD&R.");
    } catch { window.alert("Failed."); } finally { setIsGenerating(false); }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const totalM = clearedBatches.reduce((a,b)=>a+b.males,0);
    const totalF = clearedBatches.reduce((a,b)=>a+b.females,0);
    const data = { month: formData.month, lga, maleCount: totalM, femaleCount: totalF, clearedCount: totalM+totalF, totalCMs: totalM+totalF+tempUnclearedList.length, unclearedList: tempUnclearedList.map(u => ({...u, month: formData.month})), batchClearance: clearedBatches, dateAdded: new Date().toISOString() };
    await addData(db, "cim_clearance", data);
    setFormData({month:''}); setClearedBatches([]); setTempUnclearedList([]);
  };

  return (
    <>
      <div className="w-full lg:w-[380px] flex flex-col gap-6 no-print shrink-0">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200">
          <h3 className="font-bold uppercase text-[10px] mb-6 text-slate-400 tracking-widest text-center">Batch Configuration</h3>
          <div className="space-y-3 mb-6 max-h-[250px] overflow-auto pr-1 custom-scrollbar">
            {tempBatches.map((b, i) => (
              <div key={i} className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center group hover:bg-white transition-all">
                <div>
                  <p className="text-[11px] font-bold text-slate-800 uppercase">{b.batch}</p>
                  <p className="text-[9px] text-slate-400 font-bold mt-1">M: {b.males} | F: {b.females}</p>
                </div>
                <button onClick={() => setTempBatches(tempBatches.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-500 p-2"><TrashIcon /></button>
              </div>
            ))}
          </div>
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
             <input placeholder="BATCH NAME" className="w-full p-3 bg-white rounded-lg border border-slate-200 text-xs font-bold uppercase outline-none" value={newBatch.batch} onChange={e => setNewBatch({...newBatch, batch: e.target.value.toUpperCase()})} />
             <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="M" className="p-3 bg-white rounded-lg border border-slate-200 text-xs" value={newBatch.males || ''} onChange={e => setNewBatch({...newBatch, males: parseInt(e.target.value) || 0})} />
                <input type="number" placeholder="F" className="p-3 bg-white rounded-lg border border-slate-200 text-xs" value={newBatch.females || ''} onChange={e => setNewBatch({...newBatch, females: parseInt(e.target.value) || 0})} />
             </div>
             <button onClick={() => { if(newBatch.batch) {setTempBatches([...tempBatches, newBatch]); setNewBatch({batch:'',males:0,females:0});} }} className="w-full py-3 bg-[#004d40] text-white rounded-lg text-[10px] font-bold uppercase shadow tracking-widest">Update Batches</button>
          </div>
          <button onClick={handleSaveStationDisposition} className="w-full mt-4 bg-emerald-700 text-white p-4 rounded-xl font-bold uppercase text-[10px] tracking-widest border-b-4 border-emerald-900 shadow">Save Disposition</button>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200">
          <h3 className="font-bold uppercase text-[10px] mb-6 text-slate-400 tracking-widest text-center">Monthly Clearance Audit</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="AUDIT MONTH (E.G. JAN 2026)" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value.toUpperCase()})} />
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
               <p className="text-[9px] font-bold uppercase text-emerald-800 tracking-widest">Register Batch Results</p>
               <select className="w-full p-3 bg-white rounded-lg border border-slate-200 text-xs" onChange={e => setNewClearedBatch({...newClearedBatch, batch: e.target.value})} value={newClearedBatch.batch}>
                 <option value="">Select Batch...</option>
                 {tempBatches.map(b => <option key={b.batch} value={b.batch}>{b.batch}</option>)}
               </select>
               <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="M CLEARED" className="p-3 bg-white rounded-lg border border-slate-200 text-xs outline-none" value={newClearedBatch.males || ''} onChange={e => setNewClearedBatch({...newClearedBatch, males: parseInt(e.target.value) || 0})} />
                  <input type="number" placeholder="F CLEARED" className="p-3 bg-white rounded-lg border border-slate-200 text-xs outline-none" value={newClearedBatch.females || ''} onChange={e => setNewClearedBatch({...newClearedBatch, females: parseInt(e.target.value) || 0})} />
               </div>
               <button type="button" onClick={() => { if(newClearedBatch.batch) { setClearedBatches([...clearedBatches, newClearedBatch]); setNewClearedBatch({batch:'',males:0,females:0}); } }} className="w-full py-3 bg-[#004d40] text-white rounded-lg text-[9px] font-bold uppercase shadow">Add Batch Entry</button>
            </div>
            <button className="w-full bg-[#004d40] text-white p-4 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow border-b-4 border-emerald-900">Publish Audit</button>
          </form>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="bg-[#004d40] p-8 rounded-2xl text-white shadow-lg animate-official flex justify-between items-center relative overflow-hidden">
           <div>
              <span className="text-5xl font-black tracking-tighter">{entries.length}</span>
              <span className="ml-4 text-[11px] font-bold uppercase tracking-[0.3em] opacity-50">Audit Cycles Captured</span>
           </div>
           <button onClick={() => setIsLedgerOpen(true)} className="px-6 py-3 bg-white text-[#004d40] rounded-lg font-bold uppercase text-[10px] tracking-widest shadow-md hover:bg-slate-100">Clearance Ledger</button>
           <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
        </div>

        <div className="space-y-4">
          {entries.map((e: CIMClearance) => (
            <div key={e.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col md:flex-row justify-between items-center shadow hover:shadow-lg transition-all gap-6 relative overflow-hidden group">
               <div className="flex-1">
                 <h4 className="text-xl font-black uppercase text-slate-800 font-serif-heading leading-tight">{e.month}</h4>
                 <p className="text-[9px] font-bold text-emerald-800 tracking-[0.2em] uppercase mt-1">{String(e.lga).toUpperCase()} STATION AUDIT</p>
               </div>
               <div className="flex gap-10 items-center">
                 <div className="text-center">
                   <span className="block text-3xl font-black text-emerald-600 leading-none">{e.clearedCount}</span>
                   <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 block">Cleared</span>
                 </div>
                 <div className="text-center">
                   <span className="block text-3xl font-black text-red-600 leading-none">{e.unclearedList?.length || 0}</span>
                   <span className="text-[9px] font-bold text-slate-400 uppercase mt-1 block">Defaulters</span>
                 </div>
                 <div className="flex gap-2 ml-4 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => generateOfficialPDF(e, 'CIM_AUDIT')} className="w-10 h-10 flex items-center justify-center text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-600 hover:text-white transition-all"><DownloadIcon /></button>
                   <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="w-10 h-10 flex items-center justify-center text-red-200 bg-red-50/30 rounded-lg hover:bg-red-600 hover:text-white transition-all"><TrashIcon /></button>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {isLedgerOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[2000] flex items-center justify-center p-4 animate-official">
          <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] border-8 border-emerald-950/5">
            <div className="bg-[#004d40] p-8 text-white flex justify-between items-center shrink-0">
               <div>
                 <h3 className="text-2xl font-black uppercase font-serif-heading tracking-tight leading-none">Biometric Action Ledger</h3>
                 <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-50 mt-2">Administrative Accountability Tracking</p>
               </div>
               <button onClick={() => setIsLedgerOpen(false)} className="w-10 h-10 bg-white/10 hover:bg-red-600 rounded-lg flex items-center justify-center transition-all text-xl font-black">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-8 custom-scrollbar">
               <table className="w-full border-separate border-spacing-y-4">
                  <thead className="text-[10px] font-bold uppercase text-slate-400 text-left tracking-widest"><tr className="px-6 pb-2"><th className="px-6">Personnel</th><th className="px-6">Station</th><th className="px-6 text-right">Actions</th></tr></thead>
                  <tbody>
                    {entries.reduce((acc: any[], entry: any) => [...acc, ...(entry.unclearedList || []).map((cm: any) => ({ ...cm, lga: entry.lga, month: entry.month }))], []).map((cm: any, idx: number) => (
                        <tr key={idx} className="bg-slate-50 hover:bg-slate-100 rounded-xl transition-all shadow-sm">
                          <td className="px-6 py-4 rounded-l-xl">
                            <p className="font-bold text-slate-800 text-sm uppercase">{cm.name}</p>
                            <p className="text-[10px] font-bold text-emerald-800 opacity-60 uppercase">{cm.code} • {cm.month}</p>
                          </td>
                          <td className="px-6 py-4"><span className="px-3 py-1 bg-white text-slate-500 rounded-md text-[10px] font-bold uppercase border shadow-sm">{cm.ppa || cm.lga}</span></td>
                          <td className="px-6 py-4 rounded-r-xl text-right">
                             <div className="flex items-center justify-end gap-3">
                               <button onClick={() => handleIssueQuery(cm)} disabled={isGenerating} className="px-5 py-2 bg-[#004d40] text-white text-[10px] font-bold uppercase rounded-md shadow hover:bg-black transition-all disabled:opacity-50">
                                 {isGenerating ? 'Wait...' : 'Issue Query'}
                               </button>
                               <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Official Notice: ${cm.name} (${cm.code}) defaulted in ${cm.month} clearance.`)}`)} className="w-9 h-9 flex items-center justify-center bg-white text-emerald-600 rounded-md border shadow-sm hover:bg-emerald-50"><WhatsAppIcon /></button>
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
      window.alert("Uploaded Successfully.");
    } catch { window.alert("Upload Failed."); } finally { setIsUploading(false); }
  };

  const handleStatusUpdate = async (id: string, status: CDRStatus) => { await updateData(db, "cdr_cases", id, { status }); };
  const handleMinuteUpdate = async (id: string, field: string, text: string) => { await updateData(db, "cdr_cases", id, { [field]: text }); };

  return (
    <>
      <div className="w-full lg:w-[380px] shrink-0 no-print">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 lg:sticky lg:top-24">
          <h3 className="font-bold uppercase text-[10px] mb-6 text-slate-400 tracking-widest text-center">Open Misconduct Case</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="PERSONNEL FULL NAME" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-50" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-50" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <input required placeholder="STATION/PPA" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-50" value={formData.ppa} onChange={e => setFormData({...formData, ppa: e.target.value.toUpperCase()})} />
            <textarea required placeholder="MISCONDUCT DESCRIPTION..." className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 h-32 text-xs font-medium outline-none focus:ring-2 focus:ring-emerald-50" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-4 rounded-xl font-bold uppercase text-[10px] shadow border-b-4 border-emerald-900 tracking-widest">Register Case</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-6">
        {entries.map((cm: CDRCase) => (
          <div key={cm.id} className="bg-white p-8 rounded-2xl shadow border border-slate-200 relative group animate-official overflow-hidden">
             <div className="absolute top-8 right-8 flex items-center gap-4 no-print">
                <span className={`px-4 py-2 rounded-full text-[9px] font-bold uppercase border tracking-widest shadow-sm ${
                  cm.status === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                  cm.status === 'Responded' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                  cm.status === 'Forwarded_to_ZI' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                  cm.status === 'Minuted_to_CIM' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-900 text-white'
                }`}>{cm.status?.replace(/_/g, ' ') || 'Pending'}</span>
                <button onClick={() => deleteData(db, "cdr_cases", cm.id)} className="text-slate-200 hover:text-red-500 p-2"><TrashIcon /></button>
             </div>
             <div className="mb-6">
               <h4 className="text-lg font-black uppercase font-serif-heading tracking-tight text-slate-800 leading-none mb-2">{cm.name}</h4>
               <p className="text-[11px] font-bold text-emerald-800 tracking-[0.2em] uppercase opacity-60">{cm.stateCode}</p>
             </div>
             
             <div className="p-6 bg-slate-50 rounded-xl border border-slate-100 mb-6 shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#004d40]"></div>
                <p className="text-slate-600 text-[13px] font-medium leading-relaxed italic pl-3">"{cm.misconduct}"</p>
                {cm.ppa && <p className="mt-4 text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-3">Station: {cm.ppa} • {String(cm.lga).toUpperCase()}</p>}
             </div>

             {(cm.lgiMinute || cm.ziMinute) && (
                <div className="mb-6 pl-8 border-l-2 border-slate-200 space-y-6 relative">
                   <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.2em] mb-4">Official Minute Log</p>
                   {cm.lgiMinute && (
                      <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100 relative shadow-sm">
                         <span className="absolute -left-[40px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-4 border-white shadow-md"></span>
                         <p className="text-[10px] font-bold text-blue-800 uppercase mb-2">LGI Analysis:</p>
                         <p className="text-xs text-slate-600 italic leading-relaxed">"{cm.lgiMinute}"</p>
                      </div>
                   )}
                   {cm.ziMinute && (
                      <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 relative shadow-sm">
                         <span className="absolute -left-[40px] top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white shadow-md"></span>
                         <p className="text-[10px] font-bold text-emerald-800 uppercase mb-2">ZI Directive:</p>
                         <p className="text-xs text-slate-600 italic leading-relaxed">"{cm.ziMinute}"</p>
                      </div>
                   )}
                </div>
             )}

             {userRole === 'LGI' && (cm.status === 'Pending' || cm.status === 'Responded') && (
               <div className="p-6 bg-blue-50/20 rounded-2xl border border-blue-100 mb-6 animate-official shadow-sm">
                  <p className="text-[10px] font-bold text-blue-800 uppercase tracking-widest mb-6">Investigative Hub (LGI)</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 bg-white rounded-xl border border-blue-50 shadow-sm space-y-4">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">A. Written Response</p>
                      <input type="file" className="text-[10px] text-slate-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-[9px] file:font-bold file:bg-blue-50 file:text-blue-700 cursor-pointer w-full" onChange={(e) => handleFileUpload(cm.id, 'responseImage', e.target.files)} />
                      {cm.responseImage && <p className="text-[8px] font-bold text-emerald-600 uppercase">✓ RESPONSE ATTACHED</p>}
                    </div>
                    <div className="p-4 bg-white rounded-xl border border-blue-50 shadow-sm space-y-4">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">B. Evidence Dossier</p>
                      <input type="file" multiple className="text-[10px] text-slate-500 file:mr-3 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-[9px] file:font-bold file:bg-emerald-50 file:text-emerald-700 cursor-pointer w-full" onChange={(e) => handleFileUpload(cm.id, 'evidenceDocuments', e.target.files)} />
                      {cm.evidenceDocuments && cm.evidenceDocuments.length > 0 && <p className="text-[8px] font-bold text-emerald-600 uppercase">✓ {cm.evidenceDocuments.length} EVIDENCE FILES</p>}
                    </div>
                  </div>

                  <textarea className="w-full p-5 bg-white rounded-xl border border-blue-100 outline-none text-xs h-32 focus:ring-4 focus:ring-blue-50 font-medium leading-relaxed mb-4" placeholder="Enter findings and recommendation..." defaultValue={cm.lgiMinute} onBlur={(e) => handleMinuteUpdate(cm.id, 'lgiMinute', e.target.value)} />
                  <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_ZI')} className="w-full py-4 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase shadow tracking-widest border-b-4 border-blue-900">Forward to Zonal Inspector</button>
               </div>
             )}

             {userRole === 'ZI' && cm.status === 'Forwarded_to_ZI' && (
               <div className="p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100 mb-6 animate-official">
                  <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-4">Directive Desk (ZI)</p>
                  <textarea className="w-full p-5 bg-white rounded-xl border border-emerald-100 outline-none text-xs h-32 focus:ring-4 focus:ring-emerald-50 font-medium leading-relaxed mb-4" placeholder="Enter final HQ instruction..." defaultValue={cm.ziMinute} onBlur={(e) => handleMinuteUpdate(cm.id, 'ziMinute', e.target.value)} />
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_to_CIM')} className="py-4 bg-emerald-700 text-white rounded-xl text-[9px] font-bold uppercase shadow tracking-widest border-b-4 border-emerald-950">Minute to CIM</button>
                    <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_CDR')} className="py-4 bg-slate-900 text-white rounded-xl text-[9px] font-bold uppercase shadow tracking-widest border-b-4 border-black">Close Case</button>
                  </div>
               </div>
             )}

             <div className="flex justify-end items-center border-t border-slate-100 pt-6 gap-6 no-print">
               <button onClick={() => generateOfficialPDF(cm, 'CDR_CASE')} className="w-12 h-12 bg-white text-slate-400 rounded-xl flex items-center justify-center hover:text-[#004d40] border shadow-sm"><DownloadIcon /></button>
               <button className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center border shadow-sm" onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Case Update: ${cm.name} dossier updated.`)}`)}><WhatsAppIcon /></button>
             </div>
          </div>
        ))}
      </div>
    </>
  );
};

/* --- CDS Module --- */
const CDSModule = ({ groups, projects, lga, db }: any) => {
  const [groupForm, setGroupForm] = useState({ groupName: '', meetingDay: 'Wednesday' });
  const [projectForm, setProjectForm] = useState({ cmName: '', stateCode: '', projectName: '', description: '', status: 'Ongoing' as any });

  return (
    <>
      <div className="w-full lg:w-[380px] flex flex-col gap-6 no-print shrink-0">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200">
          <h3 className="font-bold uppercase text-[10px] mb-6 text-slate-400 tracking-widest text-center">New CDS Unit</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_groups", { ...groupForm, lga }); setGroupForm({groupName:'',meetingDay:'Wednesday'}); }} className="space-y-4">
            <input required placeholder="UNIT NAME" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none" value={groupForm.groupName} onChange={e => setGroupForm({...groupForm, groupName: e.target.value.toUpperCase()})} />
            <select className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none" value={groupForm.meetingDay} onChange={e => setGroupForm({...groupForm, meetingDay: e.target.value})}>
              <option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option>
            </select>
            <button className="w-full bg-[#004d40] text-white p-4 rounded-xl font-bold uppercase text-[10px] shadow border-b-4 border-emerald-900 tracking-widest">Initialize Group</button>
          </form>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200">
          <h3 className="font-bold uppercase text-[10px] mb-6 text-slate-400 tracking-widest text-center">Project Dossier</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_projects", { ...projectForm, lga }); setProjectForm({cmName:'',stateCode:'',projectName:'',description:'',status:'Ongoing'}); }} className="space-y-4">
            <input required placeholder="CM NAME" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none" value={projectForm.cmName} onChange={e => setProjectForm({...projectForm, cmName: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none" value={projectForm.stateCode} onChange={e => setProjectForm({...projectForm, stateCode: e.target.value.toUpperCase()})} />
            <input required placeholder="PROJECT TITLE" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none" value={projectForm.projectName} onChange={e => setProjectForm({...projectForm, projectName: e.target.value.toUpperCase()})} />
            <button className="w-full bg-emerald-700 text-white p-4 rounded-xl font-bold uppercase text-[10px] shadow border-b-4 border-emerald-900 tracking-widest">Log Project</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6 content-start">
        {groups.map((g: any) => (
          <div key={g.id} className="bg-white p-6 rounded-2xl border border-slate-200 relative group animate-official hover:shadow transition-all h-fit shadow-sm overflow-hidden">
            <div className="absolute left-0 top-0 w-1 h-full bg-[#004d40]"></div>
            <h4 className="text-sm font-black uppercase tracking-tight text-slate-800 font-serif-heading mb-3 pl-3 leading-tight">{g.groupName}</h4>
            <div className="flex items-center gap-3 text-[9px] font-bold text-emerald-800 tracking-wider uppercase pl-3">
              <span className="bg-emerald-50 px-3 py-1 rounded-md">{g.meetingDay}</span>
              <span className="text-slate-400">{g.lga} STATION</span>
            </div>
            <button onClick={() => deleteData(db, "cds_groups", g.id)} className="absolute top-6 right-6 text-slate-100 group-hover:text-red-500 transition-all"><TrashIcon /></button>
          </div>
        ))}
      </div>
    </>
  );
};

/* --- SAED Module --- */
const SAEDModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  return (
    <>
      <div className="w-full lg:w-[380px] flex flex-col gap-6 no-print shrink-0">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200">
          <h3 className="font-bold uppercase text-[10px] mb-6 text-slate-400 tracking-widest text-center">SAED Hub Registry</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "saed_centers", { ...formData, lga }); setFormData({centerName:'',address:'',cmCount:0,fee:0}); }} className="space-y-4">
            <input required placeholder="HUB NAME" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-50" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
            <input required placeholder="ADDRESS" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-50" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
            <div className="grid grid-cols-2 gap-4">
               <input type="number" placeholder="CMs" className="w-full p-4 bg-white rounded-xl border border-slate-200 text-xs font-bold" value={formData.cmCount || ''} onChange={e => setFormData({...formData, cmCount: parseInt(e.target.value) || 0})} />
               <input type="number" placeholder="FEE (₦)" className="w-full p-4 bg-white rounded-xl border border-slate-200 text-xs font-bold" value={formData.fee || ''} onChange={e => setFormData({...formData, fee: parseInt(e.target.value) || 0})} />
            </div>
            <button className="w-full bg-[#004d40] text-white p-4 rounded-xl font-bold uppercase text-[10px] tracking-widest shadow border-b-4 border-emerald-900">Secure Registration</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6 content-start">
        {entries.map((c: any) => (
          <div key={c.id} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative group animate-official hover:shadow-md transition-all overflow-hidden h-fit">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#004d40]"></div>
            <h4 className="text-base font-black uppercase tracking-tight text-slate-800 font-serif-heading mb-1">{c.centerName}</h4>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">{c.address}</p>
            <div className="flex gap-10 pt-6 border-t border-slate-50">
               <div><p className="text-[9px] font-bold uppercase text-slate-300 mb-1">Census</p><p className="text-xl font-black text-[#004d40]">{c.cmCount}</p></div>
               <div><p className="text-[9px] font-bold uppercase text-slate-300 mb-1">Pricing</p><p className="text-xl font-black text-emerald-600">₦{Number(c.fee).toLocaleString()}</p></div>
            </div>
            <button onClick={() => deleteData(db, "saed_centers", c.id)} className="absolute top-8 right-8 text-slate-100 group-hover:text-red-500 transition-all"><TrashIcon /></button>
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
      <div className="w-full lg:w-[380px] shrink-0 no-print">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-slate-200 lg:sticky lg:top-24">
          <h3 className="font-bold uppercase text-[10px] mb-6 text-slate-400 tracking-widest text-center">Status Registration</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "nysc_reports", { ...formData, lga }); setFormData({name:'',stateCode:'',category:ReportCategory.ABSCONDED,details:''}); }} className="space-y-4">
            <input required placeholder="FULL NAME" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <select className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold uppercase" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ReportCategory})}>
              {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea placeholder="INCIDENT DETAILS..." className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 h-32 text-xs" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-4 rounded-xl font-bold uppercase text-[10px] shadow tracking-widest border-b-4 border-emerald-900">Log Incident</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-6 content-start">
        {entries.map((e: any) => (
          <div key={e.id} className="bg-white p-8 rounded-2xl shadow-sm hover:shadow transition-all relative border border-slate-200 group animate-official overflow-hidden">
            <div className={`p-3 rounded-lg w-10 h-10 flex items-center justify-center mb-4 shadow-inner ${e.category === ReportCategory.DECEASED ? 'bg-black text-white' : 'bg-red-50 text-red-600'}`}>
              <AbscondedIcon />
            </div>
            <h4 className="text-lg font-black uppercase tracking-tight text-slate-800 font-serif-heading mb-1">{e.name}</h4>
            <p className="text-[11px] font-bold text-emerald-800 tracking-[0.2em] uppercase mb-6 opacity-60">{e.stateCode}</p>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6 shadow-inner"><p className="text-[13px] text-slate-600 italic font-medium leading-relaxed">"{e.details || 'No narrative provided.'}"</p></div>
            <div className="flex justify-between items-center border-t border-slate-100 pt-6">
               <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{e.category} | {String(e.lga).toUpperCase()}</span>
               <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="text-slate-200 group-hover:text-red-500 transition-all p-2"><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default App;

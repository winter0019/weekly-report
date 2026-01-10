
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
  StationDisposition,
  CIMDefaulterLog
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
  'CWHS': 'CW&HS',
  'CIM': 'CIM',
  'CDR': 'CD&R',
  'CDS': 'CD',
  'SAED': 'SAED'
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => window.localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => window.localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => window.localStorage.getItem('daura_lga') as DauraLga);
  const [ziStationFilter, setZiStationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [googleFormUrl, setGoogleFormUrl] = useState(() => window.localStorage.getItem('google_form_url') || '');
  
  const [division, setDivision] = useState<Division>('CIM');
  const [cwhsEntries, setCwhsEntries] = useState<CorpsMemberEntry[]>([]);
  const [cimEntries, setCimEntries] = useState<CIMClearance[]>([]);
  const [saedEntries, setSAEDEntries] = useState<SAEDCenter[]>([]);
  const [cdrEntries, setCdrEntries] = useState<CDRCase[]>([]);
  const [cdsGroups, setCdsGroups] = useState<CDSGroup[]>([]);
  const [cdsProjects, setCdsProjects] = useState<CDSPersonalProject[]>([]);
  const [stationDispositions, setStationDispositions] = useState<StationDisposition[]>([]);
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingLogin, setPendingLogin] = useState<any>(null);

  const dbRef = useRef<any>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

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
        } catch (err) { console.error("Sync error:", err); if (active) setIsDbLoaded(true); }
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
        return [
          item.name, item.cmName, item.groupName, item.projectName,
          item.stateCode, item.lga, (item as any).category, (item as any).ppa
        ].some(s => String(s || '').toLowerCase().includes(q));
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
          } else { window.alert("Invalid PIN."); }
        }} className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-xl space-y-8 animate-official border-[12px] border-emerald-950/10">
          <div className="text-center">
            <div className="w-20 h-20 bg-[#004d40] rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-2xl text-white font-serif-heading text-3xl font-black italic">NYSC</div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-1 font-serif-heading">Command Portal</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Administrative Terminal</p>
          </div>
          <div className="space-y-6">
            <select required className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold text-slate-900 outline-none text-sm" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Command Center...</option>
                <option value="ZI">Zonal Office (ZI)</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Station (LGI)</option>)}
            </select>
            <input type="password" required placeholder="PIN CODE" className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-3xl font-black tracking-[0.4em] outline-none" value={pin} onChange={e => setPin(e.target.value)} />
          </div>
          <button className="w-full bg-[#004d40] text-white p-6 rounded-3xl font-black uppercase shadow-2xl hover:bg-black transition-all text-sm tracking-widest border-b-8 border-emerald-950">Authenticate</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-inter pb-20 relative overflow-x-hidden">
      {/* Tab Navigation Matching High-Fi Design */}
      <nav className="fixed top-0 left-0 right-0 z-[100] pt-6 flex justify-center gap-2 no-print px-4 pointer-events-none">
        <div className="flex pointer-events-auto bg-white/40 backdrop-blur-xl p-2 rounded-[2.5rem] shadow-2xl border border-white/50">
          {(Object.keys(DIVISION_LABELS) as Division[]).map(id => (
            <button 
              key={id}
              onClick={() => setDivision(id)}
              className={`px-8 sm:px-14 py-3 rounded-full transition-all font-black uppercase text-[10px] tracking-widest ${division === id ? 'bg-[#004d40] text-white shadow-xl scale-105' : 'text-slate-500 hover:bg-white hover:text-[#004d40]'}`}
            >
              {DIVISION_LABELS[id]}
            </button>
          ))}
        </div>
      </nav>

      <div className="pt-28 px-4 sm:px-8 max-w-[1600px] mx-auto w-full">
        {/* Modern Header */}
        <header className="bg-[#004d40] text-white p-8 sm:p-10 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] rounded-[3rem] flex flex-col lg:flex-row items-center justify-between no-print border-b-[10px] border-black/10 gap-8 mb-12 animate-official relative overflow-hidden group">
          <div className="flex items-center gap-8 w-full lg:w-auto relative z-10">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center border border-white/10 shadow-2xl">
              <DashboardIcon />
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter font-serif-heading leading-none">NYSC DAURA COMMAND</h1>
              <p className="text-[10px] font-black text-emerald-400 tracking-[0.4em] uppercase mt-2 opacity-70 italic">KATSINA STATE SECRETARIAT PORTAL</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center lg:justify-end gap-6 w-full lg:w-auto relative z-10">
            <div className="bg-black/20 px-8 py-3 rounded-2xl border border-white/5 text-[11px] font-black uppercase tracking-[0.2em] shadow-inner">
              STATION: {userRole === 'LGI' ? String(lgaContext).toUpperCase() : 'ZONAL OFFICE'}
            </div>
            <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-3 px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl transition-all font-black uppercase text-[11px] tracking-widest shadow-xl">
              <DownloadIcon /> EXPORT
            </button>
            <button onClick={handleLogout} className="w-12 h-12 bg-red-600/30 hover:bg-red-600 rounded-2xl border border-white/10 transition-all flex items-center justify-center">
              <LogOutIcon />
            </button>
          </div>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>
        </header>

        {/* Global Search Bar */}
        <div className="mb-12 flex justify-center no-print px-4">
          <div className="bg-white p-3 rounded-[3rem] shadow-2xl w-full max-w-5xl border border-slate-100 flex items-center relative group focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all">
            <div className="ml-8 mr-6 text-slate-300 group-focus-within:text-emerald-500 transition-colors">
              <SearchIcon />
            </div>
            <input 
              type="text" 
              placeholder="SEARCH SECURE REGISTRY..." 
              className="bg-transparent p-5 rounded-[2rem] text-sm w-full outline-none font-bold uppercase tracking-widest placeholder:text-slate-300" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
            />
          </div>
        </div>

        {/* Dynamic Division Content */}
        <main className="flex flex-col lg:flex-row gap-10 pb-24">
          {!isDbLoaded ? (
            <div className="w-full flex flex-col items-center justify-center py-32 gap-6">
                <div className="w-16 h-16 border-[6px] border-slate-100 border-t-[#004d40] rounded-full animate-spin shadow-xl"></div>
                <p className="text-slate-400 font-black uppercase tracking-[0.6em] text-[11px]">Synchronizing Digital Command Hub...</p>
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

      {/* Modern Floating Action Menu */}
      <div className="fixed bottom-12 right-12 flex flex-col gap-5 no-print z-[200]">
        {[
          { icon: <FileTextIcon />, label: 'Forms', onClick: () => window.open(googleFormUrl || '#') },
          { icon: <DashboardIcon />, label: 'Ledger', onClick: () => setDivision('CIM') },
          { icon: <PlusIcon />, label: 'New', onClick: () => {} }
        ].map((btn, i) => (
          <button key={i} onClick={btn.onClick} className="w-16 h-16 bg-white text-slate-400 hover:bg-[#004d40] hover:text-white rounded-[1.8rem] shadow-[0_20px_50px_rgba(0,0,0,0.1)] border border-white transition-all flex items-center justify-center group relative overflow-hidden">
            <div className="relative z-10 transition-transform group-hover:scale-110">{btn.icon}</div>
            <div className="absolute inset-0 bg-emerald-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
            <span className="absolute right-20 bg-slate-900 text-white px-6 py-3 rounded-2xl text-[11px] font-black uppercase shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all tracking-widest translate-x-4 group-hover:translate-x-0">{btn.label}</span>
          </button>
        ))}
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
    } catch { window.alert("Failed."); }
  };

  const handleIssueQuery = async (cm: any) => {
    setIsGenerating(true);
    try {
      const ppaValue = cm.ppa || "Assigned Station: " + (cm.lga || lga);
      const content = await generateDisciplinaryQuery(cm.name, cm.code, cm.lga || lga, `Biometric Default (${cm.month})`, ppaValue);
      
      const payload = {
        name: cm.name, stateCode: cm.code, lga: cm.lga || lga, ppa: ppaValue,
        misconduct: `BIOMETRIC CLEARANCE DEFAULT - ${cm.month}`,
        dateOfInfraction: new Date().toISOString(), status: 'Pending' as CDRStatus,
        responseContent: content, month: cm.month
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
    const data = { month: formData.month, lga, maleCount: totalM, femaleCount: totalF, clearedCount: totalM+totalF, totalCMs: totalM+totalF+tempUnclearedList.length, unclearedList: tempUnclearedList, batchClearance: clearedBatches, dateAdded: new Date().toISOString() };
    await addData(db, "cim_clearance", data);
    setFormData({month:''}); setClearedBatches([]); setTempUnclearedList([]);
  };

  return (
    <>
      <div className="w-full lg:w-[450px] flex flex-col gap-10 no-print shrink-0">
        <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100">
          <h3 className="font-black uppercase text-[10px] mb-10 pb-4 border-b border-slate-50 text-slate-400 tracking-[0.5em] text-center">Batch Disposition Registry</h3>
          <div className="space-y-4 mb-10 max-h-[300px] overflow-auto pr-2 custom-scrollbar">
            {tempBatches.map((b, i) => (
              <div key={i} className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex justify-between items-center group hover:bg-white transition-all">
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase tracking-widest">{b.batch}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">M: {b.males} | F: {b.females}</p>
                </div>
                <button onClick={() => setTempBatches(tempBatches.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-500 transition-colors p-3"><TrashIcon /></button>
              </div>
            ))}
          </div>
          <div className="space-y-4 bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100">
             <input placeholder="BATCH NAME" className="w-full p-5 bg-white rounded-2xl border border-slate-100 text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-emerald-50" value={newBatch.batch} onChange={e => setNewBatch({...newBatch, batch: e.target.value.toUpperCase()})} />
             <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="M" className="p-5 bg-white rounded-2xl border border-slate-100 text-xs outline-none" value={newBatch.males || ''} onChange={e => setNewBatch({...newBatch, males: parseInt(e.target.value) || 0})} />
                <input type="number" placeholder="F" className="p-5 bg-white rounded-2xl border border-slate-100 text-xs outline-none" value={newBatch.females || ''} onChange={e => setNewBatch({...newBatch, females: parseInt(e.target.value) || 0})} />
             </div>
             <button onClick={() => { if(newBatch.batch) {setTempBatches([...tempBatches, newBatch]); setNewBatch({batch:'',males:0,females:0});} }} className="w-full py-5 bg-[#004d40] text-white rounded-2xl text-[10px] font-black uppercase shadow-xl tracking-widest active:scale-95 transition-all">Add Batch</button>
          </div>
          <button onClick={handleSaveStationDisposition} className="w-full mt-6 bg-emerald-700 text-white p-6 rounded-[2.5rem] font-black uppercase text-[11px] shadow-2xl tracking-[0.2em] border-b-8 border-emerald-950">Save Official Registry</button>
        </div>

        <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100">
          <h3 className="font-black uppercase text-[10px] mb-10 pb-4 border-b border-slate-50 text-slate-400 tracking-[0.5em] text-center">Monthly Audit Input</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <input required placeholder="AUDIT MONTH (e.g. JANUARY 2026)" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase outline-none focus:ring-4 focus:ring-emerald-50" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value.toUpperCase()})} />
            <div className="p-8 bg-emerald-50/40 rounded-[3rem] border border-emerald-100 space-y-4">
               <h4 className="text-[10px] font-black uppercase text-emerald-800 tracking-widest mb-2">Record Batch Clearance</h4>
               <select className="w-full p-5 bg-white rounded-2xl border border-slate-100 text-xs font-bold outline-none" onChange={e => setNewClearedBatch({...newClearedBatch, batch: e.target.value})} value={newClearedBatch.batch}>
                 <option value="">Select Batch...</option>
                 {tempBatches.map(b => <option key={b.batch} value={b.batch}>{b.batch}</option>)}
               </select>
               <div className="grid grid-cols-2 gap-4">
                  <input type="number" placeholder="M CLEARED" className="p-5 bg-white rounded-2xl border border-slate-100 text-xs outline-none" value={newClearedBatch.males || ''} onChange={e => setNewClearedBatch({...newClearedBatch, males: parseInt(e.target.value) || 0})} />
                  <input type="number" placeholder="F CLEARED" className="p-5 bg-white rounded-2xl border border-slate-100 text-xs outline-none" value={newClearedBatch.females || ''} onChange={e => setNewClearedBatch({...newClearedBatch, females: parseInt(e.target.value) || 0})} />
               </div>
               <button type="button" onClick={() => { if(newClearedBatch.batch) { setClearedBatches([...clearedBatches, newClearedBatch]); setNewClearedBatch({batch:'',males:0,females:0}); } }} className="w-full py-5 bg-[#004d40] text-white rounded-2xl text-[10px] font-black uppercase shadow-lg tracking-widest">Register Batch Results</button>
            </div>
            <div className="pt-4 space-y-4">
               <h4 className="text-[10px] font-black uppercase text-red-800 tracking-widest">Flag Defaulters</h4>
               <input placeholder="CM FULL NAME" className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs" value={unclearedInput.name} onChange={e => setUnclearedInput({...unclearedInput, name: e.target.value.toUpperCase()})} />
               <input placeholder="STATE CODE" className="w-full p-5 bg-slate-50 rounded-2xl border border-slate-100 text-xs" value={unclearedInput.code} onChange={e => setUnclearedInput({...unclearedInput, code: e.target.value.toUpperCase()})} />
               <button type="button" onClick={() => { if(unclearedInput.code) { setTempUnclearedList([...tempUnclearedList, {...unclearedInput, reason: 'Biometric Default'}]); setUnclearedInput({name:'',code:'',reason:'',ppa:''}); } }} className="w-full p-5 bg-red-50 text-red-700 border border-red-100 rounded-2xl text-[10px] font-black uppercase tracking-widest">Flag Personnel ({tempUnclearedList.length})</button>
            </div>
            <button className="w-full bg-[#004d40] text-white p-6 rounded-[2.5rem] font-black uppercase text-[11px] tracking-widest shadow-2xl border-b-8 border-emerald-950">Publish Final Audit</button>
          </form>
        </div>
      </div>

      <div className="flex-1 space-y-12">
        <div className="bg-[#004d40] p-16 rounded-[4rem] text-white shadow-2xl animate-official relative overflow-hidden group">
           <div className="flex flex-col md:flex-row justify-between items-center gap-12 relative z-10">
             <div className="flex items-baseline gap-8">
                <span className="text-9xl font-black tracking-tighter leading-none">{entries.length}</span>
                <div className="flex flex-col">
                  <span className="text-3xl font-black uppercase tracking-[0.5em] font-serif-heading">Audit</span>
                  <span className="text-xl font-black uppercase tracking-[0.8em] opacity-40">Periods</span>
                </div>
             </div>
             <button onClick={() => setIsLedgerOpen(true)} className="px-12 py-7 bg-white text-[#004d40] rounded-[3rem] font-black uppercase text-xs tracking-[0.3em] flex items-center gap-5 shadow-2xl hover:scale-105 transition-all active:scale-95">
               <FileTextIcon /> Clearance Action Ledger
             </button>
           </div>
           <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-white/5 rounded-full blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
        </div>

        <div className="space-y-10">
          {entries.map((e: CIMClearance) => (
            <div key={e.id} className="bg-white p-14 rounded-[5rem] border border-slate-100 flex flex-col md:flex-row justify-between items-center shadow-sm hover:shadow-2xl transition-all group gap-14 relative overflow-hidden">
               <div className="flex-1">
                 <h4 className="text-6xl font-black uppercase text-slate-800 font-serif-heading tracking-tighter mb-5 leading-none">{e.month}</h4>
                 <p className="text-[13px] font-black text-emerald-800 tracking-[0.6em] uppercase mb-5">{String(e.lga).toUpperCase()} STATION SUMMARY</p>
                 <p className="text-[11px] text-slate-300 font-bold uppercase tracking-widest">Logged: {new Date(e.dateAdded).toLocaleDateString()}</p>
               </div>
               <div className="flex flex-wrap gap-14 items-center justify-center md:justify-end">
                 <div className="text-center min-w-[140px]">
                   <span className="block text-7xl font-black text-emerald-600 leading-none mb-4">{e.clearedCount}</span>
                   <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">Cleared Successfully</span>
                   <p className="text-[9px] font-bold text-slate-300 mt-3 tracking-widest">M: {e.maleCount} | F: {e.femaleCount}</p>
                 </div>
                 <div className="text-center min-w-[140px]">
                   <span className="block text-7xl font-black text-red-600 leading-none mb-4">{e.unclearedList?.length || 0}</span>
                   <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">Flagged Defaulters</span>
                 </div>
                 <div className="flex flex-col gap-5 ml-8 no-print">
                   <button onClick={() => generateOfficialPDF(e, 'CIM_AUDIT')} className="w-16 h-16 flex items-center justify-center text-emerald-600 bg-emerald-50 rounded-[1.8rem] hover:bg-emerald-600 hover:text-white transition-all shadow-xl"><DownloadIcon /></button>
                   <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="w-16 h-16 flex items-center justify-center text-red-200 bg-red-50/30 rounded-[1.8rem] hover:bg-red-600 hover:text-white transition-all shadow-xl"><TrashIcon /></button>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>

      {isLedgerOpen && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-[2000] flex items-center justify-center p-4 animate-official">
          <div className="bg-white w-full max-w-7xl rounded-[6rem] shadow-2xl overflow-hidden flex flex-col h-[90vh] border-[20px] border-emerald-950/5 relative">
            <div className="bg-[#004d40] p-20 text-white flex justify-between items-center shrink-0">
               <div>
                 <h3 className="text-5xl font-black uppercase font-serif-heading tracking-tighter leading-none mb-5">Biometric Action Ledger</h3>
                 <p className="text-[13px] font-black uppercase tracking-[0.6em] opacity-40">Station Disciplinary Accountability Log</p>
               </div>
               <button onClick={() => setIsLedgerOpen(false)} className="w-24 h-24 bg-white/10 hover:bg-red-600 rounded-[3rem] flex items-center justify-center transition-all text-4xl font-black border border-white/10 shadow-2xl">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-20 custom-scrollbar">
               <table className="w-full border-separate border-spacing-y-10">
                  <thead>
                    <tr className="text-[14px] font-black uppercase text-slate-400 text-left tracking-[0.4em]"><th className="px-14 pb-8">Personnel Information</th><th className="px-14 pb-8">Assigned Station</th><th className="px-14 pb-8">Status & Directive</th></tr>
                  </thead>
                  <tbody>
                    {entries.reduce((acc: any[], entry: any) => [...acc, ...(entry.unclearedList || []).map((cm: any) => ({ ...cm, lga: entry.lga, month: entry.month }))], []).map((cm: any, idx: number) => (
                        <tr key={idx} className="bg-slate-50 hover:bg-white rounded-[5rem] transition-all shadow-sm hover:shadow-2xl group cursor-default">
                          <td className="px-14 py-14 rounded-l-[5rem]">
                            <p className="font-black uppercase text-slate-800 text-3xl mb-3 tracking-tighter font-serif-heading">{cm.name}</p>
                            <p className="text-[13px] font-black text-emerald-800 uppercase tracking-[0.3em]">{cm.code}</p>
                          </td>
                          <td className="px-14 py-14">
                            <span className="px-10 py-4 bg-white text-slate-900 rounded-full text-[13px] font-black uppercase border border-slate-100 shadow-sm tracking-[0.2em]">{cm.ppa || cm.lga}</span>
                          </td>
                          <td className="px-14 py-14 rounded-r-[5rem]">
                             <div className="flex items-center gap-8">
                               <button onClick={() => handleIssueQuery(cm)} disabled={isGenerating} className="px-12 py-5 bg-[#004d40] text-white text-[13px] font-black uppercase rounded-[2rem] shadow-2xl hover:bg-black transition-all disabled:opacity-50 tracking-widest">
                                 {isGenerating ? 'Processing...' : 'Generate Legal Query'}
                               </button>
                               <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Official Notice: Member ${cm.name} (${cm.code}) defaulted in ${cm.month} clearance.`)}`)} className="w-16 h-16 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-[1.5rem] hover:bg-emerald-600 hover:text-white transition-all shadow-xl"><WhatsAppIcon /></button>
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
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "cdr_cases", { ...formData, lga: lga || 'Daura', status: 'Pending' as CDRStatus });
    setFormData({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  };
  const handleStatusUpdate = async (id: string, status: CDRStatus) => { await updateData(db, "cdr_cases", id, { status }); };
  const handleMinuteUpdate = async (id: string, field: string, text: string) => { await updateData(db, "cdr_cases", id, { [field]: text }); };

  return (
    <>
      <div className="w-full lg:w-[450px] shrink-0 no-print">
        <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 lg:sticky lg:top-32">
          <h3 className="font-black uppercase text-[10px] mb-10 pb-4 border-b border-slate-50 text-slate-400 tracking-[0.5em] text-center">Log Official Misconduct</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <input required placeholder="PERSONNEL FULL NAME" className="w-full p-6 bg-slate-50 rounded-2xl font-bold uppercase border border-slate-100 text-xs outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-6 bg-slate-50 rounded-2xl font-bold uppercase border border-slate-100 text-xs outline-none" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <input required placeholder="PPA" className="w-full p-6 bg-slate-50 rounded-2xl font-bold uppercase border border-slate-100 text-xs outline-none" value={formData.ppa} onChange={e => setFormData({...formData, ppa: e.target.value.toUpperCase()})} />
            <textarea required placeholder="MISCONDUCT DESCRIPTION..." className="w-full p-6 bg-slate-50 rounded-2xl font-medium border border-slate-100 h-40 text-xs outline-none" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-7 rounded-[3rem] font-black uppercase shadow-2xl hover:bg-black transition-all text-[12px] border-b-8 border-emerald-950 tracking-[0.2em]">Log Case</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-12">
        {entries.map((cm: CDRCase) => (
          <div key={cm.id} className="bg-white p-14 rounded-[5rem] shadow-sm hover:shadow-2xl transition-all relative border border-slate-100 group animate-official overflow-hidden">
             <div className="absolute top-14 right-14 flex items-center gap-8 no-print">
                <span className={`px-8 py-4 rounded-full text-[11px] font-black uppercase border tracking-[0.4em] ${
                  cm.status === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                  cm.status === 'Responded' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                  cm.status === 'Forwarded_to_ZI' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                  cm.status === 'Minuted_to_CIM' ? 'bg-red-50 text-red-600 border-red-100' :
                  'bg-slate-900 text-white border-slate-950'
                }`}>{cm.status?.replace(/_/g, ' ') || 'Pending'}</span>
                <button onClick={() => deleteData(db, "cdr_cases", cm.id)} className="text-red-200 hover:text-red-500 transition-all"><TrashIcon /></button>
             </div>
             <div className="mb-12">
               <h4 className="text-5xl font-black uppercase font-serif-heading tracking-tighter text-slate-800 leading-none mb-4">{cm.name}</h4>
               <p className="text-2xl font-black text-emerald-800 uppercase tracking-[0.6em]">{cm.stateCode}</p>
             </div>
             
             <div className="p-12 bg-slate-50 rounded-[4rem] border border-slate-100 mb-12 shadow-inner">
                <p className="text-slate-700 text-xl font-medium leading-relaxed italic border-l-[10px] border-[#004d40] pl-10">"{cm.misconduct}"</p>
                {cm.ppa && <p className="mt-10 text-[12px] font-black text-slate-400 uppercase tracking-[0.5em]">STATIONED AT: {cm.ppa} ({String(cm.lga).toUpperCase()} UNIT)</p>}
             </div>

             {/* Dynamic Trail */}
             {(cm.lgiMinute || cm.ziMinute) && (
                <div className="mb-12 pl-12 border-l-[6px] border-slate-100 space-y-10 relative">
                   <p className="text-[11px] font-black text-slate-300 uppercase tracking-[0.6em] mb-6">Official Minute Trail</p>
                   {cm.lgiMinute && (
                      <div className="bg-blue-50/40 p-10 rounded-[3.5rem] border border-blue-100 relative">
                         <span className="absolute -left-[63px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-blue-500 border-[8px] border-white shadow-2xl"></span>
                         <p className="text-[12px] font-black text-blue-800 uppercase mb-4 tracking-[0.3em]">LGI Finding & Recommendation:</p>
                         <p className="text-base text-slate-600 italic leading-relaxed">"{cm.lgiMinute}"</p>
                      </div>
                   )}
                   {cm.ziMinute && (
                      <div className="bg-emerald-50/40 p-10 rounded-[3.5rem] border border-emerald-100 relative">
                         <span className="absolute -left-[63px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-emerald-500 border-[8px] border-white shadow-2xl"></span>
                         <p className="text-[12px] font-black text-emerald-800 uppercase mb-4 tracking-[0.3em]">Zonal Inspector Directive:</p>
                         <p className="text-base text-slate-600 italic leading-relaxed">"{cm.ziMinute}"</p>
                      </div>
                   )}
                </div>
             )}

             {/* Workflow Interface */}
             {userRole === 'LGI' && (cm.status === 'Pending' || cm.status === 'Responded') && (
               <div className="p-12 bg-blue-50/30 rounded-[4rem] border-2 border-blue-100 mb-12 animate-official">
                  <p className="text-[12px] font-black text-blue-800 uppercase tracking-[0.4em] mb-10">Administrative Minute (LGI)</p>
                  <textarea className="w-full p-10 bg-white rounded-[3rem] border border-blue-100 outline-none text-lg h-48 focus:ring-[16px] focus:ring-blue-50 transition-all" placeholder="Enter findings for ZI review..." defaultValue={cm.lgiMinute} onBlur={(e) => handleMinuteUpdate(cm.id, 'lgiMinute', e.target.value)} />
                  <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_ZI')} className="w-full py-7 mt-10 bg-blue-600 text-white rounded-[2.5rem] text-[13px] font-black uppercase shadow-2xl hover:bg-black transition-all tracking-[0.3em] border-b-8 border-blue-900">Forward Case to ZI Office</button>
               </div>
             )}

             {userRole === 'ZI' && cm.status === 'Forwarded_to_ZI' && (
               <div className="p-12 bg-emerald-50/30 rounded-[4rem] border-2 border-emerald-100 mb-12 animate-official">
                  <p className="text-[12px] font-black text-emerald-800 uppercase tracking-[0.4em] mb-10">Directive Minute (ZI)</p>
                  <textarea className="w-full p-10 bg-white rounded-[3rem] border border-emerald-100 outline-none text-lg h-48 focus:ring-[16px] focus:ring-emerald-50 transition-all" placeholder="Enter directive or recommendation for CIM..." defaultValue={cm.ziMinute} onBlur={(e) => handleMinuteUpdate(cm.id, 'ziMinute', e.target.value)} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-10">
                    <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_to_CIM')} className="py-7 bg-emerald-700 text-white rounded-[2.5rem] text-[12px] font-black uppercase shadow-2xl hover:bg-black transition-all tracking-widest border-b-8 border-emerald-950">Minute to CIM Desk</button>
                    <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_CDR')} className="py-7 bg-slate-900 text-white rounded-[2.5rem] text-[12px] font-black uppercase shadow-2xl hover:bg-emerald-600 transition-all tracking-widest border-b-8 border-black">Mark Case Closed</button>
                  </div>
               </div>
             )}

             <div className="flex justify-end items-center border-t border-slate-50 pt-12 gap-8 no-print">
               <button onClick={() => generateOfficialPDF(cm, 'CDR_CASE')} className="w-18 h-18 bg-white text-slate-400 rounded-3xl flex items-center justify-center hover:text-[#004d40] transition-all shadow-xl border border-slate-100"><DownloadIcon /></button>
               <button className="w-18 h-18 bg-emerald-50 text-emerald-700 rounded-3xl flex items-center justify-center hover:scale-110 transition-all shadow-xl border border-emerald-100" onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Case Update: ${cm.name} (${cm.stateCode}) status updated to ${cm.status}.`)}`)}><WhatsAppIcon /></button>
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
      <div className="w-full lg:w-[450px] flex flex-col gap-10 no-print shrink-0">
        <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100">
          <h3 className="font-black uppercase text-[10px] mb-10 pb-4 border-b border-slate-50 text-slate-400 tracking-[0.5em] text-center">New CDS Group</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_groups", { ...groupForm, lga }); setGroupForm({groupName:'',meetingDay:'Wednesday'}); }} className="space-y-6">
            <input required placeholder="GROUP NAME" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase outline-none" value={groupForm.groupName} onChange={e => setGroupForm({...groupForm, groupName: e.target.value.toUpperCase()})} />
            <select className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase outline-none" value={groupForm.meetingDay} onChange={e => setGroupForm({...groupForm, meetingDay: e.target.value})}>
              <option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option>
            </select>
            <button className="w-full bg-[#004d40] text-white p-6 rounded-[2.5rem] font-black uppercase text-[11px] shadow-2xl tracking-widest border-b-8 border-emerald-950">Create Unit</button>
          </form>
        </div>
        <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100">
          <h3 className="font-black uppercase text-[10px] mb-10 pb-4 border-b border-slate-50 text-slate-400 tracking-[0.5em] text-center">Personal Project Log</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_projects", { ...projectForm, lga }); setProjectForm({cmName:'',stateCode:'',projectName:'',description:'',status:'Ongoing'}); }} className="space-y-6">
            <input required placeholder="CM NAME" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase outline-none" value={projectForm.cmName} onChange={e => setProjectForm({...projectForm, cmName: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase outline-none" value={projectForm.stateCode} onChange={e => setProjectForm({...projectForm, stateCode: e.target.value.toUpperCase()})} />
            <input required placeholder="PROJECT TITLE" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase outline-none" value={projectForm.projectName} onChange={e => setProjectForm({...projectForm, projectName: e.target.value.toUpperCase()})} />
            <button className="w-full bg-emerald-700 text-white p-6 rounded-[2.5rem] font-black uppercase text-[11px] shadow-2xl tracking-widest border-b-8 border-emerald-950">Record Activity</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-10">
        {groups.map((g: any) => (
          <div key={g.id} className="bg-white p-12 rounded-[4rem] border border-slate-100 relative group animate-official hover:shadow-2xl transition-all h-fit">
            <div className="absolute left-0 top-0 w-4 h-full bg-[#004d40]"></div>
            <h4 className="text-3xl font-black uppercase tracking-tighter text-slate-800 font-serif-heading mb-3">{g.groupName}</h4>
            <div className="flex items-center gap-4 text-[11px] font-black text-emerald-800 tracking-[0.3em] uppercase">
              <span>{g.meetingDay}</span>
              <span className="w-2 h-2 rounded-full bg-slate-100"></span>
              <span>{g.lga}</span>
            </div>
            <button onClick={() => deleteData(db, "cds_groups", g.id)} className="absolute top-10 right-10 text-red-100 group-hover:text-red-500 transition-all"><TrashIcon /></button>
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
      <div className="w-full lg:w-[450px] flex flex-col gap-10 no-print shrink-0">
        <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100">
          <h3 className="font-black uppercase text-[10px] mb-10 pb-4 border-b border-slate-50 text-slate-400 tracking-[0.5em] text-center">SAED Hub Registry</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "saed_centers", { ...formData, lga }); setFormData({centerName:'',address:'',cmCount:0,fee:0}); }} className="space-y-6">
            <input required placeholder="HUB NAME" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase outline-none" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
            <input required placeholder="ADDRESS" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
            <div className="grid grid-cols-2 gap-4">
              <input type="number" placeholder="CENSUS" className="p-5 bg-white rounded-2xl border border-slate-100 text-xs" value={formData.cmCount || ''} onChange={e => setFormData({...formData, cmCount: parseInt(e.target.value) || 0})} />
              <input type="number" placeholder="FEE (₦)" className="p-5 bg-white rounded-2xl border border-slate-100 text-xs" value={formData.fee || ''} onChange={e => setFormData({...formData, fee: parseInt(e.target.value) || 0})} />
            </div>
            <button className="w-full bg-[#004d40] text-white p-7 rounded-[3rem] font-black uppercase text-[11px] tracking-widest shadow-2xl border-b-8 border-emerald-950">Confirm Hub</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-10">
        {entries.map((c: any) => (
          <div key={c.id} className="bg-white p-12 rounded-[5rem] shadow-sm border border-slate-100 relative group animate-official hover:shadow-2xl transition-all overflow-hidden h-fit">
            <div className="absolute top-0 left-0 w-4 h-full bg-[#004d40]"></div>
            <h4 className="text-3xl font-black uppercase tracking-tighter text-slate-800 font-serif-heading mb-2">{c.centerName}</h4>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-10">{c.address}</p>
            <div className="flex gap-10 pt-10 border-t border-slate-50">
               <div><p className="text-[10px] font-black uppercase text-slate-300 mb-2">Census</p><p className="text-3xl font-black text-[#004d40]">{c.cmCount}</p></div>
               <div><p className="text-[10px] font-black uppercase text-slate-300 mb-2">Revenue</p><p className="text-3xl font-black text-emerald-600">₦{Number(c.fee).toLocaleString()}</p></div>
            </div>
            <button onClick={() => deleteData(db, "saed_centers", c.id)} className="absolute top-12 right-12 text-red-100 group-hover:text-red-500 transition-all"><TrashIcon /></button>
          </div>
        ))}
      </div>
    </>
  );
};

/* --- CWHS Module Missing previously but needed for division toggle --- */
const CWHSModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.ABSCONDED, details: '' });
  return (
    <>
      <div className="w-full lg:w-[450px] shrink-0 no-print">
        <div className="bg-white p-10 rounded-[4rem] shadow-2xl border border-slate-100 lg:sticky lg:top-32">
          <h3 className="font-black uppercase text-[10px] mb-10 pb-4 border-b border-slate-50 text-slate-400 tracking-[0.5em] text-center">New Incident Log</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "nysc_reports", { ...formData, lga }); setFormData({name:'',stateCode:'',category:ReportCategory.ABSCONDED,details:''}); }} className="space-y-6">
            <input required placeholder="FULL NAME" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-bold uppercase" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <select className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-black uppercase" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ReportCategory})}>
              {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea placeholder="DETAILS..." className="w-full p-6 bg-slate-50 rounded-2xl border border-slate-100 h-32 text-xs" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-7 rounded-[3rem] font-black uppercase shadow-2xl tracking-widest border-b-8 border-emerald-950">Record Incident</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-10">
        {entries.map((e: any) => (
          <div key={e.id} className="bg-white p-12 rounded-[5rem] shadow-sm hover:shadow-2xl transition-all relative border border-slate-100 group animate-official overflow-hidden">
            <div className={`p-4 rounded-3xl w-16 h-16 flex items-center justify-center mb-8 shadow-inner ${e.category === ReportCategory.DECEASED ? 'bg-black text-white' : 'bg-red-50 text-red-600'}`}>
              <AbscondedIcon />
            </div>
            <h4 className="text-4xl font-black uppercase tracking-tighter text-slate-800 font-serif-heading mb-2">{e.name}</h4>
            <p className="text-xl font-black text-emerald-800 uppercase tracking-[0.4em] mb-10">{e.stateCode}</p>
            <div className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 mb-8"><p className="text-sm text-slate-600 italic leading-relaxed">"{e.details || 'No details.'}"</p></div>
            <div className="flex justify-between items-center border-t border-slate-50 pt-8">
               <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">{e.category} | {e.lga}</span>
               <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="text-red-100 group-hover:text-red-500 transition-all"><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default App;

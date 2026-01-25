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
  AppSettings,
  PersonnelEntry
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
const BATCHES = ['Batch A', 'Batch B', 'Batch C'];

const SECURITY_PINS: Record<string, string> = {
  'ZI': '0000', 'Daura': '1111', 'Baure': '2222', 'Zango': '3333', 'Sandamu': '4444', 
  'Mai’Adua': '5555', 'Mashi': '6666', 'Dutsi': '7777', 'Mani': '8888', 'Bindawa': '9999'
};

const DIVISION_LABELS: Record<Division, string> = {
  'CWHS': 'CW&HS', 'CIM': 'CIM', 'CDR': 'CD&R', 'CDS': 'CDS', 'SAED': 'SAED', 'PERSONNEL': 'FIND CORPS MEMBER'
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
  // Fix: Using (window as any).localStorage to avoid Property 'localStorage' does not exist on type 'Window'
  const [isAuthenticated, setIsAuthenticated] = useState(() => (window as any).localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => (window as any).localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => (window as any).localStorage.getItem('daura_lga') as DauraLga);
  const [searchQuery, setSearchQuery] = useState<string>('');
  // Fix: Using (window as any).localStorage to avoid Property 'localStorage' does not exist on type 'Window'
  const [division, setDivision] = useState<Division>(() => ((window as any).localStorage.getItem('last_div') as Division) || 'CIM');

  const [personnelRegistry, setPersonnelRegistry] = useState<PersonnelEntry[]>([]);
  const [cwhsEntries, setCwhsEntries] = useState<any[]>([]);
  const [cimEntries, setCimEntries] = useState<CIMClearance[]>([]);
  const [saedEntries, setSAEDEntries] = useState<SAEDCenter[]>([]);
  const [cdrEntries, setCdrEntries] = useState<CDRCase[]>([]);
  const [cdsGroups, setCdsGroups] = useState<CDSGroup[]>([]);
  const [cdsProjects, setCdsProjects] = useState<CDSPersonalProject[]>([]);
  const [stationDispositions, setStationDispositions] = useState<StationDisposition[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings[]>([]);
  
  const dbRef = useRef<any>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingLogin, setPendingLogin] = useState<any>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Fix: Using (window as any).localStorage to avoid Property 'localStorage' does not exist on type 'Window'
    (window as any).localStorage.setItem('last_div', division);
  }, [division]);

  useEffect(() => {
    if (isAuthenticated) {
      let active = true;
      const unsubs: (() => void)[] = [];
      const startServices = async () => {
        try {
          const db = initFirebase(firebaseConfig);
          dbRef.current = db;
          if (db) {
            unsubs.push(subscribeToCollection(db, "personnel_registry", (data) => active && setPersonnelRegistry(data)));
            unsubs.push(subscribeToCollection(db, "nysc_reports", (data) => active && setCwhsEntries(data)));
            unsubs.push(subscribeToCollection(db, "cim_clearance", (data) => active && setCimEntries(data)));
            unsubs.push(subscribeToCollection(db, "saed_centers", (data) => active && setSAEDEntries(data)));
            unsubs.push(subscribeToCollection(db, "cdr_cases", (data) => active && setCdrEntries(data)));
            unsubs.push(subscribeToCollection(db, "cds_groups", (data) => active && setCdsGroups(data)));
            unsubs.push(subscribeToCollection(db, "cds_projects", (data) => active && setCdsProjects(data)));
            unsubs.push(subscribeToCollection(db, "station_disposition", (data) => active && setStationDispositions(data)));
            unsubs.push(subscribeToCollection(db, "app_settings", (data) => active && setAppSettings(data)));
            setTimeout(() => { if (active) setIsDbLoaded(true); }, 800);
          }
        } catch (err) { console.error(err); if (active) setIsDbLoaded(true); }
      };
      startServices();
      return () => { active = false; unsubs.forEach(u => u()); };
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    // Fix: Using (window as any).localStorage and (window as any).location to avoid access errors
    (window as any).localStorage.clear();
    (window as any).location.reload();
  };

  const activeFormUrl = useMemo(() => appSettings[0]?.googleFormUrl || "https://docs.google.com/forms", [appSettings]);

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    
    const filterFn = (items: any[], category: string) => {
      let result = [...items];
      
      if (userRole === 'LGI' && lgaContext) {
        result = result.filter(item => 
          String(item.lga || '').trim().toLowerCase() === String(lgaContext).trim().toLowerCase()
        );
      }

      if (!q) return result;

      return result.filter(item => {
        let searchPool: string[] = [];
        
        if (category === 'personnel') {
          const surname = String(item.surname || '').toLowerCase();
          const othernames = String(item.othernames || '').toLowerCase();
          const combined = `${surname} ${othernames} ${surname}`.toLowerCase();
          const stateCode = String(item.stateCode || '').toLowerCase();
          
          if (combined.includes(q) || stateCode.includes(q)) return true;
          
          searchPool = [
            String(item.company || ''), 
            String(item.gsmNo || ''), 
            String(item.batch || ''),
            String(item.lga || ''), 
            String(item.stream || '')
          ];
        } else {
          searchPool = [
            String(item.surname || ''),
            String(item.othernames || ''),
            String(item.name || ''),
            String(item.stateCode || ''),
            String(item.ppa || ''),
            String(item.company || ''),
            String(item.misconduct || ''),
            String(item.lga || '')
          ];
        }
        
        return searchPool.some(s => s.toLowerCase().includes(q));
      });
    };

    return {
      personnel: filterFn(personnelRegistry, 'personnel'),
      cwhs: filterFn(cwhsEntries, 'cwhs'),
      cim: filterFn(cimEntries, 'cim'),
      saed: filterFn(saedEntries, 'saed'),
      cdr: filterFn(cdrEntries, 'cdr'),
      cdsGroups: filterFn(cdsGroups, 'cds'),
      cdsProjects: filterFn(cdsProjects, 'cds')
    };
  }, [personnelRegistry, cwhsEntries, cimEntries, saedEntries, cdrEntries, cdsGroups, cdsProjects, userRole, lgaContext, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={(e) => {
          e.preventDefault();
          const target = pendingLogin?.role === 'ZI' ? 'ZI' : pendingLogin?.lga;
          if (target && pin === SECURITY_PINS[target]) {
            setIsAuthenticated(true);
            setUserRole(pendingLogin.role);
            setLgaContext(pendingLogin.lga);
            // Fix: Using (window as any).localStorage to avoid access errors
            (window as any).localStorage.setItem('daura_auth', 'true');
            (window as any).localStorage.setItem('daura_role', pendingLogin.role);
            if (pendingLogin.lga) (window as any).localStorage.setItem('daura_lga', pendingLogin.lga);
          } else { 
            // Fix: Using (window as any).alert to avoid Property 'alert' does not exist on type 'Window'
            (window as any).alert("PIN Rejected."); 
          }
        }} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-6 animate-official">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#004d40] rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-serif-heading text-2xl font-black shadow-lg">NYSC</div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-widest">Access Terminal</h1>
          </div>
          <div className="space-y-3">
            <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 outline-none" onChange={e => {
                // Fix: Cast e.target to HTMLSelectElement
                const val = (e.target as HTMLSelectElement).value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Command...</option>
                <option value="ZI">Zonal Inspectorate (ZI)</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Unit (LGI)</option>)}
            </select>
            {/* Fix: Cast e.target to HTMLInputElement */}
            <input type="password" required placeholder="PIN" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-black tracking-[0.4em] outline-none" value={pin} onChange={e => setPin((e.target as HTMLInputElement).value)} />
          </div>
          <button className="w-full bg-[#004d40] text-white py-3.5 rounded-xl font-black uppercase tracking-widest text-[11px] shadow-lg shadow-emerald-900/10 active:scale-95 transition-all">Verify Terminal</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col pb-10">
      <div className="flex justify-center pt-6 no-print">
        <nav className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex items-center gap-1 overflow-x-auto custom-scrollbar">
          {(Object.keys(DIVISION_LABELS) as Division[]).map(id => (
            <button 
              key={id} 
              onClick={() => setDivision(id)} 
              className={`px-6 py-2.5 rounded-lg transition-all font-bold text-[11px] uppercase tracking-wider ${division === id ? 'bg-[#004d40] text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {DIVISION_LABELS[id]}
            </button>
          ))}
        </nav>
      </div>

      <div className="px-4 md:px-8 pt-4 no-print max-w-[1600px] mx-auto w-full">
        <header className="bg-[#004d40] text-white p-4 md:p-6 shadow-2xl rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4 border border-white/10 animate-official">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
              <DashboardIcon />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tighter leading-none mb-1">NYSC DAURA COMMAND</h1>
              <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest opacity-70">MASTER PORTAL HUB</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <a 
              href={activeFormUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border border-white/5 active:scale-95"
            >
              <PlusIcon /> SUBMIT REPORT
            </a>
            <div className="bg-black/20 px-4 py-2.5 rounded-xl flex items-center gap-3 border border-white/5">
               <span className="text-[10px] font-black uppercase tracking-widest">
                 {userRole === 'ZI' ? 'ZONAL HQ DASHBOARD' : `${lgaContext?.toUpperCase()} UNIT`}
               </span>
            </div>
            <button onClick={handleLogout} className="w-10 h-10 bg-red-500/20 hover:bg-red-500 text-white rounded-xl transition-all flex items-center justify-center border border-white/5">
              <LogOutIcon />
            </button>
            <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-xl flex items-center justify-center border border-white/5">
              <SpreadsheetIcon />
            </button>
          </div>
        </header>

        <div className="flex justify-center mt-8 animate-official">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex items-center px-6 py-4 w-full max-w-2xl group focus-within:shadow-md transition-all">
            <SearchIcon />
            {/* Fix: Cast e.target to HTMLInputElement */}
            <input 
              type="text" 
              placeholder="Search by Name, State Code, LGA, or Batch..." 
              className="bg-transparent ml-4 w-full outline-none text-[15px] font-medium text-slate-600 placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-10 px-4 md:px-8 max-w-[1600px] mx-auto w-full flex-1">
        <main className="flex flex-col gap-8">
          {!isDbLoaded ? (
            <div className="w-full flex flex-col items-center justify-center py-40 gap-6">
              <div className="w-14 h-14 border-4 border-slate-200 border-t-[#004d40] rounded-full animate-spin"></div>
              <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[11px]">Syncing master records...</p>
            </div>
          ) : (
            <>
              {division === 'PERSONNEL' && <FindCorpsMemberModule entries={filteredData.personnel} db={dbRef.current} userRole={userRole} lgaContext={lgaContext} isSearching={searchQuery.length > 0} />}
              {division === 'CIM' && <CIMModule entries={filteredData.cim} lga={lgaContext!} db={dbRef.current} userRole={userRole} stationDispositions={stationDispositions} />}
              {division === 'CWHS' && <CWHSModule entries={filteredData.cwhs} db={dbRef.current} userRole={userRole} lga={lgaContext!} />}
              {division === 'CDR' && <CDRModule entries={filteredData.cdr} lga={lgaContext!} db={dbRef.current} userRole={userRole} activeFormUrl={activeFormUrl} />}
              {division === 'CDS' && <CDSModule groups={filteredData.cdsGroups} projects={filteredData.cdsGroups} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
              {division === 'SAED' && <SAEDModule entries={filteredData.saed} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
            </>
          )}
        </main>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[3000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-10 animate-official border border-slate-100">
            <h3 className="text-lg font-black uppercase text-slate-800 mb-8 border-b border-slate-50 pb-6">Terminal Control</h3>
            <div className="space-y-8">
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase block mb-3 tracking-[0.2em]">Google Form Intake URL</label>
                  {/* Fix: Cast e.target to HTMLInputElement */}
                  <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 outline-none" value={activeFormUrl} onChange={async (e) => {
                      const newUrl = (e.target as HTMLInputElement).value;
                      if (appSettings[0]) await updateData(dbRef.current, "app_settings", appSettings[0].id, { googleFormUrl: newUrl });
                      else await addData(dbRef.current, "app_settings", { googleFormUrl: newUrl });
                    }} />
               </div>
               <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-[#004d40] text-white py-4 rounded-xl text-[11px] font-black uppercase tracking-[0.3em] active:scale-95 transition-all">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- FIND CORPS MEMBER Module --- */
const FindCorpsMemberModule = ({ entries, db, userRole, lgaContext, isSearching }: any) => {
  const [isUploading, setIsUploading] = useState(false);
  
  const [lgaFilter, setLgaFilter] = useState<DauraLga | ''>(userRole === 'LGI' ? lgaContext : '');
  const [batchFilter, setBatchFilter] = useState<string>('');

  const isSearchActive = useMemo(() => {
    if (isSearching) return true;
    if (batchFilter !== '') return true;
    if (userRole === 'ZI' && lgaFilter !== '') return true;
    return false;
  }, [isSearching, batchFilter, lgaFilter, userRole]);

  const [selectedUploadLga, setSelectedUploadLga] = useState<DauraLga | ''>('');
  const [selectedUploadBatch, setSelectedUploadBatch] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayedEntries = useMemo(() => {
    return entries.filter((p: PersonnelEntry) => {
      const matchLga = !lgaFilter || String(p.lga).toLowerCase() === String(lgaFilter).toLowerCase();
      const matchBatch = !batchFilter || String(p.batch).toLowerCase() === String(batchFilter).toLowerCase();
      return matchLga && matchBatch;
    });
  }, [entries, lgaFilter, batchFilter]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    // Fix: Cast event.target to HTMLInputElement to access files
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file || !selectedUploadLga || !selectedUploadBatch) {
      // Fix: Use (window as any).alert to avoid 'Cannot find name alert' error
      (window as any).alert("Please select LGA and Batch before uploading.");
      return;
    }
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        let successCount = 0;
        for (const row of lines.slice(1)) {
          const v = row.split(',').map(s => s.trim());
          if (v.length < 2) continue;
          await addData(db, "personnel_registry", { 
            stateCode: v[0] || 'N/A', 
            surname: v[1] || 'Unknown', 
            othernames: v[2] || '', 
            gender: v[3] || 'N/A', 
            gsmNo: v[4] || 'N/A', 
            company: v[5] || 'N/A', 
            stream: v[6] || 'N/A', 
            lga: selectedUploadLga, 
            batch: selectedUploadBatch 
          });
          successCount++;
        }
        // Fix: Use (window as any).alert to avoid 'Cannot find name alert' error
        (window as any).alert(`Successfully synced ${successCount} records to ${selectedUploadLga} Unit.`);
      } catch (err) { 
        // Fix: Use (window as any).alert to avoid 'Cannot find name alert' error
        (window as any).alert("Sync error."); 
      }
      finally { 
        setIsUploading(false); 
        // Fix: Cast to any to access value property if it fails on HTMLInputElement
        if (fileInputRef.current) (fileInputRef.current as any).value = ''; 
      }
    };
    reader.readAsText(file);
  };

  const handleShareDetails = (p: PersonnelEntry) => {
    const summary = `NYSC Personnel Profile:\nNAME: ${p.surname} ${p.othernames}\nCODE: ${p.stateCode}\nLGA: ${p.lga}\nPPA: ${p.company}\nBATCH: ${p.batch}\nSTREAM: ${p.stream}\nPHONE: ${p.gsmNo || 'N/A'}`;
    shareData(`Personnel: ${p.surname}`, summary);
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-official min-h-[500px]">
      <div className="flex flex-col gap-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="shrink-0">
            <h2 className="text-[18px] font-black uppercase text-slate-800 tracking-tight">Personnel Search Terminal</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {userRole === 'ZI' ? 'Cross-Station Zonal Query' : `Unit Query: ${lgaContext}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             {isSearchActive && (
               <button onClick={() => downloadCSV(displayedEntries, `${userRole}_Filtered_Registry`)} className="px-4 py-2.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase border border-blue-100 flex items-center gap-2 hover:bg-blue-100 transition-all">
                 <DownloadIcon /> Export CSV
               </button>
             )}

             {userRole === 'ZI' && (
               <div className="flex flex-col sm:flex-row items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                 <select 
                   className="w-full sm:w-32 p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none"
                   value={selectedUploadLga}
                   // Fix: Cast e.target to HTMLSelectElement
                   onChange={e => setSelectedUploadLga((e.target as HTMLSelectElement).value as DauraLga)}
                 >
                   <option value="">Upload LGA...</option>
                   {LGAS.map(l => <option key={l} value={l}>{l}</option>)}
                 </select>
                 <select 
                   className="w-full sm:w-32 p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none"
                   value={selectedUploadBatch}
                   // Fix: Cast e.target to HTMLSelectElement
                   onChange={e => setSelectedUploadBatch((e.target as HTMLSelectElement).value)}
                 >
                   <option value="">Upload Batch...</option>
                   {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
                 </select>
                 <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                 <button 
                   // Fix: Cast fileInputRef.current to any to access click() if strictly typed otherwise
                   onClick={() => (fileInputRef.current as any)?.click()} 
                   disabled={isUploading || !selectedUploadLga || !selectedUploadBatch} 
                   className={`px-4 py-2 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all ${(!selectedUploadLga || !selectedUploadBatch) ? 'bg-slate-300' : 'bg-[#004d40]'}`}
                 >
                   <SpreadsheetIcon /> Master Sync
                 </button>
               </div>
             )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-slate-50">
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">
             <SearchIcon /> <span>Refine Search:</span>
           </div>
           
           <div className="flex items-center gap-2">
             <label className="text-[9px] font-black text-slate-300 uppercase">LGA</label>
             <select 
               className={`p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none hover:bg-white transition-colors min-w-[120px] ${userRole === 'LGI' ? 'opacity-60 cursor-not-allowed' : ''}`}
               value={lgaFilter}
               // Fix: Cast e.target to HTMLSelectElement
               onChange={e => setLgaFilter((e.target as HTMLSelectElement).value as DauraLga)}
               disabled={userRole === 'LGI'}
             >
               <option value="">All LGAs</option>
               {LGAS.map(l => <option key={l} value={l}>{l}</option>)}
             </select>
           </div>

           <div className="flex items-center gap-2">
             <label className="text-[9px] font-black text-slate-300 uppercase">Batch</label>
             <select 
               className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-700 outline-none hover:bg-white transition-colors min-w-[120px]"
               value={batchFilter}
               // Fix: Cast e.target to HTMLSelectElement
               onChange={e => setBatchFilter((e.target as HTMLSelectElement).value)}
             >
               <option value="">All Batches</option>
               {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
             </select>
           </div>

           {(batchFilter || (userRole === 'ZI' && lgaFilter !== '')) && (
             <button 
               onClick={() => {
                 if (userRole === 'ZI') setLgaFilter('');
                 setBatchFilter('');
               }} 
               className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline px-2"
             >
               Clear filters
             </button>
           )}

           <div className="ml-auto flex items-center gap-3">
             {isSearchActive && (
               <div className="px-3 py-1.5 bg-emerald-50 text-[#004d40] rounded-full text-[10px] font-black border border-emerald-100">
                 {displayedEntries.length} Records Found
               </div>
             )}
           </div>
        </div>
      </div>

      {!isSearchActive ? (
        <div className="flex-1 flex flex-col items-center justify-center py-44 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-inner">
           <SearchIcon />
           <p className="text-slate-400 text-[12px] font-medium mt-4 uppercase tracking-[0.2em]">
             Enter Name/Code or apply filters to retrieve personnel records
           </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedEntries.map((p: PersonnelEntry) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 hover:shadow-lg transition-all group animate-official relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#004d40] opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="mb-6 flex justify-between items-start">
                <span className="bg-emerald-50 text-[#004d40] text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100">
                  {p.batch || 'N/A'} • {p.stream || 'N/A'}
                </span>
                <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md">
                  {p.lga || 'N/A'} UNIT
                </span>
              </div>
              <h4 className="text-[20px] font-black uppercase text-slate-800 leading-tight mb-1">
                {p.surname || '---'}, {p.othernames || '---'}
              </h4>
              <p className="text-[12px] font-black text-[#004d40] uppercase tracking-[0.3em] mb-6">
                {p.stateCode || '---'}
              </p>
              <div className="space-y-4 pt-6 border-t border-slate-50">
                <div className="flex items-center gap-3 text-[12px]">
                  <DashboardIcon />
                  <span className="font-bold text-slate-600 uppercase">{p.lga || 'N/A'} UNIT COMMAND</span>
                </div>
                <div className="flex items-center gap-3 text-[12px]">
                  <FileTextIcon />
                  <span className="font-bold text-slate-600 uppercase truncate" title={p.company || 'PPA'}>
                    {p.company || 'PPA NOT RECORDED'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[12px] font-bold text-emerald-600">
                  <WhatsAppIcon />{p.gsmNo || 'PHONE N/A'}
                </div>
              </div>
              <div className="mt-8 flex gap-3 pt-6 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button 
                  onClick={() => handleShareDetails(p)} 
                  className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all active:scale-95"
                 >
                   RETRIVE & SHARE
                 </button>
                 {userRole === 'ZI' && (
                   <button 
                    onClick={() => deleteData(db, "personnel_registry", p.id)} 
                    className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95"
                   >
                     <TrashIcon />
                   </button>
                 )}
              </div>
            </div>
          ))}
          {displayedEntries.length === 0 && (
            <div className="col-span-full py-24 text-center bg-white rounded-xl border border-slate-100 shadow-inner">
              <p className="text-slate-300 uppercase font-black text-[11px] tracking-widest mb-2">No matching personnel records found</p>
              <p className="text-slate-400 text-[10px]">Try adjusting your search query or filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* --- CIM Module --- */
const CIMModule = ({ entries, db, lga, userRole, stationDispositions }: any) => {
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const currentStationDisp = stationDispositions.find((d: any) => String(d.lga || '').toLowerCase() === String(lga || '').toLowerCase());
  const [tempBatches, setTempBatches] = useState<CIMBatchDisposition[]>([]);
  const [newBatch, setNewBatch] = useState({ batch: '', males: 0, females: 0 });
  const [formData, setFormData] = useState({ month: '' });
  const [clearedBatches, setClearedBatches] = useState<CIMBatchDisposition[]>([]);
  const [newClearedBatch, setNewClearedBatch] = useState({ batch: '', males: 0, females: 0 });
  const [tempUnclearedList, setTempUnclearedList] = useState<{name: string, code: string, ppa: string, gsmNo: string, reason: string, gender: 'Male' | 'Female'}[]>([]);
  const [newDefaulter, setNewDefaulter] = useState({ name: '', code: '', ppa: '', gsmNo: '', reason: 'BIOMETRIC DEFAULT', gender: 'Male' as 'Male' | 'Female' });
  
  const [isGeneratingQuery, setIsGeneratingQuery] = useState<string | null>(null);

  useEffect(() => {
    if (currentStationDisp?.batches) setTempBatches(currentStationDisp.batches);
    else setTempBatches([]);
  }, [currentStationDisp]);

  const stationDefaulters = useMemo(() => {
    const all: any[] = [];
    entries.forEach((e: any) => {
      if (e.unclearedList) {
        e.unclearedList.forEach((u: any) => all.push({ ...u, auditMonth: e.month }));
      }
    });
    return all;
  }, [entries]);

  const handleSaveStationDisposition = async () => {
    const data = { lga, batches: tempBatches, totalMales: tempBatches.reduce((a,b)=>a+(b.males||0),0), totalFemales: tempBatches.reduce((a,b)=>a+(b.females||0),0), lastUpdated: new Date().toISOString() };
    if (currentStationDisp) await updateData(db, "station_disposition", currentStationDisp.id, data);
    else await addData(db, "station_disposition", data);
    // Fix: Using (window as any).alert to avoid access errors
    (window as any).alert("Population metrics synchronized.");
  };

  const handleSubmitAudit = async (e: any) => {
    e.preventDefault();
    // Fix: Using (window as any).alert to avoid 'Cannot find name alert' error
    if (!formData.month) return (window as any).alert("Select audit month.");
    const totalM = clearedBatches.reduce((a,b)=>a+(b.males||0),0);
    const totalF = clearedBatches.reduce((a,b)=>a+(b.females||0),0);
    const data = { 
      month: formData.month, 
      lga, 
      maleCount: totalM, 
      femaleCount: totalF, 
      clearedCount: totalM + totalF, 
      totalCMs: totalM + totalF + tempUnclearedList.length, 
      unclearedList: tempUnclearedList.map(u => ({...u, month: formData.month})), 
      batchClearance: clearedBatches, 
      dateAdded: new Date().toISOString() 
    };
    await addData(db, "cim_clearance", data);
    setFormData({month:''}); setClearedBatches([]); setTempUnclearedList([]);
    // Fix: Using (window as any).alert to avoid access errors
    (window as any).alert("Audit record published.");
  };

  const handleQuickGenerateQuery = async (def: any) => {
    setIsGeneratingQuery(def.code);
    try {
      const narrative = await generateDisciplinaryQuery(
        def.name, 
        def.code, 
        lga, 
        def.reason || 'Biometric clearance default', 
        def.ppa || 'N/A'
      );
      generateOfficialPDF({ 
        ...def, 
        lga, 
        letterText: narrative, 
        month: def.auditMonth 
      }, 'DISCIPLINARY_QUERY');
    } catch (err) {
      // Fix: Using (window as any).alert to avoid 'Cannot find name alert' error
      (window as any).alert("AI Generation failed. Exporting standard query.");
      generateOfficialPDF({ ...def, lga, month: def.auditMonth }, 'DISCIPLINARY_QUERY');
    } finally {
      setIsGeneratingQuery(null);
    }
  };

  const zonalStats = useMemo(() => {
    const totalPopM = stationDispositions.reduce((acc: number, d: any) => acc + (d.totalMales || 0), 0);
    const totalPopF = stationDispositions.reduce((acc: number, d: any) => acc + (d.totalFemales || 0), 0);
    const totalCleared = entries.reduce((acc: number, e: any) => acc + (e.clearedCount || 0), 0);
    const totalDefaulters = entries.reduce((acc: number, e: any) => acc + (e.unclearedList?.length || 0), 0);
    const reportingCount = new Set(entries.map((e: any) => e.lga)).size;
    return {
      totalPopM, totalPopF, totalCleared, totalDefaulters, reportingCount
    };
  }, [stationDispositions, entries]);

  if (userRole === 'ZI') {
    return (
      <div className="w-full flex flex-col gap-10 animate-official">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#0f172a] rounded-xl shadow-lg p-8 text-white relative overflow-hidden group">
            <div className="z-10 relative">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-4 opacity-80">ZONAL POPULATION HUB</h3>
              <div className="flex items-center gap-6">
                <span className="text-5xl font-black font-serif-heading leading-none">{zonalStats.totalPopM + zonalStats.totalPopF}</span>
                <div className="h-10 w-px bg-white/10"></div>
                <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Males: {zonalStats.totalPopM}</p>
                   <p className="text-[9px] font-bold text-pink-400 uppercase tracking-widest">Females: {zonalStats.totalPopF}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 flex flex-col justify-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">TOTAL CLEARED</h3>
            <span className="text-5xl font-black text-emerald-600 font-serif-heading leading-none">{zonalStats.totalCleared}</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 flex flex-col justify-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">BIOMETRIC DEFAULTERS</h3>
            <span className="text-5xl font-black text-red-500 font-serif-heading leading-none">{zonalStats.totalDefaulters}</span>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 flex flex-col justify-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">REPORTING STATIONS</h3>
            <span className="text-5xl font-black text-slate-800 font-serif-heading leading-none">{zonalStats.reportingCount} / 9</span>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-official">
           <div className="bg-[#004d40] p-6 flex justify-between items-center text-white">
              <h2 className="text-[12px] font-black uppercase tracking-[0.2em]">GLOBAL AUDIT LEDGER</h2>
              <div className="flex items-center gap-4">
                 <button onClick={() => downloadCSV(entries, "Global_CIM_Audit")} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-all"><DownloadIcon /></button>
                 <button onClick={() => setIsLedgerOpen(true)} className="px-4 py-2 bg-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg">DEFAULTER REGISTRY</button>
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                    <tr>
                       <th className="p-6">STATION</th>
                       <th className="p-6">POPULATION (M/F)</th>
                       <th className="p-6">LATEST AUDIT</th>
                       <th className="p-6">CLEARED</th>
                       <th className="p-6">DEFAULTERS</th>
                       <th className="p-6">ZI INSTRUCTION</th>
                       <th className="p-6 text-right">ACTIONS</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50">
                    {LGAS.map(stationName => {
                       const lgaDisp = stationDispositions.find((d: any) => String(d.lga || '').toLowerCase() === String(stationName).toLowerCase());
                       const latestAudit = entries.filter((e: any) => String(e.lga || '').toLowerCase() === String(stationName).toLowerCase())[0];
                       return (
                         <tr key={stationName} className="hover:bg-slate-50/50 transition-all group">
                            <td className="p-6 font-black text-slate-800">{stationName}</td>
                            <td className="p-6">
                               {lgaDisp ? <p className="text-[11px] font-bold">M: {lgaDisp.totalMales || 0} F: {lgaDisp.totalFemales || 0}</p> : '--'}
                            </td>
                            <td className="p-6 text-[11px] font-black text-slate-500">{latestAudit?.month || '---'}</td>
                            <td className="p-6 text-emerald-600 font-black">{latestAudit?.clearedCount || 0}</td>
                            <td className="p-6 text-red-500 font-black">{latestAudit?.unclearedList?.length || 0}</td>
                            <td className="p-6">
                               <textarea 
                                 className="w-full bg-slate-50 border rounded p-2 text-[10px] h-10 outline-none"
                                 placeholder="Minute directive..."
                                 defaultValue={latestAudit?.ziMinute}
                                 onBlur={async (e) => {
                                   // Fix: Cast e.target to HTMLTextAreaElement
                                   if (latestAudit) await updateData(db, "cim_clearance", latestAudit.id, { ziMinute: (e.target as HTMLTextAreaElement).value });
                                 }}
                               />
                            </td>
                            <td className="p-6 text-right">
                               <div className="flex gap-4 justify-end">
                                  <button onClick={() => latestAudit && generateOfficialPDF(latestAudit, 'CIM_AUDIT')}><DownloadIcon /></button>
                                  <button onClick={() => latestAudit && shareData(`Audit: ${latestAudit.month}`, latestAudit.lga)}><ShareIcon /></button>
                               </div>
                            </td>
                         </tr>
                       );
                    })}
                 </tbody>
              </table>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-official items-start">
      <div className="w-full lg:w-[350px] flex flex-col gap-6 no-print shrink-0">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold uppercase text-[9px] mb-6 text-slate-400 text-center tracking-widest">STATION POPULATION</h3>
          <div className="space-y-2 mb-6">
            {tempBatches.map((b, i) => (
              <div key={i} className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center group">
                <div>
                   <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-1">{b.batch || 'UNNAMED'}</p>
                   <p className="text-[9px] font-bold text-slate-400 uppercase">M: {b.males || 0} | F: {b.females || 0}</p>
                </div>
                <button onClick={() => setTempBatches(tempBatches.filter((_, idx) => idx !== i))} className="text-red-200 hover:text-red-500 transition-colors"><TrashIcon /></button>
              </div>
            ))}
          </div>
          <div className="space-y-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100 mb-4">
             {/* Fix: Cast e.target to HTMLInputElement */}
             <input placeholder="BATCH NAME" className="w-full p-3 bg-white rounded-lg border border-slate-200 text-[11px] font-black uppercase outline-none" value={newBatch.batch} onChange={e => setNewBatch({...newBatch, batch: (e.target as HTMLInputElement).value.toUpperCase()})} />
             <div className="grid grid-cols-2 gap-3">
                {/* Fix: Cast e.target to HTMLInputElement */}
                <input type="number" placeholder="Males" className="p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-bold outline-none" value={newBatch.males || ''} onChange={e => setNewBatch({...newBatch, males: parseInt((e.target as HTMLInputElement).value) || 0})} />
                <input type="number" placeholder="Females" className="p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-bold outline-none" value={newBatch.females || ''} onChange={e => setNewBatch({...newBatch, females: parseInt((e.target as HTMLInputElement).value) || 0})} />
             </div>
             <button onClick={() => { if(newBatch.batch) {setTempBatches([...tempBatches, newBatch]); setNewBatch({batch:'',males:0,females:0});} }} className="w-full py-3 bg-[#004d40] text-white rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2"><PlusIcon /> Add Batch</button>
          </div>
          <button onClick={handleSaveStationDisposition} className="w-full py-3.5 bg-[#00695c] text-white rounded-lg font-black uppercase text-[10px] tracking-wider shadow-lg active:scale-95 transition-all">Synchronize Units</button>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold uppercase text-[9px] mb-6 text-slate-400 text-center tracking-widest">MONTHLY AUDIT LOG</h3>
          <form onSubmit={handleSubmitAudit} className="space-y-6">
            {/* Fix: Cast e.target to HTMLInputElement */}
            <input required placeholder="MONTH & YEAR" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:bg-white transition-all text-center" value={formData.month} onChange={e => setFormData({...formData, month: (e.target as HTMLInputElement).value.toUpperCase()})} />
            <div className="p-5 bg-emerald-50/20 rounded-xl border border-emerald-100/30 space-y-4">
               <label className="text-[9px] font-black uppercase text-emerald-800 block mb-1">1. AUDIT CLEARED COUNT</label>
               {/* Fix: Cast e.target to HTMLSelectElement */}
               <select className="w-full p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-black uppercase outline-none" onChange={e => setNewClearedBatch({...newClearedBatch, batch: (e.target as HTMLSelectElement).value})} value={newClearedBatch.batch}>
                 <option value="">SELECT BATCH...</option>
                 {tempBatches.map(b => <option key={b.batch} value={b.batch}>{b.batch}</option>)}
               </select>
               <div className="grid grid-cols-2 gap-3">
                  {/* Fix: Cast e.target to HTMLInputElement */}
                  <input type="number" placeholder="Males" className="p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-bold outline-none" value={newClearedBatch.males || ''} onChange={e => setNewClearedBatch({...newClearedBatch, males: parseInt((e.target as HTMLInputElement).value) || 0})} />
                  <input type="number" placeholder="Females" className="p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-bold outline-none" value={newClearedBatch.females || ''} onChange={e => setNewClearedBatch({...newClearedBatch, females: parseInt((e.target as HTMLInputElement).value) || 0})} />
               </div>
               <button type="button" onClick={() => { if(newClearedBatch.batch) { setClearedBatches([...clearedBatches, newClearedBatch]); setNewClearedBatch({batch:'',males:0,females:0}); } }} className="w-full py-2.5 bg-[#004d40] text-white rounded-lg text-[9px] font-black uppercase active:scale-95">Include Batch</button>
            </div>
            <div className="p-5 bg-red-50/20 rounded-xl border border-red-100/30 space-y-4">
               <label className="text-[9px] font-black uppercase text-red-800 block mb-1">2. REGISTER DEFAULTER</label>
               {/* Fix: Cast e.target to HTMLInputElement */}
               <input placeholder="CORPS MEMBER NAME" className="w-full p-3.5 bg-white border border-slate-200 rounded-lg text-[11px] uppercase font-black outline-none" value={newDefaulter.name} onChange={e => setNewDefaulter({...newDefaulter, name: (e.target as HTMLInputElement).value.toUpperCase()})} />
               <input placeholder="STATE CODE" className="w-full p-3.5 bg-white border border-slate-200 rounded-lg text-[11px] uppercase font-black outline-none" value={newDefaulter.code} onChange={e => setNewDefaulter({...newDefaulter, code: (e.target as HTMLInputElement).value.toUpperCase()})} />
               <input placeholder="PPA" className="w-full p-3.5 bg-white border border-slate-200 rounded-lg text-[11px] uppercase font-black outline-none" value={newDefaulter.ppa} onChange={e => setNewDefaulter({...newDefaulter, ppa: (e.target as HTMLInputElement).value.toUpperCase()})} />
               <button type="button" onClick={() => { if(newDefaulter.name && newDefaulter.code) { setTempUnclearedList([...tempUnclearedList, newDefaulter]); setNewDefaulter({ name: '', code: '', ppa: '', gsmNo: '', reason: 'BIOMETRIC DEFAULT', gender: 'Male' }); } }} className="w-full py-3 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-red-900/10 active:scale-95 transition-all">Flag Member</button>
            </div>
            <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-wider shadow-xl active:scale-95 transition-all">Publish Audit Report</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-8 w-full">
        {/* STATION STATISTICS BAR MATCHING IMAGE */}
        <div className="bg-[#0f172a] rounded-xl shadow-2xl p-8 text-white flex flex-col md:flex-row justify-between items-center border border-white/5 relative overflow-hidden animate-official">
           <div className="mb-6 md:mb-0 z-10 text-center md:text-left">
              <h2 className="text-[9px] font-black uppercase tracking-[0.2em] text-[#10b981] mb-5">LOCAL STATION BIOMETRIC STATISTICS</h2>
              <div className="flex items-center gap-4 justify-center md:justify-start">
                <span className="text-6xl font-black font-serif-heading">{(currentStationDisp?.totalMales + currentStationDisp?.totalFemales || 0)}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">REGISTERED<br/>CORPS MEMBERS</span>
              </div>
           </div>
           
           <div className="flex flex-wrap items-center gap-8 z-10">
              <div className="flex gap-10">
                <div className="text-center">
                  <p className="text-[9px] font-black uppercase text-slate-500 mb-2 tracking-widest">MALES</p>
                  <p className="text-4xl font-black text-blue-400">{(currentStationDisp?.totalMales || 0)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black uppercase text-slate-500 mb-2 tracking-widest">FEMALES</p>
                  <p className="text-4xl font-black text-pink-400">{(currentStationDisp?.totalFemales || 0)}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                 <button className="w-12 h-12 bg-white/5 hover:bg-white/10 text-white rounded-xl flex items-center justify-center transition-all">
                    <SpreadsheetIcon />
                 </button>
                 <button 
                  onClick={() => setIsLedgerOpen(true)}
                  className="bg-[#10b981] hover:bg-[#059669] text-white px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                 >
                   DEFAULTER LOGS
                 </button>
              </div>
           </div>
        </div>

        <div>
           <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest px-1">SUBMITTED MONTHLY AUDITS</h3>
           <div className="space-y-6">
            {entries.length === 0 ? (
              <div className="py-20 text-center bg-white rounded-xl border border-slate-100"><p className="text-slate-300 uppercase font-black text-[11px] tracking-widest">No submitted audits yet.</p></div>
            ) : entries.map((e: CIMClearance) => (
              <div key={e.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-official group hover:shadow-md transition-all duration-300">
                 <div className="p-8 pb-4 flex justify-between items-start">
                   <div>
                     <h4 className="text-[20px] font-black uppercase text-slate-800 tracking-tight leading-none mb-1.5">{e.month || '---'}</h4>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">AUDIT RECORD • {new Date(e.dateAdded).toLocaleDateString()}</p>
                   </div>
                   <div className="flex gap-8">
                     <div className="text-center">
                       <p className="text-[18px] font-black text-emerald-600 leading-none">{e.clearedCount || 0}</p>
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">CLEARED</p>
                     </div>
                     <div className="text-center">
                       <p className="text-[18px] font-black text-red-500 leading-none">{e.unclearedList?.length || 0}</p>
                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">FLAGGED</p>
                     </div>
                   </div>
                 </div>

                 {e.ziMinute && (
                   <div className="mx-8 mb-8 p-6 bg-[#f0f9f6] rounded-xl border border-emerald-100/50">
                      <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-2">ZONAL HQ DIRECTIVE:</p>
                      <p className="text-[14px] text-slate-600 italic font-medium leading-relaxed">"{e.ziMinute}"</p>
                   </div>
                 )}

                 <div className="px-8 pb-8 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button onClick={() => shareData(`Audit ${e.month}`, `Station: ${e.lga}\nCleared: ${e.clearedCount}\nFlagged: ${e.unclearedList?.length}`)} className="p-2 text-slate-400 hover:text-blue-500 transition-colors"><ShareIcon /></button>
                   <button onClick={() => generateOfficialPDF(e, 'CIM_AUDIT')} className="p-2 text-slate-400 hover:text-[#004d40] transition-colors"><DownloadIcon /></button>
                 </div>
              </div>
            ))}
           </div>
        </div>
      </div>

      {/* DEFAULTER REGISTRY MODAL FOR LGI TO GENERATE QUERIES */}
      {isLedgerOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl z-[4000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden animate-official flex flex-col max-h-[85vh]">
            <div className="bg-[#0f172a] p-8 text-white flex justify-between items-center shrink-0">
               <div>
                 <h2 className="text-[14px] font-black uppercase tracking-[0.2em] mb-1">STATION DEFAULTER REGISTRY</h2>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Official Disciplinary Management Log</p>
               </div>
               <button onClick={() => setIsLedgerOpen(false)} className="w-12 h-12 bg-white/10 hover:bg-red-500 rounded-full transition-all flex items-center justify-center">
                 <LogOutIcon />
               </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {stationDefaulters.length === 0 ? (
                <div className="py-20 text-center">
                   <FileTextIcon />
                   <p className="mt-4 text-slate-400 font-black text-[11px] uppercase tracking-widest">No disciplinary flags found for this station.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {stationDefaulters.map((def, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-100 p-6 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-emerald-200 transition-all group">
                       <div>
                          <p className="text-[14px] font-black text-slate-800 uppercase mb-1">{def.name}</p>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[11px] font-bold text-[#004d40] tracking-widest bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{def.code}</span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{def.auditMonth} AUDIT</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-4 w-full md:w-auto shrink-0">
                          <button 
                            disabled={isGeneratingQuery === def.code}
                            onClick={() => handleQuickGenerateQuery(def)}
                            className="flex-1 md:flex-none bg-[#004d40] hover:bg-[#00695c] text-white px-6 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isGeneratingQuery === def.code ? (
                              <>
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                AI GENERATING...
                              </>
                            ) : (
                              <>
                                <FileTextIcon />
                                GENERATE QUERY
                              </>
                            )}
                          </button>
                       </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="bg-slate-50 border-t p-6 text-center shrink-0">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Powered by Gemini AI • Disciplinary Narrative Automation</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- CD&R Module --- */
const CDRModule = ({ entries, lga, db, userRole, activeFormUrl }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', ppa: '', gsmNo: '', misconduct: '' });
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  const handleMinuteUpdate = async (id: string, field: string, text: string) => { 
    await updateData(db, "cdr_cases", id, { [field]: text }); 
  };
  
  const handleStatusUpdate = async (id: string, status: CDRStatus) => { 
    await updateData(db, "cdr_cases", id, { status }); 
    // Fix: Using (window as any).alert to avoid access errors
    (window as any).alert(`Docket status updated to ${status.replace(/_/g, ' ')}`);
  };

  const handleFileUpload = async (id: string, files: FileList | null, field: string) => {
    if (!files || files.length === 0) return;
    const base64 = await fileToBase64(files[0]);
    
    if (field === 'evidenceDocuments') {
      const cm = entries.find((e: any) => e.id === id);
      const currentDocs = cm?.evidenceDocuments || [];
      await updateData(db, "cdr_cases", id, { 
        evidenceDocuments: [...currentDocs, base64], 
        status: 'Responded' as CDRStatus 
      });
    } else {
      await updateData(db, "cdr_cases", id, { [field]: base64, status: 'Responded' as CDRStatus });
    }
    // Fix: Using (window as any).alert to avoid access errors
    (window as any).alert("Document attached to case docket.");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-official">
      <div className="w-full lg:w-[350px] shrink-0 no-print">
        <a 
          href={activeFormUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-full bg-[#0f172a] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all block text-center mb-6"
        >
          Open Case Intake Form
        </a>
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-black uppercase text-[10px] text-slate-400 tracking-[0.4em] mb-8 text-center">INITIALIZE CASE DOCKET</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cdr_cases", { ...formData, lga, status: 'Pending' }); setFormData({name:'',stateCode:'',ppa:'',gsmNo:'',misconduct:''}); (window as any).alert("Case docket opened."); }} className="space-y-4">
            {/* Fix: Cast e.target to HTMLInputElement */}
            <input required placeholder="FULL NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold uppercase outline-none" value={formData.name} onChange={e => setFormData({...formData, name: (e.target as HTMLInputElement).value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold uppercase outline-none" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: (e.target as HTMLInputElement).value.toUpperCase()})} />
            <input required placeholder="STATION / PPA" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold uppercase outline-none" value={formData.ppa} onChange={e => setFormData({...formData, ppa: (e.target as HTMLInputElement).value.toUpperCase()})} />
            {/* Fix: Cast e.target to HTMLTextAreaElement */}
            <textarea required placeholder="MISCONDUCT DESCRIPTION..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-40 text-[13px] outline-none font-medium resize-none shadow-inner" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: (e.target as HTMLTextAreaElement).value})} />
            <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all">Commit Docket</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-8">
        {entries.length === 0 ? (
          <p className="text-slate-300 uppercase font-black text-[11px] tracking-widest text-center py-20 bg-white rounded-xl border border-slate-100">No active disciplinary dockets found.</p>
        ) : entries.map((cm: CDRCase) => (
          <div key={cm.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-official relative hover:shadow-md transition-all group">
             <div className="absolute top-10 right-10 flex items-center gap-4 no-print">
                <span className={`px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                  cm.status === 'Minuted_to_CIM' ? 'bg-[#004d40] text-white border-transparent' :
                  cm.status === 'Forwarded_to_ZI' ? 'bg-[#0f172a] text-white border-transparent' :
                  cm.status === 'Closed' ? 'bg-emerald-600 text-white border-transparent' :
                  cm.status === 'Minuted_back_to_LGI' ? 'bg-orange-600 text-white border-transparent shadow-sm' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>{String(cm.status || 'Pending').replace(/_/g, ' ').toUpperCase()}</span>
             </div>
             <div className="p-10 pb-4">
                <h4 className="text-2xl font-black uppercase tracking-tight text-slate-800 leading-none mb-2">{cm.name || 'N/A'}</h4>
                <p className="text-[12px] font-black text-[#004d40] uppercase tracking-[0.3em] opacity-50">{cm.stateCode || 'N/A'} • {String(cm.lga || '').toUpperCase()} UNIT</p>
             </div>
             <div className="mx-10 p-6 bg-[#f8fafc] rounded-xl border border-slate-100 italic text-[14px] text-slate-600 font-medium leading-relaxed shadow-inner">
               "{cm.misconduct || 'No narrative provided.'}"
             </div>

             {(cm.responseImage || (cm.evidenceDocuments && cm.evidenceDocuments.length > 0)) && (
               <div className="mx-10 mt-8 animate-official">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4">DOCKET ASSETS & PROOF:</p>
                 <div className="flex flex-wrap gap-4">
                   {cm.responseImage && (
                     <div 
                       onClick={() => setPreviewDoc(cm.responseImage!)} 
                       className="w-20 h-20 rounded-xl border-2 border-slate-100 overflow-hidden cursor-pointer hover:border-blue-400 transition-all shadow-sm relative group/thumb"
                     >
                       <img src={cm.responseImage} className="w-full h-full object-cover" alt="Response" />
                       <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-all">
                          <SearchIcon />
                       </div>
                       <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-[6px] text-white text-center py-0.5 font-bold uppercase">RESPONSE</div>
                     </div>
                   )}
                   {cm.evidenceDocuments?.map((doc, idx) => (
                     <div 
                       key={idx}
                       onClick={() => setPreviewDoc(doc)} 
                       className="w-20 h-20 rounded-xl border-2 border-slate-100 overflow-hidden cursor-pointer hover:border-emerald-400 transition-all shadow-sm relative group/thumb"
                     >
                       <img src={doc} className="w-full h-full object-cover" alt={`Evidence ${idx + 1}`} />
                       <div className="absolute inset-0 bg-emerald-600/20 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-all">
                          <SearchIcon />
                       </div>
                       <div className="absolute bottom-0 left-0 right-0 bg-emerald-600 text-[6px] text-white text-center py-0.5 font-bold uppercase">PROOF {idx+1}</div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                   <p className="text-[10px] font-black text-[#004d40] uppercase tracking-[0.3em] px-1">LGI ADM MINUTE</p>
                   {/* Fix: Cast e.target to HTMLTextAreaElement */}
                   <textarea 
                    readOnly={userRole !== 'LGI'} 
                    className="w-full p-5 bg-[#fdfdfd] border-slate-200 border rounded-xl text-[13px] h-40 outline-none font-medium italic shadow-inner focus:border-blue-300 transition-all" 
                    placeholder="LGI directive..." 
                    defaultValue={cm.lgiMinute} 
                    onBlur={(e) => userRole === 'LGI' && handleMinuteUpdate(cm.id, 'lgiMinute', (e.target as HTMLTextAreaElement).value)} 
                   />
                   {userRole === 'LGI' && cm.status !== 'Closed' && (
                     <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                            <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 p-3 rounded-xl border border-dashed border-slate-300 text-center transition-all flex items-center justify-center group">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-600">Attach Proof</span>
                            {/* Fix: Cast e.target to HTMLInputElement to access files */}
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(cm.id, (e.target as HTMLInputElement).files, 'evidenceDocuments')} />
                            </label>
                            <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_ZI')} className="bg-[#0f172a] text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm">Minute to ZI</button>
                        </div>
                     </div>
                   )}
                </div>
                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">ZI HEADQUARTERS DIRECTIVE</p>
                   {/* Fix: Cast e.target to HTMLTextAreaElement */}
                   <textarea 
                    readOnly={userRole !== 'ZI'} 
                    className="w-full p-5 bg-[#fdfdfd] border-slate-200 border rounded-xl text-[13px] h-40 outline-none font-medium italic shadow-inner focus:border-emerald-300 transition-all" 
                    placeholder="Zonal Command directive..." 
                    defaultValue={cm.ziMinute} 
                    onBlur={(e) => userRole === 'ZI' && handleMinuteUpdate(cm.id, 'ziMinute', (e.target as HTMLTextAreaElement).value)} 
                   />
                   {userRole === 'ZI' && cm.status !== 'Closed' && (
                     <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_back_to_LGI')} className="py-3 bg-orange-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm">Minute to LGI</button>
                        <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_to_CIM')} className="py-3 bg-[#004d40] text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm">Forward to CIM</button>
                        <button onClick={() => handleStatusUpdate(cm.id, 'Closed')} className="py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all shadow-sm">Close Case</button>
                     </div>
                   )}
                </div>
             </div>
             <div className="p-8 pt-0 flex justify-between items-center border-t border-slate-50 pt-8 no-print">
               <p className="text-[11px] font-black text-slate-200 uppercase tracking-[0.4em]">DOCKET REF: {cm.id.substring(0,8).toUpperCase()}</p>
               <div className="flex gap-4">
                 <button onClick={() => shareData(`Disciplinary Docket: ${cm.name}`, `Case status: ${cm.status}\nInfraction: ${cm.misconduct}`)} className="text-blue-500 bg-blue-50 w-11 h-11 flex items-center justify-center rounded-xl hover:bg-blue-100 transition-all active:scale-90"><ShareIcon /></button>
                 <button onClick={() => generateOfficialPDF(cm, 'CDR_CASE')} className="text-slate-400 bg-slate-50 w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-all active:scale-90"><DownloadIcon /></button>
                 {userRole === 'ZI' && <button onClick={() => deleteData(db, "cdr_cases", cm.id)} className="text-red-400 bg-red-50 w-11 h-11 flex items-center justify-center rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90"><TrashIcon /></button>}
               </div>
             </div>
          </div>
        ))}
      </div>

      {previewDoc && (
        <div 
          className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[5000] flex flex-col items-center justify-center p-4 md:p-12 animate-official" 
          onClick={() => setPreviewDoc(null)}
        >
          <div className="absolute top-8 right-8 flex gap-4 no-print">
            <a 
              href={previewDoc} 
              download={`NYSC_Proof_${Date.now()}.png`} 
              className="bg-white/10 hover:bg-emerald-500 text-white p-4 rounded-full transition-all shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <DownloadIcon />
            </a>
            <button 
              className="bg-white/10 hover:bg-red-500 text-white p-4 rounded-full transition-all shadow-2xl"
              onClick={() => setPreviewDoc(null)}
            >
              <LogOutIcon />
            </button>
          </div>
          
          <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <img 
              src={previewDoc} 
              className="max-w-full max-h-full object-contain rounded-2xl shadow-[0_0_100px_rgba(0,0,0,0.5)] border-4 border-white/5 animate-official" 
              alt="High Res Preview" 
            />
            <div className="mt-8 text-center text-white/50 text-[11px] font-black uppercase tracking-[0.4em]">
              Authorized Official Evidence Archive
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- CWHS Module --- */
const CWHSModule = ({ entries, db, lga, userRole }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', ppa: '', gsmNo: '', category: ReportCategory.ABSCONDED, details: '' });
  return (
    <div className="flex flex-col lg:flex-row gap-10 animate-official">
      <div className="w-full lg:w-[350px] shrink-0 no-print">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-black uppercase text-[10px] text-slate-400 tracking-[0.4em] mb-8 text-center">STATION INCIDENT LOG</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "nysc_reports", { ...formData, lga }); setFormData({name:'',stateCode:'',ppa:'',gsmNo:'',category:ReportCategory.ABSCONDED,details:''}); (window as any).alert("Incident record filed."); }} className="space-y-4">
            {/* Fix: Cast e.target to HTMLInputElement */}
            <input required placeholder="CM FULL NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: (e.target as HTMLInputElement).value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: (e.target as HTMLInputElement).value.toUpperCase()})} />
            {/* Fix: Cast e.target to HTMLSelectElement */}
            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase" value={formData.category} onChange={e => setFormData({...formData, category: (e.target as HTMLSelectElement).value as ReportCategory})}>
              {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            {/* Fix: Cast e.target to HTMLTextAreaElement */}
            <textarea placeholder="INCIDENT BRIEF..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-40 text-[13px] outline-none font-medium resize-none shadow-inner focus:border-emerald-200 transition-all" value={formData.details} onChange={e => setFormData({...formData, details: (e.target as HTMLTextAreaElement).value})} />
            <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-900/10">Commit Record</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
        {entries.length === 0 ? (
          <p className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-[11px] tracking-widest bg-white rounded-xl border border-slate-100">No active incidents logged.</p>
        ) : entries.map((e: any) => (
          <div key={e.id} className="bg-white p-8 rounded-xl border border-slate-200 relative group animate-official shadow-sm hover:shadow-md transition-all h-fit">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h4 className="text-[18px] font-black uppercase text-slate-800 leading-none mb-1.5">{e.name || '---'}</h4>
                  <p className="text-[11px] font-black text-[#004d40] opacity-60 uppercase tracking-[0.2em]">{e.stateCode || '---'}</p>
               </div>
               <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 uppercase tracking-widest">{String(e.lga || '').toUpperCase()}</span>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 mb-6 italic text-[13px] text-slate-600 leading-relaxed shadow-inner">
              "{e.details || 'No details archived.'}"
            </div>
            <div className="flex justify-between items-center border-t border-slate-50 pt-6">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 bg-[#0f172a] text-white rounded-lg shadow-sm">{e.category || 'PENDING'}</span>
               <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                 <button onClick={() => shareData(`Report: ${e.name}`, e.details)} className="text-blue-500 hover:text-blue-700 transition-all"><ShareIcon /></button>
                 {userRole === 'ZI' && <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="text-red-400 hover:text-red-600 transition-all"><TrashIcon /></button>}
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* --- CDS & SAED Modules --- */
const CDSModule = ({ groups, projects, lga, db, userRole }: any) => {
  const [view, setView] = useState<'UNITS' | 'PROJECTS'>('UNITS');
  const [groupForm, setGroupForm] = useState({ groupName: '' });
  const [projectForm, setProjectForm] = useState({ cmName: '', stateCode: '', projectName: '', description: '' });
  return (
    <div className="flex flex-col lg:flex-row gap-10 animate-official">
      <div className="w-full lg:w-[350px] shrink-0 no-print">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <div className="flex bg-slate-50 p-1.5 rounded-xl mb-8 border border-slate-100">
             <button onClick={() => setView('UNITS')} className={`flex-1 py-3.5 rounded-lg text-[11px] font-black uppercase transition-all tracking-wider ${view === 'UNITS' ? 'bg-[#004d40] text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Units</button>
             <button onClick={() => setView('PROJECTS')} className={`flex-1 py-3.5 rounded-lg text-[11px] font-black uppercase transition-all tracking-wider ${view === 'PROJECTS' ? 'bg-[#004d40] text-white shadow-xl' : 'text-slate-400'}`}>Projects</button>
          </div>
          {view === 'UNITS' ? (
            <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_groups", { ...groupForm, lga }); setGroupForm({groupName:''}); (window as any).alert("Unit registered."); }} className="space-y-4">
               {/* Fix: Cast e.target to HTMLInputElement */}
               <input required placeholder="UNIT NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={groupForm.groupName} onChange={e => setGroupForm({groupName: (e.target as HTMLInputElement).value.toUpperCase()})} />
               <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all shadow-md">Commit Unit</button>
            </form>
          ) : (
            <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_projects", { ...projectForm, lga }); setProjectForm({cmName:'',stateCode:'',projectName:'',description:''}); (window as any).alert("Project record published."); }} className="space-y-4">
               {/* Fix: Cast e.target to HTMLInputElement */}
               <input required placeholder="CM NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={projectForm.cmName} onChange={e => setProjectForm({...projectForm, cmName: (e.target as HTMLInputElement).value.toUpperCase()})} />
               <input required placeholder="PROJECT TITLE" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={projectForm.projectName} onChange={e => setProjectForm({...projectForm, projectName: (e.target as HTMLInputElement).value.toUpperCase()})} />
               {/* Fix: Cast e.target to HTMLTextAreaElement */}
               <textarea required placeholder="SCOPE..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-40 text-[13px] outline-none font-medium resize-none shadow-inner focus:border-emerald-200 transition-all" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: (e.target as HTMLTextAreaElement).value})} />
               <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all shadow-md">Publish Project</button>
            </form>
          )}
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {view === 'UNITS' ? (
          groups.length === 0 ? <p className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-[11px] tracking-widest bg-white rounded-xl border border-slate-100">No units registered.</p> :
          groups.map((g: any) => (
            <div key={g.id} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm relative group h-fit overflow-hidden hover:shadow-md transition-all">
              <div className="absolute left-0 top-0 w-2 h-full bg-[#004d40]"></div>
              <h4 className="text-[18px] font-black uppercase text-slate-800 leading-tight mb-2">{g.groupName || '---'}</h4>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{String(g.lga || '').toUpperCase()} UNIT</p>
            </div>
          ))
        ) : (
          projects.length === 0 ? <p className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-[11px] tracking-widest bg-white rounded-xl border border-slate-100">No reported projects.</p> :
          projects.map((p: any) => (
            <div key={p.id} className="bg-white p-10 rounded-2xl border border-slate-100 shadow-sm relative group h-fit overflow-hidden hover:shadow-md transition-all">
              <h4 className="text-[22px] font-black uppercase text-slate-800 leading-tight mb-3">{p.projectName || '---'}</h4>
              <p className="text-[11px] font-black text-[#004d40] uppercase tracking-widest">{p.cmName || '---'} • {p.stateCode || '---'}</p>
              <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 italic text-[14px] text-slate-600 font-medium mt-6 leading-relaxed shadow-inner">
                "{p.description || 'N/A'}"
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const SAEDModule = ({ entries, db, lga, userRole }: any) => {
  const [formData, setFormData] = useState({ centerName: '', cmCount: 0, fee: 0 });
  return (
    <div className="flex flex-col lg:flex-row gap-10 animate-official">
      <div className="w-full lg:w-[350px] shrink-0 no-print">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-black uppercase text-[10px] text-slate-400 tracking-[0.4em] mb-8 text-center">SKILL CENTER DIRECTORY</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "saed_centers", { ...formData, lga }); setFormData({centerName:'',cmCount:0,fee:0}); (window as any).alert("Hub committed to registry."); }} className="space-y-4">
            {/* Fix: Cast e.target to HTMLInputElement */}
            <input required placeholder="CENTER NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={formData.centerName} onChange={e => setFormData({...formData, centerName: (e.target as HTMLInputElement).value.toUpperCase()})} />
            <div className="grid grid-cols-2 gap-4">
               {/* Fix: Cast e.target to HTMLInputElement */}
               <input type="number" placeholder="ENROLLED" className="p-4 bg-white rounded-xl border border-slate-200 text-[14px] font-black outline-none focus:border-emerald-300 transition-all" value={formData.cmCount || ''} onChange={e => setFormData({...formData, cmCount: parseInt((e.target as HTMLInputElement).value) || 0})} />
               <input type="number" placeholder="FEE (₦)" className="p-4 bg-white rounded-xl border border-slate-200 text-[14px] font-black text-emerald-600 outline-none focus:border-emerald-300 transition-all" value={formData.fee || ''} onChange={e => setFormData({...formData, fee: parseInt((e.target as HTMLInputElement).value) || 0})} />
            </div>
            <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all shadow-xl">Commit Hub</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entries.length === 0 ? <p className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-[11px] tracking-widest bg-white rounded-xl border border-slate-100">No training centers linked.</p> :
        entries.map((c: any) => (
          <div key={c.id} className="bg-white p-10 rounded-2xl border border-slate-100 shadow-sm relative group h-fit overflow-hidden hover:shadow-lg transition-all duration-500">
            <div className="absolute top-0 left-0 w-2 h-full bg-[#004d40]"></div>
            <h4 className="text-[20px] font-black uppercase text-slate-800 leading-tight mb-8">{c.centerName || '---'}</h4>
            <div className="flex gap-12 pt-8 border-t border-slate-100">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-300 mb-2 tracking-widest uppercase">ENROLLED</p>
                <p className="text-4xl font-black text-[#004d40] leading-none">{c.cmCount || 0}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-300 mb-2 tracking-widest uppercase">REVENUE</p>
                <p className="text-4xl font-black text-emerald-600 leading-none">₦{Number(c.fee || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
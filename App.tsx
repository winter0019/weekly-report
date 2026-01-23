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
  const [isAuthenticated, setIsAuthenticated] = useState(() => window.localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => window.localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => window.localStorage.getItem('daura_lga') as DauraLga);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [division, setDivision] = useState<Division>(() => (window.localStorage.getItem('last_div') as Division) || 'CIM');

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
    window.localStorage.setItem('last_div', division);
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

  const activeFormUrl = useMemo(() => appSettings[0]?.googleFormUrl || "https://docs.google.com/forms", [appSettings]);

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filterFn = (items: any[], category: string) => {
      let filtered = items;
      
      // Mandatory LGA Filter for LGI (Zonal Inspector sees everything)
      if (userRole === 'LGI' && lgaContext) {
        filtered = filtered.filter(i => 
          String(i.lga).trim().toLowerCase() === String(lgaContext).trim().toLowerCase()
        );
      }

      return filtered.filter(item => {
        if (!q) return true;
        // Expanded search pool for both roles within their allowed context
        const searchPool: (string | undefined)[] = [
          item.surname, item.othernames, item.name, item.stateCode, item.lga, item.company, item.ppa,
          item.gsmNo, item.stream, item.batch, item.misconduct
        ];
        
        return searchPool.filter(Boolean).map(s => String(s).toLowerCase()).some(s => s.includes(q));
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
  }, [personnelRegistry, cwhsEntries, cimEntries, saedEntries, cdrEntries, cdsGroups, cdsProjects, userRole, lgaContext, searchQuery, division]);

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
            window.localStorage.setItem('daura_auth', 'true');
            window.localStorage.setItem('daura_role', pendingLogin.role);
            if (pendingLogin.lga) window.localStorage.setItem('daura_lga', pendingLogin.lga);
          } else { window.alert("PIN Rejected."); }
        }} className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm space-y-6 animate-official">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#004d40] rounded-2xl mx-auto mb-4 flex items-center justify-center text-white font-serif-heading text-2xl font-black shadow-lg">NYSC</div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-widest">Access Terminal</h1>
          </div>
          <div className="space-y-3">
            <select required className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-[12px] font-bold text-slate-700 outline-none" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Command...</option>
                <option value="ZI">Zonal Inspectorate (ZI)</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Unit (LGI)</option>)}
            </select>
            <input type="password" required placeholder="PIN" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xl font-black tracking-[0.4em] outline-none" value={pin} onChange={e => setPin(e.target.value)} />
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
            <input 
              type="text" 
              placeholder="Quick find personnel or station..." 
              className="bg-transparent ml-4 w-full outline-none text-[15px] font-medium text-slate-600 placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mt-10 px-4 md:px-8 max-w-[1600px] mx-auto w-full flex-1">
        <main className="flex flex-col gap-8">
          {!isDbLoaded ? (
            <div className="w-full flex flex-col items-center justify-center py-40 gap-6">
              <div className="w-14 h-14 border-4 border-slate-200 border-t-[#004d40] rounded-full animate-spin"></div>
              <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-[11px]">Database Synchronizing...</p>
            </div>
          ) : (
            <>
              {division === 'PERSONNEL' && <FindCorpsMemberModule entries={filteredData.personnel} db={dbRef.current} userRole={userRole} lgaContext={lgaContext} isSearching={searchQuery.length > 0} />}
              {division === 'CIM' && <CIMModule entries={filteredData.cim} lga={lgaContext!} db={dbRef.current} userRole={userRole} stationDispositions={stationDispositions} />}
              {division === 'CWHS' && <CWHSModule entries={filteredData.cwhs} db={dbRef.current} userRole={userRole} lga={lgaContext!} />}
              {division === 'CDR' && <CDRModule entries={filteredData.cdr} lga={lgaContext!} db={dbRef.current} userRole={userRole} activeFormUrl={activeFormUrl} />}
              {division === 'CDS' && <CDSModule groups={filteredData.cdsGroups} projects={filteredData.cdsProjects} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
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
                  <input className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold text-slate-700 outline-none" value={activeFormUrl} onChange={async (e) => {
                      const newUrl = e.target.value;
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
  const [selectedLga, setSelectedLga] = useState<DauraLga | ''>('');
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedLga || !selectedBatch) {
      alert("Please select LGA and Batch before uploading.");
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
            lga: selectedLga, 
            batch: selectedBatch 
          });
          successCount++;
        }
        alert(`Successfully synced ${successCount} records for ${selectedLga} - ${selectedBatch}.`);
      } catch (err) { alert("Sync error."); }
      finally { setIsUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-full flex flex-col gap-6 animate-official min-h-[500px]">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
        <div className="shrink-0">
          <h2 className="text-[18px] font-black uppercase text-slate-800">Find Corps Member Registry</h2>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authorized Secretariat Repository</p>
        </div>

        <div className="flex items-center gap-3">
           <button onClick={() => downloadCSV(entries, `${userRole}_Personnel_Registry`)} className="px-4 py-2.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase border border-blue-100 flex items-center gap-2 hover:bg-blue-100 transition-all">
             <DownloadIcon /> {userRole === 'ZI' ? 'DOWNLOAD MASTER' : 'DOWNLOAD UNIT'} CSV
           </button>

           {userRole === 'ZI' && (
             <div className="flex flex-col md:flex-row items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
               <select 
                 className="w-full md:w-32 p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none"
                 value={selectedLga}
                 onChange={e => setSelectedLga(e.target.value as DauraLga)}
               >
                 <option value="">LGA...</option>
                 {LGAS.map(l => <option key={l} value={l}>{l}</option>)}
               </select>
               <select 
                 className="w-full md:w-32 p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase outline-none"
                 value={selectedBatch}
                 onChange={e => setSelectedBatch(e.target.value)}
               >
                 <option value="">BATCH...</option>
                 {BATCHES.map(b => <option key={b} value={b}>{b}</option>)}
               </select>
               <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
               <button 
                 onClick={() => fileInputRef.current?.click()} 
                 disabled={isUploading || !selectedLga || !selectedBatch} 
                 className={`px-4 py-2 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 transition-all ${(!selectedLga || !selectedBatch) ? 'bg-slate-300' : 'bg-[#004d40]'}`}
               >
                 <SpreadsheetIcon /> UPLOAD
               </button>
             </div>
           )}
        </div>
      </div>

      {!isSearching ? (
        <div className="flex-1 flex flex-col items-center justify-center py-40 bg-white rounded-2xl border-2 border-dashed border-slate-200">
           <SearchIcon />
           <p className="text-slate-400 text-[12px] font-medium mt-4 uppercase tracking-[0.2em]">Enter a Name or State Code to fetch from {userRole === 'ZI' ? 'Global' : lgaContext} records</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {entries.map((p: PersonnelEntry) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 hover:shadow-lg transition-all group">
              <div className="mb-6 flex justify-between items-start">
                <span className="bg-emerald-50 text-[#004d40] text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100">{p.batch} • {p.stream}</span>
                {userRole === 'ZI' && <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{p.lga}</span>}
              </div>
              <h4 className="text-[20px] font-black uppercase text-slate-800 leading-tight mb-1">{p.surname}, {p.othernames}</h4>
              <p className="text-[12px] font-black text-[#004d40] uppercase tracking-[0.2em] mb-6">{p.stateCode}</p>
              <div className="space-y-4 pt-6 border-t border-slate-50">
                <div className="flex items-center gap-3 text-[12px]"><DashboardIcon /><span className="font-bold text-slate-600 uppercase">{p.lga} LGA</span></div>
                <div className="flex items-center gap-3 text-[12px]"><FileTextIcon /><span className="font-bold text-slate-600 uppercase truncate">{p.company}</span></div>
                <div className="flex items-center gap-3 text-[12px] font-bold text-emerald-600"><WhatsAppIcon />{p.gsmNo || 'N/A'}</div>
              </div>
              <div className="mt-8 flex gap-3 pt-6 border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => shareData(`Personnel: ${p.surname}`, `${p.stateCode} - ${p.lga} Unit`)} className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">SHARE</button>
                 {userRole === 'ZI' && <button onClick={() => deleteData(db, "personnel_registry", p.id)} className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><TrashIcon /></button>}
              </div>
            </div>
          ))}
          {entries.length === 0 && (
            <div className="col-span-full py-20 text-center bg-white rounded-xl border border-slate-100">
              <p className="text-slate-300 uppercase font-black text-[11px] tracking-widest">No matching records found.</p>
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
  const [isGenerating, setIsGenerating] = useState(false);
  
  const currentStationDisp = stationDispositions.find((d: any) => String(d.lga).toLowerCase() === String(lga).toLowerCase());
  const [tempBatches, setTempBatches] = useState<CIMBatchDisposition[]>([]);
  const [newBatch, setNewBatch] = useState({ batch: '', males: 0, females: 0 });
  const [formData, setFormData] = useState({ month: '' });
  const [clearedBatches, setClearedBatches] = useState<CIMBatchDisposition[]>([]);
  const [newClearedBatch, setNewClearedBatch] = useState({ batch: '', males: 0, females: 0 });
  const [tempUnclearedList, setTempUnclearedList] = useState<{name: string, code: string, ppa: string, gsmNo: string, reason: string, gender: 'Male' | 'Female'}[]>([]);
  const [newDefaulter, setNewDefaulter] = useState({ name: '', code: '', ppa: '', gsmNo: '', reason: 'BIOMETRIC DEFAULT', gender: 'Male' as 'Male' | 'Female' });

  useEffect(() => {
    if (currentStationDisp?.batches) setTempBatches(currentStationDisp.batches);
    else setTempBatches([]);
  }, [currentStationDisp]);

  const handleSaveStationDisposition = async () => {
    const data = { lga, batches: tempBatches, totalMales: tempBatches.reduce((a,b)=>a+b.males,0), totalFemales: tempBatches.reduce((a,b)=>a+b.females,0), lastUpdated: new Date().toISOString() };
    if (currentStationDisp) await updateData(db, "station_disposition", currentStationDisp.id, data);
    else await addData(db, "station_disposition", data);
    window.alert("Population synced.");
  };

  const handleSubmitAudit = async (e: any) => {
    e.preventDefault();
    if (!formData.month) return alert("Select audit month.");
    const totalM = clearedBatches.reduce((a,b)=>a+b.males,0);
    const totalF = clearedBatches.reduce((a,b)=>a+b.females,0);
    const data = { month: formData.month, lga, maleCount: totalM, femaleCount: totalF, clearedCount: totalM+totalF, totalCMs: totalM+totalF+tempUnclearedList.length, unclearedList: tempUnclearedList.map(u => ({...u, month: formData.month})), batchClearance: clearedBatches, dateAdded: new Date().toISOString() };
    await addData(db, "cim_clearance", data);
    setFormData({month:''}); setClearedBatches([]); setTempUnclearedList([]);
    window.alert("Audit published.");
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
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-4 opacity-80">ZONAL POPULATION AGGREGATE</h3>
              <div className="flex items-center gap-6">
                <span className="text-5xl font-black font-serif-heading leading-none">{zonalStats.totalPopM + zonalStats.totalPopF}</span>
                <div className="h-10 w-px bg-white/10"></div>
                <div>
                   <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Males: {zonalStats.totalPopM}</p>
                   <p className="text-[9px] font-bold text-pink-400 uppercase tracking-widest leading-none">Females: {zonalStats.totalPopF}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 flex flex-col justify-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">TOTAL CLEARED (CUMULATIVE)</h3>
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
                 <button onClick={() => setIsLedgerOpen(true)} className="px-4 py-2 bg-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg">DEFAULTER MASTER REGISTRY</button>
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
                       const lgaDisp = stationDispositions.find((d: any) => String(d.lga).toLowerCase() === String(stationName).toLowerCase());
                       const latestAudit = entries.filter((e: any) => String(e.lga).toLowerCase() === String(stationName).toLowerCase())[0];
                       return (
                         <tr key={stationName} className="hover:bg-slate-50/50 transition-all group">
                            <td className="p-6 font-black text-slate-800">{stationName}</td>
                            <td className="p-6">
                               {lgaDisp ? <p className="text-[11px] font-bold">M: {lgaDisp.totalMales} F: {lgaDisp.totalFemales}</p> : '--'}
                            </td>
                            <td className="p-6 text-[11px] font-black text-slate-500">{latestAudit?.month || '---'}</td>
                            <td className="p-6 text-emerald-600 font-black">{latestAudit?.clearedCount || 0}</td>
                            <td className="p-6 text-red-500 font-black">{latestAudit?.unclearedList?.length || 0}</td>
                            <td className="p-6">
                               <textarea 
                                 className="w-full bg-slate-50 border rounded p-2 text-[10px] h-10 outline-none"
                                 placeholder="Directive..."
                                 defaultValue={latestAudit?.ziMinute}
                                 onBlur={async (e) => {
                                   if (latestAudit) await updateData(db, "cim_clearance", latestAudit.id, { ziMinute: e.target.value });
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
          <h3 className="font-bold uppercase text-[9px] mb-6 text-slate-400 text-center tracking-widest">STATION POPULATION CONSOLE</h3>
          <div className="space-y-2 mb-6">
            {tempBatches.map((b, i) => (
              <div key={i} className="px-4 py-3 bg-slate-50 border border-slate-100 rounded-lg flex justify-between items-center group">
                <div>
                   <p className="text-[11px] font-black text-slate-800 uppercase leading-none mb-1">{b.batch}</p>
                   <p className="text-[9px] font-bold text-slate-400 uppercase">M: {b.males} | F: {b.females}</p>
                </div>
                <button onClick={() => setTempBatches(tempBatches.filter((_, idx) => idx !== i))} className="text-red-200 hover:text-red-500 transition-colors"><TrashIcon /></button>
              </div>
            ))}
          </div>
          <div className="space-y-3 p-4 bg-slate-50/50 rounded-xl border border-slate-100 mb-4">
             <input placeholder="BATCH NAME" className="w-full p-3 bg-white rounded-lg border border-slate-200 text-[11px] font-black uppercase outline-none" value={newBatch.batch} onChange={e => setNewBatch({...newBatch, batch: e.target.value.toUpperCase()})} />
             <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Males" className="p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-bold outline-none" value={newBatch.males || ''} onChange={e => setNewBatch({...newBatch, males: parseInt(e.target.value) || 0})} />
                <input type="number" placeholder="Females" className="p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-bold outline-none" value={newBatch.females || ''} onChange={e => setNewBatch({...newBatch, females: parseInt(e.target.value) || 0})} />
             </div>
             <button onClick={() => { if(newBatch.batch) {setTempBatches([...tempBatches, newBatch]); setNewBatch({batch:'',males:0,females:0});} }} className="w-full py-3 bg-[#004d40] text-white rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-2"><PlusIcon /> ADD BATCH</button>
          </div>
          <button onClick={handleSaveStationDisposition} className="w-full py-3.5 bg-[#00695c] text-white rounded-lg font-black uppercase text-[10px] tracking-wider shadow-lg active:scale-95 transition-all">SYNC FINAL DISPOSITION</button>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-bold uppercase text-[9px] mb-6 text-slate-400 text-center tracking-widest">MONTHLY AUDIT TERMINAL</h3>
          <form onSubmit={handleSubmitAudit} className="space-y-6">
            <input required placeholder="MONTH & YEAR" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-black uppercase outline-none focus:bg-white transition-all text-center" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value.toUpperCase()})} />
            <div className="p-5 bg-emerald-50/20 rounded-xl border border-emerald-100/30 space-y-4">
               <label className="text-[9px] font-black uppercase text-emerald-800 block mb-1">1. CLEARED COUNT</label>
               <select className="w-full p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-black uppercase outline-none" onChange={e => setNewClearedBatch({...newClearedBatch, batch: e.target.value})} value={newClearedBatch.batch}>
                 <option value="">SELECT BATCH...</option>
                 {tempBatches.map(b => <option key={b.batch} value={b.batch}>{b.batch}</option>)}
               </select>
               <div className="grid grid-cols-2 gap-3">
                  <input type="number" placeholder="Males" className="p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-bold outline-none" value={newClearedBatch.males || ''} onChange={e => setNewClearedBatch({...newClearedBatch, males: parseInt(e.target.value) || 0})} />
                  <input type="number" placeholder="Females" className="p-3 bg-white rounded-lg border border-slate-200 text-[12px] font-bold outline-none" value={newClearedBatch.females || ''} onChange={e => setNewClearedBatch({...newClearedBatch, females: parseInt(e.target.value) || 0})} />
               </div>
               <button type="button" onClick={() => { if(newClearedBatch.batch) { setClearedBatches([...clearedBatches, newClearedBatch]); setNewClearedBatch({batch:'',males:0,females:0}); } }} className="w-full py-2.5 bg-[#004d40] text-white rounded-lg text-[9px] font-black uppercase active:scale-95">INCLUDE COUNT</button>
            </div>
            <div className="p-5 bg-red-50/20 rounded-xl border border-red-100/30 space-y-4">
               <label className="text-[9px] font-black uppercase text-red-800 block mb-1">2. REGISTER DEFAULTER</label>
               <input placeholder="CORPS MEMBER NAME" className="w-full p-3.5 bg-white border border-slate-200 rounded-lg text-[11px] uppercase font-black outline-none" value={newDefaulter.name} onChange={e => setNewDefaulter({...newDefaulter, name: e.target.value.toUpperCase()})} />
               <input placeholder="STATE CODE" className="w-full p-3.5 bg-white border border-slate-200 rounded-lg text-[11px] uppercase font-black outline-none" value={newDefaulter.code} onChange={e => setNewDefaulter({...newDefaulter, code: e.target.value.toUpperCase()})} />
               <button type="button" onClick={() => { if(newDefaulter.name && newDefaulter.code) { setTempUnclearedList([...tempUnclearedList, newDefaulter]); setNewDefaulter({ name: '', code: '', ppa: '', gsmNo: '', reason: 'BIOMETRIC DEFAULT', gender: 'Male' }); } }} className="w-full py-3 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-red-900/10 active:scale-95 transition-all">FLAG CORPS MEMBER</button>
            </div>
            <button className="w-full bg-[#004d40] text-white py-4 rounded-lg font-black uppercase text-[10px] tracking-wider shadow-xl active:scale-95 transition-all">SUBMIT MONTHLY AUDIT</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-8 w-full">
        <div className="bg-[#0f172a] rounded-xl shadow-2xl p-10 text-white flex flex-col md:flex-row justify-between items-center border border-white/5 relative overflow-hidden animate-official">
           <div className="mb-10 md:mb-0 z-10 text-center md:text-left">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-4 opacity-80">LOCAL STATION BIOMETRIC STATISTICS</h2>
              <div className="flex items-center gap-8 justify-center md:justify-start">
                <span className="text-7xl font-black font-serif-heading">{(currentStationDisp?.totalMales + currentStationDisp?.totalFemales || 0)}</span>
                <div className="h-12 w-px bg-white/10 hidden md:block"></div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none hidden md:block">REGISTERED<br/>CORPS MEMBERS</span>
              </div>
           </div>
           <div className="flex gap-20 items-center z-10 md:pr-12">
              <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-3 tracking-widest">MALES</p>
                <p className="text-5xl font-black text-blue-400">{(currentStationDisp?.totalMales || 0)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-3 tracking-widest">FEMALES</p>
                <p className="text-5xl font-black text-pink-400">{(currentStationDisp?.totalFemales || 0)}</p>
              </div>
           </div>
        </div>
        <div>
           <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest px-1">SUBMITTED MONTHLY AUDITS</h3>
           <div className="space-y-6">
            {entries.map((e: CIMClearance) => (
              <div key={e.id} className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden animate-official group p-10 hover:shadow-md transition-all duration-300">
                 <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                   <div>
                     <h4 className="text-[22px] font-black uppercase text-slate-800 tracking-tight leading-none mb-2">{e.month}</h4>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-60">AUDIT RECORD • {new Date(e.dateAdded).toLocaleDateString('en-GB')}</p>
                   </div>
                   <div className="flex items-center gap-14 md:ml-auto">
                     <div className="text-center">
                       <span className="block text-4xl font-black text-emerald-600 mb-0.5">{e.clearedCount}</span>
                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">CLEARED</span>
                     </div>
                     <div className="text-center">
                       <span className="block text-4xl font-black text-red-500 mb-0.5">{e.unclearedList?.length || 0}</span>
                       <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">FLAGGED</span>
                     </div>
                   </div>
                 </div>
                 <div className="bg-[#f0f9f6] p-6 rounded-xl border border-emerald-100/50">
                    <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mb-2">ZONAL HQ DIRECTIVE:</p>
                    <p className="text-[14px] text-slate-600 italic font-medium leading-relaxed">"{e.ziMinute || 'No directives yet.'}"</p>
                 </div>
              </div>
            ))}
           </div>
        </div>
      </div>
    </div>
  );
};

/* --- CD&R Module --- */
const CDRModule = ({ entries, lga, db, userRole, activeFormUrl }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', ppa: '', gsmNo: '', misconduct: '' });
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const [caseToClose, setCaseToClose] = useState<{id: string, currentMinute: string} | null>(null);

  const closureReasons = [
    "Satisfactory Explanation Received",
    "Disciplinary Penalty Served",
    "Record Regularly Corrected",
    "Mistaken Identity Resolved",
    "Case Dismissed by Management",
    "Member Completed Service Term"
  ];

  const handleMinuteUpdate = async (id: string, field: string, text: string) => { 
    await updateData(db, "cdr_cases", id, { [field]: text }); 
  };
  
  const handleStatusUpdate = async (id: string, status: CDRStatus) => { 
    if (status === 'Closed') {
      const cm = entries.find((e: any) => e.id === id);
      setCaseToClose({ id, currentMinute: cm?.ziMinute || '' });
      return;
    }
    await updateData(db, "cdr_cases", id, { status }); 
    window.alert(`Case status updated to ${status.replace(/_/g, ' ')}`);
  };

  const finalizeClosure = async (reason: string) => {
    if (!caseToClose) return;
    const finalMinute = `${caseToClose.currentMinute}\n\n[CASE CLOSED]: ${reason} (Ref: ${new Date().toLocaleDateString()})`;
    await updateData(db, "cdr_cases", caseToClose.id, { 
      status: 'Closed' as CDRStatus, 
      ziMinute: finalMinute 
    });
    setCaseToClose(null);
    window.alert("Case Docket Finalized and Closed.");
  };

  const handleResponseUpload = async (id: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const base64 = await fileToBase64(files[0]);
    await updateData(db, "cdr_cases", id, { responseImage: base64, status: 'Responded' as CDRStatus });
    window.alert("Query response linked.");
  };

  const handleEvidenceUpload = async (id: string, files: FileList | null, currentDocs: string[] = []) => {
    if (!files || files.length === 0) return;
    const newDocs = [...currentDocs];
    for (let i = 0; i < files.length; i++) {
      const b64 = await fileToBase64(files[i]);
      newDocs.push(b64);
    }
    await updateData(db, "cdr_cases", id, { evidenceDocuments: newDocs });
    window.alert(`${files.length} items added to evidence.`);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-official">
      <div className="w-full lg:w-[350px] shrink-0 no-print">
        <a 
          href={activeFormUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="w-full bg-[#0f172a] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all block text-center mb-6 flex items-center justify-center gap-3"
        >
          <SpreadsheetIcon /> OPEN CASE FORM
        </a>
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <h3 className="font-black uppercase text-[10px] text-slate-400 tracking-[0.4em] mb-8 text-center">INITIALIZE CASE DOCKET</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cdr_cases", { ...formData, lga, status: 'Pending' }); setFormData({name:'',stateCode:'',ppa:'',gsmNo:'',misconduct:''}); window.alert("Case docket opened."); }} className="space-y-4">
            <input required placeholder="CORPS MEMBER FULL NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold uppercase outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold uppercase outline-none" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <input required placeholder="STATION / PPA" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold uppercase outline-none" value={formData.ppa} onChange={e => setFormData({...formData, ppa: e.target.value.toUpperCase()})} />
            <textarea required placeholder="MISCONDUCT DESCRIPTION..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-40 text-[13px] outline-none font-medium resize-none shadow-inner" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-lg active:scale-95 transition-all"><PlusIcon /> OPEN CASE DOCKET</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-8">
        {entries.map((cm: CDRCase) => (
          <div key={cm.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group animate-official relative hover:shadow-md transition-all">
             <div className="absolute top-10 right-10 flex items-center gap-4 no-print">
                <span className={`px-5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                  cm.status === 'Minuted_to_CIM' ? 'bg-[#004d40] text-white border-transparent shadow-sm' :
                  cm.status === 'Forwarded_to_ZI' ? 'bg-[#0f172a] text-white border-transparent shadow-sm' :
                  cm.status === 'Closed' ? 'bg-emerald-600 text-white border-transparent shadow-sm' :
                  cm.status === 'Minuted_back_to_LGI' ? 'bg-orange-500 text-white border-transparent shadow-sm' :
                  'bg-slate-50 text-slate-500 border-slate-200'
                }`}>{cm.status?.replace(/_/g, ' ') || 'PENDING'}</span>
             </div>
             <div className="p-10 pb-4">
                <h4 className="text-2xl font-black uppercase tracking-tight text-slate-800 leading-none mb-2">{cm.name}</h4>
                <p className="text-[12px] font-black text-[#004d40] uppercase tracking-[0.3em] opacity-50">{cm.stateCode} • {cm.lga?.toUpperCase()} UNIT</p>
             </div>
             <div className="mx-10 p-6 bg-[#f8fafc] rounded-xl border border-slate-100 italic text-[14px] text-slate-600 font-medium leading-relaxed shadow-inner">"{cm.misconduct}"</div>

             {/* Evidence Viewing Feature */}
             {(cm.responseImage || (cm.evidenceDocuments && cm.evidenceDocuments.length > 0)) && (
               <div className="mx-10 mt-6 flex flex-wrap gap-2 animate-official">
                 <p className="w-full text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">DOCKET EVIDENCE ASSETS:</p>
                 {cm.responseImage && (
                   <button onClick={() => setPreviewDoc(cm.responseImage!)} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black border border-blue-100 flex items-center gap-1 hover:bg-blue-100 transition-colors shadow-sm">
                     <FileTextIcon /> CM RESPONSE
                   </button>
                 )}
                 {cm.evidenceDocuments?.map((doc, idx) => (
                   <button key={idx} onClick={() => setPreviewDoc(doc)} className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black border border-emerald-100 flex items-center gap-1 hover:bg-emerald-100 transition-colors shadow-sm">
                     <FileTextIcon /> EVIDENCE {idx + 1}
                   </button>
                 ))}
               </div>
             )}

             <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                   <p className="text-[10px] font-black text-[#004d40] uppercase tracking-[0.3em] px-1">LGI ADMINISTRATIVE MINUTE</p>
                   <textarea readOnly={userRole !== 'LGI'} className="w-full p-5 bg-[#fdfdfd] border-slate-200 border rounded-xl text-[13px] h-40 outline-none font-medium italic shadow-inner focus:border-blue-300 transition-all" placeholder="Enter commander minute..." defaultValue={cm.lgiMinute} onBlur={(e) => userRole === 'LGI' && handleMinuteUpdate(cm.id, 'lgiMinute', e.target.value)} />
                   {userRole === 'LGI' && (
                     <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 gap-2">
                           <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 p-3 rounded-xl border border-dashed border-slate-300 text-center transition-all flex items-center justify-center">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attach Response</span>
                              <input type="file" className="hidden" onChange={(e) => handleResponseUpload(cm.id, e.target.files)} />
                           </label>
                           <label className="cursor-pointer bg-slate-50 hover:bg-slate-100 p-3 rounded-xl border border-dashed border-slate-300 text-center transition-all flex items-center justify-center">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attach Evidence</span>
                              <input type="file" multiple className="hidden" onChange={(e) => handleEvidenceUpload(cm.id, e.target.files, cm.evidenceDocuments)} />
                           </label>
                        </div>
                        <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_ZI')} className="w-full py-3 bg-[#0f172a] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] active:scale-95 transition-all shadow-md">FORWARD TO ZONAL HQ</button>
                     </div>
                   )}
                </div>
                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] px-1">ZI HEADQUARTERS DIRECTIVE</p>
                   <textarea readOnly={userRole !== 'ZI'} className="w-full p-5 bg-[#fdfdfd] border-slate-200 border rounded-xl text-[13px] h-40 outline-none font-medium italic shadow-inner focus:border-emerald-300 transition-all" placeholder="Enter Zonal Inspector directive..." defaultValue={cm.ziMinute} onBlur={(e) => userRole === 'ZI' && handleMinuteUpdate(cm.id, 'ziMinute', e.target.value)} />
                   {userRole === 'ZI' && (
                     <div className="grid grid-cols-3 gap-2">
                        <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_back_to_LGI')} className="py-3 bg-orange-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-orange-700 active:scale-95 transition-all">MINUTE BACK TO LGI</button>
                        <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_to_CIM')} className="py-3 bg-[#004d40] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-[#00695c] active:scale-95 transition-all">FORWARD TO CIM</button>
                        <button onClick={() => handleStatusUpdate(cm.id, 'Closed')} className="py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-emerald-700 active:scale-95 transition-all">CLOSE CASE</button>
                     </div>
                   )}
                </div>
             </div>
             <div className="p-8 pt-0 flex justify-between items-center border-t border-slate-50 pt-8 no-print">
               <p className="text-[11px] font-black text-slate-200 uppercase tracking-[0.4em]">REF: {cm.id.substring(0,8).toUpperCase()}</p>
               <div className="flex gap-4">
                 <button onClick={() => shareData(`Case Report: ${cm.name}`, `${cm.stateCode} - Status: ${cm.status}`)} className="w-12 h-12 flex items-center justify-center text-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all active:scale-90 shadow-sm"><ShareIcon /></button>
                 <button onClick={() => generateOfficialPDF(cm, 'CDR_CASE')} className="w-12 h-12 flex items-center justify-center text-slate-400 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all active:scale-90 shadow-sm"><DownloadIcon /></button>
                 {userRole === 'ZI' && <button onClick={() => deleteData(db, "cdr_cases", cm.id)} className="w-12 h-12 flex items-center justify-center text-red-400 bg-red-50 rounded-xl hover:bg-red-500 hover:text-white transition-all active:scale-90 shadow-sm"><TrashIcon /></button>}
               </div>
             </div>
          </div>
        ))}
      </div>

      {/* Closure Reason Selection Modal */}
      {caseToClose && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4 animate-official">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-10 space-y-8">
            <div className="text-center">
              <h3 className="text-lg font-black uppercase text-slate-800 mb-2">FINAL CASE CLOSURE</h3>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Select official reason for finalizing this docket</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {closureReasons.map((reason) => (
                <button 
                  key={reason} 
                  onClick={() => finalizeClosure(reason)}
                  className="p-4 bg-slate-50 hover:bg-[#004d40] hover:text-white border border-slate-200 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all text-left shadow-sm active:scale-95"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button 
              onClick={() => setCaseToClose(null)} 
              className="w-full py-4 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all"
            >
              Cancel Closure
            </button>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[4000] flex flex-col items-center justify-center p-4 animate-official" onClick={() => setPreviewDoc(null)}>
          <div className="relative max-w-5xl w-full h-[85vh] flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
            <img src={previewDoc} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border-4 border-white/10" alt="Evidence Preview" />
            <div className="mt-8 flex gap-4">
              <button onClick={() => setPreviewDoc(null)} className="px-10 py-3.5 bg-white text-black font-black uppercase text-[11px] rounded-full tracking-[0.2em] shadow-xl hover:bg-emerald-50 transition-all active:scale-95">CLOSE DOCKET VIEWER</button>
              <a href={previewDoc} download="NYSC_Evidence.png" className="px-6 py-3.5 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-emerald-700 transition-all"><DownloadIcon /></a>
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
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "nysc_reports", { ...formData, lga }); setFormData({name:'',stateCode:'',ppa:'',gsmNo:'',category:ReportCategory.ABSCONDED,details:''}); window.alert("Incident filed."); }} className="space-y-4">
            <input required placeholder="CORPS MEMBER FULL NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ReportCategory})}>
              {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
            <textarea placeholder="INCIDENT BRIEF / NARRATIVE..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-40 text-[13px] outline-none font-medium resize-none shadow-inner" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest"><PlusIcon /> PUBLISH RECORD</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
        {entries.map((e: any) => (
          <div key={e.id} className="bg-white p-8 rounded-xl border border-slate-200 relative group animate-official shadow-sm hover:shadow-md transition-all h-fit">
            <div className="flex justify-between items-start mb-4">
               <div>
                  <h4 className="text-[18px] font-black uppercase text-slate-800 leading-none mb-1.5">{e.name}</h4>
                  <p className="text-[11px] font-black text-[#004d40] opacity-60 uppercase tracking-[0.2em]">{e.stateCode}</p>
               </div>
               <span className="text-[9px] font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 uppercase tracking-widest">{e.lga}</span>
            </div>
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 mb-6 italic text-[13px] text-slate-600 leading-relaxed shadow-inner">"{e.details || 'Official documentation pending.'}"</div>
            <div className="flex justify-between items-center border-t border-slate-50 pt-6">
               <span className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 bg-[#0f172a] text-white rounded-lg shadow-sm">{e.category}</span>
               <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                 <button onClick={() => shareData(`Incident Brief: ${e.name}`, e.details)} className="text-blue-500 hover:text-blue-700 transition-all"><ShareIcon /></button>
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
             <button onClick={() => setView('UNITS')} className={`flex-1 py-3.5 rounded-lg text-[11px] font-black uppercase transition-all tracking-wider ${view === 'UNITS' ? 'bg-[#004d40] text-white shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>UNITS</button>
             <button onClick={() => setView('PROJECTS')} className={`flex-1 py-3.5 rounded-lg text-[11px] font-black uppercase transition-all tracking-wider ${view === 'PROJECTS' ? 'bg-[#004d40] text-white shadow-xl' : 'text-slate-400'}`}>PROJECTS</button>
          </div>
          {view === 'UNITS' ? (
            <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_groups", { ...groupForm, lga }); setGroupForm({groupName:''}); window.alert("Unit registered."); }} className="space-y-4">
               <input required placeholder="UNIT NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={groupForm.groupName} onChange={e => setGroupForm({groupName: e.target.value.toUpperCase()})} />
               <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all">REGISTER UNIT</button>
            </form>
          ) : (
            <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_projects", { ...projectForm, lga }); setProjectForm({cmName:'',stateCode:'',projectName:'',description:''}); window.alert("Project filed."); }} className="space-y-4">
               <input required placeholder="CORPS MEMBER NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={projectForm.cmName} onChange={e => setProjectForm({...projectForm, cmName: e.target.value.toUpperCase()})} />
               <input required placeholder="PROJECT TITLE" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={projectForm.projectName} onChange={e => setProjectForm({...projectForm, projectName: e.target.value.toUpperCase()})} />
               <textarea required placeholder="IMPACT SCOPE..." className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-40 text-[13px] outline-none font-medium resize-none shadow-inner focus:border-emerald-200 transition-all" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} />
               <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all">PUBLISH PROJECT</button>
            </form>
          )}
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {view === 'UNITS' ? (
          groups.map((g: any) => (
            <div key={g.id} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm relative group h-fit overflow-hidden hover:shadow-md transition-all duration-300"><div className="absolute left-0 top-0 w-2 h-full bg-[#004d40]"></div><h4 className="text-[18px] font-black uppercase text-slate-800 leading-tight mb-2">{g.groupName}</h4><p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{g.lga} UNIT</p></div>
          ))
        ) : (
          projects.map((p: any) => (
            <div key={p.id} className="bg-white p-10 rounded-2xl border border-slate-100 shadow-sm relative group h-fit overflow-hidden hover:shadow-md transition-all"><h4 className="text-[22px] font-black uppercase text-slate-800 leading-tight mb-3">{p.projectName}</h4><p className="text-[11px] font-black text-[#004d40] uppercase tracking-widest">{p.cmName} • {p.stateCode}</p><div className="bg-slate-50 p-6 rounded-xl border border-slate-100 italic text-[14px] text-slate-600 font-medium mt-6 leading-relaxed shadow-inner">"{p.description}"</div></div>
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
          <h3 className="font-black uppercase text-[10px] text-slate-400 tracking-[0.4em] mb-8 text-center">SKILL CENTER CENSUS</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "saed_centers", { ...formData, lga }); setFormData({centerName:'',cmCount:0,fee:0}); window.alert("Training hub linked."); }} className="space-y-4">
            <input required placeholder="HUB NAME" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-black uppercase outline-none focus:border-emerald-200 transition-all" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
            <div className="grid grid-cols-2 gap-4">
               <input type="number" placeholder="ENROLLED" className="p-4 bg-white rounded-xl border border-slate-200 text-[14px] font-black outline-none focus:border-emerald-300 transition-all" value={formData.cmCount || ''} onChange={e => setFormData({...formData, cmCount: parseInt(e.target.value) || 0})} />
               <input type="number" placeholder="FEE (₦)" className="p-4 bg-white rounded-xl border border-slate-200 text-[14px] font-black text-emerald-600 outline-none focus:border-emerald-300 transition-all" value={formData.fee || ''} onChange={e => setFormData({...formData, fee: parseInt(e.target.value) || 0})} />
            </div>
            <button className="w-full bg-[#004d40] text-white py-4 rounded-xl font-black uppercase text-[11px] tracking-widest shadow-xl active:scale-95 transition-all"><PlusIcon /> CONFIRM HUB REGISTRY</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entries.map((c: any) => (
          <div key={c.id} className="bg-white p-10 rounded-2xl border border-slate-100 shadow-sm relative group h-fit overflow-hidden hover:shadow-lg transition-all duration-500"><div className="absolute top-0 left-0 w-2 h-full bg-[#004d40]"></div><h4 className="text-[20px] font-black uppercase text-slate-800 leading-tight mb-8">{c.centerName}</h4><div className="flex gap-12 pt-8 border-t border-slate-100"><div className="text-center"><p className="text-[10px] font-black text-slate-300 mb-2 tracking-widest uppercase">ENROLLED</p><p className="text-4xl font-black text-[#004d40] leading-none transition-transform group-hover:scale-110">{c.cmCount}</p></div><div className="text-center"><p className="text-[10px] font-black text-slate-300 mb-2 tracking-widest uppercase">REVENUE</p><p className="text-4xl font-black text-emerald-600 leading-none transition-transform group-hover:scale-110">₦{Number(c.fee).toLocaleString()}</p></div></div></div>
        ))}
      </div>
    </div>
  );
};

export default App;
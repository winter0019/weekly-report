
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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const downloadCSV = (data: any[], filename: string, registry: string) => {
  if (data.length === 0) return window.alert("No data to export.");
  
  let headersArr: string[] = [];
  if (registry === 'CWHS') headersArr = ['name', 'stateCode', 'lga', 'category', 'details', 'dateAdded'];
  else if (registry === 'CIM') headersArr = ['month', 'lga', 'maleCount', 'femaleCount', 'totalCMs', 'clearedCount', 'dateAdded'];
  else if (registry === 'CDR') headersArr = ['name', 'stateCode', 'lga', 'ppa', 'misconduct', 'status', 'dateAdded'];
  else if (registry === 'SAED') headersArr = ['centerName', 'address', 'lga', 'cmCount', 'fee', 'dateAdded'];
  else if (registry === 'CDS_GROUPS') headersArr = ['groupName', 'lga', 'meetingDay', 'dateAdded'];
  else if (registry === 'CDS_PROJECTS') headersArr = ['cmName', 'stateCode', 'projectName', 'status', 'lga', 'dateAdded'];
  else headersArr = Object.keys(data[0]).filter(k => k !== 'id');

  const headers = headersArr.join(",");
  const rows = data.map(item => {
    return headersArr.map(h => {
      let v = item[h];
      if (h === 'unclearedList' || h === 'disposition') v = Array.isArray(v) ? v.length : v;
      const str = String(v || '').replace(/"/g, '""');
      return `"${str}"`;
    }).join(",");
  });
  
  const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = (window as any).document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  (window as any).document.body.appendChild(link);
  link.click();
  (window as any).document.body.removeChild(link);
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => window.localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => window.localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => window.localStorage.getItem('daura_lga') as DauraLga);
  const [ziStationFilter, setZiStationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [division, setDivision] = useState<Division>('CWHS');
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
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    (window as any).addEventListener('online', handleOnline);
    (window as any).addEventListener('offline', handleOffline);
    return () => {
      (window as any).removeEventListener('online', handleOnline);
      (window as any).removeEventListener('offline', handleOffline);
    };
  }, []);

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
        } catch (err) {
          console.error("Sync error:", err);
          if (active) setIsDbLoaded(true);
        }
      };
      
      startServices();
      return () => { active = false; unsubs.forEach(u => u()); };
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const target = pendingLogin?.role === 'ZI' ? 'ZI' : pendingLogin?.lga;
    if (target && pin === SECURITY_PINS[target]) {
      setIsAuthenticated(true);
      setUserRole(pendingLogin.role);
      setLgaContext(pendingLogin.lga);
      window.localStorage.setItem('daura_auth', 'true');
      window.localStorage.setItem('daura_role', pendingLogin.role);
      if (pendingLogin.lga) window.localStorage.setItem('daura_lga', pendingLogin.lga);
    } else {
      window.alert("Invalid Security PIN.");
    }
  };

  const handleLogout = () => {
    window.localStorage.clear();
    (window as any).location.reload();
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
          item.name, 
          item.cmName,
          item.groupName,
          item.projectName,
          item.stateCode, 
          item.lga, 
          (item as any).category, 
          (item as any).centerName,
          (item as any).ppa
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
        <form onSubmit={handleLogin} className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-2xl w-full max-w-xl space-y-8 animate-official border-[8px] border-emerald-950/10">
          <div className="text-center">
            <div className="w-16 h-16 bg-[#004d40] rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-2xl ring-4 ring-emerald-50 text-white font-serif-heading text-2xl font-black italic">NYSC</div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tighter mb-1 font-serif-heading">Command Portal</h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em]">Administrative Terminal</p>
          </div>
          <div className="space-y-5">
            <select required className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl font-bold text-slate-900 outline-none text-sm" onChange={e => {
                const val = (e.target as HTMLSelectElement).value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Command Center...</option>
                <option value="ZI">Zonal Office (ZI)</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Station (LGI)</option>)}
            </select>
            <input type="password" required placeholder="PIN CODE" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl text-center text-2xl font-black tracking-[0.4em] outline-none" value={pin} onChange={e => setPin((e.target as HTMLInputElement).value)} />
          </div>
          <button className="w-full bg-[#004d40] text-white p-5 rounded-xl font-black uppercase shadow-2xl hover:bg-black transition-all text-sm tracking-widest border-b-4 border-emerald-950">Authenticate</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-inter pb-20 sm:pb-40">
      <nav className="bg-transparent pt-4 sm:pt-6 flex justify-center gap-1 no-print px-2 sm:px-4">
        {(Object.keys(DIVISION_LABELS) as Division[]).map(id => (
          <button 
            key={id}
            onClick={() => setDivision(id)}
            className={`flex-1 sm:flex-none px-4 sm:px-12 py-3 rounded-t-2xl sm:rounded-t-[1.5rem] transition-all font-black uppercase text-[9px] sm:text-[11px] tracking-widest ${division === id ? 'bg-[#004d40] text-white' : 'bg-white/80 text-slate-400 hover:bg-white'}`}
          >
            {DIVISION_LABELS[id]}
          </button>
        ))}
      </nav>

      <header className="bg-[#004d40] text-white py-4 px-6 sm:px-10 shadow-2xl mx-2 sm:mx-8 rounded-2xl sm:rounded-[2rem] flex flex-col lg:flex-row items-center justify-between no-print border-b-4 border-black/10 relative z-50 gap-4">
        <div className="flex items-center gap-4 sm:gap-6 w-full lg:w-auto">
          <div className="w-10 h-10 sm:w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/5 cursor-pointer hover:bg-white/20 transition-all shrink-0">
            <DashboardIcon />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black uppercase tracking-tighter font-serif-heading leading-none">NYSC DAURA COMMAND</h1>
              {!isOnline && <span className="bg-red-500 text-white text-[7px] px-2 py-0.5 rounded-full font-black animate-pulse">OFFLINE</span>}
            </div>
            <p className="text-[7px] sm:text-[8px] font-black text-emerald-400 tracking-[0.2em] uppercase mt-1 opacity-70 italic">KATSINA STATE SECRETARIAT PORTAL</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3 sm:gap-4 w-full lg:w-auto">
          {userRole === 'ZI' ? (
            <div className="flex flex-wrap gap-2 sm:gap-4 w-full lg:w-auto justify-center">
              <div className="bg-white/10 border border-white/10 rounded-xl flex items-center px-4 overflow-hidden">
                <select value={ziStationFilter} onChange={e => setZiStationFilter((e.target as HTMLSelectElement).value)} className="bg-transparent text-[8px] sm:text-[9px] font-black uppercase outline-none py-2.5 text-white">
                  <option value="all" className="text-slate-900">GLOBAL COMMAND</option>
                  {LGAS.map(l => <option key={l} value={l} className="text-slate-900">{l}</option>)}
                </select>
              </div>
            </div>
          ) : (
             <div className="bg-emerald-900/60 px-5 sm:px-8 py-2.5 rounded-xl border border-emerald-500/30 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.1em]">
               STATION: {lgaContext}
             </div>
          )}
          <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/5 rounded-xl transition-all font-black uppercase text-[8px] sm:text-[9px] tracking-widest">
            <DownloadIcon /> <span className="hidden md:inline">EXPORT</span>
          </button>
          <button onClick={handleLogout} className="p-2.5 bg-red-600/20 hover:bg-red-600/40 rounded-xl border border-white/5 transition-all text-white"><LogOutIcon /></button>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto w-full px-4 sm:px-8 mt-6 sm:mt-10 flex flex-col gap-6 sm:gap-8">
        <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-6 no-print">
          <div className="relative w-full sm:w-[450px]">
            <input 
              type="text" 
              placeholder="SEARCH REGISTRY..." 
              className="bg-slate-50 p-4 pr-12 rounded-2xl border border-slate-200 text-xs w-full outline-none focus:ring-4 focus:ring-emerald-50 transition-all font-bold" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)} 
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 scale-110"><SearchIcon /></div>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 sm:gap-12">
           {!isDbLoaded ? (
             <div className="w-full flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-10 h-10 border-4 border-slate-100 border-t-[#004d40] rounded-full animate-spin"></div>
                <p className="text-slate-300 font-black uppercase tracking-[0.4em] text-[9px]">Synchronizing Secure Registry...</p>
             </div>
           ) : (
             <>
               {division === 'CWHS' && <CWHSModule entries={filteredData.cwhs} lga={lgaContext!} db={dbRef.current} />}
               {division === 'CIM' && <CIMModule entries={filteredData.cim} lga={lgaContext!} db={dbRef.current} userRole={userRole} stationDispositions={stationDispositions} />}
               {division === 'CDR' && <CDRModule entries={filteredData.cdr} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
               {division === 'CDS' && <CDSModule groups={filteredData.cdsGroups} projects={filteredData.cdsProjects} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
               {division === 'SAED' && <SAEDModule entries={filteredData.saed} lga={lgaContext!} db={dbRef.current} />}
             </>
           )}
        </div>
      </main>

      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6" onClick={() => setIsExportModalOpen(false)}>
          <div className="bg-white p-12 rounded-[3.5rem] w-full max-w-2xl shadow-2xl animate-official" onClick={e => e.stopPropagation()}>
             <h2 className="text-xl font-black uppercase tracking-tighter text-[#004d40] mb-12 text-center font-serif-heading">Administrative Export Hub</h2>
             <div className="grid gap-6">
               {(Object.keys(DIVISION_LABELS) as Division[]).map(id => (
                  <div key={id} className="p-6 bg-slate-50 rounded-[2rem] flex items-center justify-between gap-6">
                      <span className="font-black uppercase tracking-widest text-xs text-slate-600">{DIVISION_LABELS[id]} Data</span>
                      <button onClick={() => downloadCSV(filteredData[id as keyof typeof filteredData] || [], id, id)} className="px-8 py-3 bg-[#004d40] text-white rounded-xl hover:bg-black transition-all flex items-center gap-3 text-[10px] font-black uppercase shadow-xl"><DownloadIcon /> Export CSV</button>
                  </div>
               ))}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- CWHS Module --- */
const CWHSModule = ({ entries, db, lga }: { entries: CorpsMemberEntry[], db: any, lga: DauraLga }) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.ABSCONDED, details: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addData(db, "nysc_reports", { ...formData, lga: lga || 'Daura' });
    setFormData({ name: '', stateCode: '', category: ReportCategory.ABSCONDED, details: '' });
  };

  return (
    <>
      <div className="w-full lg:w-[340px] no-print shrink-0">
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 lg:sticky lg:top-40">
          <h3 className="font-black uppercase text-[8px] mb-6 pb-2 border-b-2 border-emerald-50 text-slate-400 tracking-widest text-center">New CW&HS Incident</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="PERSONNEL FULL NAME" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border text-xs" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border text-xs" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <select className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border text-[10px]" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ReportCategory})}>
              {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea placeholder="ADDITIONAL CASE DETAILS..." className="w-full p-4 bg-slate-50 rounded-xl font-medium border h-24 text-xs" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-5 rounded-xl font-black uppercase shadow-2xl hover:bg-black transition-all text-[9px] border-b-4 border-emerald-950">Log Official Case</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">
        {entries.map(e => (
          <div key={e.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all relative border border-slate-100 group animate-official">
            <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={() => generateOfficialPDF(e, 'SINGLE_CWHS')} className="p-2 text-emerald-600 bg-emerald-50 rounded-lg"><DownloadIcon /></button>
              <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="p-2 text-red-400 bg-red-50 rounded-lg"><TrashIcon /></button>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-lg ${e.category === ReportCategory.DECEASED ? 'bg-black text-white' : 'bg-red-50 text-red-600'}`}>
                {e.category === ReportCategory.ABSCONDED && <AbscondedIcon />}
                {e.category === ReportCategory.SICK && <SickIcon />}
                {e.category === ReportCategory.KIDNAPPED && <KidnappedIcon />}
                {e.category === ReportCategory.MISSING && <MissingIcon />}
                {e.category === ReportCategory.DECEASED && <DeceasedIcon />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{e.category}</span>
            </div>
            <h4 className="text-xl font-black uppercase text-slate-800 leading-none mb-1 font-serif-heading">{e.name}</h4>
            <p className="text-xs font-black text-emerald-800 uppercase mb-6">{e.stateCode}</p>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
               <p className="text-[9px] font-medium text-slate-600 leading-relaxed line-clamp-3 italic">"{e.details || 'No specific details provided in initial log.'}"</p>
            </div>
            <div className="flex justify-between items-center border-t pt-6">
               <span className="text-[8px] font-black text-slate-300 uppercase">{e.lga} Unit</span>
               <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`CW&HS Report: ${e.name} (${e.stateCode}) is reported as ${e.category} in ${e.lga}. Details: ${e.details}`)}`)} className="text-emerald-500"><WhatsAppIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

/* --- CIM Module --- */
const CIMModule = ({ entries, db, lga, userRole, stationDispositions }: { entries: CIMClearance[], db: any, lga: DauraLga, userRole: UserRole | null, stationDispositions: StationDisposition[] }) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0 });
  const [unclearedInput, setUnclearedInput] = useState({ name: '', code: '', reason: '' });
  const [tempUnclearedList, setTempUnclearedList] = useState<{name: string, code: string, reason: string}[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentStationDisp = stationDispositions.find(d => d.lga === lga);
  const [tempBatches, setTempBatches] = useState<CIMBatchDisposition[]>([]);
  const [newBatch, setNewBatch] = useState({ batch: '', males: 0, females: 0 });

  useEffect(() => {
    if (currentStationDisp?.batches) {
      setTempBatches(currentStationDisp.batches);
    } else {
      setTempBatches([]);
    }
  }, [currentStationDisp]);

  const abscondmentRisks = useMemo(() => {
    const counts: Record<string, { name: string, code: string, count: number, lga: string }> = {};
    entries.forEach((entry: any) => {
      entry.unclearedList?.forEach((cm: any) => {
        if (!counts[cm.code]) counts[cm.code] = { name: cm.name, code: cm.code, count: 0, lga: entry.lga };
        counts[cm.code].count += 1;
      });
    });
    return Object.values(counts)
      .filter((item: any) => item.count >= 2)
      .map((item: any) => {
        const threshold = 3;
        const daysRemaining = Math.max(0, (threshold - item.count) * 30);
        return { ...item, daysRemaining };
      })
      .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);
  }, [entries]);

  // Aggregate zone-wide batch data for ZI
  const zoneBatchSummary = useMemo(() => {
    const summary: Record<string, { males: number, females: number }> = {};
    stationDispositions.forEach(disp => {
      disp.batches?.forEach(b => {
        if (!summary[b.batch]) summary[b.batch] = { males: 0, females: 0 };
        summary[b.batch].males += b.males;
        summary[b.batch].females += b.females;
      });
    });
    return Object.entries(summary).map(([batch, counts]) => ({ batch, ...counts }));
  }, [stationDispositions]);

  // Total defaulters per LGA
  const defaulterCounts = useMemo(() => {
    const lgaTotals: Record<string, number> = {};
    // Extract unique defaulters across all audits per LGA
    entries.forEach(audit => {
      if (!lgaTotals[audit.lga]) lgaTotals[audit.lga] = 0;
      // We count unique codes per month audit for that LGA
      lgaTotals[audit.lga] += (audit.unclearedList?.length || 0);
    });
    return lgaTotals;
  }, [entries]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = { ...formData, totalCMs: Number(formData.maleCount) + Number(formData.femaleCount), lga: lga || 'Daura', unclearedList: tempUnclearedList.map(u => ({...u, logs: []})), dateAdded: new Date().toISOString() };
    await addData(db, "cim_clearance", data);
    setFormData({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0 });
    setTempUnclearedList([]);
  };

  const handleSaveStationDisposition = async () => {
    const totalMales = tempBatches.reduce((acc, b) => acc + b.males, 0);
    const totalFemales = tempBatches.reduce((acc, b) => acc + b.females, 0);
    try {
      if (currentStationDisp) {
        await updateData(db, "station_disposition", currentStationDisp.id, { batches: tempBatches, totalMales, totalFemales, lastUpdated: new Date().toISOString() });
      } else {
        await addData(db, "station_disposition", { lga, batches: tempBatches, totalMales, totalFemales, lastUpdated: new Date().toISOString() });
      }
      window.alert("Station population breakdown saved successfully.");
    } catch (err) { window.alert("Failed to save disposition."); }
  };

  const handleIssueQuery = async (cm: any) => {
    setIsGenerating(true);
    try {
      const queryText = await generateDisciplinaryQuery(cm.name, cm.code, "CIM AUDIT", `CHRONIC BIOMETRIC DEFAULT`);
      await addData(db, "cdr_cases", {
        name: cm.name,
        stateCode: cm.code,
        lga: cm.lga || lga,
        ppa: "CIM BIOMETRIC AUDIT FLAG",
        misconduct: `CHRONIC BIOMETRIC DEFAULT: Logged during ${cm.month} audit. Query Issued.`,
        dateOfInfraction: new Date().toISOString().split('T')[0],
        status: 'Pending' as CDRStatus
      });
      const parentAudit = entries.find(e => e.id === cm.parentId);
      if (parentAudit) {
        const newLog: CIMDefaulterLog = {
          action: 'Formal AI Query Issued',
          timestamp: new Date().toISOString(),
          role: userRole || 'Unknown'
        };
        const updatedUnclearedList = parentAudit.unclearedList.map(u => {
          if (u.code === cm.code) return { ...u, logs: [...(u.logs || []), newLog] };
          return u;
        });
        await updateData(db, "cim_clearance", cm.parentId, { unclearedList: updatedUnclearedList });
      }
      window.alert(`Query generated and action logged for ${cm.name}. Case escalated to CD&R.`);
    } catch (err) { console.error(err); window.alert("Failed to complete administrative action."); } finally { setIsGenerating(false); }
  };

  const handlePushToCDR = async (cm: any) => {
    try {
      await addData(db, "cdr_cases", {
        name: cm.name,
        stateCode: cm.code,
        lga: cm.lga || lga,
        ppa: "AUTO-FORWARDED (CIM SURVEILLANCE)",
        misconduct: `CHRONIC BIOMETRIC DEFAULT: Failed biometric clearance for ${cm.count} cycles.`,
        dateOfInfraction: new Date().toISOString().split('T')[0],
        status: 'Pending' as CDRStatus
      });
      window.alert(`Personnel ${cm.code} has been pushed to CD&R.`);
    } catch (err) { window.alert("Action failed."); }
  };

  return (
    <>
      <div className="w-full lg:w-[380px] no-print shrink-0 space-y-6">
        {userRole === 'LGI' && (
          <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
            <h3 className="font-black uppercase text-[8px] mb-4 pb-1 border-b text-slate-400 tracking-widest text-center">Batch-wise Population</h3>
            <div className="space-y-4">
              <div className="space-y-2 max-h-[250px] overflow-auto custom-scrollbar pr-1">
                {tempBatches.map((b, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 rounded-xl border flex justify-between items-center">
                    <div><p className="text-[10px] font-black text-slate-800 uppercase">{b.batch}</p><p className="text-[8px] text-slate-400 font-bold uppercase">M: {b.males} | F: {b.females}</p></div>
                    <button onClick={() => setTempBatches(tempBatches.filter((_, i) => i !== idx))} className="text-red-400"><TrashIcon /></button>
                  </div>
                ))}
              </div>
              <div className="bg-slate-100 p-4 rounded-2xl space-y-3">
                 <input placeholder="BATCH NAME" className="w-full p-2.5 bg-white rounded-lg text-[9px] font-bold uppercase outline-none border" value={newBatch.batch} onChange={e => setNewBatch({...newBatch, batch: e.target.value.toUpperCase()})} />
                 <div className="grid grid-cols-2 gap-2">
                    <input type="number" placeholder="MALES" className="w-full p-2.5 bg-white rounded-lg text-[9px] font-bold outline-none border" value={newBatch.males || ''} onChange={e => setNewBatch({...newBatch, males: parseInt(e.target.value) || 0})} />
                    <input type="number" placeholder="FEMALES" className="w-full p-2.5 bg-white rounded-lg text-[9px] font-bold outline-none border" value={newBatch.females || ''} onChange={e => setNewBatch({...newBatch, females: parseInt(e.target.value) || 0})} />
                 </div>
                 <button onClick={() => { if(newBatch.batch) { setTempBatches([...tempBatches, newBatch]); setNewBatch({batch:'', males:0, females:0}); } }} className="w-full py-2 bg-[#004d40] text-white rounded-lg text-[8px] font-black uppercase">Add Batch</button>
              </div>
              <button onClick={handleSaveStationDisposition} className="w-full bg-emerald-700 text-white p-4 rounded-xl font-black uppercase text-[9px] shadow-lg">Save Station Registry</button>
            </div>
          </div>
        )}

        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 lg:sticky lg:top-40">
          <h3 className="font-black uppercase text-[8px] mb-4 pb-1 border-b text-slate-400 tracking-widest text-center">New Monthly Audit</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="AUDIT MONTH" className="w-full p-3 bg-slate-50 rounded-lg font-bold uppercase border outline-none text-xs" value={formData.month} onChange={e => setFormData({...formData, month: (e.target as HTMLInputElement).value.toUpperCase()})} />
            <div className="grid grid-cols-2 gap-2">
               <div><label className="text-[7px] font-black text-slate-400 ml-1">Males Cleared</label><input type="number" className="w-full p-2 bg-slate-50 rounded-lg font-bold border text-xs" value={formData.maleCount} onChange={e => setFormData({...formData, maleCount: parseInt((e.target as HTMLInputElement).value) || 0})} /></div>
               <div><label className="text-[7px] font-black text-slate-400 ml-1">Females Cleared</label><input type="number" className="w-full p-2 bg-slate-50 rounded-lg font-bold border text-xs" value={formData.femaleCount} onChange={e => setFormData({...formData, femaleCount: parseInt((e.target as HTMLInputElement).value) || 0})} /></div>
            </div>
            <div className="border-t pt-4">
               <h4 className="text-[7px] font-black uppercase text-red-800 mb-2 ml-1">Log Defaulter</h4>
               <div className="space-y-2">
                  <input placeholder="CM NAME" className="w-full p-2 bg-slate-50 rounded-lg text-[10px] font-bold border" value={unclearedInput.name} onChange={e => setUnclearedInput({...unclearedInput, name: (e.target as HTMLInputElement).value.toUpperCase()})} />
                  <input placeholder="STATE CODE" className="w-full p-2 bg-slate-50 rounded-lg text-[10px] font-bold border" value={unclearedInput.code} onChange={e => setUnclearedInput({...unclearedInput, code: (e.target as HTMLInputElement).value.toUpperCase()})} />
                  <button type="button" onClick={() => { if(unclearedInput.code) { setTempUnclearedList([...tempUnclearedList, {...unclearedInput, reason: 'Manual audit flag'}]); setUnclearedInput({name:'',code:'',reason:''}); } }} className="w-full p-2 bg-slate-100 rounded-lg text-[7px] font-black uppercase">Add Defaulter ({tempUnclearedList.length})</button>
               </div>
            </div>
            <button className="w-full bg-[#004d40] text-white p-4 rounded-xl font-black uppercase text-[9px] border-b-4 border-emerald-950">Publish Final Audit</button>
          </form>
        </div>
      </div>

      <div className="flex-1 space-y-8">
        {/* Zonal Dashboard for ZI Role */}
        {userRole === 'ZI' && (
          <div className="space-y-6">
            <div className="bg-[#004d40] p-10 rounded-[3rem] text-white shadow-2xl animate-official relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10 scale-150 rotate-12"><DashboardIcon /></div>
               <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2 font-serif-heading">Zonal Registry Disposition</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-60">Aggregate Station Intelligence</p>
                  </div>
                  <div className="text-right">
                    <p className="text-5xl font-black tracking-tighter leading-none mb-2">
                      {stationDispositions.reduce((acc, d) => acc + d.totalMales + d.totalFemales, 0)}
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Grand Total Personnel</p>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white/10 p-5 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-black uppercase opacity-60 mb-2 tracking-widest">Total Males</p>
                    <p className="text-2xl font-black">{stationDispositions.reduce((acc, d) => acc + d.totalMales, 0)}</p>
                  </div>
                  <div className="bg-white/10 p-5 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-black uppercase opacity-60 mb-2 tracking-widest">Total Females</p>
                    <p className="text-2xl font-black">{stationDispositions.reduce((acc, d) => acc + d.totalFemales, 0)}</p>
                  </div>
                  <div className="bg-white/10 p-5 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-black uppercase opacity-60 mb-2 tracking-widest">Zone Defaulters</p>
                    <p className="text-2xl font-black text-red-400">{entries.reduce((acc, e) => acc + (e.unclearedList?.length || 0), 0)}</p>
                  </div>
                  <div className="bg-white/10 p-5 rounded-2xl border border-white/10">
                    <p className="text-[8px] font-black uppercase opacity-60 mb-2 tracking-widest">Active Batches</p>
                    <p className="text-2xl font-black">{zoneBatchSummary.length}</p>
                  </div>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
               <h3 className="text-xl font-black uppercase tracking-tighter text-[#004d40] mb-8 font-serif-heading border-b pb-4">Zone-Wide Batch Summary</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                 {zoneBatchSummary.map((bs, i) => (
                   <div key={i} className="p-6 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col justify-between hover:shadow-lg transition-all border-l-8 border-emerald-700">
                      <p className="text-lg font-black uppercase text-slate-800 mb-4">{bs.batch}</p>
                      <div className="flex gap-4">
                         <div className="flex-1 bg-white p-3 rounded-xl border text-center">
                            <p className="text-[7px] font-black text-slate-400 uppercase">Males</p>
                            <p className="text-lg font-black text-slate-700">{bs.males}</p>
                         </div>
                         <div className="flex-1 bg-white p-3 rounded-xl border text-center">
                            <p className="text-[7px] font-black text-slate-400 uppercase">Females</p>
                            <p className="text-lg font-black text-slate-700">{bs.females}</p>
                         </div>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                         <span className="text-[9px] font-black text-[#004d40] uppercase">Combined Strength</span>
                         <span className="text-xl font-black text-[#004d40]">{bs.males + bs.females}</span>
                      </div>
                   </div>
                 ))}
               </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
               <h3 className="text-xl font-black uppercase tracking-tighter text-[#004d40] mb-8 font-serif-heading border-b pb-4">Station-Specific Breakdowns</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {LGAS.map(lgaName => {
                   const disp = stationDispositions.find(d => d.lga === lgaName);
                   return (
                     <div key={lgaName} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 flex flex-col group relative overflow-hidden">
                        <div className="flex justify-between items-start mb-6">
                           <div>
                             <h4 className="text-2xl font-black uppercase tracking-tighter text-slate-800">{lgaName} STATION</h4>
                             <p className="text-[8px] font-black text-emerald-700 uppercase tracking-widest">Command Sub-Unit</p>
                           </div>
                           <div className="text-right">
                             <p className="text-2xl font-black text-slate-800 leading-none">{(disp?.totalMales || 0) + (disp?.totalFemales || 0)}</p>
                             <p className="text-[8px] font-black text-slate-400 uppercase">Total Personnel</p>
                           </div>
                        </div>
                        
                        <div className="space-y-3 mb-6 flex-1">
                          {disp?.batches && disp.batches.length > 0 ? disp.batches.map((b, bi) => (
                            <div key={bi} className="flex justify-between items-center p-3 bg-white rounded-xl shadow-sm">
                               <span className="text-[10px] font-bold text-slate-600 uppercase">{b.batch}</span>
                               <div className="flex gap-4">
                                  <span className="text-[9px] font-black text-slate-400">M: {b.males}</span>
                                  <span className="text-[9px] font-black text-slate-400">F: {b.females}</span>
                                  <span className="text-[10px] font-black text-[#004d40] ml-2">{b.males + b.females}</span>
                               </div>
                            </div>
                          )) : <p className="text-center py-4 text-[8px] font-black text-slate-300 uppercase">No batch data available.</p>}
                        </div>
                        
                        <div className="pt-4 border-t-2 border-slate-200 flex justify-between items-center">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                             <span className="text-[10px] font-black text-red-600 uppercase">Total Clearance Defaulters:</span>
                           </div>
                           <span className="text-lg font-black text-red-600">{defaulterCounts[lgaName] || 0}</span>
                        </div>
                     </div>
                   );
                 })}
               </div>
            </div>
          </div>
        )}

        {/* Abscondment Alerts */}
        {abscondmentRisks.length > 0 && (
          <div className="bg-white p-6 sm:p-10 rounded-[2.5rem] border-4 border-red-500 shadow-[0_20px_50px_-12px_rgba(220,38,38,0.2)] animate-official">
            <div className="flex items-center gap-5 mb-8">
              <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg">!</div>
              <div>
                <h3 className="text-2xl font-black uppercase tracking-tighter text-red-600 leading-none mb-1 font-serif-heading">Abscondment Risk Surveillance</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Immediate Administrative Review Required</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {abscondmentRisks.map((risk: any, idx: number) => (
                <div key={idx} className={`p-5 rounded-3xl border-2 transition-all hover:scale-105 shadow-sm ${risk.count >= 3 ? 'bg-red-900 border-red-950 text-white' : 'bg-red-50 border-red-200 text-red-900'}`}>
                  <h4 className="font-black uppercase text-sm mb-1 leading-tight">{risk.name}</h4>
                  <p className="text-[10px] font-bold uppercase opacity-60 mb-4">{risk.code} • {risk.lga} STATION</p>
                  
                  <div className="space-y-3 pt-3 border-t border-black/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black uppercase opacity-60">Missed Cycles</span>
                      <span className="text-sm font-black">{risk.count} / 3</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[8px] font-black uppercase opacity-60">Countdown</span>
                      <span className={`text-xs font-black px-2 py-1 rounded-lg ${risk.daysRemaining === 0 ? 'bg-white/20 animate-pulse' : 'bg-black/5'}`}>
                        {risk.daysRemaining === 0 ? 'DUE (ABSCONDED)' : `${risk.daysRemaining} DAYS REMAINING`}
                      </span>
                    </div>
                  </div>
                  
                  <button onClick={() => handlePushToCDR(risk)} className={`w-full mt-5 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all shadow-md ${risk.count >= 3 ? 'bg-white text-red-900 hover:bg-black hover:text-white' : 'bg-red-600 text-white hover:bg-black'}`}>
                    Initiate Disciplinary Action
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#004d40] text-white p-8 rounded-[2.5rem] shadow-xl flex flex-col md:flex-row justify-between items-center gap-8">
           <div className="flex items-baseline gap-4">
             <span className="text-5xl font-black tracking-tighter leading-none">{entries.length}</span>
             <span className="text-lg font-black uppercase opacity-40 tracking-widest font-serif-heading">Audit Periods</span>
           </div>
           <button onClick={() => setIsLedgerOpen(true)} className="px-8 py-4 bg-white text-[#004d40] rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 shadow-2xl hover:bg-emerald-50 transition-all"><FileTextIcon /> Audit Action Ledger</button>
        </div>

        {entries.map((e: CIMClearance) => (
          <div key={e.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex justify-between items-center shadow-sm hover:shadow-lg transition-all group">
             <div><h4 className="text-xl font-black uppercase text-slate-800 font-serif-heading tracking-tight">{e.month}</h4><p className="text-[9px] font-black text-emerald-800 tracking-[0.2em]">{e.lga} UNIT AUDIT</p></div>
             <div className="flex gap-6 items-center">
               <div className="text-center"><span className="block text-xl font-black text-emerald-600">{e.clearedCount}</span><span className="text-[7px] font-black text-slate-400 uppercase">CLEARED</span></div>
               <div className="text-center"><span className="block text-xl font-black text-red-600">{e.unclearedList?.length || 0}</span><span className="text-[7px] font-black text-slate-400 uppercase">FLAGGED</span></div>
               <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="p-3 text-red-100 group-hover:text-red-400 hover:scale-110 transition-all"><TrashIcon /></button>
             </div>
          </div>
        ))}
      </div>

      {isLedgerOpen && (
        <div className="fixed inset-0 bg-slate-900/98 backdrop-blur-3xl z-[500] flex items-center justify-center p-4 animate-official">
          <div className="bg-white w-full max-w-6xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            <div className="bg-[#004d40] p-10 text-white flex justify-between items-center shrink-0 border-b-8 border-black/10">
               <h3 className="text-2xl font-black uppercase font-serif-heading tracking-tighter">Comprehensive Audit Ledger</h3>
               <button onClick={() => setIsLedgerOpen(false)} className="w-14 h-14 bg-white/10 hover:bg-red-600 rounded-2xl flex items-center justify-center transition-all text-xl font-black">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-10 custom-scrollbar">
               <table className="w-full border-separate border-spacing-y-4">
                  <thead><tr className="text-[10px] font-black uppercase text-slate-400 text-left"><th className="px-8 pb-4">Personnel Details</th><th className="px-8 pb-4">Unit Context</th><th className="px-8 pb-4">Administrative Action Logs</th></tr></thead>
                  <tbody>
                    {entries.reduce((acc: any[], entry: any) => [...acc, ...(entry.unclearedList || []).map((cm: any) => ({ ...cm, lga: entry.lga, month: entry.month, parentId: entry.id }))], []).map((cm: any, idx: number) => (
                      <tr key={idx} className="bg-slate-50 hover:bg-white rounded-3xl transition-all shadow-sm">
                        <td className="px-8 py-8 rounded-l-[2rem]">
                          <p className="font-black uppercase text-slate-800 text-base mb-1">{cm.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cm.code}</p>
                          {cm.logs && cm.logs.length > 0 && (
                            <div className="mt-4 space-y-2 border-t pt-3 border-slate-200">
                               <p className="text-[8px] font-black text-slate-400 uppercase mb-2">History:</p>
                               {cm.logs.map((log: CIMDefaulterLog, lidx: number) => (
                                 <div key={lidx} className="flex items-center gap-3 text-[9px] font-bold text-emerald-800 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                                    <span>{log.action}</span>
                                    <span className="opacity-30">•</span>
                                    <span className="text-slate-400 uppercase">{new Date(log.timestamp).toLocaleDateString()}</span>
                                    <span className="opacity-30">•</span>
                                    <span className="text-slate-400 uppercase">By {log.role}</span>
                                 </div>
                               ))}
                            </div>
                          )}
                        </td>
                        <td className="px-8 py-8">
                          <span className="px-4 py-2 bg-emerald-50 text-emerald-800 rounded-full text-[9px] font-black uppercase border border-emerald-100">{cm.lga} / {cm.month}</span>
                        </td>
                        <td className="px-8 py-8 rounded-r-[2rem]">
                           <div className="flex flex-wrap gap-3">
                             <button 
                               onClick={() => handleIssueQuery(cm)} 
                               disabled={isGenerating}
                               className="px-6 py-2.5 bg-[#004d40] text-white text-[9px] font-black uppercase rounded-xl shadow-lg hover:bg-black transition-all disabled:opacity-50"
                             >
                               {isGenerating ? 'Processing...' : 'Issue Formal Query'}
                             </button>
                             <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`NYSC CIM FLAG: Member ${cm.name} (${cm.code}) missed biometric clearance at ${cm.lga} Unit.`)}`)} className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><WhatsAppIcon /></button>
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = { ...formData, lga: lga || 'Daura', status: 'Pending' as CDRStatus };
    await addData(db, "cdr_cases", data);
    setFormData({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  };

  const handleFileUpload = async (id: string, field: 'responseImage' | 'evidenceDocuments', files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      if (field === 'responseImage') {
        const base64 = await fileToBase64(files[0]);
        await updateData(db, "cdr_cases", id, { [field]: base64, status: 'Responded' });
      } else {
        const base64Array = await Promise.all(Array.from(files).map(f => fileToBase64(f)));
        await updateData(db, "cdr_cases", id, { [field]: base64Array });
      }
    } catch (err) { window.alert("Upload failed."); } finally { setIsUploading(false); }
  };

  const handleStatusUpdate = async (id: string, status: CDRStatus) => {
    await updateData(db, "cdr_cases", id, { status });
  };

  const handleMinuteUpdate = async (id: string, field: 'lgiMinute' | 'ziMinute', text: string) => {
    await updateData(db, "cdr_cases", id, { [field]: text });
  };

  return (
    <>
      <div className="w-full lg:w-[340px] no-print shrink-0">
        <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 lg:sticky lg:top-40">
          <h3 className="font-black uppercase text-[8px] mb-6 pb-2 border-b-2 border-emerald-50 text-slate-400 tracking-widest text-center">Log Official Misconduct</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="PERSONNEL FULL NAME" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border text-xs" value={formData.name} onChange={e => setFormData({...formData, name: (e.target as HTMLInputElement).value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border text-xs" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: (e.target as HTMLInputElement).value.toUpperCase()})} />
            <input required placeholder="PPA" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border text-xs" value={formData.ppa} onChange={e => setFormData({...formData, ppa: (e.target as HTMLInputElement).value.toUpperCase()})} />
            <textarea required placeholder="MISCONDUCT DESCRIPTION..." className="w-full p-4 bg-slate-50 rounded-xl font-medium border h-24 text-xs" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: (e.target as HTMLTextAreaElement).value})} />
            <button className="w-full bg-[#004d40] text-white p-5 rounded-xl font-black uppercase shadow-2xl hover:bg-black transition-all text-[9px] border-b-4 border-emerald-950">Log CD&R Case</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-8">
        {entries.map((cm: CDRCase) => (
          <div key={cm.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all relative border border-slate-100 group animate-official">
             <div className="absolute top-8 right-8 flex items-center gap-4 no-print">
                <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border tracking-widest ${
                  cm.status === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                  cm.status === 'Responded' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                  cm.status === 'Forwarded_to_ZI' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                  'bg-slate-900 text-white border-slate-950'
                }`}>{cm.status?.replace(/_/g, ' ') || 'Pending'}</span>
                <button onClick={() => deleteData(db, "cdr_cases", cm.id)} className="text-red-200 hover:text-red-600 transition-all"><TrashIcon /></button>
             </div>
             <div className="mb-8"><h4 className="text-xl sm:text-2xl font-black uppercase font-serif-heading tracking-tighter text-slate-800 leading-none mb-1">{cm.name}</h4><p className="text-base font-black text-emerald-800 uppercase tracking-widest">{cm.stateCode}</p></div>
             
             <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 mb-8 shadow-inner">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-4 flex items-center gap-3"><FileTextIcon /> Incident parameters</p>
                <p className="text-slate-600 text-sm font-medium leading-relaxed italic border-l-4 border-emerald-700 pl-4">"{cm.misconduct}"</p>
                {cm.ppa && <p className="mt-4 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">PPA: {cm.ppa}</p>}
             </div>

             {userRole === 'LGI' && (cm.status === 'Pending' || cm.status === 'Responded') && (
               <div className="p-8 bg-blue-50/20 rounded-[2.5rem] border border-blue-100/50 mb-8 animate-official">
                  <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest mb-6">LGI Administrative Minute</p>
                  <div className="space-y-6">
                    <div>
                      <label className="text-[9px] font-black text-slate-400 uppercase block mb-2">Upload CM Response (Image)</label>
                      <input type="file" onChange={(e) => handleFileUpload(cm.id, 'responseImage', e.target.files)} className="text-xs" />
                      {cm.responseImage && <div className="mt-4 w-20 h-20 rounded-2xl border-4 border-white shadow-xl overflow-hidden"><img src={cm.responseImage} className="w-full h-full object-cover" /></div>}
                    </div>
                    <textarea className="w-full p-5 bg-white rounded-2xl border border-blue-50 outline-none text-xs h-24" placeholder="Enter administrative minute..." defaultValue={cm.lgiMinute} onBlur={(e) => handleMinuteUpdate(cm.id, 'lgiMinute', (e.target as HTMLTextAreaElement).value)} />
                    <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_ZI')} className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl hover:bg-black transition-all">Escalate to ZI Office</button>
                  </div>
               </div>
             )}

             <div className="flex flex-col xs:flex-row justify-between items-center border-t-2 border-slate-50 pt-8 no-print gap-6">
                <div className="flex flex-wrap gap-3 w-full xs:w-auto">
                   <select onChange={(e) => handleStatusUpdate(cm.id, (e.target as HTMLSelectElement).value as CDRStatus)} className="flex-1 xs:flex-none px-6 py-3 bg-slate-100 rounded-xl text-[9px] font-black uppercase outline-none border shadow-inner cursor-pointer" value={cm.status}><option value="Pending">Pending</option><option value="Responded">Responded</option><option value="Forwarded_to_ZI">ZI Desk</option><option value="Minuted_to_CIM">CIM Desk</option>{userRole === 'ZI' && <option value="Forwarded_to_CDR">Closed</option>}</select>
                </div>
                <div className="flex gap-4 ml-auto">
                   <button onClick={() => generateOfficialPDF(cm, 'LEDGER')} className="w-12 h-12 bg-white text-slate-400 rounded-xl flex items-center justify-center hover:text-[#004d40] transition-all shadow-md border"><DownloadIcon /></button>
                   <button className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl flex items-center justify-center hover:scale-110 transition-all shadow-md border" onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`NYSC DAURA CD&R: Member ${cm.name} (${cm.stateCode}) status updated to ${cm.status} in ${cm.lga}.`)}`)}><WhatsAppIcon /></button>
                </div>
             </div>
          </div>
        ))}
      </div>
    </>
  );
};

/* --- CDS Module --- */
const CDSModule = ({ groups, projects, lga, db, userRole }: any) => {
  const [view, setView] = useState<'GROUPS' | 'PROJECTS'>('GROUPS');
  const [groupForm, setGroupForm] = useState({ groupName: '', meetingDay: 'Wednesday' });
  const [projectForm, setProjectForm] = useState({ cmName: '', stateCode: '', projectName: '', description: '', status: 'Ongoing' as 'Ongoing' | 'Completed' });
  const handleGroupSubmit = async (e: any) => { e.preventDefault(); await addData(db, "cds_groups", { ...groupForm, lga: lga || 'Daura' }); setGroupForm({ groupName: '', meetingDay: 'Wednesday' }); };
  const handleProjectSubmit = async (e: any) => { e.preventDefault(); await addData(db, "cds_projects", { ...projectForm, lga: lga || 'Daura' }); setProjectForm({ cmName: '', stateCode: '', projectName: '', description: '', status: 'Ongoing' }); };
  return (
    <><div className="w-full lg:w-[340px] no-print shrink-0"><div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 lg:sticky lg:top-40"><div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl shadow-inner"><button onClick={() => setView('GROUPS')} className={`flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all ${view === 'GROUPS' ? 'bg-[#004d40] text-white shadow-lg' : 'text-slate-400'}`}>Units</button><button onClick={() => setView('PROJECTS')} className={`flex-1 py-3 text-[9px] font-black uppercase rounded-lg transition-all ${view === 'PROJECTS' ? 'bg-[#004d40] text-white shadow-lg' : 'text-slate-400'}`}>Projects</button></div>{view === 'GROUPS' ? (<form onSubmit={handleGroupSubmit} className="space-y-4"><h3 className="font-black uppercase text-[8px] text-slate-400 tracking-widest text-center">New Unit</h3><input required placeholder="UNIT NAME" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border-2 border-transparent outline-none focus:border-emerald-500/20 text-xs" value={groupForm.groupName} onChange={e => setGroupForm({...groupForm, groupName: (e.target as HTMLInputElement).value.toUpperCase()})} /><button className="w-full bg-[#004d40] text-white p-5 rounded-xl font-black uppercase shadow-2xl hover:bg-black transition-all text-[9px] tracking-widest border-b-4 border-emerald-950">Register Unit</button></form>) : (<form onSubmit={handleProjectSubmit} className="space-y-4"><h3 className="font-black uppercase text-[8px] text-slate-400 tracking-widest text-center">Individual Task</h3><input required placeholder="FULL NAME" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border text-xs" value={projectForm.cmName} onChange={e => setProjectForm({...projectForm, cmName: (e.target as HTMLInputElement).value.toUpperCase()})} /><input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border text-xs" value={projectForm.stateCode} onChange={e => setProjectForm({...projectForm, stateCode: (e.target as HTMLInputElement).value.toUpperCase()})} /><button className="w-full bg-[#004d40] text-white p-5 rounded-xl font-black uppercase shadow-2xl hover:bg-black transition-all text-[9px] tracking-widest border-b-4 border-emerald-950">Log Project</button></form>)}</div></div><div className="flex-1 space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6">{view === 'GROUPS' ? groups.map((g: any) => (<div key={g.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 relative group animate-official hover:shadow-xl transition-all"><div className="absolute left-0 top-0 w-2 h-full bg-[#004d40]"></div><h4 className="text-lg font-black uppercase tracking-tighter text-slate-800 leading-tight mb-1 font-serif-heading">{g.groupName}</h4><div className="flex items-center gap-3"><span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest">{g.meetingDay} Schedule</span><span className="w-1 h-1 bg-slate-200 rounded-full"></span><span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{g.lga}</span></div><button onClick={() => deleteData(db, "cds_groups", g.id)} className="absolute top-6 right-6 p-2 text-red-200 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 shadow-sm"><TrashIcon /></button></div>)) : projects.map((p: any) => (<div key={p.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 hover:shadow-xl transition-all relative group animate-official"><div className="flex justify-between items-start mb-6"><div><h4 className="text-xl font-black uppercase tracking-tighter text-slate-800 leading-none mb-1 font-serif-heading">{p.cmName}</h4><p className="text-xs font-black text-emerald-800 uppercase tracking-widest">{p.stateCode}</p></div><span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase border tracking-widest ${p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>{p.status}</span></div><div className="p-4 bg-slate-50 rounded-2xl mb-6 shadow-inner"><p className="text-[7px] font-black text-slate-400 uppercase mb-2">Project Classification</p><p className="text-base font-black text-[#004d40] uppercase leading-tight font-serif-heading">{p.projectName}</p></div><div className="flex justify-between items-center border-t pt-6"><span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{p.lga} Station</span><div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all"><button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`CDS Progress: ${p.cmName} (${p.stateCode}) is executing "${p.projectName}" in ${p.lga}. Status: ${p.status}`)}`)} className="w-10 h-10 flex items-center justify-center text-emerald-600 bg-emerald-50 rounded-xl hover:bg-emerald-100 shadow-sm transition-all"><WhatsAppIcon /></button><button onClick={() => deleteData(db, "cds_projects", p.id)} className="w-10 h-10 flex items-center justify-center text-red-400 bg-red-50 rounded-xl hover:bg-red-100 shadow-sm transition-all"><TrashIcon /></button></div></div></div>))}</div></div></>
  );
};

/* --- SAED Sub-Module --- */
const SAEDModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  const handleSubmit = async (e: any) => { e.preventDefault(); await addData(db, "saed_centers", { ...formData, lga: lga || 'Daura' }); setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 }); };
  return (
    <><div className="w-full lg:w-[340px] no-print shrink-0"><div className="bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100 lg:sticky lg:top-40"><h3 className="font-black uppercase text-[8px] mb-6 pb-2 border-b-2 border-emerald-50 text-slate-400 tracking-widest text-center">SAED Hub Registry</h3><form onSubmit={handleSubmit} className="space-y-4"><input required placeholder="HUB NAME" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border outline-none text-xs" value={formData.centerName} onChange={e => setFormData({...formData, centerName: (e.target as HTMLInputElement).value.toUpperCase()})} /><input required placeholder="ADDRESS" className="w-full p-4 bg-slate-50 rounded-xl font-bold uppercase border outline-none text-xs" value={formData.address} onChange={e => setFormData({...formData, address: (e.target as HTMLInputElement).value.toUpperCase()})} /><div className="grid grid-cols-2 gap-3"><div><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Census</label><input type="number" className="w-full p-4 bg-slate-50 rounded-xl font-bold border text-xs" value={formData.cmCount} onChange={e => setFormData({...formData, cmCount: parseInt((e.target as HTMLInputElement).value) || 0})} /></div><div><label className="text-[8px] font-black uppercase text-slate-400 ml-1">Fee (₦)</label><input type="number" className="w-full p-4 bg-slate-50 rounded-xl font-bold border text-xs" value={formData.fee} onChange={e => setFormData({...formData, fee: parseInt((e.target as HTMLInputElement).value) || 0})} /></div></div><button className="w-full bg-[#004d40] text-white p-5 rounded-xl font-black uppercase shadow-2xl hover:bg-black transition-all text-[9px] border-b-4 border-emerald-950 mt-2">Confirm SAED Hub</button></form></div></div><div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 content-start">{entries.map((c: any) => (<div key={c.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative group animate-official hover:shadow-xl transition-all hover:-translate-y-1 overflow-hidden"><div className="absolute top-0 left-0 w-3 h-full bg-[#004d40]"></div><div className="flex items-start justify-between mb-8"><div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-700 shadow-inner border border-emerald-100"><DashboardIcon /></div><button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-3 text-red-200 hover:text-red-500 transition-all hover:scale-110"><TrashIcon /></button></div><h4 className="text-lg font-black uppercase tracking-tighter text-slate-800 leading-tight mb-1 font-serif-heading">{c.centerName}</h4><p className="text-[9px] font-bold text-slate-400 uppercase mb-8 truncate tracking-widest">{c.address}</p><div className="flex gap-4 pt-6 border-t border-slate-50"><div className="flex-1"><p className="text-[8px] font-black uppercase text-slate-300 mb-1">Census</p><p className="text-xl font-black text-[#004d40]">{c.cmCount} <span className="text-[9px] opacity-30 font-bold ml-1 uppercase">CMs</span></p></div><div className="flex-1"><p className="text-[8px] font-black uppercase text-slate-300 mb-1">Revenue</p><p className="text-xl font-black text-emerald-600 tracking-tight">₦{Number(c.fee).toLocaleString()}</p></div></div><div className="absolute bottom-8 right-8"><span className="px-4 py-1 bg-slate-50 text-[8px] font-black uppercase rounded-full border border-slate-100 shadow-sm tracking-widest">{c.lga} STATION</span></div></div>))}</div></>
  );
};

export default App;

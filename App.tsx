
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
  CIMBatchDisposition
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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const downloadCSV = (data: any[], filename: string, registry: string) => {
  if (data.length === 0) return alert("No data to export.");
  
  let headersArr: string[] = [];
  if (registry === 'CWHS') headersArr = ['name', 'stateCode', 'lga', 'category', 'details', 'dateOfDeath', 'dateAdded'];
  else if (registry === 'CIM') headersArr = ['month', 'lga', 'maleCount', 'femaleCount', 'totalCMs', 'clearedCount', 'dateAdded'];
  else if (registry === 'CDR') headersArr = ['name', 'stateCode', 'lga', 'ppa', 'misconduct', 'dateOfInfraction', 'status', 'lgiMinute', 'ziMinute', 'dateAdded'];
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
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => localStorage.getItem('daura_lga') as DauraLga);
  const [ziStationFilter, setZiStationFilter] = useState<string>('all');
  const [reportingPeriod, setReportingPeriod] = useState<string>('WEEKLY');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [division, setDivision] = useState<Division>('CWHS');
  const [cwhsEntries, setCwhsEntries] = useState<CorpsMemberEntry[]>([]);
  const [cimEntries, setCimEntries] = useState<CIMClearance[]>([]);
  const [saedEntries, setSAEDEntries] = useState<SAEDCenter[]>([]);
  const [cdrEntries, setCdrEntries] = useState<CDRCase[]>([]);
  const [cdsGroups, setCdsGroups] = useState<CDSGroup[]>([]);
  const [cdsProjects, setCdsProjects] = useState<CDSPersonalProject[]>([]);
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingLogin, setPendingLogin] = useState<any>(null);

  const dbRef = useRef<any>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
            
            setTimeout(() => { 
              if (active) setIsDbLoaded(true); 
            }, 500);
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
      localStorage.setItem('daura_auth', 'true');
      localStorage.setItem('daura_role', pendingLogin.role);
      if (pendingLogin.lga) localStorage.setItem('daura_lga', pendingLogin.lga);
    } else {
      alert("Invalid Security PIN.");
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    location.reload();
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

  const handleGenerateComprehensiveReport = () => {
    const reportData = {
      period: reportingPeriod,
      sections: {
        cwhs: filteredData.cwhs.map(d => [d.name, d.stateCode, d.lga, d.category]),
        cim: filteredData.cim.map(d => [d.month, d.lga, d.clearedCount, d.unclearedList?.length || 0]),
        cdr: filteredData.cdr.map(d => [d.name, d.stateCode, d.lga, d.status]),
        saed: filteredData.saed.map(d => [d.centerName, d.lga, d.cmCount, d.fee]),
        cdsGroups: filteredData.cdsGroups.map(d => [d.groupName, d.lga, d.meetingDay]),
        cdsProjects: filteredData.cdsProjects.map(d => [d.cmName, d.stateCode, d.projectName, d.status])
      }
    };
    generateOfficialPDF(reportData, 'COMPREHENSIVE');
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 sm:p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-950 via-slate-900 to-black">
        <form onSubmit={handleLogin} className="bg-white p-6 sm:p-12 rounded-3xl sm:rounded-[3.5rem] shadow-2xl w-full max-w-xl space-y-6 sm:space-y-10 animate-official border-[6px] sm:border-[10px] border-emerald-950/10">
          <div className="text-center">
            <div className="w-16 h-16 sm:w-24 h-24 bg-[#004d40] rounded-2xl sm:rounded-[2rem] mx-auto mb-4 sm:mb-8 flex items-center justify-center shadow-2xl ring-4 sm:ring-8 ring-emerald-50 text-white font-serif-heading text-2xl sm:text-4xl font-black italic">NYSC</div>
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2 font-serif-heading">Command Portal</h1>
            <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Secure Administrative Terminal</p>
          </div>
          <div className="space-y-4 sm:space-y-6">
            <select required className="w-full p-4 sm:p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl sm:rounded-[1.5rem] font-bold text-slate-900 outline-none text-sm sm:text-base" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Command Center...</option>
                <option value="ZI">Zonal Office (ZI)</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Station (LGI)</option>)}
            </select>
            <input type="password" required placeholder="PIN CODE" className="w-full p-4 sm:p-6 bg-slate-50 border-2 border-slate-100 rounded-2xl sm:rounded-[1.5rem] text-center text-2xl sm:text-4xl font-black tracking-[0.3em] sm:tracking-[0.5em] outline-none" value={pin} onChange={e => setPin(e.target.value)} />
          </div>
          <button className="w-full bg-[#004d40] text-white p-4 sm:p-6 rounded-2xl sm:rounded-[1.5rem] font-black uppercase shadow-2xl hover:bg-black transition-all text-base sm:text-xl tracking-widest border-b-4 sm:border-b-8 border-emerald-950">Authenticate</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col font-inter pb-20 sm:pb-40">
      <nav className="bg-transparent pt-4 sm:pt-6 flex justify-center gap-1 no-print px-2 sm:px-4">
        {[
          { id: 'CWHS', label: 'CW&HS' },
          { id: 'CIM', label: 'CIM' },
          { id: 'CDR', label: 'CD&R' },
          { id: 'CDS', label: 'CDS' },
          { id: 'SAED', label: 'SAED' }
        ].map(d => (
          <button 
            key={d.id}
            onClick={() => setDivision(d.id as Division)}
            className={`flex-1 sm:flex-none px-4 sm:px-12 py-3 rounded-t-2xl sm:rounded-t-[1.5rem] transition-all font-black uppercase text-[9px] sm:text-[11px] tracking-widest ${division === d.id ? 'bg-[#004d40] text-white' : 'bg-white/80 text-slate-400 hover:bg-white'}`}
          >
            {d.label}
          </button>
        ))}
      </nav>

      <header className="bg-[#004d40] text-white py-4 sm:py-5 px-4 sm:px-8 shadow-2xl mx-2 sm:mx-8 rounded-2xl sm:rounded-[1.5rem] flex flex-col lg:flex-row items-center justify-between no-print border-b-4 border-black/10 relative z-50 gap-4">
        <div className="flex items-center gap-4 sm:gap-6 w-full lg:w-auto">
          <div className="w-10 h-10 sm:w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/5 cursor-pointer hover:bg-white/20 transition-all shrink-0">
            <DashboardIcon />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-2xl font-black uppercase tracking-tighter font-serif-heading leading-none">
                NYSC ZONAL OFFICE, DAURA
              </h1>
              {!isOnline && (
                <span className="bg-orange-500 text-white text-[7px] px-2 py-0.5 rounded-full font-black animate-pulse">OFFLINE</span>
              )}
            </div>
            <p className="text-[7px] sm:text-[8px] font-black text-emerald-400 tracking-[0.2em] uppercase mt-1 opacity-70 italic">
              KATSINA STATE SECRETARIAT MANAGEMENT SYSTEM
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3 sm:gap-4 w-full lg:w-auto">
          {userRole === 'ZI' ? (
            <div className="flex flex-wrap gap-2 sm:gap-4 w-full lg:w-auto justify-center">
              <div className="bg-white/10 border border-white/10 rounded-xl flex items-center px-3 sm:px-4 overflow-hidden">
                <select value={reportingPeriod} onChange={e => setReportingPeriod(e.target.value)} className="bg-transparent text-[8px] sm:text-[10px] font-black uppercase outline-none py-2 sm:py-3 pr-2 sm:pr-4 border-r border-white/10">
                  <option value="WEEKLY" className="text-slate-900">WEEKLY</option>
                  <option value="MONTHLY" className="text-slate-900">MONTHLY</option>
                  <option value="QUARTERLY" className="text-slate-900">QUARTERLY</option>
                </select>
                <button onClick={handleGenerateComprehensiveReport} className="flex items-center gap-2 pl-3 sm:pl-4 text-[8px] sm:text-[10px] font-black uppercase text-emerald-300 hover:text-white transition-colors">
                  <FileTextIcon /> <span className="hidden xs:inline">GENERATE REPORT</span>
                </button>
              </div>
              <div className="bg-white/10 border border-white/10 rounded-xl flex items-center px-3 sm:px-4">
                <select value={ziStationFilter} onChange={e => setZiStationFilter(e.target.value)} className="bg-transparent text-[8px] sm:text-[10px] font-black uppercase outline-none py-2 sm:py-3">
                  <option value="all" className="text-slate-900">GLOBAL VIEW</option>
                  {LGAS.map(l => <option key={l} value={l} className="text-slate-900">{l}</option>)}
                </select>
              </div>
            </div>
          ) : (
             <div className="bg-emerald-900/40 px-4 sm:px-6 py-2 sm:py-3 rounded-xl border border-emerald-500/20 text-[8px] sm:text-[10px] font-black uppercase tracking-widest">
               {lgaContext} STATION
             </div>
          )}
          
          <button onClick={() => setIsExportModalOpen(true)} className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-white/10 hover:bg-white/20 border border-white/5 rounded-xl transition-all font-black uppercase text-[8px] sm:text-[10px] tracking-widest shadow-inner">
            <DownloadIcon /> <span className="hidden md:inline">BULK EXPORT</span>
          </button>
          
          <button onClick={handleLogout} className="p-2 sm:p-3 bg-white/5 hover:bg-red-600/40 rounded-xl border border-white/5 transition-all">
            <LogOutIcon />
          </button>
        </div>
      </header>

      <main className="max-w-[1500px] mx-auto w-full px-4 sm:px-8 mt-6 sm:mt-12 flex flex-col gap-6 sm:gap-8">
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-12">
           {!isDbLoaded ? (
             <div className="w-full flex flex-col items-center justify-center py-20 sm:py-40 gap-4 text-slate-300">
               <div className="w-10 h-10 sm:w-12 h-12 border-4 border-slate-100 border-t-[#004d40] rounded-full animate-spin"></div>
               <p className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest">Initialising Secure Link...</p>
             </div>
           ) : (
             <>
               {division === 'CWHS' && <CWHSModule entries={filteredData.cwhs} lga={lgaContext!} db={dbRef.current} />}
               {division === 'CIM' && <CIMModule entries={filteredData.cim} lga={lgaContext!} db={dbRef.current} cdrCases={cdrEntries} userRole={userRole} />}
               {division === 'CDR' && <CDRModule entries={filteredData.cdr} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
               {division === 'CDS' && <CDSModule groups={filteredData.cdsGroups} projects={filteredData.cdsProjects} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
               {division === 'SAED' && <SAEDModule entries={filteredData.saed} lga={lgaContext!} db={dbRef.current} />}
             </>
           )}
        </div>
      </main>

      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6" onClick={() => setIsExportModalOpen(false)}>
          <div className="bg-white p-6 sm:p-12 rounded-[2rem] sm:rounded-[3.5rem] w-full max-w-xl shadow-2xl animate-official max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
             <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter text-[#004d40] mb-6 sm:mb-8 text-center sm:text-left">Registry Extraction Terminal</h2>
             <div className="space-y-3 sm:space-y-4">
               {[
                 { id: 'CWHS', label: 'CW&HS Health Registry', data: cwhsEntries, headers: ['Name', 'Code', 'LGA', 'Category'], extract: (d: any) => [d.name, d.stateCode, d.lga, d.category] },
                 { id: 'CIM', label: 'CIM Audit Records', data: cimEntries, headers: ['Month', 'LGA', 'Cleared', 'Defaulters'], extract: (d: any) => [d.month, d.lga, d.clearedCount, d.unclearedList?.length || 0] },
                 { id: 'CDR', label: 'CD&R Misconduct Logs', data: cdrEntries, headers: ['Name', 'Code', 'PPA', 'Status'], extract: (d: any) => [d.name, d.stateCode, d.ppa, d.status] },
                 { id: 'CDS_GROUPS', label: 'CDS Group Registry', data: cdsGroups, headers: ['Group Name', 'LGA', 'Meeting Day'], extract: (d: any) => [d.groupName, d.lga, d.meetingDay] },
                 { id: 'CDS_PROJECTS', label: 'CDS Personal Projects', data: cdsProjects, headers: ['CM Name', 'Code', 'Project Name', 'Status'], extract: (d: any) => [d.cmName, d.stateCode, d.projectName, d.status] },
                 { id: 'SAED', label: 'SAED Center Hubs', data: saedEntries, headers: ['Center', 'LGA', 'Enrollment', 'Fee'], extract: (d: any) => [d.centerName, d.lga, d.cmCount, d.fee] }
               ].map(m => (
                 <div key={m.id} className="w-full p-4 sm:p-6 bg-slate-50 rounded-2xl border border-transparent flex flex-col sm:flex-row justify-between items-center gap-4">
                    <span className="font-black uppercase tracking-widest text-[10px] sm:text-sm text-center sm:text-left">{m.label}</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => downloadCSV(m.data, m.id, m.id)}
                        className="p-3 bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors flex items-center gap-2 text-[10px] font-black uppercase"
                      >
                        <DownloadIcon /> CSV
                      </button>
                      <button 
                        onClick={() => generateOfficialPDF({ title: m.label, headers: m.headers, rows: m.data.map(m.extract) }, 'LEDGER')}
                        className="p-3 bg-[#004d40] text-white rounded-xl hover:bg-black transition-colors flex items-center gap-2 text-[10px] font-black uppercase"
                      >
                        <FileTextIcon /> PDF
                      </button>
                    </div>
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
const CWHSModule = ({ entries, lga, db }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const submissionData = { ...formData, lga: lga || 'Daura' };
    if (formData.category !== ReportCategory.DECEASED) submissionData.dateOfDeath = '';
    await addData(db, "nysc_reports", submissionData);
    setFormData({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });
  };

  return (
    <>
      <div className="w-full lg:w-[350px] no-print shrink-0">
        <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-slate-100 lg:sticky lg:top-40">
          <h3 className="font-black uppercase text-[9px] sm:text-[10px] mb-8 sm:mb-12 pb-4 border-b border-slate-50 text-slate-400 tracking-widest text-center lg:text-left">Official Entry Form</h3>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <input required placeholder="FULL NAME" className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-bold uppercase placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-emerald-50 transition-all border border-slate-100 text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-bold uppercase placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-emerald-50 transition-all border border-slate-100 text-sm" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <div className="space-y-2 px-1">
              <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Record Category</label>
              <select className="w-full p-4 sm:p-5 bg-[#f8fafc] rounded-2xl font-bold border border-slate-100 outline-none appearance-none cursor-pointer text-sm" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {formData.category === ReportCategory.DECEASED && (
              <div className="space-y-2 px-1 animate-official">
                <label className="text-[8px] font-black uppercase text-red-600 tracking-widest">Date of Death</label>
                <input type="date" required className="w-full p-4 sm:p-5 bg-red-50/30 rounded-2xl font-bold border border-red-100 outline-none focus:ring-4 focus:ring-red-100 transition-all text-sm" value={formData.dateOfDeath} onChange={e => setFormData({...formData, dateOfDeath: e.target.value})} />
              </div>
            )}
            <textarea placeholder="CASE NARRATIVE..." className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-medium placeholder:text-slate-300 outline-none h-24 sm:h-32 transition-all border border-slate-100 text-sm" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-5 sm:p-7 rounded-[1.2rem] sm:rounded-[1.5rem] font-black uppercase shadow-2xl hover:bg-black transition-all text-[10px] sm:text-xs tracking-[0.2em] border-b-4 sm:border-b-8 border-emerald-950">Submit to Registry</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-6 sm:space-y-8">
        {entries.map((e: any) => (
          <div key={e.id} className="bg-white p-6 sm:p-12 rounded-[2rem] sm:rounded-[3.5rem] shadow-sm hover:shadow-xl transition-all relative border border-slate-100 group animate-official">
            <div className="absolute top-6 sm:top-12 right-6 sm:right-12 flex gap-4 sm:gap-6 opacity-40 group-hover:opacity-100 transition-opacity no-print">
               <button className="hover:text-emerald-700" onClick={() => generateOfficialPDF(e, 'SINGLE_CWHS')} title="Download PDF"><DownloadIcon /></button>
               <input type="checkbox" className="w-5 h-5 sm:w-6 h-6 rounded-lg accent-[#004d40]" />
            </div>
            <div className="flex flex-col sm:flex-row justify-between items-start mb-4 sm:mb-6 gap-4">
              <div>
                <h4 className="text-2xl sm:text-4xl font-black uppercase font-serif-heading tracking-tighter text-slate-800 leading-none mb-1">{e.name}</h4>
                <p className="text-sm sm:text-base font-black text-emerald-800 uppercase tracking-[0.1em] sm:tracking-[0.2em]">{e.stateCode}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
               <span className={`px-4 sm:px-5 py-2 text-[8px] sm:text-[9px] font-black uppercase rounded-full border ${e.category === ReportCategory.DECEASED ? 'bg-red-900 text-white border-red-950' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>{e.category}</span>
               <span className="px-4 sm:px-5 py-2 text-[8px] sm:text-[9px] font-black uppercase rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">{e.lga}</span>
            </div>
            <div className="p-4 border-l-4 border-slate-100 italic text-slate-400 font-serif-heading text-lg sm:text-xl mb-8 sm:mb-12 leading-snug">"{e.details || 'No narrative provided.'}"</div>
            <div className="flex justify-end gap-2 sm:gap-3 pt-4 sm:pt-6 border-t border-slate-50 no-print">
               <button 
                className="w-10 h-10 sm:w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl sm:rounded-2xl flex items-center justify-center hover:bg-emerald-100 hover:scale-110 transition-all" 
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(`NYSC DAURA REPORT: ${e.name} (${e.stateCode}) - ${e.category}. Details: ${e.details}`)}`);
                }}
               >
                 <WhatsAppIcon />
               </button>
               <button onClick={() => generateOfficialPDF(e, 'SINGLE_CWHS')} className="w-10 h-10 sm:w-12 h-12 bg-slate-50 text-slate-700 rounded-xl sm:rounded-2xl flex items-center justify-center hover:bg-slate-200 hover:scale-110 transition-all"><FileTextIcon /></button>
               <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="w-10 h-10 sm:w-12 h-12 bg-red-50 text-red-500 rounded-xl sm:rounded-2xl flex items-center justify-center hover:bg-red-100 hover:scale-110 transition-all"><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

/* --- CIM Module --- */
const CIMModule = ({ entries, db, lga, cdrCases, userRole }: any) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0 });
  const [batchInput, setBatchInput] = useState({ batch: '', males: 0, females: 0 });
  const [tempBatchList, setTempBatchList] = useState<CIMBatchDisposition[]>([]);
  const [unclearedInput, setUnclearedInput] = useState({ name: '', code: '', reason: '' });
  const [tempUnclearedList, setTempUnclearedList] = useState<{name: string, code: string, reason: string}[]>([]);
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const total = Number(formData.maleCount) + Number(formData.femaleCount);
    const data = { ...formData, totalCMs: total, lga: lga || 'Daura', unclearedList: tempUnclearedList, disposition: tempBatchList };
    await addData(db, "cim_clearance", data);
    setFormData({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0 });
    setTempUnclearedList([]);
    setTempBatchList([]);
  };

  const allDefaulters = useMemo(() => {
    return entries.reduce((acc: any[], entry: any) => {
      const list = (entry.unclearedList || []).map((cm: any) => ({ ...cm, lga: entry.lga, month: entry.month }));
      return [...acc, ...list];
    }, []);
  }, [entries]);

  return (
    <>
      <div className="w-full lg:w-[350px] no-print shrink-0">
        <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-slate-100 lg:sticky lg:top-40 max-h-[85vh] overflow-y-auto">
          <h3 className="font-black uppercase text-[9px] sm:text-[10px] mb-8 pb-4 border-b border-slate-50 text-slate-400 tracking-widest text-center lg:text-left">CIM Audit Entry</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="AUDIT MONTH" className="w-full p-4 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 text-sm" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value.toUpperCase()})} />
            
            <div className="border-t pt-4">
              <h4 className="text-[8px] font-black uppercase text-emerald-800 mb-2 ml-2">Batch Disposition</h4>
              <div className="space-y-2 bg-slate-50 p-3 rounded-2xl">
                <input placeholder="BATCH (e.g. 2025 BATCH A)" className="w-full p-3 bg-white rounded-xl text-[10px] font-bold" value={batchInput.batch} onChange={e => setBatchInput({...batchInput, batch: e.target.value.toUpperCase()})} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="MALES" className="w-full p-3 bg-white rounded-xl text-[10px] font-bold" value={batchInput.males} onChange={e => setBatchInput({...batchInput, males: parseInt(e.target.value) || 0})} />
                  <input type="number" placeholder="FEMALES" className="w-full p-3 bg-white rounded-xl text-[10px] font-bold" value={batchInput.females} onChange={e => setBatchInput({...batchInput, females: parseInt(e.target.value) || 0})} />
                </div>
                <button type="button" onClick={() => { if(batchInput.batch) { setTempBatchList([...tempBatchList, {...batchInput}]); setBatchInput({batch:'',males:0,females:0}); } }} className="w-full p-2 bg-emerald-100 text-emerald-700 rounded-xl text-[8px] font-black uppercase hover:bg-emerald-200">Add Batch ({tempBatchList.length})</button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
               <div><label className="text-[7px] font-black uppercase text-slate-400 ml-2">Total Males</label><input type="number" className="w-full p-3 bg-[#f8fafc] rounded-2xl font-bold border border-slate-100 text-sm" value={formData.maleCount} onChange={e => setFormData({...formData, maleCount: parseInt(e.target.value) || 0})} /></div>
               <div><label className="text-[7px] font-black uppercase text-slate-400 ml-2">Total Females</label><input type="number" className="w-full p-3 bg-[#f8fafc] rounded-2xl font-bold border border-slate-100 text-sm" value={formData.femaleCount} onChange={e => setFormData({...formData, femaleCount: parseInt(e.target.value) || 0})} /></div>
            </div>
            <div><label className="text-[7px] font-black uppercase text-slate-400 ml-2">Cleared Count</label><input type="number" className="w-full p-4 bg-[#f8fafc] rounded-2xl font-bold border border-slate-100 text-sm" value={formData.clearedCount} onChange={e => setFormData({...formData, clearedCount: parseInt(e.target.value) || 0})} /></div>
            
            <div className="border-t pt-4">
               <h4 className="text-[8px] font-black uppercase text-red-800 mb-3 ml-2">Add Defaulter</h4>
               <div className="space-y-2">
                  <input placeholder="MEMBER NAME" className="w-full p-3 bg-slate-50 rounded-xl text-[10px] font-bold" value={unclearedInput.name} onChange={e => setUnclearedInput({...unclearedInput, name: e.target.value.toUpperCase()})} />
                  <input placeholder="STATE CODE" className="w-full p-3 bg-slate-50 rounded-xl text-[10px] font-bold" value={unclearedInput.code} onChange={e => setUnclearedInput({...unclearedInput, code: e.target.value.toUpperCase()})} />
                  <textarea placeholder="REASON" className="w-full p-3 bg-slate-50 rounded-xl text-[10px] h-16" value={unclearedInput.reason} onChange={e => setUnclearedInput({...unclearedInput, reason: e.target.value})} />
                  <button type="button" onClick={() => { if(unclearedInput.name) { setTempUnclearedList([...tempUnclearedList, {...unclearedInput}]); setUnclearedInput({name:'',code:'',reason:''}); } }} className="w-full p-2 bg-slate-100 rounded-xl text-[8px] font-black uppercase">Add to List ({tempUnclearedList.length})</button>
               </div>
            </div>

            <button className="w-full bg-[#004d40] text-white p-4 rounded-[1.2rem] font-black uppercase shadow-xl hover:bg-black transition-all text-[10px] border-b-4 border-emerald-950">Publish Audit</button>
          </form>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="bg-[#004d40] text-white p-6 rounded-[2rem] shadow-2xl flex flex-col justify-center border-b-8 border-black/20">
           <span className="text-[8px] font-black uppercase tracking-[0.4em] opacity-60 mb-2">Audit Aggregator</span>
           <div className="flex flex-col md:flex-row justify-between items-end gap-6">
             <span className="text-4xl sm:text-7xl font-black tracking-tighter leading-none">{allDefaulters.length} <span className="text-lg opacity-50 uppercase">Flagged</span></span>
             <button onClick={() => setIsLedgerOpen(true)} className="px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
               <FileTextIcon /> Defaulter Ledger
             </button>
           </div>
        </div>

        {entries.map((e: CIMClearance) => (
          <div key={e.id} className="bg-white p-6 rounded-[2rem] shadow-sm hover:shadow-xl transition-all border border-slate-100">
             <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <div><h4 className="text-xl font-black uppercase text-slate-800">{e.month}</h4><p className="text-[9px] font-black text-emerald-800 uppercase">{e.lga} Command</p></div>
                <div className="flex gap-4 text-center">
                   <div className="px-4 border-r"><span className="block text-lg font-black text-emerald-600">{e.clearedCount}</span><span className="text-[7px] font-black text-slate-400 uppercase">Cleared</span></div>
                   <div className="px-4"><span className="block text-lg font-black text-red-600">{e.unclearedList?.length || 0}</span><span className="text-[7px] font-black text-slate-400 uppercase">Defaulters</span></div>
                </div>
             </div>
             {e.disposition && e.disposition.length > 0 && (
               <div className="mb-4">
                 <p className="text-[7px] font-black uppercase text-slate-300 mb-2">Population Disposition</p>
                 <div className="flex flex-wrap gap-2">
                   {e.disposition.map((batch, idx) => (
                     <div key={idx} className="px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col">
                       <span className="text-[8px] font-black uppercase text-emerald-900">{batch.batch}</span>
                       <span className="text-[7px] font-bold text-emerald-700">M: {batch.males} | F: {batch.females}</span>
                     </div>
                   ))}
                 </div>
               </div>
             )}
             <div className="flex justify-end gap-3 no-print">
                <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="p-2 text-red-300 hover:text-red-600"><TrashIcon /></button>
             </div>
          </div>
        ))}
      </div>

      {isLedgerOpen && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-3xl z-[300] flex items-center justify-center p-6 animate-official">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-[90vh]">
            <div className="bg-[#004d40] p-8 text-white flex justify-between items-center shrink-0">
               <div><h3 className="text-2xl font-black uppercase">Detailed Defaulters Ledger</h3></div>
               <button onClick={() => setIsLedgerOpen(false)} className="w-12 h-12 bg-white/10 hover:bg-red-600 rounded-full flex items-center justify-center transition-all">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-8">
               <table className="w-full border-separate border-spacing-y-2">
                  <thead><tr className="text-[10px] font-black uppercase text-slate-400 text-left"><th className="px-6">Member Identity</th><th className="px-6">Station / Period</th><th className="px-6">Reason</th></tr></thead>
                  <tbody>
                    {allDefaulters.map((cm: any, idx: number) => (
                      <tr key={idx} className="bg-slate-50 rounded-xl"><td className="px-6 py-4 font-black uppercase text-slate-800">{cm.name} <span className="text-slate-400 text-[9px]">{cm.code}</span></td><td className="px-6 py-4 text-[10px] font-bold uppercase">{cm.lga} / {cm.month}</td><td className="px-6 py-4 italic text-slate-500 text-[10px]">"{cm.reason}"</td></tr>
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

/* --- CDS Module --- */
const CDSModule = ({ groups, projects, lga, db, userRole }: any) => {
  const [view, setView] = useState<'GROUPS' | 'PROJECTS'>('GROUPS');
  const [groupForm, setGroupForm] = useState({ groupName: '', meetingDay: 'Wednesday' });
  const [projectForm, setProjectForm] = useState({ cmName: '', stateCode: '', projectName: '', description: '', status: 'Ongoing' as 'Ongoing' | 'Completed' });

  const handleGroupSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "cds_groups", { ...groupForm, lga: lga || 'Daura' });
    setGroupForm({ groupName: '', meetingDay: 'Wednesday' });
  };

  const handleProjectSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "cds_projects", { ...projectForm, lga: lga || 'Daura' });
    setProjectForm({ cmName: '', stateCode: '', projectName: '', description: '', status: 'Ongoing' });
  };

  return (
    <>
      <div className="w-full lg:w-[350px] no-print shrink-0">
        <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-slate-100 lg:sticky lg:top-40">
          <div className="flex gap-2 mb-8 p-1 bg-slate-50 rounded-xl">
            <button onClick={() => setView('GROUPS')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${view === 'GROUPS' ? 'bg-[#004d40] text-white shadow-lg' : 'text-slate-400'}`}>Groups</button>
            <button onClick={() => setView('PROJECTS')} className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all ${view === 'PROJECTS' ? 'bg-[#004d40] text-white shadow-lg' : 'text-slate-400'}`}>Projects</button>
          </div>
          
          {view === 'GROUPS' ? (
            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <h3 className="font-black uppercase text-[9px] text-slate-400 tracking-widest text-center">New CDS Group</h3>
              <input required placeholder="GROUP NAME" className="w-full p-4 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 text-sm" value={groupForm.groupName} onChange={e => setGroupForm({...groupForm, groupName: e.target.value.toUpperCase()})} />
              <select className="w-full p-4 bg-[#f8fafc] rounded-2xl font-bold border border-slate-100 text-sm" value={groupForm.meetingDay} onChange={e => setGroupForm({...groupForm, meetingDay: e.target.value})}>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
              </select>
              <button className="w-full bg-[#004d40] text-white p-5 rounded-[1.5rem] font-black uppercase shadow-xl hover:bg-black transition-all text-[10px] border-b-4 border-emerald-950">Add Group</button>
            </form>
          ) : (
            <form onSubmit={handleProjectSubmit} className="space-y-4">
              <h3 className="font-black uppercase text-[9px] text-slate-400 tracking-widest text-center">Personal CDS Project</h3>
              <input required placeholder="CORPS MEMBER NAME" className="w-full p-4 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 text-sm" value={projectForm.cmName} onChange={e => setProjectForm({...projectForm, cmName: e.target.value.toUpperCase()})} />
              <input required placeholder="STATE CODE" className="w-full p-4 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 text-sm" value={projectForm.stateCode} onChange={e => setProjectForm({...projectForm, stateCode: e.target.value.toUpperCase()})} />
              <input required placeholder="PROJECT TITLE" className="w-full p-4 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 text-sm" value={projectForm.projectName} onChange={e => setProjectForm({...projectForm, projectName: e.target.value.toUpperCase()})} />
              <textarea placeholder="PROJECT DESCRIPTION..." className="w-full p-4 bg-[#f8fafc] rounded-2xl font-medium border border-slate-100 h-24 text-sm" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} />
              <select className="w-full p-4 bg-[#f8fafc] rounded-2xl font-bold border border-slate-100 text-sm" value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value as any})}>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
              </select>
              <button className="w-full bg-[#004d40] text-white p-5 rounded-[1.5rem] font-black uppercase shadow-xl hover:bg-black transition-all text-[10px] border-b-4 border-emerald-950">Log Project</button>
            </form>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {view === 'GROUPS' ? (
            groups.map((g: CDSGroup) => (
              <div key={g.id} className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center group animate-official">
                <div>
                  <h4 className="text-xl font-black uppercase tracking-tighter text-slate-800">{g.groupName}</h4>
                  <p className="text-[8px] font-black text-emerald-800 uppercase tracking-widest mt-1">{g.meetingDay} Meetings</p>
                  <span className="inline-block mt-3 px-3 py-1 bg-slate-50 text-[7px] font-black uppercase rounded-full border border-slate-100">{g.lga}</span>
                </div>
                <button onClick={() => deleteData(db, "cds_groups", g.id)} className="p-3 text-red-100 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"><TrashIcon /></button>
              </div>
            ))
          ) : (
            projects.map((p: CDSPersonalProject) => (
              <div key={p.id} className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 relative group animate-official">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="text-xl font-black uppercase tracking-tighter text-slate-800 leading-none">{p.cmName}</h4>
                    <p className="text-[10px] font-black text-emerald-800 uppercase mt-1">{p.stateCode}</p>
                  </div>
                  <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase border ${p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-orange-50 text-orange-700 border-orange-100'}`}>{p.status}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl mb-4">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Project Title</p>
                  <p className="text-sm font-black text-[#004d40] uppercase leading-tight">{p.projectName}</p>
                </div>
                <p className="text-[10px] text-slate-500 italic line-clamp-2 mb-6">"{p.description || 'No description provided.'}"</p>
                <div className="flex justify-between items-center border-t pt-4">
                  <span className="text-[8px] font-black text-slate-300 uppercase">{p.lga} STATION</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`NYSC CDS PROJECT: ${p.cmName} is carrying out "${p.projectName}" in ${p.lga}. Status: ${p.status}`)}`)} className="p-2 text-emerald-600 bg-emerald-50 rounded-lg"><WhatsAppIcon /></button>
                    <button onClick={() => deleteData(db, "cds_projects", p.id)} className="p-2 text-red-600 bg-red-50 rounded-lg"><TrashIcon /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {(view === 'GROUPS' ? groups.length === 0 : projects.length === 0) && (
          <div className="py-20 text-center border-4 border-dashed border-slate-200 rounded-[3rem] text-slate-300 font-black uppercase tracking-widest italic text-sm">Registry Clean</div>
        )}
      </div>
    </>
  );
};

/* --- SAED Sub-Module --- */
const SAEDModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "saed_centers", { ...formData, lga: lga || 'Daura' });
    setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 });
  };

  return (
    <>
      <div className="w-full lg:w-[350px] no-print shrink-0">
        <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-slate-100 lg:sticky lg:top-40">
          <h3 className="font-black uppercase text-[9px] sm:text-[10px] mb-8 sm:mb-12 pb-4 border-b border-slate-50 text-slate-400 tracking-widest text-center lg:text-left">Register SAED Center</h3>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <input required placeholder="CENTER NAME" className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 outline-none text-sm" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
            <input required placeholder="HUB ADDRESS" className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 outline-none text-sm" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
               <div><label className="text-[7px] sm:text-[8px] font-black uppercase text-slate-400 ml-2">Enrolled CMs</label><input type="number" className="w-full p-3 sm:p-4 bg-[#f8fafc] rounded-2xl font-bold border border-slate-100 text-sm" value={formData.cmCount} onChange={e => setFormData({...formData, cmCount: parseInt(e.target.value) || 0})} /></div>
               <div><label className="text-[7px] sm:text-[8px] font-black uppercase text-slate-400 ml-2">Monthly Fee (₦)</label><input type="number" className="w-full p-3 sm:p-4 bg-[#f8fafc] rounded-2xl font-bold border border-slate-100 text-sm" value={formData.fee} onChange={e => setFormData({...formData, fee: parseInt(e.target.value) || 0})} /></div>
            </div>
            <button className="w-full bg-[#004d40] text-white p-5 sm:p-7 rounded-[1.2rem] sm:rounded-[1.5rem] font-black uppercase shadow-2xl hover:bg-black transition-all text-[10px] sm:text-xs border-b-4 sm:border-b-8 border-emerald-950">Add Center to Hub</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 content-start">
        {entries.map((c: any) => (
          <div key={c.id} className="bg-white p-8 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] shadow-sm border border-slate-100 relative group animate-official">
             <div className="flex items-start justify-between mb-6 sm:mb-8">
                <div className="w-12 h-12 sm:w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-700">
                   <DashboardIcon />
                </div>
                <button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-2 sm:p-3 text-red-200 hover:text-red-600 transition-colors"><TrashIcon /></button>
             </div>
             <h4 className="text-xl sm:text-2xl font-black uppercase tracking-tighter text-slate-800 leading-tight mb-2">{c.centerName}</h4>
             <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mb-6 sm:mb-8 truncate">{c.address}</p>
             
             <div className="flex gap-4 pt-4 sm:pt-6 border-t border-slate-50">
                <div className="flex-1">
                   <p className="text-[7px] sm:text-[8px] font-black uppercase text-slate-300">Enrollment</p>
                   <p className="text-lg sm:text-xl font-black text-[#004d40]">{c.cmCount} <span className="text-[8px] sm:text-[10px] opacity-40 uppercase">Members</span></p>
                </div>
                <div className="flex-1">
                   <p className="text-[7px] sm:text-[8px] font-black uppercase text-slate-300">Revenue (Hub)</p>
                   <p className="text-lg sm:text-xl font-black text-emerald-600">₦{Number(c.fee).toLocaleString()}</p>
                </div>
             </div>
             
             <div className="absolute bottom-6 sm:bottom-10 right-6 sm:right-10">
                <span className="px-3 sm:px-4 py-1.5 sm:py-2 bg-slate-50 text-[7px] sm:text-[8px] font-black uppercase rounded-full border border-slate-100">{c.lga}</span>
             </div>
          </div>
        ))}
        {entries.length === 0 && <div className="col-span-full py-20 sm:py-40 text-center border-4 border-dashed border-slate-200 rounded-[2rem] sm:rounded-[3.5rem] text-slate-300 font-black uppercase tracking-widest italic text-sm">Skill Acquisition Registry Clean</div>}
      </div>
    </>
  );
};

/* --- CDR Module remains unchanged except for the status restriction in handleStatusUpdate --- */
const CDRModule = ({ entries, lga, db, userRole }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  const [activeQuery, setActiveQuery] = useState<{ id: string, text: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const data = { ...formData, lga: lga || 'Daura', status: 'Pending' as CDRStatus };
    await addData(db, "cdr_cases", data);
    setFormData({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  };

  const handleGenerateQuery = async (cm: CDRCase) => {
    setIsGenerating(true);
    try {
      const queryText = await generateDisciplinaryQuery(cm.name, cm.stateCode, cm.ppa, cm.misconduct);
      setActiveQuery({ id: cm.id, text: queryText });
      await updateData(db, "cdr_cases", cm.id, { responseContent: queryText });
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (id: string, field: 'responseImage' | 'evidenceDocuments', files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      if (field === 'responseImage') {
        const base64 = await fileToBase64(files[0]);
        await updateData(db, "cdr_cases", id, { [field]: base64 });
      } else {
        const base64Array = await Promise.all(Array.from(files).map(f => fileToBase64(f)));
        await updateData(db, "cdr_cases", id, { [field]: base64Array });
      }
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: CDRStatus) => {
    await updateData(db, "cdr_cases", id, { status });
  };

  const handleMinuteUpdate = async (id: string, field: 'lgiMinute' | 'ziMinute', text: string) => {
    await updateData(db, "cdr_cases", id, { [field]: text });
  };

  return (
    <>
      <div className="w-full lg:w-[350px] no-print shrink-0">
        <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-xl border border-slate-100 lg:sticky lg:top-40">
          <h3 className="font-black uppercase text-[9px] sm:text-[10px] mb-8 sm:mb-12 pb-4 border-b border-slate-50 text-slate-400 tracking-widest text-center lg:text-left">Misconduct Reporting</h3>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <input required placeholder="MEMBER FULL NAME" className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 outline-none text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 outline-none text-sm" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <input required placeholder="PLACE OF ASSIGNMENT" className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-bold uppercase border border-slate-100 outline-none text-sm" value={formData.ppa} onChange={e => setFormData({...formData, ppa: e.target.value.toUpperCase()})} />
            <input type="date" required className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-bold border border-slate-100 outline-none text-sm" value={formData.dateOfInfraction} onChange={e => setFormData({...formData, dateOfInfraction: e.target.value})} />
            <textarea required placeholder="SPECIFIC MISCONDUCT DETAILS..." className="w-full p-4 sm:p-6 bg-[#f8fafc] rounded-2xl font-medium border border-slate-100 h-24 sm:h-32 outline-none text-sm" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-5 sm:p-6 rounded-[1.2rem] sm:rounded-[1.5rem] font-black uppercase shadow-2xl hover:bg-black transition-all text-[10px] sm:text-xs tracking-[0.2em] border-b-4 sm:border-b-8 border-emerald-950">File Disciplinary Report</button>
          </form>
        </div>
      </div>

      <div className="flex-1 space-y-6 sm:space-y-8">
        <div className="bg-white p-6 sm:p-12 rounded-[2rem] sm:rounded-[4rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-6">
           <div className="text-center sm:text-left">
             <h3 className="text-2xl sm:text-4xl font-black uppercase font-serif-heading text-[#004d40]">Active CDR Cases</h3>
             <p className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Disciplinary Surveillance</p>
           </div>
           <div className="flex gap-4">
              <div className="text-center px-4 sm:px-6 py-2 sm:py-3 bg-slate-50 rounded-2xl border">
                 <p className="text-xl sm:text-2xl font-black text-slate-800">{entries.length}</p>
                 <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase">Total Cases</p>
              </div>
           </div>
        </div>

        {entries.map((cm: CDRCase) => (
          <div key={cm.id} className="bg-white p-6 sm:p-12 rounded-[2rem] sm:rounded-[3.5rem] shadow-sm hover:shadow-2xl transition-all relative border border-slate-100 group animate-official">
             <div className="absolute top-6 sm:top-12 right-6 sm:right-12 flex items-center gap-4 sm:gap-6 no-print">
                <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[7px] sm:text-[9px] font-black uppercase border ${
                  cm.status === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' :
                  cm.status === 'Responded' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                  cm.status === 'Forwarded_to_ZI' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                  'bg-indigo-50 text-indigo-600 border-indigo-100'
                }`}>
                  {cm.status?.replace(/_/g, ' ') || 'Pending'}
                </span>
                <button onClick={() => deleteData(db, "cdr_cases", cm.id)} className="text-red-300 hover:text-red-500"><TrashIcon /></button>
             </div>

             <div className="mb-6 sm:mb-8 mt-6 sm:mt-0">
                <h4 className="text-2xl sm:text-4xl font-black uppercase font-serif-heading tracking-tighter text-slate-800 leading-none mb-1">{cm.name}</h4>
                <p className="text-base sm:text-lg font-black text-emerald-800 uppercase tracking-tighter">{cm.stateCode}</p>
                <p className="text-[8px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2 truncate">PPA: {cm.ppa}</p>
             </div>

             <div className="p-4 sm:p-8 bg-slate-50 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-100 mb-6 sm:mb-10">
                <p className="text-[7px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 flex items-center gap-2">
                   <FileTextIcon /> Incident Report ({cm.dateOfInfraction})
                </p>
                <p className="text-slate-600 text-sm sm:text-base font-medium leading-relaxed italic">"{cm.misconduct}"</p>
             </div>

             {cm.responseContent && (
               <div className="p-6 sm:p-10 bg-emerald-50/30 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 border-emerald-100/50 mb-6 sm:mb-10 animate-official">
                  <p className="text-[7px] sm:text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-4 sm:mb-6 flex justify-between items-center">
                     <span>Formal Query Data</span>
                     <button onClick={() => generateOfficialPDF(cm, 'CDR_QUERY')} className="bg-emerald-100 px-3 py-1 rounded-lg text-emerald-700 text-[8px] font-black uppercase hover:bg-emerald-200">Download Official PDF</button>
                  </p>
                  <pre className="text-[10px] sm:text-xs font-official-document text-slate-700 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                     {cm.responseContent}
                  </pre>
               </div>
             )}

             {userRole === 'LGI' && (cm.status === 'Pending' || cm.status === 'Responded') && (
               <div className="p-6 sm:p-10 bg-blue-50/30 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 border-blue-100/50 mb-6 sm:mb-10 animate-official">
                  <p className="text-[7px] sm:text-[9px] font-black text-blue-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <PlusIcon /> RESPONSE UPLOAD
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label className="text-[7px] font-black text-slate-400 uppercase block mb-2">Member Response Photo</label>
                      <input type="file" accept="image/*" onChange={(e) => handleFileUpload(cm.id, 'responseImage', e.target.files)} className="text-[7px] w-full" />
                      {cm.responseImage && <div className="mt-2 w-12 h-12 rounded-lg bg-blue-100 border overflow-hidden"><img src={cm.responseImage} className="w-full h-full object-cover" /></div>}
                    </div>
                    <div>
                      <label className="text-[7px] font-black text-slate-400 uppercase block mb-2">Evidence Documents</label>
                      <input type="file" accept="image/*" multiple onChange={(e) => handleFileUpload(cm.id, 'evidenceDocuments', e.target.files)} className="text-[7px] w-full" />
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-6">
                    <label className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase block mb-2">LGI Administrative Minute</label>
                    <textarea 
                      className="w-full p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl text-xs font-medium border border-blue-100 outline-none h-20 sm:h-24"
                      placeholder="Observation and recommendation..."
                      defaultValue={cm.lgiMinute || ''}
                      onBlur={(e) => handleMinuteUpdate(cm.id, 'lgiMinute', e.target.value)}
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button 
                      onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_ZI')}
                      className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-blue-600 text-white rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg"
                    >
                      Minute to ZI
                    </button>
                  </div>
               </div>
             )}

             {userRole === 'ZI' && (cm.status === 'Forwarded_to_ZI' || cm.status === 'Minuted_to_CIM') && (
               <div className="p-6 sm:p-10 bg-indigo-50/30 rounded-[1.5rem] sm:rounded-[2.5rem] border-2 border-indigo-100/50 mb-6 sm:mb-10 animate-official">
                  <p className="text-[7px] sm:text-[9px] font-black text-indigo-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                     <FileTextIcon /> ZI ADMINISTRATIVE REVIEW
                  </p>
                  <div className="mb-4">
                      <p className="text-[6px] sm:text-[8px] font-black text-slate-400 uppercase mb-1">LGI Minute:</p>
                      <p className="text-[10px] sm:text-xs italic text-slate-600 line-clamp-2">"{cm.lgiMinute || 'No LGI Minute'}"</p>
                  </div>
                  <div>
                    <label className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase block mb-2">ZI Administrative Instruction</label>
                    <textarea 
                      className="w-full p-4 sm:p-6 bg-white rounded-xl sm:rounded-2xl text-xs font-medium border border-indigo-100 outline-none h-20 sm:h-24"
                      placeholder="Enter instruction for CIM..."
                      defaultValue={cm.ziMinute || ''}
                      onBlur={(e) => handleMinuteUpdate(cm.id, 'ziMinute', e.target.value)}
                    />
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button 
                      onClick={() => handleStatusUpdate(cm.id, 'Minuted_to_CIM')}
                      className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-indigo-600 text-white rounded-xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest shadow-lg"
                    >
                      Process to CIM
                    </button>
                  </div>
               </div>
             )}

             <div className="flex flex-col xs:flex-row justify-between items-center border-t border-slate-50 pt-6 sm:pt-8 no-print gap-4">
                <div className="flex flex-wrap gap-2 w-full xs:w-auto">
                   {userRole === 'ZI' && cm.status === 'Pending' && (
                     <button 
                       onClick={() => handleGenerateQuery(cm)} 
                       disabled={isGenerating}
                       className="flex-1 xs:flex-none px-4 sm:px-6 py-2 sm:py-3 bg-[#004d40] text-white rounded-xl font-black uppercase text-[8px] sm:text-[10px] tracking-widest disabled:opacity-50"
                     >
                        {isGenerating ? '...' : 'AI FORMAL QUERY'}
                     </button>
                   )}
                   <select 
                      onChange={(e) => handleStatusUpdate(cm.id, e.target.value as CDRStatus)}
                      className="flex-1 xs:flex-none px-3 sm:px-4 py-2 sm:py-3 bg-slate-100 rounded-xl text-[8px] sm:text-[10px] font-black uppercase outline-none"
                      value={cm.status}
                    >
                       <option value="Pending">Pending</option>
                       <option value="Responded">Responded</option>
                       <option value="Forwarded_to_ZI">ZI Desk</option>
                       <option value="Minuted_to_CIM">CIM Desk</option>
                       {userRole === 'ZI' && <option value="Forwarded_to_CDR">Closed/Archive</option>}
                    </select>
                </div>
                <div className="flex gap-2 sm:gap-3 ml-auto">
                   <button className="w-10 h-10 sm:w-12 h-12 bg-emerald-50 text-emerald-700 rounded-xl sm:rounded-2xl flex items-center justify-center hover:bg-emerald-100" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`NYSC CDR CASE: ${cm.name} (${cm.stateCode}). Status: ${cm.status}`)}`)} title="Share via WhatsApp"><WhatsAppIcon /></button>
                   <button onClick={() => generateOfficialPDF(cm, 'CDR_QUERY')} className="w-10 h-10 sm:w-12 h-12 bg-slate-50 text-slate-700 rounded-xl sm:rounded-2xl flex items-center justify-center hover:bg-slate-200" title="Download Query PDF"><FileTextIcon /></button>
                </div>
             </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default App;

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ReportCategory, 
  CorpsMemberEntry, 
  DauraLga,
  UserRole,
  Division,
  CIMClearance,
  SAEDCenter,
  CDRCase
} from './types';
import { 
  PlusIcon, 
  WhatsAppIcon, 
  LogOutIcon, 
  TrashIcon, 
  FileTextIcon, 
  SearchIcon,
  DashboardIcon,
  DownloadIcon,
} from './components/Icons';
import { initFirebase, subscribeToCollection, addData, deleteData } from './services/firebaseService';
import { generateDisciplinaryQuery } from './services/geminiService';

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

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => localStorage.getItem('daura_lga') as DauraLga);
  const [ziStationFilter, setZiStationFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [division, setDivision] = useState<Division>('CWHS');
  const [cwhsEntries, setCwhsEntries] = useState<CorpsMemberEntry[]>([]);
  const [cimEntries, setCimEntries] = useState<CIMClearance[]>([]);
  const [saedEntries, setSAEDEntries] = useState<SAEDCenter[]>([]);
  const [cdrEntries, setCdrEntries] = useState<CDRCase[]>([]);
  
  const [activeQuery, setActiveQuery] = useState<{ content: string, cm: any, lga: string, ppa: string } | null>(null);
  const [printData, setPrintData] = useState<{ title: string; items: any[]; type: Division | 'GAZETTE' } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [reportFrequency, setReportFrequency] = useState<'Weekly' | 'Monthly' | 'Quarterly'>('Weekly');
  
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<any>(null);

  const dbRef = useRef<any>(null);

  useEffect(() => {
    if (isAuthenticated) {
      try {
        const db = initFirebase(firebaseConfig);
        dbRef.current = db;
        
        if (db) {
          const unsub1 = subscribeToCollection(db, "nysc_reports", setCwhsEntries);
          const unsub2 = subscribeToCollection(db, "cim_clearance", setCimEntries);
          const unsub3 = subscribeToCollection(db, "saed_centers", setSAEDEntries);
          const unsub4 = subscribeToCollection(db, "cdr_cases", setCdrEntries);
          return () => { 
            unsub1(); unsub2(); unsub3(); unsub4(); 
          };
        }
      } catch (err) {
        console.error("Setup error in App:", err);
      }
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
      setLoginError(true);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    location.reload();
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    
    const applySearch = (item: any, type: Division) => {
      if (!q) return true;
      const searchTerms = [
        item.name,
        item.stateCode,
        item.code, // for CIM items
        item.lga,
        item.category,
        item.centerName,
        item.ppa,
        item.misconduct
      ].filter(Boolean).map(s => String(s).toLowerCase());

      return searchTerms.some(term => term.includes(q));
    };

    const filterFn = (items: any[], type: Division) => {
      let filtered = items;
      if (userRole === 'LGI') filtered = filtered.filter(i => i.lga === lgaContext);
      else if (ziStationFilter !== 'all') filtered = filtered.filter(i => i.lga === ziStationFilter);
      
      return filtered.filter(item => applySearch(item, type));
    };

    return {
      cwhs: filterFn(cwhsEntries, 'CWHS'),
      cim: filterFn(cimEntries, 'CIM'),
      saed: filterFn(saedEntries, 'SAED'),
      cdr: filterFn(cdrEntries, 'CDR')
    };
  }, [cwhsEntries, cimEntries, saedEntries, cdrEntries, userRole, lgaContext, ziStationFilter, searchQuery]);

  const handleGenerateReport = (frequency: 'Weekly' | 'Monthly' | 'Quarterly') => {
    setPrintData({
      title: `${frequency} Official Report`,
      items: [
        { section: 'Section A: CW&HS Welfare Records', data: filteredData.cwhs, type: 'CWHS' },
        { section: 'Section B: CIM Audit Records', data: filteredData.cim, type: 'CIM' },
        { section: 'Section C: CDR Discipline Registry', data: filteredData.cdr, type: 'CDR' },
        { section: 'Section D: SAED Hub Publication', data: filteredData.saed, type: 'SAED' }
      ],
      type: 'GAZETTE'
    });
  };

  if (printData) {
    return (
      <div className="min-h-screen bg-white p-6 md:p-12 font-official-document text-slate-900 overflow-auto">
        <div className="max-w-5xl mx-auto border-2 border-slate-200 p-10 shadow-sm print-shadow-none">
          <div className="flex justify-between items-start mb-8 pb-4 border-b-4 border-emerald-800">
            <div className="flex items-start gap-4">
              <div className="w-24 h-24">
                <img src="/nyscLogo.png" alt="NYSC Logo" className="w-full h-auto object-contain" />
              </div>
              <div className="text-left mt-2">
                <h1 className="text-xl md:text-2xl font-black text-emerald-800 tracking-tighter leading-none mb-1 font-serif-heading uppercase whitespace-nowrap">NATIONAL YOUTH SERVICE CORPS</h1>
                <p className="text-lg md:text-xl font-bold text-red-600 uppercase tracking-widest leading-none font-serif-heading">Katsina State Secretariat</p>
                <p className="text-sm font-black text-slate-800 uppercase mt-2 tracking-tighter">DAURA ZONAL OFFICE</p>
              </div>
            </div>
            <div className="text-right text-xs font-bold text-slate-700 leading-tight">
              <p>Mani Road, Katsina</p>
              <p>Katsina State</p>
              <p className="mt-4 font-black text-emerald-900 uppercase">Date: {new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              <p className="mt-1">REF: NYSC/KTS/DAU/OFF/{new Date().getFullYear()}/001</p>
            </div>
          </div>

          <div className="mb-12 text-center">
            <h2 className="text-4xl font-black uppercase border-y-4 border-slate-900 py-6 mb-8 font-serif-heading tracking-widest leading-tight">
              {printData.title}
            </h2>
            <p className="text-xs font-bold italic text-slate-500 uppercase">Classified Information - For Official Use Only</p>
          </div>

          {printData.type === 'GAZETTE' ? (
            <div className="space-y-16">
              {printData.items.map((section: any, sIdx: number) => (
                <div key={sIdx} className="break-inside-avoid">
                  <h3 className="text-2xl font-black uppercase text-emerald-900 border-b-2 border-emerald-900 mb-6 pb-2 font-serif-heading">
                    {section.section}
                  </h3>
                  <table className="w-full text-xs border-collapse border border-slate-400">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-400 p-3 text-left w-12">S/N</th>
                        {section.type === 'CWHS' && <>
                          <th className="border border-slate-400 p-3 text-left">CM Name</th>
                          <th className="border border-slate-400 p-3 text-left">State Code</th>
                          <th className="border border-slate-400 p-3 text-left">Status</th>
                          <th className="border border-slate-400 p-3 text-left">LGA</th>
                        </>}
                        {section.type === 'CIM' && <>
                          <th className="border border-slate-400 p-3 text-left">Month</th>
                          <th className="border border-slate-400 p-3 text-left">Verified</th>
                          <th className="border border-slate-400 p-3 text-left">LGA</th>
                        </>}
                        {section.type === 'CDR' && <>
                          <th className="border border-slate-400 p-3 text-left">CM Name</th>
                          <th className="border border-slate-400 p-3 text-left">Code</th>
                          <th className="border border-slate-400 p-3 text-left">Misconduct</th>
                          <th className="border border-slate-400 p-3 text-left">LGA</th>
                        </>}
                        {section.type === 'SAED' && <>
                          <th className="border border-slate-400 p-3 text-left">Hub Name</th>
                          <th className="border border-slate-400 p-3 text-left">Enrollment</th>
                          <th className="border border-slate-400 p-3 text-left">LGA</th>
                        </>}
                      </tr>
                    </thead>
                    <tbody>
                      {section.data.length === 0 ? (
                        <tr><td colSpan={5} className="p-4 text-center italic text-slate-400">No records found for this period.</td></tr>
                      ) : (
                        section.data.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="border border-slate-400 p-3 text-center">{idx + 1}</td>
                            {section.type === 'CWHS' && <>
                              <td className="border border-slate-400 p-3 font-bold">{item.name}</td>
                              <td className="border border-slate-400 p-3">{item.stateCode}</td>
                              <td className="border border-slate-400 p-3 uppercase font-black text-[9px]">{item.category}</td>
                              <td className="border border-slate-400 p-3 italic">{item.lga}</td>
                            </>}
                            {section.type === 'CIM' && <>
                              <td className="border border-slate-400 p-3 font-bold">{item.month}</td>
                              <td className="border border-slate-400 p-3">{item.clearedCount} CMs</td>
                              <td className="border border-slate-400 p-3">{item.lga}</td>
                            </>}
                            {section.type === 'CDR' && <>
                              <td className="border border-slate-400 p-3 font-bold">{item.name}</td>
                              <td className="border border-slate-400 p-3">{item.stateCode}</td>
                              <td className="border border-slate-400 p-3 text-[10px]">{item.misconduct}</td>
                              <td className="border border-slate-400 p-3">{item.lga}</td>
                            </>}
                            {section.type === 'SAED' && <>
                              <td className="border border-slate-400 p-3 font-bold">{item.centerName}</td>
                              <td className="border border-slate-400 p-3">{item.cmCount} Registered</td>
                              <td className="border border-slate-400 p-3">{item.lga}</td>
                            </>}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-300 p-3 text-left">S/N</th>
                    {printData.type === 'CWHS' && <>
                      <th className="border border-slate-300 p-3 text-left">Name</th>
                      <th className="border border-slate-300 p-3 text-left">State Code</th>
                      <th className="border border-slate-300 p-3 text-left">Category</th>
                      <th className="border border-slate-300 p-3 text-left">LGA</th>
                    </>}
                    {printData.type === 'CIM' && <>
                      <th className="border border-slate-300 p-3 text-left">Month</th>
                      <th className="border border-slate-300 p-3 text-left">LGA</th>
                      <th className="border border-slate-300 p-3 text-left">Cleared</th>
                      <th className="border border-slate-300 p-3 text-left">Uncleared</th>
                    </>}
                    {printData.type === 'SAED' && <>
                      <th className="border border-slate-300 p-3 text-left">Hub Name</th>
                      <th className="border border-slate-300 p-3 text-left">Location</th>
                      <th className="border border-slate-300 p-3 text-left">Enrolled</th>
                    </>}
                    {printData.type === 'CDR' && <>
                      <th className="border border-slate-300 p-3 text-left">Name</th>
                      <th className="border border-slate-300 p-3 text-left">State Code</th>
                      <th className="border border-slate-300 p-3 text-left">Misconduct</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {printData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 p-3">{idx + 1}</td>
                      {printData.type === 'CWHS' && <>
                        <td className="border border-slate-300 p-3">{item.name}</td>
                        <td className="border border-slate-300 p-3">{item.stateCode}</td>
                        <td className="border border-slate-300 p-3">{item.category} {item.dateOfDeath ? `(${item.dateOfDeath})` : ''}</td>
                        <td className="border border-slate-300 p-3">{item.lga}</td>
                      </>}
                      {printData.type === 'CIM' && <>
                        <td className="border border-slate-300 p-3">{item.month}</td>
                        <td className="border border-slate-300 p-3">{item.lga}</td>
                        <td className="border border-slate-300 p-3">{item.clearedCount}</td>
                        <td className="border border-slate-300 p-3">{item.unclearedList?.length || 0}</td>
                      </>}
                      {printData.type === 'SAED' && <>
                        <td className="border border-slate-300 p-3">{item.centerName}</td>
                        <td className="border border-slate-300 p-3">{item.address}</td>
                        <td className="border border-slate-300 p-3">{item.cmCount}</td>
                      </>}
                      {printData.type === 'CDR' && <>
                        <td className="border border-slate-300 p-3">{item.name}</td>
                        <td className="border border-slate-300 p-3">{item.stateCode}</td>
                        <td className="border border-slate-300 p-3">{item.misconduct}</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col items-end mt-24 break-inside-avoid">
            <div className="w-64 border-b-2 border-slate-900 mb-2"></div>
            <p className="font-black uppercase text-sm tracking-tight">
              {userRole === 'ZI' ? 'Zonal Inspector' : `(LGI ${lgaContext} for Zonal Inspector)`}
            </p>
            <p className="text-xs text-slate-500 font-bold uppercase mt-2">National Youth Service Corps</p>
            <p className="text-[10px] text-slate-400 italic">For: State Coordinator, Katsina</p>
          </div>

          <div className="mt-20 flex justify-center gap-6 no-print">
            <button onClick={() => setPrintData(null)} className="px-10 py-4 bg-slate-200 text-slate-900 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-300 transition-all">Close</button>
            <button onClick={() => window.print()} className="px-10 py-4 bg-emerald-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-xl flex items-center gap-3">
              <FileTextIcon /> Print Document
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeQuery) {
    const activeCode = activeQuery.cm.stateCode || activeQuery.cm.code || 'N/A';
    return (
      <div className="min-h-screen bg-slate-200 p-4 md:p-12 flex flex-col items-center overflow-auto">
        <div className="max-w-4xl w-full bg-white shadow-2xl p-10 md:p-16 relative overflow-hidden font-official-document text-slate-900 print-shadow-none document-page animate-official border border-slate-300">
          <div className="flex justify-between items-start mb-10 pb-4 border-b-4 border-emerald-800">
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center p-1">
                <img src="/nyscLogo.png" alt="NYSC Logo" className="w-full h-auto object-contain" />
              </div>
              <div className="text-left mt-2">
                <h1 className="text-2xl font-black text-emerald-800 tracking-tighter leading-none mb-1 font-serif-heading uppercase">NATIONAL YOUTH SERVICE CORPS</h1>
                <p className="text-base font-bold text-red-600 uppercase tracking-widest font-serif-heading">Katsina State Secretariat</p>
              </div>
            </div>
            <div className="text-right text-[10px] font-bold text-slate-700 leading-tight pt-2">
              <p>Mani Road, Katsina</p>
              <p>Katsina State</p>
              <p className="mt-2 text-slate-400">Ref: {activeCode}/QRY/{new Date().getFullYear()}</p>
            </div>
          </div>
          
          <div className="whitespace-pre-wrap leading-relaxed text-base mb-20 px-4">
            {activeQuery.content}
          </div>

          <div className="flex flex-col items-end space-y-2 font-bold mb-20 mr-4">
            <div className="w-48 border-b-2 border-slate-900"></div>
            <p className="uppercase text-sm">
              {userRole === 'ZI' ? 'Zonal Inspector' : `(LGI ${lgaContext} for Zonal Inspector)`}
            </p>
            <p className="uppercase text-xs text-slate-500">For: State Coordinator (Katsina)</p>
          </div>

          <div className="mt-20 flex justify-between no-print pt-10 border-t border-slate-200">
            <button onClick={() => setActiveQuery(null)} className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 border border-slate-300">Discard</button>
            <div className="flex gap-4">
               <button onClick={() => window.print()} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-black shadow-xl flex items-center gap-3">
                <FileTextIcon /> Print to PDF
              </button>
              <button 
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Official Query - ${activeQuery.cm.name}\n\n${activeQuery.content}`)}`, '_blank')}
                className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-emerald-700 shadow-xl flex items-center gap-3"
              >
                <WhatsAppIcon /> Share WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900 via-slate-900 to-black">
        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[3rem] shadow-2xl w-full max-w-xl space-y-10 animate-official border-8 border-emerald-900/10">
          <div className="text-center">
            <div className="w-24 h-24 bg-emerald-900 rounded-full mx-auto mb-8 flex items-center justify-center shadow-2xl ring-8 ring-emerald-50 text-white font-serif-heading text-3xl font-black italic">NYSC</div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2 font-serif-heading">Secretariat Portal</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">Administrative Access</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-600 ml-2">Command Center</label>
              <select required className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-700 outline-none appearance-none text-lg" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Station...</option>
                <option value="ZI">Zonal Office (ZI)</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Station (LGI)</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-600 ml-2">Security PIN</label>
              <input type="password" required placeholder="PIN" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-center text-4xl font-black tracking-[0.5em] focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-700 outline-none transition-all shadow-inner" value={pin} onChange={e => setPin(e.target.value)} />
            </div>
          </div>
          <button className="w-full bg-emerald-900 text-white p-6 rounded-[1.5rem] font-black uppercase shadow-2xl hover:bg-black transition-all active:scale-95 text-xl tracking-widest border-b-8 border-emerald-950">Authenticate</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-inter text-slate-900">
      {isExportModalOpen && (
        <ExportTerminalModal 
          onClose={() => setIsExportModalOpen(false)}
          data={{ cwhsEntries, cimEntries, saedEntries, cdrEntries }}
        />
      )}

      <header className="bg-emerald-950 text-white p-6 shadow-2xl flex flex-col md:flex-row justify-between items-center no-print sticky top-0 z-50 border-b-4 border-emerald-800">
        <div className="flex items-center gap-6 mb-4 md:mb-0">
          <div className="p-4 bg-emerald-800 rounded-3xl shadow-xl border border-emerald-500/50 scale-110">
            <DashboardIcon />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 font-serif-heading">
              {userRole === 'ZI' ? 'NYSC Zonal Office, Daura' : `${lgaContext?.toUpperCase()} Station Office`}
            </h1>
            <p className="text-xs font-bold text-emerald-400/80 tracking-widest uppercase italic">Katsina State Secretariat Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {userRole === 'ZI' && (
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-emerald-800 border-2 border-emerald-500/50 rounded-2xl p-1 shadow-xl">
                 <select 
                   className="bg-transparent text-white font-black uppercase text-[10px] tracking-widest px-4 py-3 outline-none cursor-pointer"
                   value={reportFrequency}
                   onChange={(e) => setReportFrequency(e.target.value as any)}
                 >
                   <option value="Weekly">Weekly</option>
                   <option value="Monthly">Monthly</option>
                   <option value="Quarterly">Quarterly</option>
                 </select>
                 <button 
                  onClick={() => handleGenerateReport(reportFrequency)}
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-700 hover:bg-emerald-600 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest group"
                  title="Generate Official Report"
                >
                  <FileTextIcon />
                  Generate Report
                </button>
              </div>
              <select 
                className="w-full md:w-auto bg-emerald-900 border-emerald-700 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase text-emerald-300 outline-none hover:border-emerald-400 transition-all cursor-pointer shadow-lg"
                value={ziStationFilter}
                onChange={(e) => setZiStationFilter(e.target.value)}
              >
                <option value="all">Global Zonal View</option>
                {LGAS.map(l => <option key={l} value={l}>{l.toUpperCase()} STATION</option>)}
              </select>
            </div>
          )}
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-6 py-4 bg-white/10 hover:bg-white/20 border border-white/5 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest shadow-inner"
            title="Export Terminal"
          >
            <DownloadIcon /> <span className="hidden lg:inline">Export Terminal</span>
          </button>
          <button onClick={handleLogout} className="p-5 bg-white/10 rounded-2xl hover:bg-red-600/40 transition-all border border-white/5 shadow-inner"><LogOutIcon /></button>
        </div>
      </header>

      <nav className="bg-white border-b-8 border-slate-200 p-4 md:p-8 flex justify-center gap-6 no-print overflow-x-auto shadow-sm">
        {[
          { id: 'CWHS', label: 'CW&HS', sub: 'Welfare & Health' },
          { id: 'CIM', label: 'CIM', sub: 'Inspection & Monitoring' },
          { id: 'CDR', label: 'CD&R', sub: 'Discipline & Rewards' },
          { id: 'SAED', label: 'SAED', sub: 'Skill Acquisition' }
        ].map(d => (
          <button 
            key={d.id}
            onClick={() => {
              setDivision(d.id as Division);
              setSearchQuery('');
            }}
            className={`px-12 py-6 rounded-[2rem] text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap group relative overflow-hidden ${division === d.id ? `bg-emerald-900 text-white border-b-8 border-emerald-950` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <div className="flex flex-col items-center">
              <span>{d.label}</span>
              <span className={`text-[10px] font-bold mt-1 ${division === d.id ? 'text-emerald-300/60' : 'text-slate-400'}`}>{d.sub}</span>
            </div>
          </button>
        ))}
      </nav>

      <div className="max-w-[1200px] mx-auto w-full px-4 md:px-12 -mt-10 mb-8 no-print z-40 relative">
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-10 flex items-center pointer-events-none text-slate-400 group-focus-within:text-emerald-600 transition-colors">
            <SearchIcon />
          </div>
          <input 
            type="text" 
            placeholder={`Search ${division} Registry (Name, State Code, Keyword)...`}
            className="w-full bg-white border-4 border-slate-200 rounded-[3rem] py-8 pl-24 pr-12 text-xl font-bold text-slate-900 shadow-2xl focus:ring-[12px] focus:ring-emerald-500/10 focus:border-emerald-700 outline-none transition-all placeholder:text-slate-300 placeholder:font-black placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-10 flex items-center text-slate-300 hover:text-red-500 transition-colors"
            >
              <span className="text-[10px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4">Reset Search</span>
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-12 pt-4 space-y-12">
        {division === 'CWHS' && (
          <CWHSModule 
            entries={filteredData.cwhs} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')}
            setPrintView={(data: any) => setPrintData(data)}
            userRole={userRole}
          />
        )}
        {division === 'CIM' && (
          <CIMModule 
            entries={filteredData.cim} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')}
            onGenerateQuery={async (cm: any, lga: string) => {
              const ppa = prompt(`Enter ${cm.name}'s PPA (Place of Primary Assignment):`, "Local Government Secretariat");
              if (!ppa) return;
              setIsGenerating(true);
              try {
                const content = await generateDisciplinaryQuery(cm.name, cm.code || cm.stateCode || 'N/A', ppa, cm.reason || 'Biometric Violation');
                setActiveQuery({ content, cm, lga, ppa });
              } finally {
                setIsGenerating(false);
              }
            }}
            loading={isGenerating}
            setPrintView={(data: any) => setPrintData(data)}
            userRole={userRole}
          />
        )}
        {division === 'CDR' && (
          <CDRModule 
            entries={filteredData.cdr} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')}
            onGenerateQuery={async (cm: any, lga: string) => {
              setIsGenerating(true);
              try {
                const content = await generateDisciplinaryQuery(cm.name, cm.stateCode, cm.ppa, cm.misconduct);
                setActiveQuery({ content, cm, lga, ppa: cm.ppa });
              } finally {
                setIsGenerating(false);
              }
            }}
            loading={isGenerating}
            setPrintView={(data: any) => setPrintData(data)}
            userRole={userRole}
          />
        )}
        {division === 'SAED' && (
          <SAEDModule 
            entries={filteredData.saed} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')}
            setPrintView={(data: any) => setPrintData(data)}
            userRole={userRole}
          />
        )}
      </main>
    </div>
  );
};

// --- Utilities ---

const downloadCSV = (data: any[], filename: string, headers: string[]) => {
  if (data.length === 0) {
    alert("No data found for the selected range/division.");
    return;
  }
  const csvContent = "data:text/csv;charset=utf-8," 
    + headers.join(",") + "\n"
    + data.map(row => headers.map(h => {
        const val = row[h] !== undefined ? row[h] : '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Export Terminal Modal ---

const ExportTerminalModal = ({ onClose, data }: { onClose: () => void, data: any }) => {
  const [selectedDivisions, setSelectedDivisions] = useState<Division[]>(['CWHS']);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [includeCIMDetails, setIncludeCIMDetails] = useState(false);

  const toggleDivision = (div: Division) => {
    setSelectedDivisions(prev => prev.includes(div) ? prev.filter(d => d !== div) : [...prev, div]);
  };

  const handleExport = () => {
    selectedDivisions.forEach(div => {
      let source: any[] = [];
      let headers: string[] = [];
      let filename = `${div}_Export_${new Date().toISOString().split('T')[0]}`;

      switch(div) {
        case 'CWHS': 
          source = data.cwhsEntries; 
          headers = ['name', 'stateCode', 'category', 'dateOfDeath', 'details', 'lga', 'dateAdded'];
          break;
        case 'CIM': 
          if (includeCIMDetails) {
            // Expansion logic for uncleared CMs
            const expanded: any[] = [];
            data.cimEntries.forEach((audit: any) => {
              if (audit.unclearedList && audit.unclearedList.length > 0) {
                audit.unclearedList.forEach((cm: any) => {
                  expanded.push({
                    month: audit.month,
                    lga: audit.lga,
                    auditDate: audit.dateAdded,
                    uncleared_name: cm.name,
                    uncleared_code: cm.code,
                    uncleared_reason: cm.reason
                  });
                });
              } else {
                expanded.push({
                  month: audit.month,
                  lga: audit.lga,
                  auditDate: audit.dateAdded,
                  uncleared_name: 'N/A',
                  uncleared_code: 'N/A',
                  uncleared_reason: 'None'
                });
              }
            });
            source = expanded;
            headers = ['month', 'lga', 'auditDate', 'uncleared_name', 'uncleared_code', 'uncleared_reason'];
            filename = `CIM_Detailed_Uncleared_${new Date().toISOString().split('T')[0]}`;
          } else {
            source = data.cimEntries; 
            headers = ['month', 'lga', 'clearedCount', 'maleCount', 'femaleCount', 'dateAdded'];
          }
          break;
        case 'CDR': 
          source = data.cdrEntries; 
          headers = ['name', 'stateCode', 'ppa', 'misconduct', 'dateAdded'];
          break;
        case 'SAED': 
          source = data.saedEntries; 
          headers = ['centerName', 'address', 'cmCount', 'fee', 'dateAdded'];
          break;
      }

      const filtered = source.filter(item => {
        const dateKey = div === 'CIM' && includeCIMDetails ? 'auditDate' : 'dateAdded';
        const itemDate = item[dateKey] ? item[dateKey].split('T')[0] : '';
        const afterStart = !dateRange.start || itemDate >= dateRange.start;
        const beforeEnd = !dateRange.end || itemDate <= dateRange.end;
        return afterStart && beforeEnd;
      });

      downloadCSV(filtered, filename, headers);
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[100] flex items-center justify-center p-4 md:p-8 animate-official">
      <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]">
        <div className="bg-emerald-950 p-8 text-white flex justify-between items-center border-b-4 border-emerald-800">
          <div>
            <h2 className="text-3xl font-black uppercase tracking-tighter font-serif-heading">Centralized Export Terminal</h2>
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mt-1">Cross-Division Data Reclamation Service</p>
          </div>
          <button onClick={onClose} className="p-4 hover:bg-white/10 rounded-full transition-all text-emerald-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="p-10 space-y-12 overflow-y-auto">
          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] border-b pb-2">1. Select Divisions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['CWHS', 'CIM', 'CDR', 'SAED'].map((div) => (
                <button 
                  key={div}
                  onClick={() => toggleDivision(div as Division)}
                  className={`p-6 rounded-3xl border-2 transition-all text-center ${selectedDivisions.includes(div as Division) ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-lg' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'}`}
                >
                  <span className="block text-xl font-black">{div}</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                    {div === 'CWHS' && 'Welfare'}
                    {div === 'CIM' && 'Audit'}
                    {div === 'CDR' && 'Discipline'}
                    {div === 'SAED' && 'Vocational'}
                  </span>
                </button>
              ))}
            </div>
            {selectedDivisions.includes('CIM') && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl animate-official">
                <input 
                  type="checkbox" 
                  id="cim_details"
                  checked={includeCIMDetails}
                  onChange={(e) => setIncludeCIMDetails(e.target.checked)}
                  className="w-6 h-6 accent-emerald-600 rounded-lg cursor-pointer"
                />
                <label htmlFor="cim_details" className="text-xs font-black uppercase text-slate-700 cursor-pointer">Include uncleared corps members with reasons in CIM export</label>
              </div>
            )}
          </section>

          <section className="space-y-6">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-[0.2em] border-b pb-2">2. Filter by Entry Date</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Start Date</label>
                <input 
                  type="date" 
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-emerald-700 outline-none"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">End Date</label>
                <input 
                  type="date" 
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:border-emerald-700 outline-none"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                />
              </div>
            </div>
          </section>

          <div className="pt-8 border-t flex flex-col md:flex-row gap-4">
            <button 
              onClick={handleExport}
              disabled={selectedDivisions.length === 0}
              className="flex-1 bg-emerald-900 text-white p-6 rounded-3xl font-black uppercase tracking-widest hover:bg-black transition-all border-b-8 border-emerald-950 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-xl"
            >
              Generate All Selected Reports
            </button>
            <button 
              onClick={onClose}
              className="px-10 py-6 bg-slate-100 text-slate-500 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Utilities ---

const SelectionBar = ({ selectedCount, onWhatsApp, onCSV, onPDF, onClear }: any) => {
  if (selectedCount === 0) return null;
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl z-[60] flex items-center gap-8 border border-white/10 animate-official">
      <div className="flex items-center gap-3 pr-8 border-r border-white/20">
        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-xs font-black">{selectedCount}</div>
        <span className="text-xs font-black uppercase tracking-widest">Selected</span>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onWhatsApp} title="WhatsApp Share" className="p-3 bg-white/10 rounded-xl hover:bg-emerald-600 transition-all"><WhatsAppIcon /></button>
        <button onClick={onCSV} title="CSV Export" className="p-3 bg-white/10 rounded-xl hover:bg-blue-600 transition-all"><DownloadIcon /></button>
        <button onClick={onPDF} title="PDF Preview" className="p-3 bg-white/10 rounded-xl hover:bg-red-600 transition-all"><FileTextIcon /></button>
        <button onClick={onClear} className="ml-4 text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all underline">Deselect</button>
      </div>
    </div>
  );
};

const Header = ({ title, sub }: { title: string, sub: string }) => (
  <div className="mb-12 border-l-[12px] border-emerald-900 pl-8 py-4 bg-white rounded-r-3xl shadow-xl border-t border-r border-b border-slate-200">
    <h2 className="text-4xl font-black uppercase tracking-tight text-slate-900 leading-none mb-3 font-serif-heading">{title}</h2>
    <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">{sub}</p>
  </div>
);

// --- Modules ---

const CWHSModule = ({ entries, lga, db, onShare, setPrintView }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!db) {
      alert("Database connectivity issue. Please refresh.");
      return;
    }
    await addData(db, "nysc_reports", { ...formData, lga: lga || 'Daura' });
    setFormData({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });
  };

  const selectedItems = entries.filter((e: any) => selectedIds.includes(e.id));
  const handleBulkWhatsApp = () => {
    const text = `*NYSC CW&HS REPORT*\n` + 
      selectedItems.map((e: any) => `- ${e.name} (${e.stateCode}): ${e.category} ${e.dateOfDeath ? `on ${e.dateOfDeath}` : ''}`).join('\n');
    onShare(text);
  };
  const handleBulkCSV = () => downloadCSV(selectedItems, 'CWHS_Report', ['name', 'stateCode', 'category', 'dateOfDeath', 'details', 'lga', 'dateAdded']);
  const handleBulkPDF = () => setPrintView({ title: 'CW&HS Official Report', items: selectedItems, type: 'CWHS' });

  return (
    <div className="animate-official space-y-12 pb-32">
      <Header title="CW&HS" sub="Welfare and health registry" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl sticky top-32">
            <h3 className="font-black uppercase text-xs mb-8 pb-4 border-b-2 border-slate-100 font-serif-heading">Official Entry Form</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input required placeholder="FULL NAME" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
              <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Record Category</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                  {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {formData.category === ReportCategory.DECEASED && (
                <div className="space-y-1 animate-official">
                  <label className="text-[10px] font-black uppercase text-red-600 ml-2">Confirmed Date of Death</label>
                  <input type="date" required className="w-full p-4 bg-red-50 rounded-2xl border-2 border-red-200 font-bold" value={formData.dateOfDeath} onChange={e => setFormData({...formData, dateOfDeath: e.target.value})} />
                </div>
              )}
              <textarea placeholder="CASE NARRATIVE..." className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 h-32" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
              <button className="w-full bg-emerald-900 text-white p-6 rounded-2xl font-black uppercase border-b-8 border-emerald-950 hover:bg-black transition-all">Submit to Registry</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-8 space-y-8">
          {entries.map((e: any) => (
            <div key={e.id} className={`bg-white p-8 rounded-[2rem] border-2 shadow-lg relative transition-all ${selectedIds.includes(e.id) ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200'}`}>
              <div className="absolute top-8 right-8 no-print flex items-center gap-4">
                <button onClick={() => downloadCSV([e], e.name, ['name', 'stateCode', 'category', 'dateOfDeath', 'details', 'lga', 'dateAdded'])} className="p-2 text-slate-300 hover:text-blue-600"><DownloadIcon /></button>
                <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => setSelectedIds(prev => prev.includes(e.id) ? prev.filter(i => i !== e.id) : [...prev, e.id])} className="w-6 h-6 accent-emerald-600 rounded-lg cursor-pointer" />
              </div>
              <h4 className="text-2xl font-black uppercase font-serif-heading leading-none mb-1">{e.name}</h4>
              <p className="text-sm font-bold text-emerald-800 mb-4">{e.stateCode}</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-3 py-1 text-[10px] font-black uppercase rounded-full border ${e.category === ReportCategory.DECEASED ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>{e.category}</span>
                <span className="px-3 py-1 bg-emerald-50 text-[10px] font-black uppercase rounded-full border border-emerald-100">{e.lga}</span>
                {e.dateOfDeath && (
                  <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black uppercase rounded-full border border-black italic">DOD: {e.dateOfDeath}</span>
                )}
              </div>
              <p className="text-slate-600 italic">"{e.details || 'No narrative provided.'}"</p>
              <div className="mt-6 pt-4 border-t flex justify-end gap-3 no-print">
                <button onClick={() => onShare(`CM: ${e.name} (${e.stateCode})\nStatus: ${e.category}${e.dateOfDeath ? ` on ${e.dateOfDeath}` : ''}\nDetails: ${e.details}`)} className="p-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all"><WhatsAppIcon /></button>
                <button onClick={() => setPrintView({ title: `Welfare Record: ${e.name}`, items: [e], type: 'CWHS' })} className="p-3 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-200 transition-all"><FileTextIcon /></button>
                <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="p-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-all"><TrashIcon /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SelectionBar selectedCount={selectedIds.length} onWhatsApp={handleBulkWhatsApp} onCSV={handleBulkCSV} onPDF={handleBulkPDF} onClear={() => setSelectedIds([])} />
    </div>
  );
};

const CIMModule = ({ entries, db, onShare, onGenerateQuery, loading, setPrintView }: any) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!db) {
      alert("Database connectivity issue. Please refresh.");
      return;
    }
    const list = formData.uncleared.split('\n').filter(l => l.includes(',')).map(l => {
      const p = l.split(',').map(s => s.trim());
      return { name: p[0], code: p[1], reason: p[2] || 'Biometric Default' };
    });
    await addData(db, "cim_clearance", { 
        month: formData.month, 
        maleCount: formData.maleCount, 
        femaleCount: formData.femaleCount, 
        clearedCount: formData.clearedCount, 
        unclearedList: list, 
        lga: entries[0]?.lga || 'Daura' 
    });
    setFormData({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
  };

  const selectedItems = entries.filter((e: any) => selectedIds.includes(e.id));
  const handleBulkCSV = () => downloadCSV(selectedItems, 'CIM_Audit', ['month', 'lga', 'clearedCount', 'maleCount', 'femaleCount', 'dateAdded']);

  return (
    <div className="animate-official space-y-12 pb-32">
      <Header title="CIM" sub="Inspection and monitoring records" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl">
            <h3 className="font-black uppercase text-xs mb-8 pb-4 border-b-2 border-slate-100 font-serif-heading">Audit Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
               <input type="month" required className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} />
               <div className="flex gap-4">
                 <input type="number" placeholder="M" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" onChange={e => setFormData({...formData, maleCount: Number(e.target.value)})} />
                 <input type="number" placeholder="F" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" onChange={e => setFormData({...formData, femaleCount: Number(e.target.value)})} />
               </div>
               <input type="number" placeholder="VERIFIED" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" onChange={e => setFormData({...formData, clearedCount: Number(e.target.value)})} />
               <textarea placeholder="Line: NAME, CODE, REASON" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 h-40" value={formData.uncleared} onChange={e => setFormData({...formData, uncleared: e.target.value})} />
               <button className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase hover:bg-black transition-all border-b-8 border-black">Archive Audit</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-8 space-y-10">
          {entries.map((e: any) => (
            <div key={e.id} className="bg-white rounded-[2.5rem] border-2 shadow-xl overflow-hidden relative">
               <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                  <div>
                    <h4 className="text-2xl font-black uppercase font-serif-heading">{e.month}</h4>
                    <p className="text-xs text-emerald-400 font-bold uppercase tracking-widest">{e.lga} STATION</p>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] uppercase font-black opacity-50">Cleared Rate</span>
                    <span className="text-3xl font-black">{e.clearedCount} / {e.maleCount + e.femaleCount}</span>
                  </div>
               </div>
               <div className="p-8 space-y-4">
                 <h5 className="text-[10px] font-black uppercase text-red-600 mb-4 tracking-tighter">Uncleared List ({e.unclearedList?.length})</h5>
                 {e.unclearedList?.map((cm: any, idx: number) => (
                   <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <span className="font-black block text-sm uppercase">{cm.name}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{cm.code} • {cm.reason}</span>
                      </div>
                      <button disabled={loading} onClick={() => onGenerateQuery(cm, e.lga)} className="px-4 py-2 bg-emerald-900 text-white rounded-lg text-[10px] font-black uppercase hover:bg-emerald-700 transition-all">Query</button>
                   </div>
                 ))}
                 <div className="pt-6 border-t flex justify-end items-center gap-4 no-print">
                   <button onClick={() => setPrintView({ title: `Audit Record: ${e.lga} (${e.month})`, items: [e], type: 'CIM' })} className="p-3 bg-slate-50 text-slate-700 rounded-xl"><FileTextIcon /></button>
                   <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="text-[10px] text-red-500 font-black uppercase hover:underline">Delete Record</button>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
      <SelectionBar selectedCount={selectedIds.length} onCSV={handleBulkCSV} onClear={() => setSelectedIds([])} />
    </div>
  );
};

const CDRModule = ({ entries, lga, db, onShare, onGenerateQuery, loading, setPrintView }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!db) {
      alert("Database connectivity issue. Please refresh.");
      return;
    }
    await addData(db, "cdr_cases", { ...formData, lga: lga || 'Daura' });
    setFormData({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  };

  const selectedItems = entries.filter((e: any) => selectedIds.includes(e.id));
  const handleBulkCSV = () => downloadCSV(selectedItems, 'CDR_Cases', ['name', 'stateCode', 'ppa', 'misconduct', 'dateAdded']);

  return (
    <div className="animate-official space-y-12 pb-32">
      <Header title="CD&R" sub="Discipline registry and misconduct tracking" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl">
            <h3 className="font-black uppercase text-xs mb-8 pb-4 border-b-2 border-slate-100 font-serif-heading">Case Log</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input required placeholder="FULL NAME" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
              <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
              <input required placeholder="PLACE OF ASSIGNMENT (PPA)" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" value={formData.ppa} onChange={e => setFormData({...formData, ppa: e.target.value})} />
              <textarea required placeholder="MISCONDUCT DESCRIPTION..." className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 h-32" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: e.target.value})} />
              <button className="w-full bg-red-900 text-white p-6 rounded-2xl font-black uppercase border-b-8 border-red-950 hover:bg-black transition-all">Archive Misconduct</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-8 space-y-8">
          {entries.map((e: any) => (
            <div key={e.id} className={`bg-white p-8 rounded-[2rem] border-2 shadow-lg relative transition-all ${selectedIds.includes(e.id) ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-200'}`}>
              <div className="absolute top-8 right-8 no-print">
                <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => setSelectedIds(prev => prev.includes(e.id) ? prev.filter(i => i !== e.id) : [...prev, e.id])} className="w-6 h-6 accent-red-600 rounded-lg cursor-pointer" />
              </div>
              <h4 className="text-2xl font-black uppercase font-serif-heading leading-none mb-1">{e.name}</h4>
              <p className="text-sm font-bold text-red-800">{e.stateCode} @ {e.ppa}</p>
              <div className="bg-slate-50 p-6 rounded-2xl mt-4 italic border border-slate-100">"{e.misconduct}"</div>
              <div className="mt-6 flex justify-end gap-3 no-print">
                <button disabled={loading} onClick={() => onGenerateQuery(e, e.lga)} className="px-6 py-3 bg-red-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all">Generate Query</button>
                <button onClick={() => deleteData(db, "cdr_cases", e.id)} className="p-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-all"><TrashIcon /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SelectionBar selectedCount={selectedIds.length} onCSV={handleBulkCSV} onClear={() => setSelectedIds([])} />
    </div>
  );
};

const SAEDModule = ({ entries, lga, db, onShare, setPrintView }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!db) {
      alert("Database connectivity issue. Please refresh.");
      return;
    }
    await addData(db, "saed_centers", { ...formData, lga: lga || 'Daura' });
    setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 });
  };

  const selectedItems = entries.filter((c: any) => selectedIds.includes(c.id));
  const handleBulkCSV = () => downloadCSV(selectedItems, 'SAED_Report', ['centerName', 'address', 'cmCount', 'fee', 'dateAdded']);

  return (
    <div className="animate-official space-y-12 pb-32">
      <Header title="SAED" sub="Skill hub enrollment and vocational monitoring" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl">
             <h3 className="font-black uppercase text-xs mb-8 pb-4 border-b-2 border-slate-100 font-serif-heading">Hub Publication</h3>
             <form onSubmit={handleSubmit} className="space-y-6">
                <input required placeholder="HUB NAME" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
                <input required placeholder="PHYSICAL ADDRESS" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
                <div className="flex gap-4">
                  <input type="number" placeholder="ENROLLED" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" onChange={e => setFormData({...formData, cmCount: Number(e.target.value)})} />
                  <input type="number" placeholder="HUB FEE" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 font-bold" onChange={e => setFormData({...formData, fee: Number(e.target.value)})} />
                </div>
                <button className="w-full bg-purple-900 text-white p-5 rounded-2xl font-black uppercase border-b-8 border-purple-950 hover:bg-black transition-all">Publish Hub</button>
             </form>
          </div>
        </div>
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {entries.map((c: any) => (
            <div key={c.id} className={`bg-white p-8 rounded-[2rem] border-2 shadow-xl relative transition-all ${selectedIds.includes(c.id) ? 'border-purple-500 ring-4 ring-purple-500/10' : 'border-slate-200'}`}>
              <div className="absolute top-8 right-8 no-print">
                <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => setSelectedIds(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])} className="w-6 h-6 accent-purple-600 rounded-lg cursor-pointer" />
              </div>
              <span className="bg-purple-50 text-purple-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-purple-200">₦{c.fee || '0'} Fee</span>
              <h4 className="text-xl font-black uppercase mt-4 font-serif-heading">{c.centerName}</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{c.address}</p>
              <div className="mt-8 flex justify-between items-center border-t pt-4">
                 <div className="flex flex-col">
                   <span className="text-[10px] font-black uppercase text-slate-300">Total Enrolled</span>
                   <span className="text-xl font-black text-slate-900">{c.cmCount} Trainees</span>
                 </div>
                 <div className="flex gap-2 no-print">
                   <button onClick={() => setPrintView({ title: `SAED Hub Record: ${c.centerName}`, items: [c], type: 'SAED' })} className="p-3 bg-slate-50 text-slate-700 rounded-xl hover:bg-slate-200 transition-all"><FileTextIcon /></button>
                   <button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-all"><TrashIcon /></button>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SelectionBar selectedCount={selectedIds.length} onCSV={handleBulkCSV} onClear={() => setSelectedIds([])} />
    </div>
  );
};

export default App;
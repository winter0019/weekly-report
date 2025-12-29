import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ReportCategory, 
  CorpsMemberEntry, 
  DauraLga,
  UserRole,
  Division,
  CIMClearance,
  SAEDCenter
} from './types';
import { 
  PlusIcon, 
  WhatsAppIcon, 
  LogOutIcon, 
  TrashIcon, 
  FileTextIcon, 
  SearchIcon,
  AbscondedIcon,
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
  
  const [division, setDivision] = useState<Division>('CWHS');
  const [cwhsEntries, setCwhsEntries] = useState<CorpsMemberEntry[]>([]);
  const [cimEntries, setCimEntries] = useState<CIMClearance[]>([]);
  const [saedEntries, setSaedEntries] = useState<SAEDCenter[]>([]);
  
  const [activeQuery, setActiveQuery] = useState<{ content: string, cm: any, lga: string, ppa: string } | null>(null);
  const [printData, setPrintData] = useState<{ title: string; items: any[]; type: Division } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<any>(null);

  const dbRef = useRef<any>(null);

  useEffect(() => {
    if (isAuthenticated) {
      try {
        dbRef.current = initFirebase(firebaseConfig);
        const unsub1 = subscribeToCollection(dbRef.current, "nysc_reports", setCwhsEntries);
        const unsub2 = subscribeToCollection(dbRef.current, "cim_clearance", setCimEntries);
        const unsub3 = subscribeToCollection(dbRef.current, "saed_centers", setSaedEntries);
        return () => { unsub1(); unsub2(); unsub3(); };
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
    } else setLoginError(true);
  };

  const handleLogout = () => {
    localStorage.clear();
    location.reload();
  };

  const filteredData = useMemo(() => {
    const filterFn = (items: any[]) => {
      if (userRole === 'LGI') return items.filter(i => i.lga === lgaContext);
      if (ziStationFilter === 'all') return items;
      return items.filter(i => i.lga === ziStationFilter);
    };
    return {
      cwhs: filterFn(cwhsEntries),
      cim: filterFn(cimEntries),
      saed: filterFn(saedEntries)
    };
  }, [cwhsEntries, cimEntries, saedEntries, userRole, lgaContext, ziStationFilter]);

  // Handle PDF/Print View for selected items
  if (printData) {
    return (
      <div className="min-h-screen bg-white p-10 font-official-document text-slate-900">
        <div className="max-w-5xl mx-auto border-2 border-slate-200 p-8 shadow-sm">
          <div className="flex justify-between items-start mb-8 pb-4 border-b-4 border-emerald-800">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20">
                <img src="https://upload.wikimedia.org/wikipedia/commons/e/e0/NYSC_logo.png" alt="NYSC Logo" className="w-full h-auto object-contain" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-black text-emerald-800 tracking-tight leading-none mb-1 font-serif-heading">NATIONAL YOUTH SERVICE CORPS</h1>
                <p className="text-md font-bold text-red-600 uppercase tracking-wide leading-none font-serif-heading">Office of the State Coordinator</p>
                <p className="text-sm font-bold text-red-600 uppercase tracking-widest font-serif-heading">Katsina State Secretariat</p>
              </div>
            </div>
            <div className="text-right text-[9px] font-bold text-slate-700 leading-tight">
              <p>Mani Road, Opposite Old Government House</p>
              <p>Katsina, Katsina State</p>
              <p className="mt-2">Ref: NYSC/KTS/ADMIN/{new Date().getFullYear()}</p>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-black uppercase text-center border-b-2 border-slate-900 pb-2 mb-4 font-serif-heading">
              {printData.title}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="border border-slate-300 p-2 text-left">S/N</th>
                    {printData.type === 'CWHS' && <>
                      <th className="border border-slate-300 p-2 text-left">Name</th>
                      <th className="border border-slate-300 p-2 text-left">State Code</th>
                      <th className="border border-slate-300 p-2 text-left">Category</th>
                      <th className="border border-slate-300 p-2 text-left">LGA</th>
                    </>}
                    {printData.type === 'CIM' && <>
                      <th className="border border-slate-300 p-2 text-left">Month</th>
                      <th className="border border-slate-300 p-2 text-left">LGA</th>
                      <th className="border border-slate-300 p-2 text-left">Total</th>
                      <th className="border border-slate-300 p-2 text-left">Cleared</th>
                      <th className="border border-slate-300 p-2 text-left">Uncleared</th>
                    </>}
                    {printData.type === 'SAED' && <>
                      <th className="border border-slate-300 p-2 text-left">Hub Name</th>
                      <th className="border border-slate-300 p-2 text-left">Location</th>
                      <th className="border border-slate-300 p-2 text-left">LGA</th>
                      <th className="border border-slate-300 p-2 text-left">Enrolled</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {printData.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="border border-slate-300 p-2">{idx + 1}</td>
                      {printData.type === 'CWHS' && <>
                        <td className="border border-slate-300 p-2">{item.name}</td>
                        <td className="border border-slate-300 p-2">{item.stateCode}</td>
                        <td className="border border-slate-300 p-2">{item.category}</td>
                        <td className="border border-slate-300 p-2">{item.lga}</td>
                      </>}
                      {printData.type === 'CIM' && <>
                        <td className="border border-slate-300 p-2">{item.month}</td>
                        <td className="border border-slate-300 p-2">{item.lga}</td>
                        <td className="border border-slate-300 p-2">{item.maleCount + item.femaleCount}</td>
                        <td className="border border-slate-300 p-2">{item.clearedCount}</td>
                        <td className="border border-slate-300 p-2">{item.unclearedList?.length || 0}</td>
                      </>}
                      {printData.type === 'SAED' && <>
                        <td className="border border-slate-300 p-2">{item.centerName}</td>
                        <td className="border border-slate-300 p-2">{item.address}</td>
                        <td className="border border-slate-300 p-2">{item.lga}</td>
                        <td className="border border-slate-300 p-2">{item.cmCount}</td>
                      </>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col items-end mt-20">
            <div className="w-48 border-b border-slate-900 mb-2"></div>
            <p className="font-bold uppercase text-xs">For: State Coordinator</p>
            <p className="text-[10px] text-slate-500 italic">This is a system generated report from NYSC Katsina Secretariat Portal</p>
          </div>

          <div className="mt-20 flex justify-center gap-4 no-print">
            <button onClick={() => setPrintData(null)} className="px-6 py-3 bg-slate-200 text-slate-900 rounded-xl font-bold uppercase text-xs">Close</button>
            <button onClick={() => window.print()} className="px-6 py-3 bg-emerald-900 text-white rounded-xl font-bold uppercase text-xs">Print Document</button>
          </div>
        </div>
      </div>
    );
  }

  if (activeQuery) {
    return (
      <div className="min-h-screen bg-slate-200 p-4 md:p-12 flex flex-col items-center overflow-auto">
        <div className="max-w-4xl w-full bg-white shadow-2xl p-10 md:p-16 relative overflow-hidden font-official-document text-slate-900 print-shadow-none document-page animate-official border border-slate-300">
          
          <div className="flex justify-between items-start mb-10 pb-4 border-b-4 border-emerald-800">
            <div className="flex items-start gap-4">
              <div className="w-24 h-24 bg-white border-2 border-slate-200 rounded-full flex items-center justify-center p-1">
                <img src="https://upload.wikimedia.org/wikipedia/commons/e/e0/NYSC_logo.png" alt="NYSC Logo" className="w-full h-auto object-contain" />
              </div>
              <div className="text-left mt-2">
                <h1 className="text-3xl font-black text-emerald-800 tracking-tight leading-none mb-1 font-serif-heading">NATIONAL YOUTH SERVICE CORPS</h1>
                <p className="text-lg font-bold text-red-600 uppercase tracking-wide leading-none font-serif-heading">Office of the State Coordinator</p>
                <p className="text-base font-bold text-red-600 uppercase tracking-widest font-serif-heading">Katsina State Secretariat</p>
              </div>
            </div>
            <div className="text-right text-[10px] font-bold text-slate-700 leading-tight pt-2">
              <p>Mani Road, Opposite Old Government House</p>
              <p>Katsina Office Complex</p>
              <p>Katsina, Katsina State</p>
              <p className="mt-2 text-slate-400">Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
          
          <div className="whitespace-pre-wrap leading-relaxed text-base mb-20 px-4">
            {activeQuery.content}
          </div>

          <div className="flex flex-col items-end space-y-2 font-bold mb-20 mr-4">
            <div className="w-48 border-b-2 border-slate-900"></div>
            <p className="uppercase text-sm">Local Government Inspector</p>
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
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2 font-serif-heading">Zonal Portal</h1>
            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">Administrative Access</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-600 ml-2">Command Center</label>
              <select required className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-700 outline-none appearance-none text-lg" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Command...</option>
                <option value="ZI">Zonal Inspector (ZI)</option>
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
      <header className="bg-emerald-950 text-white p-6 shadow-2xl flex flex-col md:flex-row justify-between items-center no-print sticky top-0 z-50 border-b-4 border-emerald-800">
        <div className="flex items-center gap-6 mb-4 md:mb-0">
          <div className="p-4 bg-emerald-800 rounded-3xl shadow-xl border border-emerald-500/50 scale-110"><DashboardIcon /></div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 font-serif-heading">
              {userRole === 'ZI' ? 'NYSC ZONAL OFFICE, DAURA ZONE' : `${lgaContext?.toUpperCase()} STATION OFFICE`}
            </h1>
            <p className="text-xs font-bold text-emerald-400/80 tracking-widest uppercase italic">Katsina State Secretariat Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {userRole === 'ZI' && (
            <select 
              className="w-full md:w-auto bg-emerald-900 border-emerald-700 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase text-emerald-300 outline-none hover:border-emerald-400 transition-all cursor-pointer shadow-lg"
              value={ziStationFilter}
              onChange={(e) => setZiStationFilter(e.target.value)}
            >
              <option value="all">Global Zonal View</option>
              {LGAS.map(l => <option key={l} value={l}>{l.toUpperCase()} STATION</option>)}
            </select>
          )}
          <button onClick={handleLogout} className="p-5 bg-white/10 rounded-2xl hover:bg-red-600/40 transition-all border border-white/5 shadow-inner"><LogOutIcon /></button>
        </div>
      </header>

      <nav className="bg-white border-b-8 border-slate-200 p-4 md:p-8 flex justify-center gap-6 no-print overflow-x-auto shadow-sm">
        {[
          { id: 'CWHS', label: 'CW&HS', sub: 'Welfare & Health' },
          { id: 'CIM', label: 'CIM', sub: 'Inspection & Monitoring' },
          { id: 'SAED', label: 'SAED', sub: 'Skill Acquisition' }
        ].map(d => (
          <button 
            key={d.id}
            onClick={() => setDivision(d.id as Division)}
            className={`px-12 py-6 rounded-[2rem] text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap group relative overflow-hidden ${division === d.id ? `bg-emerald-900 text-white border-b-8 border-emerald-950` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            <div className="flex flex-col items-center">
              <span>{d.label}</span>
              <span className={`text-[10px] font-bold mt-1 ${division === d.id ? 'text-emerald-300/60' : 'text-slate-400'}`}>{d.sub}</span>
            </div>
          </button>
        ))}
      </nav>

      <main className="flex-1 max-w-[1600px] mx-auto w-full p-4 md:p-12 space-y-12">
        {division === 'CWHS' && (
          <CWHSModule 
            entries={filteredData.cwhs} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')}
            setPrintView={(data: any) => setPrintData(data)}
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
                const content = await generateDisciplinaryQuery(cm.name, cm.code, ppa, cm.reason);
                setActiveQuery({ content, cm, lga, ppa });
              } finally {
                setIsGenerating(false);
              }
            }}
            loading={isGenerating}
            setPrintView={(data: any) => setPrintData(data)}
          />
        )}
        {division === 'SAED' && (
          <SAEDModule 
            entries={filteredData.saed} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')}
            setPrintView={(data: any) => setPrintData(data)}
          />
        )}
      </main>
    </div>
  );
};

// --- Utilities for Export ---

const downloadCSV = (data: any[], filename: string, headers: string[]) => {
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

// --- Sub-Modules ---

const SelectionBar = ({ selectedCount, onWhatsApp, onCSV, onPDF, onClear }: any) => {
  if (selectedCount === 0) return null;
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-5 rounded-[2.5rem] shadow-2xl z-[60] flex items-center gap-8 border border-white/10 animate-official">
      <div className="flex items-center gap-3 pr-8 border-r border-white/20">
        <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-xs font-black">{selectedCount}</div>
        <span className="text-xs font-black uppercase tracking-widest">Records Selected</span>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={onWhatsApp} className="p-3 bg-white/10 rounded-xl hover:bg-emerald-600 transition-all flex items-center gap-2 text-[10px] font-black uppercase"><WhatsAppIcon /> WhatsApp</button>
        <button onClick={onCSV} className="p-3 bg-white/10 rounded-xl hover:bg-blue-600 transition-all flex items-center gap-2 text-[10px] font-black uppercase"><DownloadIcon /> CSV</button>
        <button onClick={onPDF} className="p-3 bg-white/10 rounded-xl hover:bg-red-600 transition-all flex items-center gap-2 text-[10px] font-black uppercase"><FileTextIcon /> PDF</button>
        <button onClick={onClear} className="ml-4 text-[10px] font-black uppercase text-slate-400 hover:text-white transition-all underline underline-offset-4">Deselect All</button>
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

const CWHSModule = ({ entries, lga, db, onShare, setPrintView }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.SICK, details: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "nysc_reports", { ...formData, lga: lga || 'Daura' });
    setFormData({ name: '', stateCode: '', category: ReportCategory.SICK, details: '' });
  };

  const handleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectedItems = entries.filter((e: any) => selectedIds.includes(e.id));

  const handleBulkWhatsApp = () => {
    const text = `*NYSC CW&HS SUMMARY REPORT*\nGenerated: ${new Date().toLocaleDateString()}\n\n` + 
      selectedItems.map((e: any) => `- ${e.name} (${e.stateCode}): ${e.category}`).join('\n');
    onShare(text);
  };

  const handleBulkCSV = () => {
    downloadCSV(selectedItems, 'CWHS_Report', ['name', 'stateCode', 'category', 'lga', 'details']);
  };

  const handleBulkPDF = () => {
    setPrintView({ title: 'Corps Welfare and Health Service (CW&HS) Official Report', items: selectedItems, type: 'CWHS' });
  };

  return (
    <div className="animate-official space-y-12 pb-32">
      <div className="flex justify-between items-end no-print">
        <Header title="CW&HS" sub="Welfare registry and health incident tracking" />
        <button onClick={() => setPrintView({ title: 'CW&HS Full Zonal Report', items: entries, type: 'CWHS' })} className="mb-12 bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:bg-black border-b-8 border-black flex items-center gap-3 transition-all">
          <FileTextIcon /> Full Zonal Gazette
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl sticky top-32">
            <h3 className="font-black uppercase text-xs mb-8 pb-4 border-b-2 border-slate-100 font-serif-heading">New Welfare Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input required placeholder="FULL NAME" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
              <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
              <select className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea placeholder="CASE DETAILS..." className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 h-32" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
              <button className="w-full bg-emerald-900 text-white p-6 rounded-2xl font-black uppercase border-b-8 border-emerald-950">Archive to CW&HS</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-8 space-y-8">
          <div className="flex justify-between items-center mb-4 px-4 no-print">
            <button onClick={() => setSelectedIds(entries.map((e: any) => e.id))} className="text-[10px] font-black uppercase text-slate-400 hover:text-emerald-700">Select All Page</button>
            <span className="text-[10px] font-black uppercase text-slate-300">Displaying {entries.length} Records</span>
          </div>
          {entries.map((e: any) => (
            <div key={e.id} className={`bg-white p-8 rounded-[2rem] border-2 shadow-lg relative flex flex-col justify-between transition-all ${selectedIds.includes(e.id) ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200'}`}>
              <div className="absolute top-8 right-8 no-print">
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(e.id)} 
                  onChange={() => handleSelection(e.id)} 
                  className="w-6 h-6 accent-emerald-600 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="bg-emerald-50 text-emerald-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-200">{e.category}</span>
                  <span className="text-[10px] font-black text-slate-400 uppercase">{e.lga}</span>
                </div>
                <h4 className="text-2xl font-black uppercase font-serif-heading">{e.name}</h4>
                <p className="text-sm font-bold text-emerald-800 mb-4">{e.stateCode}</p>
                <p className="text-slate-600 italic">"{e.details}"</p>
              </div>
              <div className="mt-6 pt-4 border-t flex justify-end gap-3 no-print">
                 <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="p-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-all"><TrashIcon /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SelectionBar 
        selectedCount={selectedIds.length} 
        onWhatsApp={handleBulkWhatsApp} 
        onCSV={handleBulkCSV} 
        onPDF={handleBulkPDF}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
};

const CIMModule = ({ entries, db, onShare, onGenerateQuery, loading, setPrintView }: any) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const stats = useMemo(() => entries.reduce((acc: any, c: any) => {
    acc.t += (c.maleCount + c.femaleCount); acc.cl += c.clearedCount; acc.unc += (c.unclearedList?.length || 0); return acc;
  }, { t: 0, cl: 0, unc: 0 }), [entries]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const list = formData.uncleared.split('\n').filter(l => l.includes(',')).map(l => {
      const p = l.split(',').map(s => s.trim());
      return { name: p[0], code: p[1], reason: p[2] || 'Biometric Default' };
    });
    await addData(db, "cim_clearance", { month: formData.month, maleCount: formData.maleCount, femaleCount: formData.femaleCount, clearedCount: formData.clearedCount, unclearedList: list, lga: entries[0]?.lga || 'Daura' });
    setFormData({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
  };

  const selectedItems = entries.filter((e: any) => selectedIds.includes(e.id));

  const handleBulkWhatsApp = () => {
    const text = `*NYSC CIM AUDIT SUMMARY*\n\n` + 
      selectedItems.map((e: any) => `[${e.lga} - ${e.month}] Cleared: ${e.clearedCount}/${e.maleCount + e.femaleCount}`).join('\n');
    onShare(text);
  };

  const handleBulkCSV = () => {
    downloadCSV(selectedItems, 'CIM_Audit_Report', ['month', 'lga', 'maleCount', 'femaleCount', 'clearedCount']);
  };

  const handleBulkPDF = () => {
    setPrintView({ title: 'Corps Inspection and Monitoring (CIM) Audit Report', items: selectedItems, type: 'CIM' });
  };

  return (
    <div className="animate-official space-y-12 pb-32">
      <Header title="CIM" sub="Biometric verification and audit records" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 no-print">
        <div className="bg-white p-10 rounded-[2rem] border-2 border-slate-200 text-center shadow-lg">
          <h5 className="text-xs font-black uppercase text-slate-400 mb-2">CIM Total Strength</h5>
          <div className="text-6xl font-black font-serif-heading text-slate-900">{stats.t}</div>
        </div>
        <div className="bg-emerald-50 p-10 rounded-[2rem] border-2 border-emerald-200 text-center shadow-lg">
          <h5 className="text-xs font-black uppercase text-emerald-800 mb-2">Verified Cleared</h5>
          <div className="text-6xl font-black font-serif-heading text-emerald-900">{stats.cl}</div>
        </div>
        <div className="bg-red-50 p-10 rounded-[2rem] border-2 border-red-200 text-center shadow-lg">
          <h5 className="text-xs font-black uppercase text-red-800 mb-2">Disciplinary Defaults</h5>
          <div className="text-6xl font-black font-serif-heading text-red-900">{stats.unc}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl">
            <h3 className="font-black uppercase text-xs mb-8 border-b-2 border-slate-100 font-serif-heading">CIM Audit Form</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
               <input type="month" required className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} />
               <div className="flex gap-4">
                 <input type="number" placeholder="MALE" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, maleCount: Number(e.target.value)})} />
                 <input type="number" placeholder="FEMALE" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, femaleCount: Number(e.target.value)})} />
               </div>
               <input type="number" placeholder="TOTAL VERIFIED" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, clearedCount: Number(e.target.value)})} />
               <textarea placeholder="Line format: NAME, CODE, REASON" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 h-40" value={formData.uncleared} onChange={e => setFormData({...formData, uncleared: e.target.value})} />
               <button className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase">Archive CIM Audit</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-8 space-y-10">
          <div className="flex justify-between items-center mb-4 px-4 no-print">
            <button onClick={() => setSelectedIds(entries.map((e: any) => e.id))} className="text-[10px] font-black uppercase text-slate-400 hover:text-emerald-700">Select All Page</button>
          </div>
          {entries.map((e: any) => (
            <div key={e.id} className={`bg-white rounded-[2.5rem] border-2 shadow-xl overflow-hidden transition-all relative ${selectedIds.includes(e.id) ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-slate-200'}`}>
               <div className="absolute top-8 right-8 no-print">
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(e.id)} 
                  onChange={() => setSelectedIds(prev => prev.includes(e.id) ? prev.filter(i => i !== e.id) : [...prev, e.id])} 
                  className="w-6 h-6 accent-emerald-400 rounded-lg cursor-pointer"
                />
              </div>
               <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                  <div>
                    <h4 className="text-2xl font-black uppercase font-serif-heading">{new Date(e.month).toLocaleString('default',{month:'long',year:'numeric'})}</h4>
                    <p className="text-xs text-emerald-400 uppercase tracking-widest">STATION: {e.lga}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-black opacity-50 block">Audit Strength</span>
                    <span className="text-3xl font-black">{e.maleCount + e.femaleCount}</span>
                  </div>
               </div>
               <div className="p-8 space-y-6">
                 <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-2 mb-4">Personnel in Default ({e.unclearedList?.length || 0})</h5>
                 {e.unclearedList?.map((cm: any, idx: number) => (
                   <div key={idx} className="flex justify-between items-center p-6 bg-slate-50 rounded-[1.5rem] border border-slate-200">
                      <div>
                        <span className="font-black block uppercase text-sm">{cm.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cm.code} • {cm.reason}</span>
                      </div>
                      <div className="flex gap-2">
                        <button disabled={loading} onClick={() => onGenerateQuery(cm, e.lga)} className="px-6 py-3 bg-emerald-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-black transition-all">
                          {loading ? '...' : <><FileTextIcon /> Query</>}
                        </button>
                      </div>
                   </div>
                 ))}
                 <div className="flex justify-end pt-4 no-print">
                    <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="text-[10px] font-black uppercase text-red-400 hover:text-red-700">Delete Audit Record</button>
                 </div>
               </div>
            </div>
          ))}
        </div>
      </div>
      <SelectionBar 
        selectedCount={selectedIds.length} 
        onWhatsApp={handleBulkWhatsApp} 
        onCSV={handleBulkCSV} 
        onPDF={handleBulkPDF}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
};

const SAEDModule = ({ entries, db, onShare, setPrintView }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "saed_centers", { ...formData, lga: entries[0]?.lga || 'Daura' });
    setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 });
  };

  const selectedItems = entries.filter((e: any) => selectedIds.includes(e.id));

  const handleBulkWhatsApp = () => {
    const text = `*NYSC SAED HUB REGISTRY*\n\n` + 
      selectedItems.map((c: any) => `- ${c.centerName} (${c.lga}): ${c.cmCount} Trainees`).join('\n');
    onShare(text);
  };

  const handleBulkCSV = () => {
    downloadCSV(selectedItems, 'SAED_Hubs_Report', ['centerName', 'address', 'cmCount', 'fee', 'lga']);
  };

  const handleBulkPDF = () => {
    setPrintView({ title: 'SAED Skill Hub Enrollment Report', items: selectedItems, type: 'SAED' });
  };

  return (
    <div className="animate-official space-y-12 pb-32">
      <Header title="SAED" sub="Training center enrollment and skill hubs" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl">
            <h3 className="font-black uppercase text-xs mb-8 border-b-2 border-slate-100 font-serif-heading">New SAED Hub</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input required placeholder="HUB NAME" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
              <input required placeholder="ADDRESS" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
              <div className="flex gap-4">
                <input type="number" placeholder="ENROLLED" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, cmCount: Number(e.target.value)})} />
                <input type="number" placeholder="FEE (₦)" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, fee: Number(e.target.value)})} />
              </div>
              <button className="w-full bg-purple-900 text-white p-5 rounded-2xl font-black uppercase">Publish to SAED</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-8">
          <div className="flex justify-between items-center mb-4 px-4 no-print">
            <button onClick={() => setSelectedIds(entries.map((e: any) => e.id))} className="text-[10px] font-black uppercase text-slate-400 hover:text-purple-700">Select All Page</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {entries.map((c: any) => (
              <div key={c.id} className={`bg-white p-8 rounded-[2rem] border-2 shadow-xl flex flex-col justify-between relative transition-all ${selectedIds.includes(c.id) ? 'border-purple-500 ring-4 ring-purple-500/10' : 'border-slate-200'}`}>
                <div className="absolute top-8 right-8 no-print">
                  <input 
                    type="checkbox" 
                    checked={selectedIds.includes(c.id)} 
                    onChange={() => setSelectedIds(prev => prev.includes(c.id) ? prev.filter(i => i !== c.id) : [...prev, c.id])} 
                    className="w-6 h-6 accent-purple-600 rounded-lg cursor-pointer"
                  />
                </div>
                <div>
                  <span className="bg-purple-50 text-purple-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-purple-200 font-serif-heading">₦{c.fee}</span>
                  <h4 className="text-xl font-black uppercase mt-4 font-serif-heading">{c.centerName}</h4>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-1">{c.address}</p>
                </div>
                <div className="mt-8 pt-4 border-t flex justify-between items-center">
                   <span className="text-[10px] font-black uppercase text-slate-400">Hub Enrollment: {c.cmCount}</span>
                   <div className="flex gap-2 no-print">
                     <button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-all"><TrashIcon /></button>
                   </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SelectionBar 
        selectedCount={selectedIds.length} 
        onWhatsApp={handleBulkWhatsApp} 
        onCSV={handleBulkCSV} 
        onPDF={handleBulkPDF}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
};

export default App;
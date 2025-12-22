import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ReportCategory, 
  CorpsMemberEntry, 
  DauraLga,
  UserRole
} from './types';
import { 
  PlusIcon, 
  DownloadIcon, 
  ShareIcon, 
  LogOutIcon, 
  TrashIcon, 
  FileTextIcon, 
  SearchIcon,
  AbscondedIcon,
  SickIcon,
  KidnappedIcon,
  MissingIcon,
  DeceasedIcon,
  DashboardIcon
} from './components/Icons';
import { initFirebase, subscribeToReports, addReport, deleteReport, updateReport } from './services/firebaseService';

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

const CATEGORY_COLORS: Record<string, string> = {
  [ReportCategory.ABSCONDED]: 'bg-amber-100 text-amber-700 border-amber-200',
  [ReportCategory.SICK]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  [ReportCategory.KIDNAPPED]: 'bg-orange-100 text-orange-700 border-orange-200',
  [ReportCategory.MISSING]: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  [ReportCategory.DECEASED]: 'bg-red-100 text-red-700 border-red-200',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  [ReportCategory.ABSCONDED]: <AbscondedIcon />,
  [ReportCategory.SICK]: <SickIcon />,
  [ReportCategory.KIDNAPPED]: <KidnappedIcon />,
  [ReportCategory.MISSING]: <MissingIcon />,
  [ReportCategory.DECEASED]: <DeceasedIcon />,
};

type ViewMode = 'DASHBOARD' | 'FORM';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => localStorage.getItem('daura_lga') as DauraLga);
  
  const [entries, setEntries] = useState<CorpsMemberEntry[]>([]);
  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [editingEntry, setEditingEntry] = useState<CorpsMemberEntry | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<ReportCategory | 'ALL'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Login States
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [pendingLga, setPendingLga] = useState<DauraLga | null>(null);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState(false);

  // Form States
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.SICK, details: '' });

  const dbRef = useRef<any>(null);

  useEffect(() => {
    if (isAuthenticated) {
      try {
        dbRef.current = initFirebase(firebaseConfig);
        const unsubscribe = subscribeToReports(dbRef.current, (data) => setEntries(data as CorpsMemberEntry[]));
        return () => unsubscribe && unsubscribe();
      } catch (err) {
        console.error("Setup error", err);
      }
    }
  }, [isAuthenticated]);

  const filteredEntries = useMemo(() => {
    let base = userRole === 'ZI' ? entries : entries.filter(e => e.lga === lgaContext);

    return base.filter(e => {
      const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           e.stateCode.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = filterCategory === 'ALL' || e.category === filterCategory;
      
      const entryDate = new Date(e.dateAdded).getTime();
      const start = startDate ? new Date(startDate).setHours(0,0,0,0) : null;
      const end = endDate ? new Date(endDate).setHours(23,59,59,999) : null;
      const matchesDate = (!start || entryDate >= start) && (!end || entryDate <= end);
      
      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [entries, searchQuery, filterCategory, startDate, endDate, userRole, lgaContext]);

  const stats = useMemo(() => {
    const counts = {
      TOTAL: filteredEntries.length,
      [ReportCategory.ABSCONDED]: 0,
      [ReportCategory.SICK]: 0,
      [ReportCategory.KIDNAPPED]: 0,
      [ReportCategory.MISSING]: 0,
      [ReportCategory.DECEASED]: 0,
    };
    filteredEntries.forEach(e => {
      counts[e.category]++;
    });
    return counts;
  }, [filteredEntries]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const target = pendingRole === 'ZI' ? 'ZI' : pendingLga;
    if (target && pin === SECURITY_PINS[target]) {
      setIsAuthenticated(true);
      setUserRole(pendingRole);
      setLgaContext(pendingLga);
      localStorage.setItem('daura_auth', 'true');
      localStorage.setItem('daura_role', pendingRole!);
      if (pendingLga) localStorage.setItem('daura_lga', pendingLga);
      setPin('');
    } else { setLoginError(true); }
  };

  const handleLogout = () => {
    localStorage.clear();
    location.reload();
  };

  const handleDownloadCSV = () => {
    if (filteredEntries.length === 0) return;
    const headers = ["Name", "State Code", "LGA", "Category", "Date Added", "Details"];
    const rows = filteredEntries.map(e => [
      e.name,
      e.stateCode,
      e.lga,
      e.category,
      new Date(e.dateAdded).toLocaleDateString(),
      (e as any).details || ""
    ].map(val => `"${val.toString().replace(/"/g, '""')}"`).join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `NYSC_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generateReportText = () => {
    let text = `*NYSC STATUS REPORT - ${new Date().toLocaleDateString()}*\n`;
    text += `Station: ${userRole === 'ZI' ? 'DAURA ZONAL HQ' : lgaContext}\n`;
    text += `--------------------------\n`;
    text += `*Summary:*\n`;
    text += `- Total: ${stats.TOTAL}\n`;
    Object.values(ReportCategory).forEach(cat => {
      if (stats[cat] > 0) text += `- ${cat}: ${stats[cat]}\n`;
    });
    text += `--------------------------\n`;
    
    if (filteredEntries.length > 0) {
      text += `*Recent Records:*\n`;
      filteredEntries.slice(0, 10).forEach(e => {
        text += `• ${e.name} (${e.stateCode}) - ${e.category}\n`;
      });
      if (filteredEntries.length > 10) text += `...and ${filteredEntries.length - 10} more.`;
    }
    
    return encodeURIComponent(text);
  };

  const handleShareWhatsApp = () => {
    const text = generateReportText();
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      lga: lgaContext || 'Daura',
      dateAdded: editingEntry ? editingEntry.dateAdded : new Date().toISOString(),
    };
    try {
      if (editingEntry) {
        await updateReport(dbRef.current, editingEntry.id, payload);
      } else {
        await addReport(dbRef.current, payload);
      }
      setFormData({ name: '', stateCode: '', category: ReportCategory.SICK, details: '' });
      setEditingEntry(null);
      setCurrentView('DASHBOARD');
    } catch (err) { alert("Action failed."); }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10 animate-fade-in">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">NYSC DAURA</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Intelligence Access</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <select required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" onChange={e => {
              const v = e.target.value;
              if (v === 'ZI') { setPendingRole('ZI'); setPendingLga(null); }
              else { setPendingRole('LGI'); setPendingLga(v as DauraLga); }
            }}>
              <option value="">Select Terminal...</option>
              <option value="ZI">Zonal Inspector (ZI)</option>
              {LGAS.map(l => <option key={l} value={l}>{l} Station</option>)}
            </select>
            <input type="password" required placeholder="PIN" className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-4xl font-black tracking-widest outline-none focus:ring-2 focus:ring-emerald-500" value={pin} onChange={e => setPin(e.target.value)} />
            {loginError && <p className="text-red-600 text-[10px] font-black text-center uppercase">Access Denied</p>}
            <button className="w-full bg-emerald-800 text-white p-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-emerald-900 transition-all">Authenticate</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-slate-900 text-white p-4 md:p-6 shadow-xl flex justify-between items-center sticky top-0 z-50 print:hidden">
        <div className="flex items-center gap-3 md:gap-4">
          <DashboardIcon />
          <div>
            <h1 className="text-sm md:text-lg font-black uppercase tracking-tight">{userRole === 'ZI' ? 'DAURA ZONAL HQ' : `${lgaContext} STATION`}</h1>
            <p className="text-[8px] md:text-[9px] opacity-60 font-bold uppercase tracking-widest">NYSC Compliance Hub</p>
          </div>
        </div>
        <div className="flex gap-2">
          {currentView === 'DASHBOARD' && (
            <>
              {userRole === 'ZI' && (
                <>
                  <button onClick={handleDownloadCSV} title="Download CSV" className="bg-white/10 hover:bg-white/20 p-2 md:p-3 rounded-xl transition-all"><DownloadIcon /></button>
                  <button onClick={handlePrintPDF} title="Download PDF" className="bg-white/10 hover:bg-white/20 p-2 md:p-3 rounded-xl transition-all"><FileTextIcon /></button>
                </>
              )}
              <button onClick={handleShareWhatsApp} title="Share to WhatsApp" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 p-2 md:p-3 rounded-xl transition-all flex items-center gap-2">
                <ShareIcon />
                <span className="hidden md:inline text-[10px] font-black uppercase">WhatsApp</span>
              </button>
            </>
          )}
          <button onClick={handleLogout} title="Logout" className="bg-white/10 hover:bg-red-500/30 p-2 md:p-3 rounded-xl transition-all"><LogOutIcon /></button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {currentView === 'DASHBOARD' && (
          <div className="space-y-8 animate-fade-in">
            {/* Summary Statistics Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col">
                <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">Total Records</span>
                <span className="text-3xl font-black text-slate-900 leading-none">{stats.TOTAL}</span>
              </div>
              {Object.values(ReportCategory).map(cat => (
                <div key={cat} className={`bg-white p-6 rounded-3xl border shadow-sm flex flex-col transition-all hover:scale-[1.02] ${stats[cat] > 0 ? CATEGORY_COLORS[cat].split(' ')[2] : 'border-slate-100'}`}>
                  <span className={`text-[9px] font-black uppercase tracking-widest mb-1 ${CATEGORY_COLORS[cat].split(' ')[1]}`}>{cat}</span>
                  <span className={`text-3xl font-black leading-none ${stats[cat] > 0 ? CATEGORY_COLORS[cat].split(' ')[1] : 'text-slate-300'}`}>{stats[cat]}</span>
                </div>
              ))}
            </div>

            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Live Dataset</h2>
              <div className="flex items-center gap-3">
                 <button onClick={() => { setEditingEntry(null); setFormData({name:'', stateCode:'', category: ReportCategory.SICK, details:''}); setCurrentView('FORM'); }} className="bg-emerald-800 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase flex items-center gap-3 shadow-xl hover:bg-emerald-900 transition-all active:scale-95"><PlusIcon /> New Entry</button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 print:hidden">
              <div className="relative flex-1">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
                <input type="text" placeholder="Search name or state code..." className="w-full pl-14 pr-6 py-4 rounded-2xl bg-slate-50 border-none outline-none text-sm font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-emerald-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <select className="bg-slate-50 border-none rounded-2xl px-6 py-4 text-xs font-black uppercase text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}>
                  <option value="ALL">All Categories</option>
                  {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => { setSearchQuery(''); setFilterCategory('ALL'); setStartDate(''); setEndDate(''); }} className="bg-slate-100 text-slate-400 px-5 py-4 rounded-2xl hover:bg-slate-200 transition-all"><TrashIcon /></button>
              </div>
            </div>

            {/* Record Grid */}
            {filteredEntries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredEntries.map(entry => (
                  <div key={entry.id} className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm hover:shadow-2xl transition-all group relative border-t-[12px] flex flex-col justify-between" style={{ borderTopColor: CATEGORY_COLORS[entry.category].split(' ')[1].replace('text-', '') }}>
                    <div>
                      <div className="flex items-start justify-between mb-6">
                        <div className={`p-4 rounded-2xl border ${CATEGORY_COLORS[entry.category]}`}>{CATEGORY_ICONS[entry.category]}</div>
                        <span className="text-[10px] font-black bg-slate-50 text-slate-400 px-3 py-1.5 rounded-lg uppercase tracking-[0.2em]">{entry.lga}</span>
                      </div>
                      <div className="mb-6">
                        <h3 className="font-black text-slate-900 uppercase text-lg leading-tight mb-2">{entry.name}</h3>
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{entry.stateCode}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {((entry as any).details) && (
                        <p className="text-xs text-slate-500 italic line-clamp-2">"{(entry as any).details}"</p>
                      )}
                      <div className="pt-6 border-t border-slate-50 flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
                        <span className="flex items-center gap-2 tracking-widest"><FileTextIcon /> {entry.category}</span>
                        <span>{new Date(entry.dateAdded).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity print:hidden">
                        <button onClick={() => { setEditingEntry(entry); setFormData({name:entry.name, stateCode:entry.stateCode, category:entry.category, details:(entry as any).details || ''}); setCurrentView('FORM'); }} className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all">Edit</button>
                        <button onClick={() => { if(confirm("Permanently delete this record?")) deleteReport(dbRef.current, entry.id)}} className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black uppercase text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all">Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-32 text-center bg-white rounded-[3rem] border border-slate-100 shadow-inner">
                <div className="inline-flex p-8 bg-slate-50 rounded-full mb-6 text-slate-200"><DashboardIcon /></div>
                <h3 className="text-xl font-black text-slate-300 uppercase tracking-[0.3em]">Operational Silence</h3>
                <p className="text-slate-400 text-xs mt-3 uppercase font-bold tracking-widest">No matching records found in this view</p>
              </div>
            )}
          </div>
        )}

        {currentView === 'FORM' && (
          <div className="max-w-2xl mx-auto animate-fade-in pb-20">
            <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
              <div className="h-5 bg-emerald-800 w-full"></div>
              <div className="p-12 space-y-10">
                <div>
                  <h2 className="text-4xl font-black uppercase text-slate-900 tracking-tighter mb-3">{editingEntry ? 'Update Record' : 'Official Entry'}</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] border-b pb-8 border-slate-100">National Youth Service Corps • Station Submission</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-10">
                  <div className="space-y-8">
                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-700 ml-1">Corps Member Name <span className="text-red-500">*</span></label>
                      <input required className="w-full p-5 bg-slate-50 border-b-4 border-slate-100 rounded-2xl font-black text-lg text-slate-800 focus:border-emerald-600 outline-none transition-all uppercase placeholder:text-slate-200" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} placeholder="FULL NAME AS PER OFFICIAL REGISTER" />
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-700 ml-1">State Code <span className="text-red-500">*</span></label>
                      <input required className="w-full p-5 bg-slate-50 border-b-4 border-slate-100 rounded-2xl font-black text-lg text-slate-800 focus:border-emerald-600 outline-none transition-all uppercase placeholder:text-slate-200" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} placeholder="E.G. KT/24A/0001" />
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-700 ml-1">Incident Category <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.values(ReportCategory).map(c => (
                          <label key={c} className={`flex items-center p-5 rounded-2xl border-2 cursor-pointer transition-all ${formData.category === c ? 'border-emerald-600 bg-emerald-50/30' : 'border-slate-50 bg-slate-50 hover:border-slate-200'}`}>
                            <input type="radio" name="category" className="hidden" value={c} checked={formData.category === c} onChange={() => setFormData({...formData, category: c})} />
                            <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center ${formData.category === c ? 'border-emerald-600 bg-emerald-600 shadow-[0_0_10px_rgba(5,150,105,0.3)]' : 'border-slate-300'}`}>
                              {formData.category === c && <div className="w-2 h-2 bg-white rounded-full"></div>}
                            </div>
                            <span className="text-[11px] font-black uppercase text-slate-700 tracking-wider">{c}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-700 ml-1">Case Particulars / Remarks</label>
                      <textarea className="w-full p-6 bg-slate-50 border-b-4 border-slate-100 rounded-2xl font-bold text-slate-800 focus:border-emerald-600 outline-none transition-all h-40 placeholder:text-slate-200" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} placeholder="PROVIDE DETAILED ACCOUNT OF INCIDENT, RELEVANT DATES, AND CURRENT STATUS..." />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-5 pt-6">
                    <button type="submit" className="flex-[2] bg-emerald-800 text-white p-6 rounded-2xl font-black uppercase text-xs tracking-[0.3em] shadow-2xl hover:bg-emerald-900 active:scale-95 transition-all">Validate & Submit</button>
                    <button type="button" onClick={() => setCurrentView('DASHBOARD')} className="flex-1 bg-slate-100 text-slate-500 p-6 rounded-2xl font-black uppercase text-xs tracking-[0.3em] hover:bg-slate-200 transition-all">Discard</button>
                  </div>
                </form>
              </div>
            </div>
            <p className="text-center text-slate-400 text-[9px] font-black uppercase mt-10 tracking-[0.5em] opacity-50">Confidential Administration Document</p>
          </div>
        )}
      </main>

      <footer className="p-12 text-center bg-white border-t border-slate-100 print:hidden">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
          <p className="text-slate-900 text-[10px] font-black uppercase tracking-[0.5em]">NYSC KATSINA STATE HQ • AUDIT PORTAL</p>
          <div className="flex gap-8">
            <span className="text-[10px] font-black uppercase tracking-widest">Secure Link Established</span>
            <span className="text-[10px] font-black uppercase tracking-widest">© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* Print Specific Layout Helper */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          .rounded-[2.5rem], .rounded-[3rem] { border-radius: 0.5rem !important; }
          .shadow-sm, .shadow-xl, .shadow-2xl { box-shadow: none !important; border: 1px solid #eee !important; }
          header, footer { display: none !important; }
          .grid { display: block !important; }
          .grid > div { margin-bottom: 2rem; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default App;
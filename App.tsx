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

  const handleShare = async () => {
    const text = `NYSC Status Report - ${new Date().toLocaleDateString()}\nRecords: ${filteredEntries.length}\nGenerated via Daura Portal.`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'NYSC Report Export',
          text: text,
          url: window.location.href,
        });
      } catch (err) {
        console.error("Share failed", err);
      }
    } else {
      navigator.clipboard.writeText(text);
      alert("Report summary copied to clipboard!");
    }
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
      <header className="bg-slate-900 text-white p-4 md:p-6 shadow-xl flex justify-between items-center sticky top-0 z-50">
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
              <button onClick={handleDownloadCSV} title="Download CSV" className="bg-white/10 hover:bg-white/20 p-2 md:p-3 rounded-xl transition-all hidden md:block"><DownloadIcon /></button>
              <button onClick={handleShare} title="Share Report" className="bg-white/10 hover:bg-white/20 p-2 md:p-3 rounded-xl transition-all"><ShareIcon /></button>
            </>
          )}
          <button onClick={handleLogout} title="Logout" className="bg-white/10 hover:bg-red-500/30 p-2 md:p-3 rounded-xl transition-all"><LogOutIcon /></button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-8 space-y-6">
        {currentView === 'DASHBOARD' && (
          <div className="space-y-6 animate-fade-in">
            {/* Header / Stats */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Status Overview</h2>
              <div className="flex items-center gap-3">
                 <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-3 py-1.5 rounded-full border border-emerald-200">{filteredEntries.length} Active Records</span>
                 <button onClick={() => { setEditingEntry(null); setFormData({name:'', stateCode:'', category: ReportCategory.SICK, details:''}); setCurrentView('FORM'); }} className="bg-emerald-800 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase flex items-center gap-2 shadow-lg hover:bg-emerald-900 transition-all"><PlusIcon /> Add New</button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
                <input type="text" placeholder="Search by name or state code..." className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border-none outline-none text-sm font-medium focus:ring-2 focus:ring-emerald-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <select className="bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}>
                  <option value="ALL">All Categories</option>
                  {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={() => { setSearchQuery(''); setFilterCategory('ALL'); setStartDate(''); setEndDate(''); }} className="bg-slate-100 text-slate-400 px-4 py-3 rounded-xl hover:bg-slate-200 transition-all"><TrashIcon /></button>
              </div>
            </div>

            {/* Content Area */}
            {filteredEntries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEntries.map(entry => (
                  <div key={entry.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-xl transition-all group relative border-t-8" style={{ borderTopColor: CATEGORY_COLORS[entry.category].split(' ')[1].replace('text-', '') }}>
                    <div className="flex items-start justify-between mb-4">
                      <div className={`p-3 rounded-xl border ${CATEGORY_COLORS[entry.category]}`}>{CATEGORY_ICONS[entry.category]}</div>
                      <span className="text-[9px] font-black bg-slate-50 text-slate-400 px-2 py-1 rounded-md uppercase tracking-widest">{entry.lga}</span>
                    </div>
                    <div className="mb-4">
                      <h3 className="font-black text-slate-900 uppercase text-base leading-tight mb-1">{entry.name}</h3>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{entry.stateCode}</p>
                    </div>
                    <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[9px] font-black uppercase text-slate-400">
                      <span className="flex items-center gap-1.5"><FileTextIcon /> {entry.category}</span>
                      <span>{new Date(entry.dateAdded).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="mt-4 pt-4 flex gap-2 justify-end border-t border-slate-50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingEntry(entry); setFormData({name:entry.name, stateCode:entry.stateCode, category:entry.category, details:(entry as any).details || ''}); setCurrentView('FORM'); }} className="p-2 text-slate-400 hover:text-emerald-600 transition-colors">✏️ Edit</button>
                      <button onClick={() => { if(confirm("Are you sure?")) deleteReport(dbRef.current, entry.id)}} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><TrashIcon /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-24 text-center bg-white rounded-3xl border border-slate-100 shadow-inner">
                <div className="inline-flex p-6 bg-slate-50 rounded-full mb-4 text-slate-200"><DashboardIcon /></div>
                <h3 className="text-lg font-black text-slate-300 uppercase tracking-widest">No matching records found</h3>
                <p className="text-slate-400 text-xs mt-2 uppercase">Adjust filters or add a new entry to begin</p>
              </div>
            )}
          </div>
        )}

        {currentView === 'FORM' && (
          <div className="max-w-2xl mx-auto animate-fade-in pb-12">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
              {/* Google Form Style Header */}
              <div className="h-4 bg-emerald-800 w-full"></div>
              <div className="p-8 space-y-8">
                <div>
                  <h2 className="text-3xl font-black uppercase text-slate-800 mb-2">{editingEntry ? 'Update Entry' : 'Weekly Status Submission'}</h2>
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-widest border-b pb-4 border-slate-100">Official NYSC Daura Secretariat Report Form</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-8">
                  {/* Form Questions Grouped in 'Cards' */}
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black uppercase text-slate-700">Corps Member Full Name <span className="text-red-500">*</span></label>
                      <input required className="w-full p-4 bg-slate-50 border-b-2 border-slate-200 rounded-lg font-bold text-slate-800 focus:border-emerald-600 outline-none transition-all uppercase" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} placeholder="e.g. ADEMOLA CHINEDU BELLO" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-black uppercase text-slate-700">State Code <span className="text-red-500">*</span></label>
                      <input required className="w-full p-4 bg-slate-50 border-b-2 border-slate-200 rounded-lg font-bold text-slate-800 focus:border-emerald-600 outline-none transition-all uppercase" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} placeholder="KT/23C/1234" />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-black uppercase text-slate-700">Report Category <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.values(ReportCategory).map(c => (
                          <label key={c} className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.category === c ? 'border-emerald-600 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
                            <input type="radio" name="category" className="hidden" value={c} checked={formData.category === c} onChange={() => setFormData({...formData, category: c})} />
                            <span className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${formData.category === c ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                              {formData.category === c && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                            </span>
                            <span className="text-xs font-black uppercase text-slate-700">{c}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-black uppercase text-slate-700">Incident Details / Remarks</label>
                      <textarea className="w-full p-4 bg-slate-50 border-b-2 border-slate-200 rounded-lg font-medium text-slate-800 focus:border-emerald-600 outline-none transition-all h-32" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} placeholder="Provide specific details about the incident, dates, hospitals, etc..." />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 pt-4">
                    <button type="submit" className="flex-1 bg-emerald-800 text-white p-5 rounded-xl font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-emerald-900 transition-all">Submit Record</button>
                    <button type="button" onClick={() => setCurrentView('DASHBOARD')} className="flex-1 bg-slate-100 text-slate-500 p-5 rounded-xl font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-200 transition-all">Discard & Back</button>
                  </div>
                </form>
              </div>
            </div>
            <p className="text-center text-slate-400 text-[9px] font-black uppercase mt-6 tracking-[0.3em]">Confidential Government Submission</p>
          </div>
        )}
      </main>

      <footer className="p-8 text-center bg-white border-t border-slate-100">
        <p className="text-slate-300 text-[10px] font-black uppercase tracking-[0.4em]">NYSC KATSINA • INTERNAL AUDIT PORTAL</p>
      </footer>
    </div>
  );
};

export default App;
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

type ViewMode = 'DASHBOARD' | 'FORM' | 'STAT_REPORT';

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
      dbRef.current = initFirebase(firebaseConfig);
      const unsubscribe = subscribeToReports(dbRef.current, (data) => setEntries(data as CorpsMemberEntry[]));
      return () => unsubscribe && unsubscribe();
    }
  }, [isAuthenticated]);

  const filteredEntries = useMemo(() => {
    // Role based base filtering
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      lga: lgaContext || 'Daura', // For ZI using specific entry
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
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-10">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">NYSC DAURA</h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Intelligence Access</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <select required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-700 outline-none" onChange={e => {
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
      <header className={`bg-slate-900 text-white p-6 shadow-xl flex justify-between items-center`}>
        <div className="flex items-center gap-4">
          <DashboardIcon />
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">{userRole === 'ZI' ? 'DAURA ZONAL HQ' : `${lgaContext} STATION`}</h1>
            <p className="text-[9px] opacity-60 font-bold uppercase tracking-widest">NYSC Compliance Hub</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleLogout} className="bg-white/10 hover:bg-red-500/30 p-3 rounded-xl transition-all"><LogOutIcon /></button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-6 md:p-8 space-y-8">
        {currentView === 'DASHBOARD' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
                <input type="text" placeholder="Search name or code..." className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <button onClick={() => { setEditingEntry(null); setFormData({name:'', stateCode:'', category: ReportCategory.SICK, details:''}); setCurrentView('FORM'); }} className="bg-emerald-800 text-white px-6 py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg"><PlusIcon /> New Report</button>
            </div>

            {/* Filter Dashboard */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block ml-1">Category</label>
                <select className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" value={filterCategory} onChange={e => setFilterCategory(e.target.value as any)}>
                  <option value="ALL">All Categories</option>
                  {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block ml-1">From Date</label>
                <input type="date" className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-1.5 block ml-1">To Date</label>
                <input type="date" className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
              <button onClick={() => { setSearchQuery(''); setFilterCategory('ALL'); setStartDate(''); setEndDate(''); }} className="p-3 text-slate-400 hover:text-emerald-700 font-black uppercase text-[10px] tracking-widest text-left">Reset Filters</button>
            </div>

            {/* Entries Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEntries.map(entry => (
                <div key={entry.id} className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition-all group relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-xl border ${CATEGORY_COLORS[entry.category]}`}>{CATEGORY_ICONS[entry.category]}</div>
                    <span className="text-[8px] font-black bg-slate-50 text-slate-400 px-2 py-1 rounded-full uppercase">{entry.lga}</span>
                  </div>
                  <div className="mb-4">
                    <h3 className="font-black text-slate-900 uppercase text-sm mb-0.5">{entry.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{entry.stateCode}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-50 flex justify-between items-center text-[9px] font-black uppercase text-slate-400">
                    <span>{entry.category}</span>
                    <span>{new Date(entry.dateAdded).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-4 flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingEntry(entry); setFormData({name:entry.name, stateCode:entry.stateCode, category:entry.category, details:(entry as any).details || ''}); setCurrentView('FORM'); }} className="p-2 text-slate-300 hover:text-emerald-600">✏️</button>
                    {(userRole === 'ZI' || (userRole === 'LGI' && lgaContext === entry.lga)) && (
                      <button onClick={() => deleteReport(dbRef.current, entry.id)} className="p-2 text-slate-300 hover:text-red-500"><TrashIcon /></button>
                    )}
                  </div>
                </div>
              ))}
              {filteredEntries.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase tracking-widest">No matching records</div>
              )}
            </div>
          </div>
        )}

        {currentView === 'FORM' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-2xl font-black uppercase text-slate-800 mb-6">{editingEntry ? 'Edit Entry' : 'New Report Entry'}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Corps Member Name</label>
                  <input required className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-400 mb-2 block">State Code</label>
                  <input required className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Status Category</label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ReportCategory})}>
                    {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Additional Details</label>
                  <textarea className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-bold h-32" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="submit" className="flex-1 bg-emerald-800 text-white p-4 rounded-xl font-black uppercase text-xs shadow-lg">Save Record</button>
                  <button type="button" onClick={() => setCurrentView('DASHBOARD')} className="flex-1 bg-slate-100 text-slate-500 p-4 rounded-xl font-black uppercase text-xs">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <footer className="p-6 text-center text-slate-300 text-[9px] font-black uppercase tracking-[0.3em]">
        NYSC KATSINA • {userRole} CONSOLE • INTERNAL USE ONLY
      </footer>
    </div>
  );
};

export default App;
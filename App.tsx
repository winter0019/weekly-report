update

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
import { summarizeReport } from './services/geminiService';
import { initFirebase, subscribeToReports, addReport, deleteReport } from './services/firebaseService';

const firebaseConfig = {
  apiKey: "AIzaSyA4Jk01ZevFJ0KjpCPysA9oWMeN56_QLcQ",
  authDomain: "weeklyreport-a150a.firebaseapp.com",
  projectId: "weeklyreport-a150a",
  storageBucket: "weeklyreport-a150a.firebasestorage.app",
  messagingSenderId: "225162027576",
  appId: "1:225162027576:web:410acb6dc77acc0ecebccd",
  measurementId: "G-GHY3Q0HDBH"
};

const DAURA_ZONE_LGAS: DauraLga[] = ['Daura', 'Baure', 'Zango', 'Sandamu', 'Mai’Adua', 'Mashi', 'Dutsi', 'Mani', 'Bindawa'];

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

type ViewMode = 'DASHBOARD' | 'FORM' | 'SUCCESS' | 'SUMMARY' | 'STAT_REPORT';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => localStorage.getItem('daura_lga') as DauraLga);
  
  const [entries, setEntries] = useState<CorpsMemberEntry[]>([]);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isError, setIsError] = useState(false);
  const dbRef = useRef<any>(null);

  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [pendingLga, setPendingLga] = useState<DauraLga | null>(null);
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [selectedCat, setSelectedCat] = useState<ReportCategory>(ReportCategory.ABSCONDED);
  const [formData, setFormData] = useState({ name: '', code: '', detail1: '', detail2: '', hosp: false });

  // Dynamic Theme Selection
  const theme = useMemo(() => {
    if (userRole === 'ZI') {
      return {
        headerBg: 'bg-slate-900',
        primaryBtn: 'bg-slate-800 hover:bg-slate-900',
        accentColor: 'text-slate-800',
        shadowColor: 'shadow-slate-200',
        title: 'DAURA ZONAL HQ',
        subtitle: 'Zonal Intelligence Command'
      };
    }
    return {
      headerBg: 'bg-emerald-800',
      primaryBtn: 'bg-emerald-600 hover:bg-emerald-700',
      accentColor: 'text-emerald-600',
      shadowColor: 'shadow-emerald-200',
      title: `${(lgaContext || 'LGA').toUpperCase()} TERMINAL`,
      subtitle: 'Official LGA Reporting Node'
    };
  }, [userRole, lgaContext]);

  useEffect(() => {
    if (isAuthenticated) {
      try {
        dbRef.current = initFirebase(firebaseConfig);
        const unsubscribe = subscribeToReports(dbRef.current, 
          (data) => { setEntries(data); setIsCloudConnected(true); setIsError(false); },
          (err) => { console.error("Cloud Connection Error:", err); setIsCloudConnected(false); setIsError(true); }
        );
        return () => { if (unsubscribe) unsubscribe(); };
      } catch (e) { setIsCloudConnected(false); setIsError(true); }
    }
  }, [isAuthenticated]);

  const stats = useMemo(() => {
    const lgaCounts: Record<string, number> = {};
    const catCounts: Record<string, number> = {};
    
    DAURA_ZONE_LGAS.forEach(l => lgaCounts[l] = 0);
    Object.values(ReportCategory).forEach(c => catCounts[c] = 0);

    entries.forEach(e => {
      lgaCounts[e.lga] = (lgaCounts[e.lga] || 0) + 1;
      catCounts[e.category] = (catCounts[e.category] || 0) + 1;
    });

    return { lgaCounts, catCounts, total: entries.length };
  }, [entries]);

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
      setLoginError(false);
    } else { setLoginError(true); }
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsAuthenticated(false);
    setUserRole(null);
    setLgaContext(null);
    setPendingRole(null);
    setPendingLga(null);
    setPin('');
  };

  const exportCSV = () => {
    if (entries.length === 0) return;
    const headers = ["Name", "State Code", "Category", "LGA", "Date Added", "Report Details"];
    const rows = entries.map(e => [
      e.name, 
      e.stateCode, 
      e.category, 
      e.lga, 
      new Date(e.dateAdded).toLocaleDateString(),
      (e as any).period || (e as any).illness || (e as any).dateKidnapped || (e as any).dateMissing || (e as any).dateOfDeath || ''
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(r => r.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Daura_Zone_Data_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareStats = () => {
    const catEntries = Object.entries(stats.catCounts) as [string, number][];
    const lgaEntries = Object.entries(stats.lgaCounts) as [string, number][];

    const text = `NYSC DAURA ZONE - SITUATION REPORT\nDate: ${new Date().toLocaleDateString()}\nTotal Incidents: ${stats.total}\n\nCategory Breakdown:\n${catEntries.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nLGA Breakdown:\n${lgaEntries.filter(([_, v]) => v > 0).map(([k, v]) => `- ${k}: ${v}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    alert("Report stats copied to clipboard for sharing.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lgaContext) return;
    
    const newEntry: any = {
      name: formData.name,
      stateCode: formData.code,
      lga: lgaContext,
      category: selectedCat,
      dateAdded: new Date().toISOString(),
    };

    switch (selectedCat) {
      case ReportCategory.ABSCONDED: newEntry.period = formData.detail1; break;
      case ReportCategory.SICK: 
        newEntry.illness = formData.detail1; 
        newEntry.hospitalized = formData.hosp; 
        break;
      case ReportCategory.KIDNAPPED: newEntry.dateKidnapped = formData.detail1; break;
      case ReportCategory.MISSING: newEntry.dateMissing = formData.detail1; break;
      case ReportCategory.DECEASED: 
        newEntry.dateOfDeath = formData.detail1; 
        newEntry.reason = formData.detail2; 
        break;
    }

    try {
      await addReport(dbRef.current, newEntry);
      setFormData({ name: '', code: '', detail1: '', detail2: '', hosp: false });
      setCurrentView('SUCCESS');
    } catch (err) {
      alert("Error submitting report.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Permanently remove this entry from the database?")) {
      try {
        await deleteReport(dbRef.current, id);
      } catch (err) {
        alert("Deletion failed.");
      }
    }
  };

  const handleSummarize = async () => {
    setIsGenerating(true);
    try {
      const result = await summarizeReport(entries, "Daura Zone");
      setSummary(result);
      setCurrentView('SUMMARY');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      e.stateCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.lga.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [entries, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 border border-slate-200">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mb-4">
              <span className="text-white text-2xl font-bold">NYSC</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Daura Zone Intelligence</h1>
            <p className="text-slate-500 text-sm">Security & Discipline Portal</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Access Role</label>
              <select 
                required
                className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                onChange={(e) => {
                  const val = e.target.value as UserRole;
                  setPendingRole(val);
                  if (val === 'ZI') setPendingLga(null);
                }}
              >
                <option value="">Select Role</option>
                <option value="ZI">Zonal Inspector (ZI)</option>
                <option value="LGI">Local Government Inspector (LGI)</option>
              </select>
            </div>

            {pendingRole === 'LGI' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Local Government Area</label>
                <select 
                  required
                  className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none"
                  onChange={(e) => setPendingLga(e.target.value as DauraLga)}
                >
                  <option value="">Select LGA</option>
                  {DAURA_ZONE_LGAS.map(lga => <option key={lga} value={lga}>{lga}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Security PIN</label>
              <input 
                type="password"
                required
                maxLength={4}
                className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-center tracking-widest"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
              />
            </div>

            {loginError && <p className="text-red-500 text-sm text-center">Invalid credentials or access denied.</p>}

            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-xl font-semibold transition-all shadow-lg hover:shadow-emerald-200">
              Unlock Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className={`${theme.headerBg} text-white shadow-lg sticky top-0 z-50 print:hidden transition-colors duration-500`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('DASHBOARD')}>
            <DashboardIcon />
            <div>
              <h1 className="font-bold text-lg leading-none uppercase tracking-tighter">{theme.title}</h1>
              <span className="text-[10px] opacity-75 uppercase tracking-widest">{theme.subtitle}</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:block text-right">
              <p className="text-sm font-medium">{userRole === 'ZI' ? 'Zonal Inspector' : `${lgaContext} LGI`}</p>
              <p className="text-[10px] uppercase tracking-wider opacity-60">Session Secure</p>
            </div>
            <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
              <LogOutIcon />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {currentView === 'DASHBOARD' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
              <div className="relative w-full md:w-96">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <SearchIcon />
                </div>
                <input 
                  type="text"
                  placeholder="Filter records..."
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button onClick={() => setCurrentView('FORM')} className={`flex-1 md:flex-none flex items-center justify-center space-x-2 ${theme.primaryBtn === 'bg-slate-800 hover:bg-slate-900' ? 'bg-slate-700 hover:bg-slate-800' : 'bg-emerald-600 hover:bg-emerald-700'} text-white px-5 py-3 rounded-xl transition-all shadow-md`}>
                  <PlusIcon /> <span className="text-sm font-bold uppercase">New Record</span>
                </button>
                {userRole === 'ZI' && (
                  <>
                    <button 
                      onClick={() => setCurrentView('STAT_REPORT')}
                      className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-slate-900 text-white px-5 py-3 rounded-xl hover:bg-black transition-all shadow-md"
                    >
                      <DashboardIcon /> <span className="text-sm font-bold uppercase">Generate Report</span>
                    </button>
                    <button 
                      onClick={handleSummarize} 
                      disabled={isGenerating || entries.length === 0}
                      className="flex-1 md:flex-none flex items-center justify-center space-x-2 bg-white text-slate-700 border border-slate-200 px-5 py-3 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50"
                    >
                      <FileTextIcon /> <span className="text-sm font-bold uppercase">{isGenerating ? 'Wait...' : 'AI Summary'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Corps Member</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Category</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">LGA</th>
                      <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Logged</th>
                      {userRole === 'ZI' && <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-widest">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900">{entry.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-tighter">{entry.stateCode}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${CATEGORY_COLORS[entry.category]}`}>
                            {CATEGORY_ICONS[entry.category]}
                            <span>{entry.category}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-xs font-bold uppercase tracking-wider">{entry.lga}</td>
                        <td className="px-6 py-4 text-slate-500 text-[10px] font-bold">
                          {new Date(entry.dateAdded).toLocaleDateString()}
                        </td>
                        {userRole === 'ZI' && (
                          <td className="px-6 py-4">
                            <button onClick={() => handleDelete(entry.id)} className="text-slate-300 hover:text-red-600 p-1 transition-colors">
                              <TrashIcon />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {filteredEntries.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-black uppercase tracking-widest text-xs opacity-50">Empty Data Vault</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentView === 'STAT_REPORT' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-white p-10 rounded-3xl border border-slate-200 shadow-2xl print:shadow-none print:border-none">
              <div className={`border-b-4 ${userRole === 'ZI' ? 'border-slate-900' : 'border-emerald-800'} pb-6 mb-8 flex justify-between items-start`}>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">NYSC DAURA ZONAL OFFICE</h2>
                  <p className="text-xs font-black text-slate-500 uppercase tracking-widest mt-1">Intelligence & Discipline Statistical Report</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-4">REPORT DATE: {new Date().toLocaleDateString('en-GB')}</p>
                </div>
                <div className="print:hidden flex gap-2">
                  <button onClick={() => window.print()} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-black transition-all">
                    <DownloadIcon />
                  </button>
                  <button onClick={shareStats} className="bg-emerald-600 text-white p-3 rounded-xl hover:bg-emerald-700 transition-all">
                    <ShareIcon />
                  </button>
                  <button onClick={() => setCurrentView('DASHBOARD')} className="bg-slate-100 text-slate-700 p-3 rounded-xl hover:bg-slate-200 transition-all font-bold text-xs uppercase">Close</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Records</p>
                  <p className="text-4xl font-black text-slate-900">{stats.total}</p>
                </div>
                <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Critical Alerts</p>
                  <p className="text-4xl font-black text-red-600">
                    {(stats.catCounts[ReportCategory.DECEASED] || 0) + (stats.catCounts[ReportCategory.KIDNAPPED] || 0)}
                  </p>
                </div>
                <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Pending Discipline</p>
                  <p className="text-4xl font-black text-amber-700">{stats.catCounts[ReportCategory.ABSCONDED] || 0}</p>
                </div>
              </div>

              <div className="space-y-10">
                <section>
                  <h3 className={`text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 ${userRole === 'ZI' ? 'border-slate-800' : 'border-emerald-600'} pl-3 mb-4`}>LGA Statistics Breakdown</h3>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-y border-slate-200">
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">Local Government Area</th>
                        <th className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Report Count</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(Object.entries(stats.lgaCounts) as [string, number][]).sort((a,b) => b[1] - a[1]).map(([lga, count]) => (
                        <tr key={lga} className={count > 0 ? 'bg-white font-bold' : 'bg-slate-50 opacity-40'}>
                          <td className="px-4 py-3 text-sm text-slate-700">{lga}</td>
                          <td className="px-4 py-3 text-sm text-slate-900 text-right">{count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                <section>
                  <h3 className={`text-sm font-black text-slate-900 uppercase tracking-widest border-l-4 ${userRole === 'ZI' ? 'border-slate-800' : 'border-emerald-600'} pl-3 mb-4`}>Category Distribution</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(Object.entries(stats.catCounts) as [string, number][]).map(([cat, count]) => (
                      <div key={cat} className="flex justify-between items-center p-4 border border-slate-100 rounded-xl">
                        <div className="flex items-center gap-3">
                          <span className={`p-2 rounded-lg ${CATEGORY_COLORS[cat as ReportCategory]}`}>
                            {CATEGORY_ICONS[cat as ReportCategory]}
                          </span>
                          <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">{cat}</span>
                        </div>
                        <span className="text-lg font-black text-slate-900">{count}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="mt-20 pt-10 border-t border-dotted border-slate-300 grid grid-cols-2 gap-20 text-center">
                <div>
                  <div className="h-px w-full bg-slate-300 mb-2"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiled By</p>
                  <p className="text-xs font-bold text-slate-900 mt-1 uppercase tracking-tighter">Intelligence Officer, Daura Zone</p>
                </div>
                <div>
                  <div className="h-px w-full bg-slate-300 mb-2"></div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized By</p>
                  <p className="text-xs font-bold text-slate-900 mt-1 uppercase tracking-tighter">Zonal Inspector, Daura Zone</p>
                </div>
              </div>
            </div>
            <div className="print:hidden flex justify-center pb-10">
               <button onClick={exportCSV} className="flex items-center gap-2 bg-slate-100 text-slate-700 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200">
                 <DownloadIcon /> Export Master CSV
               </button>
            </div>
          </div>
        )}

        {currentView === 'FORM' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className={`${theme.headerBg} p-8 text-white transition-colors duration-500`}>
                <h2 className="text-xl font-black uppercase tracking-tight">Incident Terminal</h2>
                <p className="text-white/70 text-[10px] font-black uppercase tracking-widest mt-1">Documentation for {lgaContext} LGA</p>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Full Name</label>
                    <input 
                      required
                      placeholder="SURNAME, OTHER NAMES"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold uppercase"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">State Code</label>
                    <input 
                      required
                      placeholder="KT/24B/0000"
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold uppercase"
                      value={formData.code}
                      onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Incident Classification</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.values(ReportCategory).map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSelectedCat(cat)}
                        className={`p-3 text-[10px] font-black uppercase rounded-xl border transition-all flex items-center justify-center space-x-2 ${
                          selectedCat === cat 
                            ? (userRole === 'ZI' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-emerald-600 border-emerald-600 text-white shadow-lg')
                            : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-500'
                        }`}
                      >
                        <span>{cat.split('/')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  {selectedCat === ReportCategory.ABSCONDED && (
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Period of Absence</label>
                      <input required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" placeholder="e.g. 14 Days" value={formData.detail1} onChange={(e) => setFormData({...formData, detail1: e.target.value})} />
                    </div>
                  )}
                  {selectedCat === ReportCategory.SICK && (
                    <>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Nature of Illness</label>
                        <input required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" value={formData.detail1} onChange={(e) => setFormData({...formData, detail1: e.target.value})} />
                      </div>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input type="checkbox" className={`w-5 h-5 rounded ${userRole === 'ZI' ? 'text-slate-900' : 'text-emerald-600'}`} checked={formData.hosp} onChange={(e) => setFormData({...formData, hosp: e.target.checked})} />
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Hospitalized?</span>
                      </label>
                    </>
                  )}
                  {(selectedCat === ReportCategory.KIDNAPPED || selectedCat === ReportCategory.MISSING) && (
                    <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Date Occurred</label>
                      <input type="date" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" value={formData.detail1} onChange={(e) => setFormData({...formData, detail1: e.target.value})} />
                    </div>
                  )}
                  {selectedCat === ReportCategory.DECEASED && (
                    <>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Date of Passing</label>
                        <input type="date" required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl" value={formData.detail1} onChange={(e) => setFormData({...formData, detail1: e.target.value})} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Cause of Death</label>
                        <textarea required className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none" rows={3} value={formData.detail2} onChange={(e) => setFormData({...formData, detail2: e.target.value})} />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setCurrentView('DASHBOARD')} className="flex-1 bg-slate-100 text-slate-500 p-4 rounded-xl font-black text-xs uppercase tracking-widest">Cancel</button>
                  <button type="submit" className={`flex-[2] ${userRole === 'ZI' ? 'bg-slate-900' : 'bg-emerald-600'} text-white p-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg`}>Transmit Entry</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {currentView === 'SUCCESS' && (
          <div className="max-w-md mx-auto text-center py-20">
            <div className={`w-20 h-20 ${userRole === 'ZI' ? 'bg-slate-100 text-slate-900' : 'bg-emerald-100 text-emerald-600'} rounded-full flex items-center justify-center mx-auto mb-6`}>
              <PlusIcon />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2">Report Transmitted</h2>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-wider mb-8">Successfully archived in Zonal Repository.</p>
            <button onClick={() => setCurrentView('DASHBOARD')} className={`w-full ${userRole === 'ZI' ? 'bg-slate-900' : 'bg-emerald-800'} text-white p-4 rounded-xl font-black text-xs uppercase tracking-widest`}>Return to Dashboard</button>
          </div>
        )}

        {currentView === 'SUMMARY' && summary && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">AI Intelligence Memo</h2>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Compiled by Zonal Terminal</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const blob = new Blob([summary], { type: 'text/plain' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `Daura_Zone_Memo_${new Date().toISOString().split('T')[0]}.txt`;
                      a.click();
                    }}
                    className="p-3 bg-slate-800 hover:bg-black rounded-xl"
                  >
                    <DownloadIcon />
                  </button>
                </div>
              </div>
              <div className="p-10 prose prose-slate max-w-none">
                <div className="whitespace-pre-wrap font-serif text-slate-800 leading-relaxed text-sm">
                  {summary}
                </div>
              </div>
              <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-center">
                <button onClick={() => setCurrentView('DASHBOARD')} className="bg-slate-900 text-white px-10 py-3 rounded-xl font-black text-xs uppercase tracking-widest">Dismiss Memo</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-8 print:hidden">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-[10px] font-black tracking-[0.2em] uppercase">
            Official NYSC Daura Zonal Intel Portal • Node: {userRole} • Status: {isCloudConnected ? 'Sync Active' : 'Offline'}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;

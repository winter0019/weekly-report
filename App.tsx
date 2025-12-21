
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ReportCategory, 
  CorpsMemberEntry, 
  AbscondedMember, 
  SickMember, 
  KidnappedMember, 
  MissingMember, 
  DeceasedMember,
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

const DAURA_ZONE_LGAS: DauraLga[] = [
  'Daura', 'Baure', 'Zango', 'Sandamu', 'Mai’Adua', 'Mashi', 'Dutsi', 'Mani', 'Bindawa'
];

const SECURITY_PINS: Record<string, string> = {
  'ZI': '0000',
  'Daura': '1111',
  'Baure': '2222',
  'Zango': '3333',
  'Sandamu': '4444',
  'Mai’Adua': '5555',
  'Mashi': '6666',
  'Dutsi': '7777',
  'Mani': '8888',
  'Bindawa': '9999',
};

const CATEGORY_COLORS: Record<string, string> = {
  [ReportCategory.ABSCONDED]: 'bg-amber-100 text-amber-700 border-amber-200',
  [ReportCategory.SICK]: 'bg-blue-100 text-blue-700 border-blue-200',
  [ReportCategory.KIDNAPPED]: 'bg-orange-100 text-orange-700 border-orange-200',
  [ReportCategory.MISSING]: 'bg-purple-100 text-purple-700 border-purple-200',
  [ReportCategory.DECEASED]: 'bg-red-100 text-red-700 border-red-200',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  [ReportCategory.ABSCONDED]: <AbscondedIcon />,
  [ReportCategory.SICK]: <SickIcon />,
  [ReportCategory.KIDNAPPED]: <KidnappedIcon />,
  [ReportCategory.MISSING]: <MissingIcon />,
  [ReportCategory.DECEASED]: <DeceasedIcon />,
};

type ViewMode = 'DASHBOARD' | 'FORM' | 'LGA_OVERSIGHT';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => localStorage.getItem('daura_lga') as DauraLga);
  const [entries, setEntries] = useState<CorpsMemberEntry[]>(() => {
    const saved = localStorage.getItem('daura_data');
    return saved ? JSON.parse(saved) : [];
  });

  const [currentView, setCurrentView] = useState<ViewMode>('DASHBOARD');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  
  // Auth Form States
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [pendingLga, setPendingLga] = useState<DauraLga | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  // Submission Form State
  const [selectedCat, setSelectedCat] = useState<ReportCategory>(ReportCategory.ABSCONDED);
  const [formData, setFormData] = useState({ name: '', code: '', detail1: '', detail2: '', hosp: false });

  useEffect(() => {
    localStorage.setItem('daura_data', JSON.stringify(entries));
  }, [entries]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const target = pendingRole === 'ZI' ? 'ZI' : pendingLga;
    if (pin === SECURITY_PINS[target!]) {
      setIsAuthenticated(true);
      setUserRole(pendingRole);
      setLgaContext(pendingLga);
      localStorage.setItem('daura_auth', 'true');
      localStorage.setItem('daura_role', pendingRole!);
      if (pendingLga) localStorage.setItem('daura_lga', pendingLga);
    } else {
      setError(true);
    }
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: any = {
      id: Math.random().toString(36).substr(2, 9),
      name: formData.name.toUpperCase(),
      stateCode: formData.code.toUpperCase(),
      dateAdded: new Date().toISOString(),
      lga: lgaContext || 'Daura',
      category: selectedCat,
    };

    switch (selectedCat) {
      case ReportCategory.ABSCONDED: newEntry.period = formData.detail1; break;
      case ReportCategory.SICK: newEntry.illness = formData.detail1; newEntry.hospitalized = formData.hosp; break;
      case ReportCategory.KIDNAPPED: newEntry.dateKidnapped = formData.detail1; break;
      case ReportCategory.MISSING: newEntry.dateMissing = formData.detail1; break;
      case ReportCategory.DECEASED: newEntry.dateOfDeath = formData.detail1; newEntry.reason = formData.detail2; break;
    }

    setEntries([...entries, newEntry]);
    setFormData({ name: '', code: '', detail1: '', detail2: '', hosp: false });
    alert("Record successfully synced to Zonal Terminal.");
    setCurrentView('DASHBOARD');
  };

  const downloadReport = () => {
    const csvRows = [
      ['Date', 'LGA', 'Category', 'Name', 'State Code', 'Details'].join(','),
      ...entries.map(e => [
        new Date(e.dateAdded).toLocaleDateString(),
        e.lga,
        e.category,
        `"${e.name}"`,
        e.stateCode,
        'period' in e ? e.period : 'illness' in e ? e.illness : 'N/A'
      ].join(','))
    ].join('\n');
    const blob = new Blob([csvRows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NYSC_Zonal_Report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getFilteredEntries = () => {
    return entries.filter(e => {
      const matchLga = userRole === 'ZI' ? true : e.lga === lgaContext;
      const matchSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.stateCode.toLowerCase().includes(searchQuery.toLowerCase());
      return matchLga && matchSearch;
    }).sort((a,b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  };

  const lgaStats = useMemo(() => {
    const stats: Record<string, Record<string, number>> = {};
    DAURA_ZONE_LGAS.forEach(lga => {
      stats[lga] = { total: 0 };
      Object.values(ReportCategory).forEach(cat => stats[lga][cat] = 0);
    });
    entries.forEach(e => {
      if (stats[e.lga]) {
        stats[e.lga].total++;
        stats[e.lga][e.category]++;
      }
    });
    return stats;
  }, [entries]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#064e3b] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl p-8 md:p-12 overflow-hidden relative">
          <div className="text-center mb-10">
            <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-green-100">
               <img src="https://api.dicebear.com/7.x/initials/svg?seed=NYSC&backgroundColor=064e3b" className="w-12 h-12 rounded-full" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Daura Zonal Command</h1>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Administrative Security Gate</p>
          </div>

          {!pendingRole ? (
            <div className="space-y-4">
              <button onClick={() => setPendingRole('ZI')} className="w-full p-6 bg-slate-900 text-white rounded-[1.5rem] flex items-center justify-between group hover:bg-black transition-all">
                <div className="text-left">
                  <span className="text-[9px] font-black opacity-50 uppercase tracking-widest block">Executive Access</span>
                  <span className="text-sm font-black uppercase">Zonal Inspector Terminal</span>
                </div>
                <div className="p-3 bg-white/10 rounded-xl"><DashboardIcon /></div>
              </button>
              <div className="grid grid-cols-2 gap-3">
                {DAURA_ZONE_LGAS.map(l => (
                  <button key={l} onClick={() => { setPendingRole('LGI'); setPendingLga(l); }} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black uppercase text-slate-600 hover:border-green-600 hover:bg-green-50 transition-all text-center">
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
               <div className="bg-green-50 p-6 rounded-2xl border border-green-100 text-center">
                  <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Target Terminal</span>
                  <h2 className="text-lg font-black text-green-900 uppercase mt-1">{pendingLga || 'Zonal HQ'}</h2>
               </div>
               <div className="space-y-2">
                 <input autoFocus type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={4} placeholder="••••" className="w-full text-center text-4xl font-black tracking-[0.5em] border-2 border-slate-100 rounded-2xl p-5 focus:border-green-600 outline-none" />
                 {error && <p className="text-red-600 text-[10px] font-black uppercase text-center">Invalid Authorization Pin</p>}
               </div>
               <button type="submit" className="w-full bg-[#064e3b] text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Grant Access</button>
               <button type="button" onClick={() => setPendingRole(null)} className="w-full text-[9px] font-black text-slate-400 uppercase hover:text-green-600">Switch Terminal</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header Bar */}
      <header className="bg-[#064e3b] text-white p-6 sticky top-0 z-40 shadow-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-[#064e3b] font-black text-xs shadow-inner">
              {userRole === 'ZI' ? 'ZI' : 'LG'}
            </div>
            <div className="hidden sm:block">
              <h1 className="text-[10px] font-black uppercase tracking-widest opacity-60">Daura Zone Secure Portal</h1>
              <p className="text-xs font-black uppercase tracking-tight">{userRole === 'ZI' ? 'Zonal Inspector' : lgaContext}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentView('DASHBOARD')} className={`p-3 rounded-xl transition-all ${currentView === 'DASHBOARD' ? 'bg-white text-green-900 shadow-lg' : 'hover:bg-white/10'}`}><DashboardIcon /></button>
            {userRole === 'LGI' && <button onClick={() => setCurrentView('FORM')} className={`p-3 rounded-xl transition-all ${currentView === 'FORM' ? 'bg-white text-green-900 shadow-lg' : 'hover:bg-white/10'}`}><PlusIcon /></button>}
            <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="bg-red-500/20 hover:bg-red-500 text-white p-3 rounded-xl transition-all"><LogOutIcon /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-8">
        {userRole === 'ZI' && currentView === 'DASHBOARD' && (
          <div className="mb-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Zonal Metrics */}
            <div className="lg:col-span-1 space-y-6">
               <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                  <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Zone Health Index</h2>
                  <div className="space-y-4">
                    {Object.values(ReportCategory).map(cat => (
                      <div key={cat} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${CATEGORY_COLORS[cat]}`}>{CATEGORY_ICONS[cat]}</div>
                          <span className="text-[10px] font-black uppercase text-slate-600">{cat}</span>
                        </div>
                        <span className="font-black text-slate-900">{entries.filter(e => e.category === cat).length}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={downloadReport} className="w-full mt-6 bg-slate-900 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all">
                    <DownloadIcon /> Export Master CSV
                  </button>
                  <button 
                    disabled={isGenerating}
                    onClick={async () => {
                      setIsGenerating(true);
                      try {
                        const res = await summarizeReport(entries, "Daura Zonal Command");
                        setSummary(res);
                      } catch (e) { alert("AI Gateway Busy."); }
                      setIsGenerating(false);
                    }}
                    className="w-full mt-3 bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg"
                  >
                    <FileTextIcon /> {isGenerating ? 'ANALYZING...' : 'Compile AI Memo'}
                  </button>
               </div>
            </div>

            {/* LGA Oversight Grid */}
            <div className="lg:col-span-2">
              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">LGA Field Monitoring</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                   {DAURA_ZONE_LGAS.map(lga => {
                     const s = lgaStats[lga];
                     const isCritical = s[ReportCategory.DECEASED] > 0 || s[ReportCategory.KIDNAPPED] > 0;
                     return (
                       <div key={lga} className={`p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] ${isCritical ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex justify-between items-start mb-4">
                             <h3 className="text-[11px] font-black uppercase text-slate-900">{lga}</h3>
                             <div className="bg-white px-2 py-1 rounded-lg border border-slate-200 text-[9px] font-black text-slate-500 shadow-sm">{s.total} Total</div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                             {Object.values(ReportCategory).map(cat => (
                               s[cat] > 0 && (
                                 <div key={cat} className={`w-6 h-6 rounded-md flex items-center justify-center text-[8px] font-black shadow-sm ${CATEGORY_COLORS[cat]}`}>
                                    {s[cat]}
                                 </div>
                               )
                             ))}
                          </div>
                          {isCritical && <div className="mt-3 text-[8px] font-black text-red-600 uppercase flex items-center gap-1 animate-pulse">⚠️ Priority Required</div>}
                       </div>
                     );
                   })}
                </div>
              </div>
            </div>
          </div>
        )}

        {currentView === 'DASHBOARD' ? (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative flex-1 w-full">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
                <input type="text" placeholder="Search Master Ledger by Name or State Code..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-white border border-slate-200 rounded-2xl pl-16 pr-8 py-5 text-sm font-bold shadow-sm focus:border-green-600 outline-none" />
              </div>
              {userRole === 'LGI' && (
                <button onClick={() => setCurrentView('FORM')} className="w-full md:w-auto bg-[#064e3b] text-white px-10 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 hover:bg-black transition-all">
                  <PlusIcon /> Submit Weekly Report
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {getFilteredEntries().map(e => (
                <div key={e.id} className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm hover:shadow-xl transition-all relative group overflow-hidden">
                  <div className={`absolute top-0 right-0 p-4 font-black text-[9px] uppercase tracking-widest ${CATEGORY_COLORS[e.category]} rounded-bl-2xl border-l border-b`}>
                    {e.category}
                  </div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${CATEGORY_COLORS[e.category]}`}>
                      {CATEGORY_ICONS[e.category]}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 uppercase text-sm truncate max-w-[150px]">{e.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{e.stateCode}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-2xl space-y-3 mb-6">
                    <div className="flex justify-between text-[9px] font-black uppercase">
                      <span className="text-slate-400">Jurisdiction</span>
                      <span className="text-indigo-900">{e.lga} LGA</span>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                      <p className="text-[10px] font-bold text-slate-600 leading-relaxed italic">
                        "{'period' in e ? e.period : 'illness' in e ? e.illness : 'Details logged in terminal.'}"
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => {
                      const text = `*NYSC ZONAL REPORT*\nLGA: ${e.lga}\nCat: ${e.category}\nName: ${e.name}\nCode: ${e.stateCode}`;
                      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                    }} className="flex-1 bg-green-50 text-green-700 p-3 rounded-xl text-[9px] font-black uppercase flex items-center justify-center gap-2 hover:bg-green-600 hover:text-white transition-all">
                      <ShareIcon /> Dispatch
                    </button>
                    <button onClick={() => { if(confirm("Confirm deletion?")) setEntries(entries.filter(x => x.id !== e.id)); }} className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"><TrashIcon /></button>
                  </div>
                </div>
              ))}
              {getFilteredEntries().length === 0 && (
                <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                  <p className="text-slate-300 font-black uppercase tracking-widest">No matching records found in ledger</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom-10 duration-500">
             <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
                <div className="p-10 bg-slate-900 text-white flex justify-between items-center">
                   <div>
                      <h2 className="text-xl font-black uppercase tracking-tight">New Incident Report</h2>
                      <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mt-1">Terminal: {lgaContext} LGA</p>
                   </div>
                   <button onClick={() => setCurrentView('DASHBOARD')} className="text-white/50 hover:text-white font-black text-xs uppercase tracking-widest">Cancel</button>
                </div>
                
                <div className="p-10">
                   <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-10">
                      {Object.values(ReportCategory).map(cat => (
                        <button key={cat} onClick={() => setSelectedCat(cat)} className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-all border-2 ${selectedCat === cat ? 'bg-green-50 border-green-600 text-green-900' : 'bg-slate-50 border-transparent text-slate-400'}`}>
                           <div className="text-sm">{CATEGORY_ICONS[cat]}</div>
                           <span className="text-[8px] font-black uppercase text-center leading-none">{cat.split('/')[0]}</span>
                        </button>
                      ))}
                   </div>

                   <form onSubmit={submitForm} className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Corps Member Name</label>
                         <input required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="SURNAME FIRSTNAME MIDDLENAME" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 font-bold uppercase focus:border-green-600 outline-none" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">State Code</label>
                         <input required value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="KT/24B/0000" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 font-bold uppercase focus:border-green-600 outline-none" />
                      </div>
                      
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Incident/Period Details</label>
                         <textarea required value={formData.detail1} onChange={e => setFormData({...formData, detail1: e.target.value})} placeholder="Provide detailed context..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-5 font-bold h-32 resize-none focus:border-green-600 outline-none" />
                      </div>

                      {selectedCat === ReportCategory.SICK && (
                        <label className="flex items-center gap-4 p-5 bg-blue-50 rounded-2xl border border-blue-100 cursor-pointer">
                           <input type="checkbox" checked={formData.hosp} onChange={e => setFormData({...formData, hosp: e.target.checked})} className="w-5 h-5 accent-blue-600" />
                           <span className="text-[10px] font-black uppercase text-blue-900">Patient is currently Hospitalized?</span>
                        </label>
                      )}

                      <button type="submit" className="w-full bg-[#064e3b] text-white py-6 rounded-2xl font-black uppercase tracking-widest shadow-2xl hover:scale-[1.01] transition-all flex items-center justify-center gap-3 mt-6">
                        <PlusIcon /> Commit to Zonal Ledger
                      </button>
                   </form>
                </div>
             </div>
          </div>
        )}
      </main>

      {/* AI Summary Modal */}
      {summary && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-500">
            <div className="p-8 border-b flex justify-between items-center bg-slate-50">
              <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900">Zonal Executive Memorandum</h2>
              <button onClick={() => setSummary(null)} className="p-3 hover:bg-slate-200 rounded-full transition-all">✕</button>
            </div>
            <div className="p-10 overflow-y-auto whitespace-pre-wrap font-serif text-lg leading-relaxed text-slate-800 bg-slate-50/50">
              {summary}
            </div>
            <div className="p-8 border-t flex justify-end gap-3 bg-white">
              <button onClick={() => {
                window.open(`https://wa.me/?text=${encodeURIComponent("*ZONAL MEMO SUMMARY*\n\n" + summary.substring(0, 500) + "...")}`, '_blank');
              }} className="px-8 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2">
                <ShareIcon /> Official Dispatch
              </button>
              <button onClick={() => setSummary(null)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest">Close Record</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="mt-20 text-center text-slate-400">
         <p className="text-[9px] font-black uppercase tracking-[0.4em]">Internal Security System • Daura Zone HQ</p>
         <p className="text-[8px] font-bold mt-2">v3.0 Secure Terminal • Authorized Personnel Only</p>
      </footer>
    </div>
  );
};

export default App;

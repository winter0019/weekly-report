
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
import { PlusIcon, DownloadIcon, ShareIcon, LogOutIcon, TrashIcon, FileTextIcon } from './components/Icons';
import { summarizeReport } from './services/geminiService';

const DAURA_ZONE_LGAS: DauraLga[] = [
  'Daura', 'Baure', 'Zango', 'Sandamu', 'Mai’Adua', 'Mashi', 'Dutsi', 'Mani', 'Bindawa'
];

/**
 * OFFICIAL DEFAULT SECURITY PINS
 * -----------------------------
 * Zonal Inspector (ZI): 0000
 * 
 * Local Government Inspectors (LGIs):
 * 1. Daura    : 1111
 * 2. Baure    : 2222
 * 3. Zango    : 3333
 * 4. Sandamu  : 4444
 * 5. Mai’Adua : 5555
 * 6. Mashi    : 6666
 * 7. Dutsi    : 7777
 * 8. Mani     : 8888
 * 9. Bindawa  : 9999
 */
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

const App: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    const saved = localStorage.getItem('daura_user_role');
    return (saved as UserRole) || null;
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('daura_authenticated') === 'true';
  });
  const [entries, setEntries] = useState<CorpsMemberEntry[]>(() => {
    const saved = localStorage.getItem('daura_zone_entries');
    return saved ? JSON.parse(saved) : [];
  });
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => {
    const saved = localStorage.getItem('daura_lga_context');
    return (saved as DauraLga) || null;
  });

  // Authentication Flow States
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [pendingLga, setPendingLga] = useState<DauraLga | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState(false);

  const [zoneName, setZoneName] = useState('Daura Zone Secretariat');
  const [activeCategory, setActiveCategory] = useState<ReportCategory | 'LGA_OVERVIEW'>(() => {
    const savedRole = localStorage.getItem('daura_user_role');
    return savedRole === 'LGI' ? 'LGA_OVERVIEW' : ReportCategory.ABSCONDED;
  });
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  
  const [ziViewLga, setZiViewLga] = useState<DauraLga | 'OVERVIEW'>('OVERVIEW');

  // Form states
  const [name, setName] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [extraField1, setExtraField1] = useState(''); 
  const [extraField2, setExtraField2] = useState(''); 
  const [isHospitalized, setIsHospitalized] = useState(false);

  useEffect(() => {
    localStorage.setItem('daura_zone_entries', JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    if (userRole) {
      localStorage.setItem('daura_user_role', userRole);
    } else {
      localStorage.removeItem('daura_user_role');
    }
    
    if (lgaContext) {
      localStorage.setItem('daura_lga_context', lgaContext);
    } else {
      localStorage.removeItem('daura_lga_context');
    }
    
    localStorage.setItem('daura_authenticated', isAuthenticated.toString());
  }, [userRole, lgaContext, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const targetKey = pendingRole === 'ZI' ? 'ZI' : (pendingLga || '');
    const correctPin = SECURITY_PINS[targetKey];

    if (pinInput === correctPin) {
      setUserRole(pendingRole);
      setLgaContext(pendingLga);
      setIsAuthenticated(true);
      setActiveCategory(pendingRole === 'LGI' ? 'LGA_OVERVIEW' : ReportCategory.ABSCONDED);
      setLoginError(false);
      setPinInput('');
    } else {
      setLoginError(true);
      setPinInput('');
      if (window.navigator.vibrate) window.navigator.vibrate(200);
    }
  };

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveLga = userRole === 'LGI' ? lgaContext : (ziViewLga !== 'OVERVIEW' ? ziViewLga : null);
    
    if (!name || !stateCode || !effectiveLga || activeCategory === 'LGA_OVERVIEW') {
      alert("Please ensure Name, State Code, and Category are specified.");
      return;
    }

    const base = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      stateCode,
      dateAdded: new Date().toISOString(),
      lga: effectiveLga as DauraLga,
    };

    let newEntry: CorpsMemberEntry;

    switch (activeCategory) {
      case ReportCategory.ABSCONDED:
        newEntry = { ...base, category: ReportCategory.ABSCONDED, period: extraField1 } as AbscondedMember;
        break;
      case ReportCategory.SICK:
        newEntry = { ...base, category: ReportCategory.SICK, illness: extraField1, hospitalized: isHospitalized } as SickMember;
        break;
      case ReportCategory.KIDNAPPED:
        newEntry = { ...base, category: ReportCategory.KIDNAPPED, dateKidnapped: extraField1 } as KidnappedMember;
        break;
      case ReportCategory.MISSING:
        newEntry = { ...base, category: ReportCategory.MISSING, dateMissing: extraField1 } as MissingMember;
        break;
      case ReportCategory.DECEASED:
        newEntry = { ...base, category: ReportCategory.DECEASED, dateOfDeath: extraField1, reason: extraField2 } as DeceasedMember;
        break;
      default:
        return;
    }

    setEntries([...entries, newEntry]);
    resetForm();
    alert("Record saved successfully!");
  };

  const resetForm = () => {
    setName('');
    setStateCode('');
    setExtraField1('');
    setExtraField2('');
    setIsHospitalized(false);
  };

  const removeEntry = (id: string) => {
    if (confirm("Are you sure you want to delete this record?")) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const handleDownloadCSV = () => {
    const headers = ['LGA', 'Category', 'Name', 'State Code', 'Extra Details'];
    const rows = entries.map(e => {
      let details = '';
      if ('period' in e) details = `Period: ${e.period}`;
      else if ('illness' in e) details = `Illness: ${e.illness}, Hospitalized: ${e.hospitalized}`;
      else if ('dateKidnapped' in e) details = `Kidnapped: ${e.dateKidnapped}`;
      else if ('dateMissing' in e) details = `Missing: ${e.dateMissing}`;
      else if ('dateOfDeath' in e) details = `Died: ${e.dateOfDeath}, Reason: ${e.reason}`;
      
      return [e.lga, e.category, e.name, e.stateCode, details].map(field => `"${field}"`).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Daura_Zone_Master_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateSummary = async () => {
    if (entries.length === 0) {
      alert("No data available to generate a summary.");
      return;
    }
    setIsGeneratingSummary(true);
    const text = await summarizeReport(entries, zoneName);
    setSummary(text);
    setIsGeneratingSummary(false);
  };

  const filteredEntries = useMemo(() => {
    const currentLga = userRole === 'LGI' ? lgaContext : ziViewLga;
    if (activeCategory === 'LGA_OVERVIEW') return [];
    return entries.filter(e => 
      (currentLga === 'OVERVIEW' || e.lga === currentLga) && 
      e.category === activeCategory
    );
  }, [entries, userRole, lgaContext, ziViewLga, activeCategory]);

  const lgaRecentEntries = useMemo(() => {
    if (userRole !== 'LGI' || !lgaContext) return [];
    return entries
      .filter(e => e.lga === lgaContext)
      .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
      .slice(0, 5);
  }, [entries, userRole, lgaContext]);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.confirm("Are you sure you want to end your secure reporting session and log out?")) {
      setIsAuthenticated(false);
      setUserRole(null);
      setLgaContext(null);
      setPendingRole(null);
      setPendingLga(null);
      setPinInput('');
      setLoginError(false);
      localStorage.removeItem('daura_user_role');
      localStorage.removeItem('daura_lga_context');
      localStorage.setItem('daura_authenticated', 'false');
    }
  };

  // Login Gateway Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center p-4 overflow-hidden relative font-sans">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
           <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-green-400 rounded-full blur-[150px] animate-pulse" />
           <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-white rounded-full blur-[150px] animate-pulse delay-700" />
        </div>
        
        <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-5xl w-full overflow-hidden flex flex-col md:flex-row relative z-10 animate-in fade-in zoom-in-95 duration-700 border border-white/20">
          <div className="md:w-5/12 bg-green-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="relative z-10">
              <img src="https://api.dicebear.com/7.x/initials/svg?seed=NYSC&backgroundColor=ffffff" className="w-20 h-20 rounded-3xl mb-8 shadow-2xl border-4 border-green-800" alt="NYSC" />
              <h1 className="text-4xl font-black mb-6 uppercase tracking-tighter leading-[0.9]">DAURA ZONE<br/><span className="text-green-400">SECURE PORTAL</span></h1>
              <p className="text-green-100 opacity-80 leading-relaxed font-semibold text-sm max-w-xs">
                Restricted reporting portal for Daura Zonal Secretariat. Authorized users only.
              </p>
            </div>
            
            <div className="relative z-10 mt-12 space-y-4">
               <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-green-400 bg-black/20 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                 <div className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                 Official Reporting System
               </div>
            </div>
          </div>
          
          <div className="md:w-7/12 p-12 bg-white flex flex-col">
            {!pendingRole ? (
              <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Access Control</h2>
                  <p className="text-slate-600 text-sm mt-2 font-semibold">Select your designation to log in.</p>
                </div>
                
                <div className="space-y-6">
                  <button 
                    onClick={() => setPendingRole('ZI')}
                    className="w-full group text-left p-8 rounded-3xl border-2 border-slate-50 hover:border-green-600 hover:bg-green-50 transition-all flex items-center gap-8 shadow-sm"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 group-hover:bg-green-600 group-hover:text-white flex items-center justify-center transition-all group-hover:scale-110 shadow-inner">
                      <FileTextIcon />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">Zonal Inspector (ZI)</h3>
                      <p className="text-sm text-slate-600 font-semibold">Master dashboard for entire Daura Zone.</p>
                    </div>
                  </button>

                  <div className="space-y-4 pt-6">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] px-2">Local Government Inspectors (LGI)</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {DAURA_ZONE_LGAS.map(lga => (
                        <button 
                          key={lga}
                          onClick={() => {
                            setPendingRole('LGI');
                            setPendingLga(lga);
                          }}
                          className="text-center p-4 rounded-2xl border border-slate-200 hover:border-green-600 hover:text-green-700 text-slate-950 text-xs font-black transition-all bg-slate-100 hover:bg-green-50 hover:scale-[1.03] active:scale-95 shadow-sm"
                        >
                          {lga}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center animate-in slide-in-from-right-8 duration-500">
                <button 
                  onClick={() => {
                    setPendingRole(null);
                    setPendingLga(null);
                    setPinInput('');
                    setLoginError(false);
                  }}
                  className="mb-10 text-[10px] font-black text-slate-500 hover:text-green-600 transition-colors uppercase tracking-widest flex items-center gap-2 group"
                >
                  <span className="group-hover:-translate-x-1 transition-transform">←</span> Return to role selection
                </button>

                <div className="max-w-sm mx-auto w-full text-center space-y-8">
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Verify PIN</h2>
                    <p className="text-slate-600 text-sm mt-3 font-semibold">Terminal for <span className="text-green-700 font-black">{pendingRole === 'ZI' ? 'Zonal Secretariat' : pendingLga}</span></p>
                  </div>

                  <form onSubmit={handleLogin} className="space-y-6">
                    <div className="relative">
                      <input 
                        autoFocus
                        type="password"
                        inputMode="numeric"
                        maxLength={4}
                        value={pinInput}
                        onChange={(e) => {
                          setPinInput(e.target.value);
                          setLoginError(false);
                        }}
                        placeholder="••••"
                        className={`w-full text-center text-5xl tracking-[0.5em] font-black border-2 rounded-3xl p-8 focus:outline-none transition-all ${
                          loginError 
                            ? 'border-red-500 bg-red-50 text-red-600 animate-shake' 
                            : 'border-slate-200 focus:border-green-600 focus:bg-white bg-slate-50 text-slate-900'
                        }`}
                      />
                      {loginError && (
                        <p className="absolute -bottom-8 left-0 right-0 text-red-600 text-[10px] font-black uppercase tracking-widest">Unauthorized Entry Attempt</p>
                      )}
                    </div>
                    
                    <button 
                      type="submit" 
                      disabled={pinInput.length < 4}
                      className="w-full bg-slate-900 text-white rounded-3xl py-6 font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl disabled:opacity-20 active:scale-95"
                    >
                      Authenticate Session
                    </button>
                  </form>

                  <div className="pt-8">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest leading-relaxed">
                      LGA Default PINs: 1111, 2222, 3333... in order.<br/>
                      ZI Default PIN: 0000.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
          }
          .animate-shake { animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className={`text-white shadow-xl sticky top-0 z-50 border-b ${userRole === 'ZI' ? 'bg-indigo-950 border-indigo-900' : 'bg-green-900 border-green-800'}`}>
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-white p-1.5 rounded-full shadow-inner">
              <img src="https://api.dicebear.com/7.x/initials/svg?seed=NYSC&backgroundColor=006400" alt="NYSC Logo" className="w-10 h-10 rounded-full" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
                {userRole === 'ZI' ? 'Zonal HQ Portal' : `${lgaContext} Secure Zone`}
              </h1>
              <p className="text-[10px] opacity-80 font-black uppercase tracking-widest">
                Official Weekly Compliance Reporting System
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/20 flex items-center gap-3 backdrop-blur-sm relative z-[60]">
              <div className="text-right">
                <p className="text-[9px] font-black uppercase opacity-60 leading-none mb-1 text-white">Session Active</p>
                <p className="text-sm font-black leading-none text-white">{userRole === 'ZI' ? 'Zonal Inspector' : lgaContext}</p>
              </div>
              <button 
                onClick={handleLogout} 
                className="ml-2 p-3 bg-red-600/90 text-white hover:bg-red-700 rounded-2xl transition-all group flex items-center gap-2 border border-red-500 shadow-lg active:scale-95" 
                title="Sign Out"
              >
                <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">Sign Out</span>
                <LogOutIcon />
              </button>
            </div>
          </div>
        </div>
      </header>

      {userRole === 'ZI' && (
        <nav className="bg-white border-b border-slate-200 shadow-sm overflow-x-auto whitespace-nowrap px-4 py-2 sticky top-[76px] z-40">
          <div className="max-w-7xl mx-auto flex items-center gap-2">
            <button
              onClick={() => {
                setZiViewLga('OVERVIEW');
                setActiveCategory(ReportCategory.ABSCONDED);
              }}
              className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${
                ziViewLga === 'OVERVIEW' 
                  ? 'bg-indigo-100 text-indigo-900 ring-2 ring-indigo-200 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              📊 Zonal Overview
            </button>
            <div className="h-6 w-px bg-slate-200 mx-2" />
            {DAURA_ZONE_LGAS.map(lga => (
              <button
                key={lga}
                onClick={() => setZiViewLga(lga)}
                className={`px-5 py-2.5 rounded-xl text-sm font-black transition-all ${
                  ziViewLga === lga 
                    ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-200' 
                    : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                }`}
              >
                {lga}
              </button>
            ))}
          </div>
        </nav>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-2 space-y-1 overflow-hidden">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-5 py-4">Navigation</h2>
            
            {userRole === 'LGI' && (
              <button
                onClick={() => setActiveCategory('LGA_OVERVIEW')}
                className={`w-full text-left px-5 py-4 rounded-2xl transition-all flex items-center gap-3 font-black group ${
                  activeCategory === 'LGA_OVERVIEW' 
                    ? 'bg-green-700 text-white shadow-lg shadow-green-100' 
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${activeCategory === 'LGA_OVERVIEW' ? 'bg-white' : 'bg-green-600'}`} />
                <span>Command Center</span>
              </button>
            )}

            <div className="h-px bg-slate-100 my-2 mx-5" />
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-5 py-2">Categories</h2>

            {Object.values(ReportCategory).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-5 py-3.5 rounded-2xl transition-all flex items-center justify-between group ${
                  activeCategory === cat 
                    ? userRole === 'ZI' ? 'bg-indigo-50 text-indigo-900 font-black' : 'bg-green-50 text-green-900 font-black' 
                    : 'text-slate-700 hover:bg-slate-50 font-bold'
                }`}
              >
                <span className="truncate text-sm">{cat}</span>
                <span className={`text-[10px] px-3 py-1.5 rounded-lg font-black min-w-[34px] text-center ${
                  activeCategory === cat ? 'bg-white shadow-sm' : 'bg-slate-100 text-slate-600'
                }`}>
                  {entries.filter(e => 
                    (userRole === 'LGI' ? e.lga === lgaContext : (ziViewLga === 'OVERVIEW' || e.lga === ziViewLga)) && 
                    e.category === cat
                  ).length}
                </span>
              </button>
            ))}
          </div>

          <div className={`p-8 rounded-[2rem] shadow-2xl space-y-5 border relative overflow-hidden text-white ${userRole === 'ZI' ? 'bg-indigo-900 border-indigo-700' : 'bg-green-800 border-green-700'}`}>
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <FileTextIcon />
              </div>
              <h3 className="text-xl font-black uppercase tracking-tight">{userRole === 'ZI' ? 'ZI Admin Hub' : `${lgaContext} Admin`}</h3>
              <p className="text-sm opacity-90 leading-relaxed font-bold">
                {userRole === 'ZI' ? 'Overseeing weekly compliance for Daura Zone.' : `Reporting for ${lgaContext} LGA. Keep all entries current.`}
              </p>
              
              <div className="space-y-3 pt-4">
                {userRole === 'ZI' && (
                  <button 
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary || entries.length === 0}
                    className="flex items-center justify-center gap-3 w-full bg-white text-indigo-950 hover:bg-indigo-50 py-4 rounded-2xl text-sm font-black transition-all shadow-xl disabled:opacity-50 active:scale-95"
                  >
                    <FileTextIcon /> {isGeneratingSummary ? 'Processing...' : 'Generate Official Report'}
                  </button>
                )}
                <button 
                  onClick={handleDownloadCSV}
                  className={`flex items-center justify-center gap-2 w-full py-4 rounded-2xl text-sm font-black transition-all active:scale-95 border-2 ${userRole === 'ZI' ? 'bg-indigo-800 text-indigo-100 border-indigo-600 hover:bg-indigo-700' : 'bg-green-700 text-green-100 border-green-500 hover:bg-green-600'}`}
                >
                  <DownloadIcon /> Export CSV
                </button>
              </div>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-6">
          {userRole === 'ZI' && ziViewLga === 'OVERVIEW' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
                  <p className="text-[11px] font-black text-red-700 uppercase tracking-widest">Absconded</p>
                  <p className="text-4xl font-black text-slate-900 mt-2">
                    {entries.filter(e => e.category === ReportCategory.ABSCONDED).length}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
                  <p className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Medical</p>
                  <p className="text-4xl font-black text-slate-900 mt-2">
                    {entries.filter(e => e.category === ReportCategory.SICK).length}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
                  <p className="text-[11px] font-black text-amber-700 uppercase tracking-widest">Incidents</p>
                  <p className="text-4xl font-black text-slate-900 mt-2">
                    {entries.filter(e => e.category === ReportCategory.MISSING || e.category === ReportCategory.KIDNAPPED).length}
                  </p>
                </div>
                <div className="bg-white p-6 rounded-[1.5rem] border-2 border-slate-100 shadow-sm">
                  <p className="text-[11px] font-black text-indigo-700 uppercase tracking-widest">Deceased</p>
                  <p className="text-4xl font-black text-slate-900 mt-2">
                    {entries.filter(e => e.category === ReportCategory.DECEASED).length}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] shadow-xl border-2 border-slate-100 overflow-hidden">
                <div className="bg-indigo-950 px-10 py-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Zone Status Tracker</h2>
                    <p className="text-sm text-indigo-300 font-bold">Compliance overview for all 9 LGAs.</p>
                  </div>
                  <div className="flex items-center bg-indigo-900 px-5 py-3 rounded-2xl border border-indigo-700">
                    <span className="text-[11px] font-black text-indigo-100 uppercase tracking-widest">
                      LGAs Active: {new Set(entries.map(e => e.lga)).size} / 9
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-100">
                        <th className="px-10 py-5 text-[11px] font-black text-slate-600 uppercase tracking-wider">Secretariat Name</th>
                        <th className="px-4 py-5 text-[11px] font-black text-red-700 uppercase tracking-wider text-center">Abs.</th>
                        <th className="px-4 py-5 text-[11px] font-black text-blue-700 uppercase tracking-wider text-center">Med.</th>
                        <th className="px-4 py-5 text-[11px] font-black text-orange-700 uppercase tracking-wider text-center">Inc.</th>
                        <th className="px-4 py-5 text-[11px] font-black text-indigo-700 uppercase tracking-wider text-center">Dec.</th>
                        <th className="px-10 py-5 text-[11px] font-black text-slate-600 uppercase tracking-wider text-right">Progress</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {DAURA_ZONE_LGAS.map(lga => {
                        const lgaEntries = entries.filter(e => e.lga === lga);
                        const hasData = lgaEntries.length > 0;
                        const stats = {
                          abs: lgaEntries.filter(e => e.category === ReportCategory.ABSCONDED).length,
                          sick: lgaEntries.filter(e => e.category === ReportCategory.SICK).length,
                          inc: lgaEntries.filter(e => e.category === ReportCategory.MISSING || e.category === ReportCategory.KIDNAPPED).length,
                          dec: lgaEntries.filter(e => e.category === ReportCategory.DECEASED).length,
                        };

                        return (
                          <tr key={lga} onClick={() => setZiViewLga(lga)} className="hover:bg-indigo-50 transition-all cursor-pointer group">
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-4">
                                <div className={`w-3.5 h-3.5 rounded-full ring-4 ${hasData ? 'bg-green-600 ring-green-100' : 'bg-slate-300 ring-slate-100'}`} />
                                <span className="font-black text-slate-900 text-base uppercase group-hover:text-indigo-800 transition-colors">{lga}</span>
                              </div>
                            </td>
                            <td className="px-4 py-6 text-center text-base font-black text-slate-800">{stats.abs || '-'}</td>
                            <td className="px-4 py-6 text-center text-base font-black text-slate-800">{stats.sick || '-'}</td>
                            <td className="px-4 py-6 text-center text-base font-black text-slate-800">{stats.inc || '-'}</td>
                            <td className="px-4 py-6 text-center text-base font-black text-slate-800">{stats.dec || '-'}</td>
                            <td className="px-10 py-6 text-right">
                              <span className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 ${hasData ? 'bg-green-50 text-green-800 border-green-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                {hasData ? 'SUBMITTED' : 'NOT STARTED'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {userRole === 'LGI' && activeCategory === 'LGA_OVERVIEW' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
               <div className="bg-green-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl border border-green-800">
                <div className="relative z-10">
                  <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">Command Center</h2>
                  <p className="text-green-200 mt-2 font-black opacity-90 uppercase tracking-[0.2em] text-sm">{lgaContext} LGA SECRETARIAT</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-10">
                    {Object.values(ReportCategory).map(cat => {
                      const count = entries.filter(e => e.lga === lgaContext && e.category === cat).length;
                      return (
                        <button 
                          key={cat}
                          onClick={() => setActiveCategory(cat)}
                          className="bg-green-800/80 hover:bg-green-700 border-2 border-green-700/50 p-6 rounded-3xl transition-all text-left flex flex-col justify-between h-36 group shadow-lg"
                        >
                          <span className="text-[10px] font-black uppercase opacity-70 group-hover:opacity-100 leading-tight">{cat}</span>
                          <span className="text-4xl font-black">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm overflow-hidden">
                   <div className="px-8 py-6 border-b-2 border-slate-50 bg-slate-50 flex items-center justify-between">
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Entry Checklist</h3>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse shadow-sm" />
                  </div>
                  <div className="p-8 space-y-4">
                    {Object.values(ReportCategory).map(cat => {
                      const hasRecords = entries.some(e => e.lga === lgaContext && e.category === cat);
                      return (
                        <div key={cat} className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 border-2 border-slate-100">
                          <div className="flex items-center gap-5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-md ${hasRecords ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-500'}`}>
                              {hasRecords ? '✓' : '!'}
                            </div>
                            <span className={`text-base font-black ${hasRecords ? 'text-slate-900' : 'text-slate-400 italic'}`}>{cat}</span>
                          </div>
                          <button 
                            onClick={() => setActiveCategory(cat)}
                            className="text-[11px] font-black uppercase tracking-widest text-green-800 hover:text-green-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100"
                          >
                            {hasRecords ? 'View All' : 'Add New'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white rounded-[2rem] border-2 border-slate-100 shadow-sm overflow-hidden flex flex-col">
                  <div className="px-8 py-6 border-b-2 border-slate-50 bg-slate-50 flex items-center justify-between">
                    <h3 className="font-black text-slate-900 uppercase text-xs tracking-widest">Recent Activity</h3>
                  </div>
                  <div className="p-6 flex-1">
                    {lgaRecentEntries.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                        <p className="text-base font-black italic text-slate-500">Awaiting weekly input...</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {lgaRecentEntries.map(entry => (
                          <div key={entry.id} className="p-5 rounded-2xl hover:bg-slate-50 transition-colors flex items-center justify-between border-2 border-transparent hover:border-slate-100 bg-slate-50/30 shadow-sm">
                            <div>
                              <p className="font-black text-slate-900 uppercase text-sm tracking-tight">{entry.name}</p>
                              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">{entry.category} • {entry.stateCode}</p>
                            </div>
                            <button onClick={() => removeEntry(entry.id)} className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                              <TrashIcon />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeCategory !== 'LGA_OVERVIEW' && (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
               <div className="bg-white rounded-[2rem] shadow-xl border-2 border-slate-100 overflow-hidden">
                <div className={`px-10 py-8 border-b-2 flex items-center justify-between ${userRole === 'ZI' ? 'bg-indigo-50 border-indigo-100' : 'bg-green-50 border-green-100'}`}>
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-4">
                      <PlusIcon /> Submit Weekly Record
                    </h2>
                    <p className="text-sm font-black text-slate-600 mt-1 uppercase tracking-widest">{activeCategory} • {userRole === 'LGI' ? lgaContext : ziViewLga} LGA</p>
                  </div>
                  <button 
                    onClick={() => userRole === 'LGI' ? setActiveCategory('LGA_OVERVIEW') : setZiViewLga('OVERVIEW')}
                    className="text-xs font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest underline underline-offset-4 decoration-2"
                  >
                    Back to Dashboard
                  </button>
                </div>
                <form onSubmit={handleAddEntry} className="p-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Category Dropdown */}
                    <div className="space-y-4 md:col-span-2">
                      <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest ml-1 block">Report Category (Select Type)</label>
                      <select 
                        value={activeCategory}
                        onChange={(e) => setActiveCategory(e.target.value as ReportCategory)}
                        className="w-full border-2 border-slate-200 bg-white rounded-2xl px-6 py-5 text-lg font-black text-slate-900 focus:ring-4 focus:ring-green-500/20 focus:border-green-600 focus:outline-none transition-all cursor-pointer appearance-none shadow-sm"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23334155'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.5rem center', backgroundSize: '1.5rem' }}
                      >
                        {Object.values(ReportCategory).map(cat => (
                          <option key={cat} value={cat} className="font-bold py-2">{cat.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest ml-1 block">Full Name of Corps Member</label>
                      <input 
                        required 
                        type="text" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="ENTER NAME"
                        className="w-full border-2 border-slate-200 bg-white rounded-2xl px-6 py-5 text-lg font-black text-slate-900 focus:ring-4 focus:ring-green-500/20 focus:border-green-600 focus:outline-none transition-all placeholder:text-slate-300 placeholder:font-normal uppercase"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest ml-1 block">State Code</label>
                      <input 
                        required 
                        type="text" 
                        value={stateCode}
                        onChange={(e) => setStateCode(e.target.value)}
                        placeholder="KT/24B/0000"
                        className="w-full border-2 border-slate-200 bg-white rounded-2xl px-6 py-5 text-lg font-black text-slate-900 focus:ring-4 focus:ring-green-500/20 focus:border-green-600 focus:outline-none transition-all placeholder:text-slate-300 placeholder:font-normal uppercase"
                      />
                    </div>

                    {activeCategory === ReportCategory.ABSCONDED && (
                      <div className="space-y-4 md:col-span-2">
                        <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest ml-1 block">Period of Abscondment</label>
                        <input required type="text" value={extraField1} onChange={(e) => setExtraField1(e.target.value)} placeholder="e.g. 3 weeks, Dates, or Reasons" className="w-full border-2 border-slate-200 bg-white rounded-2xl px-6 py-5 text-lg font-black text-slate-900 focus:ring-4 focus:ring-green-500/20 focus:border-green-600 focus:outline-none transition-all placeholder:text-slate-300 placeholder:font-normal" />
                      </div>
                    )}

                    {activeCategory === ReportCategory.SICK && (
                      <>
                        <div className="space-y-4">
                          <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest ml-1 block">Type of Illness / Diagnosis</label>
                          <input required type="text" value={extraField1} onChange={(e) => setExtraField1(e.target.value)} placeholder="Diagnosis" className="w-full border-2 border-slate-200 bg-white rounded-2xl px-6 py-5 text-lg font-black text-slate-900 focus:ring-4 focus:ring-green-500/20 focus:border-green-600 focus:outline-none transition-all placeholder:text-slate-300 placeholder:font-normal" />
                        </div>
                        <div className="flex items-center mt-12 bg-slate-100 px-8 py-5 rounded-2xl border-2 border-slate-200 shadow-inner">
                          <label className="inline-flex items-center cursor-pointer group w-full">
                            <input type="checkbox" checked={isHospitalized} onChange={(e) => setIsHospitalized(e.target.checked)} className="w-8 h-8 text-green-700 rounded-xl border-2 border-slate-300 focus:ring-green-500 shadow-sm" />
                            <span className="ml-6 text-base font-black text-slate-900 uppercase tracking-widest group-hover:text-green-800 transition-colors">Hospitalized? (Yes/No)</span>
                          </label>
                        </div>
                      </>
                    )}

                    {(activeCategory === ReportCategory.KIDNAPPED || activeCategory === ReportCategory.MISSING) && (
                      <div className="space-y-4 md:col-span-2">
                        <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest ml-1 block">Date of Incident</label>
                        <input required type="date" value={extraField1} onChange={(e) => setExtraField1(e.target.value)} className="w-full border-2 border-slate-200 bg-white rounded-2xl px-6 py-5 text-xl font-black text-slate-900 focus:ring-4 focus:ring-green-500/20 focus:border-green-600 focus:outline-none transition-all" />
                      </div>
                    )}

                    {activeCategory === ReportCategory.DECEASED && (
                      <>
                        <div className="space-y-4">
                          <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest ml-1 block">Date of Passing</label>
                          <input required type="date" value={extraField1} onChange={(e) => setExtraField1(e.target.value)} className="w-full border-2 border-slate-200 bg-white rounded-2xl px-6 py-5 text-xl font-black text-slate-900 focus:ring-4 focus:ring-green-500/20 focus:border-green-600 focus:outline-none transition-all" />
                        </div>
                        <div className="space-y-4">
                          <label className="text-[12px] font-black text-slate-700 uppercase tracking-widest ml-1 block">Reason for Death</label>
                          <input required type="text" value={extraField2} onChange={(e) => setExtraField2(e.target.value)} placeholder="Reason" className="w-full border-2 border-slate-200 bg-white rounded-2xl px-6 py-5 text-lg font-black text-slate-900 focus:ring-4 focus:ring-green-500/20 focus:border-green-600 focus:outline-none transition-all placeholder:text-slate-300 placeholder:font-normal" />
                        </div>
                      </>
                    )}
                  </div>
                  <div className="mt-14 flex justify-end">
                    <button type="submit" className={`font-black py-6 px-20 rounded-[1.8rem] shadow-2xl transition-all flex items-center gap-5 active:scale-95 text-lg uppercase tracking-widest ${userRole === 'ZI' ? 'bg-indigo-700 hover:bg-indigo-800 text-white shadow-indigo-200' : 'bg-green-800 hover:bg-green-900 text-white shadow-green-200'}`}>
                      <PlusIcon /> Commit To Weekly Ledger
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-white rounded-[2rem] shadow-lg border-2 border-slate-100 overflow-hidden">
                <div className="px-10 py-6 border-b-2 border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <h2 className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Entry History For {activeCategory}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/50 border-b-2 border-slate-50">
                        <th className="px-10 py-5 text-[11px] font-black text-slate-600 uppercase tracking-widest">Corps Member</th>
                        <th className="px-10 py-5 text-[11px] font-black text-slate-600 uppercase tracking-widest">State Code</th>
                        <th className="px-10 py-5 text-[11px] font-black text-slate-600 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredEntries.length === 0 ? (
                        <tr><td colSpan={3} className="px-10 py-28 text-center text-slate-400 font-black italic text-lg">No records found for {activeCategory} this week.</td></tr>
                      ) : (
                        filteredEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-10 py-7 font-black text-slate-900 uppercase tracking-tight text-base">{entry.name}</td>
                            <td className="px-10 py-7 text-slate-600 font-mono text-sm font-bold">{entry.stateCode}</td>
                            <td className="px-10 py-7 text-right">
                              <button onClick={() => removeEntry(entry.id)} className="p-4 text-slate-300 hover:text-red-700 rounded-2xl hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm border border-transparent hover:border-red-100"><TrashIcon /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {summary && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-400 relative border-4 border-indigo-900/10">
            <div className="p-10 border-b-2 border-slate-100 flex justify-between items-center bg-indigo-50/50">
              <div className="flex items-center gap-8">
                <div className="p-6 bg-indigo-950 rounded-[1.8rem] text-white shadow-2xl shadow-indigo-200">
                  <FileTextIcon />
                </div>
                <div>
                  <h3 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">Official Zonal Summary</h3>
                  <p className="text-sm text-indigo-800 font-black mt-3 uppercase tracking-[0.4em]">Week Ending {new Date().toLocaleDateString('en-GB')}</p>
                </div>
              </div>
              <button onClick={() => setSummary(null)} className="p-6 hover:bg-slate-200 rounded-3xl text-slate-500 transition-all font-black text-3xl active:scale-90 shadow-sm">✕</button>
            </div>
            <div className="p-10 overflow-y-auto bg-white scrollbar-hide">
              <div className="p-12 border-4 border-double border-slate-100 rounded-[2.5rem] bg-slate-50/50 font-serif text-slate-950 leading-[2] shadow-inner whitespace-pre-wrap text-2xl selection:bg-indigo-200 tracking-tight">
                {summary}
              </div>
            </div>
            <div className="p-10 border-t-2 border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-end gap-6">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(summary);
                  alert("Zonal memorandum successfully copied to clipboard!");
                }}
                className="flex items-center justify-center gap-5 px-14 py-7 bg-slate-950 text-white rounded-[2rem] font-black hover:bg-black transition-all shadow-2xl active:scale-95 group"
              >
                <ShareIcon /> <span className="uppercase tracking-widest text-sm">Copy Memo To Clipboard</span>
              </button>
              <button 
                onClick={() => setSummary(null)}
                className="px-20 py-7 bg-indigo-800 text-white rounded-[2rem] font-black hover:bg-indigo-950 transition-all shadow-2xl active:scale-95 uppercase tracking-widest text-sm border-2 border-indigo-600"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bg-white border-t-2 border-slate-100 py-20 mt-10">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[12px] font-black text-slate-500 uppercase tracking-[0.4em] leading-relaxed max-w-2xl mx-auto italic">
            Official NYSC Zonal Administration Portal • Daura Zone Command<br/>
            Katsina State Secretariat • Weekly Compliance System<br/>
            © {new Date().getFullYear()} Federal Republic of Nigeria
          </p>
          <div className="mt-8 opacity-20 flex justify-center gap-8 grayscale">
            <img src="https://api.dicebear.com/7.x/initials/svg?seed=NYSC&backgroundColor=006400" className="h-10 w-10 rounded-full" />
            <img src="https://api.dicebear.com/7.x/initials/svg?seed=NGA&backgroundColor=006400" className="h-10 w-10 rounded-full" />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

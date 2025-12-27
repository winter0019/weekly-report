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
  DownloadIcon, 
  WhatsAppIcon, 
  LogOutIcon, 
  TrashIcon, 
  FileTextIcon, 
  SearchIcon,
  AbscondedIcon,
  DashboardIcon,
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
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const [activeQuery, setActiveQuery] = useState<{ content: string, cm: any, lga: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<any>(null);

  const dbRef = useRef<any>(null);

  useEffect(() => {
    if (isAuthenticated) {
      try {
        dbRef.current = initFirebase(firebaseConfig);
        
        // Wrap subscription to detect permission errors
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

  const currentFilteredData = useMemo(() => {
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

  if (activeQuery) {
    return (
      <div className="min-h-screen bg-slate-200 p-4 md:p-12 flex flex-col items-center overflow-auto">
        <div className="max-w-4xl w-full bg-white border border-slate-400 shadow-2xl p-16 relative overflow-hidden font-official-document text-slate-900 print-shadow-none document-page animate-official">
          <div className="text-center mb-12 border-b-4 border-double border-slate-900 pb-8">
            <h1 className="text-3xl font-bold uppercase tracking-widest mb-2 font-serif-heading">National Youth Service Corps</h1>
            <h2 className="text-xl font-bold uppercase tracking-wider mb-2">Katsina State Secretariat</h2>
            <p className="text-lg font-bold uppercase">{activeQuery.lga} Zonal/Local Office</p>
          </div>
          
          <div className="whitespace-pre-wrap leading-relaxed text-base mb-20">
            {activeQuery.content}
          </div>

          <div className="flex flex-col items-end space-y-2 font-bold mb-20">
            <div className="w-48 border-b-2 border-slate-900"></div>
            <p className="uppercase text-sm">Local Government Inspector</p>
            <p className="uppercase text-xs text-slate-500">NYSC {activeQuery.lga} Command</p>
          </div>

          <div className="mt-20 flex justify-between no-print pt-10 border-t border-slate-200">
            <button onClick={() => setActiveQuery(null)} className="px-8 py-4 bg-slate-100 text-slate-900 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all border border-slate-300">Exit Document View</button>
            <div className="flex gap-4">
               <button onClick={() => window.print()} className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-black transition-all shadow-xl flex items-center gap-3">
                <FileTextIcon /> Print Official Query
              </button>
              <button 
                onClick={() => {
                  const url = `https://wa.me/?text=${encodeURIComponent(`Formal Disciplinary Query - ${activeQuery.cm.name} (${activeQuery.cm.code})\n\n${activeQuery.content}`)}`;
                  window.open(url, '_blank');
                }}
                className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-emerald-700 transition-all shadow-xl flex items-center gap-3"
              >
                <WhatsAppIcon /> Share via WhatsApp
              </button>
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs text-slate-500 font-bold uppercase tracking-widest no-print italic">NYSC LEGAL & DISCIPLINARY AUTOMATED SYSTEM</p>
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
            <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.3em]">Administrative Information System</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-600 ml-2">Assigned Command</label>
              <select required className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-700 outline-none transition-all appearance-none text-lg" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Station...</option>
                <option value="ZI">Zonal Inspector (ZI) - Daura Command</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Station (LGI Secretariat)</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-600 ml-2">Security Key</label>
              <input type="password" required placeholder="PIN Code" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[1.5rem] text-center text-4xl font-black tracking-[0.5em] focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-700 outline-none transition-all shadow-inner" value={pin} onChange={e => setPin(e.target.value)} />
            </div>
          </div>
          {loginError && <p className="text-red-700 text-xs font-black text-center uppercase tracking-widest bg-red-50 p-4 rounded-2xl border border-red-100">Access Restricted: Invalid PIN</p>}
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
            <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 font-serif-heading">{userRole === 'ZI' ? 'DAURA ZONAL HQ' : `${lgaContext?.toUpperCase()} STATION OFFICE`}</h1>
            <p className="text-xs font-bold text-emerald-400/80 tracking-widest uppercase italic">Secretariat Management Information System</p>
          </div>
        </div>
        <div className="flex items-center gap-4 w-full md:w-auto">
          {userRole === 'ZI' && (
            <div className="flex-1 md:flex-none">
               <select 
                className="w-full md:w-auto bg-emerald-900 border-emerald-700 border-2 rounded-2xl px-6 py-4 text-xs font-black uppercase text-emerald-300 outline-none hover:border-emerald-400 transition-all cursor-pointer shadow-lg"
                value={ziStationFilter}
                onChange={(e) => setZiStationFilter(e.target.value)}
              >
                <option value="all">Zonal Command (Global)</option>
                {LGAS.map(l => <option key={l} value={l}>{l.toUpperCase()} STATION COMMAND</option>)}
              </select>
            </div>
          )}
          <button onClick={handleLogout} className="p-5 bg-white/10 rounded-2xl hover:bg-red-600/40 transition-all border border-white/5 shadow-inner"><LogOutIcon /></button>
        </div>
      </header>

      <nav className="bg-white border-b-8 border-slate-200 p-4 md:p-8 flex justify-center gap-6 no-print overflow-x-auto shadow-sm">
        {[
          { id: 'CWHS', label: 'Welfare Registry', sub: 'Personnel Status' },
          { id: 'CIM', label: 'Biometric Audit', sub: 'Clearance & Discipline' },
          { id: 'SAED', label: 'Skill Centers', sub: 'SAED Enrollment Hub' }
        ].map(d => (
          <button 
            key={d.id}
            onClick={() => setDivision(d.id as Division)}
            className={`division-folder px-12 py-6 rounded-[2rem] text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap group relative overflow-hidden ${division === d.id ? `bg-emerald-900 text-white active border-b-8 border-emerald-950` : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
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
            entries={currentFilteredData.cwhs} 
            userRole={userRole!} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')} 
          />
        )}
        {division === 'CIM' && (
          <CIMModule 
            entries={currentFilteredData.cim} 
            userRole={userRole!} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')}
            onGenerateQuery={async (cm: any, lga: string) => {
              setIsGenerating(true);
              try {
                const content = await generateDisciplinaryQuery(cm.name, cm.code, cm.reason);
                setActiveQuery({ content, cm, lga });
              } finally {
                setIsGenerating(false);
              }
            }}
            loading={isGenerating}
          />
        )}
        {division === 'SAED' && (
          <SAEDModule 
            entries={currentFilteredData.saed} 
            userRole={userRole!} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')} 
          />
        )}
      </main>

      <footer className="p-16 text-center text-slate-400 no-print bg-slate-100 border-t-2 border-slate-200">
        <p className="text-sm font-black uppercase tracking-[0.5em]">Secretariat Information Control • NYSC Katsina State Command</p>
      </footer>
    </div>
  );
};

// --- Sub-Modules ---

const OfficialHeading = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div className="mb-12 border-l-[12px] border-emerald-900 pl-8 py-4 bg-white rounded-r-3xl shadow-xl border-t border-r border-b border-slate-200">
    <h2 className="text-4xl font-black uppercase tracking-tight text-slate-900 leading-none mb-3 font-serif-heading">{title}</h2>
    <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">{subtitle}</p>
  </div>
);

const CWHSModule = ({ entries, userRole, lga, db, onShare }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "nysc_reports", { ...formData, lga: lga || 'Daura' });
    setFormData({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });
  };

  return (
    <div className="animate-official space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-end no-print gap-6">
        <OfficialHeading title="Welfare & Incident Records" subtitle="Tracking personnel health and mortality changes" />
        <button onClick={() => window.print()} className="mb-12 bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl flex items-center gap-3 hover:bg-black transition-all border-b-8 border-black">
          <FileTextIcon /> Generate Formal Gazette
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl sticky top-32">
            <h3 className="font-black uppercase text-xs text-slate-900 mb-10 pb-4 border-b-4 border-emerald-900/10 tracking-widest">Incident Registry Form</h3>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-700 ml-1">Corps Member Name</label>
                <input required placeholder="SURNAME, FIRSTNAME" className="w-full p-5 bg-slate-50 rounded-2xl font-bold uppercase border-2 border-slate-200 focus:border-emerald-700 outline-none transition-all shadow-inner" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-700 ml-1">State Code</label>
                <input required placeholder="E.G. KT/24A/0001" className="w-full p-5 bg-slate-50 rounded-2xl font-bold uppercase border-2 border-slate-200 focus:border-emerald-700 outline-none transition-all shadow-inner" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-700 ml-1">Classification</label>
                <select className="w-full p-5 bg-slate-50 rounded-2xl font-black border-2 border-slate-200 focus:border-emerald-700 outline-none appearance-none cursor-pointer shadow-inner" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                  {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-700 ml-1">Narrative</label>
                <textarea placeholder="PROVIDE VERIFIED DETAILS..." className="w-full p-5 bg-slate-50 rounded-2xl h-40 font-bold border-2 border-slate-200 focus:border-emerald-700 outline-none shadow-inner" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
              </div>
              <button className="w-full bg-emerald-900 text-white p-6 rounded-2xl font-black uppercase shadow-2xl hover:bg-black transition-all flex items-center justify-center gap-4 text-lg border-b-8 border-emerald-950">
                <PlusIcon /> Commit to Official Archive
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
          {entries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-1">
              {entries.map((e: any) => (
                <div key={e.id} className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-200 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden flex flex-col justify-between group print:shadow-none print:border-slate-800">
                  <div className={`absolute top-0 right-0 w-3 h-full ${e.category === ReportCategory.DECEASED ? 'bg-slate-900' : 'bg-emerald-700'}`}></div>
                  <div>
                    <div className="flex justify-between items-start mb-8">
                      <span className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest border-2 shadow-sm ${e.category === ReportCategory.SICK ? 'bg-blue-100 text-blue-900 border-blue-300' : e.category === ReportCategory.DECEASED ? 'bg-slate-950 text-white border-slate-800' : 'bg-red-100 text-red-900 border-red-300'}`}>{e.category}</span>
                      <span className="text-[11px] font-black text-slate-900 bg-slate-200 px-4 py-1.5 rounded-full uppercase tracking-widest border border-slate-300">{e.lga}</span>
                    </div>
                    <h4 className="text-3xl font-black uppercase text-slate-900 leading-none mb-3 font-serif-heading">{e.name}</h4>
                    <p className="text-sm font-black text-emerald-900 tracking-[0.3em] mb-6 flex items-center gap-2">
                      <FileTextIcon /> {e.stateCode}
                    </p>
                    <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 shadow-inner">
                      <p className="text-base text-slate-900 font-medium italic leading-relaxed text-visible-high">"{e.details}"</p>
                    </div>
                  </div>
                  <div className="mt-10 pt-8 border-t border-slate-200 flex justify-between items-center no-print">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Registry ID: {e.id.slice(0, 8)}</span>
                    <div className="flex gap-3">
                      <button onClick={() => onShare(`*NYSC OFFICIAL RECORD*\n\nCORPS MEMBER: ${e.name}\nCODE: ${e.stateCode}\nSTATUS: ${e.category}\n\nDETAILS: ${e.details}`)} className="p-4 bg-emerald-100 text-emerald-900 rounded-2xl hover:bg-emerald-200 transition-all border-2 border-emerald-300 shadow-lg"><WhatsAppIcon /></button>
                      <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="p-4 bg-red-50 text-red-700 rounded-2xl hover:bg-red-100 transition-all border-2 border-red-200 shadow-lg"><TrashIcon /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-40 rounded-[4rem] border-8 border-dashed border-slate-200 text-center flex flex-col items-center">
              <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-8 border-4 border-slate-100 shadow-inner"><DashboardIcon /></div>
              <h4 className="text-3xl font-black text-slate-300 uppercase tracking-[0.4em] font-serif-heading">Archives Clear</h4>
              <p className="text-slate-500 mt-4 font-bold uppercase tracking-widest">No incident records pending for this station</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CIMModule = ({ entries, userRole, lga, db, onShare, onGenerateQuery, loading }: any) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });

  const globalStats = useMemo(() => {
    return entries.reduce((acc: any, curr: any) => {
      acc.total += (curr.maleCount + curr.femaleCount);
      acc.cleared += curr.clearedCount;
      acc.uncleared += (curr.unclearedList?.length || 0);
      return acc;
    }, { total: 0, cleared: 0, uncleared: 0 });
  }, [entries]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const unclearedList = formData.uncleared.split('\n').map(line => {
      const parts = line.split(',').map(p => p.trim());
      return { name: parts[0] || '', code: parts[1] || '', reason: parts[2] || 'Biometric Absenteeism' };
    }).filter(x => x.name);
    await addData(db, "cim_clearance", { 
      month: formData.month, 
      maleCount: Number(formData.maleCount), 
      femaleCount: Number(formData.femaleCount), 
      clearedCount: Number(formData.clearedCount), 
      unclearedList, 
      lga: lga || 'Daura' 
    });
    setFormData({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
  };

  return (
    <div className="animate-official space-y-12">
      <div className="no-print">
        <OfficialHeading title="Biometric Audit Ledger" subtitle="Administrative monthly verification and disciplinary protocol" />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          <StatSummaryCard label="Total Registered Strength" value={globalStats.total} sub="Combined Zonal Count" color="text-slate-900" />
          <StatSummaryCard label="Successfully Cleared" value={globalStats.cleared} sub="Verified Biometric Records" color="text-emerald-700" bg="bg-emerald-50" />
          <StatSummaryCard label="Disciplinary Defaults" value={globalStats.uncleared} sub="Pending AI Disciplinary Queries" color="text-red-700" bg="bg-red-50" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl">
             <h3 className="font-black uppercase text-xs text-slate-900 mb-10 pb-4 border-b-4 border-amber-500/10 tracking-widest font-serif-heading">Submit Monthly Audit</h3>
             <form onSubmit={handleSubmit} className="space-y-6">
               <div className="space-y-2">
                 <label className="text-xs font-black uppercase text-slate-700 ml-1">Period</label>
                 <input type="month" required className="w-full p-5 bg-slate-50 rounded-2xl font-black border-2 border-slate-200 outline-none text-slate-900 shadow-inner" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-xs font-black uppercase text-slate-700 ml-1">Male</label>
                   <input type="number" required className="w-full p-5 bg-slate-50 rounded-2xl font-black border-2 border-slate-200 outline-none shadow-inner" value={formData.maleCount} onChange={e => setFormData({...formData, maleCount: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-2">
                   <label className="text-xs font-black uppercase text-slate-700 ml-1">Female</label>
                   <input type="number" required className="w-full p-5 bg-slate-50 rounded-2xl font-black border-2 border-slate-200 outline-none shadow-inner" value={formData.femaleCount} onChange={e => setFormData({...formData, femaleCount: Number(e.target.value)})} />
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-black uppercase text-slate-700 ml-1">Successfully Cleared</label>
                 <input type="number" required className="w-full p-5 bg-slate-50 rounded-2xl font-black border-2 border-slate-200 outline-none shadow-inner" value={formData.clearedCount} onChange={e => setFormData({...formData, clearedCount: Number(e.target.value)})} />
               </div>
               <div className="space-y-2">
                 <label className="text-xs font-black uppercase text-slate-700 ml-1">Absentee List (Biometric Default)</label>
                 <textarea placeholder="Line format: NAME, STATE CODE, INFRACTION" className="w-full p-5 bg-slate-50 rounded-2xl h-48 text-xs font-mono border-2 border-slate-200 outline-none shadow-inner" value={formData.uncleared} onChange={e => setFormData({...formData, uncleared: e.target.value})} />
                 <p className="text-[10px] text-slate-500 font-bold uppercase p-2">* Separate members by a new line.</p>
               </div>
               <button className="w-full bg-slate-950 text-white p-6 rounded-2xl font-black uppercase shadow-2xl hover:bg-black transition-all text-lg border-b-8 border-slate-900">Finalize Monthly Audit</button>
             </form>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-10">
          {entries.map((e: any) => (
            <div key={e.id} className="bg-white rounded-[3rem] border-2 border-slate-200 shadow-2xl overflow-hidden hover:border-emerald-800 transition-all group print:border-slate-800">
              <div className="bg-slate-950 p-10 text-white flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h4 className="text-3xl font-black uppercase tracking-tighter font-serif-heading">{new Date(e.month).toLocaleString('default', { month: 'long', year: 'numeric' })} AUDIT</h4>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-[0.3em] flex items-center gap-2 mt-2">
                    <DashboardIcon /> {e.lga} STATION COMMAND
                  </p>
                </div>
                <div className="text-center md:text-right bg-white/10 px-8 py-4 rounded-[2rem] border border-white/5 backdrop-blur-sm">
                  <div className="text-[10px] font-black uppercase text-emerald-300 mb-1 tracking-widest">Station Strength</div>
                  <div className="text-4xl font-black leading-none font-serif-heading">{e.maleCount + e.femaleCount}</div>
                </div>
              </div>
              
              <div className="p-10 space-y-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <DetailBox label="MALE" value={e.maleCount} />
                  <DetailBox label="FEMALE" value={e.femaleCount} />
                  <DetailBox label="CLEARED" value={e.clearedCount} color="text-emerald-700 bg-emerald-50 border-emerald-100" />
                  <DetailBox label="UNCLEARED" value={e.unclearedList?.length || 0} color="text-red-700 bg-red-50 border-red-100" />
                </div>

                {e.unclearedList?.length > 0 && (
                  <div className="pt-10 border-t-2 border-slate-100">
                    <h5 className="text-xs font-black text-slate-900 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                      <AbscondedIcon /> PERSONNEL IN DEFAULT (Biometric Miss)
                    </h5>
                    <div className="grid grid-cols-1 gap-4">
                      {e.unclearedList.map((cm: any, idx: number) => (
                        <div key={idx} className="flex flex-col md:flex-row justify-between items-center p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-100 gap-6 hover:bg-white hover:border-amber-500 transition-all shadow-sm">
                          <div>
                            <span className="font-black text-slate-900 block uppercase text-lg font-serif-heading leading-tight mb-1">{cm.name}</span>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                              <FileTextIcon /> {cm.code} • 🚩 {cm.reason}
                            </span>
                          </div>
                          <div className="flex gap-4 w-full md:w-auto">
                            <button 
                              disabled={loading}
                              onClick={() => onGenerateQuery(cm, e.lga)} 
                              className="flex-1 md:flex-none px-8 py-4 bg-emerald-900 text-white rounded-2xl text-[11px] font-black uppercase hover:bg-black transition-all flex items-center justify-center gap-3 shadow-xl disabled:opacity-50 border-b-4 border-emerald-950"
                            >
                              {loading ? 'Processing AI...' : <><FileTextIcon /> Generate Formal Query</>}
                            </button>
                            <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="p-4 text-slate-300 hover:text-red-700 transition-all hover:bg-red-50 rounded-2xl"><TrashIcon /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const StatSummaryCard = ({ label, value, sub, color, bg = "bg-white" }: any) => (
  <div className={`${bg} p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl relative overflow-hidden flex flex-col items-center text-center`}>
    <h5 className="text-[11px] font-black uppercase text-slate-500 tracking-widest mb-4 opacity-70">{label}</h5>
    <div className={`text-6xl font-black font-serif-heading ${color}`}>{value}</div>
    <p className="text-[11px] font-bold text-slate-400 mt-4 uppercase tracking-widest">{sub}</p>
  </div>
);

const DetailBox = ({ label, value, color = "text-slate-900 bg-slate-50 border-slate-100" }: any) => (
  <div className={`p-6 rounded-3xl border-2 shadow-sm flex flex-col items-center ${color}`}>
    <span className="text-[10px] font-black uppercase tracking-widest block mb-1 opacity-70">{label}</span>
    <span className="text-3xl font-black font-serif-heading">{value}</span>
  </div>
);

const SAEDModule = ({ entries, userRole, lga, db, onShare }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "saed_centers", { ...formData, lga: lga || 'Daura' });
    setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 });
  };

  return (
    <div className="animate-official space-y-12">
      <OfficialHeading title="Entrepreneurship & Skill Hub" subtitle="Registry of specialized training centers and enrollment data" />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl sticky top-32">
             <h3 className="font-black uppercase text-xs text-slate-900 mb-10 pb-4 border-b-4 border-purple-800/10 tracking-widest font-serif-heading">Register Center</h3>
             <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-700 ml-1">Establishment Name</label>
                  <input required placeholder="E.G. DAURA TECH HUB" className="w-full p-5 bg-slate-50 rounded-2xl font-black uppercase border-2 border-slate-200 outline-none shadow-inner" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-700 ml-1">Office Address</label>
                  <input required placeholder="FULL PHYSICAL LOCATION" className="w-full p-5 bg-slate-50 rounded-2xl font-black uppercase border-2 border-slate-200 outline-none shadow-inner" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-700 ml-1">Enrollment</label>
                    <input type="number" required placeholder="0" className="w-full p-5 bg-slate-50 rounded-2xl font-black border-2 border-slate-200 outline-none shadow-inner" value={formData.cmCount} onChange={e => setFormData({...formData, cmCount: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase text-slate-700 ml-1">Fee (₦)</label>
                    <input type="number" required placeholder="0" className="w-full p-5 bg-slate-50 rounded-2xl font-black border-2 border-slate-200 outline-none shadow-inner" value={formData.fee} onChange={e => setFormData({...formData, fee: Number(e.target.value)})} />
                  </div>
                </div>
                <button className="w-full bg-purple-900 text-white p-6 rounded-2xl font-black uppercase shadow-2xl hover:bg-black transition-all border-b-8 border-purple-950">Publish Training Registry</button>
             </form>
          </div>
        </div>

        <div className="lg:col-span-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10 print:grid-cols-1">
             {entries.map((c: any) => (
               <div key={c.id} className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-xl hover:border-purple-800 transition-all flex flex-col justify-between group">
                 <div>
                   <div className="flex justify-between items-start mb-8">
                     <span className="bg-purple-100 text-purple-950 px-6 py-2 rounded-2xl text-xs font-black border-2 border-purple-300 shadow-sm font-serif-heading">₦{c.fee.toLocaleString()}</span>
                     <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-4 py-1.5 rounded-full uppercase tracking-widest">{c.lga}</span>
                   </div>
                   <h4 className="text-3xl font-black uppercase tracking-tight text-slate-900 leading-none mb-4 font-serif-heading">{c.centerName}</h4>
                   <div className="flex items-center gap-3 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                     <SearchIcon />
                     <p className="text-sm text-slate-600 font-bold italic text-visible-high">{c.address}</p>
                   </div>
                 </div>
                 <div className="flex justify-between items-center pt-8 border-t-2 border-slate-100">
                   <div className="flex items-center gap-5">
                     <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-xl font-black text-white shadow-2xl border-4 border-slate-200 font-serif-heading">{c.cmCount}</div>
                     <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Active Trainees</span>
                   </div>
                   <div className="flex gap-3 no-print">
                     <button onClick={() => onShare(`*NYSC SAED CENTER*\n\nHUB: ${c.centerName}\nLOCATION: ${c.address}\nFEE: ₦${c.fee}\nENROLLED: ${c.cmCount}`)} className="p-4 bg-purple-50 text-purple-800 rounded-2xl hover:bg-purple-100 transition-all border-2 border-purple-200 shadow-lg"><WhatsAppIcon /></button>
                     <button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-4 bg-red-50 text-red-700 rounded-2xl hover:bg-red-100 transition-all border-2 border-red-200 shadow-lg"><TrashIcon /></button>
                   </div>
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
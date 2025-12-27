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
  SickIcon,
  DashboardIcon,
  DeceasedIcon
} from './components/Icons';
import { initFirebase, subscribeToCollection, addData, updateData, deleteData } from './services/firebaseService';
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
  
  const [activeQuery, setActiveQuery] = useState<{ content: string, cm: any } | null>(null);
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

  const shareToWhatsApp = (text: string) => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
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
      <div className="min-h-screen bg-white p-8 md:p-16 flex flex-col items-center">
        <div className="max-w-3xl w-full bg-white border border-slate-300 shadow-2xl p-12 relative overflow-hidden font-official text-slate-900 print-shadow-none">
          <div className="text-center mb-10 border-b-2 border-slate-900 pb-6">
            <h1 className="text-2xl font-bold uppercase tracking-widest mb-1">National Youth Service Corps</h1>
            <h2 className="text-lg font-bold uppercase tracking-wider mb-2">Katsina State Secretariat</h2>
            <p className="text-sm font-bold uppercase">{lgaContext || activeQuery.cm.lga} Local Government Office</p>
          </div>
          
          <div className="whitespace-pre-wrap leading-relaxed text-sm">
            {activeQuery.content}
          </div>

          <div className="mt-16 flex justify-between no-print pt-8 border-t border-slate-100">
            <button onClick={() => setActiveQuery(null)} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold uppercase text-xs hover:bg-slate-200 transition-all">Close Viewer</button>
            <div className="flex gap-4">
               <button onClick={() => window.print()} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase text-xs hover:bg-black transition-all shadow-lg flex items-center gap-2">
                <FileTextIcon /> Print to PDF
              </button>
              <button 
                onClick={() => shareToWhatsApp(`Disciplinary Query for ${activeQuery.cm.name}\n\n${activeQuery.content}`)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold uppercase text-xs hover:bg-emerald-700 transition-all shadow-lg flex items-center gap-2"
              >
                <WhatsAppIcon /> Share WhatsApp
              </button>
            </div>
          </div>
        </div>
        <p className="mt-8 text-xs text-slate-400 font-bold uppercase tracking-widest no-print italic">Generated via AI-Zonal Disciplinary Protocol</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-white p-12 rounded-[2.5rem] shadow-2xl w-full max-w-lg space-y-8 animate-fade-in border-4 border-emerald-800">
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-800 rounded-full mx-auto mb-6 flex items-center justify-center shadow-xl">
              <span className="text-white font-black text-2xl">NYSC</span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter mb-2">Zonal Portal</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">Administrative Command Access</p>
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-500 ml-2">Assigned Command</label>
              <select required className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all appearance-none" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Station...</option>
                <option value="ZI">Zonal Inspector (ZI) - Daura HQ</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Station (LGI Office)</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-500 ml-2">Security Credential</label>
              <input type="password" required placeholder="PIN Code" className="w-full p-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-center text-3xl font-black tracking-[0.5em] focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all" value={pin} onChange={e => setPin(e.target.value)} />
            </div>
          </div>
          {loginError && <p className="text-red-600 text-xs font-black text-center uppercase tracking-widest bg-red-50 py-3 rounded-xl">Authorization Failed: Invalid PIN</p>}
          <button className="w-full bg-emerald-800 text-white p-6 rounded-2xl font-black uppercase shadow-2xl hover:bg-emerald-900 transition-all active:scale-95 text-lg">Grant Access</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-inter text-slate-900">
      <header className="bg-emerald-900 text-white p-6 shadow-2xl flex justify-between items-center no-print sticky top-0 z-50">
        <div className="flex items-center gap-5">
          <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg border border-emerald-400/30"><DashboardIcon /></div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight leading-none mb-1">{userRole === 'ZI' ? 'DAURA ZONAL HQ COMMAND' : `${lgaContext?.toUpperCase()} STATION OFFICE`}</h1>
            <p className="text-xs font-bold text-emerald-300/80 tracking-widest uppercase">Secretariat Information Management System</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {userRole === 'ZI' && (
            <select 
              className="bg-emerald-950 border-emerald-800 border-2 rounded-2xl px-5 py-3 text-xs font-black uppercase text-emerald-400 outline-none hover:border-emerald-500 transition-all cursor-pointer"
              value={ziStationFilter}
              onChange={(e) => setZiStationFilter(e.target.value)}
            >
              <option value="all">Global Zonal View (All LGAs)</option>
              {LGAS.map(l => <option key={l} value={l}>{l.toUpperCase()} STATION COMMAND</option>)}
            </select>
          )}
          <button onClick={handleLogout} className="p-4 bg-white/10 rounded-2xl hover:bg-red-500/30 transition-all border border-white/5"><LogOutIcon /></button>
        </div>
      </header>

      <nav className="bg-white border-b-4 border-emerald-800/10 p-4 md:p-6 flex justify-center gap-4 no-print overflow-x-auto shadow-sm">
        {[
          { id: 'CWHS', label: 'Welfare (CW&HS)', sub: 'Personnel Status' },
          { id: 'CIM', label: 'Clearance (CIM)', sub: 'Biometric Audits' },
          { id: 'SAED', label: 'SAED Program', sub: 'Skill Registry' }
        ].map(d => (
          <button 
            key={d.id}
            onClick={() => setDivision(d.id as Division)}
            className={`division-folder px-10 py-5 rounded-3xl text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap group ${division === d.id ? `bg-emerald-800 text-white active` : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            <div className="flex flex-col items-center">
              <span>{d.label}</span>
              <span className={`text-[9px] font-bold opacity-50 ${division === d.id ? 'text-emerald-300' : 'text-slate-400'}`}>{d.sub}</span>
            </div>
          </button>
        ))}
      </nav>

      <main className="flex-1 max-w-[1400px] mx-auto w-full p-4 md:p-10 space-y-10">
        {division === 'CWHS' && (
          <CWHSModule 
            entries={currentFilteredData.cwhs} 
            userRole={userRole!} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={shareToWhatsApp} 
          />
        )}
        {division === 'CIM' && (
          <CIMModule 
            entries={currentFilteredData.cim} 
            userRole={userRole!} 
            lga={lgaContext!} 
            db={dbRef.current} 
            onShare={shareToWhatsApp}
            onGenerateQuery={async (cm, lga) => {
              setIsGenerating(true);
              const content = await generateDisciplinaryQuery(cm.name, cm.code, cm.reason);
              setActiveQuery({ content, cm: { ...cm, lga } });
              setIsGenerating(false);
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
            onShare={shareToWhatsApp} 
          />
        )}
      </main>

      <footer className="p-10 text-center text-slate-500 no-print border-t border-slate-200">
        <p className="text-sm font-black uppercase tracking-[0.4em]">Federal Republic of Nigeria • NYSC Information portal</p>
      </footer>
    </div>
  );
};

// --- Sub-Modules ---

const SectionHeading = ({ title, subtitle }: { title: string, subtitle: string }) => (
  <div className="mb-8 border-l-8 border-emerald-800 pl-6 py-2">
    <h2 className="text-3xl font-black uppercase tracking-tight text-slate-900 leading-none mb-2">{title}</h2>
    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{subtitle}</p>
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
    <div className="animate-fade-in space-y-10">
      <div className="flex justify-between items-end no-print">
        <SectionHeading title="Welfare Roll Call" subtitle="Tracking Personnel Health & Incidents" />
        <button onClick={() => window.print()} className="mb-8 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs shadow-xl flex items-center gap-3">
          <FileTextIcon /> Generate Gazette
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-200 shadow-xl sticky top-32">
            <h3 className="font-black uppercase text-sm text-slate-900 mb-8 pb-4 border-b-2 border-emerald-800/10">Incident Registration Form</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-500 ml-1">Corps Member Name</label>
                <input required placeholder="SURNAME, FIRSTNAME MIDDLENAME" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase border-2 border-slate-100 focus:border-emerald-600 outline-none transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-500 ml-1">State Code</label>
                <input required placeholder="E.G. KT/24A/0001" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase border-2 border-slate-100 focus:border-emerald-600 outline-none transition-all" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-500 ml-1">Incident Classification</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-slate-100 focus:border-emerald-600 outline-none appearance-none cursor-pointer" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                  {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {formData.category === ReportCategory.DECEASED && (
                <div className="space-y-2 animate-fade-in p-4 bg-red-50 rounded-2xl border border-red-200">
                  <label className="text-xs font-black uppercase text-red-800">Verified Date of Demise</label>
                  <input type="date" required className="w-full p-4 bg-white rounded-xl font-bold border-2 border-red-200 outline-none" value={formData.dateOfDeath} onChange={e => setFormData({...formData, dateOfDeath: e.target.value})} />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-500 ml-1">Case Narrative</label>
                <textarea placeholder="PROVIDE COMPREHENSIVE INCIDENT DETAILS..." className="w-full p-4 bg-slate-50 rounded-2xl h-32 font-medium border-2 border-slate-100 focus:border-emerald-600 outline-none" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
              </div>
              <button className="w-full bg-emerald-800 text-white p-6 rounded-2xl font-black uppercase shadow-xl hover:bg-emerald-900 transition-all flex items-center justify-center gap-3">
                <PlusIcon /> Commit to Registry
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          {entries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-1">
              {entries.map((e: any) => (
                <div key={e.id} className="bg-white p-8 rounded-[2rem] border-2 border-slate-200 shadow-md hover:shadow-xl transition-all relative overflow-hidden flex flex-col justify-between print:shadow-none print:border-slate-400">
                  <div className={`absolute top-0 right-0 w-2 h-full ${e.category === ReportCategory.DECEASED ? 'bg-slate-900' : 'bg-emerald-600'}`}></div>
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 ${e.category === ReportCategory.SICK ? 'bg-blue-50 text-blue-800 border-blue-100' : e.category === ReportCategory.DECEASED ? 'bg-slate-950 text-white border-slate-900' : 'bg-red-50 text-red-800 border-red-100'}`}>{e.category}</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{e.lga}</span>
                    </div>
                    <h4 className="text-2xl font-black uppercase text-slate-900 leading-none mb-2">{e.name}</h4>
                    <p className="text-xs font-black text-emerald-800 tracking-[0.2em] mb-4">{e.stateCode}</p>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-sm text-slate-700 italic leading-relaxed">"{e.details}"</p>
                    </div>
                    {e.category === ReportCategory.DECEASED && e.dateOfDeath && (
                      <p className="mt-4 text-[10px] font-black uppercase text-red-700">✝️ Date of Demise: {new Date(e.dateOfDeath).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    )}
                  </div>
                  <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center no-print">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Added: {new Date(e.dateAdded).toLocaleDateString()}</span>
                    <div className="flex gap-2">
                      <button onClick={() => onShare(`*NYSC ${e.lga} REPORT*\nNAME: ${e.name}\nCODE: ${e.stateCode}\nSTATUS: ${e.category}\nDETAILS: ${e.details}`)} className="p-3 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-200"><WhatsAppIcon /></button>
                      <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="p-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-all border border-red-200"><TrashIcon /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-32 rounded-[3rem] border-4 border-dashed border-slate-200 text-center flex flex-col items-center">
              <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-300 mb-6"><DashboardIcon /></div>
              <h4 className="text-2xl font-black text-slate-300 uppercase tracking-widest">Station Log Clear</h4>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CIMModule = ({ entries, userRole, lga, db, onShare, onGenerateQuery, loading }: any) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });

  const totalStats = useMemo(() => {
    return entries.reduce((acc: any, curr: any) => {
      acc.strength += (curr.maleCount + curr.femaleCount);
      acc.cleared += curr.clearedCount;
      acc.uncleared += (curr.unclearedList?.length || 0);
      return acc;
    }, { strength: 0, cleared: 0, uncleared: 0 });
  }, [entries]);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const unclearedList = formData.uncleared.split('\n').map(line => {
      const parts = line.split(',').map(p => p.trim());
      return { name: parts[0] || '', code: parts[1] || '', reason: parts[2] || 'Absent' };
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
    <div className="animate-fade-in space-y-10">
      <div className="no-print">
        <SectionHeading title="Clearance Audit Ledger" subtitle="Biometric Confirmation & Disciplinary Tracking" />
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-lg">
            <h5 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Aggregate Zonal Strength</h5>
            <div className="text-4xl font-black text-slate-900">{totalStats.strength}</div>
            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Total Active Corps Members</p>
          </div>
          <div className="bg-emerald-50 p-8 rounded-3xl border-2 border-emerald-200 shadow-lg">
            <h5 className="text-[10px] font-black uppercase text-emerald-800 tracking-widest mb-2">Verified/Cleared Personnel</h5>
            <div className="text-4xl font-black text-emerald-900">{totalStats.cleared}</div>
            <p className="text-[10px] font-bold text-emerald-600 mt-2 uppercase tracking-widest">{totalStats.strength ? Math.round((totalStats.cleared / totalStats.strength) * 100) : 0}% Monthly Success Rate</p>
          </div>
          <div className="bg-red-50 p-8 rounded-3xl border-2 border-red-200 shadow-lg">
            <h5 className="text-[10px] font-black uppercase text-red-800 tracking-widest mb-2">Defaulted/Uncleared Flags</h5>
            <div className="text-4xl font-black text-red-900">{totalStats.uncleared}</div>
            <p className="text-[10px] font-bold text-red-600 mt-2 uppercase tracking-widest">Disciplinary Queries Pending</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-200 shadow-xl">
             <h3 className="font-black uppercase text-sm text-slate-900 mb-8 pb-4 border-b-2 border-amber-500/10">Clearance Month Entry</h3>
             <form onSubmit={handleSubmit} className="space-y-4">
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Reporting Period</label>
                 <input type="month" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-slate-100 outline-none" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} />
               </div>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Male Count</label>
                   <input type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-slate-100 outline-none" value={formData.maleCount} onChange={e => setFormData({...formData, maleCount: Number(e.target.value)})} />
                 </div>
                 <div className="space-y-1">
                   <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Female Count</label>
                   <input type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-slate-100 outline-none" value={formData.femaleCount} onChange={e => setFormData({...formData, femaleCount: Number(e.target.value)})} />
                 </div>
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Total Cleared Successfully</label>
                 <input type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-slate-100 outline-none" value={formData.clearedCount} onChange={e => setFormData({...formData, clearedCount: Number(e.target.value)})} />
               </div>
               <div className="space-y-1">
                 <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Default List (Name, Code, Reason)</label>
                 <textarea placeholder="Line format: NAME, CODE, REASON" className="w-full p-4 bg-slate-50 rounded-2xl h-40 text-xs font-mono border-2 border-slate-100 outline-none" value={formData.uncleared} onChange={e => setFormData({...formData, uncleared: e.target.value})} />
                 <p className="text-[9px] text-slate-400 font-bold uppercase p-2">* Each CM on a new line separated by commas.</p>
               </div>
               <button className="w-full bg-slate-900 text-white p-6 rounded-2xl font-black uppercase shadow-xl hover:bg-black transition-all">Submit Monthly Audit</button>
             </form>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-8">
          {entries.map((e: any) => (
            <div key={e.id} className="bg-white rounded-[2.5rem] border-2 border-slate-200 shadow-xl overflow-hidden hover:border-emerald-800/30 transition-all">
              <div className="bg-slate-950 p-8 text-white flex justify-between items-center">
                <div>
                  <h4 className="text-2xl font-black uppercase tracking-tighter">{new Date(e.month).toLocaleString('default', { month: 'long', year: 'numeric' })} AUDIT</h4>
                  <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">{e.lga} STATION COMMAND</p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black uppercase text-slate-400 mb-1">Station Strength</div>
                  <div className="text-3xl font-black leading-none">{e.maleCount + e.femaleCount}</div>
                </div>
              </div>
              
              <div className="p-8 space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">MALE CMs</span>
                    <span className="text-xl font-black">{e.maleCount}</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">FEMALE CMs</span>
                    <span className="text-xl font-black">{e.femaleCount}</span>
                  </div>
                  <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block mb-1">CLEARED</span>
                    <span className="text-xl font-black text-emerald-900">{e.clearedCount}</span>
                  </div>
                  <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                    <span className="text-[9px] font-black text-red-800 uppercase tracking-widest block mb-1">UNCLEARED</span>
                    <span className="text-xl font-black text-red-900">{e.unclearedList?.length || 0}</span>
                  </div>
                </div>

                {e.unclearedList?.length > 0 && (
                  <div className="pt-6 border-t border-slate-100">
                    <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                      <AbscondedIcon /> PERSONNEL IN DEFAULT (Biometric Miss)
                    </h5>
                    <div className="space-y-3">
                      {e.unclearedList.map((cm: any, idx: number) => (
                        <div key={idx} className="flex flex-col md:flex-row justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-200 gap-4">
                          <div>
                            <span className="font-black text-slate-900 block uppercase text-sm">{cm.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cm.code} • Reason: {cm.reason}</span>
                          </div>
                          <div className="flex gap-2 w-full md:w-auto">
                            <button 
                              disabled={loading}
                              onClick={() => onGenerateQuery(cm, e.lga)} 
                              className="flex-1 md:flex-none px-4 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                              {loading ? 'Generating...' : <><FileTextIcon /> Generate Query</>}
                            </button>
                            <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="p-3 text-slate-300 hover:text-red-700 transition-all"><TrashIcon /></button>
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

const SAEDModule = ({ entries, userRole, lga, db, onShare }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "saed_centers", { ...formData, lga: lga || 'Daura' });
    setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 });
  };

  return (
    <div className="animate-fade-in space-y-10">
      <SectionHeading title="SAED Skill Hub" subtitle="Entrepreneurship Training & Enrollment Records" />
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-200 shadow-xl">
             <h3 className="font-black uppercase text-sm text-slate-900 mb-8 pb-4 border-b-2 border-purple-800/10">Register Training Center</h3>
             <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-500 ml-1">Establishment Name</label>
                  <input required placeholder="E.G. DAURA SKILL HUB" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase border-2 border-slate-100 outline-none" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black uppercase text-slate-500 ml-1">Physical Location</label>
                  <input required placeholder="FULL OFFICE ADDRESS" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase border-2 border-slate-100 outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-500 ml-1">Enrolled CMs</label>
                    <input type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-slate-100 outline-none" value={formData.cmCount} onChange={e => setFormData({...formData, cmCount: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black uppercase text-slate-500 ml-1">Monthly Fee (₦)</label>
                    <input type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-2 border-slate-100 outline-none" value={formData.fee} onChange={e => setFormData({...formData, fee: Number(e.target.value)})} />
                  </div>
                </div>
                <button className="w-full bg-purple-900 text-white p-6 rounded-2xl font-black uppercase shadow-xl hover:bg-purple-950 transition-all">Publish Center</button>
             </form>
          </div>
        </div>

        <div className="lg:col-span-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-1">
             {entries.map((c: any) => (
               <div key={c.id} className="bg-white p-10 rounded-[2.5rem] border-2 border-slate-200 shadow-md hover:border-purple-800 transition-all flex flex-col justify-between">
                 <div>
                   <div className="flex justify-between items-start mb-6">
                     <span className="bg-purple-50 text-purple-900 px-5 py-2 rounded-xl text-xs font-black border border-purple-200">₦{c.fee.toLocaleString()}</span>
                     <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.lga} STATION</span>
                   </div>
                   <h4 className="text-2xl font-black uppercase tracking-tight text-slate-900 leading-none mb-3">{c.centerName}</h4>
                   <div className="flex items-center gap-2 mb-6">
                     <SearchIcon />
                     <p className="text-sm text-slate-500 font-medium italic">{c.address}</p>
                   </div>
                 </div>
                 <div className="flex justify-between items-center pt-6 border-t border-slate-100">
                   <div className="flex items-center gap-4">
                     <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-lg font-black text-slate-800 shadow-inner">{c.cmCount}</div>
                     <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Enrolled Trainees</span>
                   </div>
                   <div className="flex gap-2 no-print">
                     <button onClick={() => onShare(`*SAED HUB: ${c.centerName}*\nADDRESS: ${c.address}\nFEE: ₦${c.fee}\nENROLLMENT: ${c.cmCount}`)} className="p-3 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 transition-all border border-purple-200"><WhatsAppIcon /></button>
                     <button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-3 bg-red-50 text-red-700 rounded-xl hover:bg-red-100 transition-all border border-red-200"><TrashIcon /></button>
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
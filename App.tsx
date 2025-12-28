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
            <h1 className="text-2xl font-black uppercase tracking-tight leading-none mb-1 font-serif-heading">{userRole === 'ZI' ? 'ZONAL HQ' : `${lgaContext?.toUpperCase()} STATION`}</h1>
            <p className="text-xs font-bold text-emerald-400/80 tracking-widest uppercase italic">Katsina Secretariat Management System</p>
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
          { id: 'CWHS', label: 'Welfare registry', sub: 'Status' },
          { id: 'CIM', label: 'Clearance Audit', sub: 'Discipline' },
          { id: 'SAED', label: 'Skill hub', sub: 'Training' }
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
          <CWHSModule entries={filteredData.cwhs} lga={lgaContext!} db={dbRef.current} onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')} />
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
          />
        )}
        {division === 'SAED' && (
          <SAEDModule entries={filteredData.saed} lga={lgaContext!} db={dbRef.current} onShare={(txt: string) => window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, '_blank')} />
        )}
      </main>
    </div>
  );
};

const Header = ({ title, sub }: { title: string, sub: string }) => (
  <div className="mb-12 border-l-[12px] border-emerald-900 pl-8 py-4 bg-white rounded-r-3xl shadow-xl border-t border-r border-b border-slate-200">
    <h2 className="text-4xl font-black uppercase tracking-tight text-slate-900 leading-none mb-3 font-serif-heading">{title}</h2>
    <p className="text-sm font-bold text-slate-500 uppercase tracking-[0.2em]">{sub}</p>
  </div>
);

const CWHSModule = ({ entries, lga, db, onShare }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.SICK, details: '' });
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "nysc_reports", { ...formData, lga: lga || 'Daura' });
    setFormData({ name: '', stateCode: '', category: ReportCategory.SICK, details: '' });
  };
  return (
    <div className="animate-official space-y-12">
      <div className="flex justify-between items-end no-print">
        <Header title="Welfare Records" sub="Personnel health and incident tracking" />
        <button onClick={() => window.print()} className="mb-12 bg-slate-900 text-white px-10 py-5 rounded-2xl font-black uppercase text-xs shadow-2xl hover:bg-black transition-all border-b-8 border-black flex items-center gap-3">
          <FileTextIcon /> Print Gazette
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl sticky top-32">
            <h3 className="font-black uppercase text-xs mb-8 pb-4 border-b-2 border-slate-100 font-serif-heading">Add Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input required placeholder="NAME" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
              <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
              <select className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <textarea placeholder="DETAILS..." className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 h-32" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
              <button className="w-full bg-emerald-900 text-white p-6 rounded-2xl font-black uppercase border-b-8 border-emerald-950">Add to registry</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-8 space-y-8">
          {entries.map((e: any) => (
            <div key={e.id} className="bg-white p-8 rounded-[2rem] border-2 border-slate-200 shadow-lg relative flex flex-col justify-between">
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
                 <button onClick={() => onShare(`CM: ${e.name} (${e.stateCode}) Status: ${e.category} Detail: ${e.details}`)} className="p-3 bg-emerald-50 text-emerald-700 rounded-xl"><WhatsAppIcon /></button>
                 <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="p-3 bg-red-50 text-red-700 rounded-xl"><TrashIcon /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CIMModule = ({ entries, db, onShare, onGenerateQuery, loading }: any) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
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
  return (
    <div className="animate-official space-y-12">
      <Header title="Audit & Discipline" sub="Monthly biometric verification" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 no-print">
        <div className="bg-white p-10 rounded-[2rem] border-2 border-slate-200 text-center shadow-lg">
          <h5 className="text-xs font-black uppercase text-slate-400 mb-2">Total Strength</h5>
          <div className="text-6xl font-black font-serif-heading text-slate-900">{stats.t}</div>
        </div>
        <div className="bg-emerald-50 p-10 rounded-[2rem] border-2 border-emerald-200 text-center shadow-lg">
          <h5 className="text-xs font-black uppercase text-emerald-800 mb-2">Cleared Personnel</h5>
          <div className="text-6xl font-black font-serif-heading text-emerald-900">{stats.cl}</div>
        </div>
        <div className="bg-red-50 p-10 rounded-[2rem] border-2 border-red-200 text-center shadow-lg">
          <h5 className="text-xs font-black uppercase text-red-800 mb-2">Defaults (Uncleared)</h5>
          <div className="text-6xl font-black font-serif-heading text-red-900">{stats.unc}</div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl">
            <h3 className="font-black uppercase text-xs mb-8 border-b-2 border-slate-100 font-serif-heading">Submit Audit</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
               <input type="month" required className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} />
               <div className="flex gap-4">
                 <input type="number" placeholder="M" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, maleCount: Number(e.target.value)})} />
                 <input type="number" placeholder="F" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, femaleCount: Number(e.target.value)})} />
               </div>
               <input type="number" placeholder="TOTAL CLEARED" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, clearedCount: Number(e.target.value)})} />
               <textarea placeholder="NAME, CODE, REASON" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200 h-40" value={formData.uncleared} onChange={e => setFormData({...formData, uncleared: e.target.value})} />
               <button className="w-full bg-slate-900 text-white p-5 rounded-2xl font-black uppercase">Finalize month</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-8 space-y-10">
          {entries.map((e: any) => (
            <div key={e.id} className="bg-white rounded-[2.5rem] border-2 border-slate-200 shadow-xl overflow-hidden">
               <div className="bg-slate-900 p-8 text-white flex justify-between items-center">
                  <div>
                    <h4 className="text-2xl font-black uppercase font-serif-heading">{new Date(e.month).toLocaleString('default',{month:'long',year:'numeric'})}</h4>
                    <p className="text-xs text-emerald-400 uppercase tracking-widest">{e.lga} STATION</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-black opacity-50 block">Personnel</span>
                    <span className="text-3xl font-black">{e.maleCount + e.femaleCount}</span>
                  </div>
               </div>
               <div className="p-8 space-y-6">
                 {e.unclearedList?.map((cm: any, idx: number) => (
                   <div key={idx} className="flex justify-between items-center p-6 bg-slate-50 rounded-[1.5rem] border border-slate-200">
                      <div>
                        <span className="font-black block uppercase text-sm">{cm.name}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cm.code} • {cm.reason}</span>
                      </div>
                      <button disabled={loading} onClick={() => onGenerateQuery(cm, e.lga)} className="px-6 py-3 bg-emerald-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-black transition-all">
                        {loading ? '...' : <><FileTextIcon /> Generate Query</>}
                      </button>
                   </div>
                 ))}
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SAEDModule = ({ entries, db, onShare }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "saed_centers", { ...formData, lga: entries[0]?.lga || 'Daura' });
    setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 });
  };
  return (
    <div className="animate-official space-y-12">
      <Header title="Skill Hub Registry" sub="Training center enrollment" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 no-print">
          <div className="bg-white p-10 rounded-[3rem] border-2 border-slate-200 shadow-2xl">
             <form onSubmit={handleSubmit} className="space-y-6">
                <input required placeholder="CENTER NAME" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
                <input required placeholder="ADDRESS" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
                <div className="flex gap-4">
                  <input type="number" placeholder="COUNT" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, cmCount: Number(e.target.value)})} />
                  <input type="number" placeholder="FEE" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-200" onChange={e => setFormData({...formData, fee: Number(e.target.value)})} />
                </div>
                <button className="w-full bg-purple-900 text-white p-5 rounded-2xl font-black uppercase">Publish Hub</button>
             </form>
          </div>
        </div>
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {entries.map((c: any) => (
            <div key={c.id} className="bg-white p-8 rounded-[2rem] border-2 border-slate-200 shadow-xl flex flex-col justify-between">
              <div>
                <span className="bg-purple-50 text-purple-900 px-4 py-1.5 rounded-full text-[10px] font-black uppercase border border-purple-200">₦{c.fee}</span>
                <h4 className="text-xl font-black uppercase mt-4 font-serif-heading">{c.centerName}</h4>
                <p className="text-xs font-bold text-slate-400 uppercase mt-1">{c.address}</p>
              </div>
              <div className="mt-8 pt-4 border-t flex justify-between items-center">
                 <span className="text-[10px] font-black uppercase text-slate-400">Enrollment: {c.cmCount}</span>
                 <div className="flex gap-2 no-print">
                   <button onClick={() => onShare(`Hub: ${c.centerName} Enrollment: ${c.cmCount}`)} className="p-3 bg-purple-50 text-purple-700 rounded-xl"><WhatsAppIcon /></button>
                   <button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-3 bg-red-50 text-red-700 rounded-xl"><TrashIcon /></button>
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default App;
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
  DashboardIcon
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
  
  const [division, setDivision] = useState<Division>('CWHS');
  const [cwhsEntries, setCwhsEntries] = useState<CorpsMemberEntry[]>([]);
  const [cimEntries, setCimEntries] = useState<CIMClearance[]>([]);
  const [saedEntries, setSaedEntries] = useState<SAEDCenter[]>([]);
  
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">NYSC DAURA</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Division HQ Access</p>
          </div>
          <div className="space-y-4">
            <select required className="w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none" onChange={e => {
              const val = e.target.value;
              setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
            }}>
              <option value="">Select Division/Station...</option>
              <option value="ZI">Zonal Office (ZI)</option>
              {LGAS.map(l => <option key={l} value={l}>{l} Station (LGI)</option>)}
            </select>
            <input type="password" required placeholder="Security PIN" className="w-full p-4 bg-slate-50 border rounded-2xl text-center text-3xl font-black focus:ring-2 focus:ring-emerald-500 outline-none" value={pin} onChange={e => setPin(e.target.value)} />
          </div>
          {loginError && <p className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest">Access Denied: Invalid PIN</p>}
          <button className="w-full bg-emerald-800 text-white p-5 rounded-2xl font-black uppercase shadow-xl hover:bg-emerald-900 transition-all active:scale-95">Authenticate Division</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-inter">
      <header className="bg-slate-900 text-white p-6 shadow-xl flex justify-between items-center no-print">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/20"><DashboardIcon /></div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight">{userRole === 'ZI' ? 'DAURA ZONAL HQ' : `${lgaContext} STATION`}</h1>
            <p className="text-[9px] font-bold opacity-60 tracking-[0.2em] uppercase">National Youth Service Corps</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{userRole} AUTHENTICATED</span>
            <span className="text-[10px] text-white/50 font-bold">{new Date().toLocaleDateString()}</span>
          </div>
          <button onClick={handleLogout} className="p-3 bg-white/10 rounded-xl hover:bg-red-500/20 transition-all"><LogOutIcon /></button>
        </div>
      </header>

      {/* Division Navigation Tabs (Conceptual Folders) */}
      <nav className="bg-white border-b p-2 md:p-4 flex justify-center gap-2 md:gap-4 no-print overflow-x-auto">
        {[
          { id: 'CWHS', label: 'Corps Welfare (CW&HS)', color: 'border-b-blue-500' },
          { id: 'CIM', label: 'Inspection (CIM)', color: 'border-b-amber-500' },
          { id: 'SAED', label: 'SAED Division', color: 'border-b-purple-500' }
        ].map(d => (
          <button 
            key={d.id}
            onClick={() => setDivision(d.id as Division)}
            className={`division-folder px-4 md:px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${division === d.id ? `bg-emerald-800 text-white shadow-xl shadow-emerald-800/20 active` : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
          >
            {d.label}
          </button>
        ))}
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {division === 'CWHS' && <CWHSModule entries={cwhsEntries} userRole={userRole!} lga={lgaContext!} db={dbRef.current} />}
        {division === 'CIM' && <CIMModule entries={cimEntries} userRole={userRole!} lga={lgaContext!} db={dbRef.current} />}
        {division === 'SAED' && <SAEDModule entries={saedEntries} userRole={userRole!} lga={lgaContext!} db={dbRef.current} />}
      </main>

      <footer className="p-8 text-center text-slate-300 no-print">
        <p className="text-[9px] font-black uppercase tracking-[0.5em]">Division Data Management System • NYSC Katsina State</p>
      </footer>
    </div>
  );
};

// --- Division Modules ---

const CWHSModule = ({ entries, userRole, lga, db }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.SICK, details: '' });
  const filtered = entries.filter((e: any) => userRole === 'ZI' ? true : e.lga === lga);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await addData(db, "nysc_reports", { ...formData, lga: lga || 'Daura' });
      setFormData({ name: '', stateCode: '', category: ReportCategory.SICK, details: '' });
    } catch (err) { alert("Submission failed"); }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Corps Welfare & Health Service (CW&HS)</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Personnel Status & Emergency Tracking</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-6 py-4 rounded-3xl border shadow-sm flex items-center gap-4">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Cases</span>
            <span className="text-3xl font-black text-emerald-800">{filtered.length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 no-print">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm sticky top-32">
            <h3 className="font-black uppercase mb-8 text-xs text-slate-800 border-b pb-4">New Welfare Case</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Full Name</label>
                <input required placeholder="E.G. JOHN DOE" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">State Code</label>
                <input required placeholder="E.G. KT/24A/0001" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Status Category</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                  {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Case Details</label>
                <textarea placeholder="PROVIDE CASE PARTICULARS..." className="w-full p-4 bg-slate-50 rounded-2xl h-32 font-medium outline-none focus:ring-2 focus:ring-emerald-500" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
              </div>
              <button className="w-full bg-emerald-800 text-white p-5 rounded-2xl font-black uppercase shadow-lg shadow-emerald-800/20 active:scale-95 transition-all">Record Incident</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((e: any) => (
                <div key={e.id} className="bg-white p-8 rounded-[2rem] border shadow-sm border-t-[10px] border-t-emerald-800 flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg uppercase tracking-widest">{e.category}</span>
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{e.lga}</span>
                    </div>
                    <h4 className="font-black text-xl uppercase leading-tight text-slate-800 mb-1">{e.name}</h4>
                    <p className="text-xs text-slate-400 font-bold tracking-widest">{e.stateCode}</p>
                    <p className="mt-6 text-sm text-slate-500 italic leading-relaxed">"{e.details}"</p>
                  </div>
                  <div className="mt-8 pt-4 border-t flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-300">{new Date(e.dateAdded).toLocaleDateString()}</span>
                    <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="text-slate-200 hover:text-red-500 transition-colors"><TrashIcon /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="p-6 bg-slate-50 rounded-full mb-6 text-slate-200"><DashboardIcon /></div>
              <h4 className="text-lg font-black text-slate-300 uppercase tracking-[0.2em]">All Systems Clear</h4>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">No welfare incidents currently recorded</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CIMModule = ({ entries, userRole, lga, db }: any) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
  const filtered = entries.filter((e: any) => userRole === 'ZI' ? true : e.lga === lga);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const unclearedList = formData.uncleared.split('\n').map(line => {
      const parts = line.split(',').map(p => p.trim());
      return { name: parts[0] || '', code: parts[1] || '', reason: parts[2] || 'Absent' };
    }).filter(x => x.name);

    try {
      await addData(db, "cim_clearance", { 
        month: formData.month, 
        maleCount: Number(formData.maleCount),
        femaleCount: Number(formData.femaleCount),
        clearedCount: Number(formData.clearedCount),
        unclearedList,
        lga: lga || 'Daura'
      });
      setFormData({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
    } catch (err) { alert("Submission failed"); }
  };

  const handleGenerateAIQuery = async (cm: any) => {
    const queryTxt = await generateDisciplinaryQuery(cm.name, cm.code, cm.reason);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`
        <html>
          <head>
            <title>Disciplinary Query - ${cm.name}</title>
            <style>
              body { font-family: serif; padding: 40px; max-width: 800px; margin: auto; line-height: 1.6; }
              pre { white-space: pre-wrap; word-wrap: break-word; font-size: 14px; }
              .header { text-align: center; border-bottom: 2px solid black; margin-bottom: 40px; padding-bottom: 20px; }
              .stamp { margin-top: 60px; border: 1px solid #ccc; width: 200px; height: 80px; text-align: center; line-height: 80px; color: #eee; text-transform: uppercase; }
              @media print { .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <h2 style="margin:0; text-transform: uppercase;">National Youth Service Corps</h2>
              <p style="margin:5px 0;">Division of Corps Inspection & Monitoring (CIM)</p>
            </div>
            <pre>${queryTxt}</pre>
            <div class="stamp">Official Stamp</div>
            <br/><br/>
            <button class="no-print" onclick="window.print()" style="padding: 10px 20px; cursor: pointer;">Print Document</button>
          </body>
        </html>
      `);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Corps Inspection & Monitoring (CIM)</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Monthly Clearance & Attendance Audit</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 no-print">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm sticky top-32">
            <h3 className="font-black uppercase mb-6 text-xs text-slate-800 border-b pb-4">Monthly Clearance Subm.</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Clearance Month</label>
                <input type="month" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Male Count</label>
                  <input type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={formData.maleCount} onChange={e => setFormData({...formData, maleCount: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Female Count</label>
                  <input type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={formData.femaleCount} onChange={e => setFormData({...formData, femaleCount: Number(e.target.value)})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Cleared Successfully</label>
                <input type="number" required placeholder="TOTAL CLEARED" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={formData.clearedCount} onChange={e => setFormData({...formData, clearedCount: Number(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Uncleared (Name, Code, Reason)</label>
                <textarea placeholder="Line format: NAME, CODE, REASON" className="w-full p-4 bg-slate-50 rounded-2xl h-40 text-xs font-mono outline-none" value={formData.uncleared} onChange={e => setFormData({...formData, uncleared: e.target.value})} />
              </div>
              <button className="w-full bg-emerald-800 text-white p-5 rounded-2xl font-black uppercase shadow-lg active:scale-95 transition-all">Submit Audit</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {filtered.map((e: any) => (
            <div key={e.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm border-l-[12px] border-l-amber-500">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h4 className="font-black text-2xl text-slate-800 uppercase tracking-tighter">{new Date(e.month).toLocaleString('default', { month: 'long', year: 'numeric' })} Audit</h4>
                  <p className="text-[10px] font-black text-amber-600 tracking-widest uppercase">{e.lga} STATION AUDIT LOG</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-slate-900 leading-none">{e.maleCount + e.femaleCount}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Personnel Strength</div>
                  <div className="text-[10px] font-bold text-slate-400 mt-2">MALE: {e.maleCount} | FEMALE: {e.femaleCount}</div>
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-3xl mb-8 border border-slate-100">
                <div className="flex justify-between items-center text-[10px] font-black uppercase mb-4 tracking-widest">
                  <span className="text-slate-500">Monthly Success Rate</span>
                  <span className="text-emerald-600">{Math.round((e.clearedCount / (e.maleCount + e.femaleCount)) * 100)}% Cleared</span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden shadow-inner">
                  <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(e.clearedCount / (e.maleCount + e.femaleCount)) * 100}%` }}></div>
                </div>
                <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase text-center">{e.clearedCount} of {e.maleCount + e.femaleCount} personnel cleared duty for this period</p>
              </div>

              {e.unclearedList?.length > 0 && (
                <div>
                  <h5 className="text-[10px] font-black text-red-600 uppercase mb-4 tracking-[0.2em] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                    Disciplinary Flag List ({e.unclearedList.length})
                  </h5>
                  <div className="grid grid-cols-1 gap-3">
                    {e.unclearedList.map((cm: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-red-50/50 rounded-2xl border border-red-100 hover:bg-red-50 transition-colors">
                        <div className="text-xs">
                          <span className="font-black text-red-900 block uppercase">{cm.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 tracking-widest">{cm.code}</span>
                          <p className="text-[10px] font-bold text-red-400 mt-1 uppercase italic">Reason: {cm.reason}</p>
                        </div>
                        <button onClick={() => handleGenerateAIQuery(cm)} className="bg-white px-4 py-2 rounded-xl text-[9px] font-black text-red-600 border border-red-200 shadow-sm hover:bg-red-600 hover:text-white transition-all whitespace-nowrap">GENERATE BYE-LAW QUERY</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SAEDModule = ({ entries, userRole, lga, db }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  const filtered = entries.filter((e: any) => userRole === 'ZI' ? true : e.lga === lga);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await addData(db, "saed_centers", { ...formData, lga: lga || 'Daura' });
      setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 });
    } catch (err) { alert("Registration failed"); }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Skill Acquisition & Entrep. Dev. (SAED)</h2>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Post-Camp Training Registry</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 no-print">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm sticky top-32">
            <h3 className="font-black uppercase mb-8 text-xs text-slate-800 border-b pb-4">Register Training Center</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Center Name</label>
                <input required placeholder="E.G. DAURA FASHION HUB" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Location Address</label>
                <input required placeholder="CENTER PHYSICAL ADDRESS" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Enrolled CMs</label>
                  <input type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={formData.cmCount} onChange={e => setFormData({...formData, cmCount: Number(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-slate-400">Training Fee (₦)</label>
                  <input type="number" required placeholder="0" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none" value={formData.fee} onChange={e => setFormData({...formData, fee: Number(e.target.value)})} />
                </div>
              </div>
              <button className="w-full bg-emerald-800 text-white p-5 rounded-2xl font-black uppercase shadow-lg active:scale-95 transition-all">Save Registry</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-3">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filtered.map((c: any) => (
                <div key={c.id} className="bg-white p-8 rounded-[2.5rem] border shadow-sm border-l-[15px] border-l-purple-600 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <DashboardIcon />
                  </div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="font-black text-xl uppercase tracking-tight text-slate-800 leading-none mb-2">{c.centerName}</h4>
                      <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">{c.lga} STATION REGISTRY</p>
                    </div>
                    <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-2xl text-[10px] font-black border border-purple-100">₦{c.fee.toLocaleString()}</div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 flex items-start gap-2 italic leading-relaxed">
                      <SearchIcon /> {c.address}
                    </p>
                    <div className="flex justify-between items-center pt-6 border-t">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400">{c.cmCount}</div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Trainees</span>
                      </div>
                      <button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-3 bg-slate-50 text-slate-300 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all"><TrashIcon /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-32 rounded-[3rem] border-2 border-dashed border-slate-100 text-center">
              <h4 className="text-lg font-black text-slate-300 uppercase tracking-widest">No SAED Centers Registered</h4>
              <p className="text-xs text-slate-400 font-bold uppercase mt-2">Begin registry by adding a center in your local government</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
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

// --- Export Utilities ---
const exportToCSV = (filename: string, rows: any[]) => {
  if (!rows.length) return;
  const cleanRows = rows.map(({ id, _serverTimestamp, _lastModified, ...rest }) => rest);
  const headers = Object.keys(cleanRows[0]).join(',');
  const content = cleanRows.map(r => 
    Object.values(r).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  const csv = `${headers}\n${content}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const useMultiSelect = (items: any[]) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };
  const clearSelection = () => setSelectedIds(new Set());
  const selectAll = () => setSelectedIds(new Set(items.map(i => i.id)));
  return { selectedIds, toggleSelect, clearSelection, selectAll };
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
      if (userRole === 'LGI') {
        return items.filter(i => i.lga === lgaContext);
      }
      if (ziStationFilter === 'all') return items;
      return items.filter(i => i.lga === ziStationFilter);
    };

    return {
      cwhs: filterFn(cwhsEntries),
      cim: filterFn(cimEntries),
      saed: filterFn(saedEntries)
    };
  }, [cwhsEntries, cimEntries, saedEntries, userRole, lgaContext, ziStationFilter]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md space-y-6 animate-fade-in">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">NYSC DAURA</h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.3em] mt-1">Division HQ Access</p>
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
          {loginError && <p className="text-red-600 text-xs font-black text-center uppercase tracking-widest">Access Denied: Invalid PIN</p>}
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
            <p className="text-xs font-bold text-slate-400 tracking-[0.2em] uppercase">National Youth Service Corps</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {userRole === 'ZI' ? (
            <div className="mr-4">
               <select 
                className="bg-slate-800 border-none rounded-xl px-4 py-2 text-xs font-black uppercase text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500"
                value={ziStationFilter}
                onChange={(e) => setZiStationFilter(e.target.value)}
              >
                <option value="all">Global View (All LGAs)</option>
                {LGAS.map(l => <option key={l} value={l}>{l.toUpperCase()} STATION</option>)}
              </select>
            </div>
          ) : (
            <div className="mr-4 hidden md:block">
              <span className="text-xs font-black text-emerald-400 uppercase tracking-widest bg-emerald-950 px-3 py-1.5 rounded-lg">STATION: {lgaContext?.toUpperCase()}</span>
            </div>
          )}
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">{userRole} AUTHENTICATED</span>
            <span className="text-xs text-slate-300 font-bold">{new Date().toLocaleDateString()}</span>
          </div>
          <button onClick={handleLogout} className="p-3 bg-white/10 rounded-xl hover:bg-red-500/20 transition-all"><LogOutIcon /></button>
        </div>
      </header>

      <nav className="bg-white border-b p-2 md:p-4 flex justify-center gap-2 md:gap-4 no-print overflow-x-auto">
        {[
          { id: 'CWHS', label: 'Corps Welfare (CW&HS)' },
          { id: 'CIM', label: 'Inspection (CIM)' },
          { id: 'SAED', label: 'SAED Division' }
        ].map(d => (
          <button 
            key={d.id}
            onClick={() => setDivision(d.id as Division)}
            className={`division-folder px-4 md:px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all whitespace-nowrap ${division === d.id ? `bg-emerald-800 text-white shadow-xl shadow-emerald-800/20 active` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            {d.label}
          </button>
        ))}
      </nav>

      {/* --- Print Title for PDF --- */}
      <div className="hidden print:block p-8 border-b-2 border-slate-900 mb-8">
        <h1 className="text-3xl font-black uppercase">National Youth Service Corps - {userRole === 'ZI' ? 'Zonal Office Daura' : `${lgaContext} Station`}</h1>
        <p className="text-xl font-bold uppercase mt-2">Formal Division Report: {division}</p>
        <p className="text-sm mt-1">Generated on: {new Date().toLocaleString()}</p>
      </div>

      <section className="max-w-7xl mx-auto w-full px-4 md:px-8 pt-8 no-print animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard 
            title="Total Records" 
            value={currentFilteredData.cwhs.length + currentFilteredData.cim.length + currentFilteredData.saed.length}
            subtitle={userRole === 'ZI' && ziStationFilter === 'all' ? "Zonal Command Strength" : `${userRole === 'ZI' ? ziStationFilter : lgaContext} Local Stats`}
            icon={<DashboardIcon />}
            color="bg-slate-900"
          />
          {division === 'CWHS' && (
            <>
              <SummaryCard 
                title="Sick/Hospitalized" 
                value={currentFilteredData.cwhs.filter(i => i.category === ReportCategory.SICK).length}
                subtitle="Personnel Under Medical Care"
                icon={<SickIcon />}
                color="bg-blue-600"
              />
              <SummaryCard 
                title="Deceased" 
                value={currentFilteredData.cwhs.filter(i => i.category === ReportCategory.DECEASED).length}
                subtitle="Total Mortality Record"
                icon={<DeceasedIcon />}
                color="bg-slate-700"
              />
              <SummaryCard 
                title="Critical Incidents" 
                value={currentFilteredData.cwhs.filter(i => [ReportCategory.ABSCONDED, ReportCategory.KIDNAPPED, ReportCategory.MISSING].includes(i.category)).length}
                subtitle="High Priority Cases"
                icon={<AbscondedIcon />}
                color="bg-red-600"
              />
            </>
          )}
          {division === 'CIM' && (
            <>
              <SummaryCard 
                title="Avg Success Rate" 
                value={`${Math.round(currentFilteredData.cim.length ? currentFilteredData.cim.reduce((acc, curr) => acc + (curr.clearedCount / (curr.maleCount + curr.femaleCount) * 100), 0) / currentFilteredData.cim.length : 0)}%`}
                subtitle="Clearance Efficiency"
                icon={<FileTextIcon />}
                color="bg-emerald-600"
              />
              <SummaryCard 
                title="Audit Logs" 
                value={currentFilteredData.cim.length}
                subtitle="Monthly Submissions"
                icon={<SearchIcon />}
                color="bg-amber-600"
              />
              <SummaryCard 
                title="Flagged Personnel" 
                value={currentFilteredData.cim.reduce((acc, curr) => acc + (curr.unclearedList?.length || 0), 0)}
                subtitle="Total Disciplinary Cases"
                icon={<TrashIcon />}
                color="bg-slate-800"
              />
            </>
          )}
          {division === 'SAED' && (
            <>
              <SummaryCard 
                title="Active Centers" 
                value={currentFilteredData.saed.length}
                subtitle="Skill Acquisition Hubs"
                icon={<SearchIcon />}
                color="bg-purple-600"
              />
              <SummaryCard 
                title="Total Trainees" 
                value={currentFilteredData.saed.reduce((acc, curr) => acc + curr.cmCount, 0)}
                subtitle="Corps Members Enrolled"
                icon={<PlusIcon />}
                color="bg-blue-600"
              />
              <SummaryCard 
                title="Total Fees" 
                value={`₦${currentFilteredData.saed.reduce((acc, curr) => acc + curr.fee, 0).toLocaleString()}`}
                subtitle="Aggregate Revenue"
                icon={<DownloadIcon />}
                color="bg-emerald-600"
              />
            </>
          )}
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {division === 'CWHS' && <CWHSModule entries={currentFilteredData.cwhs} userRole={userRole!} lga={lgaContext!} db={dbRef.current} onShare={shareToWhatsApp} />}
        {division === 'CIM' && <CIMModule entries={currentFilteredData.cim} userRole={userRole!} lga={lgaContext!} db={dbRef.current} onShare={shareToWhatsApp} />}
        {division === 'SAED' && <SAEDModule entries={currentFilteredData.saed} userRole={userRole!} lga={lgaContext!} db={dbRef.current} onShare={shareToWhatsApp} />}
      </main>

      <footer className="p-8 text-center text-slate-500 no-print">
        <p className="text-xs font-black uppercase tracking-[0.5em]">Division Data Management System • NYSC Katsina State Command</p>
      </footer>
    </div>
  );
};

const SummaryCard = ({ title, value, subtitle, icon, color }: any) => (
  <div className={`p-6 rounded-[2rem] text-white shadow-xl ${color} flex flex-col justify-between h-full`}>
    <div className="flex justify-between items-start">
      <div className="p-3 bg-white/30 rounded-xl">{icon}</div>
      <span className="text-xs font-black uppercase tracking-widest opacity-90">Status Dashboard</span>
    </div>
    <div className="mt-8">
      <h3 className="text-xs font-black uppercase tracking-widest opacity-90 mb-1">{title}</h3>
      <div className="text-4xl font-black tracking-tighter">{value}</div>
      <p className="text-xs font-bold opacity-80 uppercase tracking-widest mt-2">{subtitle}</p>
    </div>
  </div>
);

const SelectionToolbar = ({ count, total, onClear, onSelectAll, colorClass = "bg-emerald-100 text-emerald-900" }: any) => (
  <div className={`${colorClass} border border-emerald-200 p-3 rounded-2xl flex justify-between items-center no-print animate-fade-in shadow-sm`}>
    <div className="flex items-center gap-4">
      <span className="text-xs font-black uppercase tracking-widest ml-2">{count} Records Selected</span>
      <div className="h-4 w-px bg-current opacity-20"></div>
      <button onClick={onSelectAll} className="text-xs font-black uppercase hover:underline">Select All in View ({total})</button>
    </div>
    <button onClick={onClear} className="text-xs font-black uppercase hover:underline opacity-80">Clear Selection</button>
  </div>
);

const CWHSModule = ({ entries, userRole, lga, db, onShare }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });
  const { selectedIds, toggleSelect, clearSelection, selectAll } = useMultiSelect(entries);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await addData(db, "nysc_reports", { ...formData, lga: lga || 'Daura' });
      setFormData({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });
    } catch (err) { alert("Submission failed"); }
  };

  const shareIndividual = (e: any) => {
    let text = `*NYSC ${e.lga} STATION - CW&HS REPORT*\n`;
    text += `*NAME:* ${e.name.toUpperCase()}\n`;
    text += `*CODE:* ${e.stateCode}\n`;
    text += `*STATUS:* ${e.category.toUpperCase()}\n`;
    if (e.category === ReportCategory.DECEASED && e.dateOfDeath) text += `*DATE OF DEATH:* ${e.dateOfDeath}\n`;
    text += `*DETAILS:* ${e.details || 'N/A'}\n`;
    onShare(text);
  };

  const handleShareList = () => {
    const itemsToShare = selectedIds.size > 0 ? entries.filter((e: any) => selectedIds.has(e.id)) : entries;
    if (itemsToShare.length === 0) return;
    let text = `*NYSC ${userRole === 'ZI' ? 'ZONAL HQ' : lga} - CW&HS SUMMARY*\nDate: ${new Date().toLocaleDateString()}\n\n`;
    itemsToShare.forEach((e: any, i: number) => {
      text += `${i + 1}. ${e.name.toUpperCase()} (${e.stateCode}) - ${e.category.toUpperCase()}\n`;
      if (e.category === ReportCategory.DECEASED && e.dateOfDeath) text += `   [✝️ DOD: ${e.dateOfDeath}]\n`;
    });
    onShare(text);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Corps Welfare & Health Service</h2>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Incident Tracking Module</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 hover:bg-slate-900 transition-all font-black uppercase text-xs tracking-widest">
            <FileTextIcon /> PDF Report
          </button>
          <button onClick={() => exportToCSV(`CWHS_Export_${new Date().toISOString()}`, entries)} className="bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl flex items-center gap-2 hover:bg-slate-300 transition-all font-black uppercase text-xs tracking-widest">
            <DownloadIcon /> CSV
          </button>
          <button onClick={handleShareList} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 hover:bg-emerald-700 transition-all font-black uppercase text-xs tracking-widest">
            <WhatsAppIcon /> {selectedIds.size > 0 ? `Share Selected (${selectedIds.size})` : 'Share Full View'}
          </button>
        </div>
      </div>

      {entries.length > 0 && (
        <SelectionToolbar count={selectedIds.size} total={entries.length} onClear={clearSelection} onSelectAll={selectAll} colorClass="bg-blue-100 text-blue-900 border-blue-200" />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 no-print">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm sticky top-32">
            <h3 className="font-black uppercase mb-8 text-xs text-slate-800 border-b pb-4">Record New Welfare Case</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-600 ml-1">Full Name</label>
                <input required placeholder="E.G. JOHN DOE" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-600 ml-1">State Code</label>
                <input required placeholder="E.G. KT/24A/0001" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-600 ml-1">Status Category</label>
                <select className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as any})}>
                  {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {formData.category === ReportCategory.DECEASED && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-black uppercase text-red-600 ml-1">Date of Death</label>
                  <input type="date" required className="w-full p-4 bg-red-50 rounded-2xl font-bold outline-none border-2 border-red-200" value={formData.dateOfDeath} onChange={e => setFormData({...formData, dateOfDeath: e.target.value})} />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-600 ml-1">Specific Details</label>
                <textarea placeholder="PROVIDE CASE PARTICULARS..." className="w-full p-4 bg-slate-50 rounded-2xl h-32 font-medium outline-none focus:ring-2 focus:ring-emerald-500 border border-slate-200" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
              </div>
              <button className="w-full bg-emerald-800 text-white p-5 rounded-2xl font-black uppercase shadow-lg shadow-emerald-800/20 active:scale-95 transition-all">Submit Welfare Record</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {entries.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-1">
              {entries.map((e: any) => (
                <div 
                  key={e.id} 
                  onClick={() => toggleSelect(e.id)}
                  className={`bg-white p-8 rounded-[2rem] border-2 shadow-sm flex flex-col justify-between group cursor-pointer transition-all ${selectedIds.has(e.id) ? 'border-emerald-500 bg-emerald-50/10' : 'border-transparent hover:border-slate-300'} print:border-slate-300 print:shadow-none print:break-inside-avoid print:mb-4`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-2">
                        <span className={`text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${e.category === ReportCategory.SICK ? 'bg-blue-100 text-blue-800' : e.category === ReportCategory.DECEASED ? 'bg-slate-200 text-slate-900 border border-slate-300' : 'bg-red-100 text-red-800'}`}>{e.category}</span>
                        {e.category === ReportCategory.DECEASED && e.dateOfDeath && (
                           <span className="text-xs font-black text-red-700 uppercase tracking-tighter">✝️ DOD: {e.dateOfDeath}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{e.lga}</span>
                        <input type="checkbox" checked={selectedIds.has(e.id)} className="w-4 h-4 rounded-full border-2 border-emerald-500 text-emerald-500 focus:ring-0 no-print" readOnly />
                      </div>
                    </div>
                    <h4 className="font-black text-xl uppercase leading-tight text-slate-900 mb-1">{e.name}</h4>
                    <p className="text-sm text-slate-600 font-bold tracking-widest">{e.stateCode}</p>
                    <p className="mt-6 text-sm text-slate-700 italic leading-relaxed">"{e.details}"</p>
                  </div>
                  <div className="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center no-print" onClick={ev => ev.stopPropagation()}>
                    <span className="text-xs font-bold text-slate-500">{new Date(e.dateAdded).toLocaleDateString()}</span>
                    <div className="flex gap-2">
                      <button onClick={() => shareIndividual(e)} className="p-2 text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-all"><WhatsAppIcon /></button>
                      <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><TrashIcon /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
              <div className="p-6 bg-slate-50 rounded-full mb-6 text-slate-300"><DashboardIcon /></div>
              <h4 className="text-lg font-black text-slate-600 uppercase tracking-[0.2em]">No Records Found</h4>
              <p className="text-sm text-slate-500 mt-2">All systems clear for this station</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const CIMModule = ({ entries, userRole, lga, db, onShare }: any) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
  const { selectedIds, toggleSelect, clearSelection, selectAll } = useMultiSelect(entries);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    const unclearedList = formData.uncleared.split('\n').map(line => {
      const parts = line.split(',').map(p => p.trim());
      return { name: parts[0] || '', code: parts[1] || '', reason: parts[2] || 'Absent' };
    }).filter(x => x.name);
    try {
      await addData(db, "cim_clearance", { month: formData.month, maleCount: Number(formData.maleCount), femaleCount: Number(formData.femaleCount), clearedCount: Number(formData.clearedCount), unclearedList, lga: lga || 'Daura' });
      setFormData({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });
    } catch (err) { alert("Submission failed"); }
  };

  const shareIndividual = (e: any) => {
    let text = `*NYSC ${e.lga} CIM AUDIT*\n`;
    text += `*MONTH:* ${new Date(e.month).toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()}\n`;
    text += `*CLEARED:* ${e.clearedCount} of ${e.maleCount + e.femaleCount}\n`;
    if (e.unclearedList?.length) text += `*FLAGGED:* ${e.unclearedList.length} Personnel\n`;
    onShare(text);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Corps Inspection & Monitoring</h2>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Clearance Management</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 hover:bg-slate-900 transition-all font-black uppercase text-xs tracking-widest"><FileTextIcon /> PDF</button>
          <button onClick={() => exportToCSV(`CIM_Audit_${new Date().toISOString()}`, entries)} className="bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl flex items-center gap-2 hover:bg-slate-300 transition-all font-black uppercase text-xs tracking-widest"><DownloadIcon /> CSV</button>
          <button onClick={() => onShare(`*NYSC CIM REPORT*\nTotal Logs: ${entries.length}`)} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 hover:bg-emerald-700 transition-all font-black uppercase text-xs tracking-widest"><WhatsAppIcon /> Share Summary</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 no-print">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm sticky top-32">
            <h3 className="font-black uppercase mb-6 text-xs text-slate-800 border-b pb-4">Submit Audit Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="month" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold border border-slate-200" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" required placeholder="Male" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border border-slate-200" value={formData.maleCount} onChange={e => setFormData({...formData, maleCount: Number(e.target.value)})} />
                <input type="number" required placeholder="Female" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border border-slate-200" value={formData.femaleCount} onChange={e => setFormData({...formData, femaleCount: Number(e.target.value)})} />
              </div>
              <input type="number" required placeholder="Cleared" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border border-slate-200" value={formData.clearedCount} onChange={e => setFormData({...formData, clearedCount: Number(e.target.value)})} />
              <textarea placeholder="Uncleared List: Name, Code, Reason" className="w-full p-4 bg-slate-50 rounded-2xl h-32 text-xs border border-slate-200" value={formData.uncleared} onChange={e => setFormData({...formData, uncleared: e.target.value})} />
              <button className="w-full bg-emerald-800 text-white p-5 rounded-2xl font-black uppercase">Finalize Submission</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-6">
          {entries.length > 0 ? entries.map((e: any) => (
            <div key={e.id} className="bg-white p-8 rounded-[2.5rem] border-2 shadow-sm border-l-amber-500 hover:border-slate-300 transition-all">
              <div className="flex justify-between items-start mb-4">
                <h4 className="font-black text-xl uppercase text-slate-900">{new Date(e.month).toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
                <div className="flex gap-2 no-print">
                  <button onClick={() => shareIndividual(e)} className="p-2 text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-all"><WhatsAppIcon /></button>
                  <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><TrashIcon /></button>
                </div>
              </div>
              <p className="text-xs text-slate-600 font-bold uppercase mb-4 tracking-widest">{e.lga} STATION LOG</p>
              <div className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100">
                <div className="flex justify-between text-xs font-black uppercase mb-2">
                  <span className="text-slate-700">Cleared Success Rate</span>
                  <span className="text-emerald-700">{Math.round((e.clearedCount / (e.maleCount + e.femaleCount)) * 100)}% ({e.clearedCount} CMs)</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(e.clearedCount / (e.maleCount + e.femaleCount)) * 100}%` }}></div>
                </div>
              </div>
              {e.unclearedList?.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-xs font-black text-red-700 uppercase">Flags ({e.unclearedList.length}):</h5>
                  {e.unclearedList.map((cm: any, idx: number) => (
                    <div key={idx} className="text-xs p-2 bg-red-50 rounded-lg border border-red-200 flex justify-between shadow-sm">
                      <span className="font-black text-red-900">{cm.name} ({cm.code})</span>
                      <span className="italic text-slate-600">{cm.reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )) : (
            <div className="bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-200 text-center text-slate-500 font-bold uppercase">No Audit History Found</div>
          )}
        </div>
      </div>
    </div>
  );
};

const SAEDModule = ({ entries, userRole, lga, db, onShare }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  const { selectedIds, toggleSelect, clearSelection, selectAll } = useMultiSelect(entries);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await addData(db, "saed_centers", { ...formData, lga: lga || 'Daura' });
      setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 });
    } catch (err) { alert("Registration failed"); }
  };

  const shareIndividual = (e: any) => {
    let text = `*NYSC ${e.lga} SAED REGISTRY*\n`;
    text += `*CENTER:* ${e.centerName.toUpperCase()}\n`;
    text += `*TRAINEES:* ${e.cmCount}\n`;
    text += `*FEE:* ₦${e.fee.toLocaleString()}\n`;
    text += `*LOCATION:* ${e.address}\n`;
    onShare(text);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">SAED Training Registry</h2>
          <p className="text-sm text-slate-500 font-bold uppercase tracking-widest">Skill Acquisition Hubs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 hover:bg-slate-900 transition-all font-black uppercase text-xs tracking-widest"><FileTextIcon /> PDF Registry</button>
          <button onClick={() => exportToCSV(`SAED_Registry_${new Date().toISOString()}`, entries)} className="bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl flex items-center gap-2 hover:bg-slate-300 transition-all font-black uppercase text-xs tracking-widest"><DownloadIcon /> CSV</button>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 no-print">
          <div className="bg-white p-8 rounded-[2.5rem] border shadow-sm sticky top-32">
            <h3 className="font-black uppercase mb-8 text-xs text-slate-800 border-b pb-4">Register New Center</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input required placeholder="Center Name" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase border border-slate-200" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value})} />
              <input required placeholder="Physical Address" className="w-full p-4 bg-slate-50 rounded-2xl font-bold uppercase border border-slate-200" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" required placeholder="Trainees" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border border-slate-200" value={formData.cmCount} onChange={e => setFormData({...formData, cmCount: Number(e.target.value)})} />
                <input type="number" required placeholder="Fee (₦)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold border border-slate-200" value={formData.fee} onChange={e => setFormData({...formData, fee: Number(e.target.value)})} />
              </div>
              <button className="w-full bg-emerald-800 text-white p-5 rounded-2xl font-black uppercase">Confirm Registration</button>
            </form>
          </div>
        </div>
        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-1">
            {entries.length > 0 ? entries.map((c: any) => (
              <div key={c.id} className="bg-white p-8 rounded-[2.5rem] border-2 shadow-sm border-l-purple-600 hover:border-slate-300 transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h4 className="font-black text-xl uppercase tracking-tight text-slate-900 leading-none mb-2">{c.centerName}</h4>
                    <p className="text-xs font-black text-purple-700 uppercase tracking-widest">{c.lga} STATION</p>
                  </div>
                  <div className="flex gap-2 no-print">
                    <button onClick={() => shareIndividual(c)} className="p-2 text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 transition-all"><WhatsAppIcon /></button>
                    <button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><TrashIcon /></button>
                  </div>
                </div>
                <p className="text-sm text-slate-600 italic mb-4">{c.address}</p>
                <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-700">{c.cmCount}</div>
                    <span className="text-xs font-black uppercase text-slate-600 tracking-widest">Enrolled</span>
                  </div>
                  <div className="bg-purple-100 text-purple-900 px-4 py-2 rounded-2xl text-xs font-black border border-purple-200">₦{c.fee.toLocaleString()}</div>
                </div>
              </div>
            )) : (
              <div className="col-span-full bg-white p-20 rounded-[3rem] border-2 border-dashed border-slate-200 text-center text-slate-500 font-bold uppercase">No Skill Centers Registered</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
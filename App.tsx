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
  // Clean internal fields
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

  // --- Filtering Logic for Summary ---
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
          {userRole === 'ZI' && (
            <div className="mr-4">
               <select 
                className="bg-slate-800 border-none rounded-xl px-4 py-2 text-[10px] font-black uppercase text-emerald-400 outline-none focus:ring-2 focus:ring-emerald-500"
                value={ziStationFilter}
                onChange={(e) => setZiStationFilter(e.target.value)}
              >
                <option value="all">Global View (All LGAs)</option>
                {LGAS.map(l => <option key={l} value={l}>{l.toUpperCase()} STATION</option>)}
              </select>
            </div>
          )}
          <div className="hidden md:flex flex-col items-end mr-4">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">{userRole} AUTHENTICATED</span>
            <span className="text-[10px] text-white/50 font-bold">{new Date().toLocaleDateString()}</span>
          </div>
          <button onClick={handleLogout} className="p-3 bg-white/10 rounded-xl hover:bg-red-500/20 transition-all"><LogOutIcon /></button>
        </div>
      </header>

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
            subtitle="Across All Modules"
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
                subtitle="Zonal Clearance Average"
                icon={<FileTextIcon />}
                color="bg-emerald-600"
              />
              <SummaryCard 
                title="Audit Logs" 
                value={currentFilteredData.cim.length}
                subtitle="Total Monthly Submissions"
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
                subtitle="Aggregate Training Revenue"
                icon={<DownloadIcon />}
                color="bg-emerald-600"
              />
            </>
          )}
        </div>
      </section>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8 space-y-8">
        {division === 'CWHS' && <CWHSModule entries={cwhsEntries} userRole={userRole!} lga={lgaContext!} ziFilter={ziStationFilter} db={dbRef.current} onShare={shareToWhatsApp} />}
        {division === 'CIM' && <CIMModule entries={cimEntries} userRole={userRole!} lga={lgaContext!} ziFilter={ziStationFilter} db={dbRef.current} onShare={shareToWhatsApp} />}
        {division === 'SAED' && <SAEDModule entries={saedEntries} userRole={userRole!} lga={lgaContext!} ziFilter={ziStationFilter} db={dbRef.current} onShare={shareToWhatsApp} />}
      </main>

      <footer className="p-8 text-center text-slate-300 no-print">
        <p className="text-[9px] font-black uppercase tracking-[0.5em]">Division Data Management System • NYSC Katsina State</p>
      </footer>
    </div>
  );
};

const SummaryCard = ({ title, value, subtitle, icon, color }: any) => (
  <div className={`p-6 rounded-[2rem] text-white shadow-xl ${color} flex flex-col justify-between h-full`}>
    <div className="flex justify-between items-start">
      <div className="p-3 bg-white/20 rounded-xl">{icon}</div>
      <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Report View</span>
    </div>
    <div className="mt-8">
      <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-1">{title}</h3>
      <div className="text-3xl font-black tracking-tighter">{value}</div>
      <p className="text-[9px] font-bold opacity-50 uppercase tracking-widest mt-2">{subtitle}</p>
    </div>
  </div>
);

// --- Multi-select logic ---
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

const CWHSModule = ({ entries, userRole, lga, ziFilter, db, onShare }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });
  
  const filtered = useMemo(() => {
    let base = entries;
    if (userRole === 'LGI') base = base.filter((e: any) => e.lga === lga);
    else if (ziFilter !== 'all') base = base.filter((e: any) => e.lga === ziFilter);
    return base;
  }, [entries, userRole, lga, ziFilter]);

  const { selectedIds, toggleSelect, clearSelection } = useMultiSelect(filtered);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await addData(db, "nysc_reports", { ...formData, lga: lga || 'Daura' });
      setFormData({ name: '', stateCode: '', category: ReportCategory.SICK, details: '', dateOfDeath: '' });
    } catch (err) { alert("Submission failed"); }
  };

  const handleShare = () => {
    const itemsToShare = selectedIds.size > 0 
      ? filtered.filter((e: any) => selectedIds.has(e.id))
      : filtered;

    if (itemsToShare.length === 0) return;

    let text = `*NYSC ${userRole === 'ZI' ? 'ZONAL HQ' : lga} - CW&HS REPORT*\n`;
    text += `Date: ${new Date().toLocaleDateString()}\n\n`;
    
    itemsToShare.forEach((e: any, i: number) => {
      text += `${i + 1}. *${e.name.toUpperCase()}* (${e.stateCode})\n`;
      text += `🚨 Status: ${e.category}\n`;
      if (e.category === ReportCategory.DECEASED && e.dateOfDeath) {
        text += `✝️ Date of Death: ${e.dateOfDeath}\n`;
      }
      text += `📝 Details: ${e.details || 'N/A'}\n`;
      if (userRole === 'ZI') text += `📍 Station: ${e.lga}\n`;
      text += `------------------\n`;
    });
    onShare(text);
  };

  const handleExportCSV = () => {
    const items = selectedIds.size > 0 ? filtered.filter((e: any) => selectedIds.has(e.id)) : filtered;
    exportToCSV(`CWHS_Report_${new Date().toISOString().split('T')[0]}`, items);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Corps Welfare & Health Service</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Personnel Status Tracking</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <button onClick={handlePrint} className="bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 hover:bg-slate-900 transition-all font-black uppercase text-[9px] tracking-widest">
            <FileTextIcon /> PDF Report
          </button>
          <button onClick={handleExportCSV} className="bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl flex items-center gap-2 hover:bg-slate-300 transition-all font-black uppercase text-[9px] tracking-widest">
            <DownloadIcon /> CSV
          </button>
          <button onClick={handleShare} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 hover:bg-emerald-700 transition-all font-black uppercase text-[9px] tracking-widest">
            <WhatsAppIcon /> {selectedIds.size > 0 ? `Share (${selectedIds.size})` : 'Share All'}
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-2xl flex justify-between items-center no-print">
          <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest ml-2">{selectedIds.size} Records Selected</span>
          <button onClick={clearSelection} className="text-[10px] font-black text-emerald-600 uppercase hover:underline">Clear Selection</button>
        </div>
      )}

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
              {formData.category === ReportCategory.DECEASED && (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-[10px] font-black uppercase text-red-600 ml-1">Date of Death</label>
                  <input type="date" required className="w-full p-4 bg-red-50 rounded-2xl font-bold outline-none border-2 border-red-100" value={formData.dateOfDeath} onChange={e => setFormData({...formData, dateOfDeath: e.target.value})} />
                </div>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-1">
              {filtered.map((e: any) => (
                <div 
                  key={e.id} 
                  onClick={() => toggleSelect(e.id)}
                  className={`bg-white p-8 rounded-[2rem] border-2 shadow-sm flex flex-col justify-between group cursor-pointer transition-all ${selectedIds.has(e.id) ? 'border-emerald-500 bg-emerald-50/10' : 'border-transparent hover:border-slate-200'} print:border-slate-200 print:shadow-none print:break-inside-avoid print:mb-4`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-2">
                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest ${e.category === ReportCategory.SICK ? 'bg-blue-50 text-blue-700' : e.category === ReportCategory.DECEASED ? 'bg-slate-100 text-slate-800 border' : 'bg-red-50 text-red-700'}`}>{e.category}</span>
                        {e.category === ReportCategory.DECEASED && e.dateOfDeath && (
                           <span className="text-[8px] font-black text-red-600 uppercase tracking-tighter">✝️ Date: {e.dateOfDeath}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{e.lga}</span>
                        <input type="checkbox" checked={selectedIds.has(e.id)} className="w-4 h-4 rounded-full border-2 border-emerald-500 text-emerald-500 focus:ring-0 no-print" readOnly />
                      </div>
                    </div>
                    <h4 className="font-black text-xl uppercase leading-tight text-slate-800 mb-1">{e.name}</h4>
                    <p className="text-xs text-slate-400 font-bold tracking-widest">{e.stateCode}</p>
                    <p className="mt-6 text-sm text-slate-500 italic leading-relaxed">"{e.details}"</p>
                  </div>
                  <div className="mt-8 pt-4 border-t flex justify-between items-center" onClick={e => e.stopPropagation()}>
                    <span className="text-[9px] font-bold text-slate-300">{new Date(e.dateAdded).toLocaleDateString()}</span>
                    <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="text-slate-200 hover:text-red-500 transition-colors no-print"><TrashIcon /></button>
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

const CIMModule = ({ entries, userRole, lga, ziFilter, db, onShare }: any) => {
  const [formData, setFormData] = useState({ month: '', maleCount: 0, femaleCount: 0, clearedCount: 0, uncleared: '' });

  const filtered = useMemo(() => {
    let base = entries;
    if (userRole === 'LGI') base = base.filter((e: any) => e.lga === lga);
    else if (ziFilter !== 'all') base = base.filter((e: any) => e.lga === ziFilter);
    return base;
  }, [entries, userRole, lga, ziFilter]);

  const { selectedIds, toggleSelect, clearSelection } = useMultiSelect(filtered);

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

  const handleShare = () => {
    const itemsToShare = selectedIds.size > 0 
      ? filtered.filter((e: any) => selectedIds.has(e.id))
      : filtered;

    if (itemsToShare.length === 0) return;

    let text = `*NYSC ${userRole === 'ZI' ? 'ZONAL HQ' : lga} - CIM AUDIT LOG*\n\n`;

    itemsToShare.forEach((latest: any) => {
      text += `📅 *MONTH:* ${new Date(latest.month).toLocaleString('default', { month: 'long', year: 'numeric' }).toUpperCase()}\n`;
      text += `📍 Station: ${latest.lga}\n`;
      text += `✅ Cleared: ${latest.clearedCount} (${Math.round((latest.clearedCount / (latest.maleCount + latest.femaleCount)) * 100)}%)\n`;
      if (latest.unclearedList?.length > 0) {
        text += `🚩 Flags: ${latest.unclearedList.length} Personnel\n`;
      }
      text += `\n`;
    });
    onShare(text);
  };

  const handleExportCSV = () => {
    const items = selectedIds.size > 0 ? filtered.filter((e: any) => selectedIds.has(e.id)) : filtered;
    exportToCSV(`CIM_Audit_${new Date().toISOString().split('T')[0]}`, items);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">Corps Inspection & Monitoring</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Monthly Clearance Audit</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 hover:bg-slate-900 transition-all font-black uppercase text-[9px] tracking-widest">
            <FileTextIcon /> PDF Report
          </button>
          <button onClick={handleExportCSV} className="bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl flex items-center gap-2 hover:bg-slate-300 transition-all font-black uppercase text-[9px] tracking-widest">
            <DownloadIcon /> CSV
          </button>
          <button onClick={handleShare} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 hover:bg-emerald-700 transition-all font-black uppercase text-[9px] tracking-widest">
            <WhatsAppIcon /> {selectedIds.size > 0 ? `Share (${selectedIds.size})` : 'Share All'}
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-amber-50 border border-amber-100 p-3 rounded-2xl flex justify-between items-center no-print">
          <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest ml-2">{selectedIds.size} Audits Selected</span>
          <button onClick={clearSelection} className="text-[10px] font-black text-amber-600 uppercase hover:underline">Clear Selection</button>
        </div>
      )}

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
            <div 
              key={e.id} 
              onClick={() => toggleSelect(e.id)}
              className={`bg-white p-8 rounded-[2.5rem] border-2 shadow-sm border-l-[12px] cursor-pointer transition-all ${selectedIds.has(e.id) ? 'border-amber-500 bg-amber-50/10' : 'border-transparent border-l-amber-500 hover:border-slate-200'} print:border-slate-200 print:break-inside-avoid print:mb-4`}
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h4 className="font-black text-2xl text-slate-800 uppercase tracking-tighter">{new Date(e.month).toLocaleString('default', { month: 'long', year: 'numeric' })} Audit</h4>
                  <p className="text-[10px] font-black text-amber-600 tracking-widest uppercase">{e.lga} STATION AUDIT LOG</p>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="text-3xl font-black text-slate-900 leading-none">{e.maleCount + e.femaleCount}</div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Personnel</div>
                  </div>
                  <input type="checkbox" checked={selectedIds.has(e.id)} className="w-5 h-5 rounded border-2 border-amber-500 text-amber-500 focus:ring-0 no-print" readOnly />
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-3xl mb-8 border border-slate-100 print:bg-white print:border-slate-200">
                <div className="flex justify-between items-center text-[10px] font-black uppercase mb-4 tracking-widest">
                  <span className="text-slate-500">Monthly Success Rate</span>
                  <span className="text-emerald-600">{Math.round((e.clearedCount / (e.maleCount + e.femaleCount)) * 100)}% Cleared</span>
                </div>
                <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden shadow-inner no-print">
                  <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(e.clearedCount / (e.maleCount + e.femaleCount)) * 100}%` }}></div>
                </div>
              </div>

              {e.unclearedList?.length > 0 && (
                <div onClick={e => e.stopPropagation()}>
                  <h5 className="text-[10px] font-black text-red-600 uppercase mb-4 tracking-[0.2em]">Disciplinary Flag List ({e.unclearedList.length})</h5>
                  <div className="grid grid-cols-1 gap-3">
                    {e.unclearedList.map((cm: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-red-50/50 rounded-2xl border border-red-100 print:bg-white print:border-slate-200">
                        <div className="text-xs">
                          <span className="font-black text-red-900 block uppercase">{cm.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 tracking-widest">{cm.code}</span>
                        </div>
                        <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="text-slate-300 hover:text-red-500 transition-colors no-print"><TrashIcon /></button>
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

const SAEDModule = ({ entries, userRole, lga, ziFilter, db, onShare }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });

  const filtered = useMemo(() => {
    let base = entries;
    if (userRole === 'LGI') base = base.filter((e: any) => e.lga === lga);
    else if (ziFilter !== 'all') base = base.filter((e: any) => e.lga === ziFilter);
    return base;
  }, [entries, userRole, lga, ziFilter]);

  const { selectedIds, toggleSelect, clearSelection } = useMultiSelect(filtered);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      await addData(db, "saed_centers", { ...formData, lga: lga || 'Daura' });
      setFormData({ centerName: '', address: '', cmCount: 0, fee: 0 });
    } catch (err) { alert("Registration failed"); }
  };

  const handleShare = () => {
    const itemsToShare = selectedIds.size > 0 
      ? filtered.filter((e: any) => selectedIds.has(e.id))
      : filtered;

    if (itemsToShare.length === 0) return;

    let text = `*NYSC ${userRole === 'ZI' ? 'ZONAL HQ' : lga} - SAED REGISTRY*\n\n`;

    itemsToShare.forEach((c: any, i: number) => {
      text += `${i + 1}. *${c.centerName.toUpperCase()}*\n`;
      text += `📍 Location: ${c.address}\n`;
      text += `💰 Fee: ₦${c.fee.toLocaleString()}\n`;
      if (userRole === 'ZI') text += `🏘 Station: ${c.lga}\n`;
      text += `------------------\n`;
    });
    onShare(text);
  };

  const handleExportCSV = () => {
    const items = selectedIds.size > 0 ? filtered.filter((e: any) => selectedIds.has(e.id)) : filtered;
    exportToCSV(`SAED_Registry_${new Date().toISOString().split('T')[0]}`, items);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h2 className="text-2xl font-black uppercase text-slate-800 tracking-tighter">SAED Training Registry</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Post-Camp Skill Acquisition</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center gap-2 hover:bg-slate-900 transition-all font-black uppercase text-[9px] tracking-widest">
            <FileTextIcon /> PDF Report
          </button>
          <button onClick={handleExportCSV} className="bg-slate-200 text-slate-700 px-4 py-3 rounded-2xl flex items-center gap-2 hover:bg-slate-300 transition-all font-black uppercase text-[9px] tracking-widest">
            <DownloadIcon /> CSV
          </button>
          <button onClick={handleShare} className="bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center gap-2 hover:bg-emerald-700 transition-all font-black uppercase text-[9px] tracking-widest">
            <WhatsAppIcon /> {selectedIds.size > 0 ? `Share (${selectedIds.size})` : 'Share All'}
          </button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-purple-50 border border-purple-100 p-3 rounded-2xl flex justify-between items-center no-print">
          <span className="text-[10px] font-black text-purple-800 uppercase tracking-widest ml-2">{selectedIds.size} Centers Selected</span>
          <button onClick={clearSelection} className="text-[10px] font-black text-purple-600 uppercase hover:underline">Clear Selection</button>
        </div>
      )}
      
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-1">
              {filtered.map((c: any) => (
                <div 
                  key={c.id} 
                  onClick={() => toggleSelect(c.id)}
                  className={`bg-white p-8 rounded-[2.5rem] border-2 shadow-sm border-l-[15px] cursor-pointer relative overflow-hidden group transition-all ${selectedIds.has(c.id) ? 'border-purple-600 bg-purple-50/10' : 'border-transparent border-l-purple-600 hover:border-slate-200'} print:border-slate-200 print:shadow-none print:break-inside-avoid print:mb-4`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="font-black text-xl uppercase tracking-tight text-slate-800 leading-none mb-2">{c.centerName}</h4>
                      <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">{c.lga} STATION REGISTRY</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-2xl text-[10px] font-black border border-purple-100">₦{c.fee.toLocaleString()}</div>
                      <input type="checkbox" checked={selectedIds.has(c.id)} className="w-5 h-5 rounded-full border-2 border-purple-600 text-purple-600 focus:ring-0 no-print" readOnly />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500 flex items-start gap-2 italic leading-relaxed">
                      <SearchIcon /> {c.address}
                    </p>
                    <div className="flex justify-between items-center pt-6 border-t" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-xs font-black text-slate-400">{c.cmCount}</div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Trainees</span>
                      </div>
                      <button onClick={() => deleteData(db, "saed_centers", c.id)} className="p-3 bg-slate-50 text-slate-300 rounded-xl hover:bg-red-50 hover:text-red-500 transition-all no-print"><TrashIcon /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-32 rounded-[3rem] border-2 border-dashed border-slate-100 text-center">
              <h4 className="text-lg font-black text-slate-300 uppercase tracking-widest">No SAED Centers Registered</h4>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;

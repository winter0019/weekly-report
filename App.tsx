import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ReportCategory, 
  CorpsMemberEntry, 
  DauraLga,
  UserRole,
  Division,
  CIMClearance,
  SAEDCenter,
  CDRCase,
  CDRStatus,
  CDSGroup,
  CDSPersonalProject,
  CIMBatchDisposition,
  StationDisposition
} from './types';
import { 
  WhatsAppIcon, 
  LogOutIcon, 
  TrashIcon, 
  FileTextIcon, 
  SearchIcon, 
  DashboardIcon, 
  DownloadIcon, 
  ShareIcon, 
  SpreadsheetIcon, 
  PlusIcon 
} from './components/Icons';
import { initFirebase, subscribeToCollection, addData, updateData, deleteData } from './services/firebaseService';
import { generateDisciplinaryQuery } from './services/geminiService';
import { generateOfficialPDF } from './services/pdfService';
import { downloadCSV, shareData } from './services/exportService';

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

const DIVISION_LABELS: Record<Division, string> = {
  'CWHS': 'CW&HS', 'CIM': 'CIM', 'CDR': 'CD&R', 'CDS': 'CDS', 'SAED': 'SAED'
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => window.localStorage.getItem('daura_auth') === 'true');
  const [userRole, setUserRole] = useState<UserRole | null>(() => window.localStorage.getItem('daura_role') as UserRole);
  const [lgaContext, setLgaContext] = useState<DauraLga | null>(() => window.localStorage.getItem('daura_lga') as DauraLga);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [division, setDivision] = useState<Division>('CIM');
  const [cwhsEntries, setCwhsEntries] = useState<CorpsMemberEntry[]>([]);
  const [cimEntries, setCimEntries] = useState<CIMClearance[]>([]);
  const [saedEntries, setSAEDEntries] = useState<SAEDCenter[]>([]);
  const [cdrEntries, setCdrEntries] = useState<CDRCase[]>([]);
  const [cdsGroups, setCdsGroups] = useState<CDSGroup[]>([]);
  const [cdsProjects, setCdsProjects] = useState<CDSPersonalProject[]>([]);
  const [stationDispositions, setStationDispositions] = useState<StationDisposition[]>([]);
  
  const dbRef = useRef<any>(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [pin, setPin] = useState('');
  const [pendingLogin, setPendingLogin] = useState<any>(null);

  useEffect(() => {
    if (isAuthenticated) {
      let active = true;
      const unsubs: (() => void)[] = [];
      const startServices = async () => {
        try {
          const db = initFirebase(firebaseConfig);
          dbRef.current = db;
          if (db) {
            unsubs.push(subscribeToCollection(db, "nysc_reports", (data) => active && setCwhsEntries(data)));
            unsubs.push(subscribeToCollection(db, "cim_clearance", (data) => active && setCimEntries(data)));
            unsubs.push(subscribeToCollection(db, "saed_centers", (data) => active && setSAEDEntries(data)));
            unsubs.push(subscribeToCollection(db, "cdr_cases", (data) => active && setCdrEntries(data)));
            unsubs.push(subscribeToCollection(db, "cds_groups", (data) => active && setCdsGroups(data)));
            unsubs.push(subscribeToCollection(db, "cds_projects", (data) => active && setCdsProjects(data)));
            unsubs.push(subscribeToCollection(db, "station_disposition", (data) => active && setStationDispositions(data)));
            setTimeout(() => { if (active) setIsDbLoaded(true); }, 500);
          }
        } catch (err) { console.error(err); if (active) setIsDbLoaded(true); }
      };
      startServices();
      return () => { active = false; unsubs.forEach(u => u()); };
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    window.localStorage.clear();
    window.location.reload();
  };

  const filteredData = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filterFn = (items: any[]) => {
      let filtered = items;
      if (userRole === 'LGI') filtered = filtered.filter(i => i.lga === lgaContext);
      return filtered.filter(item => {
        if (!q) return true;
        return [item.name, item.cmName, item.groupName, item.projectName, item.stateCode, item.lga, (item as any).ppa]
          .some(s => String(s || '').toLowerCase().includes(q));
      });
    };
    return {
      cwhs: filterFn(cwhsEntries),
      cim: filterFn(cimEntries),
      saed: filterFn(saedEntries),
      cdr: filterFn(cdrEntries),
      cdsGroups: filterFn(cdsGroups),
      cdsProjects: filterFn(cdsProjects)
    };
  }, [cwhsEntries, cimEntries, saedEntries, cdrEntries, cdsGroups, cdsProjects, userRole, lgaContext, searchQuery]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-950 via-slate-900 to-black">
        <form onSubmit={(e) => {
          e.preventDefault();
          const target = pendingLogin?.role === 'ZI' ? 'ZI' : pendingLogin?.lga;
          if (target && pin === SECURITY_PINS[target]) {
            setIsAuthenticated(true);
            setUserRole(pendingLogin.role);
            setLgaContext(pendingLogin.lga);
            window.localStorage.setItem('daura_auth', 'true');
            window.localStorage.setItem('daura_role', pendingLogin.role);
            if (pendingLogin.lga) window.localStorage.setItem('daura_lga', pendingLogin.lga);
          } else { window.alert("PIN Rejected."); }
        }} className="bg-white p-5 rounded-lg shadow-xl w-full max-w-xs space-y-4 animate-official">
          <div className="text-center">
            <div className="w-10 h-10 bg-[#004d40] rounded-md mx-auto mb-2 flex items-center justify-center text-white font-serif-heading text-lg font-black">NYSC</div>
            <h1 className="text-sm font-bold text-slate-800 uppercase tracking-tight">Access Terminal</h1>
          </div>
          <div className="space-y-2">
            <select required className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-[11px] font-semibold text-slate-700 outline-none" onChange={e => {
                const val = e.target.value;
                setPendingLogin({ role: val === 'ZI' ? 'ZI' : 'LGI', lga: val === 'ZI' ? null : val });
              }}>
                <option value="">Select Station...</option>
                <option value="ZI">Zonal Inspectorate</option>
                {LGAS.map(l => <option key={l} value={l}>{l} Command</option>)}
            </select>
            <input type="password" required placeholder="Security PIN" className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-center text-lg font-black tracking-[0.4em] outline-none" value={pin} onChange={e => setPin(e.target.value)} />
          </div>
          <button className="w-full bg-[#004d40] text-white p-2.5 rounded font-bold uppercase tracking-wider text-[10px]">Verify</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-6">
      <nav className="fixed top-0 left-0 right-0 z-[100] glass-nav flex justify-center no-print px-4 items-center">
        <div className="flex bg-slate-100 p-0.5 rounded border border-slate-200">
          {(Object.keys(DIVISION_LABELS) as Division[]).map(id => (
            <button key={id} onClick={() => setDivision(id)} className={`px-4 py-1 rounded transition-all font-bold uppercase text-[9px] tracking-wider ${division === id ? 'bg-[#004d40] text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}>{DIVISION_LABELS[id]}</button>
          ))}
        </div>
      </nav>

      <div className="pt-14 px-4 sm:px-6 max-w-[1100px] mx-auto w-full">
        <header className="bg-[#004d40] text-white p-4 shadow-xl rounded-xl flex items-center justify-between no-print gap-4 mb-5 animate-official">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center border border-white/10 shadow-inner"><DashboardIcon /></div>
            <div>
              <h1 className="text-[14px] font-black uppercase tracking-tight font-serif-heading">NYSC DAURA COMMAND</h1>
              <p className="text-[8px] font-bold text-emerald-300 tracking-[0.2em] uppercase opacity-60">Secretariat Portal Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://docs.google.com/forms/d/e/1FAIpQLSfD_u7M-Placeholder-Link" target="_blank" rel="noopener noreferrer" className="bg-emerald-500/20 hover:bg-emerald-500/40 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border border-white/10 transition-colors flex items-center gap-1 shadow-sm">
              <PlusIcon /> Google Form
            </a>
            <div className="bg-black/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10">
              {userRole === 'LGI' ? `${lgaContext} UNIT` : 'ZONAL HQ'}
            </div>
            <button onClick={handleLogout} className="w-9 h-9 bg-red-600/10 hover:bg-red-600 rounded-xl transition-all flex items-center justify-center border border-red-600/20 group">
              <div className="group-hover:text-white"><LogOutIcon /></div>
            </button>
          </div>
        </header>

        <div className="mb-6 flex justify-center no-print">
          <div className="bg-white p-1 rounded-2xl shadow-sm w-full max-w-md border border-slate-200 flex items-center group focus-within:ring-2 focus-within:ring-[#004d40]/10 transition-all">
            <div className="ml-4 mr-3 text-slate-300 scale-90"><SearchIcon /></div>
            <input type="text" placeholder="Quick find personnel or station..." className="bg-transparent p-2.5 text-[12px] w-full outline-none font-medium text-slate-600" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <main className="flex flex-col gap-6">
          {!isDbLoaded ? (
            <div className="w-full flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-8 h-8 border-[3px] border-slate-200 border-t-[#004d40] rounded-full animate-spin"></div>
              <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-[10px]">Syncing Portal Data...</p>
            </div>
          ) : (
            <>
              {division === 'CWHS' && <CWHSModule entries={filteredData.cwhs} lga={lgaContext!} db={dbRef.current} />}
              {division === 'CIM' && (
                <CIMModule 
                  entries={filteredData.cim} 
                  lga={lgaContext!} 
                  db={dbRef.current} 
                  userRole={userRole} 
                  stationDispositions={stationDispositions} 
                />
              )}
              {division === 'CDR' && <CDRModule entries={filteredData.cdr} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
              {division === 'CDS' && <CDSModule groups={filteredData.cdsGroups} projects={filteredData.cdsProjects} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
              {division === 'SAED' && <SAEDModule entries={filteredData.saed} lga={lgaContext!} db={dbRef.current} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

/* --- CIM Module --- */
const CIMModule = ({ entries, db, lga, userRole, stationDispositions }: any) => {
  const [formData, setFormData] = useState({ month: '' });
  const [clearedBatches, setClearedBatches] = useState<CIMBatchDisposition[]>([]);
  const [newClearedBatch, setNewClearedBatch] = useState({ batch: '', males: 0, females: 0 });
  const [tempUnclearedList, setTempUnclearedList] = useState<{name: string, code: string, reason: string, gender: 'Male' | 'Female', ppa?: string}[]>([]);
  const [newDefaulter, setNewDefaulter] = useState({ name: '', code: '', reason: 'BIOMETRIC DEFAULT', gender: 'Male' as 'Male' | 'Female', ppa: '' });
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Station Stats for ZI
  const stationSummaries = useMemo(() => {
    return LGAS.map(station => {
      const disp = stationDispositions.find((d: any) => d.lga === station);
      const audit = entries.find((e: any) => e.lga === station); // Takes latest audit
      return {
        name: station,
        registered: disp ? (disp.totalMales + disp.totalFemales) : 0,
        cleared: audit ? audit.clearedCount : 0,
        uncleared: audit ? (audit.unclearedList?.length || 0) : 0,
        lastUpdated: audit ? new Date(audit.dateAdded).toLocaleDateString() : 'No Audit'
      };
    });
  }, [entries, stationDispositions]);

  const currentStationDisp = stationDispositions.find((d: any) => d.lga === lga);
  const [tempBatches, setTempBatches] = useState<CIMBatchDisposition[]>([]);
  const [newBatch, setNewBatch] = useState({ batch: '', males: 0, females: 0 });

  useEffect(() => {
    if (currentStationDisp?.batches) setTempBatches(currentStationDisp.batches);
    else setTempBatches([]);
  }, [currentStationDisp]);

  const totals = useMemo(() => {
    const cleared = entries.reduce((acc: number, e: any) => acc + (e.clearedCount || 0), 0);
    const uncleared = entries.reduce((acc: number, e: any) => acc + (e.unclearedList?.length || 0), 0);
    return { cleared, uncleared };
  }, [entries]);

  const handleSaveStationDisposition = async () => {
    const data = { lga, batches: tempBatches, totalMales: tempBatches.reduce((a,b)=>a+b.males,0), totalFemales: tempBatches.reduce((a,b)=>a+b.females,0), lastUpdated: new Date().toISOString() };
    try {
      if (currentStationDisp) await updateData(db, "station_disposition", currentStationDisp.id, data);
      else await addData(db, "station_disposition", data);
      alert("Population disposition synchronized.");
    } catch { alert("Sync failed."); }
  };

  const handleIssueQuery = async (cm: any) => {
    setIsGenerating(true);
    try {
      const ppaVal = cm.ppa || `LGA HQ: ${cm.lga || lga}`;
      const content = await generateDisciplinaryQuery(cm.name, cm.code, cm.lga || lga, `Biometric Default (${cm.month})`, ppaVal);
      const payload = { 
        name: cm.name, stateCode: cm.code, lga: cm.lga || lga, ppa: ppaVal, 
        misconduct: `BIOMETRIC DEFAULT - ${cm.month}`, status: 'Pending' as CDRStatus,
        responseContent: content, month: cm.month, dateOfInfraction: new Date().toISOString()
      };
      await addData(db, "cdr_cases", payload);
      generateOfficialPDF(payload, 'DISCIPLINARY_QUERY');
      alert("Formal query published.");
    } catch { alert("Publishing error."); } finally { setIsGenerating(false); }
  };

  const handleSubmitAudit = async (e: any) => {
    e.preventDefault();
    if (!formData.month) return alert("Select month.");
    const totalM = clearedBatches.reduce((a,b)=>a+b.males,0);
    const totalF = clearedBatches.reduce((a,b)=>a+b.females,0);
    const data = { 
      month: formData.month, 
      lga, 
      maleCount: totalM, 
      femaleCount: totalF, 
      clearedCount: totalM+totalF, 
      totalCMs: totalM+totalF+tempUnclearedList.length, 
      unclearedList: tempUnclearedList.map(u => ({...u, month: formData.month})), 
      batchClearance: clearedBatches, 
      dateAdded: new Date().toISOString() 
    };
    await addData(db, "cim_clearance", data);
    setFormData({month:''}); setClearedBatches([]); setTempUnclearedList([]);
    alert("Monthly Audit Published.");
  };

  return (
    <div className="space-y-6">
      {/* Aggregate Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-official">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between overflow-hidden relative group">
          <div className="absolute right-0 top-0 h-full w-2 bg-emerald-500"></div>
          <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Cleared Personnel</p>
             <h3 className="text-3xl font-black text-emerald-600 font-serif-heading">{totals.cleared.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100"><PlusIcon /></div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center justify-between overflow-hidden relative group">
          <div className="absolute right-0 top-0 h-full w-2 bg-red-500"></div>
          <div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Biometric Defaulters</p>
             <h3 className="text-3xl font-black text-red-600 font-serif-heading">{totals.uncleared.toLocaleString()}</h3>
          </div>
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center border border-red-100"><FileTextIcon /></div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-[320px] space-y-4 no-print shrink-0">
          {userRole === 'LGI' ? (
            <>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-5 border-b pb-3">Population Sync</h3>
                <div className="space-y-3 mb-6">
                    {tempBatches.map((b, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100 group">
                        <div>
                          <p className="text-[11px] font-black text-slate-700 uppercase">{b.batch}</p>
                          <p className="text-[9px] font-bold text-slate-400">M: {b.males} | F: {b.females}</p>
                        </div>
                        <button onClick={() => setTempBatches(tempBatches.filter((_, idx) => idx !== i))} className="text-red-200 hover:text-red-500"><TrashIcon /></button>
                      </div>
                    ))}
                </div>
                <div className="space-y-3 bg-slate-50 p-4 rounded-2xl">
                    <input placeholder="BATCH NAME" className="w-full p-3 bg-white rounded-xl border text-xs font-black uppercase outline-none" value={newBatch.batch} onChange={e => setNewBatch({...newBatch, batch: e.target.value.toUpperCase()})} />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" placeholder="MALES" className="w-full p-3 bg-white rounded-xl border text-xs font-black" value={newBatch.males || ''} onChange={e => setNewBatch({...newBatch, males: parseInt(e.target.value) || 0})} />
                      <input type="number" placeholder="FEMALES" className="w-full p-3 bg-white rounded-xl border text-xs font-black" value={newBatch.females || ''} onChange={e => setNewBatch({...newBatch, females: parseInt(e.target.value) || 0})} />
                    </div>
                    <button onClick={() => { if(newBatch.batch) {setTempBatches([...tempBatches, newBatch]); setNewBatch({batch:'',males:0,females:0});} }} className="w-full py-3 bg-[#004d40] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Add Batch</button>
                </div>
                <button onClick={handleSaveStationDisposition} className="w-full mt-4 py-4 bg-emerald-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-lg border border-emerald-500 hover:bg-emerald-700 transition-all">Finalize Disposition</button>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-5 border-b pb-3">Monthly Audit Terminal</h3>
                <form onSubmit={handleSubmitAudit} className="space-y-4">
                    <input required placeholder="MONTH & YEAR" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-black uppercase outline-none" value={formData.month} onChange={e => setFormData({...formData, month: e.target.value.toUpperCase()})} />
                    <div className="p-4 bg-emerald-50/20 rounded-2xl border border-emerald-100 space-y-3">
                      <label className="text-[9px] font-black uppercase text-emerald-800">Assignment desk</label>
                      <select className="w-full p-3 bg-white border rounded-xl text-xs font-black uppercase" value={newClearedBatch.batch} onChange={e => setNewClearedBatch({...newClearedBatch, batch: e.target.value})}>
                          <option value="">Select Batch...</option>
                          {tempBatches.map(b => <option key={b.batch} value={b.batch}>{b.batch}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-3">
                          <input type="number" placeholder="M CLEARED" className="p-3 bg-white border rounded-xl text-xs font-black" value={newClearedBatch.males || ''} onChange={e => setNewClearedBatch({...newClearedBatch, males: parseInt(e.target.value) || 0})} />
                          <input type="number" placeholder="F CLEARED" className="p-3 bg-white border rounded-xl text-xs font-black" value={newClearedBatch.females || ''} onChange={e => setNewClearedBatch({...newClearedBatch, females: parseInt(e.target.value) || 0})} />
                      </div>
                      <button type="button" onClick={() => { if(newClearedBatch.batch) {setClearedBatches([...clearedBatches, newClearedBatch]); setNewClearedBatch({batch:'',males:0,females:0});} }} className="w-full py-3 bg-[#004d40] text-white rounded-xl text-[9px] font-black uppercase tracking-widest">Include Records</button>
                    </div>
                    <button className="w-full py-4 bg-[#004d40] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all">Submit Monthly Audit</button>
                </form>
              </div>
            </>
          ) : (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
               <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-5 border-b pb-3">Zonal Control Desk</h3>
               <p className="text-[11px] text-slate-500 mb-6 leading-relaxed">ZI Headquarters summary view. Monitoring all {LGAS.length} station units within the command.</p>
               <div className="space-y-3">
                  {stationSummaries.map(s => (
                    <div key={s.name} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                       <div className="flex justify-between items-center mb-1">
                          <p className="text-[10px] font-black text-slate-800 uppercase">{s.name}</p>
                          <span className="text-[8px] font-bold text-slate-300 uppercase">{s.lastUpdated}</span>
                       </div>
                       <div className="flex gap-4">
                          <div className="flex-1">
                             <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-500" 
                                  style={{ width: `${s.registered > 0 ? (s.cleared / s.registered) * 100 : 0}%` }}
                                ></div>
                             </div>
                          </div>
                          <span className="text-[9px] font-black text-emerald-600">{s.cleared}/{s.registered}</span>
                       </div>
                    </div>
                  ))}
               </div>
               <button onClick={() => window.print()} className="w-full mt-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Print Zonal Roll</button>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-6">
           <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden animate-official">
              <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
                 <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">Audit History & Records</h3>
                 <button onClick={() => downloadCSV(entries, "CIM_Audit_Registry")} className="text-[10px] font-black uppercase text-[#004d40] flex items-center gap-1 hover:underline"><DownloadIcon /> Export Ledger</button>
              </div>
              <div className="divide-y divide-slate-100">
                 {entries.map((e: CIMClearance) => (
                   <div key={e.id} className="p-6 hover:bg-slate-50 transition-all group">
                      <div className="flex justify-between items-center">
                         <div>
                            <h4 className="text-[16px] font-black uppercase text-slate-800 tracking-tight">{e.month} <span className="text-slate-300 font-normal ml-2">[{e.lga}]</span></h4>
                            <p className="text-[10px] font-bold text-slate-300 uppercase mt-1 tracking-widest">AUDIT PUBLISHED • {new Date(e.dateAdded).toLocaleDateString()}</p>
                         </div>
                         <div className="flex gap-12 items-center">
                            <div className="text-center">
                               <span className="block text-2xl font-black text-emerald-600 leading-none">{e.clearedCount}</span>
                               <span className="text-[8px] font-black text-slate-400 uppercase mt-1">Cleared CMs</span>
                            </div>
                            <div className="text-center border-l border-slate-100 pl-12">
                               <span className="block text-2xl font-black text-red-600 leading-none">{e.unclearedList?.length || 0}</span>
                               <span className="text-[8px] font-black text-slate-400 uppercase mt-1">Defaulters</span>
                            </div>
                         </div>
                         <div className="flex gap-2 no-print opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => shareData(`CIM Audit: ${e.month} [${e.lga}]`, `Cleared: ${e.clearedCount} | Flagged: ${e.unclearedList?.length || 0}`)} className="p-2.5 bg-white rounded-xl border text-blue-600 shadow-sm"><ShareIcon /></button>
                            <button onClick={() => generateOfficialPDF(e, 'CIM_AUDIT')} className="p-2.5 bg-white rounded-xl border text-slate-400 shadow-sm"><DownloadIcon /></button>
                            {userRole === 'LGI' && (
                              <button onClick={() => deleteData(db, "cim_clearance", e.id)} className="p-2.5 bg-white rounded-xl border text-red-200 hover:text-red-500 shadow-sm"><TrashIcon /></button>
                            )}
                         </div>
                      </div>
                   </div>
                 ))}
                 {entries.length === 0 && <div className="p-20 text-center text-slate-300 uppercase tracking-[0.4em] text-[12px] font-black">History Vacant</div>}
              </div>
           </div>

           {/* Defaulter Registry Overview */}
           <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden animate-official">
              <div className="absolute right-0 top-0 opacity-10 scale-150 rotate-12"><FileTextIcon /></div>
              <div className="relative z-10">
                 <h3 className="text-[12px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-6 flex justify-between items-center">
                   Station Exception Ledger
                   <button onClick={() => setIsLedgerOpen(true)} className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all border border-emerald-500">Defaulter Master Desk</button>
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {entries.reduce((acc: any[], entry: any) => [...acc, ...(entry.unclearedList || []).map((cm: any) => ({ ...cm, month: entry.month, lga: entry.lga }))], []).slice(0, 6).map((cm: any, idx: number) => (
                      <div key={idx} className="bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all">
                         <p className="text-[12px] font-black uppercase tracking-tight mb-2">{cm.name}</p>
                         <p className="text-[10px] font-bold text-emerald-400/60 uppercase">{cm.code} • {cm.month} • {cm.lga}</p>
                         <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                            <button onClick={() => handleIssueQuery(cm)} className="text-[9px] font-black uppercase text-emerald-400 hover:underline">Process Query</button>
                            <button onClick={() => shareData(`Personnel Flagged: ${cm.name}`, `Code: ${cm.code}\nReason: ${cm.reason}\nStation: ${cm.lga}`)} className="text-white/40 hover:text-white"><ShareIcon /></button>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      </div>

      {isLedgerOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-5xl rounded-[40px] shadow-2xl flex flex-col h-[85vh] animate-official">
              <div className="bg-[#004d40] p-6 text-white flex justify-between items-center shrink-0">
                 <h3 className="text-xl font-black uppercase tracking-tight font-serif-heading">Exception Master Registry</h3>
                 <button onClick={() => setIsLedgerOpen(false)} className="w-12 h-12 rounded-full hover:bg-white/10 flex items-center justify-center text-xl transition-all">✕</button>
              </div>
              <div className="flex-1 overflow-auto p-8 custom-scrollbar bg-slate-50/50">
                 <table className="w-full">
                    <thead className="text-[10px] font-black uppercase text-slate-400 text-left border-b tracking-widest"><tr className="pb-4"><th>Personnel Details</th><th>Administrative Station</th><th>HQ Directive Terminal</th><th className="text-right">Desk Action</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {entries.reduce((acc: any[], entry: any) => [...acc, ...(entry.unclearedList || []).map((cm: any) => ({ ...cm, month: entry.month, lga: entry.lga, auditId: entry.id }))], []).map((cm: any, idx: number) => (
                         <tr key={idx} className="hover:bg-white transition-all group">
                            <td className="py-6">
                               <div className="flex items-center gap-4">
                                  <div className={`w-3.5 h-3.5 rounded-full shadow-inner ${cm.gender === 'Male' ? 'bg-blue-500' : 'bg-pink-500'}`}></div>
                                  <div>
                                    <p className="font-black text-slate-800 text-[14px] uppercase leading-none">{cm.name}</p>
                                    <p className="text-[10px] font-bold text-emerald-800 opacity-60 uppercase mt-2">{cm.code} • {cm.month} • {cm.gender}</p>
                                  </div>
                               </div>
                            </td>
                            <td className="py-6 text-[11px] font-black text-slate-400 uppercase tracking-tight">{cm.ppa || 'LGA COMMAND HQ'} • {cm.lga}</td>
                            <td className="py-6"><textarea className="w-full p-3 bg-slate-50 border rounded-2xl text-[10px] outline-none h-16 font-medium focus:bg-white transition-all shadow-inner" placeholder="Issue formal minute..." /></td>
                            <td className="py-6 text-right">
                               <div className="flex justify-end gap-3">
                                 <button onClick={() => handleIssueQuery(cm)} className="px-6 py-3 bg-[#004d40] text-white text-[10px] font-black uppercase rounded-2xl hover:bg-black shadow-xl tracking-widest">Publish Query</button>
                                 <button onClick={() => shareData(`Defaulter: ${cm.name}`, cm.code)} className="w-10 h-10 flex items-center justify-center bg-white border rounded-xl shadow-sm text-blue-600 hover:shadow-md"><ShareIcon /></button>
                               </div>
                            </td>
                         </tr>
                      ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

/* --- Enhanced CD&R Module (Minute Sheet Focus) --- */
const CDRModule = ({ entries, lga, db, userRole }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleSubmit = async (e: any) => { e.preventDefault(); await addData(db, "cdr_cases", { ...formData, lga: lga || 'Daura', status: 'Pending' as CDRStatus }); setFormData({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' }); };
  const handleFileUpload = async (id: string, files: FileList | null) => { if (!files || files.length === 0) return; const base64 = await fileToBase64(files[0]); await updateData(db, "cdr_cases", id, { responseImage: base64, status: 'Responded' as CDRStatus }); alert("Asset Linked."); };
  const handleStatusUpdate = async (id: string, status: CDRStatus) => { await updateData(db, "cdr_cases", id, { status }); };
  const handleMinuteUpdate = async (id: string, field: string, text: string) => { await updateData(db, "cdr_cases", id, { [field]: text }); };

  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-official">
      <div className="w-full lg:w-[320px] shrink-0 no-print">
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200 lg:sticky lg:top-14">
          <h3 className="font-black uppercase text-[11px] text-slate-400 tracking-[0.3em] mb-8 border-b pb-4">Initialize Case</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input required placeholder="PERSONNEL FULL NAME" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs uppercase font-black focus:bg-white transition-all shadow-inner" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs uppercase font-black focus:bg-white transition-all shadow-inner" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <input required placeholder="UNIT / PPA" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs uppercase font-black focus:bg-white transition-all shadow-inner" value={formData.ppa} onChange={e => setFormData({...formData, ppa: e.target.value.toUpperCase()})} />
            <textarea required placeholder="MISCONDUCT NARRATIVE..." className="w-full p-4 bg-slate-50 border rounded-2xl h-40 text-xs font-medium focus:bg-white transition-all shadow-inner" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-5 rounded-[20px] font-black uppercase text-[11px] shadow-2xl hover:bg-black transition-all tracking-widest flex items-center justify-center gap-2">
              <PlusIcon /> Publish Record
            </button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-6">
        <div className="flex justify-between items-center mb-2 px-1">
          <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Active Disciplinary Docket</p>
          <button onClick={() => downloadCSV(entries, "Disciplinary_Cases")} className="text-[10px] font-black uppercase text-emerald-700 hover:underline flex items-center gap-1"><SpreadsheetIcon /> Export Master Desk</button>
        </div>
        {entries.map((cm: CDRCase) => (
          <div key={cm.id} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm group relative hover:shadow-xl transition-all">
             <div className="flex justify-between items-start mb-8">
                <div>
                   <h4 className="text-[20px] font-black uppercase tracking-tight text-slate-800 font-serif-heading">{cm.name}</h4>
                   <p className="text-[11px] font-black text-emerald-800 opacity-60 mt-2 uppercase tracking-[0.3em]">{cm.stateCode} • {cm.lga} COMMAND</p>
                </div>
                <div className="flex items-center gap-4 no-print">
                   <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase border tracking-widest shadow-sm ${
                     cm.status === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                     cm.status === 'Responded' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                     cm.status === 'Minuted_back_to_LGI' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                     'bg-slate-900 text-white'
                   }`}>{cm.status?.replace(/_/g, ' ') || 'Pending'}</span>
                   <button onClick={() => { if(window.confirm('Delete case?')) deleteData(db, "cdr_cases", cm.id); }} className="text-slate-200 hover:text-red-500 transition-colors"><TrashIcon /></button>
                </div>
             </div>
             
             <div className="p-6 bg-slate-50 rounded-[24px] border border-slate-100 mb-8 italic text-slate-600 leading-relaxed font-medium text-[13px] relative overflow-hidden shadow-inner">
               <div className="absolute left-0 top-0 h-full w-1 bg-slate-200"></div>
               "{cm.misconduct}"
             </div>

             {/* Structured Minute Sheet Layout */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 border-t border-slate-100 pt-8 relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-full w-px bg-slate-50 hidden md:block"></div>
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                      <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Minute 1: LGI Remark</p>
                      {cm.responseImage && <button onClick={() => setPreviewImage(cm.responseImage!)} className="text-[9px] font-black text-blue-600 hover:underline">View Asset</button>}
                   </div>
                   <textarea 
                     readOnly={userRole !== 'LGI'}
                     className={`w-full p-4 rounded-2xl text-[12px] h-36 outline-none font-medium italic border transition-all ${userRole === 'LGI' ? 'bg-blue-50/20 border-blue-100 focus:bg-white shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                     placeholder="Enter LGI administrative minute..."
                     defaultValue={cm.lgiMinute}
                     onBlur={(e) => userRole === 'LGI' && handleMinuteUpdate(cm.id, 'lgiMinute', e.target.value)}
                   />
                   {userRole === 'LGI' && (
                     <div className="flex gap-3">
                        <input type="file" className="text-[10px] w-full" onChange={(e) => handleFileUpload(cm.id, e.target.files)} />
                        <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_ZI')} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-700">Transmit</button>
                     </div>
                   )}
                </div>
                
                {/* ZI Directive Desk Section */}
                <div className="space-y-4">
                   <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Minute 2: ZI Headquarters</p>
                   <textarea 
                     readOnly={userRole !== 'ZI'}
                     className={`w-full p-4 rounded-2xl text-[12px] h-36 outline-none font-medium italic border transition-all ${userRole === 'ZI' ? 'bg-emerald-50/20 border-emerald-100 focus:bg-white shadow-sm' : 'bg-slate-50 border-slate-100 text-slate-500'}`}
                     placeholder="Enter official ZI directive..."
                     defaultValue={cm.ziMinute}
                     onBlur={(e) => userRole === 'ZI' && handleMinuteUpdate(cm.id, 'ziMinute', e.target.value)}
                   />
                   {userRole === 'ZI' && (
                     <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-2 gap-2">
                           <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_back_to_LGI')} className="py-2.5 bg-yellow-500 text-white rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-yellow-600 transition-all">Return LGI</button>
                           <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_CDR')} className="py-2.5 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase shadow-lg hover:bg-black transition-all">Finalize Case</button>
                        </div>
                        {/* Specific Minute to CIM Button */}
                        <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_to_CIM')} className="w-full py-3 bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-emerald-800 transition-all flex items-center justify-center gap-2 border border-emerald-600">
                           Minute to CIM Terminal
                        </button>
                     </div>
                   )}
                </div>
             </div>

             <div className="flex justify-between items-center border-t border-slate-50 pt-8 no-print">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Case Reference: {cm.id.substring(0,8).toUpperCase()}</p>
                <div className="flex gap-4">
                   <button onClick={() => shareData(`Disciplinary Record: ${cm.name}`, `Case of ${cm.misconduct}\nLGI Minute: ${cm.lgiMinute || 'None'}\nZI Directive: ${cm.ziMinute || 'None'}`)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl shadow-sm text-blue-600 hover:shadow-md transition-all"><ShareIcon /></button>
                   <button onClick={() => generateOfficialPDF(cm, 'CDR_CASE')} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl shadow-sm text-slate-400 hover:shadow-md transition-all"><DownloadIcon /></button>
                   <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`NYSC DAURA Case Update: Record for ${cm.name} (${cm.stateCode}) has been updated in the portal.`)}`)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-100 rounded-2xl shadow-sm text-emerald-600 hover:shadow-md transition-all"><WhatsAppIcon /></button>
                </div>
             </div>
          </div>
        ))}
        {entries.length === 0 && <div className="text-center py-24 text-slate-300 font-black uppercase tracking-[0.4em] text-[12px] bg-white rounded-[40px] border border-dashed border-slate-200">Registry Empty</div>}
      </div>

      {previewImage && (
        <div className="fixed inset-0 bg-slate-950/95 z-[3000] flex items-center justify-center p-6" onClick={() => setPreviewImage(null)}>
          <div className="max-w-4xl w-full max-h-full flex flex-col items-center gap-6 animate-official">
             <img src={previewImage} className="max-w-full max-h-full rounded-2xl shadow-2xl border-4 border-white/5 object-contain" alt="Asset Preview" />
             <div className="flex gap-4">
                <a href={previewImage} download="Exhibit.png" className="px-8 py-3 bg-white text-black font-black uppercase text-[10px] rounded-2xl shadow-xl">Download Exhibit</a>
                <button className="px-8 py-3 bg-red-600 text-white font-black uppercase text-[10px] rounded-2xl shadow-xl">Dismiss</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Remaining Modules implementation (SAED, CWHS, CDS) --- */
const SAEDModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-official">
      <div className="w-full lg:w-[320px] shrink-0 no-print">
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
          <h3 className="font-black uppercase text-[11px] text-slate-400 tracking-[0.3em] mb-8 border-b pb-4">SAED Hub Setup</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "saed_centers", { ...formData, lga }); setFormData({centerName:'',address:'',cmCount:0,fee:0}); }} className="space-y-4">
            <input required placeholder="HUB NAME" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs uppercase font-black" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
            <input required placeholder="STATION ADDRESS" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs uppercase font-bold" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
            <div className="grid grid-cols-2 gap-4">
               <input type="number" placeholder="CENSUS" className="w-full p-4 bg-white border rounded-2xl text-xs font-black text-blue-600" value={formData.cmCount || ''} onChange={e => setFormData({...formData, cmCount: parseInt(e.target.value) || 0})} />
               <input type="number" placeholder="₦ FEE" className="w-full p-4 bg-white border rounded-2xl text-xs font-black text-emerald-600" value={formData.fee || ''} onChange={e => setFormData({...formData, fee: parseInt(e.target.value) || 0})} />
            </div>
            <button className="w-full bg-[#004d40] text-white p-5 rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-black transition-all tracking-widest">Confirm Hub</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
        {entries.map((c: any) => (
          <div key={c.id} className="bg-white p-8 rounded-[40px] border border-slate-200 relative group animate-official shadow-sm overflow-hidden h-fit transition-all hover:shadow-lg">
            <div className="absolute top-0 left-0 w-full h-2 bg-[#004d40]"></div>
            <h4 className="text-[18px] font-black uppercase text-slate-800 font-serif-heading">{c.centerName}</h4>
            <p className="text-[11px] font-bold text-slate-400 uppercase mt-2 tracking-widest">{c.address}</p>
            <div className="flex gap-12 pt-8 border-t border-slate-50 mt-8">
               <div><p className="text-[9px] font-black text-slate-300 mb-2 uppercase tracking-widest">CENSUS</p><p className="text-3xl font-black text-[#004d40]">{c.cmCount}</p></div>
               <div><p className="text-[9px] font-black text-slate-300 mb-2 uppercase tracking-widest">FEE</p><p className="text-3xl font-black text-emerald-600">₦{Number(c.fee).toLocaleString()}</p></div>
            </div>
            <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
               <button onClick={() => shareData(`SAED Hub: ${c.centerName}`, `Census: ${c.cmCount} | Fee: ₦${c.fee}`)} className="text-blue-500 hover:scale-110 transition-transform"><ShareIcon /></button>
               <button onClick={() => deleteData(db, "saed_centers", c.id)} className="text-red-200 hover:text-red-500 hover:scale-110 transition-transform"><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CWHSModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.ABSCONDED, details: '' });
  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-official">
      <div className="w-full lg:w-[320px] shrink-0 no-print">
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
          <h3 className="font-black uppercase text-[11px] text-slate-400 tracking-[0.3em] mb-8 border-b pb-4">Incident Filing</h3>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "nysc_reports", { ...formData, lga }); setFormData({name:'',stateCode:'',category:ReportCategory.ABSCONDED,details:''}); }} className="space-y-4">
            <input required placeholder="PERSONNEL NAME" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs uppercase font-black" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs uppercase font-black" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <select className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-black uppercase" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ReportCategory})}>
              {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea placeholder="NARRATIVE BRIEF..." className="w-full p-4 bg-slate-50 border rounded-2xl h-40 text-xs font-medium shadow-inner" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-5 rounded-[20px] font-black uppercase text-[11px] shadow-xl hover:bg-black transition-all">Publish Record</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
        {entries.map((e: any) => (
          <div key={e.id} className="bg-white p-8 rounded-[40px] border border-slate-200 relative group animate-official shadow-sm hover:shadow-lg transition-all h-fit">
            <h4 className="text-[18px] font-black uppercase text-slate-800 font-serif-heading tracking-tight">{e.name}</h4>
            <p className="text-[11px] font-black text-emerald-800 opacity-60 mt-2 uppercase tracking-[0.2em]">{e.stateCode}</p>
            <div className="p-6 bg-slate-50 rounded-[24px] border border-slate-100 my-6 shadow-inner text-[13px] text-slate-600 font-medium leading-relaxed italic">"{e.details || 'Documentation pending.'}"</div>
            <div className="flex justify-between items-center border-t border-slate-50 pt-6">
               <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{e.category}</span>
               <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-all">
                  <button onClick={() => shareData(`CW&HS Incident: ${e.name}`, e.details)} className="text-blue-500 hover:scale-110"><ShareIcon /></button>
                  <button onClick={() => deleteData(db, "nysc_reports", e.id)} className="text-red-200 hover:text-red-500 hover:scale-110 transition-transform"><TrashIcon /></button>
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CDSModule = ({ groups, projects, lga, db, userRole }: any) => {
  const [view, setView] = useState<'UNITS' | 'PROJECTS'>('UNITS');
  const [groupForm, setGroupForm] = useState({ groupName: '', meetingDay: 'Wednesday' });
  const [projectForm, setProjectForm] = useState({ cmName: '', stateCode: '', projectName: '', projectType: 'Health', location: '', description: '', status: 'Ongoing' as const });
  return (
    <div className="flex flex-col lg:flex-row gap-8 animate-official">
      <div className="w-full lg:w-[320px] flex flex-col gap-6 no-print shrink-0">
        <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-200">
          <div className="flex bg-slate-100 p-2 rounded-[20px] mb-8">
             <button onClick={() => setView('UNITS')} className={`flex-1 py-3 rounded-[16px] text-[11px] font-black uppercase transition-all tracking-widest ${view === 'UNITS' ? 'bg-[#004d40] text-white shadow-lg' : 'text-slate-400'}`}>Units</button>
             <button onClick={() => setView('PROJECTS')} className={`flex-1 py-3 rounded-[16px] text-[11px] font-black uppercase transition-all tracking-widest ${view === 'PROJECTS' ? 'bg-[#004d40] text-white shadow-lg' : 'text-slate-400'}`}>Impact</button>
          </div>
          {view === 'UNITS' ? (
            <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_groups", { ...groupForm, lga }); setGroupForm({groupName:'',meetingDay:'Wednesday'}); }} className="space-y-4">
              <input required placeholder="UNIT NAME" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs uppercase font-black" value={groupForm.groupName} onChange={e => setGroupForm({...groupForm, groupName: e.target.value.toUpperCase()})} />
              <select className="w-full p-4 bg-slate-50 border rounded-2xl text-xs font-black uppercase" value={groupForm.meetingDay} onChange={e => setGroupForm({...groupForm, meetingDay: e.target.value})}>
                <option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option>
              </select>
              <button className="w-full bg-[#004d40] text-white p-5 rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-black transition-all">Confirm Unit</button>
            </form>
          ) : (
            <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_projects", { ...projectForm, lga }); setProjectForm({cmName:'',stateCode:'',projectName:'',projectType:'Health',location:'',description:'',status:'Ongoing'}); }} className="space-y-4">
              <input required placeholder="CORPS MEMBER" className="w-full p-4 bg-slate-50 border rounded-2xl text-xs uppercase font-black" value={projectForm.cmName} onChange={e => setProjectForm({...projectForm, cmName: e.target.value.toUpperCase()})} />
              <textarea required placeholder="PROJECT SCOPE..." className="w-full p-4 bg-slate-50 border rounded-2xl h-32 text-xs font-medium" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} />
              <button className="w-full bg-[#004d40] text-white p-5 rounded-2xl font-black uppercase text-[11px] shadow-xl hover:bg-black transition-all">Publish Impact</button>
            </form>
          )}
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(view === 'UNITS' ? groups : projects).map((item: any) => (
          <div key={item.id} className="bg-white p-8 rounded-[40px] border border-slate-200 relative group animate-official shadow-sm hover:shadow-lg transition-all h-fit">
            <div className="absolute left-0 top-0 w-2 h-full bg-[#004d40]"></div>
            <h4 className="text-[16px] font-black uppercase text-slate-800 font-serif-heading leading-tight mb-4">{view === 'UNITS' ? item.groupName : item.projectName}</h4>
            <div className="flex items-center gap-4 text-[10px] font-black text-emerald-800 tracking-widest uppercase">
              <span className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">{view === 'UNITS' ? item.meetingDay : item.status}</span>
              <span className="text-slate-300">STATION: {item.lga}</span>
            </div>
            <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
               <button onClick={() => shareData(`CDS Info: ${view === 'UNITS' ? item.groupName : item.projectName}`, item.description || item.meetingDay)} className="text-blue-500 hover:scale-110 transition-transform"><ShareIcon /></button>
               <button onClick={() => deleteData(db, view === 'UNITS' ? "cds_groups" : "cds_projects", item.id)} className="text-red-200 hover:text-red-500 hover:scale-110 transition-transform"><TrashIcon /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;

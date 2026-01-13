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
  const [isClearanceModalOpen, setIsClearanceModalOpen] = useState(false);
  
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
        <header className="bg-[#004d40] text-white p-4 shadow rounded-lg flex items-center justify-between no-print gap-4 mb-5 animate-official">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/10 rounded flex items-center justify-center border border-white/10"><DashboardIcon /></div>
            <div>
              <h1 className="text-xs font-black uppercase tracking-tight font-serif-heading">NYSC DAURA COMMAND</h1>
              <p className="text-[7px] font-bold text-emerald-300 tracking-wider uppercase opacity-50">Secretariat Portal Hub</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userRole === 'LGI' && (
              <button onClick={() => setIsClearanceModalOpen(true)} className="bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-wider border border-white/10 transition-colors flex items-center gap-1 shadow-lg">
                <PlusIcon /> Submit Audit
              </button>
            )}
            <div className="bg-black/20 px-2 py-1 rounded text-[8px] font-bold uppercase tracking-wider border border-white/5">{userRole === 'LGI' ? `${lgaContext} Unit` : 'Zonal HQ Dashboard'}</div>
            <button onClick={handleLogout} className="w-7 h-7 bg-red-600/10 hover:bg-red-600 rounded transition-all flex items-center justify-center"><LogOutIcon /></button>
          </div>
        </header>

        <div className="mb-5 flex justify-center no-print">
          <div className="bg-white p-0.5 rounded shadow-sm w-full max-w-sm border border-slate-200 flex items-center group">
            <div className="ml-3 mr-2 text-slate-300 scale-75"><SearchIcon /></div>
            <input type="text" placeholder="Quick find..." className="bg-transparent p-1.5 text-[11px] w-full outline-none font-medium text-slate-600" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>

        <main className="flex flex-col lg:flex-row gap-5">
          {!isDbLoaded ? (
            <div className="w-full flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-6 h-6 border-2 border-slate-200 border-t-[#004d40] rounded-full animate-spin"></div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-[8px]">Syncing Terminal...</p>
            </div>
          ) : (
            <>
              {division === 'CWHS' && <CWHSModule entries={filteredData.cwhs} lga={lgaContext!} db={dbRef.current} />}
              {division === 'CIM' && <CIMModule entries={filteredData.cim} lga={lgaContext!} db={dbRef.current} userRole={userRole} stationDispositions={stationDispositions} />}
              {division === 'CDR' && <CDRModule entries={filteredData.cdr} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
              {division === 'CDS' && <CDSModule groups={filteredData.cdsGroups} projects={filteredData.cdsProjects} lga={lgaContext!} db={dbRef.current} userRole={userRole} />}
              {division === 'SAED' && <SAEDModule entries={filteredData.saed} lga={lgaContext!} db={dbRef.current} />}
            </>
          )}
        </main>
      </div>

      {isClearanceModalOpen && userRole === 'LGI' && (
        <ClearanceFormModal 
          isOpen={isClearanceModalOpen} 
          onClose={() => setIsClearanceModalOpen(false)} 
          lga={lgaContext!} 
          db={dbRef.current}
          stationDispositions={stationDispositions}
        />
      )}
    </div>
  );
};

/* --- Clearance Form Modal (The "Google Form" Interface) --- */
const ClearanceFormModal = ({ isOpen, onClose, lga, db, stationDispositions }: any) => {
  const [formData, setFormData] = useState({ month: '' });
  const [clearedBatches, setClearedBatches] = useState<CIMBatchDisposition[]>([]);
  const [newClearedBatch, setNewClearedBatch] = useState({ batch: '', males: 0, females: 0 });
  const [tempUnclearedList, setTempUnclearedList] = useState<{name: string, code: string, reason: string, ppa?: string}[]>([]);
  const [newDefaulter, setNewDefaulter] = useState({ name: '', code: '', reason: 'Biometric Default', ppa: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentDisp = stationDispositions.find((d: any) => d.lga === lga);
  const batches = currentDisp?.batches || [];

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (clearedBatches.length === 0 && tempUnclearedList.length === 0) {
      alert("Please add at least one batch or defaulter.");
      return;
    }
    setIsSubmitting(true);
    try {
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
      alert("Monthly Audit Successfully Published.");
      onClose();
    } catch {
      alert("Submission failed. Check connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-official">
        <div className="bg-[#004d40] p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg"><FileTextIcon /></div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tight font-serif-heading">Clearance Audit Form</h2>
              <p className="text-[9px] font-bold text-emerald-300 uppercase tracking-widest opacity-60">{lga} Local Command Station</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-black/20 flex items-center justify-center text-xl transition-colors">✕</button>
        </div>
        
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          <form id="auditForm" onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Context */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-l-2 border-[#004d40] pl-2">1. Audit Context</label>
              <input 
                required 
                placeholder="MONTH & YEAR (E.G. SEPTEMBER 2025)" 
                className="w-full p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm font-black uppercase outline-none focus:ring-2 focus:ring-[#004d40]/20 transition-all" 
                value={formData.month} 
                onChange={e => setFormData({...formData, month: e.target.value.toUpperCase()})} 
              />
            </div>

            {/* Step 2: Cleared Stats */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-l-2 border-[#004d40] pl-2">2. Clearance Data (Successful)</label>
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-emerald-800 ml-1">Select Batch</label>
                    <select className="w-full p-2.5 bg-white rounded-lg border border-emerald-100 text-xs font-bold uppercase outline-none" onChange={e => setNewClearedBatch({...newClearedBatch, batch: e.target.value})} value={newClearedBatch.batch}>
                      <option value="">Select Target Batch...</option>
                      {batches.map((b: any) => <option key={b.batch} value={b.batch}>{b.batch}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-emerald-800 ml-1">Males</label>
                      <input type="number" placeholder="0" className="w-full p-2.5 bg-white rounded-lg border border-emerald-100 text-xs font-bold outline-none" value={newClearedBatch.males || ''} onChange={e => setNewClearedBatch({...newClearedBatch, males: parseInt(e.target.value) || 0})} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase text-emerald-800 ml-1">Females</label>
                      <input type="number" placeholder="0" className="w-full p-2.5 bg-white rounded-lg border border-emerald-100 text-xs font-bold outline-none" value={newClearedBatch.females || ''} onChange={e => setNewClearedBatch({...newClearedBatch, females: parseInt(e.target.value) || 0})} />
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => { if(newClearedBatch.batch) { setClearedBatches([...clearedBatches, newClearedBatch]); setNewClearedBatch({batch:'',males:0,females:0}); } }} className="w-full py-2 bg-[#004d40] text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md">Add Batch Record</button>
                
                {clearedBatches.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {clearedBatches.map((b, i) => (
                      <div key={i} className="px-3 py-1.5 bg-white text-emerald-700 rounded-full text-[9px] font-black uppercase border border-emerald-200 flex items-center gap-2 shadow-sm">
                        <span>{b.batch} (M:{b.males} F:{b.females})</span>
                        <button type="button" onClick={() => setClearedBatches(clearedBatches.filter((_, idx) => idx !== i))} className="hover:text-red-500">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Defaulters */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-l-2 border-red-500 pl-2">3. Clearance Defaulters (Flagged)</label>
              <div className="bg-red-50/50 p-4 rounded-xl border border-red-100 space-y-3">
                <input placeholder="PERSONNEL FULL NAME" className="w-full p-2.5 bg-white rounded-lg border border-red-100 text-xs uppercase outline-none font-bold" value={newDefaulter.name} onChange={e => setNewDefaulter({...newDefaulter, name: e.target.value.toUpperCase()})} />
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="STATE CODE" className="w-full p-2.5 bg-white rounded-lg border border-red-100 text-xs uppercase outline-none font-bold" value={newDefaulter.code} onChange={e => setNewDefaulter({...newDefaulter, code: e.target.value.toUpperCase()})} />
                  <input placeholder="PPA" className="w-full p-2.5 bg-white rounded-lg border border-red-100 text-xs uppercase outline-none font-bold" value={newDefaulter.ppa} onChange={e => setNewDefaulter({...newDefaulter, ppa: e.target.value.toUpperCase()})} />
                </div>
                <button type="button" onClick={() => { if(newDefaulter.name && newDefaulter.code) { setTempUnclearedList([...tempUnclearedList, newDefaulter]); setNewDefaulter({name:'', code:'', reason:'Biometric Default', ppa:''}); } }} className="w-full py-2 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-md">Flag Defaulter</button>
                
                {tempUnclearedList.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {tempUnclearedList.map((u, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-white border border-red-100 rounded-lg shadow-sm group">
                        <div>
                          <p className="font-black text-red-700 text-[11px] uppercase leading-none">{u.name}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{u.code} • {u.ppa || 'LGA HQ'}</p>
                        </div>
                        <button type="button" onClick={() => setTempUnclearedList(tempUnclearedList.filter((_, idx) => idx !== i))} className="text-red-300 hover:text-red-600 text-lg">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="p-5 bg-slate-50 border-t shrink-0 flex items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Audit Summary</p>
            <p className="text-[12px] font-black text-slate-800">
              {clearedBatches.reduce((a,b)=>a+b.males+b.females, 0)} Cleared • {tempUnclearedList.length} Defaulters
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-6 py-2.5 border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-500 hover:bg-white transition-all">Cancel</button>
            <button 
              form="auditForm"
              disabled={isSubmitting}
              className="px-10 py-2.5 bg-[#004d40] text-white rounded-lg text-[10px] font-black uppercase tracking-[0.1em] shadow-xl hover:shadow-[#004d40]/20 disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {isSubmitting ? 'Processing...' : 'Submit Audit Record'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* --- CIM Module --- */
const CIMModule = ({ entries, db, lga, userRole, stationDispositions }: any) => {
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDispBreakdownOpen, setIsDispBreakdownOpen] = useState(false);
  const [isLgaDetailOpen, setIsLgaDetailOpen] = useState(false);

  const currentStationDisp = stationDispositions.find((d: any) => d.lga === (userRole === 'LGI' ? lga : null) || d.lga === lga);
  const [tempBatches, setTempBatches] = useState<CIMBatchDisposition[]>([]);
  const [newBatch, setNewBatch] = useState({ batch: '', males: 0, females: 0 });

  useEffect(() => {
    if (currentStationDisp?.batches) setTempBatches(currentStationDisp.batches);
    else setTempBatches([]);
  }, [currentStationDisp]);

  const handleSaveStationDisposition = async () => {
    const data = { lga, batches: tempBatches, totalMales: tempBatches.reduce((a,b)=>a+b.males,0), totalFemales: tempBatches.reduce((a,b)=>a+b.females,0), lastUpdated: new Date().toISOString() };
    try {
      if (currentStationDisp) await updateData(db, "station_disposition", currentStationDisp.id, data);
      else await addData(db, "station_disposition", data);
      window.alert("Population Disposition Synced.");
    } catch { window.alert("Fail."); }
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
      window.alert("Disciplinary Query Issued and Exported.");
    } catch { window.alert("Error."); } finally { setIsGenerating(false); }
  };

  const handleAuditMinute = async (auditId: string, minuteText: string) => {
    await updateData(db, "cim_clearance", auditId, { ziMinute: minuteText });
  };

  const handleDefaulterMinute = async (auditId: string, cmCode: string, minuteText: string) => {
    const audit = entries.find((e: any) => e.id === auditId);
    if (!audit) return;
    const newList = audit.unclearedList.map((cm: any) => cm.code === cmCode ? { ...cm, ziMinute: minuteText } : cm);
    await updateData(db, "cim_clearance", auditId, { unclearedList: newList });
  };

  const aggregates = useMemo(() => {
    const totalCleared = entries.reduce((acc: number, e: any) => acc + (e.clearedCount || 0), 0);
    const totalDefaulters = entries.reduce((acc: number, e: any) => acc + (e.unclearedList?.length || 0), 0);
    const uniqueLgas = new Set(entries.map((e: any) => e.lga)).size;

    const totalDispMales = stationDispositions.reduce((acc: number, d: any) => acc + (d.totalMales || 0), 0);
    const totalDispFemales = stationDispositions.reduce((acc: number, d: any) => acc + (d.totalFemales || 0), 0);

    const zonalBatches: Record<string, {males: number, females: number}> = {};
    stationDispositions.forEach((disp: any) => {
      disp.batches?.forEach((b: any) => {
        if (!zonalBatches[b.batch]) zonalBatches[b.batch] = {males: 0, females: 0};
        zonalBatches[b.batch].males += b.males || 0;
        zonalBatches[b.batch].females += b.females || 0;
      });
    });

    return { totalCleared, totalDefaulters, uniqueLgas, totalDispMales, totalDispFemales, zonalBatches };
  }, [entries, stationDispositions]);

  const handleDownloadDefaulters = () => {
    const allDefaulters = entries.reduce((acc: any[], entry: any) => {
      return [...acc, ...(entry.unclearedList || []).map((u: any) => ({
        Month: entry.month,
        LGA: entry.lga,
        Name: u.name,
        Code: u.code,
        PPA: u.ppa || 'LGA HQ',
        Reason: u.reason,
        ZI_Minute: u.ziMinute || ''
      }))];
    }, []);
    downloadCSV(allDefaulters, "CIM_Defaulter_Master_Registry");
  };

  if (userRole === 'ZI') {
    return (
      <div className="w-full flex flex-col gap-5 animate-official">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-xl flex flex-col items-center relative overflow-hidden text-white">
            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Zonal Population Aggregate</span>
            <span className="text-3xl font-black font-serif-heading">{(aggregates.totalDispMales + aggregates.totalDispFemales).toLocaleString()}</span>
            <div className="flex gap-4 mt-1 border-t border-white/10 pt-1 w-full justify-center">
               <span className="text-[10px] font-bold text-blue-400">Males: {aggregates.totalDispMales.toLocaleString()}</span>
               <span className="text-[10px] font-bold text-pink-400">Females: {aggregates.totalDispFemales.toLocaleString()}</span>
            </div>
            <div className="absolute bottom-1 right-1 flex gap-1">
               <button onClick={() => downloadCSV(Object.entries(aggregates.zonalBatches).map(([b, c]) => ({ Batch: b, ...(c as any) })), "Zonal_Batch_Distribution")} title="Download Disposition" className="p-1 hover:bg-white/10 rounded"><SpreadsheetIcon /></button>
            </div>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Cleared (Cumulative)</span>
            <span className="text-3xl font-black text-emerald-600 font-serif-heading">{aggregates.totalCleared.toLocaleString()}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Biometric Defaults</span>
            <span className="text-3xl font-black text-red-600 font-serif-heading">{aggregates.totalDefaulters.toLocaleString()}</span>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Active LGA Units</span>
            <span className="text-3xl font-black text-[#004d40] font-serif-heading">{aggregates.uniqueLgas} / {LGAS.length}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
           <div className="p-3 bg-slate-800 text-white flex justify-between items-center cursor-pointer hover:bg-black transition-all" onClick={() => setIsDispBreakdownOpen(!isDispBreakdownOpen)}>
              <div className="flex items-center gap-3">
                 <DashboardIcon />
                 <h3 className="text-[11px] font-black uppercase tracking-widest">Global Zonal Batch Distribution</h3>
              </div>
              <span className="text-xs font-bold">{isDispBreakdownOpen ? '− Hide' : '+ Show Detail'}</span>
           </div>
           {isDispBreakdownOpen && (
             <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 bg-slate-50 animate-official border-b">
                {Object.entries(aggregates.zonalBatches).map(([batch, counts]: [string, any]) => (
                  <div key={batch} className="p-3 bg-white rounded border border-slate-200 shadow-sm flex flex-col items-center">
                     <p className="text-[10px] font-black text-slate-800 uppercase mb-2 text-center border-b border-slate-100 pb-1 w-full">{batch}</p>
                     <div className="flex justify-between w-full text-[12px] font-black">
                        <span className="text-blue-600">M: {counts.males}</span>
                        <span className="text-pink-600">F: {counts.females}</span>
                     </div>
                     <p className="text-[8px] font-bold text-slate-400 uppercase mt-2">Zone Total: {counts.males + counts.females}</p>
                  </div>
                ))}
             </div>
           )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#004d40] p-4 text-white flex justify-between items-center">
             <div className="flex items-center gap-3">
               <h3 className="text-sm font-black uppercase tracking-widest">Zonal Audit Ledger</h3>
               <button onClick={() => downloadCSV(entries, "Global_Audit_Summaries")} title="Export Audit Data" className="p-1.5 hover:bg-white/10 rounded border border-white/20"><SpreadsheetIcon /></button>
               <button onClick={handleDownloadDefaulters} title="Download Master Defaulter List" className="p-1.5 hover:bg-white/10 rounded border border-white/20"><DownloadIcon /></button>
             </div>
             <div className="flex gap-2">
                <button onClick={() => setIsLedgerOpen(true)} className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-[10px] font-black uppercase shadow-lg transition-all border border-emerald-500">Defaulter Registry</button>
             </div>
          </div>
          <div className="overflow-auto custom-scrollbar">
            <table className="w-full border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[9px] font-bold uppercase text-slate-400 text-left">
                  <th className="p-4">Command Unit</th>
                  <th className="p-4">Population Info</th>
                  <th className="p-4">Audit Month</th>
                  <th className="p-4 text-center">Cleared</th>
                  <th className="p-4 text-center">Defaulters</th>
                  <th className="p-4">ZI HQ Directives</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {LGAS.map(lgaName => {
                  const lgaEntries = entries.filter((e: any) => e.lga === lgaName);
                  const lgaDisp = stationDispositions.find((d: any) => d.lga === lgaName);
                  const latest = lgaEntries[0];
                  return (
                    <tr key={lgaName} className={`hover:bg-slate-50 transition-all ${lgaEntries.length === 0 ? 'opacity-40' : ''}`}>
                      <td className="p-4 font-black text-slate-800 uppercase tracking-tight">{lgaName}</td>
                      <td className="p-4">
                         {lgaDisp ? (
                           <div className="flex gap-2 text-[10px] font-black">
                             <span className="text-blue-600">M: {lgaDisp.totalMales}</span>
                             <span className="text-pink-600">F: {lgaDisp.totalFemales}</span>
                           </div>
                         ) : <span className="text-[9px] text-slate-300">--</span>}
                      </td>
                      <td className="p-4 font-bold text-slate-600 uppercase">{latest?.month || 'N/A'}</td>
                      <td className="p-4 text-center font-black text-emerald-600">{latest?.clearedCount || 0}</td>
                      <td className="p-4 text-center font-black text-red-600">{latest?.unclearedList?.length || 0}</td>
                      <td className="p-4">
                        <textarea className="w-full bg-slate-50 border p-2 rounded-lg text-[9px] h-12 outline-none focus:bg-white transition-all" placeholder="Add directive..." defaultValue={latest?.ziMinute} onBlur={(e) => latest && handleAuditMinute(latest.id, e.target.value)} />
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
                          {latest && (
                            <>
                              <button onClick={() => generateOfficialPDF(latest, 'CIM_AUDIT')} title="Export PDF" className="p-2 text-slate-400 hover:text-[#004d40] transition-colors"><DownloadIcon /></button>
                              <button onClick={() => shareData(`Audit: ${lgaName}`, `Month: ${latest.month}\nCleared: ${latest.clearedCount}\nFlagged: ${latest.unclearedList?.length || 0}`)} title="Share Summary" className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><ShareIcon /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {isLedgerOpen && (
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[85vh]">
              <div className="bg-[#004d40] p-4 text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-3">
                   <h3 className="text-sm font-black uppercase tracking-tight">Personnel Defaulter Master Registry</h3>
                   <button onClick={handleDownloadDefaulters} className="p-1 hover:bg-white/10 rounded border border-white/20"><DownloadIcon /></button>
                 </div>
                 <button onClick={() => setIsLedgerOpen(false)} className="text-xl">✕</button>
              </div>
              <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                 <table className="w-full">
                    <thead className="text-[8px] font-black uppercase text-slate-400 text-left border-b tracking-widest"><tr className="pb-2"><th>Personnel Info</th><th>Station Context</th><th>ZI Headquarters Directive</th><th className="text-right">Actions</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {entries.reduce((acc: any[], entry: any) => [...acc, ...(entry.unclearedList || []).map((cm: any) => ({ ...cm, lga: entry.lga, month: entry.month, auditId: entry.id }))], []).map((cm: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-all group">
                            <td className="py-3">
                              <p className="font-black text-slate-700 text-[11px] uppercase leading-none">{cm.name}</p>
                              <p className="text-[8px] font-bold text-emerald-800 opacity-60 uppercase mt-1.5">{cm.code} • {cm.month}</p>
                            </td>
                            <td className="py-3">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{cm.ppa || cm.lga}</p>
                            </td>
                            <td className="py-3">
                               <textarea className="w-full p-2 bg-white border rounded-lg text-[10px] outline-none h-14 group-hover:border-[#004d40]/30 transition-all" placeholder="Enter administrative directive..." defaultValue={cm.ziMinute} onBlur={(e) => handleDefaulterMinute(cm.auditId, cm.code, e.target.value)} />
                            </td>
                            <td className="py-3 text-right">
                               <div className="flex items-center justify-end gap-1.5">
                                 <button onClick={() => handleIssueQuery(cm)} disabled={isGenerating} className="px-3 py-1.5 bg-[#004d40] text-white text-[9px] font-black uppercase rounded hover:bg-black disabled:opacity-50 shadow-md">Query</button>
                                 <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Notice: ${cm.name} (${cm.code}) defaulted in ${cm.month} clearance.`)}`)} className="w-8 h-8 flex items-center justify-center text-emerald-600 bg-white border rounded-lg hover:bg-emerald-50 shadow-sm transition-all"><WhatsAppIcon /></button>
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
  }

  return (
    <>
      <div className="w-full lg:w-[280px] flex flex-col gap-4 no-print shrink-0">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-black uppercase text-[7px] mb-3 text-slate-400 text-center tracking-[0.2em]">Station Population Disposition</h3>
          <div className="space-y-1.5 mb-4 max-h-[180px] overflow-auto pr-1 custom-scrollbar">
            {tempBatches.map((b, i) => (
              <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center group animate-official">
                <div className="flex flex-col">
                  <p className="text-[10px] font-black text-slate-800 uppercase leading-none">{b.batch}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">M: {b.males} | F: {b.females}</p>
                </div>
                <button onClick={() => setTempBatches(tempBatches.filter((_, idx) => idx !== i))} className="text-red-200 hover:text-red-500 transition-colors"><TrashIcon /></button>
              </div>
            ))}
          </div>
          <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
             <input placeholder="BATCH NAME" className="w-full p-2.5 bg-white rounded-lg border border-slate-200 text-[10px] uppercase outline-none font-black text-slate-700" value={newBatch.batch} onChange={e => setNewBatch({...newBatch, batch: e.target.value.toUpperCase()})} />
             <div className="grid grid-cols-2 gap-2">
                <input type="number" placeholder="Males" className="p-2.5 bg-white rounded-lg border border-slate-200 text-[10px] font-bold text-blue-600" value={newBatch.males || ''} onChange={e => setNewBatch({...newBatch, males: parseInt(e.target.value) || 0})} />
                <input type="number" placeholder="Females" className="p-2.5 bg-white rounded-lg border border-slate-200 text-[10px] font-bold text-pink-600" value={newBatch.females || ''} onChange={e => setNewBatch({...newBatch, females: parseInt(e.target.value) || 0})} />
             </div>
             <button onClick={() => { if(newBatch.batch) {setTempBatches([...tempBatches, newBatch]); setNewBatch({batch:'',males:0,females:0});} }} className="w-full py-2.5 bg-[#004d40] text-white rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1 hover:bg-black transition-all shadow-md"><PlusIcon /> Add Batch</button>
          </div>
          <button onClick={handleSaveStationDisposition} className="w-full mt-3 bg-emerald-700 text-white p-3 rounded-xl font-black uppercase text-[9px] shadow-lg tracking-widest hover:bg-emerald-800 transition-all">Sync Global Stats</button>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div className="bg-slate-900 rounded-xl shadow-2xl p-6 text-white flex flex-col md:flex-row justify-between items-center gap-8 animate-official relative overflow-hidden border border-slate-800">
           <div className="absolute right-0 top-0 opacity-10 scale-150 -translate-y-6 translate-x-6 text-emerald-500"><DashboardIcon /></div>
           <div className="z-10 text-center md:text-left">
              <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-400 mb-2">Local Command Population Registry</h2>
              <div className="flex items-baseline gap-3">
                 <span className="text-5xl font-black font-serif-heading">{(currentStationDisp?.totalMales + currentStationDisp?.totalFemales || 0).toLocaleString()}</span>
                 <span className="text-[9px] font-black uppercase tracking-[0.15em] opacity-40">Registered PERSONNEL</span>
              </div>
           </div>
           <div className="flex gap-10 z-10 border-l border-white/10 pl-10">
              <div className="text-center">
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Male Count</p>
                 <p className="text-3xl font-black text-blue-400">{(currentStationDisp?.totalMales || 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                 <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Female Count</p>
                 <p className="text-3xl font-black text-pink-400">{(currentStationDisp?.totalFemales || 0).toLocaleString()}</p>
              </div>
           </div>
           <div className="flex items-center gap-2 z-10">
              <button onClick={() => downloadCSV(tempBatches, `${lga}_Local_Disposition`)} title="Export Stats" className="p-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 transition-all"><SpreadsheetIcon /></button>
              <button onClick={() => setIsLedgerOpen(true)} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-[10px] font-black uppercase shadow-xl transition-all border border-emerald-500 tracking-widest">Defaulter Ledger</button>
           </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-official">
           <div className="p-4 bg-slate-50 border-b flex justify-between items-center">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Distribution Detail ({lga})</h3>
              <button onClick={handleDownloadDefaulters} className="text-[9px] font-black uppercase text-[#004d40] flex items-center gap-1.5 hover:underline">
                <DownloadIcon /> Export All Audit Data
              </button>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-3">
              {tempBatches.map((b, i) => (
                <div key={i} className="p-4 bg-white rounded-xl border border-slate-100 flex flex-col items-center shadow-sm hover:border-emerald-200 transition-all">
                   <p className="text-[11px] font-black text-slate-700 uppercase mb-3 border-b border-slate-50 pb-1 w-full text-center">{b.batch}</p>
                   <div className="flex justify-between w-full text-[12px] font-black">
                      <span className="text-blue-600 bg-blue-50/50 px-3 py-1 rounded-lg border border-blue-50">M: {b.males}</span>
                      <span className="text-pink-600 bg-pink-50/50 px-3 py-1 rounded-lg border border-pink-50">F: {b.females}</span>
                   </div>
                   <p className="text-[8px] font-black text-slate-300 uppercase mt-3 tracking-widest">Aggregate: {b.males + b.females}</p>
                </div>
              ))}
              {tempBatches.length === 0 && <p className="col-span-full text-center text-[10px] text-slate-300 py-6 italic">No population disposition found. Please sync batches.</p>}
           </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Audit Archive History</p>
            <button onClick={() => downloadCSV(entries, `${lga}_Audit_Logs`)} className="p-1.5 bg-white border rounded-lg text-slate-400 hover:text-emerald-600 transition-colors shadow-sm"><SpreadsheetIcon /></button>
          </div>
          {entries.map((e: CIMClearance) => (
            <div key={e.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col hover:bg-slate-50 transition-all group shadow-sm animate-official">
               <div className="flex justify-between items-center mb-3">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black text-xs border border-emerald-100">{e.month.substring(0,3)}</div>
                   <div>
                     <h4 className="text-[14px] font-black uppercase text-slate-800 leading-none">{e.month}</h4>
                     <p className="text-[8px] font-bold text-slate-400 uppercase mt-1.5 tracking-tighter">Audit Synchronized • {new Date(e.dateAdded).toLocaleDateString()}</p>
                   </div>
                 </div>
                 <div className="flex gap-6 items-center">
                   <div className="text-center">
                     <span className="block text-[16px] font-black text-emerald-600 leading-none">{e.clearedCount}</span>
                     <span className="text-[8px] font-black text-slate-300 uppercase block tracking-widest mt-0.5">Cleared</span>
                   </div>
                   <div className="text-center border-l border-slate-100 pl-6">
                     <span className="block text-[16px] font-black text-red-600 leading-none">{e.unclearedList?.length || 0}</span>
                     <span className="text-[8px] font-black text-slate-300 uppercase block tracking-widest mt-0.5">Defaulters</span>
                   </div>
                   <div className="flex gap-1.5 no-print opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                     <button onClick={() => shareData(`CIM Audit Report: ${e.month}`, `Status: ${e.month} Archive\nCleared: ${e.clearedCount}\nUncleared: ${e.unclearedList?.length || 0}`)} title="Share Audit Summary" className="w-8 h-8 flex items-center justify-center text-blue-600 bg-white rounded-lg border border-blue-50 shadow-sm hover:bg-blue-600 hover:text-white transition-all"><ShareIcon /></button>
                     <button onClick={() => generateOfficialPDF(e, 'CIM_AUDIT')} title="Export Registry PDF" className="w-8 h-8 flex items-center justify-center text-emerald-600 bg-white rounded-lg border border-emerald-50 shadow-sm hover:bg-emerald-600 hover:text-white transition-all"><DownloadIcon /></button>
                     <button onClick={() => { if(window.confirm('Delete Audit Record?')) deleteData(db, "cim_clearance", e.id); }} className="w-8 h-8 flex items-center justify-center text-red-200 bg-white rounded-lg border border-red-50 shadow-sm hover:bg-red-600 hover:text-white transition-all"><TrashIcon /></button>
                   </div>
                 </div>
               </div>
               {e.ziMinute && (
                 <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100 mt-1 relative">
                   <p className="text-[8px] font-black text-emerald-800 uppercase tracking-widest mb-1.5">Zonal Headquarters Minute:</p>
                   <p className="text-[11px] text-slate-600 leading-relaxed italic font-medium">"{e.ziMinute}"</p>
                 </div>
               )}
            </div>
          ))}
          {entries.length === 0 && <p className="text-center py-10 text-[10px] text-slate-300 uppercase tracking-widest font-black">No published audits found.</p>}
        </div>
      </div>
      
      {isLedgerOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl flex flex-col h-[80vh] animate-official">
            <div className="bg-[#004d40] p-5 text-white flex justify-between items-center shrink-0">
               <div className="flex items-center gap-4">
                 <h3 className="text-sm font-black uppercase tracking-widest font-serif-heading">Defaulter Registry Detail ({lga})</h3>
                 <button onClick={handleDownloadDefaulters} className="p-2 hover:bg-white/10 rounded-lg border border-white/20"><DownloadIcon /></button>
               </div>
               <button onClick={() => setIsLedgerOpen(false)} className="text-xl">✕</button>
            </div>
            <div className="flex-1 overflow-auto p-5 custom-scrollbar">
               <table className="w-full">
                  <thead className="text-[9px] font-black uppercase text-slate-400 text-left border-b tracking-[0.15em]"><tr className="pb-3"><th>Personnel</th><th>Station PPA</th><th className="text-right">Action Desk</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {entries.reduce((acc: any[], entry: any) => [...acc, ...(entry.unclearedList || []).map((cm: any) => ({ ...cm, lga: entry.lga, month: entry.month }))], []).map((cm: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-all group">
                          <td className="py-4">
                            <p className="font-black text-slate-800 text-[12px] uppercase leading-none">{cm.name}</p>
                            <p className="text-[9px] font-bold text-emerald-800 opacity-60 uppercase mt-2">{cm.code} • {cm.month}</p>
                          </td>
                          <td className="py-4 text-[10px] font-black text-slate-400 uppercase">{cm.ppa || 'LGA COMMAND HQ'}</td>
                          <td className="py-4 text-right">
                             <div className="flex items-center justify-end gap-2">
                               <button onClick={() => handleIssueQuery(cm)} disabled={isGenerating} className="px-5 py-2 bg-[#004d40] text-white text-[9px] font-black uppercase rounded-lg hover:bg-black disabled:opacity-50 shadow-md transition-all">Query</button>
                               <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Administrative Notice: ${cm.name} (${cm.code}) defaulted in biometric clearance for ${cm.month}.`)}`)} className="w-9 h-9 flex items-center justify-center text-emerald-600 bg-white border rounded-xl hover:bg-emerald-50 transition-all shadow-sm"><WhatsAppIcon /></button>
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
    </>
  );
};

/* --- CD&R Module --- */
const CDRModule = ({ entries, lga, db, userRole }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    await addData(db, "cdr_cases", { ...formData, lga: lga || 'Daura', status: 'Pending' as CDRStatus });
    setFormData({ name: '', stateCode: '', ppa: '', misconduct: '', dateOfInfraction: '' });
  };
  
  const handleFileUpload = async (id: string, field: 'responseImage' | 'evidenceDocuments', files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      if (field === 'responseImage') {
        const base64 = await fileToBase64(files[0]);
        await updateData(db, "cdr_cases", id, { [field]: base64, status: 'Responded' as CDRStatus });
      } else {
        const existingDocs = entries.find((e: any) => e.id === id)?.evidenceDocuments || [];
        const newBase64s = await Promise.all(Array.from(files).map(f => fileToBase64(f)));
        await updateData(db, "cdr_cases", id, { evidenceDocuments: [...existingDocs, ...newBase64s] });
      }
      window.alert("Document Synced.");
    } catch { window.alert("Failed."); } finally { setIsUploading(false); }
  };

  const handleStatusUpdate = async (id: string, status: CDRStatus) => { await updateData(db, "cdr_cases", id, { status }); };
  const handleMinuteUpdate = async (id: string, field: string, text: string) => { await updateData(db, "cdr_cases", id, { [field]: text }); };

  return (
    <>
      <div className="w-full lg:w-[280px] shrink-0 no-print">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 lg:sticky lg:top-14">
          <h3 className="font-black uppercase text-[8px] text-slate-400 tracking-widest mb-4 border-b border-slate-50 pb-2">Register Administrative Dossier</h3>
          <form onSubmit={handleSubmit} className="space-y-3">
            <input required placeholder="PERSONNEL FULL NAME" className="w-full p-2.5 bg-slate-50 border rounded-lg text-[10px] uppercase outline-none font-black text-slate-700 focus:bg-white transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-2.5 bg-slate-50 border rounded-lg text-[10px] uppercase outline-none font-black text-slate-700 focus:bg-white transition-all" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <input required placeholder="PPA / UNIT STATION" className="w-full p-2.5 bg-slate-50 border rounded-lg text-[10px] uppercase outline-none font-black text-slate-700 focus:bg-white transition-all" value={formData.ppa} onChange={e => setFormData({...formData, ppa: e.target.value.toUpperCase()})} />
            <textarea required placeholder="MISCONDUCT NARRATIVE BRIEF..." className="w-full p-2.5 bg-slate-50 border rounded-lg h-24 text-[10px] outline-none font-medium text-slate-600 focus:bg-white transition-all" value={formData.misconduct} onChange={e => setFormData({...formData, misconduct: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-3 rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-all tracking-widest"><PlusIcon /> Initialize Case</button>
          </form>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        <div className="flex justify-between items-center px-1">
          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Active Disciplinary Cases</p>
          <button onClick={() => downloadCSV(entries, `${lga}_CDR_Registry`)} className="p-1.5 bg-white border rounded-lg text-slate-400 hover:text-[#004d40] transition-colors"><SpreadsheetIcon /></button>
        </div>
        {entries.map((cm: CDRCase) => (
          <div key={cm.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative animate-official group">
             <div className="absolute top-4 right-4 flex items-center gap-3 no-print">
                <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase border tracking-widest shadow-sm ${
                  cm.status === 'Pending' ? 'bg-orange-50 text-orange-600 border-orange-100' : 
                  cm.status === 'Responded' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                  cm.status === 'Minuted_back_to_LGI' ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                  'bg-slate-900 text-white border-slate-800'
                }`}>{cm.status?.replace(/_/g, ' ') || 'Pending'}</span>
                <button onClick={() => { if(window.confirm('Erase this record permanently?')) deleteData(db, "cdr_cases", cm.id); }} className="text-slate-200 hover:text-red-500 transition-colors"><TrashIcon /></button>
             </div>
             <div className="mb-4">
               <h4 className="text-[15px] font-black uppercase tracking-tight text-slate-800 leading-none font-serif-heading">{cm.name}</h4>
               <p className="text-[10px] font-black text-emerald-800 opacity-60 mt-2 uppercase tracking-widest">{cm.stateCode}</p>
             </div>
             
             <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 mb-4 relative overflow-hidden">
                <p className="text-slate-600 text-[12px] font-medium italic leading-relaxed">"{cm.misconduct}"</p>
                {cm.ppa && <p className="mt-3 text-[8px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-100/50 pt-2 flex justify-between items-center">
                  <span>PPA: {cm.ppa}</span>
                  <span className="text-slate-300">STATION: {cm.lga}</span>
                </p>}
             </div>

             {(cm.responseImage || (cm.evidenceDocuments && cm.evidenceDocuments.length > 0)) && (
               <div className="mb-4 p-4 bg-slate-50/50 rounded-xl border border-slate-200">
                 <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5"><FileTextIcon /> Documentation Evidence</p>
                 <div className="flex flex-wrap gap-2">
                   {cm.responseImage && (
                     <button onClick={() => setPreviewImage(cm.responseImage!)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase hover:border-[#004d40] hover:text-[#004d40] transition-all shadow-sm">Review Statement</button>
                   )}
                   {cm.evidenceDocuments?.map((doc: string, i: number) => (
                     <button key={i} onClick={() => setPreviewImage(doc)} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[9px] font-black uppercase hover:border-[#004d40] hover:text-[#004d40] transition-all shadow-sm">Exhibit #{i+1}</button>
                   ))}
                 </div>
               </div>
             )}

             {(cm.lgiMinute || cm.ziMinute) && (
                <div className="mb-4 pl-4 border-l-2 border-slate-100 space-y-3">
                   {cm.lgiMinute && (
                      <div className="bg-blue-50/30 p-3 rounded-xl border border-blue-50">
                         <p className="text-[9px] font-black text-blue-800 uppercase mb-1 tracking-widest">LGI Internal Desk Note:</p>
                         <p className="text-[11px] text-slate-600 leading-normal italic font-medium">"{cm.lgiMinute}"</p>
                      </div>
                   )}
                   {cm.ziMinute && (
                      <div className="bg-emerald-50/30 p-3 rounded-xl border border-emerald-100">
                         <p className="text-[9px] font-black text-emerald-800 uppercase mb-1 tracking-widest">ZI Zonal Headquarters Directive:</p>
                         <p className="text-[11px] text-slate-600 leading-normal italic font-medium">"{cm.ziMinute}"</p>
                      </div>
                   )}
                </div>
             )}

             {userRole === 'LGI' && (cm.status === 'Pending' || cm.status === 'Responded' || cm.status === 'Minuted_back_to_LGI') && (
               <div className="p-4 bg-blue-50/10 rounded-xl border border-blue-100 mb-4 shadow-sm animate-official">
                  <p className="text-[9px] font-black text-blue-800 uppercase tracking-widest mb-4">LGI Administrative Actions</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-400 uppercase">Attach Response Image</label>
                      <input type="file" className="text-[9px] text-slate-500 w-full p-2 bg-white border border-dashed rounded-lg border-blue-200" onChange={(e) => handleFileUpload(cm.id, 'responseImage', e.target.files)} />
                    </div>
                  </div>
                  <textarea className="w-full p-3 bg-white rounded-xl border border-blue-100 text-[11px] h-24 outline-none mb-3 focus:ring-2 focus:ring-blue-100 transition-all font-medium" placeholder="Log LGI Internal Remark..." defaultValue={cm.lgiMinute} onBlur={(e) => handleMinuteUpdate(cm.id, 'lgiMinute', e.target.value)} />
                  <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_ZI')} className="w-full py-3 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-blue-700 transition-all">Transmit to Zonal Headquarters</button>
               </div>
             )}

             {userRole === 'ZI' && cm.status !== 'Forwarded_to_CDR' && (
               <div className="p-4 bg-emerald-50/20 rounded-xl border border-emerald-100 mb-4 shadow-sm animate-official">
                  <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-3">ZI Zonal Administration Directive Terminal</p>
                  <textarea className="w-full p-3 bg-white rounded-xl border border-emerald-100 text-[11px] h-24 outline-none mb-3 focus:ring-2 focus:ring-emerald-100 transition-all font-medium" placeholder="Issue official zonal minute..." defaultValue={cm.ziMinute} onBlur={(e) => handleMinuteUpdate(cm.id, 'ziMinute', e.target.value)} />
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_to_CIM')} className="py-2.5 bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase shadow-md hover:bg-black transition-all">Route to CIM</button>
                    <button onClick={() => handleStatusUpdate(cm.id, 'Minuted_back_to_LGI')} className="py-2.5 bg-yellow-600 text-white rounded-lg text-[9px] font-black uppercase shadow-md hover:bg-yellow-700 transition-all">Query LGI Desk</button>
                    <button onClick={() => handleStatusUpdate(cm.id, 'Forwarded_to_CDR')} className="py-2.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase shadow-md hover:bg-black transition-all">Close Case</button>
                  </div>
               </div>
             )}

             <div className="flex justify-end items-center border-t border-slate-50 pt-4 gap-4 no-print">
               <button onClick={() => shareData(`CDR Case: ${cm.name}`, `Misconduct: ${cm.misconduct}\nStatus: ${cm.status || 'Pending'}`)} title="Share Dossier Summary" className="w-10 h-10 flex items-center justify-center text-blue-600 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all"><ShareIcon /></button>
               <button onClick={() => generateOfficialPDF(cm, 'CDR_CASE')} title="Download Case Registry PDF" className="w-10 h-10 flex items-center justify-center text-slate-400 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all"><DownloadIcon /></button>
               <button className="w-10 h-10 flex items-center justify-center text-emerald-600 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-all" onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Administrative Record Updated for ${cm.name}. Case Status: ${cm.status || 'Under Review'}.`)}`)} title="WhatsApp Update"><WhatsAppIcon /></button>
             </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-center text-slate-400 py-16 uppercase tracking-[0.2em] font-black text-[9px]">No disciplinary dossiers found.</p>}
      </div>

      {previewImage && (
        <div className="fixed inset-0 bg-slate-950/90 z-[3000] flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setPreviewImage(null)}>
          <div className="max-w-5xl w-full max-h-[90vh] flex flex-col items-center gap-6 animate-official">
             <img src={previewImage} className="max-w-full max-h-full rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border-4 border-white/10 object-contain" alt="Asset Evidence" />
             <div className="flex gap-4">
               <a href={previewImage} download="Exhibit_Evidence" className="px-8 py-3 bg-[#004d40] text-white font-black uppercase text-[10px] rounded-xl shadow-xl hover:bg-black transition-all">Download Original</a>
               <button className="px-8 py-3 bg-white text-black font-black uppercase text-[10px] rounded-xl shadow-xl hover:bg-slate-100 transition-all">Dismiss Preview</button>
             </div>
          </div>
        </div>
      )}
    </>
  );
};

/* --- CDS Module --- */
const CDSModule = ({ groups, projects, lga, db, userRole }: any) => {
  const [view, setView] = useState<'UNITS' | 'PROJECTS'>('UNITS');
  const [groupForm, setGroupForm] = useState({ groupName: '', meetingDay: 'Wednesday' });
  const [projectForm, setProjectForm] = useState({ cmName: '', stateCode: '', projectName: '', projectType: 'Health', location: '', description: '', status: 'Ongoing' as const });

  const projectStats = useMemo(() => {
    return {
      total: projects.length,
      completed: projects.filter((p: any) => p.status === 'Completed').length,
      ongoing: projects.filter((p: any) => p.status === 'Ongoing').length,
    };
  }, [projects]);

  return (
    <>
      <div className="w-full lg:w-[280px] flex flex-col gap-4 no-print shrink-0">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex bg-slate-50 p-1 rounded-xl mb-5 border border-slate-100 shadow-inner">
             <button onClick={() => setView('UNITS')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all tracking-widest ${view === 'UNITS' ? 'bg-[#004d40] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Unit Hub</button>
             <button onClick={() => setView('PROJECTS')} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all tracking-widest ${view === 'PROJECTS' ? 'bg-[#004d40] text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Project Logs</button>
          </div>

          {view === 'UNITS' ? (
            <div className="animate-official">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-black uppercase text-[8px] text-slate-400 tracking-[0.2em]">Initialize CDS Unit</h3>
                 <button onClick={() => downloadCSV(groups, `${lga}_CDS_Units`)} className="text-slate-300 hover:text-emerald-600 transition-colors"><SpreadsheetIcon /></button>
              </div>
              <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_groups", { ...groupForm, lga }); setGroupForm({groupName:'',meetingDay:'Wednesday'}); }} className="space-y-3">
                <input required placeholder="UNIT NAME (E.G. BAND)" className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-black uppercase outline-none focus:bg-white transition-all" value={groupForm.groupName} onChange={e => setGroupForm({...groupForm, groupName: e.target.value.toUpperCase()})} />
                <select className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-black uppercase outline-none focus:bg-white transition-all" value={groupForm.meetingDay} onChange={e => setGroupForm({...groupForm, meetingDay: e.target.value})}>
                  <option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option>
                </select>
                <button className="w-full bg-[#004d40] text-white p-3 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-2 shadow-lg hover:bg-black transition-all tracking-widest"><PlusIcon /> Start Unit Hub</button>
              </form>
            </div>
          ) : (
            <div className="animate-official">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-black uppercase text-[8px] text-slate-400 tracking-[0.2em]">Log Personnel Project</h3>
                 <button onClick={() => downloadCSV(projects, `${lga}_CDS_Project_Audit`)} className="text-slate-300 hover:text-emerald-600 transition-colors"><SpreadsheetIcon /></button>
              </div>
              <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "cds_projects", { ...projectForm, lga }); setProjectForm({cmName:'',stateCode:'',projectName:'',projectType:'Health',location:'',description:'',status:'Ongoing'}); }} className="space-y-3">
                <input required placeholder="CORPS MEMBER NAME" className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-black uppercase outline-none focus:bg-white transition-all" value={projectForm.cmName} onChange={e => setProjectForm({...projectForm, cmName: e.target.value.toUpperCase()})} />
                <input required placeholder="STATE CODE" className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-black uppercase outline-none focus:bg-white transition-all" value={projectForm.stateCode} onChange={e => setProjectForm({...projectForm, stateCode: e.target.value.toUpperCase()})} />
                <input required placeholder="OFFICIAL PROJECT TITLE" className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-black uppercase outline-none focus:bg-white transition-all" value={projectForm.projectName} onChange={e => setProjectForm({...projectForm, projectName: e.target.value.toUpperCase()})} />
                <select className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-black uppercase outline-none focus:bg-white transition-all" value={projectForm.projectType} onChange={e => setProjectForm({...projectForm, projectType: e.target.value})}>
                  <option value="Health">Healthcare</option>
                  <option value="Education">Educational</option>
                  <option value="Infrastructure">Infrastructure</option>
                  <option value="Environmental">Environmental</option>
                  <option value="Charity">Social Welfare</option>
                </select>
                <input placeholder="IMPACT VILLAGE / AREA" className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-black uppercase outline-none focus:bg-white transition-all" value={projectForm.location} onChange={e => setProjectForm({...projectForm, location: e.target.value.toUpperCase()})} />
                <textarea required placeholder="PROJECT SCOPE NARRATIVE..." className="w-full p-2.5 bg-slate-50 rounded-lg border h-24 text-[10px] outline-none font-medium text-slate-600 focus:bg-white transition-all" value={projectForm.description} onChange={e => setProjectForm({...projectForm, description: e.target.value})} />
                <select className="w-full p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] font-black uppercase outline-none focus:bg-white transition-all" value={projectForm.status} onChange={e => setProjectForm({...projectForm, status: e.target.value as any})}>
                  <option value="Ongoing">Execution: In Progress</option>
                  <option value="Completed">Execution: Finalized</option>
                </select>
                <button className="w-full bg-[#004d40] text-white p-3 rounded-xl font-black uppercase text-[9px] flex items-center justify-center gap-2 shadow-lg hover:bg-black transition-all tracking-widest"><PlusIcon /> Submit Project Case</button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {userRole === 'ZI' && (
          <div className="grid grid-cols-3 gap-4 animate-official">
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Project Census</span>
                <span className="text-3xl font-black text-slate-800 font-serif-heading">{projectStats.total}</span>
             </div>
             <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm flex flex-col items-center">
                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-2">Commissioned</span>
                <span className="text-3xl font-black text-emerald-600 font-serif-heading">{projectStats.completed}</span>
             </div>
             <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm flex flex-col items-center">
                <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest mb-2">Active Execution</span>
                <span className="text-3xl font-black text-amber-600 font-serif-heading">{projectStats.ongoing}</span>
             </div>
          </div>
        )}

        {view === 'UNITS' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 content-start animate-official">
            {groups.map((g: any) => (
              <div key={g.id} className="bg-white p-4 rounded-xl border border-slate-200 relative group shadow-sm overflow-hidden h-fit hover:shadow-md transition-all">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-[#004d40]"></div>
                <h4 className="text-[13px] font-black uppercase text-slate-800 leading-tight pl-2 font-serif-heading">{g.groupName}</h4>
                <div className="flex items-center gap-2 text-[8px] font-black text-emerald-800 tracking-[0.15em] uppercase pl-2 mt-3">
                  <span className="bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100 shadow-inner">{g.meetingDay}</span>
                  <span className="text-slate-300">Station: {g.lga}</span>
                </div>
                <div className="absolute top-4 right-4 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => shareData(`CDS Unit: ${g.groupName}`, `Meeting Context: ${g.meetingDay} Gatherings\nLGA: ${g.lga}`)} className="text-blue-500 scale-90 hover:scale-110 transition-transform"><ShareIcon /></button>
                  <button onClick={() => { if(window.confirm('Dissolve this CDS Unit?')) deleteData(db, "cds_groups", g.id); }} className="text-red-300 hover:text-red-500 scale-90 hover:scale-110 transition-transform"><TrashIcon /></button>
                </div>
              </div>
            ))}
            {groups.length === 0 && <p className="col-span-full text-center text-slate-400 py-20 uppercase tracking-[0.2em] font-black text-[9px]">No active units registered.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 content-start animate-official">
            {projects.map((p: CDSPersonalProject) => (
              <div key={p.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative group overflow-hidden h-fit hover:shadow-md transition-all">
                <div className={`absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 rotate-45 opacity-10 transition-transform group-hover:scale-110 ${p.status === 'Completed' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <div className="flex gap-2 items-center mb-3">
                         <span className={`inline-block px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm ${
                           p.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                         }`}>{p.status}</span>
                         <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-slate-200 shadow-sm">{p.projectType}</span>
                      </div>
                      <h4 className="text-[16px] font-black uppercase text-slate-800 leading-tight font-serif-heading pr-8">{p.projectName}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">PERSONNEL: {p.cmName} ({p.stateCode})</p>
                   </div>
                   <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                      <button onClick={() => shareData(`CDS Project Commission: ${p.projectName}`, `Member: ${p.cmName}\nImpact: ${p.description}`)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all shadow-sm"><ShareIcon /></button>
                      <button onClick={() => { if(window.confirm('Expunge project record?')) deleteData(db, "cds_projects", p.id); }} className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm"><TrashIcon /></button>
                   </div>
                </div>
                <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 text-[11px] text-slate-600 leading-relaxed italic mb-4 font-medium">
                   "{p.description}"
                </div>
                <div className="flex flex-col gap-2 text-[8px] font-black uppercase tracking-widest text-slate-300 border-t border-slate-50 pt-4">
                   <div className="flex justify-between items-center">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-100">Loc: {p.location || 'Not Specified'}</span>
                      <span className="opacity-60">FILED: {new Date(p.dateAdded).toLocaleDateString()}</span>
                   </div>
                   <div className="flex justify-between items-center mt-1">
                      <span className="text-emerald-800">STATION UNIT: {p.lga}</span>
                      <button onClick={() => (window as any).open(`https://wa.me/?text=${encodeURIComponent(`Project Milestone Update: "${p.projectName}" by ${p.cmName} is currently ${p.status}.`)}`)} className="text-emerald-600 flex items-center gap-1.5 hover:text-emerald-700 transition-colors bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100"><WhatsAppIcon /> Follow-up</button>
                   </div>
                </div>
              </div>
            ))}
            {projects.length === 0 && <p className="col-span-full text-center text-slate-400 py-20 uppercase tracking-[0.2em] font-black text-[9px]">No personnel project logs registered.</p>}
          </div>
        )}
      </div>
    </>
  );
};

/* --- SAED Module --- */
const SAEDModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ centerName: '', address: '', cmCount: 0, fee: 0 });
  return (
    <>
      <div className="w-full lg:w-[280px] flex flex-col gap-4 no-print shrink-0">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-black uppercase text-[8px] text-slate-400 tracking-[0.2em]">Register Skills Acquisition Hub</h3>
             <button onClick={() => downloadCSV(entries, `${lga}_SAED_Census`)} className="text-slate-300 hover:text-emerald-600 transition-colors"><SpreadsheetIcon /></button>
          </div>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "saed_centers", { ...formData, lga }); setFormData({centerName:'',address:'',cmCount:0,fee:0}); }} className="space-y-3">
            <input required placeholder="TRAINING HUB NAME" className="w-full p-2.5 bg-slate-50 rounded-lg border text-[10px] outline-none font-black uppercase text-slate-700 focus:bg-white transition-all" value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value.toUpperCase()})} />
            <input required placeholder="OFFICIAL STATION ADDRESS" className="w-full p-2.5 bg-slate-50 rounded-lg border text-[10px] outline-none font-medium focus:bg-white transition-all" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value.toUpperCase()})} />
            <div className="grid grid-cols-2 gap-2">
               <div className="space-y-1">
                 <label className="text-[7px] font-black text-slate-400 uppercase ml-1">Census</label>
                 <input type="number" placeholder="0" className="w-full p-2.5 bg-white rounded-lg border text-[11px] font-black text-blue-600" value={formData.cmCount || ''} onChange={e => setFormData({...formData, cmCount: parseInt(e.target.value) || 0})} />
               </div>
               <div className="space-y-1">
                 <label className="text-[7px] font-black text-slate-400 uppercase ml-1">₦ Fee</label>
                 <input type="number" placeholder="0" className="w-full p-2.5 bg-white rounded-lg border text-[11px] font-black text-emerald-600" value={formData.fee || ''} onChange={e => setFormData({...formData, fee: parseInt(e.target.value) || 0})} />
               </div>
            </div>
            <button className="w-full bg-[#004d40] text-white p-3 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-all"><PlusIcon /> Establish Hub</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
        {entries.map((c: any) => (
          <div key={c.id} className="bg-white p-5 rounded-xl border border-slate-200 relative group animate-official hover:shadow-md overflow-hidden h-fit transition-all">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-[#004d40]"></div>
            <h4 className="text-[14px] font-black uppercase text-slate-800 leading-tight font-serif-heading">{c.centerName}</h4>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 leading-none tracking-tight">{c.address}</p>
            <div className="flex gap-10 pt-4 border-t border-slate-50 mt-4">
               <div><p className="text-[8px] font-black text-slate-300 mb-1 uppercase tracking-widest">Active Census</p><p className="text-[20px] font-black text-[#004d40]">{c.cmCount}</p></div>
               <div><p className="text-[8px] font-black text-slate-300 mb-1 uppercase tracking-widest">Training Fee</p><p className="text-[20px] font-black text-emerald-600">₦{Number(c.fee).toLocaleString()}</p></div>
            </div>
            <div className="absolute top-5 right-5 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => shareData(`SAED Hub Context: ${c.centerName}`, `Hub Training Fee: ₦${c.fee}\nCensus: ${c.cmCount}`)} className="text-blue-500 scale-90 hover:scale-110 shadow-sm bg-white p-2 rounded-lg border border-blue-50"><ShareIcon /></button>
              <button onClick={() => { if(window.confirm('Remove training hub?')) deleteData(db, "saed_centers", c.id); }} className="text-red-300 hover:text-red-500 scale-90 hover:scale-110 shadow-sm bg-white p-2 rounded-lg border border-red-50"><TrashIcon /></button>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="col-span-full text-center text-slate-400 py-20 uppercase tracking-[0.2em] font-black text-[9px]">No SAED hubs established.</p>}
      </div>
    </>
  );
};

/* --- CWHS Module --- */
const CWHSModule = ({ entries, db, lga }: any) => {
  const [formData, setFormData] = useState({ name: '', stateCode: '', category: ReportCategory.ABSCONDED, details: '' });
  return (
    <>
      <div className="w-full lg:w-[280px] shrink-0 no-print">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 lg:sticky lg:top-14">
          <div className="flex justify-between items-center mb-4">
             <h3 className="font-black uppercase text-[8px] text-slate-400 tracking-[0.2em]">Log Personnel Incident</h3>
             <button onClick={() => downloadCSV(entries, `${lga}_CWHS_Incident_Audit`)} className="text-slate-300 hover:text-emerald-600 transition-colors"><SpreadsheetIcon /></button>
          </div>
          <form onSubmit={async (e) => { e.preventDefault(); await addData(db, "nysc_reports", { ...formData, lga }); setFormData({name:'',stateCode:'',category:ReportCategory.ABSCONDED,details:''}); }} className="space-y-3">
            <input required placeholder="CORPS MEMBER FULL NAME" className="w-full p-2.5 bg-slate-50 rounded-lg border text-[10px] font-black uppercase text-slate-700 focus:bg-white transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value.toUpperCase()})} />
            <input required placeholder="STATE CODE" className="w-full p-2.5 bg-slate-50 rounded-lg border text-[10px] font-black uppercase text-slate-700 focus:bg-white transition-all" value={formData.stateCode} onChange={e => setFormData({...formData, stateCode: e.target.value.toUpperCase()})} />
            <select className="w-full p-2.5 bg-slate-50 rounded-lg border text-[10px] font-black uppercase outline-none focus:bg-white transition-all" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as ReportCategory})}>
              {Object.values(ReportCategory).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <textarea placeholder="INCIDENT BRIEF SUMMARY..." className="w-full p-2.5 bg-slate-50 rounded-lg border h-28 text-[10px] font-medium text-slate-600 focus:bg-white transition-all" value={formData.details} onChange={e => setFormData({...formData, details: e.target.value})} />
            <button className="w-full bg-[#004d40] text-white p-3 rounded-xl font-black uppercase text-[9px] shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-all tracking-widest"><PlusIcon /> File Incident Case</button>
          </form>
        </div>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
        {entries.map((e: any) => (
          <div key={e.id} className="bg-white p-5 rounded-xl border border-slate-200 relative group animate-official shadow-sm overflow-hidden h-fit hover:shadow-md transition-all">
            <h4 className="text-[15px] font-black uppercase text-slate-800 leading-tight font-serif-heading">{e.name}</h4>
            <p className="text-[10px] font-black text-emerald-800 opacity-60 mt-2 uppercase tracking-[0.15em]">{e.stateCode}</p>
            <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 my-4 shadow-inner"><p className="text-[11px] text-slate-600 italic leading-relaxed font-medium">"{e.details || 'No narrative brief provided.'}"</p></div>
            <div className="flex justify-between items-center border-t border-slate-50 pt-4">
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                 <span className="bg-slate-100 px-2 py-1 rounded-lg border border-slate-100 text-slate-400">{e.category}</span>
                 <span>Station: {e.lga}</span>
               </span>
               <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => shareData(`Personnel Incident: ${e.name}`, `Category: ${e.category}\nBrief: ${e.details}`)} className="text-blue-500 scale-90 hover:scale-110 bg-white p-2 rounded-lg border border-blue-50 shadow-sm transition-all"><ShareIcon /></button>
                 <button onClick={() => { if(window.confirm('Erase this incident report?')) deleteData(db, "nysc_reports", e.id); }} className="text-red-300 hover:text-red-500 scale-90 hover:scale-110 bg-white p-2 rounded-lg border border-red-50 shadow-sm transition-all"><TrashIcon /></button>
               </div>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="col-span-full text-center text-slate-400 py-20 uppercase tracking-[0.2em] font-black text-[9px]">No personnel incidents recorded.</p>}
      </div>
    </>
  );
};

export default App;

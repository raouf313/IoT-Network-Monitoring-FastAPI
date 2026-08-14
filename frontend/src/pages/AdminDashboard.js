import React,{useState,useEffect,useCallback,useRef} from 'react';
import * as XLSX from 'xlsx';
import {getDashboard,getPannes,getAlertes,marquerLue,analyserIA,
        getTechniciens,updateTechnicien,getMissions,assignerMission,
        creerMission,creerPanne,ajouterTechnicien,supprimerTechnicien,
        getRapports,updateRapportStatut,getRapportPhotos,
        getHistoriqueCapteur,updatePanneStatut,updateMission,
        importerMissionsExcel,downloadTemplateExcel,
        genererRapportPDF,genererMissionsPDF} from '../hooks/useApi';
import {LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,
        ResponsiveContainer,BarChart,Bar,Legend} from 'recharts';


const TABS=['📊 Dashboard','📡 Capteurs','📋 Missions','👷 Techniciens','📄 Rapports','🔔 Alertes'];
const PC={critique:'#E30613',eleve:'#F7941D',moyen:'#0072BC',faible:'#39B54A'};

// ══════════════════════════════════════════════════════════
// Widget Wokwi — Temps Réel via WebSocket
// ══════════════════════════════════════════════════════════
function WokwiLiveWidget() {
  const [temp, setTemp]         = useState(null);
  const [hum,  setHum]          = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [pannes, setPannes]     = useState([]);
  const [history, setHistory]   = useState([]);
  const wsRef = useRef(null);

  useEffect(()=>{
    const WS_URL = `ws://${window.location.hostname}:8000/ws/dashboard`;
    let ws;
    const connect = () => {
      ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen  = () => { setConnected(true); };
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 4000);
      };
      ws.onerror = () => setConnected(false);

      ws.onmessage = (e) => {
  try {
    const d = JSON.parse(e.data);
    if (d.temperature !== undefined || d.humidite !== undefined || d.pannes_creees) {
      const t = d.temperature ?? d.temp;
      const h = d.humidite   ?? d.hum;
      if (t !== undefined) setTemp(t);
      if (h !== undefined) setHum(h);
      setLastUpdate(new Date());
      setHistory(prev => [...prev.slice(-29), {
        t: new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit', second:'2-digit'}),
        temp: t, hum: h
      }]);
      const pannesJdod = d.pannes_creees ?? d.pannes ?? [];
      if (pannesJdod.length > 0) setPannes(prev => [...pannesJdod, ...prev].slice(0,5));
    }
  } catch(err) { console.error("WS Error parsing:", err); }
    };
    };
    connect();
    return () => { ws?.close(); };
  },[]);

  const alertTemp = temp !== null && (temp > 35 || temp < 10);
  const alertHum  = hum  !== null && (hum  > 80 || hum  < 20);
  const cs = { background:'#fff', borderRadius:12, border:'1px solid #e0e7ff', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' };

  return (
    <div style={{...cs, padding:16, position:'relative', overflow:'hidden'}}>
      <div style={{position:'absolute',top:0,left:0,right:0,height:3,
        background: connected ? 'linear-gradient(90deg,#39B54A,#0072BC)' : 'repeating-linear-gradient(90deg,#e2e8f0 0,#e2e8f0 8px,transparent 8px,transparent 16px)' }}/>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
        <div style={{fontSize:20}}>🔌</div>
        <div style={{flex:1}}>
          <p style={{fontWeight:800,fontSize:14,fontFamily:'var(--font-d)'}}>Wokwi ESP32 — Temps Réel</p>
          <p style={{fontSize:11,color:'#94a3b8',fontFamily:'var(--font-b)'}}>WebSocket · {connected ? 'Connecté' : 'Déconnecté'} · {lastUpdate ? lastUpdate.toLocaleTimeString('fr-FR') : '—'}</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <div style={{width:10,height:10,borderRadius:'50%', background: connected ? '#39B54A' : '#e2e8f0', boxShadow: connected ? '0 0 8px #39B54A' : 'none', transition:'all .3s' }}/>
          <span style={{fontSize:11,fontWeight:700,color: connected ? '#39B54A' : '#94a3b8',fontFamily:'var(--font-b)'}}>{connected ? 'LIVE' : 'OFF'}</span>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
        <div style={{ background: alertTemp ? '#fff5f5' : '#f8fafc', border: `2px solid ${alertTemp ? '#E30613' : '#e0e7ff'}`, borderRadius:10, padding:14, textAlign:'center', transition:'all .3s' }}>
          <div style={{fontSize:11,color:'#94a3b8',fontFamily:'var(--font-b)',letterSpacing:'.08em',marginBottom:6}}>TEMPÉRATURE</div>
          <div style={{ fontSize:40, fontWeight:900, fontFamily:'var(--font-d)', lineHeight:1, color: alertTemp ? '#E30613' : (temp !== null ? '#1e293b' : '#cbd5e1'), animation: alertTemp ? 'pulse 1s infinite' : 'none' }}>{temp !== null ? temp.toFixed(1) : '—'}</div>
          <div style={{fontSize:16,color:'#94a3b8',fontFamily:'var(--font-b)'}}>°C</div>
          {alertTemp && <div style={{marginTop:6,fontSize:11,fontWeight:800,color:'#E30613',fontFamily:'var(--font-b)'}}>{temp > 35 ? '🔴 TROP CHAUD' : '🔵 TROP FROID'}</div>}
          <div style={{marginTop:8,height:4,background:'#e2e8f0',borderRadius:2}}>
            <div style={{ height:'100%',borderRadius:2,transition:'width .5s', width:`${Math.min(100,Math.max(0,((temp||0)+10)/70*100))}%`, background: alertTemp ? '#E30613' : '#39B54A' }}/>
          </div>
        </div>
        <div style={{ background: alertHum ? '#fff8f0' : '#f8fafc', border: `2px solid ${alertHum ? '#F7941D' : '#e0e7ff'}`, borderRadius:10, padding:14, textAlign:'center', transition:'all .3s' }}>
          <div style={{fontSize:11,color:'#94a3b8',fontFamily:'var(--font-b)',letterSpacing:'.08em',marginBottom:6}}>HUMIDITÉ</div>
          <div style={{ fontSize:40, fontWeight:900, fontFamily:'var(--font-d)', lineHeight:1, color: alertHum ? '#F7941D' : (hum !== null ? '#1e293b' : '#cbd5e1'), animation: alertHum ? 'pulse 1s infinite' : 'none' }}>{hum !== null ? hum.toFixed(1) : '—'}</div>
          <div style={{fontSize:16,color:'#94a3b8',fontFamily:'var(--font-b)'}}>%</div>
          {alertHum && <div style={{marginTop:6,fontSize:11,fontWeight:800,color:'#F7941D',fontFamily:'var(--font-b)'}}>{hum > 80 ? '💧 HUMIDITÉ HAUTE' : '🏜️ TROP SÈCHE'}</div>}
          <div style={{marginTop:8,height:4,background:'#e2e8f0',borderRadius:2}}>
            <div style={{ height:'100%',borderRadius:2,transition:'width .5s', width:`${Math.min(100,Math.max(0,hum||0))}%`, background: alertHum ? '#F7941D' : '#0072BC' }}/>
          </div>
        </div>
      </div>
      {history.length > 1 && (
        <div style={{marginBottom:14}}>
          <p style={{fontSize:11,color:'#94a3b8',fontFamily:'var(--font-b)',marginBottom:6,letterSpacing:'.06em'}}>HISTORIQUE SESSION</p>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={history} margin={{top:2,right:2,bottom:2,left:2}}>
              <Line type="monotone" dataKey="temp" stroke="#E30613" strokeWidth={2} dot={false} name="Temp°C"/>
              <Line type="monotone" dataKey="hum"  stroke="#0072BC" strokeWidth={2} dot={false} name="Hum%"/>
              <Tooltip contentStyle={{background:'#fff',border:'1px solid #e0e7ff',borderRadius:6,fontSize:11}} formatter={(v,n)=>[v?.toFixed(1), n==='temp'?'Temp°C':'Hum%']}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {pannes.length > 0 && (
        <div>
          <p style={{fontSize:11,color:'#E30613',fontFamily:'var(--font-b)',fontWeight:700,marginBottom:6,letterSpacing:'.06em'}}>🚨 PANNES CRÉÉES EN BD ({pannes.length})</p>
          {pannes.map((p,i)=>(
            <div key={i} style={{ background:'#fff5f5',border:'1px solid #ffd0d0',borderRadius:6, padding:'6px 10px',marginBottom:4, display:'flex',justifyContent:'space-between',alignItems:'center' }}>
              <span style={{fontSize:12,fontFamily:'var(--font-b)',fontWeight:600}}>{p.type==='temperature' ? '🌡️' : '💧'} {p.type} — {p.valeur?.toFixed?.(1)}{p.type==='temperature'?'°C':'%'}</span>
              <span style={{fontSize:11,color:'#E30613',fontFamily:'var(--font-b)',fontWeight:700}}>#{p.ticket}</span>
            </div>
          ))}
        </div>
      )}
      {!connected && <div style={{textAlign:'center',padding:'8px 0',color:'#94a3b8',fontSize:12,fontFamily:'var(--font-b)'}}>En attente de connexion ESP32 (Wokwi)...</div>}
    </div>
  );
}

function exportExcel(rows, cols, filename, sheetTitle = 'Données') {
  const header = cols.map(c => c.label);
  const data = rows.map(r => cols.map(c => { const v = r[c.key]; if (v === null || v === undefined) return ''; if (typeof v === 'boolean') return v ? 'Oui' : 'Non'; return v; }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws['!cols'] = cols.map(() => ({ wch: 22 }));
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[addr]) continue;
    ws[addr].s = { fill: { fgColor: { rgb: 'E30613' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Arial', sz: 11 }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top:{style:'thin',color:{rgb:'CCCCCC'}}, bottom:{style:'thin',color:{rgb:'CCCCCC'}}, left:{style:'thin',color:{rgb:'CCCCCC'}}, right:{style:'thin',color:{rgb:'CCCCCC'}} } };
  }
  for (let R = 1; R <= data.length; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const addr = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      ws[addr].s = { fill: { fgColor: { rgb: R % 2 === 0 ? 'F8FAFC' : 'FFFFFF' } }, font: { name: 'Arial', sz: 10 }, border: { top:{style:'thin',color:{rgb:'E2E8F0'}}, bottom:{style:'thin',color:{rgb:'E2E8F0'}}, left:{style:'thin',color:{rgb:'E2E8F0'}}, right:{style:'thin',color:{rgb:'E2E8F0'}} } };
    }
  }
  XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename.replace(/\.[^/.]+$/, '') + '.xlsx');
}

// ══════════════════════════════════════════════════════════
// Barre de Recherche & Tri
// ══════════════════════════════════════════════════════════
function SearchSortBar({ search, onSearchChange, sort, onSortChange, sortOptions, placeholder }) {
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', background:'#fff', borderRadius:10, padding:'8px 14px', border:'1px solid #e0e7ff', boxShadow:'0 1px 4px rgba(0,114,188,0.04)' }}>
      <div style={{flex:1, minWidth:180, position:'relative'}}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:14, opacity:.4, pointerEvents:'none' }}>🔍</span>
        <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder={placeholder || 'Rechercher...'}
          style={{ width:'100%', padding:'8px 10px 8px 34px', background:'#f8fafc', border:'1.5px solid #e0e7ff', borderRadius:8, fontSize:13, color:'#1e293b', fontFamily:'var(--font-b)', outline:'none', transition:'border .2s' }}
          onFocus={e => e.target.style.borderColor = '#0072BC'} onBlur={e => e.target.style.borderColor = '#e0e7ff'} />
        {search && <button onClick={() => onSearchChange('')} style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'#e2e8f0', border:'none', borderRadius:'50%', width:18, height:18, fontSize:10, lineHeight:'18px', textAlign:'center', cursor:'pointer', color:'#64748b', padding:0, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>}
      </div>
      <div style={{display:'flex', alignItems:'center', gap:6}}>
        <span style={{fontSize:11, color:'#94a3b8', fontWeight:600, whiteSpace:'nowrap'}}>Trier par</span>
        <select value={sort} onChange={e => onSortChange(e.target.value)}
          style={{ background:'#f8fafc', border:'1.5px solid #e0e7ff', borderRadius:8, padding:'8px 10px', fontSize:12, color:'#1e293b', fontFamily:'var(--font-b)', fontWeight:600, cursor:'pointer', outline:'none', minWidth:130 }}>
          {sortOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        {sort && <span style={{ fontSize:10, color:'#0072BC', background:'#eff6ff', borderRadius:20, padding:'2px 8px', fontWeight:600, border:'1px solid #bfdbfe' }}>{sortOptions.find(o => o.value === sort)?.label?.split(' — ')[0] || 'Trié'}</span>}
      </div>
    </div>
  );
}

function filterAndSortMissions(missions, search, sort) {
  if (!missions || !Array.isArray(missions)) return [];
  let filtered = [...missions];
  const q = (search || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(m => {
      if (!m) return false;
      return ((m.description||'') + ' ' + (m.localisation||'') + ' ' + (m.technicien_nom||'') + ' ' + (m.panne_ticket||'') + ' #' + (m.id||'')).toLowerCase().includes(q);
    });
  }
  if (sort === 'date_desc') filtered.sort((a,b) => new Date(b.date_creation||0) - new Date(a.date_creation||0));
  else if (sort === 'date_asc') filtered.sort((a,b) => new Date(a.date_creation||0) - new Date(b.date_creation||0));
  else if (sort === 'alpha_asc') filtered.sort((a,b) => (a.description||'').localeCompare(b.description||''));
  else if (sort === 'alpha_desc') filtered.sort((a,b) => (b.description||'').localeCompare(a.description||''));
  else if (sort === 'priorite') { const P={critique:0,eleve:1,moyen:2,faible:3}; filtered.sort((a,b)=>(P[a.priorite]??4)-(P[b.priorite]??4)); }
  else if (sort === 'statut') { const S={terminee:0,en_cours:1,acceptee:2,en_attente:3,refusee:4}; filtered.sort((a,b)=>(S[a.statut]??9)-(S[b.statut]??9)); }
  if (!sort) { const P={critique:0,eleve:1,moyen:2,faible:3}; filtered.sort((a,b) => { const ps=(P[a.priorite]??4)-(P[b.priorite]??4); return ps!==0?ps:new Date(b.date_creation||0)-new Date(a.date_creation||0); }); }
  return filtered;
}

function filterAndSortRapports(rapports, search, sort) {
  if (!rapports || !Array.isArray(rapports)) return [];
  let filtered = [...rapports];
  const q = (search || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(r => {
      if (!r) return false;
      return ((r.titre||'') + ' ' + (r.contenu||'') + ' ' + (r.technicien_nom||'') + ' ' + (r.mission_desc||'') + ' #' + (r.id||'')).toLowerCase().includes(q);
    });
  }
  if (sort === 'date_desc') filtered.sort((a,b) => new Date(b.date_creation||0) - new Date(a.date_creation||0));
  else if (sort === 'date_asc') filtered.sort((a,b) => new Date(a.date_creation||0) - new Date(b.date_creation||0));
  else if (sort === 'alpha_asc') filtered.sort((a,b) => (a.titre||'').localeCompare(b.titre||''));
  else if (sort === 'alpha_desc') filtered.sort((a,b) => (b.titre||'').localeCompare(a.titre||''));
  else if (sort === 'statut') { const S={approuve:0,soumis:1,rejete:2,brouillon:3}; filtered.sort((a,b)=>(S[a.statut]??9)-(S[b.statut]??9)); }
  if (!sort) filtered.sort((a,b) => new Date(b.date_creation||0) - new Date(a.date_creation||0));
  return filtered;
}

function filterAndSortAlertes(alertes, search, sort) {
  if (!alertes || !Array.isArray(alertes)) return [];
  let filtered = [...alertes];
  const q = (search || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(a => {
      if (!a) return false;
      return ((a.message||'') + ' ' + (a.type||'') + ' #' + (a.id||'')).toLowerCase().includes(q);
    });
  }
  if (sort === 'date_desc') filtered.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  else if (sort === 'date_asc') filtered.sort((a,b) => new Date(a.created_at||0) - new Date(b.created_at||0));
  else if (sort === 'severite') { const S={critique:0,warning:1,info:2}; filtered.sort((a,b)=>(S[a.severite]??9)-(S[b.severite]??9)); }
  else if (sort === 'lue') filtered.sort((a,b) => (a.lue?1:0) - (b.lue?1:0));
  if (!sort) filtered.sort((a,b) => new Date(b.created_at||0) - new Date(a.created_at||0));
  return filtered;
}

function filterAndSortTechniciens(techniciens, search, sort) {
  if (!techniciens || !Array.isArray(techniciens)) return [];
  let filtered = [...techniciens];
  const q = (search || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(t => {
      if (!t) return false;
      return ((t.nom||'') + ' ' + (t.email||'') + ' ' + (t.specialite||'') + ' ' + (t.telephone||'') + ' #' + (t.id||'')).toLowerCase().includes(q);
    });
  }
  if (sort === 'alpha_asc') filtered.sort((a,b) => (a.nom||'').localeCompare(b.nom||''));
  else if (sort === 'alpha_desc') filtered.sort((a,b) => (b.nom||'').localeCompare(a.nom||''));
  else if (sort === 'disponible') filtered.sort((a,b) => (a.disponible?0:1) - (b.disponible?0:1));
  else if (sort === 'missions_desc') filtered.sort((a,b) => (b.missions_en_cours||0)+(b.missions_terminees||0) - (a.missions_en_cours||0)-(a.missions_terminees||0));
  else if (sort === 'specialite') filtered.sort((a,b) => (a.specialite||'').localeCompare(b.specialite||''));
  if (!sort) filtered.sort((a,b) => (a.disponible?0:1) - (b.disponible?0:1) || (a.nom||'').localeCompare(b.nom||''));
  return filtered;
}

function filterAndSortHistorique(data, search, sort) {
  if (!data || !Array.isArray(data)) return [];
  let filtered = [...data];
  const q = (search || '').trim().toLowerCase();
  if (q) {
    filtered = filtered.filter(d => {
      if (!d) return false;
      const dateStr = (d.created_at || d.t || '').toLowerCase();
      const tempVal = d.temperature != null ? d.temperature.toFixed(1) : (d.temp != null ? d.temp.toFixed(1) : '');
      const humVal  = d.humidite  != null ? d.humidite.toFixed(1)  : (d.hum  != null ? d.hum.toFixed(1)  : '');
      return dateStr.includes(q) || tempVal.includes(q) || humVal.includes(q);
    });
  }
  if (sort === 'date_desc') filtered.sort((a,b) => new Date(b.created_at||b.t||0) - new Date(a.created_at||a.t||0));
  else if (sort === 'date_asc') filtered.sort((a,b) => new Date(a.created_at||a.t||0) - new Date(b.created_at||b.t||0));
  else if (sort === 'temp_desc') filtered.sort((a,b) => (b.temperature??b.temp??0) - (a.temperature??a.temp??0));
  else if (sort === 'temp_asc') filtered.sort((a,b) => (a.temperature??a.temp??0) - (b.temperature??b.temp??0));
  else if (sort === 'hum_desc') filtered.sort((a,b) => (b.humidite??b.hum??0) - (a.humidite??a.hum??0));
  else if (sort === 'hum_asc') filtered.sort((a,b) => (a.humidite??a.hum??0) - (b.humidite??b.hum??0));
  if (!sort) filtered.sort((a,b) => new Date(b.created_at||b.t||0) - new Date(a.created_at||a.t||0));
  return filtered;
}

const SORT_OPTIONS_MISSIONS = [
  { value: '',           label: '🔽 Par défaut (priorité)' },
  { value: 'date_desc',  label: '📅 Date — récent → ancien' },
  { value: 'date_asc',   label: '📅 Date — ancien → récent' },
  { value: 'alpha_asc',  label: '🔤 A → Z (description)' },
  { value: 'alpha_desc', label: '🔤 Z → A (description)' },
  { value: 'priorite',   label: '🚦 Priorité (critique → faible)' },
  { value: 'statut',     label: '📋 Statut (terminé → refusé)' },
];
const SORT_OPTIONS_RAPPORTS = [
  { value: '',           label: '📅 Date — récent → ancien' },
  { value: 'date_asc',   label: '📅 Date — ancien → récent' },
  { value: 'alpha_asc',  label: '🔤 A → Z (titre)' },
  { value: 'alpha_desc', label: '🔤 Z → A (titre)' },
  { value: 'statut',     label: '📋 Statut (approuvé → brouillon)' },
];
const SORT_OPTIONS_ALERTES = [
  { value: '',           label: '📅 Date — récent → ancien' },
  { value: 'date_asc',   label: '📅 Date — ancien → récent' },
  { value: 'severite',   label: '🔴 Sévérité (critique → info)' },
  { value: 'lue',        label: "👁️ Non lues d'abord" },
];
const SORT_OPTIONS_TECHNICIENS = [
  { value: '',           label: '🔽 Par défaut (dispo puis nom)' },
  { value: 'alpha_asc',  label: '🔤 A → Z (nom)' },
  { value: 'alpha_desc', label: '🔤 Z → A (nom)' },
  { value: 'disponible', label: '🟢 Disponibles d\'abord' },
  { value: 'missions_desc', label: '📊 Missions totales (décroissant)' },
  { value: 'specialite', label: '🔧 Spécialité (A → Z)' },
];
const SORT_OPTIONS_HISTORIQUE = [
  { value: '',           label: '📅 Date — récent → ancien' },
  { value: 'date_asc',   label: '📅 Date — ancien → récent' },
  { value: 'temp_desc',  label: '🌡️ Température ↓' },
  { value: 'temp_asc',   label: '🌡️ Température ↑' },
  { value: 'hum_desc',   label: '💧 Humidité ↓' },
  { value: 'hum_asc',    label: '💧 Humidité ↑' },
];

// ── StatutBadge helper ─────────────────────────────────
function StatutBadge({ statut }) {
  const cfg = {
    terminee: { bg:'#f0fff4', color:'#39B54A' },
    approuve: { bg:'#f0fff4', color:'#39B54A' },
    acceptee: { bg:'#eff6ff', color:'#0072BC' },
    en_cours: { bg:'#fff8f0', color:'#F7941D' },
    en_attente: { bg:'#f8f0ff', color:'#662D91' },
    soumis: { bg:'#eff6ff', color:'#0072BC' },
    rejete: { bg:'#fff0f0', color:'#E30613' },
    brouillon: { bg:'#f8fafc', color:'#64748b' },
    refusee: { bg:'#fff0f0', color:'#E30613' },
  };
  const s = cfg[statut] || { bg:'#f8fafc', color:'#64748b' };
  return <span style={{ background:s.bg, color:s.color, padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, display:'inline-block' }}>{statut.replace(/_/g,' ')}</span>;
}

// ── Modal helper ────────────────────────────────────────
function Modal({ title, onClose, onSubmit, label, children }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}}>
      <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',width:'100%',maxWidth:500,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <h2 style={{fontSize:16,fontWeight:800,fontFamily:'var(--font-d)'}}>{title}</h2>
          <button onClick={onClose} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',fontSize:16,cursor:'pointer'}}>✕</button>
        </div>
        {children}
        <div style={{display:'flex',gap:10,marginTop:16}}>
          <button onClick={onSubmit} style={{flex:1,background:'linear-gradient(135deg,#E30613,#F7941D)',color:'#fff',borderRadius:8,padding:'10px',fontSize:14,fontWeight:700,cursor:'pointer',border:'none'}}>{label}</button>
          <button onClick={onClose} style={{background:'#f8fafc',color:'#64748b',border:'1px solid #e0e7ff',borderRadius:8,padding:'10px 16px',fontSize:14,cursor:'pointer'}}>Annuler</button>
        </div>
      </div>
    </div>
  );
}
function F({ label, value, onChange, type, opts }) {
  const shared = { width:'100%', background:'#f8fafc', border:'1.5px solid #e0e7ff', borderRadius:8, padding:'10px', color:'#1e293b', fontSize:13, fontFamily:'var(--font-b)' };
  return (
    <div style={{marginBottom:12}}>
      <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700,fontFamily:'var(--font-b)'}}>{label}</label>
      {type==='textarea' ? <textarea value={value} onChange={e=>onChange(e.target.value)} rows={3} style={{...shared,resize:'vertical'}}/> :
       type==='select' ? <select value={value} onChange={e=>onChange(e.target.value)} style={shared}>{opts.map(o=><option key={o} value={o}>{o}</option>)}</select> :
       <input value={value} onChange={e=>onChange(e.target.value)} type={type||'text'} style={shared}/>}
    </div>
  );
}

export default function AdminDashboard(){
  const [tab,setTab]=useState(0);
  const [stats,setStats]=useState({});
  const [pannes,setPannes]=useState([]);
  const [alertes,setAlertes]=useState([]);
  const [techniciens,setTechniciens]=useState([]);
  const [missions,setMissions]=useState([]);
  const [rapports,setRapports]=useState([]);
  const [historique,setHistorique]=useState([]);
  const [capteurSel,setCapteurSel]=useState(1);
  const [aiResult,setAiResult]=useState('');
  const [aiLoading,setAiLoading]=useState(false);
  const [selPanne,setSelPanne]=useState(null);
  const [rapportPhotos,setRapportPhotos]=useState({});
  const [editMission,setEditMission]=useState(null);
  const [notif,setNotif]=useState('');
  const [notifPanel,setNotifPanel]=useState(false);

  // ── Search & Sort ──
  const [searchMissions, setSearchMissions] = useState('');
  const [sortMissions, setSortMissions] = useState('');
  const [searchRapports, setSearchRapports] = useState('');
  const [sortRapports, setSortRapports] = useState('');
  const [searchAlertes, setSearchAlertes] = useState('');
  const [sortAlertes, setSortAlertes] = useState('');
  const hasActiveMissionFilter = searchMissions || sortMissions;
  const filteredMissions = filterAndSortMissions(missions, searchMissions, sortMissions);
  const filteredRapports = filterAndSortRapports(rapports, searchRapports, sortRapports);
  const filteredAlertes  = filterAndSortAlertes(alertes, searchAlertes, sortAlertes);
  const [searchTechniciens, setSearchTechniciens] = useState('');
  const [sortTechniciens, setSortTechniciens] = useState('');
  const [searchHistorique, setSearchHistorique] = useState('');
  const [sortHistorique, setSortHistorique] = useState('');
  const filteredTechniciens = filterAndSortTechniciens(techniciens, searchTechniciens, sortTechniciens);
  const filteredHistorique = filterAndSortHistorique(historique, searchHistorique, sortHistorique);

  const [modalPanne,setModalPanne]=useState(false);
  const [modalMission,setModalMission]=useState(false);
  const [modalTech,setModalTech]=useState(false);
  const [modalImport,setModalImport]=useState(false);
  const [modalIndispo,setModalIndispo]=useState(null);
  const [formPanne,setFormPanne]=useState({description:'',type:'réseau',priorite:'moyen'});
  const [formMission,setFormMission]=useState({description:'',localisation:'',priorite:'moyen',technicien_id:''});
  const [formTech,setFormTech]=useState({nom:'',email:'',mot_de_passe:'tech123',telephone:'',specialite:''});
  const [importFile,setImportFile]=useState(null);
  const [importResult,setImportResult]=useState(null);
  const [importLoading,setImportLoading]=useState(false);
  const fileInputRef=useRef();

  const showNotif=(msg)=>{setNotif(msg);setTimeout(()=>setNotif(''),3500);};

  // ═══ Référence pour savoir si un filtre mission est actif (utilisée dans l'intervalle) ═══
  const missionFilterActiveRef = useRef(false);
  missionFilterActiveRef.current = hasActiveMissionFilter;

  const load=useCallback(()=>{
    getDashboard().then(setStats).catch(console.error);
    getPannes().then(setPannes).catch(console.error);
    getAlertes().then(setAlertes).catch(console.error);
    getTechniciens().then(setTechniciens).catch(console.error);
    if (!missionFilterActiveRef.current) {
      const PRIO_ORDER={critique:0,eleve:1,moyen:2,faible:3};
      getMissions().then(data=>{
        const sorted=[...data].sort((a,b)=>{ const ps=(PRIO_ORDER[a.priorite]??4)-(PRIO_ORDER[b.priorite]??4); if(ps!==0)return ps; return new Date(a.date_creation)-new Date(b.date_creation); });
        setMissions(sorted);
      }).catch(console.error);
    }
    getRapports().then(setRapports).catch(console.error);
  },[]);

  useEffect(()=>{load();const t=setInterval(load,6000);return()=>clearInterval(t);},[load]);
  useEffect(()=>{ getHistoriqueCapteur(capteurSel,50).then(d=>setHistorique([...d].reverse())); },[capteurSel]);
  // ── Reset capteur search/sort when capteur changes ──
  useEffect(()=>{ setSearchHistorique(''); setSortHistorique(''); },[capteurSel]);

  const handleAI=async p=>{ setSelPanne(p);setAiLoading(true);setAiResult(''); try{const r=await analyserIA({panne_id:p.id,description:p.description,valeur:p.valeur_detectee||0,type_panne:p.type});setAiResult(r.analyse);} catch{setAiResult('Erreur IA');}finally{setAiLoading(false);} };
  const submitPanne=async()=>{ await creerPanne(formPanne);setModalPanne(false); setFormPanne({description:'',type:'réseau',priorite:'moyen'}); showNotif('🚨 Ticket panne créé !');load(); };
  const submitMission=async()=>{ try{await creerMission({...formMission,technicien_id:formMission.technicien_id||null});} catch(e){alert(e.response?.data?.detail||'Erreur');return;} setModalMission(false);setFormMission({description:'',localisation:'',priorite:'moyen',technicien_id:''}); showNotif('📋 Mission créée !');load(); };
  const submitTech=async()=>{ try{await ajouterTechnicien(formTech);}catch(e){alert(e.response?.data?.detail||'Erreur');return;} setModalTech(false);setFormTech({nom:'',email:'',mot_de_passe:'tech123',telephone:'',specialite:''}); showNotif('👷 Technicien ajouté !');load(); };
  const saveEditMission=async()=>{ try{await updateMission(editMission.id,{description:editMission.description,localisation:editMission.localisation,priorite:editMission.priorite,technicien_id:editMission.technicien_id||null});}catch(e){alert(e.response?.data?.detail||'Erreur');return;} setEditMission(null);showNotif('✅ Mission modifiée !');load(); };

  const loadPhotos=async(rid)=>{ if(rapportPhotos[rid])return; const p=await getRapportPhotos(rid); setRapportPhotos(prev=>({...prev,[rid]:p})); };

  const handleImportExcel=async()=>{
    if(!importFile){alert('Sélectionnez un fichier Excel (.xlsx)');return;}
    setImportLoading(true);setImportResult(null);
    try{ const fd=new FormData();fd.append('file',importFile); const res=await importerMissionsExcel(fd); setImportResult(res); if(res.imported>0){showNotif(`✅ ${res.imported} mission(s) importée(s) !`);load();} }
    catch(e){ setImportResult({status:'error',message:'Erreur: '+(e.response?.data?.detail||e.message)}); }
    finally{setImportLoading(false);}
  };

  const cs={background:'#fff',border:'1px solid #e0e7ff',borderRadius:12,padding:'1.25rem',boxShadow:'0 2px 8px rgba(0,114,188,0.06)'};
  const statCards=[
    {label:'Pannes ouvertes',    v:stats.pannes_ouvertes||0,    c:'#E30613',bg:'#fff0f0',icon:'🚨'},
    {label:'Missions en cours',  v:stats.missions_en_cours||0,  c:'#F7941D',bg:'#fff8f0',icon:'⚙️'},
    {label:'En attente',         v:stats.missions_en_attente||0,c:'#662D91',bg:'#f8f0ff',icon:'⏳'},
    {label:'Terminées',          v:stats.missions_terminees||0, c:'#39B54A',bg:'#f0fff4',icon:'✅'},
    {label:'Alertes non lues',   v:stats.alertes_non_lues||0,   c:'#0072BC',bg:'#f0f8ff',icon:'🔔'},
    {label:'Techniciens dispos', v:stats.techniciens_disponibles||0,c:'#00A99D',bg:'#f0fffd',icon:'👷'},
  ];

  return(
    <div style={{padding:'1.5rem',display:'flex',flexDirection:'column',gap:20}}>
      {notif&&(
        <div style={{position:'fixed',top:20,right:20,background:'linear-gradient(135deg,#E30613,#F7941D)', color:'#fff',padding:'12px 20px',borderRadius:10,fontWeight:700,fontSize:13, zIndex:9999,boxShadow:'0 4px 20px rgba(227,6,19,.3)'}}>{notif}</div>
      )}
      <div style={{display:'flex',gap:3,flexWrap:'wrap',background:'#fff',borderRadius:12, padding:'6px',border:'1px solid #e0e7ff',boxShadow:'0 2px 8px rgba(0,114,188,0.06)', alignItems:'center'}}>
        {TABS.map((t,i)=>(
          <button key={t} onClick={()=>setTab(i)} style={{ background:tab===i?'linear-gradient(135deg,#E30613,#F7941D)':'transparent', color:tab===i?'#fff':'#64748b', border:'none',padding:'8px 14px',fontSize:12,fontWeight:tab===i?700:400, borderRadius:8,cursor:'pointer',whiteSpace:'nowrap',transition:'all .15s' }}>{t}</button>
        ))}
        <div style={{position:'relative',marginLeft:'auto'}}>
          <button onClick={()=>{setNotifPanel(p=>!p);}} style={{ width:36,height:36,borderRadius:8, background:notifPanel?'linear-gradient(135deg,#0072BC,#00A99D)':'transparent', color:notifPanel?'#fff':'#64748b',border:'none',fontSize:16,cursor:'pointer', display:'flex',alignItems:'center',justifyContent:'center', position:'relative',transition:'all .15s' }}>
            🔔
            {alertes.filter(a=>!a.lue).length>0&&(
              <span style={{ position:'absolute',top:-2,right:-2, background:'#E30613',color:'#fff', borderRadius:'50%',width:16,height:16, fontSize:9,fontWeight:800, display:'flex',alignItems:'center',justifyContent:'center', border:'2px solid #fff' }}>{alertes.filter(a=>!a.lue).length}</span>
            )}
          </button>
          {notifPanel&&(
            <div style={{ position:'absolute',top:'100%',right:0,marginTop:6,width:380, background:'#fff',borderRadius:14,boxShadow:'0 8px 32px rgba(0,0,0,0.18)', border:'1px solid #e0e7ff',overflow:'hidden',zIndex:1000 }}>
              <div style={{background:'linear-gradient(135deg,#0072BC,#00A99D)',padding:'12px 16px', display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{color:'#fff',fontWeight:700,fontSize:13}}>🔔 Notifications ({alertes.filter(a=>!a.lue).length} non lues)</span>
                <button onClick={()=>setNotifPanel(false)} style={{ background:'rgba(255,255,255,0.2)',border:'none',color:'#fff', borderRadius:6,padding:'2px 7px',cursor:'pointer',fontSize:13 }}>✕</button>
              </div>
              <div style={{maxHeight:320,overflowY:'auto',padding:'8px'}}>
                {alertes.length===0&&<p style={{textAlign:'center',color:'#94a3b8',padding:'20px',fontSize:13}}>Aucune notification</p>}
                {alertes.slice(0,5).map(a=>(
                  <div key={a.id} style={{ padding:'10px 12px',borderRadius:8,marginBottom:6, background:a.lue?'#f8fafc':'#fff5f5', borderLeft:`3px solid ${a.severite==='critique'?'#E30613':a.severite==='warning'?'#F7941D':'#0072BC'}`, border:`1px solid ${a.lue?'#e0e7ff':'#fde0e0'}`, opacity:a.lue?0.65:1 }}>
                    <p style={{fontSize:12,fontWeight:a.lue?400:600,marginBottom:3, color:'#1e293b'}}>{a.message}</p>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:4}}>
                      <span style={{fontSize:10,color:'#94a3b8'}}>{new Date(a.created_at).toLocaleString('fr-FR')}</span>
                      {!a.lue&&<button onClick={()=>marquerLue(a.id).then(load)} style={{ background:'#f0fff4',color:'#39B54A',border:'1px solid #c0eec8', borderRadius:4,padding:'2px 6px',fontSize:9,fontWeight:600,cursor:'pointer' }}>✓ Lu</button>}
                    </div>
                  </div>
                ))}
              </div>
              {alertes.length>0&&(
                <div style={{borderTop:'1px solid #e0e7ff',padding:'8px 12px', display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <button onClick={()=>{setNotifPanel(false);setTab(5);}} style={{ background:'#eff6ff',color:'#0072BC',border:'1px solid #bfdbfe', borderRadius:6,padding:'5px 10px',fontSize:11,fontWeight:700,cursor:'pointer' }}>Voir tout →</button>
                  <button onClick={()=>{ Promise.all(alertes.filter(a=>!a.lue).map(a=>marquerLue(a.id))).then(load); }} style={{ background:'transparent',color:'#64748b',border:'none', fontSize:11,fontWeight:600,cursor:'pointer',padding:'5px 8px' }}>✅ Tout marquer lu</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── TAB 0: Dashboard ── */}
      {tab===0&&<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:12}}>
          {statCards.map(s=>(
            <div key={s.label} style={{...cs,background:s.bg,borderTop:`3px solid ${s.c}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:22}}>{s.icon}</span><span style={{fontSize:28,fontWeight:800,fontFamily:'var(--font-d)',color:s.c}}>{s.v}</span></div>
              <p style={{fontSize:11,color:'#64748b',marginTop:8,textTransform:'uppercase',letterSpacing:'.05em'}}>{s.label}</p>
            </div>
          ))}
        </div>
        {stats.stats_techniciens?.length>0&&(
          <div style={cs}>
            <h2 style={{fontSize:13,color:'#64748b',marginBottom:14,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700}}>📊 Performance par technicien</h2>
            <ResponsiveContainer width="100%" height={200}><BarChart data={stats.stats_techniciens}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="nom" tick={{fontSize:11,fill:'#64748b'}}/><YAxis tick={{fontSize:11,fill:'#64748b'}}/><Tooltip contentStyle={{background:'#fff',border:'1px solid #e0e7ff',borderRadius:8}}/><Legend/><Bar dataKey="en_cours" name="En cours" fill="#F7941D" radius={[4,4,0,0]}/><Bar dataKey="terminees" name="Terminées" fill="#39B54A" radius={[4,4,0,0]}/><Bar dataKey="en_attente" name="En attente" fill="#662D91" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer>
          </div>
        )}
      </>}

      {/* ── TAB 1: Capteurs ── */}
      {tab===1&&(
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <WokwiLiveWidget/>
          <div style={{display:'flex',gap:8}}>
            {[1,2,3].map(id=>(
              <button key={id} onClick={()=>setCapteurSel(id)} style={{ background:capteurSel===id?'linear-gradient(135deg,#E30613,#F7941D)':'#fff', color:capteurSel===id?'#fff':'#64748b', border:'1px solid #e0e7ff',borderRadius:8,padding:'8px 18px',fontSize:13,fontWeight:600,cursor:'pointer' }}>Capteur TT-00{id}</button>
            ))}
          </div>
          {[{metric:'temperature',color:'#E30613',label:'🌡️ Température (°C)',domain:[0,60]},{metric:'humidite',color:'#0072BC',label:'💧 Humidité (%)',domain:[0,100]}].map(c=>(
            <div key={c.metric} style={cs}>
              <h2 style={{fontSize:13,color:'#64748b',marginBottom:14,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700}}>{c.label}</h2>
              <ResponsiveContainer width="100%" height={180}><LineChart data={historique.slice(-30)}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="created_at" tick={{fontSize:9,fill:'#94a3b8'}} tickFormatter={v=>v?new Date(v).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}):''}/><YAxis domain={c.domain} tick={{fontSize:11,fill:'#94a3b8'}} width={35}/><Tooltip contentStyle={{background:'#fff',border:'1px solid #e0e7ff',borderRadius:8}} labelFormatter={v=>v?new Date(v).toLocaleTimeString('fr-FR'):''}/><Line type="monotone" dataKey={c.metric} stroke={c.color} strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer>
            </div>
          ))}

          {historique.length > 0 && (
            <>
              <SearchSortBar search={searchHistorique} onSearchChange={setSearchHistorique} sort={sortHistorique} onSortChange={setSortHistorique} sortOptions={SORT_OPTIONS_HISTORIQUE} placeholder="Rechercher dans l'historique (date, température, humidité...)" />
              {searchHistorique || sortHistorique ? <p style={{fontSize:12,color:'#64748b',fontFamily:'var(--font-b)'}}>{filteredHistorique.length} résultat(s) sur {historique.length} point(s)</p> : null}
              <div style={cs}>
                <div style={{maxHeight:300,overflowY:'auto',fontSize:12}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr style={{background:'#f8fafc',position:'sticky',top:0}}>
                      {['Date','Température','Humidité'].map(h=><th key={h} style={{padding:'8px 10px',textAlign:'left',color:'#64748b',fontSize:11,textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'2px solid #e0e7ff',fontWeight:700,whiteSpace:'nowrap'}}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {filteredHistorique.length === 0 ? (
                        <tr><td colSpan={3} style={{padding:'24px',textAlign:'center',color:'#94a3b8'}}><p style={{fontSize:16,marginBottom:4}}>🔍</p><p style={{fontWeight:600}}>Aucune donnée trouvée</p><p style={{fontSize:12,marginTop:4}}>Essayez de modifier vos critères de recherche</p></td></tr>
                      ) : (
                        filteredHistorique.map((d,i)=>{
                          const temp = d.temperature ?? d.temp;
                          const hum  = d.humidite  ?? d.hum;
                          const dateStr = d.created_at || d.t || '';
                          const alertT = temp != null && (temp > 35 || temp < 10);
                          const alertH = hum  != null && (hum  > 80 || hum  < 20);
                          return (
                            <tr key={i} style={{borderBottom:'1px solid #f0f4ff',background:i%2===0?'#fff':'#fafbff'}}>
                              <td style={{padding:'7px 10px',color:'#94a3b8',fontSize:11,whiteSpace:'nowrap'}}>{dateStr ? new Date(dateStr).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—'}</td>
                              <td style={{padding:'7px 10px',fontWeight:700,color:alertT?'#E30613':'#1e293b'}}>{temp != null ? temp.toFixed(1) : '—'}°C</td>
                              <td style={{padding:'7px 10px',fontWeight:700,color:alertH?'#F7941D':'#1e293b'}}>{hum != null ? hum.toFixed(1) : '—'}%</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB 2: Missions ── */}
      {tab===2&&(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              <button onClick={()=>{showNotif('📊 Génération du fichier Excel...');exportExcel(missions,[{key:'id',label:'ID'},{key:'description',label:'Description'},{key:'localisation',label:'Localisation'},{key:'priorite',label:'Priorité'},{key:'statut',label:'Statut'},{key:'technicien_nom',label:'Technicien'},{key:'date_creation',label:'Date création'},{key:'date_fin',label:'Date fin'}],'missions_tt.xlsx','Missions');}} style={{ background:'#f0fff4',color:'#39B54A',border:'1px solid #c0eec8', borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-b)'}}>📊 Export Excel</button>
              <button onClick={()=>{showNotif('📄 Téléchargement du PDF...');genererMissionsPDF();}} style={{ background:'#fff0f0',color:'#E30613',border:'1px solid #ffd0d0', borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>📄 Rapport PDF</button>
              <button onClick={()=>{setModalImport(true);setImportResult(null);setImportFile(null);}} style={{ background:'#eff6ff',color:'#0072BC',border:'1px solid #bfdbfe', borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer'}}>📥 Import Excel</button>
            </div>
            <button onClick={()=>setModalMission(true)} style={{ background:'linear-gradient(135deg,#E30613,#F7941D)',color:'#fff', borderRadius:8,padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Nouvelle mission</button>
          </div>

          <SearchSortBar search={searchMissions} onSearchChange={setSearchMissions} sort={sortMissions} onSortChange={setSortMissions} sortOptions={SORT_OPTIONS_MISSIONS} placeholder="Rechercher mission (description, localisation, tech, ticket...)" />

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8, fontSize:12,color:'#64748b',fontFamily:'var(--font-b)'}}>
            <span>{hasActiveMissionFilter ? <>{filteredMissions.length} résultat(s) sur {missions.length} mission(s)</> : <>{missions.length} mission(s) au total</>}</span>
            {searchMissions && <button onClick={() => setSearchMissions('')} style={{background:'#f1f5f9',border:'none',borderRadius:6,padding:'3px 10px',fontSize:11,color:'#64748b',cursor:'pointer',fontWeight:600}}>✕ Effacer filtre</button>}
          </div>

          <div style={cs}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
              <thead><tr style={{background:'linear-gradient(135deg,#fff0f0,#fff8f0)'}}>
                {['#','Description','Ticket Panne','Localisation','Priorité','Statut','Technicien','Actions'].map(h=><th key={h} style={{padding:'10px 12px',textAlign:'left',color:'#64748b',fontSize:11,textTransform:'uppercase',letterSpacing:'.05em',borderBottom:'2px solid #e0e7ff',fontWeight:700}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {filteredMissions.length === 0 ? (
                  <tr><td colSpan={8} style={{padding:'24px',textAlign:'center',color:'#94a3b8'}}><p style={{fontSize:16,marginBottom:4}}>🔍</p><p style={{fontWeight:600}}>Aucune mission trouvée</p><p style={{fontSize:12,marginTop:4}}>Essayez de modifier vos critères de recherche</p></td></tr>
                ) : (
                  filteredMissions.map(m=>(
                  <tr key={m.id} style={{borderBottom:'1px solid #f0f4ff', background:m.statut==='terminee'?'#f8fafc':'#fff'}}>
                    <td style={{padding:'10px 12px',color:'#94a3b8',fontFamily:'var(--font-d)',fontWeight:700}}>{m.id}</td>
                    <td style={{padding:'10px 12px',maxWidth:200,fontWeight:500}}>
                      {m.description}
                      {m.panne_ticket&&<div style={{marginTop:4}}><span style={{background:'#fff0f0',color:'#E30613',border:'1px solid #fca5a5',borderRadius:20,padding:'1px 7px',fontSize:10,fontWeight:700}}>🔧 {m.panne_ticket}</span></div>}
                    </td>
                    <td style={{padding:'10px 12px'}}>
                      {m.panne_ticket?(<div style={{display:'flex',flexDirection:'column',gap:2}}><span style={{background:'#fff0f0',color:'#E30613',border:'1px solid #fca5a5',borderRadius:12,padding:'2px 8px',fontSize:11,fontWeight:700,display:'inline-block',width:'fit-content'}}>🎫 {m.panne_ticket}</span>{m.panne_type&&<span style={{fontSize:10,color:'#64748b'}}>{m.panne_type}</span>}</div>):<span style={{color:'#94a3b8',fontSize:12}}>—</span>}
                    </td>
                    <td style={{padding:'10px 12px',color:'#64748b',fontSize:12}}>{m.localisation}</td>
                    <td style={{padding:'10px 12px'}}><span style={{background:`${PC[m.priorite]}22`,color:PC[m.priorite],padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>{m.priorite}</span></td>
                    <td style={{padding:'10px 12px'}}><StatutBadge statut={m.statut}/></td>
                    <td style={{padding:'10px 12px',fontSize:12,color:m.technicien_nom?'#1e293b':'#94a3b8'}}>{m.technicien_nom||'—'}</td>
                    <td style={{padding:'10px 12px'}}>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                        <button onClick={()=>setEditMission({...m})} style={{background:'#eff6ff',color:'#0072BC',border:'1px solid #bfdbfe',borderRadius:6,padding:'4px 8px',fontSize:11,fontWeight:600,cursor:'pointer'}}>✏️</button>
                        {!m.technicien_id&&<select onChange={e=>e.target.value&&assignerMission(m.id,{technicien_id:parseInt(e.target.value)}).then(()=>{showNotif('👷 Mission assignée !');load();}).catch(e=>alert(e.response?.data?.detail||'Erreur'))} style={{background:'#f8fafc',color:'#1e293b',border:'1px solid #e0e7ff',borderRadius:6,padding:'4px 8px',fontSize:11}}><option value="">Assigner...</option>{techniciens.filter(t=>t.disponible).map(t=><option key={t.id} value={t.id}>{t.nom}</option>)}</select>}
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: Techniciens ── */}
      {tab===3&&(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:10,padding:'10px 16px',fontSize:12,color:'#1e40af'}}>🔒 <strong>Admin uniquement</strong> — Vous pouvez gérer la disponibilité des techniciens et définir la durée de retour. Les techniciens ne peuvent pas modifier leur propre disponibilité.</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:8}}>
            <div style={{display:'flex',gap:8}}>
              <button onClick={()=>{showNotif('📊 Génération du fichier Excel...');exportExcel(techniciens,[{key:'id',label:'ID'},{key:'nom',label:'Nom'},{key:'email',label:'Email'},{key:'specialite',label:'Spécialité'},{key:'telephone',label:'Téléphone'},{key:'disponible',label:'Disponible'},{key:'missions_en_cours',label:'Missions en cours'},{key:'missions_terminees',label:'Missions terminées'}],'techniciens_tt.xlsx','Techniciens');}} style={{ background:'#f0fff4',color:'#39B54A',border:'1px solid #c0eec8', borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-b)'}}>📊 Export Excel</button>
            </div>
            <button onClick={()=>setModalTech(true)} style={{ background:'linear-gradient(135deg,#E30613,#F7941D)',color:'#fff', borderRadius:8,padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer'}}>+ Ajouter technicien</button>
          </div>

          <SearchSortBar search={searchTechniciens} onSearchChange={setSearchTechniciens} sort={sortTechniciens} onSortChange={setSortTechniciens} sortOptions={SORT_OPTIONS_TECHNICIENS} placeholder="Rechercher technicien (nom, email, spécialité...)" />

          {searchTechniciens || sortTechniciens ? <p style={{fontSize:12,color:'#64748b',fontFamily:'var(--font-b)',margin:0}}>{filteredTechniciens.length} résultat(s) sur {techniciens.length} technicien(s)</p> : null}

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:14}}>
            {filteredTechniciens.length === 0 ? (
              <div style={{...cs,textAlign:'center',padding:'2rem',color:'#64748b',gridColumn:'1 / -1'}}>
                <p style={{fontSize:32,marginBottom:8}}>👷</p>
                <p style={{fontWeight:600,fontSize:14}}>{techniciens.length > 0 ? 'Aucun technicien ne correspond à votre recherche' : 'Aucun technicien'}</p>
                {techniciens.length > 0 && <p style={{fontSize:12,marginTop:4,color:'#94a3b8'}}>Essayez de modifier vos critères de recherche</p>}
              </div>
            ) : (
              filteredTechniciens.map(t=>(
              <div key={t.id} style={{...cs,borderLeft:`4px solid ${t.disponible?'#39B54A':'#E30613'}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                  <div>
                    <p style={{fontSize:15,fontWeight:700,fontFamily:'var(--font-d)'}}>{t.nom}</p>
                    <p style={{fontSize:12,color:'#64748b',marginTop:3}}>{t.specialite}</p>
                    <p style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{t.email}</p>
                    {t.telephone&&<p style={{fontSize:11,color:'#94a3b8'}}>{t.telephone}</p>}
                    {!t.disponible&&t.retour_disponible&&<p style={{fontSize:11,color:'#F7941D',marginTop:4,fontWeight:600}}>⏰ Retour: {new Date(t.retour_disponible).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>}
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:6,alignItems:'flex-end'}}>
                    {!t.disponible&&<button onClick={()=>updateTechnicien(t.id,{disponible:true,role_appelant:'admin'}).then(()=>{showNotif(`🟢 ${t.nom} marqué disponible`);load();})} style={{ background:'#f0fff4',color:'#39B54A',border:'1px solid #c0eec8', borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>🟢 Rendre disponible</button>}
                    {t.disponible&&<button onClick={()=>{ const d=new Date(); d.setDate(d.getDate()+1); const dstr=d.toISOString().slice(0,10); setModalIndispo({tech:t,date:dstr,time:'08:00'}); }} style={{ background:'#fff0f0',color:'#E30613',border:'1px solid #ffd0d0', borderRadius:20,padding:'4px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>🔴 Marquer indisponible</button>}
                    <span style={{ background:t.disponible?'#f0fff4':'#fff0f0', color:t.disponible?'#39B54A':'#E30613', border:`1px solid ${t.disponible?'#c0eec8':'#ffd0d0'}`, borderRadius:20,padding:'2px 10px',fontSize:10,fontWeight:700 }}>{t.disponible?'🟢 Disponible':'🔴 Indisponible'}</span>
                    <button onClick={()=>{if(window.confirm(`Supprimer ${t.nom} ?`))supprimerTechnicien(t.id).then(load);}} style={{ background:'#fff0f0',color:'#E30613',border:'1px solid #ffd0d0', borderRadius:6,padding:'3px 8px',fontSize:10,fontWeight:600,cursor:'pointer'}}>🗑️ Supprimer</button>
                  </div>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[{v:t.missions_en_cours||0,l:'En cours',c:'#F7941D'},{v:t.missions_terminees||0,l:'Terminées',c:'#39B54A'}].map(s=>(
                    <div key={s.l} style={{background:'#f8fafc',borderRadius:8,padding:'10px',textAlign:'center',border:'1px solid #e0e7ff'}}><p style={{fontSize:20,fontWeight:800,color:s.c,fontFamily:'var(--font-d)'}}>{s.v}</p><p style={{fontSize:10,color:'#64748b',marginTop:3}}>{s.l}</p></div>
                  ))}
                </div>
              </div>
            )))}
          </div>
        </div>
      )}

      {/* ── TAB 4: Rapports ── */}
      {tab===4&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{display:'flex',justifyContent:'flex-end',gap:8,flexWrap:'wrap'}}>
            <button onClick={()=>{showNotif('📊 Génération du fichier Excel...');exportExcel(rapports,[{key:'id',label:'ID'},{key:'titre',label:'Titre'},{key:'technicien_nom',label:'Technicien'},{key:'mission_desc',label:'Mission'},{key:'statut',label:'Statut'},{key:'nb_photos',label:'Nb photos'},{key:'date_creation',label:'Date création'}],'rapports_tt.xlsx','Rapports');}} style={{ background:'#f0fff4',color:'#39B54A',border:'1px solid #c0eec8', borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'var(--font-b)'}}>📊 Export Excel</button>
          </div>

          <SearchSortBar search={searchRapports} onSearchChange={setSearchRapports} sort={sortRapports} onSortChange={setSortRapports} sortOptions={SORT_OPTIONS_RAPPORTS} placeholder="Rechercher rapport (titre, contenu, technicien...)" />

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8, fontSize:12,color:'#64748b',fontFamily:'var(--font-b)'}}>
            <span>{searchRapports || sortRapports ? <>{filteredRapports.length} résultat(s) sur {rapports.length} rapport(s)</> : <>{rapports.length} rapport(s) au total</>}</span>
            {searchRapports && <button onClick={() => setSearchRapports('')} style={{background:'#f1f5f9',border:'none',borderRadius:6,padding:'3px 10px',fontSize:11,color:'#64748b',cursor:'pointer',fontWeight:600}}>✕ Effacer filtre</button>}
          </div>

          {filteredRapports.length === 0 ? (
            <div style={{...cs,textAlign:'center',padding:'2rem',color:'#64748b'}}>
              <p style={{fontSize:32,marginBottom:8}}>📄</p>
              <p style={{fontWeight:600,fontSize:14}}>{rapports.length > 0 ? 'Aucun rapport ne correspond à votre recherche' : 'Aucun rapport soumis'}</p>
              {rapports.length > 0 && <p style={{fontSize:12,marginTop:4,color:'#94a3b8'}}>Essayez de modifier vos critères de recherche</p>}
            </div>
          ) : (
            filteredRapports.map(r=>{
              const SC={approuve:{bg:'#f0fff4',color:'#39B54A',border:'#c0eec8',icon:'✅'}, soumis:{bg:'#eff6ff',color:'#0072BC',border:'#bfdbfe',icon:'⏳'}, rejete:{bg:'#fff0f0',color:'#E30613',border:'#ffd0d0',icon:'❌'}, brouillon:{bg:'#f8fafc',color:'#64748b',border:'#e0e7ff',icon:'📝'}};
              const s=SC[r.statut]||SC.brouillon;
              return(
              <div key={r.id} style={{...cs,borderLeft:`4px solid ${s.color}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontSize:13,fontWeight:800,fontFamily:'var(--font-d)'}}>{r.titre||`Rapport #${r.id}`}</span>
                      <span style={{background:s.bg,color:s.color,border:`1px solid ${s.border}`,borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>{s.icon} {r.statut}</span>
                    </div>
                    <p style={{fontSize:12,color:'#64748b'}}>👷 {r.technicien_nom} · {r.mission_desc}</p>
                    <p style={{fontSize:11,color:'#94a3b8',marginTop:3}}>📅 {new Date(r.date_creation).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}{r.nb_photos>0&&<span style={{marginLeft:10}}>📸 {r.nb_photos} photo(s)</span>}</p>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                    <button onClick={()=>{showNotif('📄 Téléchargement du PDF...');genererRapportPDF(r.id);}} style={{ background:'#fff0f0',color:'#E30613',border:'1px solid #ffd0d0', borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>📄 PDF</button>
                    {r.statut==='soumis'&&(<>
                      <button onClick={()=>updateRapportStatut(r.id,{statut:'approuve'}).then(()=>{showNotif('✅ Rapport approuvé !');load();})} style={{ background:'#f0fff4',color:'#39B54A',border:'1px solid #c0eec8', borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>✅ Approuver</button>
                      <button onClick={()=>updateRapportStatut(r.id,{statut:'rejete'}).then(()=>{showNotif('❌ Rapport rejeté.');load();})} style={{ background:'#fff0f0',color:'#E30613',border:'1px solid #ffd0d0', borderRadius:6,padding:'4px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>❌ Rejeter</button>
                    </>)}
                  </div>
                </div>
                <div style={{background:'#f8fafc',borderRadius:8,padding:'10px',fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{r.contenu}</div>
              </div>
            )})
          )}
        </div>
      )}

      {/* ── TAB 5: Alertes ── */}
      {tab===5&&(
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <SearchSortBar search={searchAlertes} onSearchChange={setSearchAlertes} sort={sortAlertes} onSortChange={setSortAlertes} sortOptions={SORT_OPTIONS_ALERTES} placeholder="Rechercher alerte (message, type...)" />

          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8, fontSize:12,color:'#64748b',fontFamily:'var(--font-b)'}}>
            <span>{searchAlertes || sortAlertes ? <>{filteredAlertes.length} résultat(s) sur {alertes.length} alerte(s)</> : <>{alertes.length} alerte(s) au total</>}</span>
            {searchAlertes && <button onClick={() => setSearchAlertes('')} style={{background:'#f1f5f9',border:'none',borderRadius:6,padding:'3px 10px',fontSize:11,color:'#64748b',cursor:'pointer',fontWeight:600}}>✕ Effacer filtre</button>}
          </div>

          {filteredAlertes.length === 0 ? (
            <div style={{...cs,textAlign:'center',padding:'2rem',color:'#64748b'}}>
              <p style={{fontSize:40}}>🔔</p>
              <p style={{fontWeight:600,marginTop:12,fontSize:14}}>{alertes.length > 0 ? 'Aucune alerte ne correspond à votre recherche' : 'Aucune alerte'}</p>
              {alertes.length > 0 && <p style={{fontSize:12,marginTop:4,color:'#94a3b8'}}>Essayez de modifier vos critères de recherche</p>}
            </div>
          ) : (
            filteredAlertes.map(a=>(
              <div key={a.id} style={{...cs,opacity:a.lue ? 0.65 : 1, borderLeft:`4px solid ${a.severite==='critique'?'#E30613':a.severite==='warning'?'#F7941D':'#0072BC'}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <p style={{fontSize:13,fontWeight:500,marginBottom:4}}>{a.message}</p>
                    <p style={{fontSize:11,color:'#94a3b8'}}>{new Date(a.created_at).toLocaleString('fr-FR')}</p>
                  </div>
                  {!a.lue&&<button onClick={()=>marquerLue(a.id).then(load)} style={{ background:'#f0fff4',color:'#39B54A',border:'1px solid #c0eec8', borderRadius:6,padding:'5px 10px',fontSize:11,fontWeight:600,cursor:'pointer'}}>Lu</button>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Modals ── */}
      {modalPanne&&<Modal title="🚨 Créer ticket panne" onClose={()=>setModalPanne(false)} onSubmit={submitPanne} label="Créer">
        <F label="Description" value={formPanne.description} onChange={v=>setFormPanne({...formPanne,description:v})} type="textarea"/>
        <F label="Type" value={formPanne.type} onChange={v=>setFormPanne({...formPanne,type:v})} type="select" opts={['réseau','électrique','matériel','logiciel','température','humidité','autre']}/>
        <F label="Priorité" value={formPanne.priorite} onChange={v=>setFormPanne({...formPanne,priorite:v})} type="select" opts={['faible','moyen','eleve','critique']}/>
      </Modal>}

      {modalMission&&<Modal title="📋 Nouvelle mission" onClose={()=>setModalMission(false)} onSubmit={submitMission} label="Créer">
        <F label="Description" value={formMission.description} onChange={v=>setFormMission({...formMission,description:v})} type="textarea"/>
        <F label="Localisation" value={formMission.localisation} onChange={v=>setFormMission({...formMission,localisation:v})}/>
        <F label="Priorité" value={formMission.priorite} onChange={v=>setFormMission({...formMission,priorite:v})} type="select" opts={['faible','moyen','eleve','critique']}/>
        <div>
          <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700,fontFamily:'var(--font-b)'}}>Filtrer par spécialité</label>
          <select value={formMission.specialite_filtre||''} onChange={e=>setFormMission({...formMission,specialite_filtre:e.target.value,technicien_id:''})} style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:'#1e293b',fontSize:13,fontFamily:'var(--font-b)',marginBottom:10}}>
            <option value="">— Toutes les spécialités —</option>
            {[...new Set(techniciens.map(t=>t.specialite).filter(Boolean))].sort().map(sp=><option key={sp} value={sp}>{sp}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700,fontFamily:'var(--font-b)'}}>Technicien</label>
          <select value={formMission.technicien_id} onChange={e=>setFormMission({...formMission,technicien_id:e.target.value})} style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:'#1e293b',fontSize:13,fontFamily:'var(--font-b)'}}>
            <option value="">Auto-assign (disponible)</option>
            {techniciens.filter(t=>!formMission.specialite_filtre||t.specialite===formMission.specialite_filtre).map(t=><option key={t.id} value={t.id} disabled={!t.disponible}>{t.nom} — {t.specialite} {!t.disponible?'(indisponible)':t.missions_actives>=3?'(3/3 missions)':''}</option>)}
          </select>
        </div>
      </Modal>}

      {modalTech&&<Modal title="👷 Ajouter technicien" onClose={()=>setModalTech(false)} onSubmit={submitTech} label="Ajouter">
        {[{l:'Nom complet',k:'nom'},{l:'Email',k:'email',t:'email'},{l:'Mot de passe',k:'mot_de_passe'},{l:'Téléphone',k:'telephone'},{l:'Spécialité',k:'specialite'}].map(f=><F key={f.k} label={f.l} value={formTech[f.k]} onChange={v=>setFormTech({...formTech,[f.k]:v})} type={f.t||'text'}/>)}
      </Modal>}

      {editMission&&<Modal title="✏️ Modifier mission" onClose={()=>setEditMission(null)} onSubmit={saveEditMission} label="Enregistrer">
        <F label="Description" value={editMission.description} onChange={v=>setEditMission({...editMission,description:v})} type="textarea"/>
        <F label="Localisation" value={editMission.localisation} onChange={v=>setEditMission({...editMission,localisation:v})}/>
        <F label="Priorité" value={editMission.priorite} onChange={v=>setEditMission({...editMission,priorite:v})} type="select" opts={['faible','moyen','eleve','critique']}/>
        <div>
          <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700,fontFamily:'var(--font-b)'}}>Filtrer par spécialité</label>
          <select value={editMission.specialite_filtre||''} onChange={e=>setEditMission({...editMission,specialite_filtre:e.target.value,technicien_id:null})} style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:'#1e293b',fontSize:13,fontFamily:'var(--font-b)',marginBottom:10}}>
            <option value="">— Toutes les spécialités —</option>
            {[...new Set(techniciens.map(t=>t.specialite).filter(Boolean))].sort().map(sp=><option key={sp} value={sp}>{sp}</option>)}
          </select>
        </div>
        <div>
          <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700,fontFamily:'var(--font-b)'}}>Réassigner technicien</label>
          <select value={editMission.technicien_id||''} onChange={e=>setEditMission({...editMission,technicien_id:e.target.value||null})} style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:'#1e293b',fontSize:13,fontFamily:'var(--font-b)'}}>
            <option value="">Aucun</option>
            {techniciens.filter(t=>!editMission.specialite_filtre||t.specialite===editMission.specialite_filtre).map(t=><option key={t.id} value={t.id} disabled={!t.disponible}>{t.nom} — {t.specialite} {!t.disponible?'(indisponible)':t.missions_actives>=3?'(3/3 missions)':''}</option>)}
          </select>
        </div>
      </Modal>}

      {modalIndispo&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:'1rem'}}>
          <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h2 style={{fontSize:16,fontWeight:800,fontFamily:'var(--font-d)'}}>🔴 Marquer indisponible</h2>
              <button onClick={()=>setModalIndispo(null)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',fontSize:16,cursor:'pointer'}}>✕</button>
            </div>
            <p style={{fontSize:13,color:'#64748b',marginBottom:14}}><strong>{modalIndispo.tech.nom}</strong> sera marqué indisponible jusqu'à la date/heure ci-dessous.</p>
            <div style={{display:'flex',gap:10,marginBottom:16}}>
              <div style={{flex:1}}>
                <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:4,textTransform:'uppercase',fontWeight:700,letterSpacing:'.05em'}}>Date retour</label>
                <input type="date" value={modalIndispo.date} onChange={e=>setModalIndispo({...modalIndispo,date:e.target.value})} style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'9px',color:'#1e293b',fontSize:13}}/>
              </div>
              <div style={{flex:1}}>
                <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:4,textTransform:'uppercase',fontWeight:700,letterSpacing:'.05em'}}>Heure</label>
                <input type="time" value={modalIndispo.time} onChange={e=>setModalIndispo({...modalIndispo,time:e.target.value})} style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'9px',color:'#1e293b',fontSize:13}}/>
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>{
                const retour = new Date(`${modalIndispo.date}T${modalIndispo.time}:00`).toISOString().slice(0,19).replace('T',' ');
                updateTechnicien(modalIndispo.tech.id,{disponible:false,retour_disponible:retour,role_appelant:'admin'}).then(()=>{showNotif(`🔴 ${modalIndispo.tech.nom} marqué indisponible`);setModalIndispo(null);load();});
              }} style={{flex:1,background:'linear-gradient(135deg,#E30613,#F7941D)',color:'#fff',borderRadius:8,padding:'12px',fontSize:14,fontWeight:700,cursor:'pointer',border:'none'}}>Confirmer indisponibilité</button>
              <button onClick={()=>setModalIndispo(null)} style={{background:'#f8fafc',color:'#64748b',border:'1px solid #e0e7ff',borderRadius:8,padding:'12px 16px',fontSize:14,cursor:'pointer'}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Import Excel ── */}
      {modalImport&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,padding:'1rem'}}>
          <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',width:'100%',maxWidth:500,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <div>
                <h2 style={{fontSize:16,fontWeight:800,fontFamily:'var(--font-d)'}}>📥 Importer des missions</h2>
                <p style={{fontSize:12,color:'#64748b',marginTop:3}}>Fichier Excel (.xlsx) avec colonnes : description, localisation, priorite</p>
              </div>
              <button onClick={()=>setModalImport(false)} style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',fontSize:16,cursor:'pointer'}}>✕</button>
            </div>
            <div style={{marginBottom:14}}>
              <button onClick={downloadTemplateExcel} style={{background:'#eff6ff',color:'#0072BC',border:'1px solid #bfdbfe',borderRadius:8,padding:'8px 14px',fontSize:12,fontWeight:700,cursor:'pointer',width:'100%'}}>📄 Télécharger le template Excel</button>
            </div>
            <div style={{border:'2px dashed #e0e7ff',borderRadius:12,padding:'20px',textAlign:'center',background:'#f8fafc',marginBottom:14}}>
              <p style={{fontSize:11,color:'#64748b',marginBottom:8,fontFamily:'var(--font-b)',fontWeight:600}}>Sélectionnez votre fichier rempli</p>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={e=>setImportFile(e.target.files[0])} style={{fontSize:12,color:'#1e293b'}}/>
              {importFile&&<p style={{fontSize:11,color:'#39B54A',marginTop:6}}>✅ {importFile.name}</p>}
            </div>
            {importLoading&&<p style={{textAlign:'center',color:'#0072BC',fontSize:13,fontWeight:600}}>⏳ Import en cours...</p>}
            {importResult&&(
              <div style={{background:importResult.status==='ok'?'#f0fff4':'#fff0f0',border:`1px solid ${importResult.status==='ok'?'#c0eec8':'#ffd0d0'}`,borderRadius:8,padding:'10px',marginBottom:14}}>
                <p style={{fontSize:13,fontWeight:600,color:importResult.status==='ok'?'#39B54A':'#E30613'}}>{importResult.message||(importResult.status==='ok'?'✅ Import réussi':'❌ Erreur')}</p>
                {importResult.errors?.length>0&&<div style={{marginTop:6}}>{importResult.errors.map((e,i)=><p key={i} style={{fontSize:11,color:'#E30613'}}>{e}</p>)}</div>}
              </div>
            )}
            <div style={{display:'flex',gap:10}}>
              <button onClick={handleImportExcel} disabled={!importFile||importLoading} style={{flex:1,background:importFile&&!importLoading?'linear-gradient(135deg,#E30613,#F7941D)':'#e0e7ff',color:importFile&&!importLoading?'#fff':'#94a3b8',borderRadius:8,padding:'11px',fontSize:13,fontWeight:700,cursor:importFile&&!importLoading?'pointer':'not-allowed',border:'none'}}>📥 Importer</button>
              <button onClick={()=>{setModalImport(false);setImportFile(null);setImportResult(null);}} style={{background:'#f8fafc',color:'#64748b',border:'1px solid #e0e7ff',borderRadius:8,padding:'11px 16px',fontSize:13,cursor:'pointer'}}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

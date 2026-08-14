import React,{useState,useEffect,useRef} from 'react';
import {useAuth} from '../context/AuthContext';
import {getMissionsTech,updateMissionStatut,terminerMission,creerRapport,retoucheRapport,
        updateTechnicien,getMessages,envoyerMessage,
        getRapports,getTechniciens,getTechnicienById,marquerLue,signalerBlocage,updatePanneStatut} from '../hooks/useApi';


const TABS=['⚙️ Missions','📄 Rapports','✉️ Messages','👤 Profil'];
const PC={critique:'#E30613',eleve:'#F7941D',moyen:'#0072BC',faible:'#39B54A'};

export default function TechnicienPage(){
  const {user,signIn}=useAuth();
  const [tab,setTab]=useState(0);
  const [missions,setMissions]=useState([]);
  const [rapports,setRapports]=useState([]);
  const [messages,setMessages]=useState([]);
  const [techniciens,setTechniciens]=useState([]);
  const [notif,setNotif]=useState('');
  const [rapport,setRapport]=useState({visible:false,mission_id:null,panne_id:null,titre:'',contenu:'',statut_panne:'resolue'});
  const [retouche,setRetouche]=useState({visible:false,rapport_id:null,contenu:''});
  const [msgDest,setMsgDest]=useState('');
  const [msgContenu,setMsgContenu]=useState('');
  const [profil,setProfil]=useState({telephone:user?.telephone||'',specialite:user?.specialite||''});
  const [floatingChat,setFloatingChat]=useState(false);
  

  const load=()=>{
    getMissionsTech(user.id).then(setMissions).catch(console.error);
    getRapports().then(d=>setRapports(d.filter(r=>r.technicien_id===user.id))).catch(console.error);
    getMessages(user.id).then(setMessages).catch(console.error);
    
    // Rafraîchir la disponibilité depuis la BD (mise à jour par l'admin)
    getTechnicienById(user.id).then(moi=>{
      if(moi && moi.disponible !== user.disponible){
        signIn({...user, disponible: moi.disponible});
      }
    }).catch(console.error);
    getTechniciens().then(setTechniciens).catch(console.error);
  };

  useEffect(()=>{load();const t=setInterval(load,8000);return()=>clearInterval(t);},[]);

  const showNotif=msg=>{setNotif(msg);setTimeout(()=>setNotif(''),3500);};

  const accepter=async id=>{
    try{
      await updateMissionStatut(id,{statut:'acceptee'});
      showNotif('✅ Mission acceptée !');
    }catch(e){
      showNotif('❌ ' + (e.response?.data?.detail || "Impossible d'accepter la mission"));
    }
    load();
  };
  const refuser=async id=>{await updateMissionStatut(id,{statut:'refusee'});showNotif('❌ Mission refusée.');load();};
  const signalerBloque=async id=>{
    const raison=window.prompt('Raison du blocage (ex: lieu inaccessible, panne véhicule...):','Impossible d\'accéder au lieu de panne');
    if(raison===null)return; // annulé
    const res=await signalerBlocage(id,{raison});
    if(res.reassigne){
      showNotif('⚠️ Blocage signalé — Mission réassignée automatiquement à un autre technicien.');
    } else {
      showNotif('⚠️ Blocage signalé — Aucun technicien disponible, admin alerté.');
    }
    load();
  };
  const terminer=async id=>{
    showNotif('⏳ Finalisation de la mission...');
    const res = await terminerMission(id);
    if(res.nouvelle_mission){
      showNotif('🎉 Mission terminée ! Nouvelle mission assignée automatiquement ✅');
    } else {
      showNotif('🎉 Mission terminée ! En attente de la prochaine mission...');
    }
    load();
    // Deuxième reload après 3s pour capturer tout changement
    setTimeout(()=>load(), 3000);
  };

  const soumettre=async()=>{
    if(!rapport.contenu.trim())return;
    await creerRapport({titre:rapport.titre||`Rapport Mission #${rapport.mission_id}`,
      contenu:rapport.contenu,technicien_id:user.id,mission_id:rapport.mission_id,
      photos:[]});
    if(rapport.panne_id){
      await updatePanneStatut(rapport.panne_id,{statut:rapport.statut_panne});
    }
    setRapport({visible:false,mission_id:null,panne_id:null,titre:'',contenu:'',statut_panne:'resolue'});
    showNotif('📄 Rapport soumis !');load();
  };

  const soumettreRetouche=async()=>{
    if(!retouche.contenu.trim())return;
    await retoucheRapport(retouche.rapport_id,{contenu:retouche.contenu});
    setRetouche({visible:false,rapport_id:null,contenu:''});
    showNotif('✏️ Rapport retouché et resoumis !');load();
  };

  const envoyerMsg=async()=>{
    if(!msgContenu.trim()||!msgDest)return;
    await envoyerMessage({expediteur_id:user.id,destinataire_id:parseInt(msgDest),contenu:msgContenu});
    setMsgContenu('');showNotif('✉️ Message envoyé !');load();
  };

  const saveProfil=async()=>{
    await updateTechnicien(user.id,profil);
    signIn({...user,...profil});showNotif('✅ Profil mis à jour !');
  };

  // Helper: vérifier si une mission a déjà un rapport soumis
  const missionHasRapport = (missionId) => rapports.some(r => r.mission_id === missionId);
  // Vérifier si le technicien a déjà une mission active (acceptée ou en cours)
  const hasActiveMission = missions.some(m => ['acceptee','en_cours'].includes(m.statut));

  const cs={background:'#fff',border:'1px solid #e0e7ff',borderRadius:12,padding:'1.25rem',boxShadow:'0 2px 8px rgba(0,114,188,0.06)'};
  const actives=missions.filter(m=>!['terminee','refusee'].includes(m.statut));
  const terminees=missions.filter(m=>m.statut==='terminee');

  return(
    <div style={{padding:'1.5rem',display:'flex',flexDirection:'column',gap:16}}>
      {/* Header */}
      <div style={{...cs,background:'linear-gradient(135deg,#fff0f0,#fff8f0)',borderLeft:'4px solid #E30613'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:800,fontFamily:'var(--font-d)'}}>👋 {user?.nom}</h1>
            <p style={{color:'#64748b',fontSize:13,marginTop:3}}>{user?.specialite} · {actives.length}/1 mission active</p>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {/* Statut disponibilité — affiché seulement, non modifiable par le technicien */}
            <span style={{
              background:user?.disponible?'#f0fff4':'#fff0f0',
              color:user?.disponible?'#39B54A':'#E30613',
              border:`1px solid ${user?.disponible?'#c0eec8':'#ffd0d0'}`,
              borderRadius:20,padding:'6px 14px',fontSize:12,fontWeight:700,
              display:'flex',alignItems:'center',gap:5
            }}>
              {user?.disponible?'🟢 Disponible':'🔴 Indisponible'}
            </span>
            <span style={{fontSize:11,color:'#94a3b8',fontStyle:'italic'}}>Géré par l'admin</span>
          </div>
        </div>
      </div>

      {notif&&<div style={{background:'#f0fff4',border:'1px solid #c0eec8',borderRadius:10,
                            padding:'10px 16px',fontSize:13,color:'#39B54A',fontWeight:600}}>{notif}</div>}

      {/* Tabs */}
      <div style={{display:'flex',gap:3,background:'#fff',borderRadius:12,padding:'6px',
                   border:'1px solid #e0e7ff',flexWrap:'wrap'}}>
        {TABS.map((t,i)=>(
          <button key={t} onClick={()=>setTab(i)} style={{
            background:tab===i?'linear-gradient(135deg,#E30613,#F7941D)':'transparent',
            color:tab===i?'#fff':'#64748b',border:'none',padding:'8px 12px',
            fontSize:12,fontWeight:tab===i?700:400,borderRadius:8,cursor:'pointer',whiteSpace:'nowrap'}}>
            {t}
          </button>
        ))}
      </div>

      {/* ── TAB 0: Missions ── */}
      {tab===0&&(
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <h3 style={{fontSize:12,color:'#64748b',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:700}}>
            Mission active ({actives.length}/1)
          </h3>
          {actives.map((m,i)=>(
            <div key={m.id} style={{...cs,borderLeft:`4px solid ${PC[m.priorite]||'#0072BC'}`}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:8}}>
                    <span style={{background:'linear-gradient(135deg,#E30613,#F7941D)',color:'#fff',
                                  borderRadius:'50%',width:24,height:24,display:'flex',alignItems:'center',
                                  justifyContent:'center',fontSize:12,fontWeight:800,flexShrink:0}}>
                      #{i+1}
                    </span>
                    <span style={{background:`${PC[m.priorite]}22`,color:PC[m.priorite],
                                  padding:'2px 8px',borderRadius:20,fontSize:11,fontWeight:700}}>
                      {m.priorite}
                    </span>
                    <span className={`badge badge-${m.statut==='acceptee'?'success':m.statut==='en_cours'?'warning':m.statut==='refusee'?'danger':'muted'}`}>
                      {m.statut.replace(/_/g,' ')}
                    </span>
                  </div>
                  <p style={{fontSize:14,fontWeight:700,fontFamily:'var(--font-d)',marginBottom:4}}>{m.description}</p>
                  {m.panne_ticket&&(
                    <div style={{marginBottom:6}}>
                      <span style={{background:'#fff0f0',color:'#E30613',border:'1px solid #fca5a5',
                                    borderRadius:20,padding:'2px 9px',fontSize:11,fontWeight:700}}>
                        🎫 Ticket panne : {m.panne_ticket}
                      </span>
                      {m.panne_type&&<span style={{marginLeft:6,fontSize:10,color:'#64748b',background:'#f8fafc',
                                               border:'1px solid #e0e7ff',borderRadius:10,padding:'1px 6px'}}>
                        {m.panne_type}
                      </span>}
                    </div>
                  )}
                  <p style={{fontSize:12,color:'#64748b'}}>📍 {m.localisation}</p>
                  <p style={{fontSize:11,color:'#94a3b8',marginTop:4}}>📅 {new Date(m.date_creation).toLocaleDateString('fr-FR')}</p>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
                  {m.statut==='en_attente'&&(
                    hasActiveMission
                      ? <div style={{
                          display:'flex',flexDirection:'column',gap:2,
                          background:'#f1f5f9',border:'1px solid #e0e7ff',borderRadius:8,padding:'6px 10px',
                          fontSize:11,color:'#94a3b8',fontWeight:600,textAlign:'center',cursor:'not-allowed'}}>
                          <span>🔒 Mission bloquée</span>
                          <span style={{fontSize:10,fontWeight:400,color:'#94a3b8'}}>Terminez la mission en cours</span>
                        </div>
                      : <>
                          <button onClick={()=>accepter(m.id)} style={{
                            background:'#f0fff4',color:'#39B54A',border:'1px solid #c0eec8',
                            borderRadius:8,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>✅ Accepter</button>
                          <button onClick={()=>signalerBloque(m.id)} style={{
                            background:'#fffbf0',color:'#F7941D',border:'1px solid #fed7aa',
                            borderRadius:8,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>🚧 Bloqué</button>
                        </>
                  )}
                  {['acceptee','en_cours'].includes(m.statut)&&(<>
                    <button onClick={()=>setRapport({visible:true,mission_id:m.id,panne_id:m.panne_id||null,titre:'',contenu:'',statut_panne:'resolue'})} style={{
                      background:'#f0f8ff',color:'#0072BC',border:'1px solid #bfdbfe',
                      borderRadius:8,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>📄 Rapport</button>
                    {missionHasRapport(m.id)
                      ? <button onClick={()=>terminer(m.id)} style={{
                          background:'#f0fff4',color:'#39B54A',border:'1px solid #c0eec8',
                          borderRadius:8,padding:'7px 12px',fontSize:12,fontWeight:700,cursor:'pointer'}}>🏁 Terminer</button>
                      : <div style={{
                          display:'flex',flexDirection:'column',gap:2,
                          background:'#fffbeb',border:'1px solid #fde68a',borderRadius:8,padding:'6px 10px',
                          fontSize:11,color:'#92400e',fontWeight:600,textAlign:'center'}}>
                          <span>📄 Rapport requis</span>
                          <span style={{fontSize:10,fontWeight:400,color:'#a16207'}}>Soumettez un rapport pour terminer</span>
                        </div>
                    }
                  </>)}
                </div>
              </div>
            </div>
          ))}
          {actives.length===0&&(
            <div style={{...cs,textAlign:'center',padding:'2.5rem'}}>
              <p style={{fontSize:32,marginBottom:12}}>✅</p>
              <p style={{color:'#64748b',fontSize:14,fontWeight:600}}>Aucune mission active</p>
              <p style={{color:'#94a3b8',fontSize:12,marginTop:6}}>Nouvelles missions assignées automatiquement...</p>
            </div>
          )}
          {terminees.length>0&&(
            <div style={{marginTop:8}}>
              <h3 style={{fontSize:12,color:'#64748b',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:700,marginBottom:10}}>
                Terminées ({terminees.length})
              </h3>
              {terminees.slice(0,4).map(m=>(
                <div key={m.id} style={{...cs,opacity:.7,borderLeft:'4px solid #39B54A',marginBottom:8}}>
                  <p style={{fontSize:13,fontWeight:600}}>{m.description}</p>
                  <p style={{fontSize:11,color:'#94a3b8',marginTop:4}}>📍 {m.localisation} · ✅ {m.date_fin?new Date(m.date_fin).toLocaleDateString('fr-FR'):'—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 1: Rapports ── */}
      {tab===1&&(
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          {/* Stats rapports */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
            {[
              {l:'Total',       v:rapports.length,            c:'#0072BC',bg:'#eff6ff'},
              {l:'Approuvés',   v:rapports.filter(r=>r.statut==='approuve').length, c:'#39B54A',bg:'#f0fff4'},
              {l:'En attente',  v:rapports.filter(r=>r.statut==='soumis').length,   c:'#F7941D',bg:'#fff8f0'},
            ].map(s=>(
              <div key={s.l} style={{background:s.bg,border:`1px solid ${s.c}33`,borderRadius:10,padding:'12px',textAlign:'center'}}>
                <p style={{fontSize:22,fontWeight:800,color:s.c,fontFamily:'var(--font-d)'}}>{s.v}</p>
                <p style={{fontSize:11,color:'#64748b',marginTop:3}}>{s.l}</p>
              </div>
            ))}
          </div>
          {rapports.length===0&&(
            <div style={{textAlign:'center',padding:'3rem',color:'#94a3b8'}}>
              <p style={{fontSize:32,marginBottom:8}}>📄</p>
              <p style={{fontSize:14,fontWeight:600}}>Aucun rapport soumis</p>
              <p style={{fontSize:12,marginTop:4}}>Terminez une mission et créez votre premier rapport</p>
            </div>
          )}
          {rapports.map(r=>{
            const SC={approuve:{bg:'#f0fff4',color:'#39B54A',border:'#c0eec8',icon:'✅'},
                      soumis: {bg:'#eff6ff',color:'#0072BC',border:'#bfdbfe',icon:'⏳'},
                      rejete: {bg:'#fff0f0',color:'#E30613',border:'#ffd0d0',icon:'❌'},
                      brouillon:{bg:'#f8fafc',color:'#64748b',border:'#e0e7ff',icon:'📝'}};
            const s=SC[r.statut]||SC.brouillon;
            return(
            <div key={r.id} style={{...cs,borderLeft:`4px solid ${s.color}`}}>
              {/* En-tête rapport */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{fontSize:13,fontWeight:800,fontFamily:'var(--font-d)'}}>{r.titre||`Rapport #${r.id}`}</span>
                    <span style={{background:s.bg,color:s.color,border:`1px solid ${s.border}`,
                                  borderRadius:20,padding:'2px 8px',fontSize:10,fontWeight:700}}>
                      {s.icon} {r.statut}
                    </span>
                  </div>
                  <p style={{fontSize:12,color:'#64748b'}}>🎯 {r.mission_desc||'Mission non spécifiée'}</p>
                  <p style={{fontSize:11,color:'#94a3b8',marginTop:3}}>
                    📅 {new Date(r.date_creation).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}
                    {r.nb_photos>0&&<span style={{marginLeft:10}}>📸 {r.nb_photos} photo(s)</span>}
                  </p>
                </div>
                {r.statut==='rejete'&&(
                  <button onClick={()=>setRetouche({visible:true,rapport_id:r.id,contenu:r.contenu})}
                    style={{background:'#fff8f0',color:'#F7941D',border:'1px solid #ffe0b0',flexShrink:0,
                            borderRadius:8,padding:'6px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                    ✏️ Retoucher
                  </button>
                )}
              </div>
              {/* Contenu */}
              <div style={{background:'#f8fafc',borderRadius:8,padding:'12px',fontSize:13,lineHeight:1.7,
                           color:'#334155',borderLeft:'3px solid #e0e7ff',maxHeight:120,overflowY:'auto'}}>
                {r.contenu}
              </div>
              {/* Message rejet si applicable */}
              {r.statut==='rejete'&&(
                <div style={{background:'#fff0f0',border:'1px solid #ffd0d0',borderRadius:8,padding:'10px',marginTop:10}}>
                  <p style={{fontSize:12,color:'#E30613',fontWeight:600}}>❌ Rapport rejeté par l'admin — cliquez "Retoucher" pour corriger et resoumettre</p>
                </div>
              )}
              {r.statut==='approuve'&&(
                <div style={{background:'#f0fff4',border:'1px solid #c0eec8',borderRadius:8,padding:'8px 12px',marginTop:10}}>
                  <p style={{fontSize:12,color:'#39B54A',fontWeight:600}}>✅ Rapport approuvé par l'admin</p>
                </div>
              )}
            </div>
          );})}
        </div>
      )}

      {/* ── TAB 2: Messages ── */}
      {tab===2&&(
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div style={cs}>
            <h3 style={{fontSize:13,fontWeight:700,marginBottom:14,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em'}}>✉️ Nouveau message</h3>
            <select value={msgDest} onChange={e=>setMsgDest(e.target.value)}
              style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:'#1e293b',fontSize:13,marginBottom:10}}>
              <option value="">Destinataire...</option>
              {techniciens.filter(t=>t.id!==user.id).map(t=>(
                <option key={t.id} value={t.id}>{t.nom} — {t.specialite}</option>
              ))}
            </select>
            <textarea value={msgContenu} onChange={e=>setMsgContenu(e.target.value)} placeholder="Message..." rows={3}
              style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:'#1e293b',fontSize:13,resize:'vertical',marginBottom:10}}/>
            <button onClick={envoyerMsg} style={{background:'linear-gradient(135deg,#E30613,#F7941D)',color:'#fff',borderRadius:8,padding:'10px 20px',fontSize:13,fontWeight:700,cursor:'pointer'}}>
              Envoyer ✉️
            </button>
          </div>
          <div style={cs}>
            <h3 style={{fontSize:13,fontWeight:700,marginBottom:14,color:'#64748b',textTransform:'uppercase',letterSpacing:'.06em'}}>📬 Conversations</h3>
            <div style={{display:'flex',flexDirection:'column',gap:8,maxHeight:350,overflowY:'auto'}}>
              {messages.map(m=>(
                <div key={m.id} style={{background:m.expediteur_id===user.id?'#fff0f0':'#f8fafc',
                                         borderRadius:10,padding:'10px 14px',
                                         borderLeft:`3px solid ${m.expediteur_id===user.id?'#E30613':'#39B54A'}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                    <span style={{fontSize:12,fontWeight:700,color:m.expediteur_id===user.id?'#E30613':'#39B54A'}}>
                      {m.expediteur_id===user.id?'Moi':'📨 '+m.expediteur_nom}
                    </span>
                    <span style={{fontSize:10,color:'#94a3b8'}}>{new Date(m.created_at).toLocaleString('fr-FR')}</span>
                  </div>
                  <p style={{fontSize:13}}>{m.contenu}</p>
                </div>
              ))}
              {messages.length===0&&<p style={{color:'#94a3b8',textAlign:'center',fontSize:13}}>Aucun message</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: Profil ── */}
      {tab===3&&(
        <div style={cs}>
          <h2 style={{fontSize:18,fontWeight:800,fontFamily:'var(--font-d)',marginBottom:20}}>👤 Mon profil</h2>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:20}}>
            {[{l:'Nom',k:'nom',d:true,v:user?.nom},{l:'Email',k:'email',d:true,v:user?.email},
              {l:'Téléphone',k:'telephone',v:profil.telephone},{l:'Spécialité',k:'specialite',v:profil.specialite}].map(f=>(
              <div key={f.k}>
                <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700}}>{f.l}</label>
                <input value={f.v||''} 
                  onChange={e=>setProfil({...profil,[f.k]:e.target.value})}
                  style={{width:'100%',background:f.d?'#f8fafc':'#fff',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:f.d?'#94a3b8':'#1e293b',fontSize:13}}/>
              </div>
            ))}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
            {[{v:actives.length,l:'Missions actives',c:'#F7941D'},{v:terminees.length,l:'Terminées',c:'#39B54A'},{v:rapports.length,l:'Rapports',c:'#0072BC'}].map(s=>(
              <div key={s.l} style={{background:'#f8fafc',borderRadius:10,padding:'14px',textAlign:'center',border:'1px solid #e0e7ff'}}>
                <p style={{fontSize:24,fontWeight:800,color:s.c,fontFamily:'var(--font-d)'}}>{s.v}</p>
                <p style={{fontSize:11,color:'#64748b',marginTop:3}}>{s.l}</p>
              </div>
            ))}
          </div>
          <button onClick={saveProfil} style={{background:'linear-gradient(135deg,#E30613,#F7941D)',color:'#fff',borderRadius:8,padding:'11px 24px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
            💾 Enregistrer
          </button>
        </div>
      )}

      {/* Modal Rapport */}
      {rapport.visible&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}}>
          <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',width:'100%',maxWidth:580,maxHeight:'92vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.25)'}}>
            {/* Header */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div>
                <h2 style={{fontSize:18,fontWeight:800,fontFamily:'var(--font-d)'}}>📄 Créer un rapport</h2>
                <p style={{fontSize:12,color:'#64748b',marginTop:3}}>Mission #{rapport.mission_id}</p>
              </div>
              <button onClick={()=>setRapport({visible:false,mission_id:null,panne_id:null,titre:'',contenu:'',statut_panne:'resolue'})}
                style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',fontSize:16,cursor:'pointer'}}>✕</button>
            </div>
            {/* Titre */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700}}>Titre du rapport</label>
              <input value={rapport.titre} onChange={e=>setRapport({...rapport,titre:e.target.value})}
                placeholder={`Rapport Mission #${rapport.mission_id}`}
                style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:'#1e293b',fontSize:13}}/>
            </div>
            {/* Contenu */}
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700}}>Contenu / Description des travaux</label>
              <textarea value={rapport.contenu} onChange={e=>setRapport({...rapport,contenu:e.target.value})}
                rows={6} placeholder="Décrivez les travaux effectués, les problèmes rencontrés, les solutions apportées..."
                style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:'#1e293b',fontSize:13,resize:'vertical',lineHeight:1.6}}/>
              <p style={{fontSize:11,color:'#94a3b8',marginTop:4,textAlign:'right'}}>{rapport.contenu.length} caractères</p>
            </div>
            {/* Statut panne */}
            <div style={{marginBottom:16}}>
              <label style={{fontSize:11,color:'#64748b',display:'block',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:700}}>
                🔧 Statut de la panne {!rapport.panne_id&&<span style={{color:'#94a3b8',fontWeight:400,textTransform:'none'}}> — aucune panne liée</span>}
              </label>
              <div style={{display:'flex',gap:8}}>
                {[
                  {v:'resolue',  label:'✅ Résolue',     bg:'#f0fff4',color:'#39B54A',border:'#c0eec8'},
                  {v:'assignee', label:'⚙️ En cours',    bg:'#fff8f0',color:'#F7941D',border:'#ffe0b0'},
                  {v:'ouverte',  label:'🔴 Non résolue', bg:'#fff0f0',color:'#E30613',border:'#ffd0d0'},
                ].map(opt=>(
                  <button key={opt.v} onClick={()=>rapport.panne_id&&setRapport({...rapport,statut_panne:opt.v})}
                    style={{flex:1,background:rapport.statut_panne===opt.v?opt.bg:'#f8fafc',
                            color:rapport.statut_panne===opt.v?opt.color:'#94a3b8',
                            border:`2px solid ${rapport.statut_panne===opt.v?opt.border:'#e0e7ff'}`,
                            borderRadius:8,padding:'9px 4px',fontSize:11,fontWeight:700,
                            cursor:rapport.panne_id?'pointer':'not-allowed',opacity:rapport.panne_id?1:.45,
                            transition:'all .15s'}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Boutons */}
            <div style={{display:'flex',gap:10}}>
              <button onClick={soumettre} disabled={!rapport.contenu.trim()}
                style={{flex:1,background:rapport.contenu.trim()?'linear-gradient(135deg,#E30613,#F7941D)':'#e0e7ff',
                        color:rapport.contenu.trim()?'#fff':'#94a3b8',borderRadius:8,padding:'12px',
                        fontSize:14,fontWeight:700,cursor:rapport.contenu.trim()?'pointer':'not-allowed',border:'none'}}>
                📤 Soumettre le rapport
              </button>
              <button onClick={()=>setRapport({visible:false,mission_id:null,panne_id:null,titre:'',contenu:'',statut_panne:'resolue'})}
                style={{background:'#f8fafc',color:'#64748b',border:'1px solid #e0e7ff',borderRadius:8,padding:'12px 16px',fontSize:14,cursor:'pointer'}}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Retouche rapport */}
      {retouche.visible&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,padding:'1rem'}}>
          <div style={{background:'#fff',borderRadius:16,padding:'1.5rem',width:'100%',maxWidth:520,boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <h2 style={{fontSize:18,fontWeight:800,fontFamily:'var(--font-d)'}}>✏️ Retoucher le rapport</h2>
              <button onClick={()=>setRetouche({visible:false,rapport_id:null,contenu:''})}
                style={{background:'#f1f5f9',border:'none',borderRadius:8,padding:'6px 10px',fontSize:16,cursor:'pointer'}}>✕</button>
            </div>
            <p style={{fontSize:12,color:'#F7941D',marginBottom:14,background:'#fff8f0',padding:'8px 12px',borderRadius:8,border:'1px solid #ffe0b0'}}>
              ⚠️ Ce rapport a été rejeté. Modifiez le contenu et resoumettez.
            </p>
            <textarea value={retouche.contenu} onChange={e=>setRetouche({...retouche,contenu:e.target.value})}
              rows={6} style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',borderRadius:8,padding:'10px',color:'#1e293b',fontSize:13,resize:'vertical',marginBottom:16}}/>
            <div style={{display:'flex',gap:10}}>
              <button onClick={soumettreRetouche} style={{flex:1,background:'linear-gradient(135deg,#F7941D,#FFD700)',color:'#fff',borderRadius:8,padding:'11px',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                📤 Resoumettre
              </button>
              <button onClick={()=>setRetouche({visible:false,rapport_id:null,contenu:''})}
                style={{background:'#f8fafc',color:'#64748b',border:'1px solid #e0e7ff',borderRadius:8,padding:'11px 16px',fontSize:14,cursor:'pointer'}}>Annuler</button>
            </div>
          </div>
        </div>
      )}

     
      
    </div>
  );
}
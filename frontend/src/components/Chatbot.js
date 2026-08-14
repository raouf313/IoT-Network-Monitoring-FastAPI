import React,{useState,useRef,useEffect} from 'react';
import {chatbot} from '../hooks/useApi';
import {useAuth} from '../context/AuthContext';

const SUGGESTIONS_ADMIN = [
  "Quels techniciens Réseau sont disponibles ?",
  "Techniciens disponibles par spécialité",
  "Statistiques complètes des missions",
  "Combien de pannes sont ouvertes ?",
  "Crée une mission fibre optique critique à Sfax",
  "Auto-assigner les missions selon les spécialités",
  "Liste les rapports en attente d'approbation",
  "Quelle est la panne la plus critique en ce moment ?",
];

const SUGGESTIONS_TECH = [
  "Quelles sont mes missions actives ?",
  "Y a-t-il de nouvelles alertes ?",
  "Aide-moi à rédiger un rapport de maintenance",
  "Combien de missions ai-je terminées ce mois ?",
];

// Rendu markdown enrichi
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-size:12px;color:#E30613">$1</code>')
    .replace(/^### (.+)$/gm, '<div style="font-weight:700;color:#0072BC;font-size:13px;margin:8px 0 4px">$1</div>')
    .replace(/^## (.+)$/gm, '<div style="font-weight:700;color:#E30613;font-size:14px;margin:8px 0 4px">$1</div>')
    .replace(/^# (.+)$/gm, '<div style="font-weight:800;color:#E30613;font-size:15px;margin:8px 0 4px">$1</div>')
    .replace(/^[-•] (.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="color:#E30613;font-weight:700">•</span><span>$1</span></div>')
    .replace(/^(\d+)\. (.+)$/gm, '<div style="display:flex;gap:6px;margin:2px 0"><span style="color:#0072BC;font-weight:700;min-width:16px">$1.</span><span>$2</span></div>')
    .replace(/\n\n/g, '<div style="height:8px"></div>')
    .replace(/\n/g, '<br/>');
}

export default function Chatbot({ onRefresh }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState([
    { role:'assistant', text:`Bonjour **${user?.nom}** ! 👋\n\nJe suis l'assistant IA de **Tunisie Telecom**. J'ai accès à la base de données en temps réel.\n\n**Je peux :**\n- 📊 Afficher les statistiques et l'état du système\n- 👷 Gérer les techniciens (ajouter, disponibilité)\n- 📋 Créer et modifier des missions\n- 🚨 Créer et résoudre des pannes\n- 🤖 Auto-assigner les missions aux techniciens\n- ✅ Approuver / rejeter des rapports\n\nComment puis-je vous aider ?` }
  ]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [historique, setHistorique] = useState([]);
  const [showSugg, setShowSugg] = useState(true);
  const bottomRef = useRef();
  const inputRef  = useRef();

  const suggestions = user?.role === 'admin' ? SUGGESTIONS_ADMIN : SUGGESTIONS_TECH;

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({behavior:'smooth'});
  },[msgs]);

  const send = async (question) => {
    const q = question || input.trim();
    if (!q || loading) return;
    setInput('');
    setShowSugg(false);

    setMsgs(p => [...p, { role:'user', text: q }]);
    setLoading(true);

    try {
      const res = await chatbot({
        message: q,
        user_id: user?.id,
        user_role: user?.role,
        historique: historique.slice(-8),
      });
      const aiMsg = {
        role: 'assistant',
        text: res.reponse || res.response || res.message || '✅ Action effectuée.',
        action_done: res.action_executee || res.action_done,
      };
      setMsgs(p => [...p, aiMsg]);
      setHistorique(h => [...h,
        {role:'user', content: q},
        {role:'assistant', content: aiMsg.text}
      ].slice(-16));
      if ((res.action_executee || res.action_done) && onRefresh) {
        setTimeout(onRefresh, 600);
      }
    } catch(err) {
      const errMsg = err?.response?.data?.detail || err?.message || 'Erreur de connexion';
      setMsgs(p => [...p, {role:'assistant', text:`❌ **Erreur :** ${errMsg}\n\nVérifiez que le backend est bien démarré sur le port 8000.`}]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    setMsgs([{ role:'assistant', text:`💬 Conversation réinitialisée. Comment puis-je vous aider, **${user?.nom}** ?` }]);
    setHistorique([]);
    setShowSugg(true);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', minHeight:500 }}>
      {/* Header */}
      <div style={{
        display:'flex', alignItems:'center', gap:10, marginBottom:14,
        padding:'10px 14px', background:'linear-gradient(135deg,#E30613,#F7941D)',
        borderRadius:10, color:'#fff', flexShrink:0
      }}>
        <div style={{
          width:38, height:38, borderRadius:'50%', background:'rgba(255,255,255,0.2)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:20
        }}>🤖</div>
        <div style={{flex:1}}>
          <p style={{fontSize:14, fontWeight:700, margin:0}}>Assistant IA — Tunisie Telecom</p>
          <p style={{fontSize:11, opacity:.85, margin:0}}>BD temps réel · Accès complet données</p>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <div style={{width:8, height:8, borderRadius:'50%', background:'#4ade80', boxShadow:'0 0 6px #4ade80'}}/>
          <button onClick={clearChat} title="Réinitialiser" style={{
            background:'rgba(255,255,255,0.15)', border:'none', color:'#fff',
            borderRadius:6, padding:'4px 8px', fontSize:11, cursor:'pointer'
          }}>🗑️</button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex:1, overflowY:'auto', display:'flex', flexDirection:'column',
        gap:10, padding:'2px 0', marginBottom:10
      }}>
        {msgs.map((m,i) => (
          <div key={i} style={{
            display:'flex', justifyContent: m.role==='user' ? 'flex-end' : 'flex-start',
          }}>
            {m.role==='assistant' && (
              <div style={{
                width:30, height:30, borderRadius:'50%', flexShrink:0,
                background:'linear-gradient(135deg,#E30613,#F7941D)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:15, marginRight:8, alignSelf:'flex-end', marginBottom:2
              }}>🤖</div>
            )}
            <div style={{
              maxWidth:'80%',
              background: m.role==='user'
                ? 'linear-gradient(135deg,#0072BC,#00A99D)'
                : m.action_done ? '#f0fff4' : '#f8fafc',
              color: m.role==='user' ? '#fff' : '#1e293b',
              borderRadius: m.role==='user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              padding:'10px 14px', fontSize:13, lineHeight:1.7,
              border: m.action_done ? '1px solid #bbf7d0' : m.role==='user' ? 'none' : '1px solid #e2e8f0',
              boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
            }}>
              {m.action_done && (
                <div style={{
                  fontSize:11, color:'#16a34a', fontWeight:700, marginBottom:6,
                  background:'#dcfce7', borderRadius:6, padding:'3px 8px', display:'inline-block'
                }}>✅ Action exécutée avec succès</div>
              )}
              <div dangerouslySetInnerHTML={{__html: renderMarkdown(m.text)}}/>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <div style={{width:30, height:30, borderRadius:'50%',
                         background:'linear-gradient(135deg,#E30613,#F7941D)',
                         display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>🤖</div>
            <div style={{
              background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'14px 14px 14px 4px',
              padding:'10px 16px', fontSize:13, color:'#94a3b8'
            }}>
              <span style={{display:'inline-flex', gap:4, alignItems:'center'}}>
                <span style={{fontSize:11}}>En train de réfléchir</span>
                <span style={{display:'inline-flex', gap:3}}>
                  {[0,0.2,0.4].map((d,i) => (
                    <span key={i} style={{
                      display:'inline-block', width:5, height:5, borderRadius:'50%',
                      background:'#E30613', animation:`bounce 1.2s infinite ${d}s`
                    }}/>
                  ))}
                </span>
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Suggestions */}
      {showSugg && (
        <div style={{marginBottom:10}}>
          <p style={{fontSize:11, color:'#94a3b8', marginBottom:6, fontWeight:600}}>💡 Suggestions :</p>
          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
            {suggestions.slice(0,4).map(s => (
              <button key={s} onClick={()=>send(s)} style={{
                background:'#fff0f0', color:'#E30613', border:'1px solid #ffd0d0',
                borderRadius:20, padding:'5px 11px', fontSize:11, fontWeight:600,
                cursor:'pointer', transition:'all .15s', whiteSpace:'nowrap'
              }}>
                {s.length > 35 ? s.slice(0,35)+'...' : s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{display:'flex', gap:8, flexShrink:0}}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key==='Enter' && !e.shiftKey && send()}
          placeholder="Posez une question ou demandez une action..."
          disabled={loading}
          style={{
            flex:1, background:'#f8fafc', border:'1.5px solid #e0e7ff',
            borderRadius:10, padding:'11px 14px', color:'#1e293b', fontSize:13,
            outline:'none', transition:'border .15s',
          }}
          onFocus={e => e.target.style.borderColor='#E30613'}
          onBlur={e => e.target.style.borderColor='#e0e7ff'}
        />
        <button onClick={()=>send()} disabled={loading || !input.trim()} style={{
          background: loading || !input.trim()
            ? '#f1f5f9'
            : 'linear-gradient(135deg,#E30613,#F7941D)',
          color: loading || !input.trim() ? '#94a3b8' : '#fff',
          borderRadius:10, padding:'0 18px', fontSize:13, fontWeight:700,
          cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
          minWidth:80, transition:'all .15s', border:'none'
        }}>
          {loading ? '...' : 'Envoyer ➤'}
        </button>
      </div>

      <style>{`
        @keyframes bounce { 
          0%,80%,100%{transform:translateY(0);opacity:1} 
          40%{transform:translateY(-5px);opacity:.6} 
        }
      `}</style>
    </div>
  );
}

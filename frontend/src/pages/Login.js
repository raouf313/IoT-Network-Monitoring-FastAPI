import React,{useState} from 'react';
import {useAuth} from '../context/AuthContext';
import {login} from '../hooks/useApi';

export default function Login(){
  const {signIn}=useAuth();
  const [form,setForm]=useState({email:'',password:''});
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);

  const submit=async e=>{
    e.preventDefault();setLoading(true);setError('');
    try{const r=await login(form);signIn(r.user);}
    catch{setError('Email ou mot de passe incorrect');}
    finally{setLoading(false);}
  };

  const comptes=[
    {label:'Admin TT',      email:'admin@tunisietelecom.tn', mdp:'admin123', icon:'👑', color:'#E30613'},
    {label:'Ahmed — Réseau',email:'ahmed@tunisietelecom.tn', mdp:'tech123',  icon:'🔌', color:'#0072BC'},
    {label:'Sara — Élec.',  email:'sara@tunisietelecom.tn',  mdp:'tech123',  icon:'⚡', color:'#F7941D'},
    {label:'Karim — Info.', email:'karim@tunisietelecom.tn', mdp:'tech123',  icon:'💻', color:'#39B54A'},
    {label:'Fatma — Clima.',email:'fatma@tunisietelecom.tn', mdp:'tech123',  icon:'❄️', color:'#00A99D'},
  ];

  return(
    <div style={{minHeight:'100vh',display:'flex',background:'#f0f4ff'}}>
      {/* Left — Branding */}
      <div style={{
        width:'45%',display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'center',padding:'3rem',
        background:'linear-gradient(145deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)',
        position:'relative',overflow:'hidden'
      }}>
        {/* Decorative circles with TT colors */}
        {[
          {c:'#E30613',s:300,t:-80,l:-80,o:.08},
          {c:'#F7941D',s:200,t:100,l:200,o:.06},
          {c:'#0072BC',s:250,b:-60,r:-60,o:.07},
          {c:'#39B54A',s:150,b:80,l:80,o:.05},
        ].map((d,i)=>(
          <div key={i} style={{
            position:'absolute',width:d.s,height:d.s,borderRadius:'50%',
            background:d.c,opacity:d.o,
            top:d.t,left:d.l,bottom:d.b,right:d.r,
          }}/>
        ))}

        <div style={{position:'relative',zIndex:1,textAlign:'center'}}>
          {/* Real TT Logo */}
          <div style={{
            background:'rgba(255,255,255,0.95)',borderRadius:20,
            padding:'16px 32px',display:'inline-block',marginBottom:28,
            boxShadow:'0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <img src="/logo-tt.jpg" alt="Tunisie Telecom"
              style={{height:60,objectFit:'contain',display:'block'}}/>
          </div>

          <h1 style={{fontFamily:'Syne,sans-serif',fontSize:28,fontWeight:800,
                      color:'#fff',lineHeight:1.2,marginBottom:8}}>
            Workflow Automation
          </h1>
          <p style={{fontSize:14,color:'rgba(255,255,255,0.6)',marginBottom:40}}>
            Système de gestion des pannes et missions
          </p>

          {/* Feature list */}
          <div style={{display:'flex',flexDirection:'column',gap:12,maxWidth:300}}>
            {[
              {icon:'📡',text:'Surveillance capteurs IoT',color:'#00A99D'},
              {icon:'🚨',text:'Détection automatique des pannes',color:'#E30613'},
              {icon:'👷',text:'Gestion des techniciens',color:'#F7941D'},
              {icon:'🤖',text:'Assistant IA NVIDIA NIM',color:'#662D91'},
              {icon:'📊',text:'Tableaux de bord temps réel',color:'#0072BC'},
            ].map(f=>(
              <div key={f.text} style={{
                display:'flex',alignItems:'center',gap:12,
                background:'rgba(255,255,255,0.06)',
                borderLeft:`3px solid ${f.color}`,
                borderRadius:'0 10px 10px 0',padding:'10px 14px'
              }}>
                <span style={{fontSize:18}}>{f.icon}</span>
                <span style={{fontSize:13,color:'rgba(255,255,255,0.85)'}}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Form */}
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'2rem'}}>
        <div style={{width:'100%',maxWidth:440}}>
          {/* Mobile logo */}
          <div style={{marginBottom:28,display:'flex',alignItems:'center',gap:12}}>
            <img src="/logo-tt.jpg" alt="TT" style={{height:40,objectFit:'contain'}}/>
            <div>
              <p style={{fontFamily:'Syne,sans-serif',fontWeight:800,fontSize:14,color:'#E30613'}}>TUNISIE TELECOM</p>
              <p style={{fontSize:11,color:'#64748b'}}>Workflow Automation System</p>
            </div>
          </div>

          <div style={{
            background:'#fff',borderRadius:20,padding:'2rem',
            boxShadow:'0 8px 32px rgba(0,114,188,0.10)',
            border:'1px solid #e0e7ff'
          }}>
            <h2 style={{fontFamily:'Syne,sans-serif',fontSize:24,fontWeight:800,marginBottom:6,color:'#1e293b'}}>
              Connexion
            </h2>
            <p style={{fontSize:13,color:'#64748b',marginBottom:24}}>
              Accédez à votre espace de travail Tunisie Telecom
            </p>

            <form onSubmit={submit}>
              {[
                {label:'Adresse email',key:'email',type:'email',placeholder:'votre@tunisietelecom.tn'},
                {label:'Mot de passe', key:'password',type:'password',placeholder:'••••••••'},
              ].map(f=>(
                <div key={f.key} style={{marginBottom:16}}>
                  <label style={{fontSize:11,color:'#64748b',textTransform:'uppercase',
                                 letterSpacing:'.08em',display:'block',marginBottom:8,fontWeight:700}}>
                    {f.label}
                  </label>
                  <input type={f.type} value={form[f.key]}
                    onChange={e=>setForm({...form,[f.key]:e.target.value})}
                    placeholder={f.placeholder} required
                    style={{width:'100%',background:'#f8fafc',border:'1.5px solid #e0e7ff',
                            borderRadius:10,padding:'12px 14px',color:'#1e293b',fontSize:14,
                            transition:'border-color .2s'}}/>
                </div>
              ))}

              {error&&(
                <div style={{background:'#fff0f0',border:'1px solid #ffd0d0',borderRadius:10,
                             padding:'10px 14px',color:'#E30613',fontSize:13,marginBottom:16,
                             display:'flex',alignItems:'center',gap:8}}>
                  ⚠️ {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width:'100%',
                background:'linear-gradient(135deg,#E30613 0%,#F7941D 100%)',
                color:'#fff',borderRadius:10,padding:'13px',fontSize:15,fontWeight:800,
                fontFamily:'Syne,sans-serif',opacity:loading?0.75:1,letterSpacing:'.02em',
                boxShadow:'0 4px 16px rgba(227,6,19,0.3)',cursor:'pointer'
              }}>
                {loading ? '⏳ Connexion...' : '🔐 Se connecter'}
              </button>
            </form>

            {/* Demo accounts */}
            <div style={{marginTop:20,borderTop:'1px solid #e0e7ff',paddingTop:16}}>
              <p style={{fontSize:11,color:'#94a3b8',marginBottom:10,textTransform:'uppercase',
                         letterSpacing:'.06em',fontWeight:600}}>
                Comptes de démonstration
              </p>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {comptes.map(c=>(
                  <button key={c.email} onClick={()=>setForm({email:c.email,password:c.mdp})}
                    style={{
                      background:'#fafafa',color:'#1e293b',border:'1px solid #e0e7ff',
                      borderRadius:8,padding:'8px 12px',fontSize:12,textAlign:'left',
                      display:'flex',alignItems:'center',gap:8,cursor:'pointer',
                      transition:'all .15s',borderLeft:`3px solid ${c.color}`
                    }}>
                    <span>{c.icon}</span>
                    <span style={{fontWeight:700}}>{c.label}</span>
                    <span style={{color:'#94a3b8',marginLeft:'auto',fontSize:11}}>{c.email}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

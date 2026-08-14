import React from 'react';
import {BrowserRouter,Routes,Route,Navigate,NavLink,useNavigate} from 'react-router-dom';
import {AuthProvider,useAuth} from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TechnicienPage from './pages/TechnicienPage';
import './index.css';

function Layout(){
  const {user,signOut}=useAuth();
  const navigate=useNavigate();
  const nav=user?.role==='admin'
    ?[{to:'/dashboard',label:'Dashboard',icon:'📊'}]
    :[{to:'/espace',label:'Mon Espace',icon:'⚙️'}];

  return(
    <div style={{display:'flex',minHeight:'100vh'}}>
      {/* Sidebar */}
      <aside style={{
        width:220,background:'#1a1a2e',display:'flex',
        flexDirection:'column',position:'fixed',height:'100vh',zIndex:50,
        borderRight:'1px solid rgba(255,255,255,0.05)'
      }}>
        {/* Logo TT */}
        <div style={{padding:'1.25rem',borderBottom:'1px solid rgba(255,255,255,0.08)',
                     background:'linear-gradient(135deg,rgba(227,6,19,0.1),rgba(247,148,29,0.1))'}}>
          <div style={{background:'rgba(255,255,255,0.95)',borderRadius:10,padding:'8px 12px',display:'inline-block'}}>
            <img src="/logo-tt.jpg" alt="TT" style={{height:28,objectFit:'contain',display:'block'}}/>
          </div>
          <p style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginTop:6,letterSpacing:'.1em',textTransform:'uppercase'}}>
            Workflow Automation
          </p>
        </div>

        {/* User info */}
        <div style={{padding:'1rem 1.25rem',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{width:36,height:36,borderRadius:'50%',
                       background:'linear-gradient(135deg,#E30613,#F7941D)',
                       display:'flex',alignItems:'center',justifyContent:'center',
                       fontSize:16,marginBottom:8}}>
            {user?.role==='admin'?'👑':'👷'}
          </div>
          <p style={{fontSize:13,fontWeight:700,color:'#fff',fontFamily:'Syne,sans-serif'}}>{user?.nom}</p>
          <p style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>{user?.specialite||user?.role}</p>
          <span style={{display:'inline-block',marginTop:6,
                        background:user?.role==='admin'?'rgba(227,6,19,0.3)':'rgba(57,181,74,0.25)',
                        color:'#fff',padding:'2px 10px',borderRadius:20,fontSize:10,fontWeight:700,letterSpacing:'.05em'}}>
            {user?.role?.toUpperCase()}
          </span>
        </div>

        {/* Nav links */}
        <nav style={{flex:1,padding:'1rem .75rem',display:'flex',flexDirection:'column',gap:4}}>
          {nav.map(item=>(
            <NavLink key={item.to} to={item.to} style={({isActive})=>({
              display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:8,
              fontSize:13,fontWeight:isActive?700:400,
              color:isActive?'#fff':'rgba(255,255,255,0.5)',
              background:isActive?'linear-gradient(135deg,rgba(227,6,19,0.4),rgba(247,148,29,0.3))':'transparent',
              textDecoration:'none',transition:'all .15s',
              borderLeft:isActive?'3px solid #F7941D':'3px solid transparent'
            })}>
              <span>{item.icon}</span>{item.label}
            </NavLink>
          ))}
        </nav>

        {/* TT Color bar bottom */}
        <div style={{height:4,background:'linear-gradient(90deg,#E30613,#F7941D,#FFD700,#39B54A,#0072BC,#662D91)'}}/>

        {/* Logout */}
        <div style={{padding:'1rem .75rem',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
          <button onClick={()=>{signOut();navigate('/login');}} style={{
            width:'100%',background:'rgba(227,6,19,0.15)',color:'rgba(255,100,100,0.9)',
            border:'1px solid rgba(227,6,19,0.25)',borderRadius:8,
            padding:'9px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            🚪 Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{flex:1,marginLeft:220,minHeight:'100vh',background:'#f0f4ff'}}>
        {/* Top bar */}
        <div style={{
          padding:'0.85rem 1.5rem',background:'#fff',
          borderBottom:'1px solid #e0e7ff',
          display:'flex',justifyContent:'space-between',alignItems:'center',
          position:'sticky',top:0,zIndex:40,
          boxShadow:'0 1px 4px rgba(0,114,188,0.08)'
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img src="/logo-tt.jpg" alt="TT" style={{height:24,objectFit:'contain'}}/>
            <div style={{width:1,height:20,background:'#e0e7ff',margin:'0 4px'}}/>
            <span style={{fontSize:14,fontWeight:700,fontFamily:'Syne,sans-serif',color:'#1e293b'}}>
              {user?.role==='admin'?'Administration':'Espace Technicien'}
            </span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#39B54A',
                         boxShadow:'0 0 0 2px rgba(57,181,74,0.25)'}}/>
            <span style={{fontSize:12,color:'#64748b',fontWeight:500}}>Système actif</span>
          </div>
        </div>
        <Routes>
          <Route path="/dashboard" element={<AdminDashboard/>}/>
          <Route path="/espace"    element={<TechnicienPage/>}/>
          <Route path="*" element={<Navigate to={user?.role==='admin'?'/dashboard':'/espace'} replace/>}/>
        </Routes>
      </main>
    </div>
  );
}

function AppRoutes(){
  const {user}=useAuth();
  return(
    <Routes>
      <Route path="/login" element={user?<Navigate to="/" replace/>:<Login/>}/>
      <Route path="/*"     element={user?<Layout/>:<Navigate to="/login" replace/>}/>
    </Routes>
  );
}

export default function App(){
  return(
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes/>
      </AuthProvider>
    </BrowserRouter>
  );
}

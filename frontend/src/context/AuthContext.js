import React,{createContext,useContext,useState} from 'react';
const Ctx=createContext(null);
export function AuthProvider({children}){
  const [user,setUser]=useState(()=>{const s=localStorage.getItem('tt_wf_user');return s?JSON.parse(s):null});
  const signIn=u=>{setUser(u);localStorage.setItem('tt_wf_user',JSON.stringify(u))};
  const signOut=()=>{setUser(null);localStorage.removeItem('tt_wf_user')};
  return <Ctx.Provider value={{user,signIn,signOut}}>{children}</Ctx.Provider>;
}
export const useAuth=()=>useContext(Ctx);

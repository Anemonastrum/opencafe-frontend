import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import { client } from '../api/client';
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({children}) {
 const session=useSyncExternalStore(client.subscribe,client.getSession);
 useEffect(()=>{ if(client.getSession().status==='loading') client.restore(); },[]);
 return <AuthContext.Provider value={{...session,loading:session.status==='loading',login:client.login,logout:client.logout,retrySession:client.restore,changePassword:client.changePassword,updateUser:client.updateUser}}>{children}</AuthContext.Provider>;
}

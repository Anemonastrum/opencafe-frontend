import {useEffect,useState,useCallback} from 'react';
import {useAuth} from '../context/AuthContext';
export function useResource(load,deps=[]){
 const {generation}=useAuth(),[revision,setRevision]=useState(0),[state,setState]=useState({data:null,loading:true,error:null,key:null});
 const key=JSON.stringify([generation,revision,...deps]);
 useEffect(()=>{const controller=new AbortController();setState({data:null,loading:true,error:null,key});Promise.resolve().then(()=>load(controller.signal)).then(data=>{if(!controller.signal.aborted)setState({data,loading:false,error:null,key});}).catch(error=>{if(!controller.signal.aborted&&error.code!=='SESSION_CHANGED')setState({data:null,loading:false,error,key});});return()=>controller.abort();},[key]);
 return {...(state.key===key?state:{data:null,loading:true,error:null}),reload:useCallback(()=>setRevision(n=>n+1),[])};
}

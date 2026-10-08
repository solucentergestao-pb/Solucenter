"use client";
import {useEffect,useState} from 'react';
import {api} from '../../lib/api';
function destination(){const next=new URLSearchParams(window.location.search).get('next');return next?.startsWith('/')&&!next.startsWith('//')&&!next.includes('\\')?next:'/'}
export default function Login(){
 const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[error,setError]=useState('');const[busy,setBusy]=useState(false);
 useEffect(()=>{if(localStorage.getItem('token'))location.href=destination()},[]);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setBusy(true);try{const r:any=await api('/auth/login',{method:'POST',body:JSON.stringify({email,password})});localStorage.setItem('token',r.accessToken);location.href=destination()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 return <main className="shell"><div className="card" style={{maxWidth:420,margin:'60px auto'}}><div className="brand">SOLUCENTER<small>CLIMATIZAÇÃO & ELÉTRICA</small></div><h1>Acessar gestão</h1><form className="form" onSubmit={submit}><label>E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Senha<input type="password" autoComplete="current-password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p className="error">{error}</p>}<button className="btn primary" disabled={busy}>{busy?'Entrando…':'Entrar'}</button></form></div></main>
}
const BASE=(process.env.NEXT_PUBLIC_API_URL??'http://localhost:3333/api/v1').replace(/\/$/,'');
export async function api(path:string,options:RequestInit={}){
 const token=typeof window!=='undefined'?localStorage.getItem('token'):null;
 const isForm=typeof FormData!=='undefined'&&options.body instanceof FormData;
 const response=await fetch(BASE+path,{...options,headers:{...(!isForm?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{}),...(options.headers??{})}});
 const ct=response.headers.get('content-type')??'';
 const body=ct.includes('json')?await response.json().catch(()=>null):await response.blob();
 if(response.status===401&&typeof window!=='undefined'&&!path.startsWith('/auth/login')){localStorage.removeItem('token');window.location.href='/login';throw new Error('Sessão expirada.');}
 if(!response.ok)throw new Error((body as any)?.error?.message??'Erro na API');
 return body;
}
export const API_BASE=BASE;
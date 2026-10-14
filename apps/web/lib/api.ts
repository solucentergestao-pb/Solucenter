const DIRECT_API='https://solucenter-api-04bn.onrender.com/api/v1';

function resolveApiBase(){
 const configured=(process.env.NEXT_PUBLIC_API_URL??'').trim().replace(/\/$/,'');
 if(process.env.NODE_ENV==='production') return '/backend/api/v1';
 if(!configured) return DIRECT_API;
 return configured.endsWith('/api/v1')?configured:`${configured}/api/v1`;
}

const BASE=resolveApiBase();

async function doFetch(base:string,path:string,options:RequestInit,headers:Headers){
 return fetch(base+path,{...options,headers});
}

export async function api(path:string,options:RequestInit={}){
 const token=typeof window!=='undefined'?localStorage.getItem('token'):null;
 const isForm=typeof FormData!=='undefined'&&options.body instanceof FormData;
 const headers=new Headers(options.headers);
 if(!isForm&&options.body!=null&&options.body!==''&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
 if(token&&!headers.has('Authorization'))headers.set('Authorization',`Bearer ${token}`);

 const canRetry=['GET','HEAD'].includes((options.method??'GET').toUpperCase());
 let response:Response;
 try{
  response=await doFetch(BASE,path,options,headers);
  if(canRetry&&process.env.NODE_ENV==='production'&&BASE.startsWith('/')&&[502,503,504].includes(response.status)){
   response=await doFetch(DIRECT_API,path,options,headers);
  }
 }catch{
  if(canRetry&&process.env.NODE_ENV==='production'&&BASE.startsWith('/')){
   try{response=await doFetch(DIRECT_API,path,options,headers)}
   catch{throw new Error('Falha de conexão com a API. Tente novamente em alguns segundos.')}
  }else throw new Error(canRetry?'Falha de conexão com a API. Tente novamente em alguns segundos.':'A conexão foi interrompida. Confira se a operação foi registrada antes de tentar novamente.');
 }

 const ct=response.headers.get('content-type')??'';
 let body:any=null;
 if(ct.includes('json')) body=await response.json().catch(()=>null);
 else if(response.ok&&(ct.includes('image/')||ct.includes('application/pdf')||ct.includes('application/octet-stream')))body=await response.blob();
 else body=await response.text().catch(()=>'');

 if(response.status===401&&typeof window!=='undefined'&&!path.startsWith('/auth/login')){
  localStorage.removeItem('token');
  window.location.href='/login?next='+encodeURIComponent(window.location.pathname+window.location.search);
  throw new Error('Sessão expirada.');
 }
 if(!response.ok){
  const detail=body?.error?.message??body?.message;
  throw new Error(detail??`Erro na API (${response.status})`);
 }
 return body;
}
export const API_BASE=BASE;

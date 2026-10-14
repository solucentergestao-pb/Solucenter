import Fastify from 'fastify';
import {afterEach,describe,expect,it,vi} from 'vitest';
import {api} from '../../web/lib/api';

afterEach(()=>vi.unstubAllGlobals());

describe('Browser API requests accepted by Fastify',()=>{
 it('allows document generation without a JSON body',async()=>{
  const app=Fastify();
  app.post('/documents/service-orders/test/pdf',async()=>({shareUrl:'https://example.com/report.pdf'}));
  vi.stubGlobal('fetch',async(url:string,options:RequestInit)=>{
   const response=await app.inject({method:'POST',url:new URL(url,'https://example.com').pathname.replace('/api/v1',''),headers:Object.fromEntries(new Headers(options.headers).entries()),payload:options.body as string|undefined});
   return new Response(response.body,{status:response.statusCode,headers:{'content-type':'application/json'}});
  });
  try{expect(await api('/documents/service-orders/test/pdf',{method:'POST'})).toEqual({shareUrl:'https://example.com/report.pdf'})}
  finally{await app.close()}
 });

 it('preserves JSON payloads and caller headers for invoicing',async()=>{
  const app=Fastify();
  app.post('/invoice',async request=>({body:request.body,authorization:request.headers.authorization}));
  vi.stubGlobal('fetch',async(_url:string,options:RequestInit)=>{
   const response=await app.inject({method:'POST',url:'/invoice',headers:Object.fromEntries(new Headers(options.headers).entries()),payload:options.body as string});
   return new Response(response.body,{status:response.statusCode,headers:{'content-type':'application/json'}});
  });
  try{expect(await api('/invoice',{method:'POST',body:JSON.stringify({dueDate:'2026-10-15'}),headers:new Headers({Authorization:'Bearer test'})})).toEqual({body:{dueDate:'2026-10-15'},authorization:'Bearer test'})}
  finally{await app.close()}
 });

 it('leaves multipart boundaries to the browser for photo uploads',async()=>{
  const body=new FormData();body.append('category','BEFORE');
  const fetchMock=vi.fn(async(_url:string,_options:RequestInit)=>new Response('{}',{headers:{'content-type':'application/json'}}));
  vi.stubGlobal('fetch',fetchMock);
  await api('/uploads/service-orders/test/photo',{method:'POST',body});
  const options=fetchMock.mock.calls[0][1] as RequestInit;
  expect(options.body).toBe(body);
  expect(new Headers(options.headers).has('content-type')).toBe(false);
 });
});

describe('Binary downloads and safe connection fallback',()=>{
 afterEach(()=>{vi.unstubAllEnvs();vi.resetModules()});
 it.each(['image/png','application/pdf'])('preserves bytes for %s downloads',async contentType=>{
  const bytes=new Uint8Array([0,137,80,68,70,255]);
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(bytes,{headers:{'content-type':contentType}})));
  const result=await api('/equipment/test/label');
  expect(result).toBeInstanceOf(Blob);
  expect(new Uint8Array(await result.arrayBuffer())).toEqual(bytes);
 });
 it.each(['POST','PATCH','DELETE'])('does not repeat %s after a connection failure',async method=>{
  vi.stubEnv('NODE_ENV','production');vi.resetModules();
  const {api:productionApi}=await import('../../web/lib/api');
  const fetchMock=vi.fn().mockRejectedValueOnce(new Error('response lost')).mockResolvedValue(new Response('{}'));
  vi.stubGlobal('fetch',fetchMock);
  await expect(productionApi('/service-orders',{method})).rejects.toThrow('Confira se a operação foi registrada');
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('does not repeat a mutation after a gateway timeout',async()=>{
  vi.stubEnv('NODE_ENV','production');vi.resetModules();
  const {api:productionApi}=await import('../../web/lib/api');
  const fetchMock=vi.fn().mockResolvedValue(new Response('Gateway Timeout',{status:504}));
  vi.stubGlobal('fetch',fetchMock);
  await expect(productionApi('/quotes',{method:'POST'})).rejects.toThrow('504');
  expect(fetchMock).toHaveBeenCalledTimes(1);
 });
 it('still retries read-only requests through the direct connection',async()=>{
  vi.stubEnv('NODE_ENV','production');vi.resetModules();
  const {api:productionApi}=await import('../../web/lib/api');
  const fetchMock=vi.fn().mockRejectedValueOnce(new Error('proxy unavailable')).mockResolvedValueOnce(new Response('[]',{headers:{'content-type':'application/json'}}));
  vi.stubGlobal('fetch',fetchMock);
  expect(await productionApi('/quotes')).toEqual([]);
  expect(fetchMock).toHaveBeenCalledTimes(2);
 });
});

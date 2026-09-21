import type {FastifyReply,FastifyRequest} from 'fastify';
import type {AuthUser} from './auth.js';
export const ROLE_PERMISSIONS:Record<string,string[]>= {
 ADMIN:['*'],
 GESTOR:['customer.*','unit.*','environment.*','equipment.*','service_order.*','material.read','quote.*','schedule.*','maintenance.*','document.*','notification.read','dashboard.read'],
 TECNICO:['customer.read','equipment.read','service_order.read','service_order.update','service_order.measurement.create','service_order.material.create','service_order.photo.create','service_order.complete','schedule.read','maintenance.read','document.read'],
 FINANCEIRO:['customer.read','quote.read','finance.*','profit.read','dashboard.read','document.read']
};
function matches(granted:string,wanted:string){return granted==='*'||granted===wanted||(granted.endsWith('.*')&&wanted.startsWith(granted.slice(0,-1)));}
export function can(u:AuthUser,wanted:string){return u.role==='ADMIN'||(u.permissions??[]).some(p=>matches(p,wanted))||(ROLE_PERMISSIONS[u.role]??[]).some(p=>matches(p,wanted));}
export function permit(wanted:string){return async(req:FastifyRequest,reply:FastifyReply)=>{await req.jwtVerify();const u=req.user as AuthUser;if(!can(u,wanted))return reply.code(403).send({error:{code:'FORBIDDEN',message:'Acesso não autorizado.'}});};}
export function secureHeaders(_req:FastifyRequest,reply:FastifyReply,done:()=>void){reply.header('X-Content-Type-Options','nosniff').header('X-Frame-Options','DENY').header('Referrer-Policy','no-referrer').header('Permissions-Policy','camera=(), microphone=(), geolocation=()').header('Cache-Control','no-store');done();}

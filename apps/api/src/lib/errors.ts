import { FastifyReply } from 'fastify';
export function fail(reply:FastifyReply,status:number,code:string,message:string,details?:unknown){return reply.code(status).send({error:{code,message,...(details?{details}:{})}})}

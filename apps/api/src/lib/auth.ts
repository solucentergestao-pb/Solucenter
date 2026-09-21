import { FastifyRequest } from 'fastify';
export type AuthUser={id:string;companyId:string;role:string;permissions:string[]};
export async function requireAuth(req:FastifyRequest){ await req.jwtVerify(); return req.user as AuthUser; }

// Compatibilidade com os módulos operacionais: todos usam o mesmo verificador JWT.
export const authenticate = requireAuth;

import type { FastifyReply, FastifyRequest } from 'fastify';
import type { AuthUser } from './auth.js';
import { can } from './security.js';

// Portal and staff tokens share a signer, but are not interchangeable.
export function isStaffPrincipal(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const u = value as Record<string, unknown>;
  return u.kind !== 'customer' && typeof u.id === 'string' && u.id.length > 0
    && typeof u.companyId === 'string' && u.companyId.length > 0
    && typeof u.role === 'string' && u.role.length > 0
    && Array.isArray(u.permissions) && u.permissions.every(p => typeof p === 'string');
}

export async function internalAccess(req: FastifyRequest, reply: FastifyReply) {
  const route = req.routeOptions.url ?? '';
  if (req.method === 'OPTIONS' || !route.startsWith('/api/v1/')
    || route.startsWith('/api/v1/portal/') || route === '/api/v1/auth/login') return;
  try { await req.jwtVerify(); } catch {
    return reply.code(401).send({error:{code:'UNAUTHORIZED',message:'Autenticação necessária.'}});
  }
  if (!isStaffPrincipal(req.user)) {
    return reply.code(403).send({error:{code:'STAFF_ACCESS_REQUIRED',message:'Acesso interno não autorizado.'}});
  }
  // First containment: financial APIs must enforce role permissions.
  if (route.startsWith('/api/v1/finance/') || route.startsWith('/api/v1/management-finance/')) {
    const permission = req.method === 'GET' ? 'finance.read' : 'finance.write';
    if (!can(req.user, permission)) {
      return reply.code(403).send({error:{code:'FORBIDDEN',message:'Acesso não autorizado.'}});
    }
  }
}

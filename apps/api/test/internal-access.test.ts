import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { describe, it, expect } from 'vitest';
import { internalAccess } from '../src/lib/internal-access.js';

async function request(payload: object | null, url = '/api/v1/finance/receivables') {
  const app = Fastify();
  app.register(jwt, {secret:'isolated-test-only-not-a-production-secret'});
  app.addHook('onRequest', internalAccess);
  app.get('/api/v1/finance/receivables', async () => ({ok:true}));
  app.get('/api/v1/customers/', async () => ({ok:true}));
  app.get('/api/v1/portal/me', async () => ({publicForThisIsolatedTest:true}));
  await app.ready();
  try {
    return await app.inject({url, headers: payload ? {authorization:`Bearer ${app.jwt.sign(payload)}`} : {}});
  } finally { await app.close(); }
}

const staff = (role:string) => ({id:'staff',companyId:'company',role,permissions:[]});
describe('internal API boundary (real HTTP hooks)', () => {
  it('rejects unauthenticated financial requests', async () => expect((await request(null)).statusCode).toBe(401));
  it('rejects portal tokens in staff routes', async () => expect((await request({kind:'customer',portalUserId:'portal',companyId:'company',customerId:'customer'}, '/api/v1/customers/')).statusCode).toBe(403));
  it('rejects technicians in financial routes', async () => expect((await request(staff('TECNICO'))).statusCode).toBe(403));
  it('allows financial staff', async () => expect((await request(staff('FINANCEIRO'))).statusCode).toBe(200));
  it('allows administrators', async () => expect((await request(staff('ADMIN'))).statusCode).toBe(200));
});

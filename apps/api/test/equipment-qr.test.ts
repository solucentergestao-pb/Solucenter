import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
const db = vi.hoisted(() => ({equipment: {findFirst: vi.fn()}}));
vi.mock('../src/lib/prisma.js', () => ({prisma: db}));
import {equipmentRoutes} from '../src/routes/equipment.js';
import {api} from '../../web/lib/api';
import {equipmentLabel} from '../src/lib/equipment-label.js';
beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllGlobals());
async function get(url: string, authenticated = true) {
  const app = Fastify();
  app.register(jwt, {secret: 'equipment-test-secret'});
  app.register(equipmentRoutes);
  await app.ready();
  try {
    return await app.inject({url, headers: authenticated ? {authorization: 'Bearer ' + app.jwt.sign({id: 'staff', companyId: 'company', role: 'ADMIN', permissions: []})} : {}});
  } finally {await app.close();}
}
it('resolves QR only within the authenticated company', async () => {
  db.equipment.findFirst.mockResolvedValue({assetCode: 'SC-EQP-000001'});
  const response = await get('/by-qr/token');
  expect(response.statusCode).toBe(200);
  expect(db.equipment.findFirst).toHaveBeenCalledWith({where: {companyId: 'company', qr: {token: 'token'}}, include: {customer: true, unit: true, environment: true}});
});
it('returns 404 for unknown or foreign QR', async () => {
  db.equipment.findFirst.mockResolvedValue(null);
  expect((await get('/by-qr/foreign')).statusCode).toBe(404);
});
it('requires authentication before QR lookup', async () => {
  expect((await get('/by-qr/token', false)).statusCode).toBe(401);
  expect(db.equipment.findFirst).not.toHaveBeenCalled();
});
it('does not generate a label for equipment outside the company', async () => {
  db.equipment.findFirst.mockResolvedValue(null);
  expect((await get('/foreign/label')).statusCode).toBe(404);
  expect(db.equipment.findFirst).toHaveBeenCalledWith({where: {id: 'foreign', companyId: 'company'}, include: {qr: true}});
});
it('creates a one-page PDF with a 60 by 40 mm media box', async () => {
  const pdf = (await equipmentLabel('SC-EQP-000001', 'token')).toString('latin1');
  expect(pdf.startsWith('%PDF-')).toBe(true);
  expect(pdf).toMatch(/\/MediaBox \[0 0 170\.07874\d* 113\.38582\d*\]/);
  expect(pdf).toMatch(/\/Count 1\b/);
});

it.each(['/test/qr', '/test/label'])('denies unauthenticated download of %s', async url => {
  expect((await get(url, false)).statusCode).toBe(401);
  expect(db.equipment.findFirst).not.toHaveBeenCalled();
});
it.each([
  {route: 'qr', contentType: 'image/png', filename: 'SC-EQP-000001.png'},
  {route: 'label', contentType: 'application/pdf', filename: 'SC-EQP-000001-60x40mm.pdf'},
])('downloads $route through the browser API helper without corrupting bytes', async ({route, contentType, filename}) => {
  db.equipment.findFirst.mockResolvedValue({assetCode: 'SC-EQP-000001', qr: {token: 'test-token'}});
  vi.stubGlobal('fetch', async (url: string) => {
    const path = new URL(url, 'https://example.com').pathname.replace('/api/v1/equipment', '');
    const response = await get(path);
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain(contentType);
    expect(response.headers['content-disposition']).toContain(filename);
    return new Response(new Uint8Array(response.rawPayload), {status: response.statusCode, headers: {'content-type': String(response.headers['content-type'])}});
  });
  const blob = await api(`/equipment/test/${route}`);
  expect(blob).toBeInstanceOf(Blob);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  expect(bytes.length).toBeGreaterThan(100);
  if (route === 'qr') {
    expect(Array.from(bytes.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(16)).toBe(640);
    expect(view.getUint32(20)).toBe(640);
  } else {
    const pdf = new TextDecoder('latin1').decode(bytes);
    expect(pdf.startsWith('%PDF-')).toBe(true);
    expect(pdf).toMatch(/\/MediaBox \[0 0 170\.07874\d* 113\.38582\d*\]/);
    expect(pdf).toMatch(/\/Count 1\b/);
    expect(pdf.trimEnd().endsWith('%%EOF')).toBe(true);
  }
});

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { AuthUser } from '../lib/auth.js';
import { fail } from '../lib/errors.js';
import { audit } from '../lib/audit.js';
import { photoDownloadUrl } from '../lib/privateStorage.js';

const schema = z.object({
  customerId: z.string().uuid(),
  unitId: z.string().uuid(),
  environmentId: z.string().uuid().optional().nullable(),
  modelId: z.string().uuid().optional().nullable(),
  equipmentType: z.string().min(2),
  capacityBtu: z.number().int().positive().optional(),
  technology: z.string().optional(),
  cycle: z.string().optional(),
  voltage: z.number().int().positive().optional(),
  phase: z.string().optional(),
  refrigerant: z.string().optional(),
  serialNumber: z.string().optional(),
  installationDate: z.coerce.date().optional(),
  warrantyUntil: z.coerce.date().optional(),
  notes: z.string().optional(),
  installation: z.object({
    liquidPipe: z.string().optional(),
    gasPipe: z.string().optional(),
    pipeLengthM: z.number().nonnegative().optional(),
    heightDifferenceM: z.number().nonnegative().optional(),
    powerCable: z.string().optional(),
    breakerRating: z.string().optional(),
    drainType: z.string().optional(),
    vacuumMicrons: z.number().int().nonnegative().optional(),
    tightnessTest: z.boolean().optional(),
    additionalRefrigerantG: z.number().int().nonnegative().optional(),
  }).optional(),
});

function publicEquipmentUrl(token: string) {
  const base = (process.env.PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/q/${token}`;
}

async function makeLabelPdf(equipment: {
  assetCode: string;
  equipmentType: string;
  capacityBtu?: number | null;
  qr: { token: string };
}) {
  const qr = await QRCode.toBuffer(publicEquipmentUrl(equipment.qr.token), {
    width: 900,
    margin: 1,
    errorCorrectionLevel: 'M',
  });

  return await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: [170.08, 113.39], // 60 x 40 mm
      margins: { top: 6, left: 6, right: 6, bottom: 6 },
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.image(qr, 8, 10, { fit: [72, 72] });
    doc.fontSize(10).fillColor('#111827').text('SOLUCENTER', 86, 10, { width: 76 });
    doc.fontSize(5.5).fillColor('#4b5563').text('Climatização & Elétrica', 86, 24, { width: 76 });
    doc.fillColor('#111827').fontSize(8.5).text(equipment.assetCode, 86, 40, { width: 76 });
    doc.fontSize(6.5).text(
      `${equipment.equipmentType}${equipment.capacityBtu ? ` · ${equipment.capacityBtu} BTU/h` : ''}`,
      86,
      55,
      { width: 76 }
    );
    doc.fontSize(5.5).fillColor('#374151').text(
      'Escaneie para abrir a ficha do equipamento.',
      86,
      71,
      { width: 76, lineGap: 1 }
    );
    doc.fontSize(5).fillColor('#6b7280').text(
      'Etiqueta 60 x 40 mm · QR exclusivo',
      8,
      99,
      { width: 154, align: 'center' }
    );

    doc.end();
  });
}

export async function equipmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (r) => r.jwtVerify());

  app.get('/', async (req) => {
    const u = req.user as AuthUser;
    const rows = await prisma.equipment.findMany({
      where: { companyId: u.companyId },
      include: {
        customer: true,
        unit: true,
        environment: true,
        model: { include: { manufacturer: true } },
        photos: true,
        qr: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((e) => ({
      ...e,
      photos: e.photos.map(({ fileUrl: _, ...p }) => ({
        ...p,
        downloadUrl: photoDownloadUrl('equipment', p.id),
      })),
    }));
  });

  app.post('/', async (req, reply) => {
    const u = req.user as AuthUser;
    const p = schema.safeParse(req.body);
    if (!p.success) {
      return fail(reply, 422, 'VALIDATION_ERROR', 'Equipamento inválido.', p.error.flatten());
    }

    const unit = await prisma.customerUnit.findFirst({
      where: {
        id: p.data.unitId,
        customerId: p.data.customerId,
        customer: { companyId: u.companyId },
      },
    });
    if (!unit) return fail(reply, 422, 'INVALID_RELATION', 'Unidade não pertence ao cliente.');

    if (p.data.environmentId) {
      const env = await prisma.environment.findFirst({
        where: { id: p.data.environmentId, unitId: p.data.unitId },
      });
      if (!env) return fail(reply, 422, 'INVALID_RELATION', 'Ambiente não pertence à unidade.');
    }

    const count = await prisma.equipment.count({ where: { companyId: u.companyId } });
    const { installation, ...data } = p.data;
    const equipment = await prisma.equipment.create({
      data: {
        ...data,
        companyId: u.companyId,
        assetCode: `SC-EQP-${String(count + 1).padStart(6, '0')}`,
        qr: { create: { token: crypto.randomBytes(24).toString('hex') } },
        ...(installation ? { installation: { create: installation } } : {}),
      },
      include: { qr: true, installation: true },
    });

    await audit(req, 'CREATE', 'Equipment', equipment.id, { assetCode: equipment.assetCode });
    return reply.code(201).send(equipment);
  });

  app.get('/:id/qr', async (req, reply) => {
    const u = req.user as AuthUser;
    const { id } = req.params as any;
    const eq = await prisma.equipment.findFirst({
      where: { id, companyId: u.companyId },
      include: { qr: true },
    });
    if (!eq?.qr) return fail(reply, 404, 'QR_NOT_FOUND', 'QR Code não encontrado.');

    const png = await QRCode.toBuffer(publicEquipmentUrl(eq.qr.token), {
      width: 900,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    return reply
      .type('image/png')
      .header('Content-Disposition', `attachment; filename="${eq.assetCode}-qr.png"`)
      .send(png);
  });

  app.get('/:id/label.pdf', async (req, reply) => {
    const u = req.user as AuthUser;
    const { id } = req.params as any;
    const eq = await prisma.equipment.findFirst({
      where: { id, companyId: u.companyId },
      include: { qr: true },
    });
    if (!eq?.qr) return fail(reply, 404, 'QR_NOT_FOUND', 'QR Code não encontrado.');

    const pdf = await makeLabelPdf({
      assetCode: eq.assetCode,
      equipmentType: eq.equipmentType,
      capacityBtu: eq.capacityBtu,
      qr: eq.qr,
    });

    return reply
      .type('application/pdf')
      .header('Content-Disposition', `attachment; filename="${eq.assetCode}-etiqueta.pdf"`)
      .send(pdf);
  });
}

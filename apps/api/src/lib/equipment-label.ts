import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export function equipmentQrUrl(token: string) {
  const base = (process.env.PUBLIC_APP_URL ?? 'https://solucenter-web.onrender.com').replace(/\/$/, '');
  return `${base}/q/${encodeURIComponent(token)}`;
}

export async function equipmentLabel(assetCode: string, token: string): Promise<Buffer> {
  const mm = 72 / 25.4;
  const png = await QRCode.toBuffer(equipmentQrUrl(token), {width: 640, margin: 2});
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({size: [60 * mm, 40 * mm], margin: 0});
    const chunks: Buffer[] = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.font('Helvetica-Bold').fontSize(9).text('SOLUCENTER', 0, 3 * mm, {width: 60 * mm, align: 'center'});
    doc.image(png, 19 * mm, 8 * mm, {width: 22 * mm, height: 22 * mm});
    doc.fontSize(8).text(assetCode, 2 * mm, 32 * mm, {width: 56 * mm, align: 'center'});
    doc.end();
  });
}

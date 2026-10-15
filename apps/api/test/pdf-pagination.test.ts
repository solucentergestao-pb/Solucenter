import {beforeEach,describe,expect,it,vi} from 'vitest';
const storage=vi.hoisted(()=>({savePrivateDocument:vi.fn(),privateImagePath:vi.fn()}));
vi.mock('../src/lib/privateStorage.js',()=>storage);
import {createBusinessPdf} from '../src/lib/pdf.js';
beforeEach(()=>{vi.resetAllMocks();storage.savePrivateDocument.mockResolvedValue('private://test/document.pdf')});
describe('PDF report pagination',()=>{
 it('keeps a short report, footer and page number on one A4 page',async()=>{
  await createBusinessPdf({companyId:'company',company:'Solucenter',title:'Relatório técnico',number:'TESTE',customer:'Cliente fictício',lines:[],sections:[{title:'Serviço executado',body:'Limpeza e verificação de funcionamento.'}]});
  const pdf:Buffer=storage.savePrivateDocument.mock.calls[0][1];
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(1);
 });
 it('does not add footer-only pages to reports that span multiple pages',async()=>{
  await createBusinessPdf({companyId:'company',company:'Solucenter',title:'Relatório técnico',number:'TESTE',customer:'Cliente fictício',lines:[],sections:[{title:'Serviços',body:Array(80).fill('Verificação de funcionamento.').join('\n')}]});
  const pdf:Buffer=storage.savePrivateDocument.mock.calls[0][1];
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(2);
 });
});

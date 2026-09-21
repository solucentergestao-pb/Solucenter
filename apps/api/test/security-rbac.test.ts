import {describe,it,expect} from 'vitest';
import {can} from '../src/lib/security.js';
const u=(role:string,permissions:string[]=[])=>({id:'u',companyId:'c',role,permissions});
describe('RBAC',()=>{
 it('admin acessa tudo',()=>expect(can(u('ADMIN'),'profit.read')).toBe(true));
 it('técnico não acessa lucro/financeiro',()=>{expect(can(u('TECNICO'),'profit.read')).toBe(false);expect(can(u('TECNICO'),'finance.read')).toBe(false)});
 it('financeiro acessa financeiro mas não gestão de usuário',()=>{expect(can(u('FINANCEIRO'),'finance.read')).toBe(true);expect(can(u('FINANCEIRO'),'user.manage')).toBe(false)});
 it('permissão granular complementa papel',()=>expect(can(u('TECNICO',['profit.read']),'profit.read')).toBe(true));
});

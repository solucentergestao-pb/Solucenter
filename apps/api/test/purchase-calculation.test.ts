import {describe,it,expect} from 'vitest';
describe('Compras e estoque',()=>{it('calcula total de compra por quantidade x custo',()=>{const items=[{quantity:2,unitCost:15.5},{quantity:3,unitCost:10}];expect(items.reduce((a,i)=>a+i.quantity*i.unitCost,0)).toBe(61)})});

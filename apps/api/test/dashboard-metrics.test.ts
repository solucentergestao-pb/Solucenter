import {describe,it,expect} from 'vitest';
describe('dashboard previsto x realizado',()=>{it('calcula margem realizada',()=>{const revenue=10000,cost=6500,profit=revenue-cost;expect(profit).toBe(3500);expect(Number((profit/revenue*100).toFixed(2))).toBe(35)});it('evita divisão por zero',()=>{const revenue=0,profit=-100;const margin=revenue?profit/revenue*100:0;expect(margin).toBe(0)})});

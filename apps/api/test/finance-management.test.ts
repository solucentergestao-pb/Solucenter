import {describe,it,expect} from 'vitest';
function dre(revenue:number,direct:number,expenses:number){return {gross:revenue-direct,result:revenue-direct-expenses,margin:revenue?Number(((revenue-direct-expenses)/revenue*100).toFixed(2)):0}}
describe('DRE gerencial',()=>{it('calcula resultado operacional',()=>{expect(dre(10000,4200,1800)).toEqual({gross:5800,result:4000,margin:40})});it('evita divisão por zero',()=>expect(dre(0,0,0).margin).toBe(0))});

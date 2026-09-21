import {describe,it,expect} from 'vitest';
function overlaps(a1:Date,a2:Date,b1:Date,b2:Date){return a1<b2&&a2>b1}
describe('agenda operacional',()=>{it('detecta conflito de horários',()=>{expect(overlaps(new Date('2026-09-15T08:00'),new Date('2026-09-15T10:00'),new Date('2026-09-15T09:30'),new Date('2026-09-15T11:00'))).toBe(true)});it('aceita horários consecutivos',()=>{expect(overlaps(new Date('2026-09-15T08:00'),new Date('2026-09-15T10:00'),new Date('2026-09-15T10:00'),new Date('2026-09-15T11:00'))).toBe(false)})})

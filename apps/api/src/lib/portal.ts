import bcrypt from 'bcryptjs';
export type PortalToken={portalUserId:string;companyId:string;customerId:string;kind:'customer'};
export function portalScope(customerId:string){return {customerId};}
export function assertPortalOwnership(expected:string,actual:string){if(expected!==actual)throw new Error('PORTAL_SCOPE_VIOLATION');}
export async function hashPortalPassword(password:string){return bcrypt.hash(password,12)}
export async function verifyPortalPassword(password:string,hash:string){return bcrypt.compare(password,hash)}
export function publicQuote(q:any){const {estimatedCost,estimatedProfit,estimatedMargin,...safe}=q;return safe;}
export function publicOrder(o:any){const {laborCost,travelCost,feesCost,otherCost,materials,...safe}=o;return safe;}

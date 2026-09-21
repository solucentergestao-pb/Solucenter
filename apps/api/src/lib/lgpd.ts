export const maskDocument=(v?:string|null)=>!v?null:v.replace(/\D/g,'').replace(/^(\d{3}).*(\d{2})$/,'$1******$2');
export const maskEmail=(v?:string|null)=>{if(!v)return null;const [a,d]=v.split('@');return `${a.slice(0,2)}***@${d??''}`};
export const LGPD_RETENTION={auditDays:1825,notificationDays:730,publicDocumentDays:30};

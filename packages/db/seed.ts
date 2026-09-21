import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma=new PrismaClient();
const permissionCodes=[
'customer.read','customer.create','customer.update','unit.create','environment.create',
'equipment.read','equipment.create','equipment.update','equipment.photo.create','equipment.qr.read',
'service_order.read','service_order.create','service_order.update','service_order.measurement.create','service_order.material.create','service_order.photo.create','service_order.complete',
'material.read','material.create','inventory.adjust','profit.read','finance.read','finance.create','quote.read','quote.create','quote.approve','user.manage','settings.manage','audit.read'
];
async function main(){
 const company=await prisma.company.upsert({where:{cnpj:'00000000000100'},update:{},create:{tradeName:'SoluCenter Climatização & Elétrica',legalName:'SoluCenter Climatização e Elétrica Ltda',cnpj:'00000000000100',timezone:'America/Fortaleza'}});
 for(const code of permissionCodes) await prisma.permission.upsert({where:{code},update:{},create:{code,description:code}});
 const roles:any={ADMIN:permissionCodes,TECNICO:['customer.read','equipment.read','service_order.read','service_order.measurement.create','service_order.material.create','service_order.photo.create','service_order.complete','material.read'],FINANCEIRO:['customer.read','service_order.read','quote.read','finance.read','finance.create','profit.read'],GESTOR:permissionCodes.filter(x=>!['user.manage','settings.manage'].includes(x))};
 for(const [name,codes] of Object.entries(roles)){
  const role=await prisma.role.upsert({where:{companyId_name:{companyId:company.id,name}},update:{},create:{companyId:company.id,name,description:`Perfil ${name}`}});
  for(const code of codes as string[]){const perm=await prisma.permission.findUniqueOrThrow({where:{code}});await prisma.rolePermission.upsert({where:{roleId_permissionId:{roleId:role.id,permissionId:perm.id}},update:{},create:{roleId:role.id,permissionId:perm.id}})}
 }
 const adminRole=await prisma.role.findUniqueOrThrow({where:{companyId_name:{companyId:company.id,name:'ADMIN'}}});
 const email=process.env.SEED_ADMIN_EMAIL;
 const password=process.env.SEED_ADMIN_PASSWORD;
 if(process.env.NODE_ENV==='production'&&(!email||!password||password.length<12)) throw new Error('Credenciais seguras do administrador são obrigatórias em produção');
 const adminEmail=email??'admin@solucenter.local';
 const adminPassword=password??'TroqueEstaSenha123!';
 await prisma.user.upsert({where:{companyId_email:{companyId:company.id,email:adminEmail}},update:{roleId:adminRole.id,status:'ACTIVE'},create:{companyId:company.id,roleId:adminRole.id,name:'Administrador SoluCenter',email:adminEmail,passwordHash:await bcrypt.hash(adminPassword,12)}});
 console.log(`Seed concluído. Admin: ${adminEmail}.`)
}
main().finally(()=>prisma.$disconnect());
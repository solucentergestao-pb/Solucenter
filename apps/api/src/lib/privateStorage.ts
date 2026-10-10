import crypto from 'node:crypto';
import path from 'node:path';
import {mkdir,readFile,unlink,writeFile} from 'node:fs/promises';

const keyPattern=/^private:\/\/([0-9a-f-]{36})\/(equipment|service-orders)\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/i;
const documentKeyPattern=/^private:\/\/([0-9a-f-]{36})\/documents\/([0-9a-f-]{36}\.pdf)$/i;

function root(){
 const configured=process.env.PRIVATE_UPLOAD_ROOT?.trim();
 if(process.env.NODE_ENV==='production'&&!configured)throw new Error('PRIVATE_UPLOAD_ROOT_REQUIRED');
 return path.resolve(configured||'private-uploads');
}
export const privateStorageReady=()=>process.env.NODE_ENV!=='production'||Boolean(process.env.PRIVATE_UPLOAD_ROOT?.trim());

export function privateImagePath(key:string){
 const parsed=key.match(keyPattern);
 if(!parsed)return null;
 const [,companyId,scope,name]=parsed;
 return path.join(root(),companyId,scope,name);
}

export function privateDocumentPath(key:string){
 const parsed=key.match(documentKeyPattern);
 if(!parsed)return null;
 return path.join(root(),parsed[1],'documents',parsed[2]);
}

export function imageExtension(mimetype:string,content:Buffer){
 if(mimetype==='image/jpeg'&&content.length>=3&&content[0]===0xff&&content[1]===0xd8&&content[2]===0xff)return '.jpg';
 if(mimetype==='image/png'&&content.length>=8&&content.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return '.png';
 if(mimetype==='image/webp'&&content.length>=12&&content.subarray(0,4).toString()==='RIFF'&&content.subarray(8,12).toString()==='WEBP')return '.webp';
 return null;
}

export async function savePrivateImage(companyId:string,scope:'equipment'|'service-orders',extension:string,content:Buffer){
 const name=`${crypto.randomUUID()}${extension}`;
 const dir=path.join(root(),companyId,scope);
 await mkdir(dir,{recursive:true,mode:0o700});
 await writeFile(path.join(dir,name),content,{mode:0o600});
 return `private://${companyId}/${scope}/${name}`;
}

export async function readPrivateImage(key:string,companyId:string){
 const parsed=key.match(keyPattern);
 if(!parsed||parsed[1]!==companyId)return null;
 const filePath=privateImagePath(key);
 if(!filePath)return null;
 const name=parsed[3];
 const file=await readFile(filePath);
 const type=name.endsWith('.png')?'image/png':name.endsWith('.webp')?'image/webp':'image/jpeg';
 return {file,type};
}

export async function deletePrivateImage(key:string){const filePath=privateImagePath(key);if(filePath)await unlink(filePath).catch(()=>{});}
export async function savePrivateDocument(companyId:string,content:Buffer){
 const name=`${crypto.randomUUID()}.pdf`,dir=path.join(root(),companyId,'documents');
 await mkdir(dir,{recursive:true,mode:0o700});
 await writeFile(path.join(dir,name),content,{mode:0o600});
 return `private://${companyId}/documents/${name}`;
}
export async function readPrivateDocument(key:string,companyId:string){
 const parsed=key.match(documentKeyPattern);
 if(!parsed||parsed[1]!==companyId)return null;
 const filePath=privateDocumentPath(key);
 return filePath?readFile(filePath):null;
}
export async function deletePrivateDocument(key:string){const filePath=privateDocumentPath(key);if(filePath)await unlink(filePath).catch(()=>{});}
export const photoDownloadUrl=(kind:'equipment'|'service-order',id:string)=>`/api/v1/uploads/${kind}-photos/${id}`;

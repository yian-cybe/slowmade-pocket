import { emptyNotebook, isImage, validateNotebook, type Notebook } from './notebook.ts';
export type SavedNotebook = {data:Notebook;revision:number;updated?:string};
export type Draft = {fields:Record<string,string>;photos:string[]};
export type Backup = {format:'slowmade-v1';exportedAt:string;data:Notebook;photos:Record<string,string>};
const databaseName='slowmade-pocket-v1';
let database:Promise<IDBDatabase>|null=null;
function storageError(error:unknown): Error {
 if(error instanceof Error && error.name==='QuotaExceededError')return Error('手机可用空间不足，这次没有保存成功。请先导出备份，再整理手机空间。');
 return error instanceof Error?error:Error('手机暂时无法保存，请确认没有使用无痕浏览模式。');
}
function openDatabase():Promise<IDBDatabase>{
 if(database)return database;
 database=new Promise((resolve,reject)=>{
  if(!globalThis.indexedDB){reject(Error('这个浏览器不支持保存记录，请用 Safari 或 Chrome 打开。'));return;}
  const request=indexedDB.open(databaseName,1);
  request.onupgradeneeded=()=>{for(const name of ['meta','photos','drafts'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};
  request.onerror=()=>{database=null;reject(storageError(request.error));};
  request.onblocked=()=>{database=null;reject(Error('请先关闭其他旧版手作本页面，再重新打开。'));};
  request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();database=null;};resolve(db);};
 });return database;
}
async function read<T>(store:string,key:string):Promise<T|null>{
 const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly');const req=tx.objectStore(store).get(key);req.onsuccess=()=>resolve(req.result??null);req.onerror=()=>reject(storageError(req.error));});
}
async function write(store:string,key:string,value:unknown,remove=false):Promise<void>{
 const db=await openDatabase();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');const s=tx.objectStore(store);if(remove)s.delete(key);else s.put(value,key);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(storageError(tx.error));tx.onerror=()=>reject(storageError(tx.error));});
}
export async function loadNotebook():Promise<SavedNotebook>{return await read<SavedNotebook>('meta','main')??{data:emptyNotebook,revision:0};}
export async function saveNotebook(value:Notebook,expectedRevision:number):Promise<number>{
 const data=validateNotebook(value),db=await openDatabase();
 return new Promise((resolve,reject)=>{const tx=db.transaction('meta','readwrite');const store=tx.objectStore('meta');const req=store.get('main');
  req.onsuccess=()=>{const current=req.result as SavedNotebook|undefined;if((current?.revision??0)!==expectedRevision){reject(Error('另一个页面更新了手作本。请先复制未保存的文字，再重新打开记录。'));tx.abort();return;}store.put({data,revision:expectedRevision+1,updated:new Date().toISOString()},'main');};
  tx.oncomplete=()=>resolve(expectedRevision+1);tx.onabort=()=>reject(storageError(tx.error));tx.onerror=()=>reject(storageError(tx.error));
 });
}
export async function putPhoto(id:string,blob:Blob):Promise<void>{
 if(!/^[0-9a-f-]{36}$/i.test(id)||blob.size>12*1024*1024||!isImage(new Uint8Array(await blob.slice(0,16).arrayBuffer()),blob.type))throw Error('照片格式无法识别，请选择 JPG、PNG 或 WebP。');
 await write('photos',id,blob);
}
export async function getPhoto(id:string):Promise<Blob|null>{return read<Blob>('photos',id);}
export async function loadDraft(key:string):Promise<Draft|null>{return read<Draft>('drafts',key);}
export async function saveDraft(key:string,draft:Draft):Promise<void>{await write('drafts',key,draft);}
export async function clearDraft(key:string):Promise<void>{await write('drafts',key,null,true);}
export async function getLastBackup():Promise<string|null>{return read<string>('meta','last-backup');}
export async function markBackupExported():Promise<void>{await write('meta','last-backup',new Date().toISOString());}
const referencedPhotos=(data:Notebook)=>[...new Set(data.projects.flatMap(p=>p.entries.flatMap(e=>e.photos)))];
async function dataUrl(blob:Blob):Promise<string>{
 const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return 'data:'+blob.type+';base64,'+btoa(binary);
}
export async function createBackup(data:Notebook):Promise<Backup>{
 const photos:Record<string,string>={};for(const id of referencedPhotos(data)){const blob=await getPhoto(id);if(!blob)throw Error('有一张照片没有找到，备份未完成。请先检查照片记录。');photos[id]=await dataUrl(blob);}
 return {format:'slowmade-v1',exportedAt:new Date().toISOString(),data:validateNotebook(data),photos};
}
export async function restoreBackup(value:unknown,expectedRevision:number):Promise<SavedNotebook>{
 if(!value||typeof value!=='object')throw Error('这不是手作本的备份文件。');
 const backup=value as Partial<Backup>;
 if(backup.format!=='slowmade-v1'||!backup.photos||typeof backup.photos!=='object')throw Error('这不是手作本的备份文件。');
 const data=validateNotebook(backup.data);const photos=new Map<string,Blob>();
 for(const id of referencedPhotos(data)){
  const encoded=backup.photos[id];if(typeof encoded!=='string')throw Error('备份中缺少照片，原来的记录没有被修改。');
  const match=/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(encoded);
  if(!match||match[2].length>17*1024*1024)throw Error('备份里的照片损坏或过大，原来的记录没有被修改。');
  let binary:string;try{binary=atob(match[2]);}catch{throw Error('备份里的照片损坏，原来的记录没有被修改。');}
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(!isImage(bytes,match[1]))throw Error('备份里的照片格式不正确，原来的记录没有被修改。');
  photos.set(id,new Blob([bytes],{type:match[1]}));
 }
 const db=await openDatabase(),next={data,revision:expectedRevision+1,updated:new Date().toISOString()};
 return new Promise((resolve,reject)=>{const tx=db.transaction(['meta','photos','drafts'],'readwrite');const meta=tx.objectStore('meta');const req=meta.get('main');
  req.onsuccess=()=>{if((req.result?.revision??0)!==expectedRevision){reject(Error('另一个页面更新了记录，请重新打开后再恢复。'));tx.abort();return;}if(req.result)meta.put(req.result,'before-restore');for(const [id,blob]of photos)tx.objectStore('photos').put(blob,id);tx.objectStore('drafts').clear();meta.put(next,'main');};
  tx.oncomplete=()=>resolve(next);tx.onabort=()=>reject(storageError(tx.error));tx.onerror=()=>reject(storageError(tx.error));
 });
}

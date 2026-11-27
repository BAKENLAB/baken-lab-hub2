import {mkdir,readFile,open,link,unlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {validateSnapshot} from './adapter.mjs';
// Isolated file storage only. No production connector or update/delete API.
// Atomic no-replace link prevents partial visible writes and overwrites.
// OS-level append-only/independent timestamp/custody are separate real gates.
export async function saveFixtureSnapshot(dir,snapshot){
 const s=validateSnapshot(snapshot);const root=resolve(dir);
 await mkdir(root,{recursive:true,mode:0o700});
 const file=join(root,s.snapshotDigest+'.json'),temp=join(root,'.'+randomUUID()+'.tmp');
 const f=await open(temp,'wx',0o600);
 try{await f.writeFile(JSON.stringify(s));await f.sync();}finally{await f.close();}
 try{await link(temp,file);}finally{await unlink(temp);}
 return file;
}
export async function readFixtureSnapshot(file){return validateSnapshot(JSON.parse(await readFile(file,'utf8')));}

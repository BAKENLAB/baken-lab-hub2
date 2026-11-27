// Lossless archive of the Codex01 JSON snapshot. Fixture-only.
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {mkdir,readFile,open,link,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {sha,validateSnapshot,ENGINE} from './adapter.mjs';
import {summarizeRunner} from './comments-ja.mjs';
const bytes=s=>Buffer.byteLength(s),hex=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const exact=(v,k)=>assert.deepEqual(Object.keys(v).sort(),[...k].sort());
const pack=async(file,buf,allowExisting=false)=>{
 const temp=file+'.'+randomUUID()+'.tmp',f=await open(temp,'wx',0o600);
 try{await f.writeFile(buf);await f.sync();}finally{await f.close();}
 try{await link(temp,file);}catch(e){if(e.code!=='EEXIST'||!allowExisting)throw e;assert.ok((await readFile(file)).equals(buf),'CONTENT_COLLISION');}finally{await unlink(temp);}
};
export async function saveCompact(root,snapshot){
 const s=validateSnapshot(snapshot),dir=resolve(root);
 await mkdir(join(dir,'objects'),{recursive:true,mode:0o700});
 await mkdir(join(dir,'manifests'),{recursive:true,mode:0o700});
 await mkdir(join(dir,'identities'),{recursive:true,mode:0o700});
 const identity=sha([s.engineCommit,s.race.circuit,s.race.raceId,s.time.domain,s.time.cutoff,s.mode]);
 const {runners,...header}=s,objects=new Map(),rows=[];
 for(const r of runners){
  const fields=[];
  for(const [key,v] of Object.entries(r)){
   const raw=JSON.stringify(v),digest=sha(raw);
   if(!objects.has(digest)){const gz=gzipSync(raw,{level:6});await pack(join(dir,'objects',digest+'.json.gz'),gz,true);objects.set(digest,{rawBytes:bytes(raw),compressedBytes:gz.length});}
   fields.push({key,digest,...objects.get(digest)});
  }
  rows.push({horseId:r.horseId,no:r.no,fields,summary:summarizeRunner(r,runners,s.mode)});
 }
 const summary={schema:'REBORN2_PILOT_LIST_2',scope:s.scope,mode:s.mode,race:s.race,time:s.time,engineCommit:s.engineCommit,sourceDigest:s.sourceDigest,snapshotDigest:s.snapshotDigest,formal:false,realAdmission:false,runners:rows.map(r=>r.summary)};
 const manifest={schema:'REBORN2_PILOT_ARCHIVE_2',identity,header,rows,summary,rawBytes:bytes(JSON.stringify(s)),objectBytes:[...objects.values()].reduce((a,v)=>a+v.compressedBytes,0),objectCount:objects.size,originalKeys:Object.keys(s)};
 const record={...manifest,manifestDigest:sha(manifest)};
 const idFile=join(dir,'identities',identity+'.json'),mfile=join(dir,'manifests',record.manifestDigest+'.json');
 await pack(mfile,Buffer.from(JSON.stringify(record)),true);
 // Commit the identity last. A second snapshot of the same logical
 // fixture race/model/cutoff/mode is rejected, even with another digest.
 await pack(idFile,Buffer.from(JSON.stringify({identity,manifestDigest:record.manifestDigest})));
 return {root:dir,manifestDigest:record.manifestDigest,summaryBytes:bytes(JSON.stringify(summary)),manifestBytes:bytes(JSON.stringify(record)),rawBytes:manifest.rawBytes,objectBytes:manifest.objectBytes,objectCount:manifest.objectCount};
}
export async function readManifest(root,digest){
 assert.ok(hex(digest),'BAD_MANIFEST_ID');
 const m=JSON.parse(await readFile(join(root,'manifests',digest+'.json'),'utf8')), {manifestDigest,...body}=m;
 assert.equal(manifestDigest,digest);assert.equal(sha(body),digest,'MANIFEST_DIGEST');
 assert.equal(m.schema,'REBORN2_PILOT_ARCHIVE_2');assert.equal(m.header.engineCommit,ENGINE);assert.equal(m.header.scope,'FIXTURE_ONLY');assert.equal(m.header.realAdmission,false);assert.equal(m.header.formal,false);
 assert.equal(m.identity,sha([m.header.engineCommit,m.header.race.circuit,m.header.race.raceId,m.header.time.domain,m.header.time.cutoff,m.header.mode]));
 const i=JSON.parse(await readFile(join(root,'identities',m.identity+'.json'),'utf8'));exact(i,['identity','manifestDigest']);assert.equal(i.identity,m.identity);assert.equal(i.manifestDigest,digest,'UNCOMMITTED_MANIFEST');
 assert.equal(m.summary.snapshotDigest,m.header.snapshotDigest);assert.equal(m.rows.length,m.summary.runners.length);
 return m;
}
export async function readField(root,m,horseId,key){
 const row=m.rows.find(r=>r.horseId===horseId);assert.ok(row,'UNKNOWN_HORSE');
 const f=row.fields.find(f=>f.key===key);assert.ok(f&&hex(f.digest),'UNKNOWN_FIELD');
 const data=await readFile(join(root,'objects',f.digest+'.json.gz'));
 assert.equal(data.length,f.compressedBytes);
 const raw=gunzipSync(data,{maxOutputLength:f.rawBytes});
 assert.equal(raw.length,f.rawBytes);assert.equal(sha(raw.toString('utf8')),f.digest,'OBJECT_DIGEST');
 return JSON.parse(raw.toString('utf8'));
}
export async function restoreSnapshot(root,digest){
 const m=await readManifest(root,digest),runners=[];
 for(const row of m.rows){const pairs=[];for(const f of row.fields)pairs.push([f.key,await readField(root,m,row.horseId,f.key)]);runners.push(Object.fromEntries(pairs));}
 const s=Object.fromEntries(m.originalKeys.map(k=>[k,k==='runners'?runners:m.header[k]]));
 assert.equal(bytes(JSON.stringify(s)),m.rawBytes);validateSnapshot(s);return s;
}

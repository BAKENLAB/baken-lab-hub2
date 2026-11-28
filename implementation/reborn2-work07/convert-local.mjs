// Local operator only. No network or database. Never upload actual packages.
// Usage: node convert-local.mjs manifest.json trust.json raw-index.json /private/output.json
// raw-index is {documentId: localFilePath}; trust key and pin supplied separately.
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {convertApprovedLocal} from './offline-converter.mjs';
const [manifest,trust,index,out,...extra]=process.argv.slice(2);
if(!manifest||!trust||!index||!out||extra.length)throw Error('LOCAL_ARGUMENTS_REQUIRED');
const readJson=p=>{if(statSync(p).size>16*1024*1024)throw Error('JSON_LIMIT');return JSON.parse(readFileSync(p,'utf8'));};
const signed=readJson(manifest),policy=readJson(trust),paths=readJson(index);
const raw=new Map(Object.entries(paths).map(([id,p])=>{if(typeof p!=='string'||statSync(p).size>16*1024*1024)throw Error('LOCAL_RAW_LIMIT');return [id,readFileSync(p)];}));
const result=convertApprovedLocal(signed,raw,policy);
// Exclusive file: never overwrite. Restricted local directory is operator responsibility.
writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
console.log(JSON.stringify({scope:result.scope,counts:result.inspection.counts,rosterCount:result.inspection.rosterCount,realAdmission:false}));

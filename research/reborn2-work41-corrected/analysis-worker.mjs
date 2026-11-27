import {analyzeSupply} from './common-adapter-v0.3.mjs';
import {readFileSync} from 'node:fs';
const request=JSON.parse(readFileSync(0,'utf8'));
if(Object.keys(request).sort().join('|')!=='envelope|eyeEnabled')throw Error('WORKER_REQUEST_FIELDS');
if(typeof request.eyeEnabled!=='boolean')throw Error('EYE_FLAG');
const original=console.log;console.log=(...xs)=>console.error(...xs);
const result=await analyzeSupply(request.envelope,{eyeEnabled:request.eyeEnabled});
original(JSON.stringify(result));

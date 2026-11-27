import {analyzeSupply} from './common-adapter-v0.3.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const request=JSON.parse(readFileSync(0,'utf8'));
if(Object.keys(request).sort().join('|')!=='envelope|eyeEnabled')throw Error('WORKER_REQUEST_FIELDS');
if(typeof request.eyeEnabled!=='boolean')throw Error('EYE_FLAG');
const original=console.log;console.log=(...xs)=>console.error(...xs);
const result=await analyzeSupply(request.envelope,{eyeEnabled:request.eyeEnabled});
// Hash every JSON-serializable field recursively. Avoid the huge IPC payload;
// undefined object members follow JSON.stringify semantics; arrays retain nulls.
function digest(v){
 const h=createHash('sha256');let pending='';
 const push=s=>{pending+=s;if(pending.length>=65536){h.update(pending);pending='';}};
 function walk(x){if(x===null||typeof x!=='object'){push(JSON.stringify(x)??'null');return;}if(Array.isArray(x)){push('[');for(let i=0;i<x.length;i++){if(i)push(',');walk(x[i]);}push(']');return;}
 push('{');let first=true;for(const [k,v] of Object.entries(x)){if(v===undefined||typeof v==='function'||typeof v==='symbol')continue;if(!first)push(',');first=false;push(JSON.stringify(k)+':');walk(v);}push('}');}
 walk(v);h.update(pending);return h.digest('hex');
}
const {common,decision,...rest}=result;
const summary={...rest,fullOutputSha256:digest(result),commonOutputSha256:digest(common),decisionOutputSha256:digest(decision),decision:{runners:decision.runners.map(h=>({horse:h.horse,items:h.items.map(i=>({item:i.item,state:i.state})),eye:h.eye.map(e=>({item:e.item})),paths:h.paths.map(p=>({id:p.id,decision:p.decision})),grade:h.grade,current_grade:h.current_grade,conditional_grade:h.conditional_grade})),formal:decision.formal}};
original(JSON.stringify(summary));

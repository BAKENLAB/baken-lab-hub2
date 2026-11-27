import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
const checkout=resolve(process.argv[2]),expected=process.argv[3];
assert.match(expected??'',/^[0-9a-f]{40}$/);
assert.equal(execFileSync('git',['-C',checkout,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),expected);
const m=await import(pathToFileURL(resolve(checkout,'research/reborn2-independent-engine/main47-integration/v43-generic.mjs')));
const V=await m.loadV40();
const out=[];
for(const id of ['FK34_FULL','FK34_UNKNOWN']){
 const {request,receipt}=m.acceptedRequest(V,id);
 const on=await m.analyzeVerified(V,request,receipt,{eyeEnabled:true}),off=await m.analyzeVerified(V,request,receipt,{eyeEnabled:false});
 assert.equal(on.digest,off.digest);assert.equal(on.groups,118);assert.equal(on.held,826);
 assert.ok(on.runners.every(h=>h.formal===false&&h.grade===null&&h.itemConsumption.length===115));
 const summarize=z=>z.runners.map(h=>({horse:h.horse,grade:h.research_grade,current:h.current_grade,axes:h.axes.map(a=>({axis:a.axis,state:a.state,support:a.support?.length,counter:a.counter?.length})),rootCount:h.rootGroups.length,rootDistinct:new Set(h.rootGroups.map(r=>r.root)).size,unresolvedLineage:h.unresolvedLineage,paths:h.paths.length,summary:h.summary,gradeReasons:h.gradeReasons}));
 const row={id,digest:on.digest,roster:on.roster,on:summarize(on),off:summarize(off),scope:'conditional research only; no preset grade, no completion certification'};
 out.push(row);console.log(JSON.stringify(row));
}
console.log(JSON.stringify({schema:'V43_INDEPENDENT_BRIDGE_V1',expected,out}));

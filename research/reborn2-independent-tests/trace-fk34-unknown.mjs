import assert from 'node:assert/strict';
import {loadV40,analyze as v40} from '../reborn2-chatgpt-circuit/work36-v40-integrated.mjs';
import {analyzeControlledWork33} from '../reborn2-chatgpt-circuit/work32-v33-current.mjs';
import {analyzeV31} from '../reborn2-chatgpt-circuit/work30-v31-integrated.mjs';
import {analyzeV34} from '../reborn2-chatgpt-circuit/work33-v34-synthesis.mjs';
import {analyze as v41} from '../reborn2-chatgpt-circuit/work36-v41-local-decision.mjs';
import {integrate} from '../reborn2-chatgpt-circuit/work36-v42-propagation.mjs';
const V=await loadV40(), H=n=>'TEST:NAR|TEST:H'+n, pairs=[1,2,3,4].flatMap((a,i)=>[1,2,3,4].slice(i+1).map(b=>[H(a),H(b)]));
const matches=(p,a,b)=>[p.a,p.b].includes(a)&&[p.a,p.b].includes(b);
const results=[];
for(const id of ['FK34_FULL','FK34_UNKNOWN']){
 const docs=V.C.fixtures.find(f=>f.id===id).docs, card=docs.find(d=>d.kind==='TARGET_CARD'),hist=docs.filter(d=>d.kind==='HISTORICAL_RESULT');
 const base=analyzeControlledWork33(V.C,id,{placeThreshold:2,eyeEnabled:false,includePack:true});
 const up=analyzeV31(base.loaded,id,null,{placeThreshold:2});
 const s34=analyzeV34(V,id,{placeThreshold:2,eyeEnabled:false,localize:true});
 const x=v41(V,id,{eyeEnabled:false}),z=integrate(x,docs,{eyeEnabled:false});
 const rows=pairs.map(([a,b])=>{
 const source=hist.map(d=>({event:d.eventId,rows:d.rows.filter(r=>[a.split('|').at(-1),b.split('|').at(-1)].includes(r.nativeId)).map(r=>({horse:r.nativeId,finish:r.finish,clock:r.clockMs,checkpoints:r.checkpointMs}))}));
 const direct=up.direct.filter(p=>matches(p,a,b));
 const pair=base.pairResponse.find(p=>matches(p,a,b));
 const edges34=s34.scenarios.filter(s=>s.kind==='OBSERVED_FIELD_RESPONSE_SCENARIO').map(s=>({id:s.id,knownField:s.knownField,contextMatched:s.contextMatched,paceUsable:s.paceUsable,valid:s.valid,edge:s.edges.find(e=>matches(e,a,b))}));
 const edges40=x.historical_scenarios.map(s=>({id:s.id,knownField:s.knownField,edge:s.edges.find(e=>matches(e,a,b))}));
 const edges41=x.history_v41.map(s=>({id:s.id,sourceValid:s.sourceValid,rosterMatched:s.rosterMatched,fieldChanged:s.fieldChanged,edge:s.edges.find(e=>matches(e,a,b))}));
 const edges42=z.routes.map(s=>({id:s.id,pace:s.pace.state,edge:s.edges.find(e=>matches(e,a,b))}));
 const counts={raw:source.filter(s=>s.rows.length===2&&s.rows.every(r=>Number.isFinite(r.clock)&&r.checkpoints.every(Number.isFinite))).length,v31:direct.length,v33:pair?.comparisons.length??0,v34:edges34.filter(s=>s.edge?.interval_ms).length,v40:edges40.filter(s=>s.edge?.interval_ms).length,v41Measured:edges41.filter(s=>s.edge?.measured).length,v41Local:edges41.filter(s=>s.edge?.unaffected).length,v42Measured:edges42.filter(s=>s.edge?.measurement).length,v42Local:edges42.filter(s=>s.edge?.local).length,v42Full:edges42.filter(s=>s.edge?.full).length};
 return {pair:[a,b],counts,source,direct:direct.map(p=>({event:p.event,order:p.order})),v33:pair?.comparisons.map(p=>({event:p.event,clock:p.clock_advantage_ms,context:p.pair_context})),v34:edges34.map(({edge,...s})=>({...s,interval:edge?.interval_ms,order:edge?.order})),v41:edges41.map(({edge,...s})=>({...s,measured:edge?.measured,unaffected:edge?.unaffected,scope:edge?.scope})),v42:edges42.reduce((m,s)=>{const k=[s.pace,s.edge?.scope].join('|');m[k]=(m[k]??0)+1;return m;},{})};
 });
 const receipt={id,sourceDigest:x.source_digest,card:card.rows.map(r=>({id:r.nativeId,status:r.status})),roster:x.roster,rows};
 results.push(receipt);
 console.log('PAIR_TRACE '+JSON.stringify(receipt));
}
assert.equal(results[1].rows.length,6);
assert.ok(results[1].rows.every(r=>r.counts.raw===5));
console.log('PAIR_TRACE_SUMMARY '+JSON.stringify(results.map(r=>({id:r.id,rows:r.rows.map(p=>({pair:p.pair,counts:p.counts,firstZero:Object.entries(p.counts).find(([k,v])=>v===0)?.[0]??null}))}))));

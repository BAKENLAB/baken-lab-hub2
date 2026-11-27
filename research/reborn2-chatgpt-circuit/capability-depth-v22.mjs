// V22 deeper research; local generated inputs only, not production or predictions.
import {createHash} from 'node:crypto';
import {validateV21,fixtureV21,eyeInputsV21} from './race-expression-v21.mjs';
import {cleanV22,analyzeV22Continuation} from './conditional-field-v22.mjs';
import {analyzeV19} from './field-interaction-v19.mjs';
import {runGenerated} from './v15-research.mjs';
const uniq=a=>[...new Set(a)].sort(),sum=a=>a.reduce((s,x)=>s+x,0),eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const row=(r,id)=>r.rows.find(h=>h.id===id),stamp=(r,k)=>r.date+'T'+r[k];
const conditionKeys=['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility','first_corner_m'];
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const digest=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
function scope(r,t,m,ids){
 const missing=conditionKeys.filter(k=>r.conditions[k]==null||t.conditions[k]==null),diff=conditionKeys.filter(k=>!missing.includes(k)&&r.conditions[k]!==t.conditions[k]);
 for(const k of ['points','phases','straight_m','first_corner_m'])if(!eq(m.geometry[r.id][k],m.geometry[t.id][k]))diff.push(k);
 if(r.field_count!==t.entrants.length)diff.push('field_count');
 for(const id of ids)if(!row(r,id)||row(r,id).kg!==t.entrants.find(x=>x.id===id)?.kg)diff.push('weight_or_identity:'+id);
 return {missing,diff,matched:!missing.length&&!diff.length};
}
export function localEvidenceV22(p,m){
 validateV21(p,m);const evidence=[];
 const put=(id,kind,race,horse,value,published)=>evidence.push({id,kind,race,horse,value,sha256:digest({id,kind,race,horse,value,published}),published,source:'GENERATED_METADATA_NOT_OFFICIAL',authority:null,rights:'SYNTHETIC_RESEARCH_ONLY',formal:false});
 for(const r of [p.target,...p.history]){
  put('v22:geometry:'+r.id,'GEOMETRY',r.id,null,m.geometry[r.id],stamp(r,'published'));
  if(r===p.target){for(const h of r.entrants)put('v22:card:'+h.id,'CURRENT_CARD',r.id,h.id,{...h,conditions:r.conditions},stamp(r,'published'));continue;}
  put('v22:race:'+r.id,'RACE_CONTEXT',r.id,null,{conditions:r.conditions,laps:r.lap_tenths,segments:r.lap_segment_m,field:r.field_count,family:m.families[r.id]},stamp(r,'published'));
  for(const h of r.rows)put('v22:clock:'+r.id+':'+h.id,'INDIVIDUAL_CHECKPOINTS',r.id,h.id,{clocks:m.clocks[r.id][h.id],row:h},stamp(r,'published'));
 }
 return evidence;
}
function comparisons(p,m,r,id,peer){
 const a=row(r,id),b=row(r,peer),x=m.clocks[r.id][id],y=m.clocks[r.id][peer],d=r.lap_segment_m.map((_,i)=>sum(r.lap_segment_m.slice(0,i+1))),g=x.map((z,i)=>z-y[i]),steps=g.slice(1).map((v,i)=>({from_m:d[i],to_m:d[i+1],before:g[i],after:v,closed_tenths:g[i]-v,transition:g[i]>v?'GAIN_TIME':g[i]<v?'LOSE_TIME':'STALL_RELATIVE'}));
 const shape=g[0]<=0?'NOT_TRAILING_AT_FIRST_OBSERVATION':steps.every(s=>s.closed_tenths>0)?'SUSTAINED_RELATIVE_GAIN':steps.some(s=>s.closed_tenths<0)&&steps.some(s=>s.closed_tenths>0)?'INTERRUPTED_RELATIVE_GAIN':steps.some(s=>s.closed_tenths===0)&&steps.some(s=>s.closed_tenths>0)?'GAIN_WITH_STALL':steps.every(s=>s.closed_tenths<=0)?'NO_RELATIVE_GAIN':'OTHER';
 const close=g[0]-g.at(-1),s=scope(r,p.target,m,[id,peer]),actualWIN=a.finish===1,actualPLACE=a.finish<=3&&a.finish<r.field_count;
 const rootIds=['v22:geometry:'+r.id,'v22:geometry:'+p.target.id,'v22:race:'+r.id,'v22:clock:'+r.id+':'+id,'v22:clock:'+r.id+':'+peer,'v22:card:'+id,'v22:card:'+peer];
 const state=shape==='NOT_TRAILING_AT_FIRST_OBSERVATION'?'NOT_APPLICABLE':!s.matched?'UNKNOWN':shape==='SUSTAINED_RELATIVE_GAIN'?'SUPPORT':'COUNTER';
 return {race:r.id,peer,gaps:g,steps,shape,net_closed_tenths:close,finish:a.finish,field:r.field_count,clock:a.clock_tenths,final600:a.final3f_tenths,peer_finish:b.finish,scope:s,proposition:'CONTINUOUS_MEASURED_RELATIVE_GAIN_FROM_FIRST_OBSERVED_DEFICIT',state,WIN:state==='SUPPORT'?(actualWIN?'SUPPORT':'COUNTER_TO_SUFFICIENCY'):'UNKNOWN',PLACE:state==='SUPPORT'?(actualPLACE?'SUPPORT':'COUNTER_TO_SUFFICIENCY'):'UNKNOWN',root_ids:rootIds,current_outcome:null,effort:null};
}
function roleAlternatives(p,m,r){
 const current=new Set(p.target.entrants.map(h=>h.id)),present=r.rows.filter(h=>current.has(h.id)),leader=present.find(h=>h.corners[0]===1);
 if(!leader||present.length<2)return null;
 const ids=present.map(h=>h.id).sort(),d=r.lap_segment_m.map((_,i)=>sum(r.lap_segment_m.slice(0,i+1)));
 const windows=d.map((at_m,i)=>({at_m,observed_leader:r.rows.find(h=>m.clocks[r.id][h.id][i]===Math.min(...r.rows.map(z=>m.clocks[r.id][z.id][i]))).id,relations:ids.flatMap((a,j)=>ids.slice(j+1).map(b=>({a,b,gap_tenths:m.clocks[r.id][a][i]-m.clocks[r.id][b][i]})))}));
 const subjects=ids.map(id=>({id,responses:ids.filter(x=>x!==id).map(peer=>comparisons(p,m,r,id,peer)),finish:row(r,id).finish}));
 return {race:r.id,assumed_initial_leader:leader.id,observed_joint_subset:ids,unassigned_current:[...current].filter(x=>!ids.includes(x)).sort(),historical_other_runners:r.rows.filter(x=>!current.has(x.id)).map(x=>x.id).sort(),windows,subjects,scope:scope(r,p.target,m,ids),conditions:['OBSERVED_JOINT_SUBSET_PATTERN_ONLY','OTHER_CURRENT_RUNNERS_UNASSIGNED','NO_PROVEN_CURRENT_FEASIBILITY'],current_feasibility:null};
}
function eyeRequests(base){
 return base.eye.flatMap(h=>h.items.flatMap(e=>{
 const types={'EYE-08':['DIRECTIONAL_COURSE_CHANGE','V22_COURSE_TRANSITION'],'EYE-13':['COMPARABLE_TREND_CONTEXT','V22_UNCHANGED_FINISH_CONTENT'],'EYE-10':['SANDWICH_WITH_GEOMETRY','V22_SANDWICH']};
 const t=types[e.eye_item_id];return t&&e.observed_facts.some(f=>f.type===t[0])?[{horse_id:h.horse_id,kind:t[1],eye:e.eye_item_id}]:[];
 }));
}
export function analyzeCapabilityV22(packet,meta,{disabled=[]}={}){
 const {p,m}=cleanV22(packet,meta),base=analyzeV22Continuation(packet,meta,{disabled}),prior=analyzeV19(p),evidence=localEvidenceV22(p,m),bound=new Set(evidence.map(x=>x.id)),ids=p.target.entrants.map(h=>h.id).sort();
 const joint=p.history.map(r=>roleAlternatives(p,m,r)).filter(Boolean);
 const requested=eyeRequests(base).filter(x=>!disabled.includes(x.eye));
 const all=runGenerated(p,{versioned:true,allowExternalPeers:true,v21Evidence:eyeInputsV21(p,m),mechanisms:prior.mechanisms,researchReturn:[...prior.returns,...base.returns,...requested]});
 const decisions=base.decisions.map(h=>{
 const compare=p.history.filter(r=>row(r,h.id)).flatMap(r=>ids.filter(id=>id!==h.id&&row(r,id)).map(id=>comparisons(p,m,r,h.id,id)));
 const returned=all.merged.find(x=>x.horse_id===h.id),eye08=returned.items['46'].facts.filter(x=>x.value.research_return==='EYE-08'),eye13=returned.items['74'].hypotheses.filter(x=>x.value.research_return==='EYE-13');
 const paths=joint.filter(j=>j.observed_joint_subset.includes(h.id)).map(j=>{const witnesses=compare.filter(x=>x.race===j.race);return {scenario:'JOINT:'+j.race,assumed_initial_leader:j.assumed_initial_leader,unassigned:j.unassigned_current,proposition:'SUSTAINED_RELATIVE_GAIN_ROUTE_IF_HISTORICAL_PAIR_CONDITIONS_RECUR',support:witnesses.filter(x=>x.state==='SUPPORT'),counter:witnesses.filter(x=>x.state==='COUNTER'),unknown:witnesses.filter(x=>['UNKNOWN','NOT_APPLICABLE'].includes(x.state)),WIN:{support:witnesses.filter(x=>x.WIN==='SUPPORT').map(x=>x.peer),counter:witnesses.filter(x=>x.WIN==='COUNTER_TO_SUFFICIENCY').map(x=>x.peer)},PLACE:{support:witnesses.filter(x=>x.PLACE==='SUPPORT').map(x=>x.peer),counter:witnesses.filter(x=>x.PLACE==='COUNTER_TO_SUFFICIENCY').map(x=>x.peer)},current_viability:null};});
 return {...h,views:{...h.views,A:{...h.views.A,measured_relative_capacity:compare.map(({scope,state,WIN,PLACE,current_outcome,root_ids,...x})=>x)},B:{...h.views.B,relative_transfer:compare.map(x=>({race:x.race,peer:x.peer,scope:x.scope,state:x.state,root_ids:x.root_ids})),eye08,eye13},D:{...h.views.D,joint_capacity_paths:paths,eye08_context:eye08,eye13_context:eye13},E:{...h.views.E,current_benefit:null}}};
 });
 const rootIds=uniq(decisions.flatMap(h=>h.views.B.relative_transfer.flatMap(x=>x.root_ids))),unbound=rootIds.filter(x=>!bound.has(x));if(unbound.length)throw Error('V22_LOCAL_ROOT_UNBOUND');
 // This is a local projection only. It deliberately refuses any claim of Work custody or official authority.
 const contract={schema:'V22_LOCAL_PROJECTION_DRAFT',classification:'SYNTHETIC_ONLY',analysis_cutoff:stamp(p.target,'published'),formal:false,authority:null,rights:'SYNTHETIC_RESEARCH_ONLY',work_verifier_receipt:null,official_admitted:0,held_groups:118,held_flags:826,roots:rootIds,withheld:['OFFICIAL_IDENTITY','OFFICIAL_PUBLICATION','INDEPENDENT_CUSTODY','RIGHTS_REGISTRY','COURSE_EFFECTIVE_INTERVAL','CALIBRATED_ABILITY']};
 return {...base,common:all.merged,eye:all.eye,audit:all.ledger,decisions,joint,evidence,local_root_check:{distinct:rootIds.length,unbound},contract,formal:false,semantic_proof_complete:false};
}
// Explicit counterfactual generated clocks: same finish and total, different relative trajectory.
export function capacityContrastV22(interrupted=false){
 const {packet:p,meta:m}=fixtureV21(900,4),r=p.history[1],ids=['FIXTURE-A','FIXTURE-B','FIXTURE-C','FIXTURE-D'],lead=r.lap_tenths.map((_,i)=>sum(r.lap_tenths.slice(0,i+1))),offsets=[interrupted?[6,1,5,1,0]:[6,4,2,1,0],[0,0,0,0,2],[8,8,8,8,4],[10,10,10,10,6]];
 for(let i=0;i<ids.length;i++)m.clocks[r.id][ids[i]]=lead.map((v,j)=>v+offsets[i][j]);
 for(const h of r.rows){const a=m.clocks[r.id][h.id];h.corners=[0,1,2,3].map(i=>1+r.rows.filter(x=>m.clocks[r.id][x.id][i]<a[i]).length);h.finish=1+r.rows.filter(x=>m.clocks[r.id][x.id].at(-1)<a.at(-1)).length;h.clock_tenths=a.at(-1);h.margin_tenths=h.finish===1?null:a.at(-1)-lead.at(-1);h.final3f_tenths=a.at(-1)-a[1];}
 validateV21(p,m);return {p,m,race:r.id};
}

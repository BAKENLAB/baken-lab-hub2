import {readFileSync} from 'node:fs';
import {generateV16,validateV16,toCommonV16} from './synthetic-generator-v16.mjs';
import {runGenerated} from './v15-research.mjs';
import {synthesizeV16} from './conditional-judgment-v16.mjs';
const catalog=JSON.parse(readFileSync(new URL('./catalog-115.json',import.meta.url))).items;
const uniq=a=>[...new Set(a)].sort(), key=(...a)=>JSON.stringify(a),facts=(h,k)=>h.items[k]?.facts??[];
const condKeys=['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility'];
const differences=(a,b)=>condKeys.filter(k=>a[k]==null||a[k]!==b[k]);
const refs=(...a)=>uniq(a.flat());
const root=(r,h)=>key(r,h);
const find=(r,id)=>r.rows.find(h=>h.id===id);
const rank=(r,x,j)=>1+r.rows.filter(h=>h.checkpoint_tenths[j]<x.checkpoint_tenths[j]).length;
// Recompute *all* dependent leader/individual values when historical roster or crossing order changes.
function rebuild(r){
 const leaders=Array.from({length:7},(_,j)=>Math.min(...r.rows.map(h=>h.checkpoint_tenths[j])));
 r.field_count=r.rows.length;r.lap_tenths=leaders.map((x,j)=>x-(leaders[j-1]??0));
 for(const [i,h] of r.rows.entries()){h.runner=i+1;h.finish=rank(r,h,6);h.corners=[0,1,3,5].map(j=>rank(r,h,j));h.clock_tenths=h.checkpoint_tenths[6];h.final3f_tenths=h.clock_tenths-h.checkpoint_tenths[3];h.margin_tenths=h.finish===1?null:h.clock_tenths-leaders[6];}
 return r;
}
function reorder(r,j,ids){const times=r.rows.map(x=>x.checkpoint_tenths[j]).sort((a,b)=>a-b);ids.forEach((id,i)=>find(r,id).checkpoint_tenths[j]=times[i]);return rebuild(r);}
export function prototypePacket(){
 const c=generateV16();c.id='GEN17-ALLFIELD';
 const [a,b,d]=c.history,A='FIXTURE-A',B='FIXTURE-B',C='FIXTURE-C',D='FIXTURE-D';
 // Explicit fictional scenario design, not a target outcome or expected rank.
 for(const h of c.target.entrants)if(h.id===B)h.kg=54;
 for(const r of c.history)for(const h of r.rows)if(h.id===B)h.kg=54;
 reorder(a,0,[B,C,A,D]);reorder(a,5,[A,C,B,D]); // A won from 3rd early, advanced by fourth corner.
 b.rows=b.rows.filter(h=>h.id!==B);rebuild(b); // A and C share a result, B absent.
 d.rows=d.rows.filter(h=>h.id!==A);rebuild(d); // B and C share a different result, A absent.
 const e=structuredClone(d);e.id='FK-GEN-4';e.date='2026-11-10';e.conditions.going='重';c.history.push(e);
 const valid=validateV16(c);if(!valid.valid)throw Error('PROTOTYPE_INVALID:'+valid.errors.join(','));
 return c;
}
function validSharedComparisons(h,c){
 const seen=new Set(),ids=c.target.entrants.map(x=>x.id);
 for(const f of facts(h,'35')){
 const v=f.value, r=c.history.find(x=>x.id===v.shared_race),peer=v.pair_ids?.[1],own=r&&find(r,h.horse_id),other=r&&find(r,peer),k=key(v.shared_race,peer);
 if(!own||!other||peer===h.horse_id||!ids.includes(peer)||v.pair_ids[0]!==h.horse_id||seen.has(k)||own.finish!==v.own_finish||other.finish!==v.peer_finish||v.outcome!==(own.finish<other.finish?'AHEAD':'BEHIND'))throw Error('SHARED_PEER_BINDING');
 seen.add(k);
 }
}
function relation(c,h,f){
 const v=f.value,[ra,rb]=v.race_links??[],a=c.history.find(r=>r.id===ra),b=c.history.find(r=>r.id===rb),peer=v.common_peer_id,other=v.other_id;
 if(!a||!b||ra===rb||other===h.horse_id||peer===other||peer===h.horse_id)return null;
 const x=find(a,h.horse_id),p=find(a,peer),y=find(b,other),q=find(b,peer);
 if(!x||!p||!y||!q)return null;
 const obs=[x.finish<p.finish?'AHEAD':'BEHIND',y.finish<q.finish?'AHEAD':'BEHIND'];
 if(JSON.stringify(obs)!==JSON.stringify(v.relative_observations))throw Error('INDIRECT_RELATION_BINDING');
 const card=id=>c.target.entrants.find(t=>t.id===id);
 const diff=uniq([...differences(a.conditions,c.target.conditions),...differences(b.conditions,c.target.conditions)]);
 const weightKnown=card(h.horse_id)&&card(other)&&card(peer)&&x.kg-p.kg===card(h.horse_id).kg-card(peer).kg&&y.kg-q.kg===card(other).kg-card(peer).kg&&x.kg-p.kg===y.kg-q.kg;
 const delta=[x.clock_tenths-p.clock_tenths,y.clock_tenths-q.clock_tenths];
 const dir=obs[0]!==obs[1]?(obs[0]==='AHEAD'?'SUBJECT_DIRECTION':'RIVAL_DIRECTION'):'UNRESOLVED_SAME_SIDE';
 return {other,common_peer:peer,races:[ra,rb],observed_order:obs,observed_clock_gaps_tenths:delta,condition_differences:diff,relative_weight_matched:!!weightKnown,field_sizes:[a.field_count,b.field_count,c.target.entrants.length],roots:[root(ra,h.horse_id),root(ra,peer),root(rb,other),root(rb,peer)],refs:f.evidence_ids,
 current_comparison:diff.length||!weightKnown?'UNKNOWN':dir==='UNRESOLVED_SAME_SIDE'?'UNKNOWN':dir==='SUBJECT_DIRECTION'?'CONDITIONAL_SUBJECT_EDGE':'CONDITIONAL_RIVAL_EDGE',
 scope:'PAIRWISE_ONLY_IF_COMMON_PEER_PERFORMANCE_AND_MATCHED_CONDITIONS_TRANSFER',missing:['COMMON_PEER_CURRENT_STATE_STABILITY','NO_JOINT_FIELD_ORDER'],formal:false};
}
function enrich(c,common,base){
 return base.map(d=>{
 const h=common.merged.find(x=>x.horse_id===d.id),ids=c.target.entrants.map(x=>x.id);
 const partial=facts(h,'35').map(f=>{
 const v=f.value,r=c.history.find(x=>x.id===v.shared_race),x=find(r,d.id),p=find(r,v.pair_ids[1]),card=id=>c.target.entrants.find(t=>t.id===id);
 const diff=differences(r.conditions,c.target.conditions),weight=x.kg-p.kg===card(d.id).kg-card(p.id).kg;
 return {rival:p.id,race:r.id,own_finish:x.finish,peer_finish:p.finish,observed_order:v.outcome,gap_tenths:x.clock_tenths-p.clock_tenths,differences:diff,relative_weight_matched:weight,prior_field:r.field_count,current_field:ids.length,roots:[root(r.id,d.id),root(r.id,p.id)],refs:f.evidence_ids,
 current_comparison:!diff.length&&weight?(v.outcome==='AHEAD'?'CONDITIONAL_SUBJECT_EDGE':'CONDITIONAL_RIVAL_EDGE'):'UNKNOWN',scope:diff.length?'HISTORICAL_PAIR_OBSERVATION_ONLY_NO_CONDITION_CORRECTION':'PAIRWISE_ONLY_NOT_FULL_FIELD',formal:false};
 });
 const indirect=facts(h,'36').map(f=>relation(c,h,f)).filter(Boolean);
 const relevant=indirect.filter(x=>x.current_comparison!=='UNKNOWN');
 const directRelevant=partial.filter(x=>x.current_comparison!=='UNKNOWN');
 const subjectEdge=[...directRelevant,...relevant].some(x=>x.current_comparison==='CONDITIONAL_SUBJECT_EDGE'),rivalEdge=[...directRelevant,...relevant].some(x=>x.current_comparison==='CONDITIONAL_RIVAL_EDGE');
 d.perspectives.C={...d.perspectives.C,status:subjectEdge?(rivalEdge?'MIXED':'SUPPORT'):rivalEdge?'COUNTER':'UNKNOWN',scoped_direct:partial,scoped_indirect:indirect,items:['35','36'],scope:'PAIRWISE_CONDITIONAL_NOT_TRANSITIVE_RANK'};
 d.comparisons={direct:partial,indirect};
 const compareConsumption=[...directRelevant.map(x=>({item_ids:['35'],root:x.roots.join('|'),role:x.current_comparison,route:'PERSPECTIVE_C'})),...relevant.map(x=>({item_ids:['36'],root:x.roots.join('|'),role:x.current_comparison,route:'PERSPECTIVE_C'}))];
 // Mismatched conditions or absent runners are not grounds to erase observed results.
 // No full-field WIN/PLACE promotion from these bounded pairwise comparisons.
 d.consumed.push(...compareConsumption);
 d.material_missing=[...d.routes.filter(r=>r.state==='UNKNOWN').map(r=>({route:r.id,reason:r.reason})),...indirect.filter(x=>x.current_comparison==='UNKNOWN').map(x=>({route:'PAIR:'+x.other,reason:x.condition_differences.length?'CONDITION_DIFFERENCE:'+x.condition_differences.join(','):!x.relative_weight_matched?'RELATIVE_WEIGHT_NOT_COMPARABLE':'SAME_SIDE_NO_DIRECTION'}))];
 d.peripheral_missing=[{material:'Current workout',scope:'Not necessary for historical conditional witness; current readiness still unverified'}];
 d.supports=d.routes.filter(r=>r.state==='CONDITIONAL_SUPPORT'||r.state==='CONDITIONAL_HYPOTHESIS');
 d.counters=d.routes.filter(r=>r.state==='COUNTER_CONTEXT');
 return d;
 });
}
export function analyzeAllV17(c){
 const checked=validateV16(c);if(!checked.valid)throw Error('INVALID_V17:'+checked.errors.join(','));
 const common=runGenerated(toCommonV16(c));
 for(const h of common.merged)validSharedComparisons(h,c);
 const before=enrich(c,common,synthesizeV16(c,common,{useEye:false})),after=enrich(c,common,synthesizeV16(c,common,{useEye:true}));
 const runners=after.map(d=>{
 const h=common.merged.find(x=>x.horse_id===d.id),e=common.eye.find(x=>x.horse_id===d.id),initial=before.find(x=>x.id===d.id),card=c.target.entrants.find(x=>x.id===d.id);
 const added=d.routes.filter(x=>!initial.routes.some(y=>y.id===x.id)),removed=initial.routes.filter(x=>!d.routes.some(y=>y.id===x.id));
 const items=catalog.map(def=>{
 const l=common.ledger.find(x=>x.horse===d.id&&x.item===def.id),finding=def.id.startsWith('EYE-')?e.items.find(x=>x.eye_item_id===def.id):h.items[def.id];
 const consumed=d.consumed.filter(x=>x.item_ids.includes(def.id));
 if(!l||!finding)throw Error('ITEM_COVERAGE');
 return {id:def.id,name:def.name,domain:def.id.startsWith('EYE-')?'EYE':'RANK',section_called:l.section_called,output_count:l.output_count,instrumented_reads:l.instrumented_reads,output_status:l.output_count?'OUTPUT':'UNKNOWN_OR_NOT_APPLICABLE',finding,judgment_consumption:consumed,individual_semantic_effect_proven:false};
 });
 return {horse_no:card.runner,horse_id:d.id,card,history:d.observed,items,eye_reanalysis:{before_WIN:initial.winning_conditional,before_PLACE:initial.placing_conditional,after_WIN:d.winning_conditional,after_PLACE:d.placing_conditional,added,removed,root_policy:'REUSE_NOT_INDEPENDENT_EVIDENCE',raw_new_evidence_count:0},judgment:d,formal:false};
 }).sort((a,b)=>a.horse_no-b.horse_no);
 return {version:'V17',scope:'SYNTHETIC_RESEARCH_ONLY',target:c.target,packet:c,validation:checked,runners,summary:runners.map(r=>({no:r.horse_no,id:r.horse_id,rank_items:r.items.filter(i=>i.domain==='RANK').length,eye_items:r.items.filter(i=>i.domain==='EYE').length,output_items:r.items.filter(i=>i.output_count>0).length,consumed_items:r.items.filter(i=>i.judgment_consumption.length>0).map(i=>i.id),WIN:r.judgment.winning_conditional.length,PLACE:r.judgment.placing_conditional.length,eye_WIN_delta:r.eye_reanalysis.after_WIN.length-r.eye_reanalysis.before_WIN.length,eye_PLACE_delta:r.eye_reanalysis.after_PLACE.length-r.eye_reanalysis.before_PLACE.length,perspectives:Object.fromEntries(Object.entries(r.judgment.perspectives).map(([k,v])=>[k,v.status]))})),formal:false,release_eligible:false};
}

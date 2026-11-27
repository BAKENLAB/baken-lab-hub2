import {createHash} from 'node:crypto';
import {runGenerated} from './v15-research.mjs';
import {validateGenerated} from './synthetic-generator-v15.mjs';
import {generateV16} from './synthetic-generator-v16.mjs';
import {synthesizeV16} from './conditional-judgment-v16.mjs';
const unique=a=>[...new Set(a)].sort();
const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const facts=(h,k)=>h.items[k]?.facts??[];
const resultRef=(r,h)=>'fixture-v2:result:'+r+':'+h;
const posRef=(r,h)=>'fixture-v2:pos:'+r+':'+h;
const find=(p,r)=>p.history.find(x=>x.id===r);
const row=(r,id)=>r?.rows.find(x=>x.id===id);
const conditionKeys=['venue','course_version','distance_m','surface','turn','going','grade','layout','rule_version','eligibility'];
function scope(a,b){
 const missing=conditionKeys.filter(k=>a[k]==null||b[k]==null);
 const different=conditionKeys.filter(k=>a[k]!=null&&b[k]!=null&&a[k]!==b[k]);
 // No cross-surface, grade or rule equivalence is assumed. Other differences
 // may admit a bounded historical pathway hypothesis, not an adjusted time.
 const hard=['surface','grade','rule_version','eligibility'].filter(k=>missing.includes(k)||different.includes(k));
 return {different,missing,hard,scope:hard.length||missing.length?'HISTORICAL_ONLY':different.length?'PARTIAL_HYPOTHESIS':'MATCHED_CONDITIONS'};
}
const check=p=>{const v=validateGenerated(p,{allowExternalPeers:true});if(!v.valid)throw Error('V18_INVALID:'+v.errors.join(','));};
const run=p=>runGenerated(p,{allowExternalPeers:true,versioned:true});
const version=(packet,derived=[])=>({raw:hash(packet),derived:hash(derived),evidence_version:hash([packet,derived])});
function buildMechanisms(p,common,disabled){
 const out=[];
 for(const h of common.merged){
 const id=h.horse_id,eye=common.eye.find(e=>e.horse_id===id);
 const add=(eye_id,o,r,x,kind,items,roots,extra={})=>{
  const s=scope(r.conditions,p.target.conditions);
  if(s.scope==='HISTORICAL_ONLY')return;
  const refs=unique(roots),allowed=new Set(items.flatMap(k=>facts(h,k).flatMap(f=>f.evidence_ids)));
  if(!refs.every(k=>allowed.has(k)))return;
  const m={horse_id:id,race_id:p.target.id,source_cutoff:p.target.date+'T'+p.target.published+':00',mechanism_id:JSON.stringify([eye_id,r.id,id,extra.later_race??null,extra.peer??null]),family:JSON.stringify([r.id,id]),direction:'SUPPORT',upstream_item_ids:items,evidence_ids:refs,scenario_id:kind,current_relevance_verified:true,scope:'FICTIONAL_CONDITIONAL_NOT_VERIFIED_ABILITY',eye_id,prior_race:r.id,observed_finish:x.finish,applicability:s,raw_new_facts:0,...extra};
  out.push(m);
 };
 if(!disabled.includes('EYE-02'))for(const o of eye.items.find(e=>e.eye_item_id==='EYE-02').observed_facts.filter(x=>x.type==='FINISH_POSITION_CONTENT')){
  const r=find(p,o.value.race_id),x=row(r,id);
  if(!x||x.finish>3||x.corners[0]<=x.corners.at(-1)||!o.value.transitions.some(t=>t.definite_gain>0))continue;
  add('EYE-02',o,r,x,'REPRODUCE_OBSERVED_ADVANCE',['02','17','18'],[resultRef(r.id,id),posRef(r.id,id)],{observed_positions:x.corners,win_attained:x.finish===1});
 }
 if(!disabled.includes('EYE-05'))for(const o of eye.items.find(e=>e.eye_item_id==='EYE-05').observed_facts.filter(x=>x.type==='PEER_FOLLOWUP')){
  const v=o.value,r=find(p,v.prior_race_id),x=row(r,id),peer=row(r,v.peer_id);
  const f=facts(h,'37').find(f=>f.value.prior_race_id===v.prior_race_id&&f.value.peer_id===v.peer_id&&f.value.shared_followup_key===v.shared_followup_key);
  const later=p.history.find(l=>v.shared_followup_key===v.peer_id+'|FIXTURE|'+l.id),y=row(later,v.peer_id);
  if(!f||!x||!peer||!y||x.finish>3||x.finish>=peer.finish||y.finish!==1||later.date<=r.date||scope(later.conditions,r.conditions).scope==='HISTORICAL_ONLY')continue;
  add('EYE-05',o,r,x,'SUBJECT_BEAT_LATER_WINNER',['02','37'],[resultRef(r.id,id),resultRef(r.id,peer.id),resultRef(later.id,peer.id)],{peer:peer.id,later_race:later.id,peer_prior_finish:peer.finish,peer_later_finish:y.finish,win_attained:x.finish===1,missing:['PEER_FORM_STABILITY','NO_CAUSAL_CLASS_UPGRADE']});
 }
 }
 return out;
}
// Staged discovery searches only the supplied, validated, fictional reserve.
// Entire historical races are validated before disclosure; no target result.
function discover(initial,reserve,common){
 const peers=new Set(common.eye.flatMap(h=>h.items.find(e=>e.eye_item_id==='EYE-05').observed_facts.filter(o=>o.type==='PEER_FOLLOWUP').map(o=>o.value.peer_id)));
 const disclosed=reserve.filter(r=>r.rows.some(h=>peers.has(h.id)&&initial.history.some(a=>a.date<r.date&&a.rows.some(x=>x.id===h.id))));
 const expanded={...initial,history:[...initial.history,...disclosed]};check(expanded);
 return {expanded,disclosed:disclosed.map(r=>r.id),held:reserve.filter(r=>!disclosed.includes(r)).map(r=>r.id)};
}
function decisions(p,common){
 const result=synthesizeV16(p,common,{useEye:false});
 for(const d of result){
  const h=common.merged.find(x=>x.horse_id===d.id),paths=h.items['100'].hypotheses.flatMap(x=>x.value.winning_paths??[]);
  const card=p.target.entrants.find(x=>x.id===d.id),comparisons=[];
  for(const f of facts(h,'35')){
   const v=f.value,r=find(p,v.shared_race),x=row(r,d.id),peer=row(r,v.pair_ids[1]),other=p.target.entrants.find(x=>x.id===peer?.id);
   if(!x||!peer||!other)continue;
   const s=scope(r.conditions,p.target.conditions),weight=x.kg-peer.kg===card.kg-other.kg;
   comparisons.push({rival:peer.id,race:r.id,observed:v.outcome,gap:x.clock_tenths-peer.clock_tenths,scope:s,relative_weight_matched:weight,roots:[resultRef(r.id,d.id),resultRef(r.id,peer.id)],current:!weight||s.scope==='HISTORICAL_ONLY'?'UNKNOWN':v.outcome==='AHEAD'?'CONDITIONAL_SUBJECT_EDGE':'CONDITIONAL_RIVAL_EDGE'});
  }
  const indirect=[];
  for(const f of facts(h,'36')){
   const v=f.value,[a,b]=v.race_links.map(r=>find(p,r)),x=row(a,d.id),q=row(a,v.common_peer_id),y=row(b,v.other_id),z=row(b,v.common_peer_id),other=p.target.entrants.find(t=>t.id===v.other_id);
   if(!x||!q||!y||!z||!other||a.id===b.id)continue;
   const s=[scope(a.conditions,p.target.conditions),scope(b.conditions,p.target.conditions),scope(a.conditions,b.conditions)];
   const comparable=s.every(x=>x.scope!=='HISTORICAL_ONLY')&&x.kg-q.kg===y.kg-z.kg&&x.kg-y.kg===card.kg-other.kg;
   const order=[Math.sign(x.finish-q.finish),Math.sign(y.finish-z.finish)];
   indirect.push({other:v.other_id,peer:v.common_peer_id,races:[a.id,b.id],observed_order:order,scopes:s,roots:[resultRef(a.id,d.id),resultRef(a.id,q.id),resultRef(b.id,y.id),resultRef(b.id,z.id)],current:!comparable||order[0]===order[1]?'UNKNOWN':order[0]<0?'CONDITIONAL_SUBJECT_EDGE':'CONDITIONAL_RIVAL_EDGE',missing:['COMMON_PEER_FORM_STABILITY','JOINT_FIELD_ORDER']});
  }
  const edges=[...comparisons,...indirect],positive=edges.filter(e=>e.current==='CONDITIONAL_SUBJECT_EDGE'),negative=edges.filter(e=>e.current==='CONDITIONAL_RIVAL_EDGE');
  d.perspectives.C={status:positive.length?(negative.length?'MIXED':'SUPPORT'):negative.length?'COUNTER':'UNKNOWN',direct:comparisons,indirect,scope:'CONDITIONAL_PAIRWISE_ONLY'};
  for(const e of edges.filter(x=>x.current!=='UNKNOWN'))d.consumed.push({item_ids:[e.race?'35':'36'],root:e.roots.join('|'),role:e.current,route:'PERSPECTIVE_C'});
  const add=(kind,mechanism,roots,items,reason,extra={})=>{
   const id=JSON.stringify([d.id,kind,mechanism,roots]);
   if(d.routes.some(x=>x.id===id))return;
   d.routes.push({id,kind,mechanism,state:'CONDITIONAL_HYPOTHESIS',root:null,roots:unique(roots),items,reason,formal:false,...extra});
   d.consumed.push({item_ids:items,root:unique(roots).join('|'),role:'CONDITIONAL_HYPOTHESIS',route:id});
  };
  // A historical placing in partially transferable conditions is a route
  // hypothesis, not a full-field strength or automatic penalty.
  for(const r of p.history){const x=row(r,d.id);if(!x||x.finish>3)continue;
   const s=scope(r.conditions,p.target.conditions);
   if(s.scope==='HISTORICAL_ONLY')continue;
   const position=facts(h,'58').some(f=>f.value.segment_positions?.some(z=>z.race_id===r.id));
   if(!position)continue;
   const roots=[resultRef(r.id,d.id),posRef(r.id,d.id)],reason='Observed result and position pattern; condition/field transfer and rival response unresolved.';
   add('PLACE','SCOPED_POSITION_PATTERN',roots,['02','58'],reason,{applicability:s,prior_race:r.id});
   if(x.finish===1)add('WIN','SCOPED_POSITION_PATTERN',roots,['02','58'],reason,{applicability:s,prior_race:r.id});
  }
  // No prior win required. A subject-specific placing and ahead comparison
  // allow a narrowly scoped alternative, never a whole-field guarantee.
  for(const e of comparisons.filter(e=>e.current==='CONDITIONAL_SUBJECT_EDGE')){
   const r=find(p,e.race),x=row(r,d.id);
   if(x.finish<=3)add('WIN','PAIRWISE_ALTERNATIVE',e.roots,['02','35'],'Observed placing ahead of a current rival; winning over the other rivals and condition transfer unproven.',{prior_race:r.id,applicability:e.scope});
  }
  for(const m of paths){
   const items=[...m.upstream_item_ids,'100',m.eye_id];
   add('PLACE',m.scenario_id,m.evidence_ids,items,'Recomputed item100 links a subject-specific conditional mechanism; not independent of original roots.',{mechanism_id:m.mechanism_id,applicability:m.applicability});
   if(m.win_attained||m.eye_id==='EYE-05')add('WIN',m.scenario_id,m.evidence_ids,items,'Conditional alternative based on observed subject performance; later peer win or prior win does not establish current victory.',{mechanism_id:m.mechanism_id,applicability:m.applicability});
  }
  d.winning_hypotheses=d.routes.filter(r=>r.kind==='WIN'&&r.state==='CONDITIONAL_HYPOTHESIS').map(r=>r.id);
  d.placing_hypotheses=d.routes.filter(r=>r.kind==='PLACE'&&r.state==='CONDITIONAL_HYPOTHESIS').map(r=>r.id);
  d.perspectives.B={...d.perspectives.B,conditional_paths:d.placing_hypotheses,scope:'SCOPED_HYPOTHESIS_NOT_CURRENT_STRENGTH'};
  d.perspectives.D={...d.perspectives.D,position_paths:d.routes.filter(r=>r.mechanism==='SCOPED_POSITION_PATTERN'||r.mechanism==='REPRODUCE_OBSERVED_ADVANCE').map(r=>r.id)};
  d.perspectives.E={status:paths.length?'SUPPORT':'UNKNOWN',linked_item:'100',mechanisms:paths.map(x=>x.mechanism_id),scope:'EYE_REINTERPRETATION_NOT_RAW_EVIDENCE'};
  d.comparisons={direct:comparisons,indirect};
  d.unique_derived_roots=unique(paths.flatMap(m=>m.evidence_ids));d.formal=false;
 }
 return result;
}
export function analyzeV18(initial,{reserve=[],disabled=[]}={}){
 check(initial);check({...initial,history:[...initial.history,...reserve]});
 const first=run(initial),before=decisions(initial,first);
 const discovery=discover(initial,reserve,first),p=discovery.expanded;
 const visible=discovery.disclosed.length?run(p):first;
 const mechanisms=buildMechanisms(p,visible,disabled);
 const final=runGenerated(p,{allowExternalPeers:true,versioned:true,mechanisms});
 const after=decisions(p,final),v1=version(initial),v2=version(p,mechanisms);
 const rawNew=final.evidence_index.filter(e=>!first.evidence_index.some(f=>f.evidence_id===e.evidence_id));
 const audit=after.map(d=>{
  const a=first.merged.find(h=>h.horse_id===d.id),b=final.merged.find(h=>h.horse_id===d.id);
  const led=final.ledger.filter(x=>x.horse===d.id);
  const prior=before.find(x=>x.id===d.id);
  return {id:d.id,items:led.map(l=>{
   const eye=l.item.startsWith('EYE-'),get=(c,h)=>eye?c.eye.find(e=>e.horse_id===d.id).items.find(e=>e.eye_item_id===l.item):h.items[l.item];
   const x=get(first,a),y=get(final,b);
   return {id:l.item,initial_hash:hash(x),final_hash:hash(y),changed:hash(x)!==hash(y),output_count:l.output_count,instrumented_reads:l.instrumented_reads,consumption:d.consumed.filter(c=>c.item_ids.includes(l.item)),missing:l.output_count===0,semantic_proof:'NOT_ESTABLISHED_BY_HASH'};
  }),before:{WIN:prior.winning_hypotheses,PLACE:prior.placing_hypotheses},after:{WIN:d.winning_hypotheses,PLACE:d.placing_hypotheses}};
 });
 return {initial_version:v1,final_version:v2,disclosed:discovery.disclosed,held:discovery.held,raw_new_evidence:rawNew,mechanisms,executed:{initial:first.executed_kernels,final:final.executed_kernels},trace:final.trace,audit,before,after,formal:false,release_eligible:false};
}
// Extend V16 seeded generator with variable historical/target fields,
// external rivals, distances and conditions. Crossing times are constructed
// consistently, then only the common input (not checkpoint proxies) is used.
export function heterogeneous(seed=20261127,{n=6,distance=1800,missing=true}={}){
 const base=generateV16(seed),c=structuredClone(base.target.conditions);
 c.distance_m=distance;c.layout='SYN-'+distance;c.first_corner_m=200;
 const ids=Array.from({length:n},(_,i)=>'FIXTURE-A'+(i+1)),ext='FIXTURE-Z1',ext2='FIXTURE-Z2';
 const entrants=ids.map((id,i)=>({id,runner:i+1,draw:i+1,kg:54,status:'ACTIVE'}));
 let z=seed>>>0;const rnd=k=>{z=(Math.imul(z,1664525)+1013904223)>>>0;return (z>>>16)%k;};
 const make=(i,order,conditions)=>{
  const m=conditions.distance_m/200,clocks=order.map(()=>[]);let elapsed=0;
  for(let j=0;j<m;j++){elapsed+=115+rnd(15);const shift=j===m-1?0:(j+1)%order.length;for(let k=0;k<order.length;k++)clocks[(k+shift)%order.length].push(elapsed+k*2);}
  const leader=Array.from({length:m},(_,j)=>Math.min(...clocks.map(x=>x[j])));
  const corners=[0,1,m-4,m-2];
  const rows=order.map((id,k)=>({id,runner:k+1,kg:54,finish:k+1,clock_tenths:clocks[k].at(-1),margin_tenths:k?clocks[k].at(-1)-leader.at(-1):null,final3f_tenths:clocks[k].at(-1)-clocks[k][m-4],corners:corners.map(j=>1+clocks.filter(a=>a[j]<clocks[k][j]).length)}));
  return {id:'SYN18-'+seed+'-'+i,date:'2026-10-'+String(i*3).padStart(2,'0'),start:'13:00',published:'13:20',conditions,field_count:order.length,full_result_rows:true,lap_kind:'synthetic_race_leader',lap_segment_m:Array(m).fill(200),lap_tenths:leader.map((x,j)=>x-(leader[j-1]??0)),rows};
 };
 const active=missing?ids.slice(0,-1):ids;
 const different={...c,distance_m:1400,layout:'SYN-1400',venue:'Synthetic Other Track',going:'重'};
 const history=[make(1,[active[0],ext,active[1],ext2],different),make(2,[ext,active[2],active[0],active[1]],c),make(3,[ext2,...active],c)];
 const reserve=[make(4,[ext,active[1],ext2],c)];
 const p={id:'HET18-'+seed,target:{...base.target,id:'SYN18-TARGET-'+seed,conditions:c,entrants},history};
 check({...p,history:[...history,...reserve]});return {p,reserve};
}

import {analyzeField100} from './analyze-field-100.mjs';
import {createHash} from 'node:crypto';
const sorted=v=>Array.isArray(v)?v.map(sorted):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
export const fingerprint=v=>createHash('sha256').update(JSON.stringify(sorted(v??null))).digest('hex');
const single=xs=>xs.length===1?xs[0]:null;
const copy=x=>structuredClone(x);
const nonempty=x=>typeof x==='string'&&x.length>0;
const conditions=f=>f.conditions_verified===true&&['course_id','course_version','track','surface','going','class_key','turn','layout','rule_version','eligibility'].every(k=>nonempty(f[k]))&&Number.isInteger(f.distance_m)&&f.distance_m>0;
// Structural research bridge only: the legacy gates receive an explicitly scoped adapter record,
// never a claim of official formal admission. No inference of class rules, gate or identity.
export function rebuildRankInputs({rankArgs,intake,boundRoster}){
 const args=copy(rankArgs),target=args.oppositionArgs.target;
 const groups=intake.accepted, eligible=new Set(boundRoster.filter(h=>h.active!==false&&h.horse_id).map(h=>h.horse_id));
 const cardFor=h=>single(groups.filter(g=>g.record.kind==='CURRENT_CARD'&&g.record.horse_id===h&&g.record.race_id===target.race_id&&g.record.runner_no===boundRoster.find(r=>r.horse_id===h)?.horse_no&&(!target.roster_version||g.record.fact.roster_version===target.roster_version)));
 const refs=[],evidence=new Map((args.evidence??[]).map(e=>[e.evidence_id,e]));
 const stamp=g=>{const r=g.record;return {evidence_id:r.evidence_id,horse_id:r.horse_id,race_id:r.race_id,runner_no:r.runner_no,source_id:r.source_id,source_url:r.source_url,source_ref:r.source_url,source_version:r.source_version,identity_status:'VERIFIED',source_verified:true,published_at:r.published_at_or_null,published_at_or_null:r.published_at_or_null,observed_at:r.observed_at,cutoff:r.cutoff,permission_status:r.permission_status,raw_sha256_or_null:r.raw_sha256_or_null,fact_or_proxy:'FACT',research_bridge_only:true}};
 const add=g=>{const e=stamp(g),old=evidence.get(e.evidence_id);if(old&&(old.horse_id!==e.horse_id||old.race_id!==e.race_id||old.source_version!==e.source_version||old.raw_sha256_or_null!==e.raw_sha256_or_null))return null;evidence.set(e.evidence_id,e);return e;};
 const bridgeConflicts=[];
 const upsert=(xs,ys,k)=>{const m=new Map((xs??[]).map(x=>[k(x),x]));for(const x of ys){const old=m.get(k(x));if(old){const critical=['finish','status','distance','course_id','course_version','class_key','surface','going','body_weight_kg','actual_gate','ordered_race_ids','results','positions'];const differences=critical.filter(p=>old[p]!=null&&x[p]!=null&&JSON.stringify(old[p])!==JSON.stringify(x[p]));if(differences.length){bridgeConflicts.push({key:k(x),fields:differences,old_evidence_id:old.evidence_id,new_evidence_id:x.evidence_id,status:'CONFLICT_PENDING_RECONCILIATION'});m.delete(k(x));continue;}m.set(k(x),{...old,...Object.fromEntries(Object.entries(x).filter(([,v])=>v!=null))});}else m.set(k(x),x);}return [...m.values()]};
 // Do not replace old runner evidence on an ambiguous/contradictory card.
 const newRoster=args.oppositionArgs.roster.map(h=>{const b=boundRoster.find(r=>r.horse_no===h.horse_no),g=b?.horse_id&&cardFor(b.horse_id);if(!b?.horse_id||!eligible.has(b.horse_id))return {...h,horse_id:null};if(!g)return h;const e=add(g);if(!e)return h;return {...h,...e,horse_no:h.horse_no,active:h.active};});
 args.oppositionArgs.roster=newRoster;
 const runs=[],histories=[],currents=[],gate=[],geo=[];
 for(const g of groups){
 const r=g.record,f=r.fact;
 if(r.kind==='RESULT'&&eligible.has(r.horse_id)&&conditions(f)&&['FINISHED','DNF_STARTED','DQ_STARTED'].includes(f.start_status)){
  const e=add(g);if(!e)continue;
  const p=single(groups.filter(x=>x.record.kind==='POSITIONS'&&x.record.horse_id===r.horse_id&&x.record.race_id===r.race_id&&x.record.event_at===r.event_at&&x.record.fact.field_size===f.field_size));
  const pe=p&&add(p),pf=pe?p.record.fact:null;
  const x={...f,...e,circuit:r.jurisdiction,started_at:r.event_at,local_date:new Date(Date.parse(r.event_at)+9*3600000).toISOString().slice(0,10),distance:f.distance_m,status:f.start_status==='FINISHED'?'FINISHED':f.start_status==='DNF_STARTED'?'DNF':'DQ',conditions_verified:true,final3f:f.final3f_tenths!=null?f.final3f_tenths/10:null,gap_winner:f.winner_gap_tenths!=null?f.winner_gap_tenths/10:null,positions:pf?.positions??[],first_segment:pf?.first_segment??null,segment_definition_verified:pf?.segment_definition_verified===true,all_segments_verified:pf?.all_segments_verified===true,expected_segments:pf?.expected_segments??null,position_evidence_id:pe?.evidence_id??null};
  // Position uses a separate source. The bridge retains both IDs and does not promote incomplete grids.
  runs.push(x);refs.push({kind:'RESULT_RUN',horse_id:r.horse_id,race_id:r.race_id,evidence_ids:[e.evidence_id,...(pe?[pe.evidence_id]:[])]});
 }
 if(r.kind==='HISTORY'&&eligible.has(r.horse_id)&&r.race_id===target.race_id&&f.chronology_verified===true&&Array.isArray(f.ordered_actual_start_race_ids)&&new Set(f.ordered_actual_start_race_ids).size===f.ordered_actual_start_race_ids.length){
  const e=add(g);if(e){histories.push({...e,chronology_verified:true,ordered_race_ids:f.ordered_actual_start_race_ids,immediate_prior_race_id:f.ordered_actual_start_race_ids[0],target_race_id:target.race_id});refs.push({kind:'HISTORY',horse_id:r.horse_id,evidence_ids:[e.evidence_id]});}
 }
 if(r.kind==='CURRENT_CARD'&&eligible.has(r.horse_id)&&cardFor(r.horse_id)===g){
  const e=add(g);if(e){currents.push({...f,...e,distance:f.distance_m,conditions_verified:conditions(f)});if(f.actual_gate_verified===true&&Number.isInteger(f.actual_gate))gate.push({...e,actual_gate_verified:true,gate:f.actual_gate});refs.push({kind:'CURRENT_CARD',horse_id:r.horse_id,evidence_ids:[e.evidence_id]});}
 }
 if(r.kind==='COURSE'&&r.horse_id===null&&r.race_id===target.race_id&&f.course_id&&f.course_version){const e=add(g);if(e)geo.push({...f,...e,circuit:r.jurisdiction,distance:f.distance_m,straight_length_m:f.home_straight_to_finish_m,elevation_m:f.elevation_range_m});}
 }
 // Only race-level full-field attestations with all actual result rows allow opposition aggregation.
 const full=[];
 for(const g of groups.filter(x=>x.record.kind==='RACE_FIELD')){
  const r=g.record,f=r.fact;
  if(r.race_id===target.race_id||!conditions(f)||f.complete_field_verified!==true||!Array.isArray(f.runner_ids)||new Set(f.runner_ids).size!==f.runner_ids.length||f.runner_ids.length!==f.field_size)continue;
  const rows=f.runner_ids.map(id=>single(groups.filter(q=>['RESULT','PEER_RESULT'].includes(q.record.kind)&&q.record.horse_id===id&&q.record.race_id===r.race_id&&q.record.event_at===r.event_at&&q.record.fact.field_size===f.field_size)));
  if(rows.some(x=>!x||!['FINISHED','DNF_STARTED','DQ_STARTED','EXCLUDED_NOT_STARTED','CANCELLED_NOT_STARTED'].includes(x.record.fact.start_status)))continue;
  const e=add(g);if(!e)continue;
  full.push({...f,...e,circuit:r.jurisdiction,started_at:r.event_at,distance:f.distance_m,class_verified:f.class_verified===true,results:rows.map(x=>({horse_id:x.record.horse_id,finish:x.record.fact.finish,status:x.record.fact.start_status==='FINISHED'?'FINISHED':x.record.fact.start_status==='DNF_STARTED'?'DNF':x.record.fact.start_status==='DQ_STARTED'?'DQ':'DNS'}))});refs.push({kind:'COMPLETE_FIELD',race_id:r.race_id,evidence_ids:[e.evidence_id,...rows.flatMap(x=>x.evidence_ids)]});
 }
 const rk=x=>x.horse_id+'|'+x.race_id,hk=x=>x.horse_id;
 args.oppositionArgs={...args.oppositionArgs,races:upsert(args.oppositionArgs.races,full,x=>x.circuit+'|'+x.race_id),histories:upsert(args.oppositionArgs.histories,histories,hk)};
 args.conditionMaterials={...args.conditionMaterials,runs:upsert(args.conditionMaterials?.runs,runs,rk),historyWitnesses:upsert(args.conditionMaterials?.historyWitnesses,histories,hk),geometry:upsert(args.conditionMaterials?.geometry,geo,x=>x.course_id+'|'+x.course_version)};
 args.paceMaterials={...args.paceMaterials,runs:upsert(args.paceMaterials?.runs,runs,rk),history:upsert(args.paceMaterials?.history,histories,hk),gates:upsert(args.paceMaterials?.gates,gate,hk),course:upsert(args.paceMaterials?.course,geo,x=>x.course_id)};
 args.stateMaterials={...args.stateMaterials,runs:upsert(args.stateMaterials?.runs,runs,rk),history:upsert(args.stateMaterials?.history,histories,hk),current:upsert(args.stateMaterials?.current,currents,hk)};
 args.changeMaterials={...args.changeMaterials,runs:upsert(args.changeMaterials?.runs,runs,rk),history:upsert(args.changeMaterials?.history,histories,hk),currentConditions:upsert(args.changeMaterials?.currentConditions,currents,hk)};
 args.evidence=[...evidence.values()];
 return {args,bridge_inputs:refs,bridge_conflicts:bridgeConflicts,version:fingerprint({args,events:groups.map(g=>[g.event_key,g.record.source_version,g.record.raw_sha256_or_null,g.record.fact])}),formal_admissions:0};
}
export function recomputeFullRank({rankArgs,intake,boundRoster,priorRank,traceRead=()=>{}}){
 const bridge=rebuildRankInputs({rankArgs,intake,boundRoster});
 const recalculated=analyzeField100({...bridge.args,runtimeTrace:e=>traceRead({...e,input_version:bridge.version})});
 const stageRanges=[[33,42,'analyzeOpposition33to42'],[43,57,'analyzeConditions43to57'],[58,77,'analyzePace58to77'],[78,92,'analyzeState78to92'],[93,99,'analyzeChanges93to100']];
 const rows=recalculated.audit.runners.map(h=>({horse_no:h.horse_no,horse_id:h.horse_id,items:h.items.filter(i=>Number(i.item_id)>=33&&Number(i.item_id)<=99).map(i=>{
 const before=priorRank.audit.runners.find(r=>r.horse_no===h.horse_no)?.items.find(x=>x.item_id===i.item_id);
 const changed=fingerprint(before?.finding)!==fingerprint(i.finding);
 return {item_id:i.item_id,function_name:stageRanges.find(([lo,hi])=>Number(i.item_id)>=lo&&Number(i.item_id)<=hi)[2],input_version:bridge.version,previous_output_hash:fingerprint(before?.finding),output_hash:fingerprint(i.finding),function_executed:true,changed,reason:changed?'RESEARCH_OUTPUT_CHANGED':i.analysis_status==='NO_OUTPUT'?'NO_ADMISSIBLE_NEW_OUTPUT':'SAME_OUTPUT_ON_REEXECUTION',status:i.analysis_status,final_consumption:false};
 })}));
 return {rank:recalculated,bridge_inputs:bridge.bridge_inputs,bridge_conflicts:bridge.bridge_conflicts,input_version:bridge.version,rows,all_stage_functions_executed:true,formal_admissions:0};
}

import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareGeminiV2} from './gemini-v2-intake.mjs';
import {runGeminiV2} from './gemini-v2-shared-replay.mjs';
const load=n=>readFileSync(new URL(n,import.meta.url));
const json=n=>JSON.parse(load(n));
const sha=x=>createHash('sha256').update(x).digest('hex');
const run=x=>runGeminiV2(Buffer.from(JSON.stringify(x)),{sharedRoutes:true,semanticV13:true});
const uniq=x=>[...new Set(x)].sort();
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function auditCorrectionVersions(old,next){
 if(old.prior_version_audit||!next.prior_version_audit)throw Error('CORRECTION_VERSION_ORDER');
 const a=prepareGeminiV2(old),b=prepareGeminiV2(next),changed=[];
 if(b.audit.length!==18||b.audit.some(x=>x.result_status!=='USABLE_FIXTURE_ONLY'||x.lap_status!=='USABLE_FIXTURE_ONLY'||x.corner_held.length)||b.races.reduce((s,r)=>s+r.results.length,0)!==166)throw Error('CORRECTED_INPUT_INCONSISTENT');
 if(!equal(old.peer_followups,next.peer_followups))throw Error('NON_CORRECTION_FOLLOWUP_CHANGED');
 for(const r of old.past_races){
  const n=next.past_races.find(x=>x.race_id===r.race_id);if(!n||r.subject_horse_id!==n.subject_horse_id||r.rows.length!==n.rows.length)throw Error('RACE_ID_CHANGED');
  for(const x of r.rows){
   const y=n.rows.find(z=>z.horse_id===x.horse_id);
   if(!y||!equal(Object.fromEntries(Object.entries(x).filter(([k])=>k!=='positions')),Object.fromEntries(Object.entries(y).filter(([k])=>k!=='positions'))))throw Error('NON_POSITION_ROW_CHANGED');
   x.positions.forEach((p,i)=>{if(p!==y.positions[i])changed.push({race_id:r.race_id,horse_id:x.horse_id,corner:i+1,old:p,new:y.positions[i]});});
  }
 }
 return {old_lap_holds:a.audit.filter(r=>r.lap_status==='HOLD').length,new_lap_holds:b.audit.filter(r=>r.lap_status==='HOLD').length,old_valid_corners:a.audit.reduce((s,r)=>s+r.corner_valid.length,0),new_valid_corners:b.audit.reduce((s,r)=>s+r.corner_valid.length,0),corner_points:b.races.reduce((s,r)=>s+4*r.results.length,0),changed_positions:changed,formal_admission:false};
}
export function workV13Diagnostics(){
 const w=json('./work-v13-candidate-index.json');
 if(w.formal_admissions!==0||w.permission!=='NOT_CLEARED')throw Error('WORK_SCOPE');
 const bad=w.time_audit.invalid_fields;
 if(bad.some(x=>x.verified_time!==null))throw Error('TIME_INVALIDATION_CONFLICT');
 // All downstream candidate uses get the same fail-closed timestamp resolver.
 const invalid=new Map(bad.map(x=>[x.sha256,x]));
 const timeGate=(filename,digest,reported)=>{const x=invalid.get(digest)??bad.find(x=>x.file===filename);return {reported:reported??null,verified_time:null,admitted:false,reason:x?'WORK13_TIMESTAMP_INVALIDATED':'ACQUISITION_NOT_INDEPENDENTLY_AUTHENTICATED'};};
 const invalidations=bad.map(x=>({file:x.file,sha256:x.sha256,count:x.count,...timeGate(x.file,x.sha256,x.reported)}));
 return {source_commit:w.source_commit,source_blobs:w.source_blobs,items:{
 '35':{profiles:w.jc.counts.profile_blocks,identity_matches:w.jc.counts.native_horse_verified,new_direct_candidates:w.jc.direct.length,admitted:0,hold:'CURRENT_AND_HISTORICAL_ID_ASOF'},
 '36':{candidate:w.jc.indirect,admitted:0,hold:'NO_TRANSITIVE_RANK'},
 '37':{old_later_rows:w.peer.prior_counts.distinct_later_horse_races,old_dom_matches:w.peer.counts.original_later_34_DOM_matches,new_later_candidates:w.peer.counts.new_later_profile_candidates,combined_total:null,profile_candidates:w.peer.counts.cumulative_profile_match_candidates,admitted:0,hold:'DEDUPE_ORIGINAL_ASOF_PERMISSION'},
 '38':{ratings_present:w.jc.counts.ratings_present,ratings_missing:w.jc.counts.ratings_not_listed,admitted:0,hold:'NATIVE_ID_RATING_EDITION_ASOF'},
 '85':{persons:w.jc.persons.filter(p=>p.role==='jockey'),admitted:0,hold:'PERSON_ID_AND_RESULT_ROWS'},
 '89':{persons:w.jc.persons.filter(p=>p.role==='trainer'),admitted:0,hold:'PERSON_ID_AND_RESULT_ROWS'},
 '13':{jra:w.benchmark.jra,local:w.benchmark.local,admitted:0,hold:'COURSE_RULE_VERSION_TIME_PERMISSION'}},invalidations,invalidated_fields:invalidations.reduce((n,x)=>n+x.count,0),all_downstream_verified_time:null,formal_admission:false};
}
const mapItems=h=>new Map(h.items.map(i=>[i.item_id,i]));
const state=i=>({outputs:i.actual_analysis_output.length,root_bound:i.structurally_bound_outputs,analysis_reads:i.runtime_consumers.filter(x=>x.consumer!=='observedRoutePropositions').length,route_reads:i.runtime_consumers.filter(x=>x.consumer==='observedRoutePropositions').length,synthesis_reads:i.synthesis_runtime_reads.length,unknowns:i.unknowns,execution:i.execution_state,formal:false});
const baseRoute=(h,k)=>h[k].find(p=>p.scenario_id==='CONDITION_MATCH_ONLY')?.research_propositions;
function routeSummary(p){if(!p)return null;return {families:p.route_families,leader_shape_families:p.leader_shape_families,leader_shape_unknowns:p.leader_shape_unknowns.map(x=>({race_id:x.race_id,code:x.code})),finish_support:p.finish_and_position_support.filter(x=>x.code.startsWith('RECORDED_CONDITION')).map(x=>x.race_id),finish_counter:p.finish_and_position_counter.filter(x=>x.code.startsWith('RECORDED_CONDITION')).map(x=>x.race_id),peer_support:p.peer_proposition_support.map(x=>[x.race_id,x.peer_id,x.later_race_id,x.peer_later_finish,x.prior_relation]),peer_counter:p.peer_proposition_counter.map(x=>[x.race_id,x.peer_id,x.later_race_id,x.peer_later_finish,x.prior_relation]),observations:p.historical_observations.map(x=>({race_id:x.race_id,finish:x.finish,first:x.first_corner,fourth:x.fourth_corner,pattern:x.position_pattern,early:x.early_position,lap:x.leader_windows,same:x.same_recorded_conditions})),unknowns:p.unknowns.map(x=>x.code),current_support_strength:null};}
const summary=h=>({horse_id:h.horse_id,win:routeSummary(baseRoute(h,'winning_paths')),place:routeSummary(baseRoute(h,'placing_paths'))});
const peerKey=f=>'fixture-v2:followup:'+f.peer_horse_id+'|'+f.race_id;
function semanticDiff(a,b){return b.runners.map(h=>{const x=a.runners.find(q=>q.horse_id===h.horse_id),old=summary(x),next=summary(h);return {horse_id:h.horse_id,before:old,after:next,finish_support_changed:!equal(old.win?.finish_support,next.win?.finish_support)||!equal(old.place?.finish_support,next.place?.finish_support),route_family_changed:!equal(old.win?.families,next.win?.families)||!equal(old.place?.families,next.place?.families),leader_shape_changed:!equal(old.win?.leader_shape_families,next.win?.leader_shape_families)||!equal(old.place?.leader_shape_families,next.place?.leader_shape_families),peer_proposition_changed:!equal(old.win?.peer_support,next.win?.peer_support)||!equal(old.win?.peer_counter,next.win?.peer_counter),current_strength_validated:false};});}
export function correctedReplayV13(){
 const old=json('./gemini-seven-v2-input-pinned.json'),corrected=json('./gemini-seven-v2-corrected-pinned.json'),audit=auditCorrectionVersions(old,corrected);
 const a=run(old),b=run(corrected);
 const lapAblation=structuredClone(corrected);const removedLapRace='FK-20260906-T06';lapAblation.past_races.find(r=>r.race_id===removedLapRace).reported_lap_kind=null;
 const withoutLap=run(lapAblation);
 const work=workV13Diagnostics();
 const prior=structuredClone(corrected);prior.peer_followups=[];
 const before=run(prior),discovered=new Set(b.runners.flatMap(h=>h.eye.items.filter(e=>e.eye_item_id==='EYE-05').flatMap(e=>e.mechanism_observations.flatMap(x=>x.evidence_ids??[]))));
 const selected=corrected.peer_followups.filter(f=>discovered.has(peerKey(f)));
 const returned=structuredClone(prior);returned.peer_followups=selected;
 const after=run(returned);
 const ablationInput=structuredClone(returned);ablationInput.peer_followups=selected.slice(1);const ablated=run(ablationInput);
 const ledger=b.runners.flatMap(h=>{const old=mapItems(a.runners.find(q=>q.horse_id===h.horse_id));return h.items.map(i=>({horse_id:h.horse_id,item_id:i.item_id,before:state(old.get(i.item_id)),after:state(i),output_changed:!equal(old.get(i.item_id).actual_analysis_output,i.actual_analysis_output),work_candidate_diagnostic:work.items[i.item_id]?{source_commit:work.source_commit,admitted:0,hold:work.items[i.item_id].hold,verified_time:null}:null,semantic_effect_scope:i.runtime_consumers.some(t=>t.consumer==='observedRoutePropositions')?'ROUTE_PROPOSITION_OR_CONTEXT_READ':'NOT_INDIVIDUALLY_PROVEN',formal_consumption:false}));});
 return {old:a,corrected:b,audit,version:{old_sha256:sha(load('./gemini-seven-v2-input-pinned.json')),corrected_sha256:sha(load('./gemini-seven-v2-corrected-pinned.json'))},ledger,semantic_delta:semanticDiff(a,b),eye_return:{selected_refs:selected.map(peerKey),all_roster_reexecuted:after.runners.map(h=>h.horse_id),before_after:semanticDiff(before,after),ablation:{removed_ref:selected[0]?peerKey(selected[0]):null,delta:semanticDiff(after,ablated)}},lap_ablation:{removed_race_id:removedLapRace,scope:'MEASUREMENT_KIND_WITHHELD_NO_SOURCE_VALUE_REWRITE',delta:semanticDiff(b,withoutLap),affected_shared_benchmark_rows:withoutLap.runners.filter(h=>!equal(h.items.find(i=>i.item_id==='69').actual_analysis_output,b.runners.find(r=>r.horse_id===h.horse_id).items.find(i=>i.item_id==='69').actual_analysis_output)).map(h=>h.horse_id)},work,formal_consumption:0,rank_candidate:null,eye_candidate:null};
}

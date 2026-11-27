import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareGeminiV2} from './gemini-v2-intake.mjs';
import {runGeminiV2} from './gemini-v2-shared-replay.mjs';
import {fingerprint} from './recompute-full-rank.mjs';
const load=n=>JSON.parse(readFileSync(new URL(n,import.meta.url)));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const sum=a=>a.reduce((n,x)=>n+x,0);
const unique=a=>[...new Set(a)];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const run=x=>runGeminiV2(Buffer.from(JSON.stringify(x)),{sharedRoutes:true});
export function correctionDiagnostics(raw,proposals=load('./gemini-v2-correction-proposals-pinned.json')){
 if(raw.prior_version_audit)throw Error('CORRECTED_VERSION_DO_NOT_REAPPLY');
 if(proposals.fixture_only!==true||proposals.formal_admission!==false||proposals.official_evidence!==false)throw Error('CORRECTION_SCOPE');
 const next=structuredClone(raw),base=prepareGeminiV2(raw);
 const lap=proposals.lap_proposals.map(p=>{
  const r=raw.past_races.find(x=>x.race_id===p.race_id),bound=!!r&&equal(r.reported_race_laps_tenths,p.old)&&r.reported_winner_clock_tenths===p.winner_tenths;
  const valid=bound&&p.new.length===p.old.length&&p.new.every(n=>Number.isInteger(n)&&n>0)&&sum(p.old)===p.old_sum&&sum(p.new)===p.new_sum;
  return {race_id:p.race_id,base_bound:bound,arithmetic_candidate:valid&&p.old_sum!==p.winner_tenths&&p.new_sum===p.winner_tenths,applied_to_analysis:false,lap_kind:r?.reported_lap_kind??null};
 });
 const positions=proposals.position_proposals.map(p=>{
  const rows=raw.past_races.find(r=>r.race_id===p.race_id)?.rows??[],matches=rows.filter(r=>r.horse_id===p.horse_id);
  return {race_id:p.race_id,horse_id:p.horse_id,base_bound:matches.length===1&&equal(matches[0].positions,p.old),applied:false};
 });
 const c=next.runners.find(h=>h.horse_id==='FIXTURE-C'),interval=base.holds.find(h=>h.scope==='INTERVAL'&&h.key===c?.horse_id);
 if(interval&&c.reported_interval_days===35&&interval.computed===31)c.reported_interval_days=31;
 const counts=next.target.reported_same_day_counts,day=base.dayAudit;
 if(counts.all_le4===19&&day.all_le4===22)counts.all_le4=day.all_le4;
 if(counts.at1400_le4===16&&day.at1400_le4===18)counts.at1400_le4=day.at1400_le4;
 const verified=prepareGeminiV2(next);
 return {next,base_hash:hash(raw),next_hash:hash(next),lap,positions,unresolved_lap_count:base.audit.filter(a=>a.lap_delta_tenths!==0).length-lap.filter(p=>p.arithmetic_candidate).length,lap_admissions:0,position_admissions:0,interval_correction:c.reported_interval_days===31&&!verified.holds.some(h=>h.scope==='INTERVAL'&&h.key===c.horse_id),day:verified.dayAudit,formal_admission:false};
}
export function workV12Diagnostics(){
 const w=load('./work-v12-candidate-index.json');
 if(w.formal_admissions!==0||w.permission!=='NOT_CLEARED')throw Error('WORK_SCOPE');
 return {source_commit:w.source_commit,source_blobs:w.source_blobs,items:{
 '35':{candidate_pairs:w.jc.comparison.unordered_pair_candidates,current_native_id_matches:w.jc.native_matches,admitted:0,hold:'CURRENT_ROSTER_ID_AND_ASOF'},
 '36':{admitted:0,hold:'COMMON_PEER_NOT_VALIDATED'},
 '37':{later_rows:w.peer_counts.distinct_later_horse_races,individual_dom_matches:w.peer_counts.later_result_dom_matches,missing:w.peer_counts.later_result_dom_missing,admitted:0,hold:'ORIGINAL_AND_TIME_PERMISSION'},
 '38':{observations:w.jc.ratings,admitted:0,hold:'RATING_SCOPE_ID_TIME'},
 '85':{observations:w.persons.observations.filter(p=>p.role==='jockey'),admitted:0,hold:'PERSON_RACE_BINDING'},
 '89':{observations:w.persons.observations.filter(p=>p.role==='trainer'),admitted:0,hold:'PERSON_RACE_BINDING'},
 '13':{jra:w.benchmark.jra,local:w.benchmark.local,admitted:0,hold:'COURSE_RULE_TIME_PERMISSION'}},formal_admission:false,ability_effect:null};
}
const evidenceKey=f=>'fixture-v2:followup:'+f.peer_horse_id+'|'+f.race_id;
const itemMap=h=>Object.fromEntries(h.items.map(i=>[i.item_id,i]));
// An independently supplied followup is withheld from baseline; only the EYE scan can return it.
export function stagedFixtureV12(raw){
 const corrections=correctionDiagnostics(raw),full=corrections.next;
 const prior=structuredClone(full);prior.peer_followups=[];
 const before=run(prior),scan=run(full);
 const discovered=new Set(scan.runners.flatMap(h=>h.eye.items.filter(e=>e.eye_item_id==='EYE-05').flatMap(e=>e.mechanism_observations.flatMap(x=>x.evidence_ids??[]))));
 const selected=full.peer_followups.filter(f=>discovered.has(evidenceKey(f)));
 const afterInput=structuredClone(prior);afterInput.peer_followups=selected;
 const after=run(afterInput);
 const compare=(a,b)=>b.runners.map(h=>{const old=a.runners.find(x=>x.horse_id===h.horse_id),m=itemMap(old);return {horse_id:h.horse_id,items:h.items.map(i=>({item_id:i.item_id,output_changed:fingerprint(m[i.item_id].actual_analysis_output)!==fingerprint(i.actual_analysis_output),unknowns_changed:fingerprint(m[i.item_id].unknowns)!==fingerprint(i.unknowns),formal_effect:null})),route_changed:fingerprint([old.winning_paths,old.placing_paths])!==fingerprint([h.winning_paths,h.placing_paths]),axis_changed:h.five_axis_findings.map(x=>({axis:x.axis,changed:fingerprint(x)!==fingerprint(old.five_axis_findings.find(a=>a.axis===x.axis))}))};});
 const first=selected[0],ablation=structuredClone(afterInput);
 if(first)ablation.peer_followups=ablation.peer_followups.filter(f=>evidenceKey(f)!==evidenceKey(first));
 const removed=first?run(ablation):null;
 return {before,after,correction_audit:{...corrections,next:undefined},work:workV12Diagnostics(),discovery:{selected_refs:unique(selected.map(evidenceKey)),not_returned_refs:full.peer_followups.filter(f=>!selected.includes(f)).map(evidenceKey),before_input_hash:hash(prior),after_input_hash:hash(afterInput),all_roster_reexecuted:after.runners.map(h=>h.horse_id),differences:compare(before,after),ablation:first?{removed_ref:evidenceKey(first),rerun_input_hash:hash(ablation),differences:compare(after,removed),scope:'ACTUAL_FULL_FIXTURE_RERUN_NOT_FORMAL_CAUSAL_EFFECT'}:null},formal_consumption:0,rank_candidate:null,eye_candidate:null};
}

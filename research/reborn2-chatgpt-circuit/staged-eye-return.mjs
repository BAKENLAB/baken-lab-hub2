import {abilityResearch115v3} from './analyze-field-115-v3.mjs';
import {fingerprint} from './recompute-full-rank.mjs';
import {inspectEvidence} from './evidence-semantics.mjs';
import {inspectEye15} from './eye-01-15.mjs';
import {readFileSync} from 'node:fs';
const catalog=JSON.parse(readFileSync(new URL('./catalog-115.json',import.meta.url),'utf8'));
const uniq=x=>[...new Set(x)].sort();
const marketKey=k=>/odds|popularity|market|tansho|ninki|人気|オッズ/i.test(k);
const rejectMarket=x=>{if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){if(marketKey(k))throw Error('MARKET_IN_ABILITY_INPUT');rejectMarket(v);}};
const canonicalEvents=i=>i.accepted.map(g=>({key:g.event_key,fact:g.record.fact})).sort((a,b)=>a.key.localeCompare(b.key));
const eventMap=i=>new Map(canonicalEvents(i).map(x=>[x.key,fingerprint(x.fact)]));
const itemFingerprint=x=>fingerprint({analysis_state:x.analysis_state,observed_output:x.observed_output,typed_output:x.typed_output,winning_placing_output:x.winning_placing_output,unknowns:x.unknowns});
export function stagedAbilityResearch({rankArgs,initialRecords=[],discoveredRecords=[]}){
 rejectMarket(rankArgs);rejectMarket(initialRecords);rejectMarket(discoveredRecords);
 const {target,roster}=rankArgs.oppositionArgs;
 const before=abilityResearch115v3({rankArgs,typedRecords:initialRecords});
 // New source packets are not visible to the first execution. The EYE scan sees both editions.
 const all=inspectEvidence({target,records:[...initialRecords,...discoveredRecords],sources:catalog.source_ids});
 const bound=roster.map(h=>({...h,horse_id:before.audit.runners.find(x=>x.horse_no===h.horse_no)?.horse_id??null}));
 const eyeScan=inspectEye15({target,roster:bound,rankAudit:before.rerun.rank.audit,intake:all,catalog:catalog.items});
 const found=new Set(eyeScan.flatMap(h=>h.items.flatMap(i=>i.original_event_keys)));
 const original=eventMap(before.prior.intake);
 const proposed=eventMap(all);
 const candidates=all.accepted.filter(g=>found.has(g.event_key)&&g.evidence_ids.some(id=>discoveredRecords.some(r=>r.evidence_id===id)));
 // Corrections or conflicts affecting old roots must be passed through the intake again even if no positive discovery exists.
 const initialIds=new Set(initialRecords.map(r=>r.evidence_id));
 const existingRoots=new Set(before.prior.intake.accepted.map(g=>g.event_key));
 const selectedIds=new Set(candidates.flatMap(g=>g.evidence_ids));
 for(const row of all.inspected){
  if(existingRoots.has(row.key)&&['CONFLICT','SUPERSEDED'].includes(row.stage)){
   for(const r of all.inspected.filter(x=>x.key===row.key))selectedIds.add(r.evidence_id);
  }
 }
 // A new singleton conflict can use a different timestamp/key. Keep it quarantined with the old row.
 const scope=r=>JSON.stringify([r.jurisdiction,r.race_id,r.horse_id,r.kind]);
 const conflictScopes=new Set(all.inspected.filter(r=>r.stage==='CONFLICT').map(r=>scope(r.record)));
 for(const r of all.inspected)if(conflictScopes.has(scope(r.record)))selectedIds.add(r.evidence_id);
 const returnedRecords=discoveredRecords.filter(r=>selectedIds.has(r.evidence_id)&&!initialIds.has(r.evidence_id));
 const finalRecords=[...initialRecords,...returnedRecords];
 const after=abilityResearch115v3({rankArgs,typedRecords:finalRecords});
 const final=eventMap(after.prior.intake);
 const added=[...final.keys()].filter(k=>!original.has(k)).sort();
 const removed=[...original.keys()].filter(k=>!final.has(k)).sort();
 const revised=[...final.keys()].filter(k=>original.has(k)&&original.get(k)!==final.get(k)).sort();
 const shared=[...found].filter(k=>original.has(k)&&final.has(k)&&original.get(k)===final.get(k)).sort();
 const rows=after.audit.runners.map(h=>({horse_no:h.horse_no,horse_id:h.horse_id,items:h.items.map(i=>{
 const old=before.audit.runners.find(r=>r.horse_no===h.horse_no)?.items.find(x=>x.item_id===i.item_id);
 return {item_id:i.item_id,before_hash:itemFingerprint(old),after_hash:itemFingerprint(i),changed:itemFingerprint(old)!==itemFingerprint(i),reexecuted:true,final_consumption:false};
 })}));
 const interpret=eyeScan.flatMap(h=>h.items.map(i=>{const old=before.eye.find(r=>r.horse_no===h.horse_no)?.items.find(x=>x.eye_item_id===i.eye_item_id);return {horse_no:h.horse_no,item_id:i.eye_item_id,before_hash:fingerprint(old?.observed_facts),scan_hash:fingerprint(i.observed_facts),changed:fingerprint(old?.observed_facts)!==fingerprint(i.observed_facts),shared_original_events:i.original_event_keys.filter(k=>shared.includes(k))};}));
 return {before,after,eyeScan,return_audit:{initial_input_hash:fingerprint({rankArgs,records:initialRecords}),final_input_hash:fingerprint({rankArgs,records:finalRecords}),before_actual_bridge_hash:before.rerun.input_version,after_actual_bridge_hash:after.rerun.input_version,before_semantic_hash:fingerprint(canonicalEvents(before.prior.intake)),after_semantic_hash:fingerprint(canonicalEvents(after.prior.intake)),added_original_events:added,removed_original_events:removed,revised_original_events:revised,shared_reinterpretations:shared,new_fact_count:added.length,revised_fact_count:revised.length,returned_record_ids:returnedRecords.map(x=>x.evidence_id).sort(),not_returned:discoveredRecords.filter(r=>!selectedIds.has(r.evidence_id)).map(r=>({evidence_id:r.evidence_id,reason:all.inspected.find(x=>x.evidence_id===r.evidence_id)?.stage??'NOT_OBSERVED_BY_EYE'})),interpretation_differences:interpret,per_horse:rows,reexecuted:true,final_consumption:0,formal_admissions:0},rank_candidate:null,eye_candidate:null,release_eligible:false};
}

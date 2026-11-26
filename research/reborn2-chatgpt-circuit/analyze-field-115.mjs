import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {analyzeField100} from './analyze-field-100.mjs';
import {inspectEvidence,historyDenominators} from './evidence-semantics.mjs';
import {inspectEye15,returnToRank} from './eye-01-15.mjs';
import {recomputeReturned} from './rank-return-recompute.mjs';
const pinned=JSON.parse(readFileSync(new URL('./catalog-115.json',import.meta.url),'utf8'));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const blocked=k=>/odds|popularity|market|tansho|ninki|人気|オッズ/i.test(k);
function rejectMarket(x){if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){if(blocked(k))throw Error('MARKET_IN_ABILITY_INPUT');rejectMarket(v);}}
export function validateDag(edges){
 const nodes=new Set(edges.flat()),adj=new Map([...nodes].map(x=>[x,[]]));
 for(const [a,b] of edges)adj.get(a).push(b);
 const visiting=new Set(),done=new Set();
 function walk(x){if(visiting.has(x))throw Error('DEPENDENCY_CYCLE');if(done.has(x))return;visiting.add(x);for(const y of adj.get(x))walk(y);visiting.delete(x);done.add(x);}
 for(const n of nodes)walk(n);return true;
}
// Execution stages, not a claim of complete intra-item dependency extraction.
export const stageEdges=[['typed_intake','rank100_v1'],['rank100_v1','eye15'],['typed_intake','eye15'],['eye15','return_registry'],['return_registry','rank_recompute_plan_v2'],['rank100_v1','audit115'],['eye15','audit115'],['rank_recompute_plan_v2','audit115'],['audit115','ability_snapshot'],['ability_snapshot','market_gate']];
export function abilityResearch115({rankArgs,typedRecords=[]}){
 rejectMarket(rankArgs);rejectMarket(typedRecords);
 validateDag(stageEdges);
 const {target,roster}=rankArgs.oppositionArgs;
 const intake=inspectEvidence({target,records:typedRecords,sources:pinned.source_ids});
 // Preserve the legacy result. Typed candidates are not auto-promoted to old verified flags.
 const rank=analyzeField100(rankArgs);
 const eye=inspectEye15({target,roster,rankAudit:rank.audit,intake,catalog:pinned.items});
 const returned=returnToRank({rankAudit:rank.audit,eyeRunners:eye,intake});
 const recomputed=recomputeReturned({intake,returned});
 for(const h of returned.runners){const r=recomputed.find(x=>x.horse_no===h.horse_no);h.actually_recomputed=r.recomputed_item_ids;h.still_pending_rank_items=r.still_pending_rank_items;}
 const runners=rank.audit.runners.slice().sort((a,b)=>a.horse_no-b.horse_no).map(h=>{
   const e=eye.find(x=>x.horse_no===h.horse_no),r=returned.runners.find(x=>x.horse_no===h.horse_no);
   const items=pinned.items.map(d=>{
    const x=d.id.startsWith('EYE-')?e.items.find(i=>i.eye_item_id===d.id):h.items.find(i=>i.item_id===d.id);
    if(!x)throw Error('ITEM_MISSING:'+d.id);
    const refs=x.evidence_ids??[],roots=[...new Set(intake.accepted.filter(g=>g.evidence_ids.some(id=>refs.includes(id))).map(g=>g.event_key))].sort();
    return {item_id:d.id,name:d.name,role:d.role,independent_vote:false,implementation:x.implementation??'INITIAL_RESEARCH_PRESENT',analysis_status:x.analysis_status??x.status,applicability:x.applicability??'UNRESOLVED',evidence_ids:refs,original_event_keys:roots,upstream_item_ids:d.upstream_rank_item_ids,actual_final_consumption:false,consumption_reason:'NO_APPROVED_DECISION_CONSUMER',analysis_validated:false,release_eligible:false,unknowns:x.unknowns??[]};
   });
   const direct=intake.accepted.filter(g=>g.record.horse_id===h.horse_id&&h.horse_id!==null&&g.record.kind==='RESULT').map(g=>g.record.fact);
   return {horse_no:h.horse_no,horse_id:h.horse_id,items,history_denominators:historyDenominators(direct),rank_candidate:null,eye_candidate:null,ability_eligible:null,return_plan:r,decision_status:'UNAPPROVED_RESEARCH'};
 });
 const coverage=Object.fromEntries(pinned.items.map(d=>[d.id,{target:roster.length,implemented:runners.filter(h=>h.items.find(i=>i.item_id===d.id).implementation==='INITIAL_RESEARCH_PRESENT').length,candidate_output:runners.filter(h=>['OUTPUT_CANDIDATE','CANDIDATE_OUTPUT'].includes(h.items.find(i=>i.item_id===d.id).analysis_status)).length,validated:0,consumed:0,release_eligible:0}]));
 const snapshot={race_id:target.race_id,cutoff:target.cutoff,runners:runners.map(h=>({horse_no:h.horse_no,horse_id:h.horse_id,rank_candidate:null,ability_eligible:null})),decision_status:'UNAPPROVED_RESEARCH',market_snapshot_version:null};
 const ability_digest=digest({snapshot,runners,eye,returned});
 return {rank,eye,returned,recomputed,intake,audit:{runners,coverage,actual_final_consumption:0,release_eligible:false},abilitySnapshot:{...snapshot,digest:ability_digest},release_eligible:false};
}

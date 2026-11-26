import {readFileSync} from 'node:fs';
import {abilityResearch115} from './analyze-field-115.mjs';
import {analyzeTyped01to32} from './typed-01-32.mjs';
import {inspectEye15,returnToRank} from './eye-01-15.mjs';
import {mergeTypedFinding} from './merge-typed-finding.mjs';
import {recomputeFullRank,fingerprint} from './recompute-full-rank.mjs';
import {bindResearchRoster,researchPathsV3,raceStructureV3} from './winning-race-structure-v3.mjs';
import {dependencyLedger,affectedItems} from './dependency-ledger.mjs';
import {auditOfficialPacket} from './official-packet-audit.mjs';
const pinned=JSON.parse(readFileSync(new URL('./catalog-115.json',import.meta.url),'utf8'));
const uniq=xs=>[...new Set(xs)].sort();
const array=x=>Array.isArray(x)?x:[];
const dedup=xs=>[...new Map(xs.map(x=>[fingerprint(x),x])).values()];
function combine({current,previous,typedItem,intake,corrections}){
 const c=Array.isArray(current.finding)?{facts:current.finding}:current.finding??{};
 const p=Array.isArray(previous?.finding)?{facts:previous.finding}:previous?.finding??{};
 // Recomputed facts remain current; earlier contrary/scenario findings are retained as unresolved history.
 const item={...current,finding:{...c,facts:array(c.facts),hypotheses:dedup([...array(c.hypotheses),...array(p.hypotheses)]),counterevidence:dedup([...array(c.counterevidence),...array(p.counterevidence)]),unknowns:uniq([...array(c.unknowns),...array(p.unknowns)])}};
 return {...mergeTypedFinding({item,typedItem,intake,corrections}),previous_finding_hash:fingerprint(previous?.finding),previous_finding_preserved_in_prior:true};
}
export function abilityResearch115v3({rankArgs,typedRecords=[]}){
 const prior=abilityResearch115({rankArgs,typedRecords});
 const {target,roster}=rankArgs.oppositionArgs;
 const intake=prior.intake, bound=bindResearchRoster({target,roster,rankAudit:prior.rank.audit,intake});
 const ledger=dependencyLedger(pinned.items);
 const version=fingerprint({rankArgs,target,roster:bound,events:intake.accepted.map(g=>[g.event_key,g.record.source_version,g.record.raw_sha256_or_null,g.record.fact])});
 const reads=[];let stage='typed_initial',stageVersion=version;
 const traceRead=e=>{reads.push({sequence:reads.length+1,stage,input_version:e.input_version??stageVersion,horse_no:e.horse_no,source_item_id:e.item_id,consumer_item_id:e.consumer_item_id??null,consumer_function:e.consumer,output_hash:fingerprint(e.value),reason:e.reason,read_kind:'EXECUTED_ANALYSIS_OUTPUT_READ',decision_effect:'RESEARCH_ONLY_NOT_FINAL',final_consumption:false});};
 const corrections=intake.accepted.flatMap(g=>array(g.superseded_evidence_ids).map(id=>{const w=g.record.correction_witness;return {old_evidence_id:id,new_evidence_id:g.record.evidence_id,old_raw_sha256:w.old_raw_sha256,old_source_version:w.old_source_version};}));
 const typedInitial=analyzeTyped01to32({target,roster:bound,intake,traceRead});
 const merge=(rank,typed)=>({...rank.audit,runners:rank.audit.runners.map(h=>{
 const b=bound.find(x=>x.horse_no===h.horse_no),t=typed.find(x=>x.horse_no===h.horse_no),p=prior.rank.audit.runners.find(x=>x.horse_no===h.horse_no);
 return {...h,horse_id:b.horse_id,items:h.items.map(i=>{
 if(!b.horse_id)return {...i,horse_id:null,finding:{facts:[],hypotheses:[],counterevidence:[],unknowns:b.identity_unknowns},evidence_ids:[],analysis_status:'NO_OUTPUT',unknowns:b.identity_unknowns};
 return combine({current:i,previous:p?.items.find(x=>x.item_id===i.item_id),typedItem:t.items[i.item_id],intake,corrections});
 })};})});
 stage='eye_discovery';const initialAudit=merge(prior.rank,typedInitial);
 const initialEye=inspectEye15({target,roster:bound,rankAudit:initialAudit,intake,catalog:pinned.items,traceRead});
 const initialReturn=returnToRank({rankAudit:initialAudit,eyeRunners:initialEye,intake});
 // The intake already contains the EYE-visible facts; select their original event roots rather than fabricate a second source.
 const discoveredRoots=uniq(initialEye.flatMap(h=>h.items.flatMap(i=>i.original_event_keys)));
 const returnVersion=fingerprint({base_version:version,returned_original_events:discoveredRoots});
 stageVersion=returnVersion;stage='rank_reexecution';
 const rerun=recomputeFullRank({rankArgs,intake,boundRoster:bound,priorRank:prior.rank,traceRead});
 stage='typed_reexecution';const typed=analyzeTyped01to32({target,roster:bound,intake,traceRead});
 const merged=merge(rerun.rank,typed);
 stage='eye_reinspection';const eye=inspectEye15({target,roster:bound,rankAudit:merged,intake,catalog:pinned.items,traceRead});
 const returned=returnToRank({rankAudit:merged,eyeRunners:eye,intake});
 stage='current_path_research';const winning=researchPathsV3({target,roster:bound,intake,typedAnalysis:typed,pace:rerun.rank.pace,traceRead});
 const structure=raceStructureV3({target,roster:bound,winning,intake});
 const changed=uniq([...initialReturn.runners.flatMap(x=>x.rerun_required_rank_items),...prior.returned.runners.flatMap(x=>x.rerun_required_rank_items)]);
 const affected=affectedItems(ledger,changed);
 const audit=bound.map(h=>{
 const row=merged.runners.find(r=>r.horse_no===h.horse_no),ey=eye.find(r=>r.horse_no===h.horse_no),p=winning.runners.find(r=>r.horse_no===h.horse_no),t=typed.find(r=>r.horse_no===h.horse_no);
 const items=pinned.items.map(d=>{
 const isEye=d.id.startsWith('EYE-'),x=isEye?ey.items.find(i=>i.eye_item_id===d.id):row.items.find(i=>i.item_id===d.id);
 const re=rerun.rows.find(r=>r.horse_no===h.horse_no)?.items.find(i=>i.item_id===d.id);
 const observed=isEye?x.observed_facts.length:array(x.finding?.facts).length+array(x.finding?.hypotheses).length+array(x.finding?.counterevidence).length;
 const actualReads=reads.filter(q=>q.horse_no===h.horse_no&&q.source_item_id===d.id);
 const state=h.active===false?'NOT_APPLICABLE':!h.horse_id?'IDENTITY_HOLD':x.implementation==='MISSING'?'NOT_IMPLEMENTED':x.applicability==='CANDIDATE_NOT_APPLICABLE'?'APPLICABILITY_UNVALIDATED':!observed?'NOT_OBSERVED':'RESEARCH_OUTPUT_NOT_VALIDATED';
 return {item_id:d.id,name:d.name,horse_no:h.horse_no,horse_id:h.horse_id,input_version:re?.input_version??returnVersion,analysis_state:state,execution_state:re?'FUNCTION_REEXECUTED':isEye?'EYE_REEXECUTED':d.id==='100'?'PATH_RESEARCH_EXECUTED':'TYPED_OVERLAY_REEXECUTED',reexecution:re??null,observed_output_count:observed,observed_output:isEye?x.observed_facts:x.finding,merge_audit:x.merge_audit??null,typed_output:t.items[d.id]?.observations??[],winning_placing_output:d.id==='100'?p:null,evidence_ids:x.evidence_ids??[],actual_runtime_reads:actualReads,actual_runtime_read_count:actualReads.length,consumption_state:actualReads.length?'RESEARCH_OUTPUT_READ_NOT_FINAL':'NOT_CONSUMED',neutrality_state:'NOT_ESTABLISHED',validation_state:'NOT_VALIDATED',final_consumption:false,release_eligible:false,unknowns:uniq([...(x.unknowns??[]),...(h.identity_unknowns??[])])};
 });
 return {horse_no:h.horse_no,horse_id:h.horse_id,active:h.active!==false,identity_status:h.identity_status,unknowns:h.identity_unknowns,items,rank_candidate:null,eye_candidate:null};
 });
 return {prior,initialEye,initialReturn,rerun,typed,eye,returned,winning,structure,dependency:{...ledger,affected,actual_read_edges:reads,actual_stage_order:['typed_initial','eye_discovery','rank_reexecution','typed_reexecution','eye_reinspection','current_path_research','audit'],full_runtime_dependency_extraction:false},audit:{runners:audit,final_consumption:0},official_packet:auditOfficialPacket({target,roster:bound,intake}),evidence_version:version,return_version:returnVersion,rank_candidate:null,eye_candidate:null,release_eligible:false};
}

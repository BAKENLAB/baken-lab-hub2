import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {abilityResearch115} from './analyze-field-115.mjs';
import {analyzeTyped01to32} from './typed-01-32.mjs';
import {inspectEye15,returnToRank} from './eye-01-15.mjs';
import {researchWinningPaths,researchRaceStructure} from './winning-race-structure.mjs';
import {dependencyLedger,affectedItems} from './dependency-ledger.mjs';
const pinned=JSON.parse(readFileSync(new URL('./catalog-115.json',import.meta.url),'utf8'));
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
export function abilityResearch115v2({rankArgs,typedRecords=[]}){
 const prior=abilityResearch115({rankArgs,typedRecords});
 const {target,roster}=rankArgs.oppositionArgs;
 // Unverified runner identity is not silently replaced with the roster string.
 const boundRoster=roster.map(h=>({...h,horse_id:prior.rank.audit.runners.find(r=>r.horse_no===h.horse_no)?.horse_id??null}));
 const ledger=dependencyLedger(pinned.items);
 const typed=analyzeTyped01to32({target,roster:boundRoster,intake:prior.intake});
 // Versioned second pass: new typed facts are actually recomputed for all runners.
 // Existing evidence is retained; legacy candidate output remains explicitly separate.
 const merged={...prior.rank.audit,runners:prior.rank.audit.runners.map(h=>{
 const t=typed.find(x=>x.horse_no===h.horse_no);
 return {...h,items:h.items.map(i=>{
 const x=t.items[i.item_id];if(!x?.observations.length)return i;
 return {...i,analysis_status:'OUTPUT_CANDIDATE',finding:{facts:x.observations.map(o=>({value:o.value,evidence_ids:o.evidence_ids})),hypotheses:[],counterevidence:[],unknowns:x.unknowns},evidence_ids:[...new Set(x.observations.flatMap(o=>o.evidence_ids))].sort(),typed_v2:true};
 })};})};
 const eye=inspectEye15({target,roster:boundRoster,rankAudit:merged,intake:prior.intake,catalog:pinned.items});
 const returned=returnToRank({rankAudit:merged,eyeRunners:eye,intake:prior.intake});
 const winning=researchWinningPaths({target,roster:boundRoster,intake:prior.intake,typedAnalysis:typed,pace:prior.rank.pace});
 const structure=researchRaceStructure({target,roster:boundRoster,winning,intake:prior.intake});
 const version=hash({target,events:prior.intake.accepted.map(g=>({key:g.event_key,fact:g.record.fact}))});
 const changed=[...new Set(prior.returned.runners.flatMap(h=>h.rerun_required_rank_items))];
 const affected=affectedItems(ledger,changed);
 const audit=prior.audit.runners.map(h=>{
 const t=typed.find(r=>r.horse_no===h.horse_no),e=eye.find(r=>r.horse_no===h.horse_no),p=winning.runners.find(r=>r.horse_no===h.horse_no);
 const items=h.items.map(i=>{
 const typedItem=t.items[i.item_id],eyeItem=e.items.find(x=>x.eye_item_id===i.item_id);
 const outputs=typedItem?.observations??eyeItem?.observed_facts??[];
 const pathUses=(p?.winning_paths??[]).concat(p?.placing_paths??[]).filter(q=>q.upstream_item_ids?.includes(i.item_id)&&q.evidence_ids?.some(id=>outputs.some(o=>o.evidence_ids?.includes(id))));
 const downstream=Object.entries(t.items).flatMap(([id,x])=>x.observations.filter(o=>o.upstream_item_ids?.includes(i.item_id)&&o.evidence_ids.some(e=>outputs.some(q=>q.evidence_ids?.includes(e)))).map(o=>({consumer:id,kind:o.kind,evidence_ids:o.evidence_ids})));
 const eyeUses=e.items.flatMap(x=>x.observed_facts.filter(o=>o.upstream_item_ids?.includes(i.item_id)&&o.evidence_ids?.some(id=>outputs.some(q=>q.evidence_ids?.includes(id)))).map(o=>({consumer:x.eye_item_id,kind:o.type,evidence_ids:o.evidence_ids})));
 const uses=[...downstream,...eyeUses,...pathUses.map(q=>({consumer:'100_RESEARCH_PATH',path_id:q.path_id,evidence_ids:q.evidence_ids}))];
 const is100=i.item_id==='100';
 return {...i,evidence_version:version,typed_v2_executed:!!typedItem,typed_v2_output:outputs,planned_affected_by_return:affected.includes(i.item_id),actual_research_links:uses,actual_research_link_count:uses.length,final_consumption:false,winning_placing_output:is100?{winning_paths:p?.winning_paths??[],placing_paths:p?.placing_paths??[]}:null,unknowns:[...new Set([...(i.unknowns??[]),...(typedItem?.unknowns??[]),...(eyeItem?.unknowns??[])])]};
 });
 return {...h,items,final_rank:null};
 });
 const scope=ledger.items.map(d=>({item_id:d.id,planned_execution_order:d.planned_order,all_field_rows:audit.length,actual_typed_outputs:audit.filter(h=>h.items.find(i=>i.item_id===d.id).typed_v2_output.length).length,observed_research_links:audit.reduce((n,h)=>n+h.items.find(i=>i.item_id===d.id).actual_research_link_count,0),actual_final_consumption:0}));
 return {prior,typed,eye,returned,winning,structure,dependency:{...ledger,affected_after_return:affected,actual_stage_order:['legacy115','typed01to32_all_field_v2','eye15_v2','return_registry_v2','winning_placing_paths','race_structure','audit115_v2'],unrecomputed_affected:affected.filter(id=>Number(id)>32&&!id.startsWith('EYE-')&&id!=='100')},audit:{runners:audit,scope,final_consumption:0},evidence_version:version,rank_candidate:null,eye_candidate:null,release_eligible:false};
}

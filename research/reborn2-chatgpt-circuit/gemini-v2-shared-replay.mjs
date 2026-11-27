// Shared analysis kernels with a separate, nonofficial observation contract.
import {researchWinningPathsFixture,researchRaceStructure} from './winning-race-structure.mjs';
import {leaderWindows} from './route-observations-v13.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {prepareGeminiV2} from './gemini-v2-intake.mjs';
import {analyzeTyped01to32} from './typed-01-32.mjs';
import {analyzeOpposition33to42Fixture} from './opposition-33-42.mjs';
import {analyzeConditions43to57Fixture} from './conditions-43-57.mjs';
import {analyzePace58to77Fixture} from './pace-58-77.mjs';
import {analyzeState78to92Fixture} from './state-78-92.mjs';
import {analyzeChanges93to100Fixture} from './changes-93-100.mjs';
import {inspectEye15} from './eye-01-15.mjs';
import {deriveResearchV5,abilityResearch115v5} from './derive-research-v5.mjs';
import {dependencyLedger} from './dependency-ledger.mjs';
import {fingerprint} from './recompute-full-rank.mjs';
const defs=JSON.parse(readFileSync(new URL('./analysis-contract-115-v5.json',import.meta.url))).items;
const dep=dependencyLedger(defs);
const uniq=x=>[...new Set(x)];
const arr=x=>Array.isArray(x)?x:[];
const item=(r,id)=>r.items[id]??={facts:[],hypotheses:[],counterevidence:[],unknowns:[],effect:'NO_RECORDED_USE'};
const add=(r,id,value,refs,kind='facts')=>item(r,id)[kind].push({value,evidence_ids:uniq(refs.filter(Boolean)),fixture_only:true,formal_admission:false});
const scope=['course_id','course_version','distance_m','surface','going','class_key'];
const exact=(a,b)=>scope.every(k=>a?.[k]!=null&&a[k]===b?.[k]);
const fval=i=>[...arr(i?.facts),...arr(i?.hypotheses),...arr(i?.counterevidence)];
const gradeKeys=['odds','popularity','market','rank_candidate','expected_rank','support_asserted'];
function rejectInput(x){if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){if(gradeKeys.includes(k))throw Error('FORBIDDEN_EXPECTATION_OR_MARKET');rejectInput(v);}}
export function runGeminiV2(bytes,{sharedRoutes=false,semanticV13=false}={}){
 const raw=JSON.parse(bytes);rejectInput(raw);
 const p=prepareGeminiV2(raw),{target,roster,evidence,intake,runs,races,histories,current,gates,geometry,followups,holds}=p;
 let ordinary;
 try{abilityResearch115v5({rankArgs:{oppositionArgs:{target,roster}},initialRecords:[],discoveredRecords:[]});ordinary='UNEXPECTED';}catch(e){ordinary=e.message;}
 if(ordinary==='UNEXPECTED')throw Error('OFFICIAL_ENTRY_ACCEPTED_FIXTURE');
 const traces=[],traceRead=x=>traces.push({...x,fixture_only:true,formal_consumption:false});
 const typed=analyzeTyped01to32({target,roster,intake,traceRead});
 const opposition=analyzeOpposition33to42Fixture({target,roster,races,histories});
 const conditions=analyzeConditions43to57Fixture({target,roster,runs,historyWitnesses:histories.map(h=>({...h,ordered_race_ids:h.ordered_race_ids.slice().reverse()})),draws:gates});
 const paceTarget=semanticV13?{...target,early_segment_m:600}:target;
 const lapBenchmarks=semanticV13?intake.accepted.filter(g=>g.record.kind==='RACE_LAPS').flatMap(g=>{const r=races.find(r=>r.race_id===g.record.race_id),v=leaderWindows(g.record.fact.splits);return r&&v?.early600_tenths!=null?[{...r,evidence_id:g.evidence_ids[0],early_segment_m:600,early_seconds:v.early600_tenths/10,race_level_only:true}]:[];}):[];
 const pace=analyzePace58to77Fixture({target:paceTarget,roster,evidence,runs,history:histories,gates,course:geometry,paceBenchmarks:lapBenchmarks});
 const badInterval=new Set(holds.filter(h=>h.scope==='INTERVAL').map(h=>h.key));
 const state=analyzeState78to92Fixture({target,roster,evidence,runs,history:histories.filter(h=>!badInterval.has(h.horse_id)),current});
 const before=[];
 const sections=[opposition,conditions,pace,state];
 for(const h of roster){
  const t=typed.find(x=>x.horse_id===h.horse_id);
  const items=Object.fromEntries(Object.entries(t.items).map(([id,i])=>[id,{facts:i.observations.map(o=>({value:o.value,evidence_ids:o.evidence_ids,typed_kind:o.kind})),hypotheses:[],counterevidence:[],unknowns:i.unknowns,effect:'NO_RECORDED_USE'}]));
  for(const section of sections)Object.assign(items,section.runners.find(x=>x.horse_no===h.horse_no).items);
  const row={horse_no:h.horse_no,horse_id:h.horse_id,items},card=h.evidence_id,z=h.raw;
  const own=runs.filter(r=>r.horse_id===h.horse_id).sort((a,b)=>b.local_date.localeCompare(a.local_date));
  for(const f of followups.filter(f=>f.subject_horse_id===h.horse_id))add(row,'37',{prior_race_id:f.prior_race_id,peer_id:f.peer_horse_id,own_finish:f.subject_finish,peer_prior_finish:f.prior_peer_finish,peer_finish:f.finish,later_race_id:f.race_id,later_date:f.date,publication_local:f.publication_local,shared_followup_key:f.peer_horse_id+'|'+f.race_id,source_availability:'FICTIONAL_LINKED_PARTIAL_NO_FULL_FIELD',current_strength:null},[f.evidence_id,f.prior_evidence_id,'fixture-v2:result:'+f.prior_race_id+':'+h.horse_id]);
  const linked=followups.filter(f=>f.subject_horse_id===h.horse_id);
  if(linked.length){const i=item(row,'37');i.unknowns=i.unknowns.filter(s=>s!=='NO_ADMITTED_ANALYSIS_FACT').map(s=>linked.some(f=>s==='PEER_FOLLOWUP_MISSING:'+f.prior_race_id+':'+f.peer_horse_id)?s.replace('PEER_FOLLOWUP_MISSING','FULL_FIELD_FOLLOWUP_MISSING'):s);}
  if(own.length){add(row,'33',{observed_class_keys:uniq(own.map(r=>r.class_key)),formal_rule_version:null,empirical_level:null},own.map(r=>r.evidence_id));const last=own[0];add(row,'39',{prior_class_key:last.class_key,target_class_key:target.class_key,formal_transition:null},[last.evidence_id,card]);}
  if(Number.isFinite(z.weight_kg)&&z.weight_kg>0)add(row,'54',{reported_current_assigned_weight_kg:z.weight_kg,prior_weight_comparison:own.length?own.map(r=>({race_id:r.race_id,kg:r.weight_kg})):[],weight_effect:null},[card,...own.map(r=>r.evidence_id)]);
  if(z.reported_transfer_first===true)add(row,'42',{reported_transfer_first:true,previous_identity:null,transfer_level:null},[card],'hypotheses');
  if(Number.isInteger(z.age)&&z.sex)add(row,'91',{reported_age:z.age,reported_sex:z.sex,birth_date:null,stage_effect:null},[card]);
  if(z.sire_label)add(row,'90',{sire_label:z.sire_label,damsire_label:z.damsire_label??null,registered_ids:null,cohort:null},[card],'hypotheses');
  if(z.transport_narrative)add(row,'92',{reported_text:z.transport_narrative,actual_transport_verified:false,duration_minutes:null,effect:null},[card],'hypotheses');
  if(z.gear_narrative)add(row,'84',{reported_text:z.gear_narrative,official_change:null,effect:null},[card]);
  if(z.workout_records?.length)add(row,'83',{reported_sessions:z.workout_records,measurement_verified:false,fitness_conclusion:null},[card]);
  for(const [id,k] of [['85','jockey_registration'],['89','trainer_registration']]){
   const x=z[k];if(!x)continue;
   const n=x.denominator,w=x.wins,top=x.top3;
   const valid=Number.isInteger(n)&&n>0&&Number.isInteger(w)&&Number.isInteger(top)&&0<=w&&w<=top&&top<=n;
   if(valid)add(row,id,{issuer:x.issuer,id:x.id,reported_text:x.reported_stats,period:x.period,denominator:n,reported_wins:w,reported_top3:top,win_share:w/n,top3_share:top/n,raw_rows:null,metric_definition_conflict:x.reported_stats.includes('複勝')?'TEXT_TOP3_SEMANTICS_NOT_VERIFIED':null,adjusted_effect:null},[card]);
  }
  if(z.jockey_registration?.denominator&&z.jockey_registration.reported_stats.includes('C2ダ1400m'))add(row,'86',{reported_scope:'C2ダ1400m',registration:z.jockey_registration,course_effect:null},[card]);
  if(badInterval.has(h.horse_id)){const q=holds.find(x=>x.scope==='INTERVAL'&&x.key===h.horse_id);for(const id of ['78','79','80'])item(row,id).unknowns.push('INTERVAL_CONFLICT:'+q.reported+' vs '+q.computed);}
  if(Number.isFinite(z.current_body_weight_kg)&&Number.isFinite(z.reported_body_weight_delta_kg))add(row,'81',{reported_current_kg:z.current_body_weight_kg,reported_delta_kg:z.reported_body_weight_delta_kg,previous_weight_observed:null,delta_verified:false},[card]);
  // Within a recorded condition, compare nonadjacent observations without declaring improvement or a baseline residual.
  for(let i=0;i<own.length;i++)for(let j=i+1;j<own.length;j++){const a=own[i],b=own[j];if(exact(a,b))add(row,'32',{type:'RECORDED_CONDITION_PAIR',latest:a.race_id,earlier:b.race_id,clock_difference_tenths:a.clock_tenths-b.clock_tenths,final3f_difference_tenths:a.final3f_tenths-b.final3f_tenths,finish_difference:a.finish-b.finish,gap_difference_tenths:a.winner_gap_tenths-b.winner_gap_tenths,formal_conditions_comparable:false,ability_change:null},[a.evidence_id,b.evidence_id]);}
  const rejected=holds.filter(x=>x.scope==='RACE_LAPS'&&own.some(r=>r.race_id===x.key));
  for(const q of rejected)item(row,'19').unknowns.push('HELD_LAP:'+q.key);
  for(const q of holds.filter(x=>x.scope==='POSITION_SEGMENTS'&&own.some(r=>r.race_id===x.key)))for(const id of ['17','18','21','22','58','59','60'])item(row,id).unknowns.push('HELD_POSITION_SEGMENTS:'+q.key+':'+q.held_corners.join(','));
  for(const id of ['76','77'])item(row,id).unknowns.push('DAY_TOP3_PARTIAL_AND_PUBLICATION_MISSING');
  before.push(row);
 }
 const upstream=before.flatMap(h=>Object.entries(h.items).map(([id,i])=>({horse_id:h.horse_id,item_id:id,evidence_ids:uniq(fval(i).flatMap(x=>x.evidence_ids)),source_cutoff:target.cutoff,analysis_status:fval(i).length?'OUTPUT_CANDIDATE':'UNKNOWN'})));
 const changes=analyzeChanges93to100Fixture({target,roster,evidence,runs,history:histories,currentConditions:current,upstream,traceRead});
 const commonWinning=sharedRoutes?researchWinningPathsFixture({target,roster,intake,typedAnalysis:typed,pace,traceRead,semanticV13,analysisRows:before.map(h=>({...h,items:{...h.items,...changes.runners.find(x=>x.horse_no===h.horse_no).items}}))}):null;
 const rankRunners=before.map(h=>{Object.assign(h.items,changes.runners.find(x=>x.horse_no===h.horse_no).items);
 const incident=fval(h.items['26']),scenario=[...fval(h.items['65']),...fval(h.items['70'])];
 if(incident.length&&scenario.length){for(const id of ['26','65','70'])if(fval(h.items[id]).length)traceRead({consumer:'fixtureRecurrenceContext',consumer_item_id:'96',horse_no:h.horse_no,item_id:id,value:h.items[id],reason:'Ruling context and present scenario prerequisites, no causal resolution'});add(h,'96',{prior_incident_context:incident.map(x=>x.value),current_scenario_context:scenario.map(x=>x.value),causal_loss:null,recurrence_resolution:null,materiality:'UNVALIDATED'},[...incident,...scenario].flatMap(x=>x.evidence_ids),'hypotheses');}
 const o=roster.find(x=>x.horse_id===h.horse_id),own=runs.filter(r=>r.horse_id===h.horse_id).sort((a,b)=>b.local_date.localeCompare(a.local_date));
 const currentRun=current.find(x=>x.horse_id===h.horse_id);
 const partial=own.filter(r=>exact(r,currentRun));
 const other=own.filter(r=>!exact(r,currentRun));
 const path=k=>{const pred=r=>Number.isInteger(r.finish)&&r.finish>=1&&(k==='WIN'?r.finish===1:r.finish<=3);return {path_id:h.horse_id+'|RECORDED_KEYS|'+k,horse_id:h.horse_id,scenario_id:'CONDITION_MATCH_ONLY',route_kind:k,historical_support:own.map(r=>({race_id:r.race_id,finish:r.finish,evidence_ids:[r.evidence_id]})),opponent_comparison:[],counterevidence:{nonmatching_history:other.map(r=>({race_id:r.race_id,finish:r.finish,condition_delta:scope.filter(s=>r[s]!==currentRun[s]),evidence_ids:[r.evidence_id]}))},comparison_coverage:{target_peer_count:target.field_size-1,unknown_peer_ids:roster.filter(q=>q.horse_id!==h.horse_id).map(q=>q.horse_id),unbound_peer_horse_nos:[]},unresolved_materials:['FORMAL_RULE_AND_ELIGIBILITY_UNRESOLVED','NO_DIRECT_CURRENT_PEER_COMPARISON'],evidence_ids:uniq([o.evidence_id,...own.map(r=>r.evidence_id)]),recorded_key_support:partial.filter(pred).map(r=>({race_id:r.race_id,finish:r.finish,clock_tenths:r.clock_tenths,evidence_ids:[r.evidence_id],formal_comparison:false})),recorded_key_counter:partial.filter(r=>!pred(r)).map(r=>({race_id:r.race_id,finish:r.finish,evidence_ids:[r.evidence_id]})),other_condition_reach:other.filter(pred).map(r=>({race_id:r.race_id,finish:r.finish,going:r.going,class_key:r.class_key,distance:r.distance,evidence_ids:[r.evidence_id]})),current_status:'UNKNOWN',final_rank:null};};
 const paths=sharedRoutes?commonWinning.runners.find(r=>r.horse_id===h.horse_id):{horse_no:h.horse_no,horse_id:h.horse_id,active:o.active,winning_paths:[path('WIN')],placing_paths:[path('PLACE')]};
 if(sharedRoutes)paths.active=o.active;
 // No history means no individual route output, while field context stays available.
 if(!own.length){paths.winning_paths=[];paths.placing_paths=[];}
 h.paths=paths;
 if(!sharedRoutes&&own.length)add(h,'100',{type:'RECORDED_KEY_PATHS_NOT_CURRENT_JUDGMENT',winning_paths:paths.winning_paths,placing_paths:paths.placing_paths},[o.evidence_id,...own.map(r=>r.evidence_id)],'hypotheses');
 return {horse_no:h.horse_no,horse_id:h.horse_id,active:o.active,items:defs.filter(d=>!d.id.startsWith('EYE-')).map(d=>({item_id:d.id,finding:h.items[d.id],evidence_ids:uniq(fval(h.items[d.id]).flatMap(x=>x.evidence_ids)),unknowns:h.items[d.id]?.unknowns??[],implementation:'SHARED_RESEARCH_KERNEL'}))};});
 const rankAudit={runners:rankRunners};
 const eye=inspectEye15({target,roster,rankAudit,intake,catalog:defs,traceRead});
 const syntheticAudit={runners:rankRunners.map(h=>({...h,items:defs.map(d=>{const e=d.id.startsWith('EYE-')?eye.find(x=>x.horse_no===h.horse_no).items.find(x=>x.eye_item_id===d.id):null;const i=h.items.find(x=>x.item_id===d.id);return {item_id:d.id,observed_output:e?e.observed_facts:i?.finding,typed_output:[],unknowns:e?e.unknowns:i?.unknowns,analysis_state:(e?e.observed_facts.length:fval(i?.finding).length)?'FIXTURE_RESEARCH_OUTPUT':'FIXTURE_NO_OUTPUT',execution_state:sharedRoutes?'SECTION_DISPATCHED_ITEM_CALL_NOT_INDIVIDUALLY_INSTRUMENTED':'SHARED_FUNCTION_EXECUTED',actual_runtime_reads:traces.filter(x=>x.horse_no===h.horse_no&&x.item_id===d.id),formal_consumption:false};})}))};
 const synthetic={prior:{intake},rerun:{actual_input_hash:fingerprint({runs,races,histories,current,gates}),rank:{audit:rankAudit}},audit:syntheticAudit,winning:commonWinning??{runners:before.map(h=>h.paths)},eye,dependency:dep,evidence_version:fingerprint(intake.accepted)};
 const synthesis=deriveResearchV5({analysis:synthetic,target});
 for(const h of synthesis.runners){const src=before.find(q=>q.horse_no===h.horse_no),own=runs.filter(r=>r.horse_id===h.horse_id);h.fixture_only=true;h.official_evidence=false;h.evaluation_status=own.length?'RESEARCH_ONLY_CURRENT_STRENGTH_UNKNOWN':'UNASSESSED_HISTORY_MISSING';h.recorded_key_paths=src.paths;
  // Record distinct conditional evidence and counterexamples without promoting a partial key match to full comparability.
  const conditional=[...src.paths.winning_paths,...src.paths.placing_paths];
  h.recorded_key_counter_candidates=conditional.flatMap(path=>path.recorded_key_counter.map(x=>({route_kind:path.route_kind,path_id:path.path_id,...x,scope:'PARTIAL_RECORDED_CONDITIONS_ONLY',materiality:'UNVALIDATED',formal_major_counter:false})));
  const specific=(axis)=>axis==='A'?{historical_route_support:conditional.flatMap(path=>path.recorded_key_support.map(x=>({...x,route_kind:path.route_kind}))),historical_route_counter:h.recorded_key_counter_candidates,other_condition_reach:conditional.flatMap(path=>path.other_condition_reach.map(x=>({...x,route_kind:path.route_kind})))}:axis==='B'?{formal_eligibility_unknown:true,body_weight_context:h.items.find(x=>x.item_id==='81').actual_analysis_output}:axis==='C'?{linked_partial_peer_observations:h.items.find(x=>x.item_id==='37').actual_analysis_output,full_current_comparison:null}:axis==='D'?{front_observations:h.items.find(x=>x.item_id==='59').actual_analysis_output,competition_scenarios:h.items.find(x=>x.item_id==='65').actual_analysis_output}: {condition_changes:h.items.find(x=>x.item_id==='93').actual_analysis_output,content_pairs:h.items.find(x=>x.item_id==='32').actual_analysis_output.filter(x=>x.value.type==='RECORDED_CONDITION_PAIR')};
  for(const a of h.five_axis_findings){a.recorded_fixture_context=specific(a.axis);a.current_support_strength='UNVALIDATED';}
  h.input_holds=holds.filter(q=>q.key===h.horse_id||own.some(r=>r.race_id===q.key));h.important_unknown_candidates=[...h.material_unknowns,...h.input_holds.map(q=>({code:q.reason,scope:q.scope,affected_key:q.key,formal_materiality:null})),...(!own.length?[{code:'NO_LINKED_PAST_HISTORY',scope:'ALL_PATHS',formal_materiality:null}]:[])];for(const i of h.items){i.fixture_only=true;i.official_evidence=false;i.analysis_input_scope='FICTIONAL_INTERNALLY_CHECKED_OR_PARTIAL';}
  h.eye.items=h.eye.items.map(i=>{const e=eye.find(x=>x.horse_no===h.horse_no).items.find(x=>x.eye_item_id===i.eye_item_id);const refs=uniq(e.evidence_ids);return {...i,own_historical_refs:refs.filter(ref=>intake.accepted.some(g=>g.evidence_ids.includes(ref)&&g.record.horse_id===h.horse_id&&g.record.kind==='RESULT')),shared_field_or_card_only:!own.length,selection:null};});}
 const rows=synthesis.runners.flatMap(h=>h.items);
 const share=pace.runners.flatMap(h=>h.items['63'].facts).map(o=>o.value)[0];
 const field={active_n:roster.filter(h=>h.active).length,front_rows:pace.runners.map(h=>({horse_no:h.horse_no,horse_id:h.horse_id,front:h.items['59'].facts[0]?.value?.top3_any_corner??'UNKNOWN',first:h.items['59'].facts[0]?.value?.early_top3??'UNKNOWN',evidence_ids:h.items['59'].facts.flatMap(x=>x.evidence_ids)})),share,first_turn_m:target.distance_m===raw.target.distance_m?raw.target.first_turn_m:null,possible_pairs:21,observed_direct_pairs:opposition.runners.flatMap(h=>h.items['35'].facts).length/2,indirect_observations:opposition.runners.flatMap(h=>h.items['36'].facts).length,conditional_competition:pace.runners.flatMap(h=>h.items['65'].hypotheses.map(o=>o.value)).filter(o=>o.certainty==='CONDITIONAL_NOT_VERIFIED_COMPETITION').slice(0,1),scenario_status:'HYPOTHESES_ONLY_UNVALIDATED',day:p.dayAudit};
 const structure=sharedRoutes?researchRaceStructure({target,roster,winning:commonWinning,intake}):null;
 if(semanticV13&&structure)for(const h of commonWinning.runners.filter(h=>h.active!==false&&!h.winning_paths.length)){const r=structure.material_unknowns_by_horse.find(x=>x.horse_id===h.horse_id);if(r)r.unknowns=[...new Set([...r.unknowns,'NO_HISTORICAL_ROUTE'])];}
 return {shared_route_kernel:sharedRoutes,structure,fixture_only:true,official_admission:false,formal_consumption:0,input_sha256:createHash('sha256').update(bytes).digest('hex'),normal_entry_rejection:ordinary,input_blob:semanticV13?null:'cc213bde970d07cf8dd5d034b18a72ca2e196dfa',time_basis:target.time_basis,audit:p.audit,holds,field,followup_diagnostics:followups,counts:{past_races:p.audit.length,past_rows:p.audit.reduce((n,r)=>n+r.rows,0),usable_races:races.length,usable_rows:races.reduce((n,r)=>n+r.results.length,0),lap_sum_conflicts:p.audit.filter(r=>r.lap_delta_tenths!==0).length,lap_kind_holds:p.audit.filter(r=>r.lap_status==='HOLD').length,position_conflict_races:p.audit.filter(r=>r.corner_held.length).length,held_corner_grids:p.audit.reduce((n,r)=>n+r.corner_held.length,0),target_history_number_differences:p.audit.filter(r=>r.target_runner_no!==r.subject_historical_runner_no).length,linked_partial_followups:followups.length,audit_rows:rows.length,shared_function_rows:sharedRoutes?null:rows.length,section_dispatched_rows:rows.length,rows_with_output:rows.filter(i=>i.actual_analysis_output.length).length,rows_with_structural_refs:rows.filter(i=>i.structurally_bound_outputs>0).length,rows_with_actual_research_reads:rows.filter(i=>i.runtime_consumers.length||i.synthesis_runtime_reads.length).length,formal_consumption:0},runners:synthesis.runners,trace_reads:traces,synthesis_reads:synthesis.runtime_reads,raw_reads:synthesis.raw_evidence_reads,rank_candidate:null,eye_candidate:null};
}

import {readFileSync} from 'node:fs';
import {fingerprint} from './recompute-full-rank.mjs';
import {stagedAbilityResearch} from './staged-eye-return.mjs';
import {historyKnown} from './fictional-research-context.mjs';
import {lookupWorkCohortDiagnostic} from './work-v09-benchmark-gate.mjs';
const defs=JSON.parse(readFileSync(new URL('./analysis-contract-115-v5.json',import.meta.url),'utf8')).items;
const uniq=xs=>[...new Set(xs)].sort();
const arr=x=>Array.isArray(x)?x:[];
const fields=['course_id','course_version','distance_m','surface','going','class_key','eligibility','weight_rule_version'];
const conditionDiff=(a,b)=>({matched:fields.filter(k=>a?.[k]!=null&&a[k]===b?.[k]),different:fields.filter(k=>a?.[k]!=null&&b?.[k]!=null&&a[k]!==b[k]),unknown:fields.filter(k=>a?.[k]==null||b?.[k]==null)});
const status=d=>d.different.length?'CONDITION_DIFFERENCE_OBSERVED':d.unknown.length?'CONDITION_COMPARISON_INCOMPLETE':'RECORDED_CONDITIONS_MATCH';
const sameScope=(g,h,r)=>g.record.horse_id===h&&g.record.race_id===r;
const sortBy=x=>x.slice().sort((a,b)=>fingerprint(a).localeCompare(fingerprint(b)));
function observations(item){
 if(!item)return [];
 if(item.item_id.startsWith('EYE-'))return arr(item.observed_output).map(x=>({kind:'EYE_OBSERVATION',value:x.value??x,refs:arr(x.evidence_ids),observation_type:x.type??null}));
 const f=item.observed_output;
 const typed=arr(item.typed_output).map(x=>({kind:'TYPED_OBSERVATION',value:x.value,refs:arr(x.evidence_ids),observation_type:x.kind}));
 const legacy=Array.isArray(f)?f.map(x=>({kind:'OBSERVATION',value:x.value??x,refs:arr(x.evidence_ids??(x.evidence_id?[x.evidence_id]:[]))})):['facts','hypotheses','counterevidence'].flatMap(k=>arr(f?.[k]).map(x=>({kind:k==='facts'?'OBSERVATION':k==='hypotheses'?'HYPOTHESIS':'COUNTER_OBSERVATION',value:x.value??x,refs:arr(x.evidence_ids??(x.evidence_id?[x.evidence_id]:[])),observation_type:x.typed_kind??null})));
 return [...typed,...legacy];
}
function makeContext(analysis,target){
 const accepted=analysis.prior.intake.accepted;
 if(target.circuit==='FIXTURE'&&(analysis.prior.intake.fixture_only!==true||accepted.some(g=>g.fixture_only!==true||g.formal_admission!==false)))throw Error('FICTIONAL_SYNTHESIS_INTAKE_REQUIRED');
 const refs=new Map(accepted.flatMap(g=>g.evidence_ids.map(e=>[e,g])));
 const eventRefs=xs=>uniq(xs.flatMap(e=>refs.has(e)?[refs.get(e).event_key]:[]));
 const result=(id,r)=>{const a=accepted.filter(g=>g.record.kind==='RESULT'&&sameScope(g,id,r));return a.length===1?a[0]:null;};
 const card=id=>{const a=accepted.filter(g=>g.record.kind==='CURRENT_CARD'&&sameScope(g,id,target.race_id));return a.length===1?a[0]:null;};
 const chronology=id=>{const a=accepted.filter(g=>g.record.kind==='HISTORY'&&sameScope(g,id,target.race_id)&&historyKnown(target,g.record.fact));if(a.length!==1)return null;const ids=a[0].record.fact.ordered_actual_start_race_ids;if(!Array.isArray(ids)||new Set(ids).size!==ids.length)return null;const records=ids.map(r=>result(id,r));if(records.some(x=>!x)||records.some((x,i)=>i>0&&Date.parse(records[i-1].record.event_at)<=Date.parse(x.record.event_at)))return null;return {group:a[0],records};};
 return {accepted,refs,eventRefs,result,card,chronology};
}
export function deriveResearchV5({analysis,target}){
 const ctx=makeContext(analysis,target);
 const reads=[],rawReads=[];
 const recordRaw=(horse_no,consumer,groups,reason)=>{if(groups.length)rawReads.push({horse_no,consumer,evidence_ids:uniq(groups.flatMap(g=>g.evidence_ids)),original_event_keys:uniq(groups.map(g=>g.event_key)),input_version:analysis.evidence_version,reason,read_kind:'RAW_STRUCTURAL_EVIDENCE_READ',final_consumption:false});};
 const recordRead=(horse_no,item_id,consumer,value,reason,refs=[])=>{
  reads.push({horse_no,item_id,consumer,input_version:analysis.evidence_version,actual_bridge_input_hash:analysis.rerun.actual_input_hash,output_hash:fingerprint(value),reason,evidence_ids:uniq(refs),original_event_keys:ctx.eventRefs(refs),read_kind:'ANALYSIS_OUTPUT_READ',effect:'RESEARCH_REASON_OR_UNCERTAINTY',final_consumption:false});
 };
 const runners=analysis.audit.runners.map(h=>{
  const path=analysis.winning.runners.find(r=>r.horse_no===h.horse_no);
  const eye=analysis.eye.find(r=>r.horse_no===h.horse_no);
  const current=h.horse_id?ctx.card(h.horse_id):null,chron=h.horse_id?ctx.chronology(h.horse_id):null;
  const active=h.active!==false,bound=active&&!!h.horse_id;
  const material=[];
  // Only an explicitly recorded raw label key may look up the Work workbook. This is not a benchmark residual.
  const cohortDiagnostic=lookupWorkCohortDiagnostic({circuit:target.circuit,observedLabelKey:current?.record.fact.raw_workbook_label_key??null});
  const unknown=(code,scope,required_for,evidence_ids=[],why='')=>({code,scope,required_for,evidence_ids:uniq(evidence_ids),original_event_keys:ctx.eventRefs(evidence_ids),why,materiality:'ROUTE_PREREQUISITE_UNRESOLVED',formal_materiality:null});
  if(active&&!bound)material.push(unknown('IDENTITY_HOLD','ALL_PATHS',['本人馬の分析・相手比較'],[],'馬番を維持するが、本人馬との結合が成立しない'));
  if(bound&&!current)material.push(unknown('CURRENT_CARD_MISSING','ALL_PATHS',['今回条件の比較'],[],'今回条件が不明'));
  if(bound&&!chron)material.push(unknown('CHRONOLOGY_INCOMPLETE','CURRENT_STATE',['直前走・状態変化・現在性'],[],'公式順序の連続照合が不足'));
  const pathResearch=(p,kind)=>{
   const support=[],counter=[],neutral=[],unresolved=[];
   const histories=arr(p.historical_support);
   for(const x of histories){
    const g=ctx.result(h.horse_id,x.race_id);if(!g||!current)continue;
    const d=conditionDiff(g.record.fact,current.record.fact),refs=uniq([...g.evidence_ids,...current.evidence_ids]);
    const v={race_id:x.race_id,event_at:g.record.event_at,finish:g.record.fact.finish,condition_comparison:d,condition_status:status(d),evidence_ids:refs,original_event_keys:ctx.eventRefs(refs),scope:'HISTORICAL_CONDITION_CONTEXT',current_strength_proven:false};
    if(status(d)!=='RECORDED_CONDITIONS_MATCH'){neutral.push(v);continue;}
    if(g.record.fact.start_status!=='FINISHED'||!Number.isInteger(v.finish)||v.finish<1||!Number.isInteger(g.record.fact.field_size)||v.finish>g.record.fact.field_size){neutral.push({...v,reason:'NO_VALID_FINISHED_RANK'});continue;}
    const positive=kind==='WIN'?v.finish===1:v.finish<=3;
    (positive?support:counter).push({...v,reason:positive?'OBSERVED_TARGET_FINISH_UNDER_RECORDED_MATCH':'OBSERVED_NON_TARGET_FINISH_UNDER_RECORDED_MATCH',route_counter_scope:'HISTORICAL_OUTCOME_ONLY'});
   }
   for(const pair of arr(p.opponent_comparison))for(const x of arr(pair.observations)){
    const v={race_id:x.race_id,peer_ids:pair.pair_ids,observed_direction:x.direction,clock_difference_tenths:x.clock_difference_tenths,evidence_ids:x.evidence_ids,original_event_keys:ctx.eventRefs(x.evidence_ids),scope:'HISTORICAL_CURRENT_PEER_PAIR',current_strength_proven:false};
    if(x.direction==='OFFICIAL_TIE')neutral.push(v);else if(x.direction===h.horse_id)support.push({...v,reason:'OBSERVED_AHEAD_OF_CURRENT_PEER',does_not_prove_target_finish:true});else counter.push({...v,reason:'OBSERVED_BEHIND_CURRENT_PEER',route_counter_scope:'PAIR_ONLY'});
   }
   // Neither observed defeat nor a changed condition is automatically a decisive counter.
   const historicalNonmatch=arr(p.counterevidence?.nonmatching_history).map(x=>({...x,scope:'DIFFERENT_OR_UNKNOWN_CONDITIONS',current_effect:'UNVALIDATED'}));
   const cov=p.comparison_coverage??{};
   if((cov.unknown_peer_ids??[]).length||(cov.unbound_peer_horse_nos??[]).length)unresolved.push(unknown('CURRENT_PEER_COVERAGE_GAP',p.path_id,['今回全相手に対する経路'],[],'直接比較のない相手または本人馬不明が残る'));
   if(!histories.length)unresolved.push(unknown('NO_COMPARABLE_HISTORICAL_FINISH',p.path_id,['同条件での到達実績'],[],'比較可能な過去結果がない'));
   if(p.scenario_id!=='CONDITION_MATCH_ONLY')unresolved.push(unknown('SCENARIO_NOT_REALIZED',p.path_id,['想定展開での再現'],p.evidence_ids??[],'競合・譲りは観測済みの今回展開ではない'));
   unresolved.push(unknown('CURRENT_STRENGTH_NOT_VALIDATED',p.path_id,['今回の勝ち切り／好走支持強度'],p.evidence_ids??[],'過去の同条件・先着のみでは今回の能力を確定できない'));
   const historicalStatus=support.length&&counter.length?'MIXED':support.length?'SUPPORT':counter.length?'COUNTER':'UNKNOWN';
   // Root-level ablation of the observed route reasons only, not a prediction or entire circuit rerun.
   const rootKeys=uniq([...support,...counter].flatMap(x=>x.original_event_keys));
   const sensitivity=rootKeys.map(key=>{const s=support.filter(x=>!x.original_event_keys.includes(key)),c=counter.filter(x=>!x.original_event_keys.includes(key));const next=s.length&&c.length?'MIXED':s.length?'SUPPORT':c.length?'COUNTER':'UNKNOWN';return {removed_original_event:key,historical_status_after_reason_removal:next,changes_historical_status:next!==historicalStatus,removes_all_historical_support:support.length>0&&!s.length,scope:'ROUTE_REASON_ABLATION_ONLY',formal_materiality:null};});
   const prerequisiteConflicts=historicalNonmatch.filter(x=>x.condition_delta?.length).map(x=>({race_id:x.race_id,fields:x.condition_delta,evidence_ids:x.evidence_ids,scope:'EXACT_RECORDED_CONDITION_TRANSFER',effect:'THIS_HISTORICAL_EXACT_MATCH_ROUTE_NOT_ESTABLISHED',major_status:'NOT_ESTABLISHED',alternative_routes_unresolved:true}));
   return {...p,route_kind:kind,historical_evidence_status:historicalStatus,current_evidence_status:'UNKNOWN',support_observations:sortBy(support),counter_observations:sortBy(counter),neutral_observations:sortBy(neutral),nonmatching_history:historicalNonmatch,material_unknowns:unresolved,reason_ablation:sensitivity,prerequisite_conflicts:prerequisiteConflicts,major_counter_candidates:counter.map(x=>({...x,major_status:'NOT_ESTABLISHED',effect_scope:x.route_counter_scope,alternative_route_review:'REQUIRED'})),formal_major_counterevidence:[],final_rank:null};
  };
  const winning=arr(path?.winning_paths).map(p=>pathResearch(p,'WIN')),placing=arr(path?.placing_paths).map(p=>pathResearch(p,'PLACE'));
  if(bound&&winning.length+placing.length)recordRead(h.horse_no,'100','deriveResearchV5.pathResearch',[path?.winning_paths,path?.placing_paths],'勝利と好走の到達実績・過去相手比較・必要条件の反証を別々に検査',[...winning,...placing].flatMap(p=>p.evidence_ids??[]));
  if(bound){for(const p of [...winning,...placing])material.push(...p.material_unknowns);}
  const items=h.items.map(i=>{
   const def=defs.find(d=>d.id===i.item_id);
   const rawOutput=i.item_id==='100'?[...winning,...placing].map(p=>({kind:'DERIVED_ROUTE_RESEARCH',value:p,refs:p.evidence_ids??[],observation_type:p.route_kind})):observations(i);
   const os=rawOutput.map(x=>({...x,original_event_keys:ctx.eventRefs(x.refs),evidence_binding:x.refs.length&&x.refs.every(r=>ctx.refs.has(r))?'STRUCTURAL_ROOT_BOUND':'REFERENCE_UNRESOLVED',formal_admission:false}));
   const consumed=arr(i.actual_runtime_reads),legacyItem=analysis.rerun.rank.audit.runners.find(r=>r.horse_no===h.horse_no)?.items.find(x=>x.item_id===i.item_id);
   const findings=os.filter(o=>o.evidence_binding==='STRUCTURAL_ROOT_BOUND');
   // Reading a value into research rationale is a distinct, observed consumer, not final consumption.
   if(bound&&findings.length)recordRead(h.horse_no,i.item_id,'deriveResearchV5.itemRationale',findings,'原事象と対応する分析結果を項目別理由へ組み込む',findings.flatMap(x=>x.refs));
   const historical=os.filter(o=>o.kind==='COUNTER_OBSERVATION');
   return {item_id:i.item_id,name:def.name,role:def.role,axes:def.axes,required_evidence:def.required_evidence,source_ids:def.source_ids,implemented_research_content:def.implemented_research_content,remaining_gap:def.remaining_gap,work_benchmark_diagnostic:['05','06','11','13','14','40','43','46','48','69','73'].includes(i.item_id)?cohortDiagnostic:null,implementation_status:i.item_id.startsWith('EYE-')?'RESEARCH_EYE_FUNCTION_PRESENT':legacyItem?.implementation??'UNKNOWN',execution_state:i.execution_state,analysis_state:i.analysis_state,actual_analysis_output:os,actual_output_hash:fingerprint(os),structurally_bound_outputs:findings.length,observed_counter_outputs:historical,unknowns:arr(i.unknowns),planned_consumers:analysis.dependency.items.find(d=>d.id===i.item_id)?.planned_consumers??[],runtime_consumers:consumed,formal_validation:false,formal_consumption:false,final_decision_effect:null};
  });
  const baseRoutes=[...winning,...placing].filter(p=>p.scenario_id==='CONDITION_MATCH_ONLY');
  const axes=['A','B','C','D','E'].map(axis=>{
   const selected=items.filter(i=>i.axes.includes(axis)&&!i.item_id.startsWith('EYE-'));
   const context=selected.flatMap(i=>i.actual_analysis_output.filter(o=>o.evidence_binding==='STRUCTURAL_ROOT_BOUND').map(o=>({item_id:i.item_id,...o})));
   for(const i of selected){const v=context.filter(o=>o.item_id===i.item_id);if(v.length)recordRead(h.horse_no,i.item_id,'deriveResearchV5.axis.'+axis,v,'観点の事実・仮説・反証の文脈へ実出力を参照',v.flatMap(o=>o.refs));}
   const scoped=axis==='A'?baseRoutes.flatMap(p=>[...p.support_observations,...p.counter_observations].filter(x=>x.scope==='HISTORICAL_CONDITION_CONTEXT')):axis==='C'?baseRoutes.flatMap(p=>[...p.support_observations,...p.counter_observations].filter(x=>x.scope==='HISTORICAL_CURRENT_PEER_PAIR')):axis==='D'?[...winning,...placing].filter(p=>p.scenario_id!=='CONDITION_MATCH_ONLY').flatMap(p=>[...p.support_observations,...p.counter_observations]):[];
   const sup=scoped.filter(x=>x.reason==='OBSERVED_TARGET_FINISH_UNDER_RECORDED_MATCH'||x.reason==='OBSERVED_AHEAD_OF_CURRENT_PEER');
   const ctr=[...scoped.filter(x=>x.reason==='OBSERVED_NON_TARGET_FINISH_UNDER_RECORDED_MATCH'||x.reason==='OBSERVED_BEHIND_CURRENT_PEER'),...context.filter(x=>x.kind==='COUNTER_OBSERVATION')];
   const conditionContexts=axis==='B'&&current?ctx.accepted.filter(g=>g.record.kind==='RESULT'&&g.record.horse_id===h.horse_id&&g.record.fact.start_status==='FINISHED').map(g=>({race_id:g.record.race_id,event_at:g.record.event_at,finish:g.record.fact.finish,comparison:conditionDiff(g.record.fact,current.record.fact),evidence_ids:uniq([...g.evidence_ids,...current.evidence_ids])})):[];
   // B and E give direction only for a specifically stated historical condition prerequisite.
   // The outcome remains scoped to that past performance, not a forecast.
   const conditionPrerequisites=conditionContexts.map(x=>({...x,scope:'RECORDED_CONDITION_PERSISTENCE',condition_status:status(x.comparison),supports_condition_transfer_only:status(x.comparison)==='RECORDED_CONDITIONS_MATCH',contradicts_exact_match_only:x.comparison.different.length>0}));
   const conditionSupport=axis==='B'?conditionPrerequisites.filter(x=>x.supports_condition_transfer_only):[];
   const conditionCounter=axis==='B'?conditionPrerequisites.filter(x=>x.contradicts_exact_match_only):[];
   if(axis==='B'&&conditionPrerequisites.length)recordRaw(h.horse_no,'deriveResearchV5.axis.B.conditionPrerequisites',[current,...ctx.accepted.filter(g=>g.record.kind==='RESULT'&&g.record.horse_id===h.horse_id&&g.record.fact.start_status==='FINISHED')],'今回条件と本人馬の過去成績の一致・不一致・未知を分離');
   const restoration=axis==='E'?context.filter(x=>x.item_id==='95'&&Array.isArray(x.value?.matched_observations)).flatMap(x=>x.value.matched_observations.map(m=>({race_id:m.race_id,finish:m.finish,refs:x.refs,scope:'RESTORED_CONDITION_HISTORICAL_OUTCOME',effect:'UNVALIDATED'}))):[];
   const changes=axis==='E'?context.filter(x=>['93','94','96','97','98','99'].includes(x.item_id)):[];
   const historical=sup.length&&ctr.length?'MIXED':sup.length?'SUPPORT':ctr.length?'COUNTER':'UNKNOWN';
   return {axis,status:!active?'NOT_APPLICABLE':'UNKNOWN',historical_observation_status:!active?'NOT_APPLICABLE':historical,support:sortBy(sup),counter:sortBy(ctr),observed_context:context,condition_context:conditionContexts,condition_prerequisite_support:conditionSupport,condition_prerequisite_counter:conditionCounter,restored_condition_observations:restoration,change_context:changes,material_unknowns:material.filter(x=>axis==='C'?x.code.includes('PEER')||x.code==='IDENTITY_HOLD':axis==='D'?x.code.includes('SCENARIO')||x.code.includes('PEER'):axis==='B'?x.scope==='CURRENT_STATE'||x.code.includes('CARD'):axis==='A'?x.code.includes('HISTORICAL')||x.code.includes('STRENGTH'):true),unobserved_item_ids:selected.filter(i=>!i.structurally_bound_outputs).map(i=>i.item_id),current_support_strength:'UNVALIDATED',formal_consumption:false};
  });
  const eyeItems=arr(eye?.items).map(e=>{
   const matched=[];
   for(const o of arr(e.observed_facts)){
    const groups=uniq(arr(o.evidence_ids)).map(id=>ctx.refs.get(id)).filter(Boolean);
    const ownResults=groups.filter(g=>g.record.kind==='RESULT'&&g.record.horse_id===h.horse_id);
    for(const g of ownResults){
     const d=conditionDiff(g.record.fact,current?.record.fact),at=Date.parse(g.record.event_at);
     const newer=ctx.accepted.filter(x=>x.record.kind==='RESULT'&&x.record.horse_id===h.horse_id&&Date.parse(x.record.event_at)>at&&x.record.fact.start_status==='FINISHED').map(x=>({race_id:x.record.race_id,finish:x.record.fact.finish,condition_status:status(conditionDiff(x.record.fact,current?.record.fact)),evidence_ids:x.evidence_ids}));
     matched.push({observation_type:o.type,race_id:g.record.race_id,event_at:g.record.event_at,days_before_target:Math.floor((Date.parse(target.started_at)-at)/86400000),condition_status:status(d),condition_comparison:d,immediate_prior_verified:chron?.records[0]?.record.race_id===g.record.race_id,newer_observations:sortBy(newer),evidence_ids:uniq([...o.evidence_ids,...(current?.evidence_ids??[]),...(chron?.group.evidence_ids??[]),...newer.flatMap(n=>n.evidence_ids)]),causal_relevance:'UNVALIDATED'});
    }
   }
   if(matched.length)recordRead(h.horse_no,e.eye_item_id,'deriveResearchV5.eyeCurrentRelevance',e.observed_facts,'歴史事象・今回条件・後続成績の現在性照合',matched.flatMap(x=>x.evidence_ids));
   const scopeStatus=!matched.length?'NO_BOUND_HISTORICAL_RESULT':matched.some(x=>x.condition_status==='RECORDED_CONDITIONS_MATCH')?matched.some(x=>x.newer_observations.length)?'MATCHED_CONDITIONS_WITH_NEWER_RESULTS_TO_REVIEW':'MATCHED_CONDITIONS_NO_NEWER_RESULT_OBSERVED':matched.some(x=>x.condition_status==='CONDITION_DIFFERENCE_OBSERVED')?'RECORDED_CONDITION_CHANGE':'CONDITION_COMPARISON_INCOMPLETE';
   const relevantTypes={ 'EYE-01':['DEFEAT_GAP'],'EYE-02':['FINISH_POSITION_CONTENT'],'EYE-03':['OBSERVED_RANK_RECOVERY'],'EYE-04':['SAME_RACE_GAP_AND_PEER_CONTEXT'],'EYE-05':['PEER_FOLLOWUP','FOLLOWUP_DISTRIBUTION'],'EYE-06':['LAST_INCIDENT_AND_CURRENT_SCENARIO'],'EYE-07':['RETURN_TO_CONDITION'],'EYE-08':['DIRECTIONAL_COURSE_CHANGE'],'EYE-09':['SHARE_WITH_STYLE_AND_PACE'],'EYE-10':['SANDWICH_WITH_GEOMETRY'],'EYE-11':['SAME_STYLE_COMPARISON'],'EYE-12':['EARLY_POSITION_AND_QUEUE_CONTEXT'],'EYE-13':['COMPARABLE_TREND_CONTEXT'],'EYE-14':['FIELD_CHANGE_AND_FIT_CONTEXT'],'EYE-15':['COMBINED_MECHANISM_REVIEW']};
   const mechanismObservations=arr(e.observed_facts).filter(o=>(relevantTypes[e.eye_item_id]??[]).includes(o.type)).map(o=>({type:o.type,observed:o.value,source_roots:ctx.eventRefs(o.evidence_ids??[]),evidence_ids:o.evidence_ids??[],current_effect:'UNVALIDATED'}));
   const fieldItemIds=['EYE-09','EYE-10','EYE-11','EYE-12','EYE-14'].includes(e.eye_item_id)?e.upstream_item_ids?.filter(id=>['39','40','42','53','58','59','60','61','62','63','64','65','66','67','68','69','70','73'].includes(id))??[]:[];
   const fieldContext=fieldItemIds.flatMap(id=>{const it=items.find(i=>i.item_id===id);return arr(it?.actual_analysis_output).filter(o=>o.evidence_binding==='STRUCTURAL_ROOT_BOUND').map(o=>({item_id:id,value:o.value,refs:o.refs,scope:'CURRENT_FIELD_ANALYSIS_CONTEXT_NOT_VALIDATED_BENEFIT'}));});
   for(const id of fieldItemIds){const rows=fieldContext.filter(o=>o.item_id===id);if(rows.length)recordRead(h.horse_no,id,'deriveResearchV5.eyeCurrentFieldContext.'+e.eye_item_id,rows,'今回全頭構成または相手変化の分析結果を個別現在性の文脈へ参照',rows.flatMap(o=>o.refs));}
   const peerContext=e.eye_item_id==='EYE-05'?arr(e.observed_facts).filter(o=>o.type==='PEER_FOLLOWUP').map(o=>({value:o.value,linked_records:uniq(o.evidence_ids??[]).map(id=>ctx.refs.get(id)).filter(Boolean).filter(g=>g.record.kind==='RESULT'||g.record.kind==='PEER_RESULT'||target.circuit==='FIXTURE'&&g.record.kind==='FIXTURE_FOLLOWUP').map(g=>({race_id:g.record.race_id,horse_id:g.record.horse_id,event_at:g.record.event_at,evidence_ids:g.evidence_ids,...(g.record.kind==='FIXTURE_FOLLOWUP'?{publication_local:g.record.fact.publication_local,date:g.record.fact.date,finish:g.record.fact.finish,scope:'FICTIONAL_PARTIAL_RESULT_NO_START_TIME'}:{})})),current_effect:'UNVALIDATED'})):[];
   if(peerContext.length)recordRead(h.horse_no,e.eye_item_id,'deriveResearchV5.eyePeerFollowupContext',peerContext,'相手の後続事象の時点とIDを保持、本人馬への作用は未検証',arr(e.evidence_ids));
   const checks={item_executed:true,observation_present:arr(e.observed_facts).length>0,structural_roots_bound:arr(e.evidence_ids).length>0&&e.evidence_ids.every(id=>ctx.refs.has(id)),current_condition_comparison:matched.some(x=>x.condition_status==='RECORDED_CONDITIONS_MATCH'),chronology_verified:!!chron,causal_effect_validated:false};
   return {eye_item_id:e.eye_item_id,checks,observed_relevance:matched,condition_relevance_status:scopeStatus,mechanism_observations:mechanismObservations,current_field_context:fieldContext,peer_followup_context:peerContext,mechanism_observation_present:mechanismObservations.length>0,counter:e.counter??[],unknowns:e.unknowns??[],status:!active?'NOT_APPLICABLE':!bound?'IDENTITY_HOLD':!checks.observation_present?'NO_OBSERVATION':'RESEARCH_CONTEXT_ONLY',current_relevance:'UNVALIDATED',selection:null};
  });
  const major=[...winning,...placing].flatMap(p=>[...p.major_counter_candidates,...p.prerequisite_conflicts].map(c=>({...c,path_id:p.path_id,scenario_id:p.scenario_id,route_kind:p.route_kind,alternative_path_ids:[...winning,...placing].filter(x=>x.path_id!==p.path_id&&x.historical_evidence_status==='SUPPORT').map(x=>x.path_id)})));
  const historicalEvidenceGroups=new Map();for(const i of items)for(const o of i.actual_analysis_output)for(const key of o.original_event_keys){if(!historicalEvidenceGroups.has(key))historicalEvidenceGroups.set(key,new Set());historicalEvidenceGroups.get(key).add(i.item_id);}
  return {horse_no:h.horse_no,horse_id:h.horse_id,active,items,work_benchmark_diagnostic:cohortDiagnostic,five_axis_findings:axes,winning_paths:winning,placing_paths:placing,major_counter_candidates:major,decisive_counterevidence:[],material_unknowns:material,nonmaterial_unknowns:[],materiality_status:'ROUTE_PREREQUISITES_ONLY_NOT_FINAL',eye:{items:eyeItems,items_executed:eyeItems.length,all_items_reviewed:false,items_with_observations:eyeItems.filter(e=>e.checks.observation_present).length,items_with_current_condition_comparison:eyeItems.filter(e=>e.checks.current_condition_comparison).length,material_coverage_complete:false,ability_eligible:null,selection:null},original_event_groups:[...historicalEvidenceGroups].map(([key,ids])=>({key,item_ids:uniq([...ids]),independent_vote:false})).sort((a,b)=>a.key.localeCompare(b.key)),rank_candidate:null,decision_status:!active?'NOT_APPLICABLE':!bound?'IDENTITY_HOLD':'FORMAL_JUDGMENT_DISABLED',formal_consumption:0};
 });
 for(const h of runners)for(const i of h.items)i.synthesis_runtime_reads=reads.filter(x=>x.horse_no===h.horse_no&&x.item_id===i.item_id);
 return {runners,runtime_reads:reads,raw_evidence_reads:rawReads,fixture_only:target.circuit==='FIXTURE',formal_admission:false,scope:{catalog_items:defs.length,all_roster_rows:runners.length,formal_consumption:0,formal_admissions:0,full_runtime_dependency_extraction:false},release_eligible:false};
}
export function abilityResearch115v5(args){
 const staged=stagedAbilityResearch(args),target=args.rankArgs.oppositionArgs.target;
 const before=deriveResearchV5({analysis:staged.before,target}),after=deriveResearchV5({analysis:staged.after,target});
 return {staged,before,after,delta:after.runners.map(h=>{const old=before.runners.find(x=>x.horse_no===h.horse_no);return {horse_no:h.horse_no,axis_changed:h.five_axis_findings.map(a=>({axis:a.axis,changed:fingerprint(a)!==fingerprint(old?.five_axis_findings.find(x=>x.axis===a.axis))})),paths_changed:fingerprint([h.winning_paths,h.placing_paths])!==fingerprint([old?.winning_paths,old?.placing_paths]),eye_changed:fingerprint(h.eye)!==fingerprint(old?.eye),formal_consumption:0};}),rank_candidate:null,eye_candidate:null,release_eligible:false};
}

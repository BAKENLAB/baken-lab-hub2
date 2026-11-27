import {assertFictionalTarget,fixtureEvidence,localAdmission} from './fictional-research-context.mjs';
import {historyDenominators} from './evidence-semantics.mjs';
const uniq=xs=>[...new Set(xs)].sort();
const fields=['course_id','course_version','distance_m','surface','going','class_key','eligibility','weight_rule_version'];
const exact=(a,b)=>!!a&&!!b&&fields.every(k=>a[k]!=null&&a[k]===b[k]);
const ref=gs=>uniq(gs.flatMap(g=>g.evidence_ids));
const roots=gs=>uniq(gs.map(g=>g.event_key));
// Historical comparable observations, not predicted probabilities. No supplied rank labels are read.
export function researchWinningPaths(args){
 if(args.target.circuit==='FIXTURE')throw Error('USE_SEPARATE_FIXTURE_ENTRY');
 return winningKernel(args,false);
}
export function researchWinningPathsFixture(args){
 const {target,roster,intake}=args;assertFictionalTarget(target,roster);
 if(intake.fixture_only!==true||intake.formal_admissions!==0||intake.accepted.some(g=>g.fixture_only!==true||g.formal_admission!==false||!fixtureEvidence(g.record)||!localAdmission(target,g.record)))throw Error('FIXTURE_INTAKE_REQUIRED');
 return winningKernel(args,true);
}
function winningKernel({target,roster,intake,typedAnalysis,pace,analysisRows=[],traceRead=()=>{}},fixture){
 const active=roster.filter(h=>h.active!==false).slice().sort((a,b)=>a.horse_no-b.horse_no);
 const ids=active.map(h=>h.horse_id);
 if(new Set(ids).size!==ids.length||ids.some(x=>typeof x!=='string'||!(fixture?x.startsWith('FIXTURE-'):x.startsWith(target.circuit+':'))))return {runners:active.map(h=>({horse_id:h.horse_id,winning_paths:[],placing_paths:[],unknowns:['ACTIVE_ID_UNVERIFIED']})),scenarios:[],comparisons:[],rank_candidate:null,release_eligible:false};
 const valid=intake.accepted;
 const card=Object.fromEntries(ids.map(id=>{const gs=valid.filter(g=>g.record.kind==='CURRENT_CARD'&&g.record.horse_id===id&&g.record.race_id===target.race_id);return [id,gs.length===1?gs[0]:null]}));
 const result=valid.filter(g=>g.record.kind==='RESULT'&&ids.includes(g.record.horse_id)&&g.record.race_id!==target.race_id);
 const validRef=new Set(valid.flatMap(g=>g.evidence_ids));
 const finished=result.filter(g=>g.record.fact.start_status==='FINISHED');
 const pos=valid.filter(g=>g.record.kind==='POSITIONS'&&ids.includes(g.record.horse_id));
 // Same historical race/horse can only appear once in a comparable cohort.
 const single=(gs,id,r)=>{const rows=gs.filter(g=>g.record.horse_id===id&&g.record.race_id===r);return rows.length===1?rows[0]:null};
 const scenarioMap=new Map([['CONDITION_MATCH_ONLY',{scenario_id:'CONDITION_MATCH_ONLY',assumptions:['No particular projected pace or order is assumed'],evidence_ids:[],calibrated:false}]]);
 for(const h of pace?.runners??[])for(const f of h.items?.['65']?.hypotheses??[]){
   const v=f.value;if(!(v?.competition_edges?.length||(fixture&&v?.certainty==='CONDITIONAL_NOT_VERIFIED_COMPETITION'&&v.observed_lead_candidate_ids?.length))||!f.evidence_ids?.length||!f.evidence_ids.every(e=>valid.some(g=>g.evidence_ids.includes(e))))continue;
   for(const name of ['CONTEST','YIELD']){const conditional=fixture&&v.certainty==='CONDITIONAL_NOT_VERIFIED_COMPETITION'&&v.scenarios?.includes(name==='CONTEST'?'CONTEST_IF_UNRESOLVED_OR_FORWARD_PEER_CHALLENGES':'YIELD_OR_UNCONTESTED_IF_NO_CHALLENGE');if(!v.scenarios?.includes(name)&&!conditional)continue;const prev=scenarioMap.get(name);scenarioMap.set(name,{scenario_id:name,assumptions:[name==='CONTEST'?'Lead candidates contest if a forward or unresolved peer challenges':'Lead candidates yield or no challenger emerges'],evidence_ids:uniq([...(prev?.evidence_ids??[]),...f.evidence_ids]),calibrated:false,...(fixture?{conditional_only:true,realized_pace:null,unresolved_front_horse_nos:uniq([...(prev?.unresolved_front_horse_nos??[]),...(v.unresolved_front_horse_nos??[])])}: {})});}
 }
 // Scenario witness is an observed historical pattern, not a current forecast.
 const scenarioFor=g=>{const f=g.record.fact;return f.observed_scenario_verified===true&&['CONTEST','YIELD'].includes(f.observed_scenario)?f.observed_scenario:null;};
 const scenarios=[...scenarioMap.values()].sort((a,b)=>a.scenario_id.localeCompare(b.scenario_id));
 const partialFields=fields.slice(0,6);
 const partialMatch=g=>!!card[g.record.horse_id]&&partialFields.every(k=>g.record.fact[k]!=null&&g.record.fact[k]===card[g.record.horse_id].record.fact[k]);
 const match=g=>card[g.record.horse_id]&&exact(g.record.fact,card[g.record.horse_id].record.fact);
 const comparisons=[];
 for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){
  const [a,b]=[ids[i],ids[j]].sort();
  for(const s of scenarios){
   const ar=finished.filter(g=>g.record.horse_id===a&&match(g)&&(s.scenario_id==='CONDITION_MATCH_ONLY'||scenarioFor(g)===s.scenario_id));
   const observations=[];
   for(const g of ar){const r=g.record.race_id,other=single(finished,b,r);
    if(!other||!single(finished,a,r)||!match(other)||!exact(g.record.fact,other.record.fact)||(s.scenario_id!=='CONDITION_MATCH_ONLY'&&scenarioFor(other)!==s.scenario_id))continue;
    const x=g.record.fact,y=other.record.fact;
    if(x.field_size!==y.field_size||g.record.event_at!==other.record.event_at)continue;
    if(fixture){const full=valid.filter(z=>z.record.kind==='RACE_FIELD'&&z.record.race_id===r&&z.record.event_at===g.record.event_at&&z.record.fact.fixture_full_field_consistent===true&&z.record.fact.field_size===x.field_size&&z.record.fact.runner_ids?.length===x.field_size&&new Set(z.record.fact.runner_ids).size===x.field_size&&z.record.fact.runner_ids.includes(a)&&z.record.fact.runner_ids.includes(b));if(full.length!==1)continue;}
    let direction=null;if(x.finish===y.finish){if(x.dead_heat_group&&x.dead_heat_group===y.dead_heat_group)direction='OFFICIAL_TIE';}else direction=x.finish<y.finish?a:b;
    if(direction)observations.push({race_id:r,direction,evidence_ids:ref([g,other,...[card[a],card[b]].filter(Boolean)]),event_keys:roots([g,other])});
   }
   const directions=uniq(observations.map(o=>o.direction));
   const status=!directions.length?'UNKNOWN':directions.length>1?'MIXED':directions[0]==='OFFICIAL_TIE'?'SUPPORTED_CLOSE':'SUPPORTED_ADVANTAGE';
   comparisons.push({pair_ids:[a,b],scenario_id:s.scenario_id,status,advantage_horse_id:status==='SUPPORTED_ADVANTAGE'?directions[0]:null,observations,comparability:'EXACT_TYPED_CONDITIONS_ONLY',final_strength_conclusion:null});
  }
 }
 const runners=active.map(h=>{
  const id=h.horse_id,own=result.filter(g=>g.record.horse_id===id),d=historyDenominators(own.map(g=>g.record.fact));
  const matched=finished.filter(g=>g.record.horse_id===id&&match(g));
  const nonmatching=finished.filter(g=>g.record.horse_id===id&&!match(g));
  const typed=typedAnalysis.find(x=>x.horse_id===id);
  const ownAnalysis=analysisRows.find(x=>x.horse_id===id)?.items??{};
  const contextRead=(itemId,keys)=>{const item=ownAnalysis[itemId];if(!item)return [];const values=[...(item.facts??[]),...(item.hypotheses??[]),...(item.counterevidence??[])].flatMap(o=>{if(!o.value||!o.evidence_ids?.length||!o.evidence_ids.every(e=>validRef.has(e)))return [];const value=Object.fromEntries(keys.filter(k=>Object.hasOwn(o.value,k)).map(k=>[k,o.value[k]]));return Object.keys(value).length?[{value,evidence_ids:o.evidence_ids,scope:'OBSERVED_OR_CONDITIONAL_NOT_CURRENT_PROOF'}]:[];});if(values.length)traceRead({consumer:'winningKernel.routeContext',consumer_item_id:'100',horse_no:h.horse_no,item_id:itemId,value:values,reason:'Selected analytical fields incorporated into route prerequisites and counter-context'});return values;};
  const routeContext=fixture?{peerFollowups:contextRead('37',['prior_race_id','peer_id','peer_finish','own_finish','later_race_id','source_availability']),competition:contextRead('65',['competition_edges','scenarios','observed_lead_candidate_ids','unresolved_front_horse_nos']),conditionChanges:contextRead('93',['condition_delta','direction_candidates','confirmed_effect']),adverseConditions:contextRead('94',['condition_delta','direction_candidates','confirmed_effect']),recurrence:contextRead('96',['prior_incident_context','current_scenario_context','recurrence_resolution']),repeat:contextRead('99',['matched_runs','repeated_win_observations','repeatability_conclusion']),content:contextRead('32',['latest','earlier','clock_difference_tenths','final3f_difference_tenths','gap_difference_tenths','formal_conditions_comparable'])}:null;
  const allPaths=scenarios.map(s=>{
    const observations=matched.filter(g=>s.scenario_id==='CONDITION_MATCH_ONLY'||scenarioFor(g)===s.scenario_id);
    const comparison=comparisons.filter(x=>x.scenario_id===s.scenario_id&&x.pair_ids.includes(id));
    const ahead=comparison.filter(x=>x.advantage_horse_id===id),behind=comparison.filter(x=>x.status==='SUPPORTED_ADVANTAGE'&&x.advantage_horse_id!==id),mixed=comparison.filter(x=>x.status==='MIXED');
    const win=observations.filter(g=>g.record.fact.finish===1),placing=observations.filter(g=>g.record.fact.finish<=3);
    const nonwin=observations.filter(g=>g.record.fact.finish!==1);
    const unknowns=[];if(!card[id])unknowns.push('CURRENT_CONDITION_UNKNOWN');if(!observations.length)unknowns.push('COMPARABLE_HISTORY_UNKNOWN');if(comparison.some(x=>x.status==='UNKNOWN'))unknowns.push('CURRENT_OPPONENT_COMPARISON_INCOMPLETE');if(s.scenario_id!=='CONDITION_MATCH_ONLY')unknowns.push('SCENARIO_REALIZATION_UNCERTAIN');
    const position=observations.flatMap(g=>{const p=single(pos,id,g.record.race_id);return p?[{race_id:g.record.race_id,positions:p.record.fact.positions,finish:g.record.fact.finish,evidence_ids:p.evidence_ids}]:[]});
    const evidence=uniq([...ref([...observations,...[card[id]].filter(Boolean)]),...comparison.flatMap(x=>x.observations.flatMap(o=>o.evidence_ids)),...position.flatMap(x=>x.evidence_ids),...s.evidence_ids]);
    const common={horse_id:id,scenario_id:s.scenario_id,scenario_assumptions:s.assumptions,historical_support:observations.map(g=>({race_id:g.record.race_id,finish:g.record.fact.finish,evidence_ids:g.evidence_ids})),opponent_comparison:comparison,current_condition_match:observations.length?true:null,required_events:['Comparable current conditions persist','Actual race scenario permits the observed performance'],counterevidence:{behind,mixed,nonwins:nonwin.map(g=>g.record.race_id),nonmatching_history:nonmatching.map(g=>({race_id:g.record.race_id,finish:g.record.fact.finish,condition_delta:fields.filter(k=>g.record.fact[k]!=null&&card[id]?.record.fact[k]!=null&&g.record.fact[k]!==card[id].record.fact[k]),evidence_ids:g.evidence_ids}))},unresolved_materials:unknowns,evidence_ids:evidence,upstream_item_ids:uniq([...(observations.length?['02','12','43']:[]),...(comparison.some(x=>x.observations.length)?['35']:[]),...(position.length?['17']:[]),...(s.evidence_ids.length?['65','69']:[])]),shared_mechanism_ids:uniq([...roots(observations),...comparison.flatMap(x=>x.observations.flatMap(o=>o.event_keys))]),position_observations:position,individual_speed_inferred:false,final_rank:null};
    // No threshold on historical wins; direct observed precedence over a current opponent can support a conditional route without a win.
    const finishReach=win.length>0||ahead.length>0;
    const winStatus=finishReach?(behind.length||mixed.length?'MIXED':ahead.length?'SUPPORTED_CONDITIONAL':'UNKNOWN'):behind.length?'COUNTERED':'UNKNOWN';
    const placeStatus=placing.length?(behind.length||mixed.length?'MIXED':'SUPPORTED_CONDITIONAL'):'UNKNOWN';
    const fixtureFields=kind=>{if(!fixture)return {};const pred=g=>kind==='WIN'?g.record.fact.finish===1:g.record.fact.finish<=3;const partial=s.scenario_id==='CONDITION_MATCH_ONLY'?finished.filter(g=>g.record.horse_id===id&&partialMatch(g)):[];const other=s.scenario_id==='CONDITION_MATCH_ONLY'?finished.filter(g=>g.record.horse_id===id&&!partialMatch(g)):[];const detail=g=>({race_id:g.record.race_id,finish:g.record.fact.finish,clock_tenths:g.record.fact.clock_tenths,evidence_ids:g.evidence_ids,formal_comparison:false});const contextRefs=uniq(Object.values(routeContext).flatMap(xs=>xs.flatMap(x=>x.evidence_ids)));const partialPositions=partial.flatMap(g=>{const p=single(pos,id,g.record.race_id);return p?[{race_id:g.record.race_id,finish:g.record.fact.finish,positions:p.record.fact.positions,complete:p.record.fact.fixture_segment_grid_complete===true,evidence_ids:p.evidence_ids,scope:'PARTIAL_CONDITION_HISTORICAL_POSITION_ONLY'}]:[]});return {route_context:routeContext,partial_position_observations:partialPositions,route_requirements:{peer_strength:'UNVALIDATED',current_conditions:'FORMAL_ELIGIBILITY_AND_WEIGHT_RULE_UNKNOWN',scenario:'NOT_REALIZED',newer_peer_observations:'CONTEXT_ONLY_NOT_PROOF_OF_CURRENT_SUPERIORITY'},evidence_ids:uniq([...common.evidence_ids,...ref([...partial,...other]),...contextRefs,...partialPositions.flatMap(x=>x.evidence_ids)]),historical_support:[...new Map([...common.historical_support,...partial.map(detail)].map(x=>[x.race_id,x])).values()],recorded_key_support:partial.filter(pred).map(detail),recorded_key_counter:partial.filter(g=>!pred(g)).map(detail),other_condition_reach:other.filter(pred).map(detail),comparison_coverage:{target_peer_count:active.length-1,unknown_peer_ids:comparison.filter(x=>x.status==='UNKNOWN').map(x=>x.pair_ids.find(q=>q!==id)),unbound_peer_horse_nos:[]},current_status:'UNKNOWN',fixture_only:true,conditional_history_scope:'PARTIAL_RECORDED_KEYS_NOT_FORMAL_COMPARABILITY'};};
    return {win:{...common,...fixtureFields('WIN'),path_id:id+'|'+s.scenario_id+'|WIN',finish_reach_support:{wins:win.map(g=>g.record.race_id),observed_ahead_of_current_peers:ahead.map(x=>x.pair_ids)},placing_only_support:placing.filter(g=>g.record.fact.finish!==1).map(g=>g.record.race_id),status:fixture?'UNKNOWN':winStatus},place:{...common,...fixtureFields('PLACE'),path_id:id+'|'+s.scenario_id+'|PLACE',finish_reach_support:null,placing_only_support:placing.map(g=>g.record.race_id),status:fixture?'UNKNOWN':placeStatus}};
  });
  return {horse_id:id,horse_no:h.horse_no,historical12:{...d,win_rate:d.actual_starts?d.wins/d.actual_starts:null,comparison_history_complete:false,typed_analysis:typed?.items?.['12']??null},winning_paths:fixture&&!own.length?[]:allPaths.map(x=>x.win),placing_paths:fixture&&!own.length?[]:allPaths.map(x=>x.place),rank_candidate:null};
 });
 return {runners,scenarios,comparisons,rank_candidate:null,release_eligible:false,research_version:'v0.2'};
}
export function researchRaceStructure({target,roster,winning,intake}){
 const horseIds=winning.runners.map(h=>h.horse_id).sort(),scenarios=winning.scenarios.map(s=>s.scenario_id);
 const byScenario=Object.fromEntries(scenarios.map(s=>[s,winning.runners.filter(h=>h.winning_paths.some(p=>p.scenario_id===s&&p.status==='SUPPORTED_CONDITIONAL')).map(h=>h.horse_id).sort()]));
 const byPlace=Object.fromEntries(scenarios.map(s=>[s,winning.runners.filter(h=>h.placing_paths.some(p=>p.scenario_id===s&&p.status==='SUPPORTED_CONDITIONAL')).map(h=>h.horse_id).sort()]));
 const base=winning.comparisons.filter(x=>x.scenario_id==='CONDITION_MATCH_ONLY');
 const total=horseIds.length*(horseIds.length-1)/2,comparable=base.filter(x=>x.status!=='UNKNOWN').length;
 const unknown=winning.runners.map(h=>({horse_id:h.horse_id,unknowns:uniq([...(h.unknowns??[]),...h.winning_paths.flatMap(p=>p.unresolved_materials)])}));
 const changes=[];
 for(const e of base){const variants=winning.comparisons.filter(x=>JSON.stringify(x.pair_ids)===JSON.stringify(e.pair_ids)&&x.scenario_id!=='CONDITION_MATCH_ONLY'&&x.status==='SUPPORTED_ADVANTAGE');
 if(uniq(variants.map(x=>x.advantage_horse_id)).length>1)changes.push({pair_ids:e.pair_ids,scenarios:variants.map(x=>({id:x.scenario_id,advantage:x.advantage_horse_id}))});}
 const hypothesis=[];
 const subset=byScenario.CONDITION_MATCH_ONLY??[];
 const broad=winning.runners.filter(h=>h.winning_paths.some(p=>p.scenario_id==='CONDITION_MATCH_ONLY'&&['SUPPORTED_CONDITIONAL','MIXED'].includes(p.status)&&p.finish_reach_support&&(p.finish_reach_support.wins.length||p.finish_reach_support.observed_ahead_of_current_peers.length))).map(h=>h.horse_id).sort();
 const supports=(a,b)=>base.some(e=>e.pair_ids.includes(a)&&e.pair_ids.includes(b)&&e.advantage_horse_id===a);
 const close=(a,b)=>base.some(e=>e.pair_ids.includes(a)&&e.pair_ids.includes(b)&&e.status==='SUPPORTED_CLOSE');
 // No numerical boundary is adopted: only narrowly defined evidence patterns are output.
 if(subset.length===1&&horseIds.length>1&&horseIds.filter(x=>x!==subset[0]).every(x=>supports(subset[0],x)))hypothesis.push({kind:'A',pattern:'ONE_CONDITIONAL_WIN_PATH_WITH_ALL_DIRECT_ADVANTAGES',classification:null});
 if(subset.length>1&&subset.length<horseIds.length&&subset.every(a=>subset.filter(b=>b!==a).every(b=>close(a,b))&&horseIds.filter(b=>!subset.includes(b)).every(b=>supports(a,b))))hypothesis.push({kind:'B',pattern:'SUBSET_CLOSE_AND_DIRECT_ADVANTAGES_OUTSIDE',classification:null});
 if(broad.length===horseIds.length&&horseIds.length>1&&comparable===total)hypothesis.push({kind:'C',pattern:'ALL_ACTIVE_HAVE_CONDITIONAL_PATH_AND_COMPARISON',classification:null});
 if(changes.length)hypothesis.push({kind:'D',pattern:'OBSERVED_SCENARIO_DIRECTION_REVERSAL',classification:null});
 if(comparable<total||unknown.some(x=>x.unknowns.length))hypothesis.push({kind:'E',pattern:'MATERIAL_OR_COMPARISON_UNKNOWN',classification:null});
 const program=intake.accepted.filter(g=>g.record.kind==='CURRENT_CARD'&&g.record.horse_id===null&&g.record.race_id===target.race_id&&g.record.fact.program_rule_verified===true&&typeof g.record.fact.rule_version==='string'&&typeof g.record.fact.selection_rule==='string');
 const special=program.length===1?program[0].record.fact.selection_rule??null:null;
 return {race_id:target.race_id,roster_version:target.roster_version??null,cutoff:target.cutoff,scenario_ids:scenarios,comparison_edges:winning.comparisons,supported_winning_path_horse_ids_by_scenario:byScenario,supported_placing_path_horse_ids_by_scenario:byPlace,material_unknowns_by_horse:unknown,comparative_coverage:{possible_pairs:total,comparable_pairs:comparable,unknown_pairs:total-comparable},scenario_sensitive_pairs:changes,structure_hypotheses:hypothesis,special_program_rule:special,classification_status:'RESEARCH_UNAPPROVED',no_s_reason:null,rank_changes:[],eye_changes:[],release_eligible:false};
}

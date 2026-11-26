import {researchWinningPaths,researchRaceStructure} from './winning-race-structure.mjs';
const uniq=xs=>[...new Set(xs)].sort();
const known=(h,target)=>typeof h.horse_id==='string'&&new RegExp('^'+target.circuit+':\\d+$').test(h.horse_id);
// Keep all roster rows, even when an entire historical comparison cannot be made.
export function bindResearchRoster({target,roster,rankAudit,intake}){
 const occurrences=new Map();
 for(const h of roster)if(h.horse_id!=null)occurrences.set(h.horse_id,(occurrences.get(h.horse_id)??0)+1);
 return roster.slice().sort((a,b)=>a.horse_no-b.horse_no).map(h=>{
 const matched=rankAudit.runners.find(r=>r.horse_no===h.horse_no);
 const cards=intake.accepted.filter(g=>g.record.kind==='CURRENT_CARD'&&g.record.race_id===target.race_id&&g.record.horse_id===h.horse_id);
 const reasons=[];
 if(h.active===false)reasons.push('CANCELLED_OR_INACTIVE');
 if(!known(h,target)||matched?.horse_id!==h.horse_id||occurrences.get(h.horse_id)!==1)reasons.push('ACTIVE_ID_UNVERIFIED_OR_DUPLICATE');
 if(cards.length!==1||cards[0]?.record.runner_no!==h.horse_no)reasons.push('CURRENT_CARD_RUNNER_UNBOUND');
 if(target.roster_version&&cards[0]?.record.fact.roster_version!==target.roster_version)reasons.push('ROSTER_VERSION_UNBOUND');
 if(cards[0]?.record.fact.active===false&&h.active!==false)reasons.push('CARD_ACTIVE_STATUS_CONFLICT');
 return {...h,horse_id:reasons.length?null:h.horse_id,provided_horse_id:h.horse_id??null,identity_status:reasons.length?'HOLD':'STRUCTURAL_BOUND',identity_unknowns:reasons};
 });
}
export function researchPathsV3({target,roster,intake,typedAnalysis,pace,rankAudit,traceRead=()=>{}}){
 const active=roster.filter(h=>h.active!==false),eligible=active.filter(h=>known(h,target)&&h.identity_status==='STRUCTURAL_BOUND');
 const old=researchWinningPaths({target,roster:eligible,intake,typedAnalysis,pace});
 const counts=new Map(eligible.map(h=>[h.horse_id,h.horse_no]));
 const byHorse=new Map(old.runners.map(h=>[h.horse_id,h]));
 const pending=active.filter(h=>!known(h,target)||h.identity_status!=='STRUCTURAL_BOUND');
 const resultByRace=(id,r)=>intake.accepted.find(g=>g.record.kind==='RESULT'&&g.record.horse_id===id&&g.record.race_id===r);
 const pairRows=old.comparisons.map(c=>{
 const observations=c.observations.map(o=>{
 const a=resultByRace(c.pair_ids[0],o.race_id),b=resultByRace(c.pair_ids[1],o.race_id);
 const af=a?.record.fact,bf=b?.record.fact;
 const delta=Number.isInteger(af?.clock_tenths)&&Number.isInteger(bf?.clock_tenths)?af.clock_tenths-bf.clock_tenths:null;
 return {...o,clock_difference_tenths:delta,official_tie:o.direction==='OFFICIAL_TIE',official_margin_pair_bound:af?.preceding_horse_id===c.pair_ids[1]||bf?.preceding_horse_id===c.pair_ids[0],historical_event_at:a?.record.event_at??null,current_relevance:'UNVALIDATED'};
 });
 return {...c,observations,historical_comparison_status:c.status,current_comparison_status:'UNKNOWN',current_closeness_status:'UNKNOWN',historical_closeness_status:observations.length&&observations.every(o=>o.official_tie)?'OBSERVED_TIE_ONLY':'UNESTABLISHED',pair_horse_nos:c.pair_ids.map(id=>counts.get(id))};
 });
 const runners=roster.map(h=>{
 if(h.active===false)return {horse_no:h.horse_no,horse_id:null,active:false,winning_paths:[],placing_paths:[],unknowns:['CANCELLED_OR_INACTIVE'],decision_status:'NOT_APPLICABLE',rank_candidate:null};
 const row=byHorse.get(h.horse_id);
 if(!row)return {horse_no:h.horse_no,horse_id:null,active:true,winning_paths:[],placing_paths:[],unknowns:uniq(['ACTIVE_ID_UNVERIFIED',...(h.identity_unknowns??[])]),decision_status:'HOLD_IDENTITY',rank_candidate:null};
 const historical=typedAnalysis.find(x=>x.horse_no===h.horse_no)?.items?.['12'];
 const rankRow=rankAudit?.runners.find(r=>r.horse_no===h.horse_no&&r.horse_id===h.horse_id);
 const readContext=(id,keys)=>{
 const item=rankRow?.items.find(x=>x.item_id===id),f=item?.finding;
 if(!f)return [];
 const list=Array.isArray(f)?f:[...(f.facts??[]),...(f.hypotheses??[]),...(f.counterevidence??[])];
 const observations=list.flatMap(x=>{const v=x.value??x;if(!v||typeof v!=='object')return [];const selected=Object.fromEntries(keys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,v[k]]));if(!Object.keys(selected).length)return [];return [{value:selected,evidence_ids:x.evidence_ids??[],scope:'RESEARCH_CONTEXT_NOT_CURRENT_PROOF'}];});
 if(observations.length)traceRead({consumer:'researchPathsV3.currentContext',consumer_item_id:'100',horse_no:h.horse_no,item_id:id,value:observations,reason:'Read specific analytical fields into current path conditions and unresolved comparative context'});
 return observations;
 };
 const context={opponent:readContext('40',['prior_race_id','current_field_profile','prior_field_profile','comparative_direction','conditions_match','difference_seconds']),direct:readContext('35',['pair_ids','shared_race','outcome','comparable_conditions']),indirect:readContext('36',['other_id','common_peer_id','race_links','relative_observations','comparability','transitive_conclusion']),laterPeers:readContext('37',['prior_race_id','peer_id','peer_finish','shared_followup_key']),ratings:readContext('38',['peer_id','performance_ref','rating','scope','edition']),classTransition:readContext('39',['prior_class_key','target_class_key','transition']),transfer:readContext('42',['transition_direction','before','after','comparability']),distance:readContext('43',['current_value','exact_condition_races','profiles','admitted_residual_seconds']),course:readContext('45',['current_value','exact_condition_races','profiles']),going:readContext('48',['current_value','exact_condition_races','profiles']),frontCompetition:readContext('65',['competition_edges','scenarios','pace_conclusion']),pace:readContext('69',['benchmark_n','observed_range_seconds','scenario_assumptions','pace_band','probability']),scenarioFit:readContext('73',['scenario_candidates','historical_observations','scenario_fit','uncertainty']),weight:readContext('81',['body_weight_kg','delta_kg','reported_delta_conflict']),person:readContext('88',['rider_transition','previous_rider','current_rider','improvement']),favorable:readContext('93',['condition_delta','direction_candidates','confirmed_effect']),adverse:readContext('94',['condition_delta','direction_candidates','confirmed_effect']),mechanisms:readContext('97',['linked_mechanism_groups','independence_confirmed','joint_scenario']),repeat:readContext('99',['matched_runs','repeated_win_observations','repeatability_conclusion'])};
 const contextEvidence=uniq(Object.values(context).flatMap(xs=>xs.flatMap(x=>x.evidence_ids)));
 if(historical)traceRead({consumer:'researchPathsV3.historical12',horse_no:h.horse_no,item_id:'12',value:historical,reason:'Observed wins, nonwins and actual-start denominator attached to historical assessment; not a current judgment'});
 const evaluate=(p,kind)=>{
 const peer=pairRows.filter(x=>x.scenario_id===p.scenario_id&&x.pair_ids.includes(h.horse_id));
 const missing=peer.filter(x=>x.status==='UNKNOWN').map(x=>x.pair_ids.find(id=>id!==h.horse_id));
 const unbound=pending.map(x=>x.horse_no);
 const hs=p.historical_support??[];
 const winRecords=hs.filter(x=>x.finish===1).map(x=>{const g=resultByRace(h.horse_id,x.race_id);return {race_id:x.race_id,event_at:g?.record.event_at??null,condition_scope:'EXACT_TYPED_CONDITION_FIELDS',opponent_strength:g?.record.fact.opponent_strength_verified===true?'WITNESS_PRESENT_NOT_ADMITTED':'UNKNOWN',evidence_ids:x.evidence_ids};});
 const ahead=peer.filter(x=>x.advantage_horse_id===h.horse_id),behind=peer.filter(x=>x.status==='SUPPORTED_ADVANTAGE'&&x.advantage_horse_id!==h.horse_id),mixed=peer.filter(x=>x.status==='MIXED');
 const positive=kind==='WIN'?(winRecords.length>0||ahead.length>0):(p.placing_only_support?.length??0)>0;
 const opposing=behind.length>0||mixed.length>0;
 const partial=positive&&opposing?'MIXED_HISTORICAL_EVIDENCE':positive?'HISTORICAL_SUPPORT_CANDIDATE':opposing?'HISTORICAL_COUNTER_CANDIDATE':'UNKNOWN';
 const otherPeer=peer.flatMap(x=>x.observations).length;
 const fieldCoverage=context.opponent.flatMap(x=>x.value.current_field_profile?[{denominator:x.value.current_field_profile.denominator,covered:x.value.current_field_profile.covered}]:[]);
 const currentConditionChanges=[...new Map([...context.favorable,...context.adverse].flatMap(x=>x.value.condition_delta??[]).map(x=>[JSON.stringify(x),x])).values()];
 return {...p,horse_no:h.horse_no,analysis_context:context,context_evidence_ids:contextEvidence,current_field_profile_coverage:fieldCoverage,condition_change_observations:currentConditionChanges,opponent_comparison:peer,historical_status:partial,legacy_historical_status:p.status,status:'UNKNOWN',current_path_status:'UNVALIDATED_CURRENT_FIELD',current_relevance:'UNVALIDATED',finish_reach_support:kind==='WIN'?{...p.finish_reach_support,historical_win_details:winRecords,direct_pair_observation_count:otherPeer}:null,alternative_win_route:kind==='WIN'&&winRecords.length&&!ahead.length?{status:'HISTORICAL_WIN_ROUTE_CANDIDATE',required:['Comparable opponent strength','Current relevance','Independent confirmation of win content'],evidence_ids:uniq(winRecords.flatMap(x=>x.evidence_ids))}:null,comparison_coverage:{target_peer_count:active.length-1,known_direct_peers:peer.filter(x=>x.status!=='UNKNOWN').length,unknown_peer_ids:missing,unbound_peer_horse_nos:unbound},unresolved_materials:uniq([...p.unresolved_materials,'CURRENT_RELEVANCE_NOT_VALIDATED','CURRENT_FIELD_STRENGTH_NOT_VALIDATED',...(fieldCoverage.some(x=>x.covered<x.denominator)?['CURRENT_FIELD_PROFILE_INCOMPLETE']:[]),...(currentConditionChanges.length?['CONDITION_CHANGE_EFFECT_UNVALIDATED']:[]),...(missing.length||unbound.length?['CURRENT_OPPONENT_COMPARISON_INCOMPLETE']:[])]),required_events:[...p.required_events,'Current comparative strength and relevance independently established'],final_rank:null};
 };
 return {...row,horse_no:h.horse_no,active:true,winning_paths:row.winning_paths.map(p=>evaluate(p,'WIN')),placing_paths:row.placing_paths.map(p=>evaluate(p,'PLACE')),unknowns:uniq(h.identity_unknowns??[]),decision_status:'RESEARCH_ONLY'};
 });
 return {runners,scenarios:old.scenarios,comparisons:pairRows,unbound_active_horse_nos:pending.map(h=>h.horse_no),rank_candidate:null,release_eligible:false,research_version:'v0.3'};
}
export function raceStructureV3({target,roster,winning,intake}){
 const active=winning.runners.filter(h=>h.active!==false);
 const old=researchRaceStructure({target,roster,winning:{...winning,runners:active},intake});
 const base=winning.comparisons.filter(x=>x.scenario_id==='CONDITION_MATCH_ONLY');
 const historical=active.filter(h=>h.winning_paths.some(p=>p.scenario_id==='CONDITION_MATCH_ONLY'&&['HISTORICAL_SUPPORT_CANDIDATE','MIXED_HISTORICAL_EVIDENCE'].includes(p.historical_status))).map(h=>h.horse_no);
 const total=active.length*(active.length-1)/2,comparable=base.filter(x=>x.status!=='UNKNOWN').length;
 const allTie=total>0&&base.length===total&&base.every(x=>x.historical_closeness_status==='OBSERVED_TIE_ONLY');
 const diagnostics=[];
 if(historical.length===active.length&&active.length>1&&comparable===total)diagnostics.push({pattern:'BROAD_HISTORICAL_ROUTE_COVERAGE',classification:null,does_not_establish:'C'});
 if(allTie)diagnostics.push({pattern:'ALL_PAIRS_HISTORICAL_TIE_OBSERVATIONS',classification:null,does_not_establish:'CURRENT_CLOSENESS'});
 const historicalDominant=active.filter(h=>h.horse_id&&active.filter(x=>x.horse_no!==h.horse_no).every(x=>x.horse_id&&base.some(c=>c.pair_ids.includes(h.horse_id)&&c.pair_ids.includes(x.horse_id)&&c.advantage_horse_id===h.horse_id)));
 if(active.length>1&&historicalDominant.length===1)diagnostics.push({pattern:'ALL_DIRECT_HISTORICAL_ADVANTAGES',horse_no:historicalDominant[0].horse_no,classification:null});
 return {...old,material_unknowns_by_horse:active.map(h=>({horse_no:h.horse_no,horse_id:h.horse_id,unknowns:uniq([...(h.unknowns??[]),...h.winning_paths.flatMap(p=>p.unresolved_materials)])})),comparative_coverage:{possible_pairs:total,historical_comparable_pairs:comparable,historical_unknown_pairs:total-comparable,current_comparable_pairs:0,current_unknown_pairs:total},historical_pattern_diagnostics:diagnostics,structure_hypotheses:old.structure_hypotheses.filter(x=>['D','E'].includes(x.kind)),classification_status:'RESEARCH_UNAPPROVED_CURRENT_CLOSENESS_UNKNOWN',rank_changes:[],eye_changes:[]};
}

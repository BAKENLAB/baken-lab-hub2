import {historyDenominators} from './evidence-semantics.mjs';
// Typed research overlay. A missing measurement is not a negative ability conclusion.
export function analyzeTyped01to32({target,roster,intake,traceRead=()=>{}}){
 const ids=Array.from({length:32},(_,i)=>String(i+1).padStart(2,'0'));
 const accepted=intake.accepted;
 const keyset=['course_id','course_version','distance_m','surface','going','class_key'];
 const exact=(a,b)=>!!a&&!!b&&keyset.every(k=>a[k]!=null&&a[k]===b[k]);
 const uniq=xs=>[...new Set(xs)].sort();
 return roster.slice().sort((a,b)=>a.horse_no-b.horse_no).map(h=>{
 const items=Object.fromEntries(ids.map(id=>[id,{observations:[],unknowns:[],status:'UNKNOWN',final_consumption:false}]));
 const own=accepted.filter(g=>g.record.horse_id===h.horse_id&&h.horse_id!==null);
 const byKind=k=>own.filter(g=>g.record.kind===k);
 const results=byKind('RESULT'),finished=results.filter(g=>g.record.fact.start_status==='FINISHED');
 const card=byKind('CURRENT_CARD').filter(g=>g.record.race_id===target.race_id),curr=card.length===1?card[0].record.fact:null;
 const chronological=byKind('HISTORY').filter(g=>g.record.race_id===target.race_id&&g.record.fact.chronology_verified===true&&Array.isArray(g.record.fact.ordered_actual_start_race_ids));
 const declaredOrder=chronological.length===1?chronological[0].record.fact.ordered_actual_start_race_ids:[];
 const order=new Set(declaredOrder).size===declaredOrder.length?declaredOrder:[];
 const get=(xs,race)=>{const rs=xs.filter(g=>g.record.race_id===race);return rs.length===1?rs[0]:undefined;};
 const put=(id,kind,value,groups,upstream=[])=>{if(!groups.length)return;items[id].observations.push({kind,value,evidence_ids:uniq(groups.flatMap(g=>g.evidence_ids)),original_event_keys:uniq(groups.map(g=>g.event_key)),upstream_item_ids:upstream,status:'STRUCTURAL_RESEARCH_CANDIDATE'});items[id].status='CANDIDATE_OUTPUT';};
 const unknown=(id,reason)=>items[id].unknowns.push(reason);
 for(const g of results){
 const f=g.record.fact,r=g.record.race_id;
 put('02','OFFICIAL_START_STATE',{race_id:r,start_status:f.start_status,finish:f.finish,field_size:f.field_size??null},[g]);
 if(f.start_status!=='FINISHED')continue;
 if(f.winner_gap_tenths!=null||f.margin_reference==='WINNER')put('03','WINNER_GAP',{race_id:r,clock_gap_tenths:f.winner_gap_tenths??null,official_margin:f.margin_reference==='WINNER'?f.official_margin:null,dead_heat_group:f.dead_heat_group??null},[g]);
 // A following finisher's official margin is only usable when its preceding horse is explicitly bound.
 for(const p of accepted.filter(x=>x.record.kind==='PEER_RESULT'&&x.record.race_id===r&&x.record.event_at===g.record.event_at&&x.record.fact.field_size===f.field_size&&x.record.horse_id!==h.horse_id&&x.record.fact.start_status==='FINISHED'&&x.record.fact.margin_reference==='PRECEDING_FINISHER'&&x.record.fact.preceding_horse_id===h.horse_id&&x.record.fact.finish>f.finish&&typeof x.record.fact.official_margin==='string')){
 const q=p.record.fact;
 // A named preceding finisher is necessary but rank adjacency also needs to agree.
 // For dead heats the next rank can skip a number; require a complete official field witness for that case.
 const field=accepted.find(x=>x.record.kind==='RACE_FIELD'&&x.record.race_id===r&&x.record.event_at===g.record.event_at&&x.record.fact.field_size===f.field_size&&x.record.fact.complete_field_verified===true);
 const allRows=field?.record.fact.runner_ids.map(id=>{const rs=accepted.filter(x=>['RESULT','PEER_RESULT'].includes(x.record.kind)&&x.record.horse_id===id&&x.record.race_id===r&&x.record.event_at===g.record.event_at&&x.record.fact.field_size===f.field_size);return rs.length===1?rs[0]:null;});
 const full=!!allRows&&!allRows.some(x=>!x);
 const intervening=full&&allRows.some(x=>x.record.fact.start_status==='FINISHED'&&x.record.fact.finish>f.finish&&x.record.fact.finish<q.finish);
 if(intervening||q.finish!==f.finish+1&&!full){unknown('04','FOLLOWING_RANK_ADJACENCY_UNRESOLVED:'+r);continue;}
 put('04','FOLLOWING_HORSE_MARGIN',{race_id:r,following_horse_id:p.record.horse_id,official_margin:q.official_margin,clock_gap_tenths:f.clock_tenths!=null&&q.clock_tenths!=null&&q.clock_tenths>=f.clock_tenths?q.clock_tenths-f.clock_tenths:null,adjacency_scope:full?'FULL_FIELD':'CONSECUTIVE_RANK'},[g,p,...(full?[field,...allRows]:[])],['02','05']);}
 if(f.clock_tenths!=null)put('05','DISPLAY_CLOCK',{race_id:r,tenths:f.clock_tenths},[g]);
 if(f.final3f_tenths!=null)put('06','INDIVIDUAL_FINAL3F',{race_id:r,tenths:f.final3f_tenths},[g]);
 if(f.finish>1&&(f.winner_gap_tenths!=null||f.margin_reference==='WINNER'))put('28','DEFEAT_GAP_CANDIDATE',{race_id:r,finish:f.finish,gap_tenths:f.winner_gap_tenths??null,narrow_threshold:null},[g],['02','03']);
 if(f.finish===1)put('30','WIN_OBSERVATION',{race_id:r,clock_tenths:f.clock_tenths,condition_match:exact(f,curr),opponent_value:null},[g,...card],['02','05']);
 }
 for(const g of byKind('INDIVIDUAL_SPLITS')){
 const f=g.record.fact,s=f.splits.map(x=>({...x,mean_mps:(x.end_m-x.start_m)*10/x.elapsed_tenths}));
 const d=s.slice(1).map((x,i)=>({from_end_m:s[i].end_m,to_end_m:x.end_m,mean_speed_difference_mps:x.mean_mps-s[i].mean_mps}));
 if(d.length){put('07','INDIVIDUAL_INTERVAL_SPEED_CHANGE',{race_id:g.record.race_id,speed_changes:d,instantaneous_acceleration:null},[g]);put('08','INDIVIDUAL_SPEED_PROFILE',{race_id:g.record.race_id,splits:s,sustained_ability:null},[g]);}
 if(s.length>=2&&s[0].start_m===0)put('10','START_INTERVAL_MEAN_SPEED_CHANGE',{race_id:g.record.race_id,first_two:s.slice(0,2),mean_speed_difference_mps:s[1].mean_mps-s[0].mean_mps,second_step_acceleration:null},[g]);
 }
 const incident=byKind('INCIDENT');
 for(const g of incident){
 const f=g.record.fact;put('26','OFFICIAL_INCIDENT',{race_id:g.record.race_id,code:f.incident_code,role:f.role},[g]);
 const r=get(finished,g.record.race_id);
 if(f.role==='SUFFERED'&&r)put('27','INCIDENT_AND_FINISH',{race_id:g.record.race_id,finish:r.record.fact.finish,role:f.role,overcame:null},[g,r],['02','26']);
 }
 if(results.length){
 const d=historyDenominators(results.map(g=>g.record.fact));
 const actualRaceIds=uniq(results.filter(g=>['FINISHED','DNF_STARTED','DQ_STARTED'].includes(g.record.fact.start_status)).map(g=>g.record.race_id));
 const coverage=byKind('INCIDENT_COVERAGE').filter(g=>g.record.race_id===target.race_id&&g.record.fact.actual_start_race_ids.length===actualRaceIds.length&&g.record.fact.actual_start_race_ids.every(id=>actualRaceIds.includes(id)));
 put('12','HISTORICAL_WIN_NONWIN_DENOMINATORS',{...d,win_rate:d.actual_starts?d.wins/d.actual_starts:null,win_race_ids:finished.filter(g=>g.record.fact.finish===1).map(g=>g.record.race_id),nonwin_race_ids:results.filter(g=>['FINISHED','DNF_STARTED','DQ_STARTED'].includes(g.record.fact.start_status)&&g.record.fact.finish!==1).map(g=>g.record.race_id),full_history_verified:false},results,['02']);
 const delayed=uniq(incident.filter(g=>actualRaceIds.includes(g.record.race_id)&&g.record.fact.incident_code==='START_DELAY'&&['SELF','SUFFERED'].includes(g.record.fact.role)).map(g=>g.record.race_id));
 const unknownRoles=incident.filter(g=>actualRaceIds.includes(g.record.race_id)&&g.record.fact.incident_code==='START_DELAY'&&g.record.fact.role==='UNKNOWN');
 if(incident.length||coverage.length===1)put('09','START_INCIDENT_OBSERVATIONS',{observed_actual_starts:d.actual_starts,start_incident_races:delayed,incident_coverage_complete:coverage.length===1&&!unknownRoles.length,frequency:coverage.length===1&&!unknownRoles.length&&d.actual_starts?delayed.length/d.actual_starts:null,stability_conclusion:null},[...results,...incident,...coverage],['02','26']);
 }
 for(const g of byKind('POSITIONS')){
 const f=g.record.fact,q=f.positions.slice().sort((a,b)=>a.segment-b.segment);
 put('17','POSITION_RANGES',{race_id:g.record.race_id,positions:q,field_size:f.field_size},[g]);
 const d=q.slice(1).flatMap((p,i)=>p.segment===q[i].segment+1?[{from:q[i].segment,to:p.segment,min_gain:q[i].rank_min-p.rank_max,max_gain:q[i].rank_max-p.rank_min}]:[]);
 if(d.length){put('18','POSITION_TRANSITIONS',{race_id:g.record.race_id,transitions:d},[g],['17']);put('22','DEFINITE_POSITION_GAINS',{race_id:g.record.race_id,gains:d.filter(x=>x.min_gain>0),speed_measured:false},[g],['17','18']);}
 const rec=d.flatMap((x,i)=>x.max_gain<0?d.slice(i+1).filter(y=>y.min_gain>0).map(y=>({loss:x,recovery:y})):[]);
 if(rec.length)put('21','LOSS_AND_RECOVERY',{race_id:g.record.race_id,rec,cause:null},[g],['17','18']);
 const r=get(finished,g.record.race_id);
 const laps=accepted.filter(x=>x.record.kind==='RACE_LAPS'&&x.record.race_id===g.record.race_id);
 if(laps.length&&r)put('20','RACE_PACE_POSITION_CONTEXT',{race_id:g.record.race_id,transitions:d,finish:r.record.fact.finish,causal_advantage:null},[g,r,...laps],['17','18','19']);
 if(d.length&&r&&laps.length&&q[0]?.rank_max<=3&&d.at(-1).max_gain<0)put('23','EARLY_FORWARD_LATE_LOSS_CONTEXT',{race_id:g.record.race_id,initial_rank:[q[0].rank_min,q[0].rank_max],late_transition:d.at(-1),finish:r.record.fact.finish,competition_cause:null,individual_fatigue:null},[g,r,...laps],['17','18','19']);
 if(d.length&&r){const last=d.at(-1);if(last.max_gain<0)put('24','LATE_POSITION_LOSS',{race_id:g.record.race_id,late_transition:last,cause:null},[g,r],['18','02']);if(last.min_gain>0&&r.record.fact.finish>1)put('25','LATE_GAIN_WITHOUT_WIN',{race_id:g.record.race_id,late_transition:last,finish:r.record.fact.finish,remaining_energy:null},[g,r],['18','02']);}
 }
 const raceIds=new Set(results.map(g=>g.record.race_id));
 for(const g of accepted.filter(x=>x.record.kind==='RACE_LAPS'&&raceIds.has(x.record.race_id))){
 const split=g.record.fact.splits;
 put('19','LEADER_LAPS',{race_id:g.record.race_id,splits:split,leader_interval_mean_mps:split.map(s=>({start_m:s.start_m,end_m:s.end_m,mean_mps:(s.end_m-s.start_m)*10/s.elapsed_tenths})),observed_total_tenths:split.reduce((n,s)=>n+s.elapsed_tenths,0),individual:false},[g]);}
 for(const g of byKind('RATING')){const f=g.record.fact;if(Number.isFinite(f.rating)&&typeof f.rating_scope==='string'&&typeof f.rating_version==='string')put('16','OFFICIAL_RATING_CANDIDATE',{rating:f.rating,scope:f.rating_scope,version:f.rating_version},[g]);}
 const match=finished.filter(g=>exact(g.record.fact,curr));
 if(match.length>=2){
 const values=match.map(g=>({race_id:g.record.race_id,finish:g.record.fact.finish,clock_tenths:g.record.fact.clock_tenths}));
 const ranks=values.map(v=>v.finish),clocks=values.map(v=>v.clock_tenths).filter(Number.isInteger);
 put('13','MATCHED_CONDITION_RESULT_SPREAD',{values,finish_range:[Math.min(...ranks),Math.max(...ranks)],display_clock_range_tenths:clocks.length===values.length?[Math.min(...clocks),Math.max(...clocks)]:null,baseline_adjusted_spread:null,stability_conclusion:null},[...match,...card],['02','05']);
 }
 if(order.length>=2){const a=get(finished,order[0]),b=get(finished,order[1]);if(a&&b&&Date.parse(a.record.event_at)>Date.parse(b.record.event_at)&&exact(a.record.fact,b.record.fact)){
 const af=a.record.fact,bf=b.record.fact;
 const delta={latest:a.record.race_id,previous:b.record.race_id,clock_difference_tenths:af.clock_tenths!=null&&bf.clock_tenths!=null?af.clock_tenths-bf.clock_tenths:null,finish_difference:af.finish-bf.finish,final3f_difference_tenths:af.final3f_tenths!=null&&bf.final3f_tenths!=null?af.final3f_tenths-bf.final3f_tenths:null,winner_gap_difference_tenths:af.winner_gap_tenths!=null&&bf.winner_gap_tenths!=null?af.winner_gap_tenths-bf.winner_gap_tenths:null,field_size_difference:af.field_size-bf.field_size,ability_change:null};
 put('32','IMMEDIATE_COMPARABLE_CHANGE',delta,[a,b,...chronological],['02','05']);put('14','CHRONOLOGICAL_CONTENT_CHANGE',delta,[a,b,...chronological],['32']);
 }}
 // Multi-run chronology comparison: no improvement label is derived from raw clock direction alone.
 if(order.length>=3){const ordered=order.map(r=>get(finished,r));if(ordered.every(Boolean)&&ordered.every((g,i)=>i===0||Date.parse(ordered[i-1].record.event_at)>Date.parse(g.record.event_at))){const common=ordered.filter(g=>exact(g.record.fact,ordered[0].record.fact));if(common.length>=3)put('14','MATCHED_CHRONOLOGICAL_SERIES',{race_ids:common.map(g=>g.record.race_id),clock_tenths:common.map(g=>g.record.fact.clock_tenths),final3f_tenths:common.map(g=>g.record.fact.final3f_tenths??null),finishes:common.map(g=>g.record.fact.finish),excluded_nonmatching:ordered.filter(g=>!common.includes(g)).map(g=>g.record.race_id),baseline_adjusted_trend:null,ability_change:null},[...common,...chronological],['02','05','06','32']);}}
 const distanceGroups=new Map();for(const g of finished){const f=g.record.fact;if(!Number.isInteger(f.distance_m)||f.final3f_tenths==null)continue;const k=JSON.stringify([f.course_id,f.course_version,f.surface,f.going,f.class_key,f.distance_m]);if(!distanceGroups.has(k))distanceGroups.set(k,[]);distanceGroups.get(k).push(g);}
 if(distanceGroups.size>1)put('11','DISTANCE_CONTEXT_OBSERVATIONS',{groups:[...distanceGroups].map(([k,gs])=>({condition_key:k,final3f_tenths:gs.map(g=>g.record.fact.final3f_tenths)})),fatigue_conclusion:null},[...distanceGroups.values()].flat(),['05','06']);
 for(const g of finished.filter(g=>g.record.fact.finish>1)){
 const f=g.record.fact,r=g.record.race_id;
 const peers=accepted.filter(p=>p.record.kind==='PEER_RESULT'&&p.record.race_id===r&&p.record.event_at===g.record.event_at&&p.record.horse_id!==h.horse_id&&p.record.fact.start_status==='FINISHED'&&p.record.fact.field_size===f.field_size);
 if(peers.length&&(f.winner_gap_tenths!=null||f.margin_reference==='WINNER'))put('29','DEFEAT_WITH_SHARED_RACE_PEERS',{race_id:r,finish:f.finish,winner_gap_tenths:f.winner_gap_tenths??null,peers:peers.map(p=>({horse_id:p.record.horse_id,finish:p.record.fact.finish})),peer_quality:null,ability_conclusion:null},[g,...peers],['02','03','28']);
 const special=incident.filter(i=>i.record.race_id===r&&i.record.fact.role==='SUFFERED');
 if(special.length)put('31','DEFEAT_WITH_OFFICIAL_INCIDENT',{race_id:r,finish:f.finish,incidents:special.map(i=>i.record.fact.incident_code),causal_attribution:null},[g,...special],['02','26','28']);
 if(exact(f,curr)){const recovery=items['21'].observations.filter(x=>x.value.race_id===r);if(recovery.length)traceRead({consumer:'analyzeTyped01to32.latentRecovery',consumer_item_id:'15',horse_no:h.horse_no,item_id:'21',value:recovery,reason:'Read actual recovery observation for current condition candidate'});if(recovery.length)put('15','CURRENT_MATCH_HISTORICAL_RECOVERY',{race_id:r,finish:f.finish,observed_recovery:recovery.map(x=>x.value),latent_ability:null},[g,...card,...accepted.filter(q=>recovery.some(x=>x.original_event_keys.includes(q.event_key)))],['21','32']);}
 }
 // 01 combines typed evidence descriptions without counting them as votes.
 const base=ids.slice(1,16).flatMap(id=>{if(items[id].observations.length)traceRead({consumer:"analyzeTyped01to32.baseBundle",consumer_item_id:"01",horse_no:h.horse_no,item_id:id,value:items[id],reason:"Read historical component output into base evidence bundle"});return items[id].observations.map(o=>({item_id:id,kind:o.kind,original_event_keys:o.original_event_keys}));});
 const root=uniq(base.flatMap(x=>x.original_event_keys));
 if(root.length)put('01','BASE_EVIDENCE_BUNDLE',{items:base,current_ability:null},accepted.filter(g=>root.includes(g.event_key)),ids.slice(1,16));
 for(const [id,reason] of Object.entries({'01':'CURRENT_OPPONENT_AND_ABILITY_UNVALIDATED','07':'INSTANTANEOUS_ACCELERATION_UNMEASURED','08':'SUSTAINED_ABILITY_UNVALIDATED','10':'SECOND_STEP_ACCELERATION_UNMEASURED','11':'DISTANCE_FATIGUE_CAUSALITY_UNVALIDATED','12':'CURRENT_WINNING_PATH_NOT_HISTORICAL_RATE','15':'LATENT_ABILITY_CAUSAL_CHAIN_UNVALIDATED','20':'COUNTERFACTUAL_PACE_UNVALIDATED','23':'COMPETITION_FATIGUE_UNVALIDATED','24':'CAUSE_UNVERIFIED','25':'REMAINING_ENERGY_UNMEASURED','27':'OVERCOMING_CAUSALITY_UNVALIDATED','29':'COMPARABLE_OPPONENT_QUALITY_UNVALIDATED','30':'WIN_VALUE_UNVALIDATED','31':'SPECIAL_CONDITION_CAUSALITY_UNVALIDATED'}))unknown(id,reason);
 for(const id of ids)if(!items[id].observations.length)unknown(id,'NO_TYPED_ANALYSIS_OUTPUT');
 return {horse_no:h.horse_no,horse_id:h.horse_id,items};
 });
}

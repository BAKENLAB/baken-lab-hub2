import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {abilityResearch115v5} from './derive-research-v5.mjs';
import {dependencyLedger} from './dependency-ledger.mjs';
const definitions=JSON.parse(readFileSync(new URL('./analysis-contract-115-v5.json',import.meta.url),'utf8')).items;
const deps=dependencyLedger(definitions);
const uniq=x=>[...new Set(x)];
const finite=Number.isFinite,integer=Number.isInteger;
const finish=x=>integer(x)&&x>0;
const num=x=>finite(x)?x:null;
const range=x=>x.length?[Math.min(...x),Math.max(...x)]:null;
const mean=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
const hash=x=>createHash('sha256').update(x).digest('hex');
const pos=r=>Array.isArray(r.reported_positions)&&r.reported_positions.length&&r.reported_positions.every(x=>integer(x)&&x>0)?r.reported_positions:[];
const compact=r=>({observation_id:r.observation_id,relative_run:r.relative_run,finish:r.finish,elapsed_tenths:r.elapsed_tenths,final3f_tenths:r.final3f_tenths,distance_m:r.distance_m,going:r.going,surface:r.surface,class_label:r.class_label});
const compare=(r,t)=>{const keys=['surface','distance_m','going'];return {matched:keys.filter(k=>r[k]!=null&&r[k]===t[k]),different:keys.filter(k=>r[k]!=null&&t[k]!=null&&r[k]!==t[k]),unknown:[...keys.filter(k=>r[k]==null||t[k]==null),'track','course_version','formal_class','eligibility','weight_rule'],raw_class_label:r.class_label,target_class_label:t.class_label,fully_comparable:false};};
function blocked(x){if(x&&typeof x==='object')for(const [k,v] of Object.entries(x)){if(/odds|popularity|market|tansho|ninki|人気|オッズ/i.test(k))throw Error('MARKET_IN_ABILITY_INPUT');blocked(v);}}
export function analyzeGeminiFixture(input){
 blocked(input);
 if(input.schema!=='gemini-synthetic-field-observations-v1'||input.fixture_only!==true||input.official_evidence!==false||input.production_admission!==false)throw Error('FIXTURE_ONLY_REQUIRED');
 const t=input.target,roster=input.runners;
 if(roster.length!==7||t.field_size!==7||new Set(roster.map(h=>h.horse_id)).size!==7||new Set(roster.map(h=>h.horse_no)).size!==7||roster.some(h=>!/^FIXTURE-[A-G]$/.test(h.horse_id)))throw Error('FIXTURE_ROSTER');
 const rawHist=roster.flatMap(h=>h.history);
 if(new Set(rawHist.map(r=>r.observation_id)).size!==rawHist.length||rawHist.some(r=>r.official_identity_verified!==false||r.formal_class_verified!==false||r.race_id!==null))throw Error('FIXTURE_SOURCE_BOUNDARY');
 // Try the unmodified v5 entry without invented circuit, cutoff, past race IDs or evidence.
 let normal;
 try{abilityResearch115v5({rankArgs:{oppositionArgs:{target:{...t,started_at:t.scheduled_start},roster}},initialRecords:[],discoveredRecords:[]});normal={status:'UNEXPECTED_ENTRY_SUCCESS_STOP'};}catch(e){normal={status:'BLOCKED',reason:e.message};}
 if(normal.status!=='BLOCKED')throw Error('NORMAL_GATE_UNEXPECTED');
 const conflicts=input.source_conflicts;
 const histories=new Map(roster.map(h=>[h.horse_id,h.history.map(r=>{const q={...r};for(const c of conflicts.filter(c=>c.horse_id===h.horse_id)){if(c.field==='last_run.reported_gap_tenths'&&q.relative_run===1)q.reported_gap_tenths=null;if(c.field==='last_run.going'&&q.relative_run===1)q.going=null;}return q;}).sort((a,b)=>a.relative_run-b.relative_run)]));
 const active=roster.filter(h=>h.active===true);
 const front=active.map(h=>{const a=histories.get(h.horse_id),last=a.find(r=>r.relative_run===1),p=pos(last??{});return {horse_id:h.horse_id,horse_no:h.horse_no,reported_style:h.reported_style,last_positions:p.length?p:null,last_any_le3:p.length?p.some(n=>n<=3):null,last_first_le3:p.length?p[0]<=3:null,first_recorded_lead_count:a.filter(r=>pos(r)[0]===1).length,observed_position_runs:a.filter(r=>pos(r).length).length,source_refs:a.filter(r=>pos(r).length).map(r=>r.observation_id)};});
 const yes=front.filter(h=>h.last_any_le3===true),unknown=front.filter(h=>h.last_any_le3===null);
 const field={active_count:active.length,front_definition:'ANY_REPORTED_POSITION_LE_3 (research observation, no verified corner/field size)',front_rows:front,known_front_ids:yes.map(h=>h.horse_id),unknown_ids:unknown.map(h=>h.horse_id),front_share_range:[yes.length/active.length,(yes.length+unknown.length)/active.length],first_recorded_leaders:front.filter(h=>h.first_recorded_lead_count>0).map(h=>h.horse_id),pair_comparison:{possible:active.length*(active.length-1)/2,verified:0,unknown:active.length*(active.length-1)/2},scenarios:[{id:'FRONT_CANDIDATES_CONTEST',status:'HYPOTHESIS',assumptions:['known forward candidates seek forward positions','unknown horse may alter field'],pace:null,queue:null},{id:'FRONT_CANDIDATES_YIELD',status:'HYPOTHESIS',assumptions:['one forward candidate yields','unknown horse may alter field'],pace:null,queue:null}],actual_gates_verified:false,first_turn_m:null,formal_rank:null};
 const allRefs=front.flatMap(x=>x.source_refs);
 const runners=roster.map(h=>{
 const a=histories.get(h.horse_id),last=a.find(r=>r.relative_run===1),prev=a.find(r=>r.relative_run===2),own=a.map(r=>r.observation_id),hc=conflicts.filter(c=>c.horse_id===h.horse_id),card='fixture-card:'+h.horse_id,fieldRef='fixture-target:'+t.race_id;
 const ownFront=front.find(f=>f.horse_id===h.horse_id),by=new Map(definitions.map(d=>[d.id,{item_id:d.id,name:d.name,required_evidence:d.required_evidence,analysis_method:d.implemented_research_content,remaining_gap:d.remaining_gap,executed:false,observations:[],unknowns:[],runtime_consumers:[],planned_consumers:deps.items.find(x=>x.id===d.id).planned_consumers,formal_consumption:false}]));
 const add=(id,type,value,refs,kind='OBSERVATION')=>by.get(id).observations.push({type,kind,value,refs:uniq(refs),scope:'SYNTHETIC_OBSERVATION_ONLY',official_admission:false});
 const obs=(id)=>by.get(id).observations;
 const read=(id,consumer)=>{const x=by.get(id);if(x.observations.length)x.runtime_consumers.push(consumer);return x.observations;};
 const mapRuns=(id,type,fn)=>{for(const r of a){const v=fn(r);if(v!=null)add(id,type,v,[r.observation_id]);}};
 const matches=a.map(r=>({r,d:compare(r,t)})),partial=matches.filter(x=>!x.d.different.length&&x.d.matched.length===3);
 const deltas=r=>pos(r).slice(1).map((n,i)=>({from:i+1,to:i+2,rank_gain:pos(r)[i]-n}));
 const finished=a.filter(r=>finish(r.finish));
 const bins=(key)=>[...new Set(a.map(r=>r[key]).filter(v=>v!=null))].map(v=>({value:v,runs:a.filter(r=>r[key]===v).map(compact)}));
 const paths={winning:[],placing:[]};
 const route=(kind)=>{
 const pred=r=>finish(r.finish)&&(kind==='WIN'?r.finish===1:r.finish<=3);
 return {kind,definition:kind==='WIN'?'finish=1':'finish in 1..3; diagnostic only',historical_support:partial.filter(x=>pred(x.r)).map(x=>({...compact(x.r),conditions:x.d})),historical_counter:partial.filter(x=>finish(x.r.finish)&&!pred(x.r)).map(x=>({...compact(x.r),conditions:x.d})),other_condition_history:matches.filter(x=>!partial.includes(x)).map(x=>({...compact(x.r),conditions:x.d})),current_status:'UNKNOWN',required:['formal course/class/eligibility and current opponent comparability','current pace and state','complete time-bound evidence'],formal_judgment:null};
 };
 const handlers={
 '01':()=>{const v=Array.from({length:15},(_,i)=>String(i+2).padStart(2,'0')).flatMap(id=>read(id,'01').map(o=>({item:id,type:o.type,refs:o.refs})));if(v.length)add('01','BASE_BUNDLE',v,v.flatMap(x=>x.refs));},
 '02':()=>mapRuns('02','REPORTED_FINISH',r=>finish(r.finish)?{relative_run:r.relative_run,finish:r.finish,field_size:null}:null),
 '03':()=>mapRuns('03','REPORTED_WINNER_GAP',r=>r.reported_gap_reference==='WINNER'&&finite(r.reported_gap_tenths)?{relative_run:r.relative_run,tenths:r.reported_gap_tenths}:null),
 '04':()=>mapRuns('04','REPORTED_NEXT_GAP',r=>r.reported_gap_reference==='NEXT'&&finite(r.reported_gap_tenths)?{relative_run:r.relative_run,tenths:r.reported_gap_tenths,following_id:null,adjacency_verified:false}:null),
 '05':()=>mapRuns('05','DISPLAY_CLOCK',r=>finite(r.elapsed_tenths)?{relative_run:r.relative_run,tenths:r.elapsed_tenths,distance_m:r.distance_m,going:r.going}:null),
 '06':()=>mapRuns('06','REPORTED_FINAL3F',r=>finite(r.final3f_tenths)?{relative_run:r.relative_run,tenths:r.final3f_tenths}:null),
 '11':()=>{if(new Set(a.map(r=>r.distance_m)).size>1)add('11','DISTANCE_CONTEXT',bins('distance_m'),own);},
 '12':()=>{if(finished.length)add('12','OBSERVED_FINISH_COUNTS',{observed_rows:a.length,known_finishes:finished.length,wins:finished.filter(r=>r.finish===1).length,top3:finished.filter(r=>r.finish<=3).length,nonwins:finished.filter(r=>r.finish!==1).length,complete_history:false},own);},
 '13':()=>{const groups=new Map();for(const r of a){if(r.going==null)continue;const k=JSON.stringify([r.surface,r.distance_m,r.going,r.class_label]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}for(const [k,rs] of groups)if(rs.length>1)add('13','PARTIAL_MATCH_SPREAD',{key:k,finish_range:range(rs.map(r=>r.finish).filter(finish)),clock_range:range(rs.map(r=>r.elapsed_tenths).filter(finite)),complete_match:false},rs.map(r=>r.observation_id));},
 '14':()=>{if(a.length>=2)add('14','RELATIVE_SEQUENCE',a.map(compact),own);},
 '15':()=>{const v=read('21','15');if(v.length)add('15','RECOVERY_CONTEXT',v.map(x=>x.value),v.flatMap(x=>x.refs),'HYPOTHESIS');},
 '17':()=>mapRuns('17','REPORTED_POSITION_SEQUENCE',r=>pos(r).length?{relative_run:r.relative_run,positions:pos(r),field_size:null,corner_labels:null}:null),
 '18':()=>{read('17','18');mapRuns('18','REPORTED_RANK_TRANSITIONS',r=>pos(r).length>1?{relative_run:r.relative_run,deltas:deltas(r)}:null);},
 '20':()=>mapRuns('20','UNVERIFIED_PACE_NARRATIVE',r=>r.incident_or_pace_narrative?{relative_run:r.relative_run,text:r.incident_or_pace_narrative,causal_effect:null}:null),
 '21':()=>{read('18','21');mapRuns('21','LOSS_THEN_RECOVERY',r=>{const d=deltas(r),rec=d.flatMap((x,i)=>x.rank_gain<0?d.slice(i+1).filter(y=>y.rank_gain>0).map(y=>({loss:x,recovery:y})):[]);return rec.length?{relative_run:r.relative_run,rec}:null;});},
 '22':()=>{read('18','22');mapRuns('22','RANK_GAIN',r=>{const gains=deltas(r).filter(x=>x.rank_gain>0);return gains.length?{relative_run:r.relative_run,gains}:null;});},
 '23':()=>mapRuns('23','FORWARD_THEN_LOSS',r=>pos(r)[0]<=3&&pos(r).at(-1)>pos(r)[0]?{relative_run:r.relative_run,first:pos(r)[0],last:pos(r).at(-1),cause:null}:null),
 '24':()=>mapRuns('24','LATE_POSITION_LOSS',r=>deltas(r).at(-1)?.rank_gain<0?{relative_run:r.relative_run,transition:deltas(r).at(-1),cause:null}:null),
 '25':()=>mapRuns('25','LATE_GAIN_NONWIN',r=>deltas(r).at(-1)?.rank_gain>0&&finish(r.finish)&&r.finish>1?{relative_run:r.relative_run,transition:deltas(r).at(-1),finish:r.finish,energy:null}:null),
 '26':()=>mapRuns('26','UNVERIFIED_INCIDENT_NARRATIVE',r=>r.incident_or_pace_narrative?{relative_run:r.relative_run,text:r.incident_or_pace_narrative,official_ruling:null}:null),
 '27':()=>{const v=read('26','27');if(v.length)add('27','INCIDENT_FINISH_CONTEXT',v.map(o=>({narrative:o.value,finish:a.find(r=>r.relative_run===o.value.relative_run)?.finish,overcame:null})),v.flatMap(o=>o.refs),'HYPOTHESIS');},
 '28':()=>{const v=read('03','28');for(const o of v)add('28','DEFEAT_GAP_CONTEXT',{...o.value,finish:a.find(r=>r.relative_run===o.value.relative_run)?.finish,narrow_threshold:null},o.refs);},
 '29':()=>{const v=read('28','29');if(v.length&&h.peer_narratives.length)add('29','DEFEAT_AND_UNLINKED_PEERS',{defeats:v.map(o=>o.value),narratives:h.peer_narratives,peer_strength:null},[...v.flatMap(o=>o.refs),card],'HYPOTHESIS');},
 '30':()=>mapRuns('30','WIN_CONTEXT',r=>r.finish===1?{...compact(r),comparison:compare(r,t),peer_strength:null}:null),
 '31':()=>{const v=read('26','31');if(v.length)add('31','NARRATIVE_AND_OUTCOME',v.map(o=>({narrative:o.value,finish:a.find(r=>r.relative_run===o.value.relative_run)?.finish,cause:null})),v.flatMap(o=>o.refs),'HYPOTHESIS');},
 '32':()=>{if(last&&prev){const d=compare(last,prev);add('32','ADJACENT_RELATIVE_CHANGE',{latest:compact(last),previous:compact(prev),conditions:d,clock_delta_tenths:last.elapsed_tenths-prev.elapsed_tenths,final3f_delta_tenths:last.final3f_tenths-prev.final3f_tenths,finish_delta:last.finish-prev.finish,gap_delta_tenths:finite(last.reported_gap_tenths)&&finite(prev.reported_gap_tenths)&&last.reported_gap_reference===prev.reported_gap_reference?last.reported_gap_tenths-prev.reported_gap_tenths:null,ability_change:null},[last.observation_id,prev.observation_id]);}},
 '33':()=>{if(a.length)add('33','RAW_CLASS_LABELS',bins('class_label'),own);},
 '34':()=>{if(h.peer_narratives.length)add('34','UNLINKED_PEER_NARRATIVE',h.peer_narratives,[card],'HYPOTHESIS');},
 '37':()=>{const v=read('34','37');if(v.length)add('37','FOLLOWUP_TEXT_ONLY',{text:h.peer_narratives,joined_peer_rows:0,followup_effect:null},[card],'HYPOTHESIS');},
 '39':()=>{if(last)add('39','RAW_CLASS_CHANGE',{last:last.class_label,current:t.class_label,formal_direction:null},[last.observation_id,fieldRef]);},
 '40':()=>{const v=read('34','40');if(v.length)add('40','FIELD_COMPARISON_BLOCKED',{narratives:h.peer_narratives,current_peer_links:0,field_strength:null},[card],'HYPOTHESIS');},
 '42':()=>{if(h.reported_transfer_first!=null)add('42','TRANSFER_CLAIM',{reported:h.reported_transfer_first,previous_identity:null,transfer_effect:null},[card]);},
 '43':()=>{if(a.length)add('43','DISTANCE_OBSERVATIONS',bins('distance_m'),own);},
 '44':()=>{if(last)add('44','DISTANCE_DELTA',{previous:last.distance_m,current:t.distance_m,delta:t.distance_m-last.distance_m,effect:null},[last.observation_id,fieldRef]);},
 '47':()=>{if(a.length)add('47','SURFACE_OBSERVATIONS',bins('surface'),own);},
 '48':()=>{if(a.some(r=>r.going!=null))add('48','GOING_OBSERVATIONS',bins('going'),own.filter(id=>a.find(r=>r.observation_id===id).going!=null));},
 '53':()=>{if(h.frame_no!=null)add('53','FRAME_NOT_GATE',{frame_no:h.frame_no,actual_gate:null,interaction:null},[card]);},
 '54':()=>{if(finite(h.weight_kg))add('54','CURRENT_ASSIGNED_WEIGHT',{kg:h.weight_kg,prior_kg:null,effect:null},[card]);},
 '58':()=>{if(ownFront.observed_position_runs)add('58','POSITION_STYLE_PROFILE',{reported:h.reported_style,first_positions:a.map(r=>pos(r)[0]??null),first_le3_count:a.filter(r=>pos(r)[0]<=3).length,first_lead_count:ownFront.first_recorded_lead_count,last_any_le3:ownFront.last_any_le3,style_conflict_candidate:h.reported_style?.includes('先行')&&ownFront.last_any_le3===false},own);},
 '59':()=>{if(ownFront.last_any_le3!=null)add('59','LAST_FRONT_OBSERVATION',{positions:ownFront.last_positions,any_le3:ownFront.last_any_le3,first_le3:ownFront.last_first_le3},[last.observation_id]);},
 '60':()=>{if(a.length){read('58','60');add('60','OBSERVED_FRONT_FREQUENCY',{sample:a.filter(r=>pos(r).length).length,first_le3:a.filter(r=>pos(r)[0]<=3).length,any_le3:a.filter(r=>pos(r).some(n=>n<=3)).length,full_history:false},own);}},
 '61':()=>{if(ownFront.first_recorded_lead_count>0)add('61','LEAD_CANDIDATE',{count:ownFront.first_recorded_lead_count,actual_probability:null},own,'HYPOTHESIS');},
 '62':()=>{const lead=a.filter(r=>pos(r)[0]===1),other=a.filter(r=>pos(r).length&&pos(r)[0]!==1);if(lead.length)add('62','LEAD_NONLEAD_CONTRAST',{lead:lead.map(compact),other:other.map(compact),dependency:null},own);},
 '63':()=>add('63','FIELD_FRONT_SHARE_RANGE',{active:field.active_count,known:field.known_front_ids,unknown:field.unknown_ids,range:field.front_share_range},allRefs),
 '64':()=>{if(h.frame_no!=null)add('64','FRAME_AND_STYLE_CONTEXT',{frame:h.frame_no,actual_gate:null,style:ownFront.last_any_le3,field_frame_order_not_gate:true},[card,...ownFront.source_refs]);},
 '65':()=>{read('63','65');if(yes.length)add('65','CONDITIONAL_COMPETITION',{known_front:field.known_front_ids,unknown:field.unknown_ids,own_known_front:ownFront.last_any_le3,scenarios:field.scenarios},allRefs,'HYPOTHESIS');},
 '68':()=>{const v=read('65','68');if(v.length)add('68','EARLY_POSITION_SCENARIOS',{own_first_positions:a.map(r=>pos(r)[0]??null),competition:v.map(o=>o.value),first_turn:null},[...own,...allRefs],'HYPOTHESIS');},
 '69':()=>{const v=read('65','69');if(v.length)add('69','PACE_SCENARIO_WITHOUT_LAPS',{scenarios:field.scenarios,pace_band:null,lap_evidence:null},allRefs,'HYPOTHESIS');},
 '70':()=>{const v=read('68','70');if(v.length)add('70','QUEUE_CONSTRAINTS',{known_front:field.known_front_ids,unknown:field.unknown_ids,exact_order:null,own_observed_first:a.map(r=>pos(r)[0]??null)},[...allRefs,...own],'HYPOTHESIS');},
 '72':()=>{const v=read('23','72');if(v.length)add('72','PRIOR_LOSS_COMPETITION_CONTEXT',{observed:v.map(o=>o.value),current_scenarios:field.scenarios,causal_fatigue:null},[...own,...allRefs],'HYPOTHESIS');},
 '73':()=>{const v=read('70','73');if(v.length)add('73','SCENARIO_FIT_UNRESOLVED',{own_history:a.map(r=>({id:r.observation_id,positions:pos(r),finish:r.finish})),scenarios:field.scenarios,benefit:null},[...own,...allRefs],'HYPOTHESIS');},
 '74':()=>{if(a.length)add('74','POSITION_FINISH_CONTRAST',a.map(r=>({id:r.observation_id,first:pos(r)[0]??null,finish:r.finish,pace:null})),own);},
 '75':()=>{const v=read('74','75');if(v.length)add('75','DEPENDENCY_CONTEXT',{observed:v.map(o=>o.value),dependency:null},own,'HYPOTHESIS');},
 '78':()=>{if(h.reported_interval&&!hc.some(c=>c.field==='reported_interval'))add('78','REPORTED_INTERVAL_ONLY',{label:h.reported_interval,exact_days:null},[card]);},
 '79':()=>{const v=read('78','79');if(v.length)add('79','INTERVAL_LABEL',v.map(o=>o.value),[card]);},
 '81':()=>{if(finite(h.current_body_weight_kg)&&finite(h.previous_body_weight_kg))add('81','REPORTED_BODY_WEIGHT',{current_kg:h.current_body_weight_kg,previous_kg:h.previous_body_weight_kg,delta_kg:h.current_body_weight_kg-h.previous_body_weight_kg},[card]);},
 '91':()=>add('91','AGE_SEX',{age:h.age,sex:h.sex,maturity:null},[card]),
 '93':()=>{if(last)add('93','RECORDED_CHANGE',{comparison:compare(last,t),effect:null},[last.observation_id,fieldRef],'HYPOTHESIS');},
 '94':()=>{const v=read('93','94');if(v.length)add('94','ADVERSE_EFFECT_UNRESOLVED',{change:v.map(o=>o.value),effect:null},[last.observation_id,fieldRef],'HYPOTHESIS');},
 '95':()=>{if(last&&compare(last,t).different.length)for(const x of partial.filter(x=>x.r.relative_run!==1))add('95','PARTIAL_CONDITION_RETURN',{past:compact(x.r),last:compact(last),comparison:x.d,effect:null},[x.r.observation_id,last.observation_id,fieldRef],'HYPOTHESIS');},
 '96':()=>{const v=read('26','96');if(v.length)add('96','RECURRENCE_UNRESOLVED',{prior:v.map(o=>o.value),resolution:null},v.flatMap(o=>o.refs),'HYPOTHESIS');},
 '97':()=>{const v=['93','95','96'].flatMap(id=>read(id,'97'));if(v.length>1)add('97','SHARED_CONTEXT_GROUP',{observations:v.map(o=>o.type),original_refs:uniq(v.flatMap(o=>o.refs)),independence:null,joint_effect:null},v.flatMap(o=>o.refs),'HYPOTHESIS');},
 '98':()=>{const v=['15','29','32','97'].flatMap(id=>read(id,'98'));if(v.length)add('98','LATENT_CONTEXT',{observations:v.map(o=>o.type),activation:null},v.flatMap(o=>o.refs),'HYPOTHESIS');},
 '99':()=>{if(partial.length)add('99','PARTIAL_MATCH_HISTORY',{runs:partial.map(x=>compact(x.r)),repeatability:null},partial.map(x=>x.r.observation_id));},
 '100':()=>{for(const id of ['12','30','35','40','43','48','65','73','93','95','99'])read(id,'100');paths.winning=[route('WIN')];paths.placing=[route('PLACE')];if(a.length)add('100','HISTORICAL_ROUTE_RESEARCH',paths,own,'HYPOTHESIS');}
 };
 const eyeHandlers={
 'EYE-01':()=>read('28','EYE-01'),
 'EYE-02':()=>['18','25','26','32'].flatMap(id=>read(id,'EYE-02')),
 'EYE-03':()=>read('21','EYE-03'),
 'EYE-04':()=>['28','34'].flatMap(id=>read(id,'EYE-04')),
 'EYE-05':()=>read('37','EYE-05'),
 'EYE-06':()=>['26','65','96'].flatMap(id=>read(id,'EYE-06')),
 'EYE-07':()=>read('95','EYE-07'),
 'EYE-08':()=>['45','46'].flatMap(id=>read(id,'EYE-08')),
 'EYE-09':()=>['60','63','65','73'].flatMap(id=>read(id,'EYE-09')),
 'EYE-10':()=>read('66','EYE-10'),
 'EYE-11':()=>read('65','EYE-11'),
 'EYE-12':()=>['58','70'].flatMap(id=>read(id,'EYE-12')),
 'EYE-13':()=>['13','14','32'].flatMap(id=>read(id,'EYE-13')),
 'EYE-14':()=>['39','40','42'].flatMap(id=>read(id,'EYE-14')),
 'EYE-15':()=>read('97','EYE-15')
 };
 // Execute every item check; 01 after base items. Missing implementations are not counted as computed.
 for(const d of definitions.filter(x=>x.id!=='01'&&!x.id.startsWith('EYE-')).concat(definitions.filter(x=>x.id==='01'))){
 const x=by.get(d.id);x.executed=true;x.computation_executed=!!handlers[d.id];handlers[d.id]?.();if(!x.observations.length)x.unknowns.push(d.remaining_gap);if(!x.computation_executed)x.unknowns.push('NO_SAFE_PARTIAL_COMPUTATION_FOR_INPUT');
 }
 const eye=definitions.filter(d=>d.id.startsWith('EYE-')).map(d=>{const x=by.get(d.id);x.executed=true;x.computation_executed=true;const v=eyeHandlers[d.id]();if(v.length)add(d.id,'UPSTREAM_CONTEXT_NOT_DISCOVERY',v.map(o=>({type:o.type,value:o.value,refs:o.refs})),v.flatMap(o=>o.refs),'HYPOTHESIS');const historical=uniq(v.flatMap(o=>o.refs)).map(ref=>a.find(r=>r.observation_id===ref)).filter(Boolean).map(r=>({id:r.observation_id,relative_run:r.relative_run,comparison:compare(r,t),newer_observation_ids:a.filter(q=>q.relative_run<r.relative_run).map(q=>q.observation_id)}));x.unknowns.push(d.remaining_gap,'CURRENT_EFFECT_NOT_VALIDATED');return {id:d.id,context_count:v.length,historical_context:historical,current_field_context:['EYE-09','EYE-10','EYE-11','EYE-12'].includes(d.id)?{front_share_range:field.front_share_range,unknown_ids:field.unknown_ids,actual_gate:null,queue:null}:null,current_relevance:'UNKNOWN',selection:null};});
 const axes=['A','B','C','D','E'].map(axis=>{const ids=definitions.filter(d=>!d.id.startsWith('EYE-')&&d.axes.includes(axis)).map(d=>d.id);const v=ids.flatMap(id=>read(id,'AXIS-'+axis).map(o=>({item:id,type:o.type,refs:o.refs})));return {axis,status:'UNKNOWN',observed_context:v,unknown_item_ids:ids.filter(id=>!obs(id).length),formal_support:null};});
 const counter=paths.winning.flatMap(p=>p.historical_counter.map(r=>({route:'WIN',observation_id:r.observation_id,finish:r.finish,scope:'PARTIAL_CONDITION_ONLY',major_status:'UNVALIDATED'}))).concat(paths.placing.flatMap(p=>p.historical_counter.map(r=>({route:'PLACE',observation_id:r.observation_id,finish:r.finish,scope:'PARTIAL_CONDITION_ONLY',major_status:'UNVALIDATED'}))));
 const important=[{code:'OFFICIAL_ID_TIME_AND_RACE_KEYS_ABSENT',scope:'ALL_PATHS'},{code:'COURSE_CLASS_AND_PEER_COMPARABILITY_ABSENT',scope:'CURRENT_STRENGTH'},{code:'GATE_LAPS_AND_UNKNOWN_ACTIVE_STYLE',scope:'PACE'},...(!a.length?[{code:'NO_HISTORY',scope:'ALL_PATHS'}]:[]),...hc.map(c=>({code:'SOURCE_CONFLICT',field:c.field,scope:'AFFECTED_ANALYSIS',values:c.values}))];
 for(const x of by.values()){x.state=x.observations.length?'PARTIAL_OBSERVATION':x.computation_executed?'CHECKED_NO_OUTPUT':'BLOCKED_NO_SAFE_COMPUTATION';x.unknowns=uniq([...x.unknowns,x.remaining_gap]);}
 return {horse_id:h.horse_id,horse_no:h.horse_no,active:h.active,items:[...by.values()],axes,paths,counter_candidates:counter,important_unknown_candidates:important,eye,conflicts:hc,rank_candidate:null,eye_candidate:null,formal_consumption:0};
 });
 return {fixture_only:true,official_admission:false,normal_v5_entry:normal,partial_route:'V5_CONTRACT_SHARED_CATALOG_AND_DEPENDENCIES_FIXTURE_ONLY',field,runners,counts:{audit_rows:runners.flatMap(h=>h.items).length,checks_executed:runners.flatMap(h=>h.items).filter(i=>i.executed).length,computations_executed:runners.flatMap(h=>h.items).filter(i=>i.computation_executed).length,rows_with_output:runners.flatMap(h=>h.items).filter(i=>i.observations.length).length,rows_with_runtime_consumers:runners.flatMap(h=>h.items).filter(i=>i.runtime_consumers.length).length,formal_consumption:0},rank_candidate:null,eye_candidate:null};
}
export function runGeminiFixture(raw){return {input_sha256:hash(raw),input_blob:'86a8ff7d40ab53bc6c5027e9907271b307d69cb0',baseline_code:'65eb6933274406a590739a31cff226a3d4eb2079',...analyzeGeminiFixture(JSON.parse(raw))};}

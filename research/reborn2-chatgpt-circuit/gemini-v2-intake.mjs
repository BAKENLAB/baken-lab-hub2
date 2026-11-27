import {fictionalTime,fixtureHorse,assertFictionalTarget} from './fictional-research-context.mjs';
const uniq=xs=>[...new Set(xs)];
const posInt=n=>Number.isInteger(n)&&n>0;
const seq=n=>Array.from({length:n},(_,i)=>i+1);
const stamp={fixture_only:true,official_evidence:false,formal_admission:false,identity_status:'FICTIONAL_ONLY'};
const mk=(id,horse,race,pub,extra={})=>({...stamp,evidence_id:'fixture-v2:'+id,horse_id:horse,race_id:race,published_at:pub,published_at_or_null:pub,...extra});
const course=r=>JSON.stringify([r.track,r.surface,r.distance_m,r.turn]);
const cond=r=>({course_id:course(r),course_version:r.course_version,track:r.track,surface:r.surface,distance_m:r.distance_m,distance:r.distance_m,going:r.going,turn:r.turn,class_key:r.class_key,layout:null,rule_version:null,eligibility:r.eligibility??null,weight_rule_version:null,conditions_observed:true,conditions_verified:false});
const permutations=(a,n)=>a.length===n&&a.every(x=>posInt(x)&&x<=n)&&new Set(a).size===n;
const time=(x)=>fictionalTime(x);
const obsDate=s=>typeof s==='string'?s.slice(0,10):null;
const status=(ok)=>ok?'USABLE_FIXTURE_ONLY':'HOLD';
export function prepareGeminiV2(raw){
 if(raw.schema!=='gemini-synthetic-field-observations-v2-supplement'||raw.fixture_only!==true||raw.official_evidence!==false||raw.production_admission!==false)throw Error('FIXTURE_ONLY_REQUIRED');
 const r0=raw.target,t={...stamp,...cond(r0),circuit:'FIXTURE',race_id:r0.race_id,field_size:r0.field_size,cutoff:r0.snapshot_publication_local,started_at:r0.scheduled_start_local,local_date:r0.date,roster_version:'fictional-v2',time_basis:'LOCAL_FICTIONAL_WALL_CLOCK_NO_OFFSET'};
 const roster=raw.runners.map(h=>({...mk('card:'+h.horse_id,h.horse_id,t.race_id,t.cutoff,{runner_no:h.horse_no}),horse_no:h.horse_no,active:h.active,raw:h}));
 assertFictionalTarget(t,roster);
 if(raw.past_races.length!==18||raw.past_races.reduce((n,r)=>n+r.rows.length,0)!==166)throw Error('INPUT_CARDINALITY');
 const audit=[],evidence=[],groups=[],runs=[],races=[],histories=[],current=[],gates=[],geometry=[],followups=[],holds=[];
 const push=(e,kind,fact,event_at=null)=>{evidence.push(e);if(kind)groups.push({event_key:JSON.stringify(['FICTIONAL',e.race_id,e.horse_id,kind,event_at]),evidence_ids:[e.evidence_id],record:{...e,kind,event_at,fact},fixture_only:true,formal_admission:false});};
 const hold=(scope,key,reason,detail={})=>holds.push({scope,key,reason,...detail});
 const raceCounts=new Map();for(const r of raw.past_races)raceCounts.set(r.race_id,(raceCounts.get(r.race_id)??0)+1);
 const validById=new Map();
 for(const r of raw.past_races){
  const n=r.field_size,rs=r.rows,subject=rs.filter(x=>x.horse_id===r.subject_horse_id);
  const identityOK=r.fixture_only===true&&raceCounts.get(r.race_id)===1&&r.race_id!==t.race_id&&posInt(n)&&rs.length===n&&permutations(rs.map(x=>x.horse_no),n)&&new Set(rs.map(x=>x.horse_id)).size===n&&rs.every(x=>fixtureHorse(x.horse_id))&&subject.length===1&&roster.some(h=>h.horse_id===r.subject_horse_id)&&!(r.omitted_rank_ranges??[]).length;
  const timeOK=time(r.scheduled_start_local)<time(r.publication_local)&&time(r.publication_local)<=time(t.cutoff)&&obsDate(r.scheduled_start_local)===r.date;
  const winner=rs.filter(x=>x.finish===1),finishOK=permutations(rs.map(x=>x.finish),n);
  const clockErrors=rs.filter(x=>!posInt(x.elapsed_tenths)||!posInt(x.final3f_tenths)||x.final3f_tenths>=x.elapsed_tenths||!Number.isInteger(x.reported_winner_gap_tenths)||x.reported_winner_gap_tenths<0||winner.length!==1||x.elapsed_tenths-winner[0].elapsed_tenths!==x.reported_winner_gap_tenths).map(x=>x.horse_id);
  const clockOrderOK=rs.slice().sort((a,b)=>a.finish-b.finish).every((x,i,a)=>i===0||x.elapsed_tenths>=a[i-1].elapsed_tenths);
  const resultOK=identityOK&&timeOK&&finishOK&&winner.length===1&&winner[0].elapsed_tenths===r.reported_winner_clock_tenths&&clockErrors.length===0&&clockOrderOK;
  const labelOK=rs.every(x=>JSON.stringify(x.position_labels)===JSON.stringify(['1角','2角','3角','4角'])&&Array.isArray(x.positions)&&x.positions.length===4);
  const badCorners=seq(4).filter(k=>!labelOK||!permutations(rs.map(x=>x.positions?.[k-1]),n));
  const validCorners=resultOK?seq(4).filter(k=>!badCorners.includes(k)):[];
  const laps=r.reported_race_laps_tenths,dist=r.lap_segment_distances_m;
  const gridOK=Array.isArray(laps)&&Array.isArray(dist)&&laps.length===dist.length&&laps.every(posInt)&&dist.every(posInt)&&dist.reduce((x,y)=>x+y,0)===r.distance_m;
  const lapSum=Array.isArray(laps)?laps.reduce((x,y)=>x+y,0):null;
  const lapDiff=lapSum-r.reported_winner_clock_tenths;
  const lapKindOK=r.reported_lap_kind==='RACE_LEADER';
  const lapOK=resultOK&&gridOK&&lapDiff===0&&lapKindOK;
  const rec={race_id:r.race_id,subject_id:r.subject_horse_id,relative_run:r.relative_run,rows:rs.length,identity_status:status(identityOK),time_status:status(timeOK),result_status:status(resultOK),clock_errors:clockErrors,clock_order_ok:clockOrderOK,corner_valid:validCorners,corner_held:badCorners,lap_sum_tenths:lapSum,lap_delta_tenths:lapDiff,lap_grid_ok:gridOK,lap_kind:r.reported_lap_kind,lap_status:status(lapOK),subject_historical_runner_no:subject[0]?.horse_no??null,target_runner_no:roster.find(h=>h.horse_id===r.subject_horse_id)?.horse_no??null};
  audit.push(rec);
  if(!resultOK){hold('RACE_RESULT',r.race_id,'INTERNAL_RESULT_OR_ID_TIME_CONFLICT');continue;}
  if(badCorners.length)hold('POSITION_SEGMENTS',r.race_id,'DUPLICATE_OR_MISSING_RANKS',{held_corners:badCorners,retained_corners:validCorners});
  if(!lapOK)hold('RACE_LAPS',r.race_id,'LAP_KIND_OR_SUM_UNRESOLVED',{lap_delta_tenths:lapDiff,grid_ok:gridOK,kind:r.reported_lap_kind});
  validById.set(r.race_id,r);
  const raceE=mk('field:'+r.race_id,null,r.race_id,r.publication_local);
  const rowRefs=[];
  for(const x of rs){
   const e=mk('result:'+r.race_id+':'+x.horse_id,x.horse_id,r.race_id,r.publication_local,{runner_no:x.horse_no,historical_runner_no:x.horse_no,target_runner_no:roster.find(h=>h.horse_id===x.horse_id)?.horse_no??null});
   rowRefs.push(e.evidence_id);
   const f={...cond(r),start_status:'FINISHED',finish:x.finish,field_size:n,clock_tenths:x.elapsed_tenths,winner_gap_tenths:x.reported_winner_gap_tenths,final3f_tenths:x.final3f_tenths,weight_kg:x.weight_kg};
   const isSubject=roster.some(h=>h.horse_id===x.horse_id);
   push(e,isSubject?'RESULT':'PEER_RESULT',f,r.scheduled_start_local);
   const positions=validCorners.map(k=>({segment:k,rank_min:x.positions[k-1],rank_max:x.positions[k-1]}));
   let pe=null;
   if(positions.length){pe=mk('positions:'+r.race_id+':'+x.horse_id,x.horse_id,r.race_id,r.publication_local,{historical_runner_no:x.horse_no});push(pe,'POSITIONS',{field_size:n,first_segment:1,fixture_segment_labels_consistent:true,fixture_segment_grid_complete:validCorners.length===4,expected_segments:4,positions},r.scheduled_start_local);}
   if(isSubject)runs.push({...e,...f,circuit:'FIXTURE',started_at:r.scheduled_start_local,local_date:r.date,status:'FINISHED',gap_winner:x.reported_winner_gap_tenths/10,final3f:x.final3f_tenths/10,positions,first_segment:1,fixture_segment_labels_consistent:true,fixture_segment_grid_complete:validCorners.length===4,expected_segments:4,position_evidence_id:pe?.evidence_id??null,labeled_corners:positions.map(p=>({corner:p.segment,position:p.rank_min})),last_corner:positions.find(p=>p.segment===4)?.rank_min??null});
  }
  push(raceE,'RACE_FIELD',{...cond(r),field_size:n,runner_ids:rs.map(x=>x.horse_id),fixture_full_field_consistent:true},r.scheduled_start_local);
  races.push({...raceE,...cond(r),circuit:'FIXTURE',started_at:r.scheduled_start_local,field_size:n,row_evidence_ids:rowRefs,results:rs.map(x=>({horse_id:x.horse_id,finish:x.finish,status:'FINISHED'}))});
  // Ruling text is fictional; roles must match the historical number AND horse ID.
  const text=r.ruling?.text??'';
  if(text&&text!=='該当事象なし'){
   const victim=text.match(/被害馬(\d+)番/),self=text.match(/(\d+)番馬([A-Z])は/),cause=text.match(/原因馬(\d+)番/);
   const row=subject[0],match=(victim&&+victim[1]===row.horse_no)||(self&&+self[1]===row.horse_no&&'FIXTURE-'+self[2]===row.horse_id);
   if(match){const e=mk('ruling:'+r.race_id+':'+row.horse_id,row.horse_id,r.race_id,r.publication_local,{historical_runner_no:row.horse_no});push(e,'INCIDENT',{incident_code:victim?'FIXTURE_PATH_PRESSURE':'FIXTURE_TRAFFIC',role:victim?'SUFFERED':'SELF',text,causing_horse_id:cause?rs.find(x=>x.horse_no===+cause[1])?.horse_id??null:null,official_ruling_verified:false},r.scheduled_start_local);}
   else hold('RULING',r.race_id,'UNBOUND_HISTORICAL_RUNNER_NUMBER');
  }
 }
 const gateOK=permutations(raw.runners.map(h=>h.reported_gate),t.field_size);
 for(const h of roster){
  const z=h.raw,card={...h,...cond(r0),active:z.active,body_weight_kg:z.current_body_weight_kg,reported_weight_delta:z.reported_body_weight_delta_kg,weight_kg:z.weight_kg,actual_gate:z.reported_gate,fixture_gate_consistent:gateOK};
  push(h,'CURRENT_CARD',{...cond(r0),roster_version:t.roster_version,active:z.active,weight_kg:z.weight_kg,body_weight_kg:z.current_body_weight_kg,fixture_gate_consistent:gateOK,reported_gate:z.reported_gate},t.cutoff);
  current.push(card);
  if(gateOK)gates.push({...h,gate:z.reported_gate,gate_position:z.reported_gate,field_size:t.field_size,fixture_gate_consistent:true});
  const listed=z.history_race_ids,linked=listed.map(id=>validById.get(id));
  const own=raw.past_races.filter(r=>r.subject_horse_id===h.horse_id);
  const chronology=listed.length>0&&listed.length===own.length&&new Set(listed).size===listed.length&&linked.every((r,i)=>r&&r.subject_horse_id===h.horse_id&&r.relative_run===i+1&&(i===0||time(linked[i-1].scheduled_start_local)>time(r.scheduled_start_local)));
  if(chronology){const he=mk('history:'+h.horse_id,h.horse_id,t.race_id,t.cutoff);const fact={fixture_chronology_consistent:true,ordered_actual_start_race_ids:listed,history_complete:false};push(he,'HISTORY',fact,t.cutoff);histories.push({...he,fixture_chronology_consistent:true,ordered_race_ids:listed,immediate_prior_race_id:listed[0],target_race_id:t.race_id});}
  const days=chronology?(Date.parse(r0.date)-Date.parse(linked[0].date))/86400000:null;
  if(days!==null&&days!==z.reported_interval_days)hold('INTERVAL',h.horse_id,'REPORTED_DATE_INTERVAL_CONFLICT',{reported:z.reported_interval_days,computed:days});
  if(!chronology)hold('HISTORY',h.horse_id,'NO_LINKED_PAST_HISTORY');
 }
 const ce=mk('course:'+t.race_id,null,t.race_id,t.cutoff);push(ce,'FIXTURE_COURSE',{first_turn_m:r0.first_turn_m,course_version:r0.course_version},t.cutoff);geometry.push({...ce,...cond(r0),circuit:'FIXTURE',fixture_geometry_observed:true,first_turn_m:r0.first_turn_m,first_turn_precision:'reported'});
 const followKeys=new Map();for(const f of raw.peer_followups){const k=f.peer_horse_id+'|'+f.race_id;followKeys.set(k,(followKeys.get(k)??0)+1);}
 for(const f of raw.peer_followups){const r=validById.get(f.prior_race_id),peer=r?.rows.find(x=>x.horse_id===f.peer_horse_id),key=f.peer_horse_id+'|'+f.race_id;
  const ok=r&&r.subject_horse_id===f.subject_horse_id&&peer&&peer.horse_id!==f.subject_horse_id&&followKeys.get(key)===1&&fixtureHorse(f.peer_horse_id)&&f.date>r.date&&obsDate(f.publication_local)===f.date&&time(f.publication_local)<=time(t.cutoff)&&posInt(f.finish);
  if(!ok){hold('PEER_FOLLOWUP',key,'LINK_DATE_OR_RESULT_INVALID');continue;}
  const e=mk('followup:'+key,f.peer_horse_id,f.race_id,f.publication_local);push(e,'FIXTURE_FOLLOWUP',{prior_race_id:f.prior_race_id,finish:f.finish,date:f.date,publication_local:f.publication_local,full_result:null},null);
  followups.push({...e,...f,prior_peer_finish:peer.finish,subject_finish:r.rows.find(x=>x.horse_id===f.subject_horse_id).finish,prior_evidence_id:'fixture-v2:result:'+r.race_id+':'+peer.horse_id,scope:'LINKED_PARTIAL_FICTIONAL_FOLLOWUP_NO_START_TIME_OR_FULL_FIELD'});
  hold('PEER_FOLLOWUP_FULL_FIELD',key,'MISSING_LATER_RACE_START_TIME_RUNNER_NO_AND_FULL_FIELD');
 }
 const day=r0.prior_same_day_races,all=day.flatMap(r=>r.top3_fourth_corner),d1400=day.filter(r=>r.distance_m===1400).flatMap(r=>r.top3_fourth_corner);
 const dayAudit={all_top3:all.length,all_le4:all.filter(n=>n<=4).length,at1400_top3:d1400.length,at1400_le4:d1400.filter(n=>n<=4).length,reported:r0.reported_same_day_counts,formal_admission:false,scope:'TOP3_ONLY_NO_PUBLICATION_TIME_OR_COMPLETE_FIELD'};
 hold('DAY_TENDENCY',t.race_id,'COUNT_CONFLICT_AND_MISSING_PUBLICATION_FULL_FIELD',{computed:dayAudit});
 return {target:t,roster,evidence,intake:{accepted:groups,fixture_only:true,formal_admissions:0},runs,races,histories,current,gates,geometry,followups,holds,audit,dayAudit,raw};
}

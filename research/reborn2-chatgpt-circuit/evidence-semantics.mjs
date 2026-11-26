function canonicalize(value){
 if(Array.isArray(value))return value.map(canonicalize);
 if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonicalize(value[k])]));
 return value;
}
export function inspectEvidence({target,records=[],sources=[]}){
 const ts=x=>typeof x==="string"&&/(Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
 const str=x=>typeof x==="string"&&x.length>0;
 const int=x=>Number.isInteger(x)&&x>=0;
 const horse=x=>typeof x==="string"&&/^(JRA|LOCAL):\d+$/.test(x);
 const validSources=new Set(sources);
 const cutoff=ts(target.cutoff);
 if(!(cutoff<ts(target.started_at)))throw Error("TARGET_TIME");
 const marketKey=k=>/^(odds|popularity|market|market_odds|win_odds|tansho|ninki|人気|オッズ)$/i.test(k);
 const hasMarket=v=>v&&typeof v==="object"&&Object.entries(v).some(([k,x])=>marketKey(k)||hasMarket(x));
 const seen=new Map();for(const e of records)seen.set(e.evidence_id,(seen.get(e.evidence_id)??0)+1);
 const inspected=records.map(e=>{
  const errors=[],missing=[],v=e.fact??{},kind=e.kind;
  if(hasMarket(e))errors.push("MARKET_IN_ABILITY_INPUT");
  if(!str(e.evidence_id)||seen.get(e.evidence_id)!==1)errors.push("DUPLICATE_OR_MISSING_ID");
  if(!["JRA","LOCAL"].includes(e.jurisdiction)||!str(e.race_id)||!str(e.event_at)||!Number.isFinite(ts(e.event_at)))errors.push("EVENT_IDENTITY_OR_TIME");
  if(e.horse_id!==null&&(!horse(e.horse_id)||!e.horse_id.startsWith(e.jurisdiction+":")))errors.push("HORSE_ID_TYPE_OR_NAMESPACE");
  if(e.peer_id!=null&&!horse(e.peer_id))errors.push("PEER_ID_TYPE");
  if(!validSources.has(e.source_id)||!/^https:\/\//.test(e.source_url??""))errors.push("SOURCE_UNREGISTERED");
  if(e.cutoff!==target.cutoff)errors.push("CUTOFF_MISMATCH");
  if(!Number.isFinite(ts(e.observed_at)))missing.push("OBSERVATION_TIME_UNKNOWN");else if(ts(e.observed_at)>cutoff)errors.push("POST_CUTOFF_OBSERVATION");
  if(!Number.isFinite(ts(e.published_at_or_null)))missing.push("PUBLICATION_UNKNOWN");else if(ts(e.published_at_or_null)>cutoff||ts(e.published_at_or_null)>ts(e.observed_at))errors.push("PUBLICATION_LATE_OR_INVERTED");
  if(e.permission_status!=="CLEARED_FOR_RESEARCH_USE")missing.push("PERMISSION_UNCLEARED");
  if(!/^[a-f0-9]{64}$/.test(e.raw_sha256_or_null??"")||!str(e.source_version))missing.push("SOURCE_VERSION_OR_HASH_UNKNOWN");
  if(e.identity_status!=="VERIFIED"||e.identity_attestation_verified!==true)missing.push("IDENTITY_NOT_INDEPENDENTLY_ATTESTED");
  if(e.fact_or_proxy!=="FACT")missing.push("NOT_DIRECT_FACT");
  if(e.source_authenticity_verified!==true)missing.push("AUTHENTICITY_NOT_INDEPENDENTLY_ATTESTED");
  if(["RESULT","POSITIONS","PEER_RESULT","INCIDENT","INDIVIDUAL_SPLITS","RACE_LAPS"].includes(kind)){
   if(e.race_id===target.race_id||ts(e.event_at)>=cutoff)errors.push("TARGET_OR_FUTURE_RESULT");
   if(Number.isFinite(ts(e.published_at_or_null))&&ts(e.published_at_or_null)<ts(e.event_at))errors.push("RESULT_PUBLISHED_BEFORE_EVENT");
  }
  if(kind==="RESULT"||kind==="PEER_RESULT"){
   const status=v.start_status;
   if(!["FINISHED","EXCLUDED_NOT_STARTED","CANCELLED_NOT_STARTED","DNF_STARTED","DQ_STARTED","START_STATUS_UNKNOWN"].includes(status))errors.push("START_STATUS_INVALID");
   if(status==="FINISHED"&&(!Number.isInteger(v.finish)||v.finish<1||!Number.isInteger(v.field_size)||v.finish>v.field_size))errors.push("FINISH_INVALID");
   if(status!=="FINISHED"&&v.finish!==null)errors.push("NONFINISH_RANK_INVALID");
   if(v.clock_tenths!==null&&!int(v.clock_tenths))errors.push("CLOCK_NOT_INTEGER_TENTHS");
   if(v.winner_gap_tenths!=null&&!int(v.winner_gap_tenths))errors.push("GAP_NOT_INTEGER_TENTHS");
   if(v.final3f_tenths!=null&&!int(v.final3f_tenths))errors.push("FINAL3F_NOT_INTEGER_TENTHS");
   if(v.official_margin!=null&&(!str(v.official_margin)||!["PRECEDING_FINISHER","WINNER"].includes(v.margin_reference)))errors.push("MARGIN_SEMANTICS");
   if(v.dead_heat_group!=null&&!str(v.dead_heat_group))errors.push("DEAD_HEAT_GROUP_INVALID");
   if(!str(e.horse_id))errors.push("HORSE_REQUIRED");
   if(status==="START_STATUS_UNKNOWN")missing.push("ACTUAL_START_UNKNOWN");
  }else if(kind==="INDIVIDUAL_SPLITS"||kind==="RACE_LAPS"){
   if(kind==="INDIVIDUAL_SPLITS"&&(!horse(e.horse_id)||v.measurement_scope!=="INDIVIDUAL"||v.measurement_verified!==true))errors.push("INDIVIDUAL_MEASUREMENT_REQUIRED");
   if(kind==="RACE_LAPS"&&(e.horse_id!==null||v.measurement_scope!=="RACE_LEADER"))errors.push("RACE_LEADER_SCOPE_REQUIRED");
   if(!Array.isArray(v.splits)||!v.splits.length||v.splits.some(s=>!int(s.start_m)||!int(s.end_m)||s.end_m<=s.start_m||!int(s.elapsed_tenths)||s.elapsed_tenths===0)||v.splits.some((s,i)=>i>0&&s.start_m!==v.splits[i-1].end_m))errors.push("SPLIT_GRID_INVALID");
  }else if(kind==="INCIDENT"){
   if(!horse(e.horse_id)||!str(v.incident_code)||!["SUFFERED","CAUSED","SELF","UNKNOWN"].includes(v.role)||v.official_ruling_verified!==true)missing.push("INCIDENT_ROLE_OR_RULING_UNVERIFIED");
  }else if(kind==="COURSE"){
   if(!str(v.course_version)||!str(v.venue)||!str(v.surface)||!str(v.direction)||!str(v.layout)||!Number.isInteger(v.distance_m)||v.distance_m<=0||!str(v.start_point)||!(ts(v.effective_from)<=ts(e.event_at)&&ts(e.event_at)<ts(v.effective_until)))missing.push("COURSE_VERSION_OR_DISTANCE_UNRESOLVED");
   for(const k of ["lap_m","full_straight_m","home_straight_to_finish_m","first_turn_m","elevation_range_m"])if(v[k]!=null&&(!Number.isFinite(v[k])||v[k]<0))errors.push("GEOMETRY_TYPE:"+k);
   if(v.first_turn_m!=null&&!["exact","approximate"].includes(v.first_turn_precision))errors.push("FIRST_TURN_PRECISION");
  }else if(kind==="CLASS"){
   if(!str(v.rule_version)||!str(v.race_grade)||!str(v.eligibility)||!str(v.horse_class)||!(ts(v.effective_from)<=ts(e.event_at)&&ts(e.event_at)<ts(v.effective_until)))missing.push("CLASS_RULE_OR_SCOPE_UNKNOWN");
  }else if(kind==="POSITIONS"){
   if(!Number.isInteger(v.field_size)||v.field_size<1||!Array.isArray(v.positions)||!v.positions.length||v.positions.some(p=>!Number.isInteger(p.segment)||!Number.isInteger(p.rank_min)||!Number.isInteger(p.rank_max)||p.rank_min<1||p.rank_min>p.rank_max||p.rank_max>v.field_size)||new Set(v.positions.map(p=>p.segment)).size!==v.positions.length)errors.push("POSITIONS_INVALID");
  }else if(kind==="CROSSWALK"){
   if(!horse(v.jra_id)||!v.jra_id.startsWith("JRA:")||!horse(v.local_id)||!v.local_id.startsWith("LOCAL:")||v.official_crosswalk_attested!==true)missing.push("CROSSWALK_UNRESOLVED");
  }else if(!["INCIDENT","CURRENT_CARD","PROFILE","RATING","HISTORY","SCENARIO_INPUT"].includes(kind))errors.push("UNSUPPORTED_KIND");
  const key=JSON.stringify([e.jurisdiction,e.race_id,e.horse_id,e.peer_id??null,kind,e.event_at,e.observation_kind??null]);
  return {evidence_id:e.evidence_id,key,kind,errors,missing,stage:errors.length?"REJECTED":missing.length?"RESEARCH_CANDIDATE":"STRUCTURAL_ASOF_CANDIDATE",record:e};
 });
 const groups=new Map();
 for(const i of inspected.filter(i=>i.stage==="STRUCTURAL_ASOF_CANDIDATE")){
  if(!groups.has(i.key))groups.set(i.key,[]);groups.get(i.key).push(i);
 }
 const accepted=[];
 // A single official result / position series per race and horse cannot be made independent by changing the event timestamp.
 const singletonKinds=new Set(["RESULT","PEER_RESULT","POSITIONS","RACE_LAPS","CURRENT_CARD","HISTORY"]);
 const singleton=new Map();
 for(const [key,rows] of groups){const r=rows[0].record;if(!singletonKinds.has(r.kind))continue;const id=JSON.stringify([r.jurisdiction,r.race_id,r.horse_id,r.kind]);if(!singleton.has(id))singleton.set(id,[]);singleton.get(id).push(key);}
 const conflictKeys=new Set([...singleton.values()].filter(keys=>keys.length>1).flat());
 for(const [key,rows] of groups){
  if(conflictKeys.has(key)){for(const x of rows){x.stage="CONFLICT";x.errors.push("SINGLETON_EVENT_SCOPE_CONFLICT");}continue;}
  const variants=new Set(rows.map(r=>JSON.stringify(canonicalize(r.record.fact))));
  if(variants.size!==1){for(const x of rows){x.stage="CONFLICT";x.errors.push("ORIGINAL_EVENT_CONFLICT");}continue;}
  const primary=rows.slice().sort((a,b)=>a.evidence_id.localeCompare(b.evidence_id))[0];
  accepted.push({event_key:key,evidence_ids:rows.map(x=>x.evidence_id).sort(),record:primary.record,formal_admission:false});
 }
 return {accepted:accepted.sort((a,b)=>a.event_key.localeCompare(b.event_key)),inspected,formal_admissions:0,release_eligible:false};
}
export function historyDenominators(rows){
 const starts=rows.filter(r=>["FINISHED","DNF_STARTED","DQ_STARTED"].includes(r.start_status));
 const finished=starts.filter(r=>r.start_status==="FINISHED"&&Number.isInteger(r.finish)&&r.finish>0);
 const top2=finished.filter(r=>r.finish<=2).length,wins=finished.filter(r=>r.finish===1).length;
 return {history_rows:rows.length,actual_starts:starts.length,finished:finished.length,excluded:rows.filter(r=>["EXCLUDED_NOT_STARTED","CANCELLED_NOT_STARTED"].includes(r.start_status)).length,unknown:rows.filter(r=>r.start_status==="START_STATUS_UNKNOWN").length,wins,top2,win_share_of_top2:top2?wins/top2:null};
}

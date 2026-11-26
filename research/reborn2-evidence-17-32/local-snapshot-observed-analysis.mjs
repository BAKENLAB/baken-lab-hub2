// Offline REBORN2 research analysis of immutable prestart NAR snapshot witnesses.
// No network, scoring, production authorization, market, target result or inferred individual splits.
// Caller must obtain snapshot from the existing trusted read-only archive; this function does not authenticate caller data.
const time=x=>typeof x==='string'&&/(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(x)?Date.parse(x):NaN;
const int=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const codes={盛岡:10,水沢:11,浦和:18,船橋:19,大井:20,川崎:21,金沢:22,笠松:23,名古屋:24,園田:27,姫路:28,高知:31,佐賀:32,門別:36};
const raceKey=p=>JSON.stringify([p.raceDate,p.track,p.raceNo]);
const ticks=x=>typeof x==='number'&&Number.isFinite(x)&&x>0&&Math.abs(x*10-Math.round(x*10))<1e-6?Math.round(x*10):null;
function validRace(p,target){return p&&/^\d{4}-\d{2}-\d{2}$/.test(p.raceDate)&&p.raceDate<target&&Object.hasOwn(codes,p.track)&&int(p.raceNo,1,14);}
function resultRef(p){return 'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode='+codes[p.track]+'&k_raceDate='+p.raceDate.replaceAll('-','%2F')+'&k_raceNo='+p.raceNo;}
export function analyzeLocalSnapshot(s){
 const asOf=time(s.as_of),captured=time(s.captured_at),post=time(s.official_post_time),p=s.packet;
 if(!s.id||s.circuit!=='LOCAL'||!/^\d{4}-\d{2}-\d{2}$/.test(s.race_date)||![asOf,captured,post].every(Number.isFinite)||asOf>captured||captured>=post||p?.raceDate!==s.race_date||p?.raceTrack!==s.track||p?.raceNo!==s.race_no||p.marketUsed!==false||p.targetResultUsed!==false||!Array.isArray(p.evidence)||!Array.isArray(p.officialRaceLaps))throw Error('SNAPSHOT_GATE');
 const rows=[],seen=new Set(),horseIds=new Map(),reverse=new Map(),rejected=[],laps=new Map();
 for(const l of p.officialRaceLaps){
  const r=l.pastRace,k=raceKey(r??{});
  if(laps.has(k))throw Error('DUPLICATE_LAP');
  const t=time(l.sourceCheckedAt),winner=ticks(l.winner_time_seconds),distance=l.distance_m;
  if(!validRace(r,s.race_date)||l.sourceRef!==resultRef(r)||!Number.isFinite(t)||t>asOf||l.status!=='VERIFIED_RACE_LEVEL_LAPS'||l.finish_time_reconciled!==true||l.individual_horse_sectionals!==false||l.market_used!==false||l.target_result_used!==false||l.observed_before_target_start!==true||!int(distance,600,4000)||winner===null||!Array.isArray(l.segments)||l.segments.length!==Math.ceil(distance/200)||l.segment_count!==l.segments.length){rejected.push({type:'LAP',key:k,reason:'SOURCE_OR_SCOPE'});continue;}
  let pos=0,total=0,valid=true;const segments=[];
  for(const [i,a] of l.segments.entries()){
   const d=i===0?distance-200*(l.segments.length-1):200,v=ticks(a.seconds);
   if(a.from_m!==pos||a.to_m!==pos+d||a.distance_m!==d||v===null){valid=false;break;}
   pos+=d;total+=v;if(ticks(a.cumulative_seconds)!==total){valid=false;break;}
   segments.push({distance_m:d,seconds:v/10,from_m:a.from_m,to_m:a.to_m});
  }
  if(!valid||pos!==distance||total!==winner){rejected.push({type:'LAP',key:k,reason:'RECONCILIATION'});continue;}
  const equal=segments.filter(a=>a.distance_m===200);
  laps.set(k,{source_ref:l.sourceRef,source_checked_at:l.sourceCheckedAt,distance_m:distance,winner_seconds:winner/10,segments,equal_200m_fastest_s:Math.min(...equal.map(a=>a.seconds)),equal_200m_slowest_s:Math.max(...equal.map(a=>a.seconds)),last_600m_race_seconds:equal.length>=3?equal.slice(-3).reduce((a,b)=>a+ticks(b.seconds),0)/10:null,pace_vs_benchmark:null,scope:'RACE_LEVEL_ONLY'});
 }
 for(const e of p.evidence){
  const r=e.pastRace,k=JSON.stringify([e.horseNo,raceKey(r??{})]),id=/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=(\d{1,30})$/.exec(e.horseRef??'')?.[1],checked=time(e.sourceCheckedAt);
  if(seen.has(k))throw Error('DUPLICATE_PRIOR');seen.add(k);
  if(e.source!=='NAR_OFFICIAL_PAST_RACE_RESULT'||e.identityVerifiedBy!=='OFFICIAL_HORSE_REF'||!id||!validRace(r,s.race_date)||e.sourceRef!==resultRef(r)||!Number.isFinite(checked)||checked>asOf||!int(e.horseNo,1,24)||!int(e.pastHorseNo,1,24)||!Array.isArray(e.corners)||!e.corners.length||e.corners.some(c=>!int(c.corner,1,8)||!int(c.position,1,24))||new Set(e.corners.map(c=>c.corner)).size!==e.corners.length){rejected.push({type:'CORNER',key:k,reason:'SOURCE_IDENTITY_OR_POSITION'});continue;}
  if(horseIds.has(e.horseNo)&&horseIds.get(e.horseNo)!==id||reverse.has(id)&&reverse.get(id)!==e.horseNo)throw Error('IDENTITY_CONFLICT');
  horseIds.set(e.horseNo,id);reverse.set(id,e.horseNo);
  const positions=e.corners.slice().sort((a,b)=>a.corner-b.corner);
  const changes=positions.slice(1).map((b,i)=>{const a=positions[i];return {from_corner:a.corner,to_corner:b.corner,from_rank:a.position,to_rank:b.position,rank_gain:a.position-b.position,adjacent_number:b.corner===a.corner+1};});
  const lap=laps.get(raceKey(r));
  const out={
   '17':{status:'OBSERVED_FACT_ANALYZED',positions,field_size:null,normalized_position:null},
   '18':{status:changes.length?'OBSERVED_RANK_CHANGE_ANALYZED':'MISSING',changes,participant_consistency:'UNVERIFIED',relative_speed:null},
   '19':lap&&time(lap.source_checked_at)<=asOf?{status:'RACE_LAP_PROFILE_ANALYZED',...lap}:{status:'MISSING'},
   '22':{status:changes.some(c=>c.rank_gain>0)?'OBSERVED_POSITION_GAIN_ONLY':changes.length?'NO_OBSERVED_GAIN_IN_AVAILABLE_POSITIONS':'MISSING',gains:changes.filter(c=>c.rank_gain>0),inside_corner_path:null}
  };
  rows.push({current_no:e.horseNo,horse_id:id,prior_no:e.pastHorseNo,prior_race:r,source_ref:e.sourceRef,source_checked_at:e.sourceCheckedAt,analysis:out,ability_assessment_admitted:false});
 }
 const ids=[...horseIds.keys()],coverage={};
 for(const item of ['17','18','19','22']){const ok=row=>['OBSERVED_FACT_ANALYZED','OBSERVED_RANK_CHANGE_ANALYZED','RACE_LAP_PROFILE_ANALYZED','OBSERVED_POSITION_GAIN_ONLY','NO_OBSERVED_GAIN_IN_AVAILABLE_POSITIONS'].includes(row.analysis[item].status);coverage[item]={analyzed_rows:rows.filter(ok).length,analyzed_horses:new Set(rows.filter(ok).map(x=>x.current_no)).size,ability_admitted:0};}
 return {snapshot_id:s.id,circuit:'LOCAL',target_date:s.race_date,as_of:s.as_of,observed_horses:ids.length,observed_rows:rows.length,coverage,rows,rejected,scoring_authorized:false,limitations:['SOURCE_WITNESS_REPLAY_NOT_FRESH_OFFICIAL_REPLAY','ACTUAL_FIELD_AND_PARTICIPANT_CONSISTENCY_UNVERIFIED','PACE_BENCHMARK_NOT_CONNECTED','NO_INDIVIDUAL_SPLITS','NO_ABILITY_GRADE']};
}

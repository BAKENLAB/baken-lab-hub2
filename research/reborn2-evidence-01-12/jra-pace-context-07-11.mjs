// REBORN2 historical context for 07/08/10/11. Race laps are never horse splits.
// Only observed position transitions, relative final3f and race pace context. No causal inference or individual acceleration value.
const id=x=>/^\/JRADB\/accessU\.html\?CNAME=pw01dud[01]0(\d{10})\/[0-9A-F]{2}$/.exec(x??'')?.[1];
const time=x=>typeof x==='string'&&/(?:Z|[+-]\d\d(?::?\d\d)?)$/.test(x)?Date.parse(x):NaN;
const n=x=>x===null||x===undefined||x===''?null:Number.isFinite(Number(x))?Number(x):null;
const integer=(x,a,b)=>Number.isInteger(n(x))&&n(x)>=a&&n(x)<=b;
const ticks=x=>{const a=n(x);return a!==null&&a>0&&Math.abs(a*10-Math.round(a*10))<1e-6?Math.round(a*10):null;};
const missing=reason=>({status:'MISSING',reason});
const proxy=(value,limitation)=>({status:'PROXY_CONTEXT_ONLY',value,limitation});
export function paceContext0711({targetDate,roster,rows}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)||!Array.isArray(roster)||!roster.length||new Set(roster).size!==roster.length||!Array.isArray(rows))throw Error('INPUT');
 const seen=new Set(),out=[],excluded=[];
 for(const r of rows){
  if(!roster.includes(r.current_no)||!id(r.horse_ref)||id(r.horse_ref)!==r.horse_id||id(r.prior_horse_ref)!==r.horse_id||!/^pw01sde\d+\/[0-9A-F]{2}$/.test(r.source_ref??'')||!r.source_ref.split('/')[0].endsWith(r.race_date?.replaceAll('-',''))||!r.race_date||r.race_date>=targetDate||!(time(r.source_checked_at)<=time(r.runner_checked))||!(time(r.runner_checked)<time(r.post_at))||n(r.duplicate_n)!==1||!integer(r.finish,1,24)||!integer(r.field_size,r.finish,24)||!integer(r.distance,600,5000)||!['芝','ダート'].includes(r.surface)){excluded.push({horse_no:r.current_no,source_ref:r.source_ref,reason:'SOURCE_ID_OR_TIME'});continue;}
  const key=JSON.stringify([r.current_no,r.source_ref]);if(seen.has(key))throw Error('DUPLICATE');seen.add(key);
  const field=['n','unique_n','distinct_finish','clock_n'].every(k=>n(r[k])===r.field_size)&&n(r.min_finish)===1&&n(r.max_finish)===r.field_size&&n(r.bad_clock_n)===0;
  const lapTokens=typeof r.halon_times==='string'?r.halon_times.trim().split(/\s*-\s*/):[];
  const lap=lapTokens.every(x=>/^\d{1,2}\.\d$/.test(x))?lapTokens.map(ticks):[];
  const sections=Math.ceil(r.distance/200),first=r.distance-(sections-1)*200;
  const winner=ticks(r.winner_clock),raceF3=ticks(r.race_final3f);
  const lapValid=field&&lap.length===sections&&lap.every(x=>x!==null)&&winner!==null&&lap.reduce((s,x)=>s+x,0)===winner&&raceF3!==null&&lap.slice(-3).reduce((s,x)=>s+x,0)===raceF3;
  const corners=typeof r.corner_positions==='string'&&/^\d+(?:\s+\d+)+$/.test(r.corner_positions.trim())?r.corner_positions.trim().split(/\s+/).map(Number):[];
  const positionValid=field&&corners.length>=2&&corners.length<=4&&corners.every(x=>integer(x,1,r.field_size))&&corners[0]===n(r.early_pos)&&corners.at(-1)===n(r.final_turn_pos);
  const final3f=ticks(r.final3f),median=n(r.f3_median);
  const relativeValid=field&&n(r.f3_n)===r.field_size&&final3f!==null&&median!==null&&integer(r.f3_rank,1,r.field_size);
  const i={'07':missing('INDIVIDUAL_SPLITS_NOT_AVAILABLE'),'08':missing('POSITION_OR_RACE_PACE_UNVERIFIED'),'09':missing('OFFICIAL_INCIDENT_REPORT_NOT_CONNECTED'),'10':missing('INDIVIDUAL_SECOND_ACCELERATION_NOT_AVAILABLE'),'11':missing('DISTANCE_PACE_POSITION_OR_FINAL3F_UNVERIFIED')};
  const pace=lapValid?{scope:'RACE_LEADER_PASSAGE_ONLY',section_m:[first,...Array(sections-1).fill(200)],section_seconds:lap.map(x=>x/10),last600_seconds:raceF3/10,late_200m_changes_seconds:[(lap.at(-2)-lap.at(-3))/10,(lap.at(-1)-lap.at(-2))/10]}:null;
  const pos=positionValid?{ordered_corner_positions:corners,first_recorded:corners[0],last_recorded:corners.at(-1),finish:r.finish,first_to_last_gain:corners[0]-corners.at(-1),last_to_finish_gain:corners.at(-1)-r.finish,corner_labels:null}:null;
  const relative=relativeValid?{reported_final3f_seconds:final3f/10,field_rank:n(r.f3_rank),compared:r.field_size,field_median_residual_seconds:Math.round((final3f/10-median)*100)/100}:null;
  if(lapValid&&positionValid&&relativeValid){
   i['07']=proxy({late_race_pace:pace.late_200m_changes_seconds,relative_final3f:relative,last_to_finish_gain:pos.last_to_finish_gain},'Race-level pace and closing outcome; individual acceleration unmeasured.');
   i['08']=proxy({race_pace:pace,position:pos,relative_final3f:relative},'Position retention/gain is observed, not individual sustained speed.');
   i['11']=proxy({distance:r.distance,race_pace:pace,position:pos,relative_final3f:relative},'Observed late performance at distance; fatigue cause and between-distance effect not established.');
  }
  // Individual second acceleration requires time-aligned individual sectional observations; no substitute from race laps.
  out.push({horse_no:r.current_no,horse_id:r.horse_id,prior_date:r.race_date,source_ref:r.source_ref,conditions:{track:r.track,surface:r.surface,distance:r.distance,going:r.going,class_name:r.class_name},pace,position:pos,relative_final3f:relative,items:i,final_grade_effect:null});
 }
 const ids=['07','08','09','10','11'];return {rows:out,excluded,coverage:Object.fromEntries(ids.map(k=>[k,{proxy_rows:out.filter(x=>x.items[k].status==='PROXY_CONTEXT_ONLY').length,horses:new Set(out.filter(x=>x.items[k].status==='PROXY_CONTEXT_ONLY').map(x=>x.horse_no)).size}])),individual_split_measured:false,scoring_authorized:false};
}

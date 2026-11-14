import {resolveLocalHistoricalSurface} from './local-verified-condition-bridge.mjs';
/**
 * LOCAL1.6 factual pre-race whole-field content comparisons.
 * Only accepts authenticated, already identity/as-of validated COMPACT_V1.
 * No adopted scoring formula, target results, market or DB writes.
 */
const num=(x)=>typeof x==='number'&&Number.isFinite(x)?x:
 typeof x==='string'&&/^\d+(?:\.\d+)?$/.test(x.trim())?Number(x):null;
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const int=x=>Number.isInteger(x)&&x>0&&x<=24;
const key=x=>JSON.stringify([x.race_date,x.track,x.race_no]);
const ref=(n,i)=>'COMPACT_V1.runners[horse_no='+n+'].recent_runs['+i+']';
const elapsed=x=>{
 if(typeof x!=='string')return null;
 const m=x.normalize('NFKC').trim().match(/^(\d{1,2}):([0-5]\d)\.(\d{1,3})$/);
 if(!m)return null;const s=60*Number(m[1])+Number(m[2])+Number('0.'+m[3]);
 return s>=30&&s<=500?s:null;
};
const round=x=>Math.round(x*1000)/1000;
export function buildLocalFieldContentFacts(ctx){
 const day=ctx?.race?.race_date,rs=ctx?.runners,cond=ctx?.race?.conditions??{};
 if(ctx?.context_format!=='COMPACT_V1'||ctx?.race?.circuit!=='LOCAL'||
    ctx?.field_integrity_checked!==true||!date(day)||!Array.isArray(rs)||
    rs.length<1||rs.length>20||new Set(rs.map(r=>r.horse_no)).size!==rs.length||
    rs.some(r=>!int(r.horse_no)||!Array.isArray(r.recent_runs)||r.recent_runs.length>5||
      r.recent_runs.some(h=>!date(h.race_date)||h.race_date>=day)))
 return {status:'UNVERIFIED_INPUT',score_effect:0};
 const groups=new Map();
 const per=rs.map(r=>{
   const runs=r.recent_runs.map((h,i)=>{
    const finish=num(h.finish),early=num(h.early_pos),last=num(h.final_turn_pos),f3=num(h.final3f);
    const resolved=resolveLocalHistoricalSurface(h);
    const x={evidence_ref:ref(r.horse_no,i),race_date:h.race_date,track:h.track,race_no:h.race_no,
      race_name:h.race_name??null,distance:num(h.distance),surface:resolved.surface,surface_provenance:resolved.provenance,surface_source_ref:resolved.source_ref,going:h.going??null,
      finish:int(finish)?finish:null,raw_margin:h.margin??null,elapsed_seconds:elapsed(h.time_raw),
      early_pos:int(early)?early:null,final_turn_pos:int(last)?last:null,
      final3f_seconds:f3!==null&&f3>=25&&f3<=90?f3:null,
      current_track:h.track===ctx.race.track,current_distance:num(h.distance)===num(cond.distance)&&num(cond.distance)!==null,
      current_surface:resolved.surface!==null&&resolved.surface===cond.surface,
      current_going:typeof h.going==='string'&&h.going===cond.going};
    x.first_to_final_corner_gain=x.early_pos!==null&&x.final_turn_pos!==null?x.early_pos-x.final_turn_pos:null;
    x.final_corner_to_finish_gain=x.final_turn_pos!==null&&x.finish!==null?x.final_turn_pos-x.finish:null;
    if(typeof h.track==='string'&&Number.isInteger(h.race_no)&&h.race_no>0&&x.finish!==null){
     const k=key(h);if(!groups.has(k))groups.set(k,[]);groups.get(k).push({horse_no:r.horse_no,...x});
    }
    return x;
   });
   return {horse_no:r.horse_no,horse_name:r.horse_name,runs};
 });
 const direct=[];
 for(const entries of groups.values()){
   if(new Set(entries.map(x=>x.horse_no)).size!==entries.length)continue;
   for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
    const a=entries[i],b=entries[j];
    // Same date, track and race number AND mutually matching official conditions.
    if(a.distance===null||a.distance!==b.distance||!a.surface||a.surface!==b.surface)continue;
    if(a.race_name&&b.race_name&&a.race_name!==b.race_name)continue;
    direct.push({race_date:a.race_date,track:a.track,race_no:a.race_no,race_name:a.race_name,
     distance:a.distance,horse_nos:[a.horse_no,b.horse_no],finishes:[a.finish,b.finish],
     finish_leader:a.finish===b.finish?null:a.finish<b.finish?a.horse_no:b.horse_no,
     elapsed_a_minus_b_seconds:a.elapsed_seconds!==null&&b.elapsed_seconds!==null?round(a.elapsed_seconds-b.elapsed_seconds):null,
     final3f_a_minus_b_seconds:a.final3f_seconds!==null&&b.final3f_seconds!==null?round(a.final3f_seconds-b.final3f_seconds):null,
     refs:[a.evidence_ref,b.evidence_ref],scope:'SAME_HISTORICAL_RACE_CURRENT_FIELD_PAIR_ONLY'});
   }
 }
 return {status:'VERIFIED_WHOLE_FIELD_FACTS',runner_count:rs.length,
  per_runner:per,head_to_head:direct,head_to_head_count:direct.length,
  full_race_laps:'NOT_VERIFIED',opponent_followup_strength:'NOT_VERIFIED',
  course_correlation:'NOT_STATISTICALLY_VERIFIED',
  note:'Position changes and same-race time differences are factual observations, not proven trouble, overall pace or automatic points. Compare complete history and conditions before assigning independent 1.6 scores, record how cited facts affect each score/rank, then independently review EYE. No winner-gap inference from raw margin.',
  score_effect:0,market_used:false,target_result_used:false};
}

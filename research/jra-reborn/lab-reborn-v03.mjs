/**
 * LAB REBORN 0.3 — independent evidence evaluator / semantic repair version.
 * Deliberately NO old LAB base score/rank, odds, market or outcome as input.
 * Relative scores are NOT probabilities, all axis weights remain hypotheses.
 * Never mutate a FROZEN prediction or DB.
 */
const N = x => x===null||x===undefined||x===""||!Number.isFinite(Number(x))?null:Number(x);
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const round=(n,d=2)=>Math.round(n*10**d)/10**d;
const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
const validDate=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const ageDays=(from,to)=>(Date.parse(to+"T00:00:00Z")-Date.parse(from+"T00:00:00Z"))/86400000;
const grades={
 GI:["秋華賞","桜花賞","優駿牝馬","オークス","皐月賞","東京優駿","日本ダービー","菊花賞",
 "天皇賞","有馬記念","宝塚記念","ジャパンカップ","エリザベス女王杯","大阪杯",
 "安田記念","ヴィクトリアマイル","スプリンターズステークス","高松宮記念",
 "NHKマイルカップ","マイルチャンピオンシップ","フェブラリーステークス",
 "チャンピオンズカップ","朝日杯フューチュリティステークス","ホープフルステークス",
 "阪神ジュベナイルフィリーズ"],
 GII:["ローズS","ローズステークス","紫苑S","紫苑ステークス","神戸新聞杯",
 "セントライト記念","オールカマー","札幌記念","毎日王冠","京都大賞典",
 "フローラステークス","フローラS","青葉賞","富士ステークス","富士S",
 "ニュージーランドトロフィー","フィリーズレビュー"],
 GIII:["デイリー杯クイーンカップ","クイーンカップ","クイーンC","新潟記念",
 "小倉記念","中京記念","函館記念","七夕賞","共同通信杯","きさらぎ賞",
 "フェアリーステークス","シンザン記念"]
};
const nameGrade=x=>{
 if(typeof x!=="string")return null;
 const v=x.trim();
 // Never infer "grade" merely because a race ends in S or ステークス.
 // Check longest Roman sequence first: GIII must NEVER be mistaken for GI.
 if(/(?:G|Ｇ)(?:III|Ⅲ|3)(?![IVX0-9])/i.test(v))return 5;
 if(/(?:G|Ｇ)(?:II|Ⅱ|2)(?![IVX0-9])/i.test(v))return 6;
 if(/(?:G|Ｇ)(?:I|Ⅰ|1)(?![IVX0-9])/i.test(v))return 7;
 if(/グレード(?:Ⅲ|3)/.test(v))return 5;
 if(/グレード(?:Ⅱ|2)/.test(v))return 6;
 if(/グレード(?:Ⅰ|1)/.test(v))return 7;
 if(grades.GI.some(s=>v===s||v.includes(s)))return 7;
 if(grades.GII.some(s=>v===s||v.includes(s)))return 6;
 if(grades.GIII.some(s=>v===s||v.includes(s)))return 5;
 return null;
};
export function rebornClassLevel(raceClass,raceName){
 const name=nameGrade(raceName)??nameGrade(raceClass);
 if(name!==null)return name;
 const s=String(raceClass??"");
 if(/未勝利|新馬/.test(s))return 0;
 if(/1勝クラス|1勝ク/.test(s))return 1;
 if(/2勝クラス|2勝ク/.test(s))return 2;
 if(/3勝クラス|3勝ク/.test(s))return 3;
 if(/オープン|リステッド|Listed|L$/.test(s))return 4;
 return null;
}
const normTime=x=>N(x); // Historical result gap may be "win margin", see below.
function normalizeRun(e,isOld,ctx){
 const date=isOld?e.date:e.prior_date;
 const finish=N(e.finish),surface=isOld?e.surface:e.prior_surface;
 const distance=N(isOld?e.distance:e.prior_distance);
 const track=isOld?e.track:e.prior_track;
 const name=isOld?e.race_name:e.race_name;
 const priorClass=isOld?e.class_name:e.prior_class;
 if(!validDate(date)||date>=ctx.date||!(finish>0)||distance===null||
  distance<600||!["芝","ダート"].includes(surface))return null;
 const grade=rebornClassLevel(priorClass,name);
 const gradeTarget=rebornClassLevel(ctx.className,ctx.raceName);
 const diff=grade===null||gradeTarget===null?null:gradeTarget-grade;
 // Class G2 -> G1 is a one-step upgrade; maiden -> G1 is not interchangeable.
 const levelFactor=diff===null?0.90:
  diff<=0?1:diff===1?0.94:diff===2?0.85:diff===3?0.75:diff===4?0.65:0.55;
 const delta=Math.abs(distance-ctx.distance);
 const sprint=ctx.distance<=1400 && distance<=1400;
 const distFactor=delta<=100?1:
   delta<=200?(sprint?0.94:0.95):
   delta<=400?(sprint?0.82:0.87):
   delta<=600?0.73:0.55;
 const sameSurface=surface===ctx.surface;
 const surfaceFactor=sameSurface?1:0.73;
 const age=Math.max(0,ageDays(date,ctx.date));
 const ageFactor=clamp(1-age/2400,0.65,1);
 const rawGap=isOld?null:normTime(e.margin_to_winner);
 // IMPORTANT: source winner gap can encode victory margin over runner-up.
 // Winner's behind-the-winner gap is ALWAYS 0. Do not score winners as losing.
 const gap=finish===1?0:(rawGap!==null&&rawGap>=0?rawGap:null);
 const winMargin=finish===1?rawGap:null;
 const relativeField=N(e.field_size);
 const placed=finish<=3;
 let quality;
 if(finish===1)quality=0.97;
 else if(gap!==null){
  quality=gap<=0.1?0.95:gap<=0.3?0.87:gap<=0.5?0.79:
     gap<=0.8?0.66:gap<=1.2?0.51:gap<=1.7?0.36:
     gap<=2.5?0.20:0.07;
  if(finish<=3)quality=Math.max(quality,finish===2?0.66:0.58);
 }else{
  quality=finish===2?0.77:finish===3?0.68:
   finish<=6?0.37:finish<=10?0.20:0.06;
 }
 // Don't infer class from target race results or future opponent results.
 const adjusted=clamp(quality*levelFactor*distFactor*surfaceFactor*ageFactor);
 const f3=N(e.final3f_rank);
 const final3fVerified=isOld?f3!==null:
   f3!==null&&e.final3f_source==="VERIFIED_ARCHIVE";
 const rawCorners=isOld?e.corners:(e.corner_positions??e.live_corner_positions);
 const corners=Array.isArray(rawCorners)?rawCorners.map(N).filter(v=>v!==null):
   typeof rawCorners==="string"&&/^\s*\d+(?:[\s-]+\d+)*\s*$/.test(rawCorners)?
    rawCorners.trim().split(/[\s-]+/).map(Number):[];
 const lateGain=corners.length>=1&&corners[corners.length-1]>finish;
 const laps=typeof e.race_halons==="string"?e.race_halons.split(/\s*-\s*/).map(Number):[];
 const lapRecorded=laps.length>=5&&laps.every(v=>v>=8&&v<=20);
 // Contextual lap data alone is not evidence of individual ability.
 const competitionContent=gap!==null&&(gap<=1.0||placed)&&
  (final3fVerified||corners.length>=1)?
    clamp(0.52 + (final3fVerified&&f3<=3?0.18:0)
          +(lateGain?0.10:0)+(gap<=0.5?0.08:0)
          +((placed&&final3fVerified)?0.06:0)):null;
 return {date,finish,gap,win_margin_unverified:winMargin,grade,
  grade_target:gradeTarget,grade_diff:diff,
  race_name:name,class_name:priorClass,track,surface,distance,
  same_surface:sameSurface,same_track:track===ctx.track,
  delta_distance:delta,age,quality:round(quality,4),
  class_factor:round(levelFactor,4),transfer_factor:round(distFactor*surfaceFactor,4),
  adjusted:round(adjusted,4),old:isOld,
  content:competitionContent,final3f_verified:final3fVerified,
  lap_recorded:lapRecorded,late_gain:lateGain,
  source:isOld?"OLDER_ARCHIVE":e.final3f_source??e.source_kind??"UNKNOWN",
  provenance:isOld?"OLDER_ARCHIVE":e.source_kind??"UNKNOWN",field_size:relativeField};
}
const medianTop2=xs=>{
 const arr=[...xs].sort((a,b)=>b-a);
 return arr.length?mean(arr.slice(0,2)):null;
};
function evalHorse(rec,older,ctx){
 const recent=(Array.isArray(rec.past_race_content)?rec.past_race_content:[])
   .map(x=>normalizeRun(x,false,ctx)).filter(Boolean);
 const old=(Array.isArray(older.older_same_surface_near_distance)?
   older.older_same_surface_near_distance:[])
   .map(x=>normalizeRun(x,true,ctx)).filter(Boolean);
 const unique=new Map();
 for(const run of [...old,...recent]){
  const key=[run.date,run.track,run.surface,run.distance].join("|");
  if(!unique.has(key)||(!run.old&&unique.get(key).old))unique.set(key,run);
 }
 const history=[...unique.values()].sort((a,b)=>b.date.localeCompare(a.date));
 const comparable=history.filter(x=>x.same_surface&&x.delta_distance<=600);
 const near=history.filter(x=>x.same_surface&&x.delta_distance<=200);
 const transfers=history.filter(x=>!x.same_surface&&x.delta_distance<=400);
 const nearNow=recent.filter(x=>x.same_surface&&x.delta_distance<=400);
 const recentTransfer=recent.filter(x=>!x.same_surface&&x.delta_distance<=400);
 const peakEvidence=comparable.length?comparable:transfers;
 const peak=peakEvidence.length?clamp(0.70*Math.max(...peakEvidence.map(x=>x.adjusted))
   +0.30*medianTop2(peakEvidence.map(x=>x.adjusted))):null;
 const currentEvidence=nearNow.length?nearNow:recentTransfer;
 const mostRecent=currentEvidence.slice(0,4);
 const q=mostRecent.map(x=>x.adjusted);
 const form=q.length?clamp(0.65*mean(q)+0.35*Math.max(...q)):null;
 // Exact course proved -> solid, matched-distance across other tracks -> transfer,
 // but lack of same track is NOT negative proof of inability.
 // NEAR-DISTANCE ABILITY and EXACT-COURSE EXPERIENCE are independent.
 // A single old loss on the exact track must not erase later good similar runs.
 // Conversely an exact win is real positive evidence and may lift confidence.
 const exact=near.filter(x=>x.same_track);
 const sameSurf=near;
 const nearAbility=sameSurf.length?clamp(
    0.82*medianTop2(sameSurf.map(x=>x.adjusted))+
    0.18*mean(sameSurf.map(x=>x.adjusted))):null;
 const localProof=exact.length?clamp(
    0.78*medianTop2(exact.map(x=>x.adjusted))+
    0.22*mean(exact.map(x=>x.adjusted))):null;
 // Positive local proof can add at most 5 points to the axis; a negative
 // local indication can lower it at most 6.  No fixed penalty for no history.
 const localDelta=nearAbility===null||localProof===null?0:
    clamp(0.20*(localProof-nearAbility),-0.06,0.05);
 const fit=nearAbility===null?null:clamp(nearAbility+localDelta);
 const detail=mostRecent.filter(x=>x.content!==null);
 const content=detail.length?mean(detail.map(x=>x.content*x.class_factor)):null;
 const opponentInfo=(Array.isArray(rec.opponent_followups)?rec.opponent_followups:[])
  .filter(x=>validDate(x.later_date)&&x.later_date<ctx.date&&
    validDate(x.historical_race_date)&&x.historical_race_date<x.later_date&&
    N(x.historical_target_finish)!==null&&N(x.rival_historical_finish)!==null
    &&N(x.later_finish)!==null);
 const winners=new Set();
 for(const v of opponentInfo){
  // "He once lost to a future good horse" does not prove superiority.
  if(N(v.later_finish)<=3 &&
     N(v.historical_target_finish)-N(v.rival_historical_finish)<=2)
      winners.add(v.rival_name);
 }
 const rivals=winners.size?clamp(0.64+0.07*Math.min(3,winners.size)):null;
 const axes={peak,form,course_fit:fit,race_content:content,rival_strength:rivals};
 const weights={peak:0.30,form:0.27,course_fit:0.21,race_content:0.14,rival_strength:0.08};
 const available=Object.keys(axes).filter(k=>axes[k]!==null);
 const coverage=available.reduce((s,k)=>s+weights[k],0);
 const avg=coverage?available.reduce((s,k)=>s+axes[k]*weights[k],0)/coverage:null;
 // Missing evidence should lower CONFIDENCE, not guarantee "50 ability points".
 // Reliability regularizer modestly moves sparse estimates towards neutral.
 const confidence=clamp(0.7+0.3*coverage,0,1);
 const score=avg===null?null:100*(0.5+(avg-0.5)*confidence);
 const scored=score!==null && (comparable.length||transfers.length);
 return {horse_no:N(rec.horse_no),horse_name:rec.horse_name,
   score:scored?round(score):null,
   axes:Object.fromEntries(Object.entries(axes).map(([k,v])=>[k,v===null?null:round(v*100,1)])),
   evidence_coverage:round(coverage*100,1),
   confidence:round(confidence,3),
   status:scored?"SCORED":"INSUFFICIENT_HISTORY",
   data_warnings:[
    ...(near.length?[]:["NO_PROVEN_NEAR_DISTANCE_HISTORY"]),
    ...(!exact.length&&sameSurf.length?["COURSE_FIT_TRANSFER_ONLY"]:[]),
    ...(exact.length&&localDelta<0?["PRIOR_EXACT_COURSE_CAUTION"]:[]),
    ...(detail.length?[]:["UNVERIFIED_POSITION_AND_3F_CONTENT"]),
    ...(coverage<0.60?["LOW_EVIDENCE_COVERAGE"]:[])
   ],
   source_summary:{recent:recent.length,older:old.length,comparable:comparable.length,
     near:near.length,transfer:transfers.length,
     exact_course:exact.length,near_ability:nearAbility===null?null:round(nearAbility*100,1),
     local_proof:localProof===null?null:round(localProof*100,1),
     current_similar:nearNow.length,usable_content:detail.length,
     credited_opponents:winners.size},
   evidence:history.slice(0,8).map(x=>({
    date:x.date,track:x.track,race_name:x.race_name,
    class_name:x.class_name,class_level:x.grade,
    finish:x.finish,gap_behind_winner:x.gap,
    unverified_winning_margin:x.win_margin_unverified,
    surface:x.surface,distance:x.distance,
    adjusted_run_quality:round(x.adjusted*100,2),
    provenance:x.provenance,final3f_verified:x.final3f_verified
   }))};
}
export function buildRebornV02(packet,ctx){
 if(!ctx||!validDate(ctx.date)||!["芝","ダート"].includes(ctx.surface)||
    ![1,2,3,4,5,6,7,8,9,10,11,12].includes(Number(ctx.raceNo))||
    N(ctx.distance)===null||!packet||packet.race_date!==ctx.date||
    packet.track!==ctx.track||N(packet.race_no)!==N(ctx.raceNo))
  return {status:"INVALID_INPUT",runners:[],production_write:false};
 const a=packet.recent_evidence?.runners;
 const b=packet.older_same_course_evidence;
 if(!Array.isArray(a)||!Array.isArray(b)||a.length<5||a.length!==b.length)
  return {status:"INCOMPLETE_ROSTER",runners:[],production_write:false};
 const byNo=new Map(b.map(x=>[N(x.horse_no),x]));
 if(byNo.size!==a.length||new Set(a.map(x=>N(x.horse_no))).size!==a.length)
  return {status:"DUPLICATE_ROSTER",runners:[],production_write:false};
 const all=a.map(x=>{
  const old=byNo.get(N(x.horse_no));
  if(!old||old.horse_name!==x.horse_name)return null;
  return evalHorse(x,old,ctx);
 });
 if(all.some(x=>x===null))
  return {status:"IDENTITY_MISMATCH",runners:[],production_write:false};
 all.sort((a,b)=>(b.score??-1)-(a.score??-1)||a.horse_no-b.horse_no);
 all.forEach((x,i)=>{x.reborn_rank=x.score===null?null:i+1;});
 const complete=all.every(x=>x.score!==null);
 return {status:complete?"RESEARCH_READY":"PARTIAL_HISTORY",
   model:"LAB_REBORN_0.3_COURSE_BALANCE",score_label:"UNCALIBRATED_INDEPENDENT_ABILITY",
   runners:all,top5:complete?all.slice(0,5):[],
   provisional_top5:complete?[]:all.filter(x=>x.score!==null).slice(0,5),
   field_complete:complete,
   calibrated:false,weights_validated:false,
   uses_old_lab:false,uses_odds:false,production_write:false,
   race_date:ctx.date,track:ctx.track,race_no:N(ctx.raceNo)};
}

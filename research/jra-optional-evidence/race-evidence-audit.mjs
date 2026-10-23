/**
 * JRA 0.4 / verified evidence audit.
 *
 * Pure, read-only and NON-SCORING. A future ranker may consume the flags after
 * chronological validation. Not permitted to change existing BASE rank/EYE.
 *
 * Input bundle is the result of private.jra_v04_evidence_bundle_v1.
 * targetSurface/targetDistance are verified from official entry card, not odds.
 */
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
const validDay=x=>typeof x==="string"&&datePattern.test(x)
  && Number.isFinite(Date.parse(x+"T00:00:00Z"));
const positiveInt=x=>Number.isInteger(x)&&x>0;
const asNum=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))
  ? Number(x):null;
function note(day,text){return {source_date:day,text};}
function baseResult(status){return {
  status,scoring_status:"BASELINE_UNCHANGED",
  score_effect:0,rank_effect:false,eye_effect:false,
  usable_without_extra_comments:true, runners:[],
};}
export function auditJraV04Race(bundle,{targetSurface,targetDistance}={}){
  const date=bundle?.race_date;
  if(!validDay(date)||!Array.isArray(bundle?.runners))
    return baseResult("INVALID_OR_MISSING_EVIDENCE");
  const rows=bundle.runners;
  const identifiers=rows.map(x=>x?.horse_no);
  if(identifiers.some(x=>!positiveInt(x))||new Set(identifiers).size!==rows.length)
    return baseResult("DUPLICATE_OR_INVALID_RUNNERS");
  const targetMeters=asNum(targetDistance);
  const knownSurface=targetSurface==="芝"||targetSurface==="ダート"
    ?targetSurface:null;
  const runners=rows.map(row=>{
    const history=Array.isArray(row?.past_race_content)
      ?row.past_race_content.filter(h=>h&&validDay(h.prior_date)
        &&h.prior_date<date):[];
    const archived=history.filter(h=>asNum(h.archive_match_count)===1);
    const sameSurface=knownSurface!==null
      ?history.filter(h=>h.prior_surface===knownSurface):[];
    const nearCondition=targetMeters!==null&&targetMeters>0
      ?sameSurface.filter(h=>asNum(h.prior_distance)!==null
        &&Math.abs(Number(h.prior_distance)-targetMeters)<=200):[];
    const relevantClose=nearCondition.filter(h=>{
      const gap=asNum(h.margin_to_winner),finish=asNum(h.finish);
      return gap!==null&&gap>=0&&gap<=0.5&&finish!==null&&finish>=1;
    });
    const knownFast3f=archived.filter(h=>{
      const r=asNum(h.final3f_rank);
      return r!==null&&r>=1&&r<=3;
    });
    const rawRivals=Array.isArray(row?.opponent_followups)
      ?row.opponent_followups:[];
    const rivals=rawRivals.filter(x=>x&&validDay(x.historical_race_date)
      &&validDay(x.later_date)&&x.historical_race_date<x.later_date
      &&x.later_date<date&&positiveInt(asNum(x.later_finish))
      &&Number(x.later_finish)<=3&&typeof x.rival_name==="string"
      &&x.rival_name.trim()!=="");
    const rivalsOnlyKnownRuns=rivals.filter(x=>
      history.some(h=>h.prior_date===x.historical_race_date
        &&asNum(h.archive_match_count)===1));
    const distinctRivals=new Set(rivalsOnlyKnownRuns.map(x=>x.rival_name));
    const facts=[];
    for(const h of [...relevantClose].sort((a,b)=>b.prior_date.localeCompare(a.prior_date)).slice(0,4)){
      const baseDate=h.prior_date;
      const fin=asNum(h.finish),gap=asNum(h.margin_to_winner);
      const rank=asNum(h.archive_match_count)===1?asNum(h.final3f_rank):null;
      facts.push(note(baseDate,
        (h.race_name??h.prior_track??"過去走")+" "+
        h.prior_surface+h.prior_distance+"m "+
        fin+"着・着差"+gap.toFixed(1)+"秒"+
        (rank!==null?"・上がり順位"+rank:"")));
    }
    for(const h of [...knownFast3f].sort((a,b)=>b.prior_date.localeCompare(a.prior_date)).slice(0,2)){
      const exists=facts.some(f=>f.source_date===h.prior_date
        &&f.text.includes("上がり順位"));
      if(!exists) facts.push(note(h.prior_date,
        (h.race_name??"過去走")+" 上がり順位"+Number(h.final3f_rank)+
        "・着順"+(h.finish??"不明")));
    }
    // Rival performances are shown as context, NEVER multiplied into points.
    for(const f of [...rivalsOnlyKnownRuns].sort((a,b)=>b.later_date.localeCompare(a.later_date)).slice(0,4)){
      facts.push(note(f.later_date,
        "過去の対戦馬"+f.rival_name+"が"+(f.later_race??"別レース")+"で"+
        f.later_finish+"着（当時の対象馬"+f.historical_target_finish+"着）"));
    }
    const caveats=[];
    if(history.length===0)caveats.push("過去走履歴が取得できない");
    if(archived.length<history.length)caveats.push("過去走の詳細アーカイブに欠損あり");
    if(!knownSurface||targetMeters===null)caveats.push("今回の馬場・距離が未確定");
    if(knownSurface&&sameSurface.length===0)caveats.push("今回と同じ芝・ダートの過去走なし（適性不明、減点ではない）");
    if(rawRivals.length!==rivals.length)caveats.push("公開日・レース日を検証できない相手関係は除外");
    if(rivalsOnlyKnownRuns.length!==rivals.length)caveats.push("元の過去走と照合できない相手関係は除外");
    return {
      horse_no:row.horse_no,horse_name:row.horse_name,
      prior_history_count:history.length,
      full_content_verified_count:archived.length,
      same_surface_runs:sameSurface.length,
      near_condition_runs:nearCondition.length,
      competitive_near_condition_runs:relevantClose.length,
      verified_fast3f_runs:knownFast3f.length,
      rival_followup_results:rivalsOnlyKnownRuns.length,
      distinct_rivals_with_followups:distinctRivals.size,
      facts,caveats,
      // Never calculate new rankings from evidence quantity alone.
      recommended_ability_score:null,estimated_finish:null,
      rank_effect:false,score_effect:0,
    };
  });
  return {
    status:"READY",target_race_date:date,
    target_surface:knownSurface,target_distance:targetMeters,
    scoring_status:"BASELINE_UNCHANGED",
    score_effect:0,rank_effect:false,eye_effect:false,
    usable_without_extra_comments:true,runners,
  };
}

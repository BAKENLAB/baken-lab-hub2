/**
 * JRA full-depth evidence save guard (2026-11-21).
 * Fail closed before a NEW official FROZEN. Does not write, claim, access
 * market odds, use target-race results, or alter an existing prediction.
 * Enforces source-anchored, complete, numerically consistent full-field review.
 */
const validNo=x=>Number.isInteger(x)&&x>=1&&x<=24;
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const text=x=>typeof x==="string"?x.trim():"";
const day=x=>typeof x==="string"&&/^20\d\d-\d\d-\d\d$/.test(x);
const distinct=a=>new Set(a).size===a.length;
const result=(ok,reason,detail={})=>({ok,reason,guard_version:"JRA_ASOF_FULL_DEPTH_REQUIRED_V1",...detail,
 prediction_saved:false,market_used:false,target_result_used:false,frozen_changed:false});
const allTypes=new Set(["distance","class","margin","corners","last3f","going","rest","course","eval","pace","opponent","race_shape"]);
function sourceToken(p,n,i){
 const s=text(p.source_ref);
 return s||"CLAIMED_CONTEXT_RUN:"+n+":"+i;
}
const JRA_CLAIM_REF=/^JRA_CLAIMED_CONTEXT\.runner_history\[horse_no=\d{1,2}\]\.past_runs\[\d\]$/;
const clean=x=>text(x).normalize("NFKC");
export function inspectJraFullDepthSave({context,payload,evalInput}={}){
 const r=context?.race, candidate=context?.candidates;
 const rows=context?.runner_history, saved=payload?.runners, audit=payload?.audit;
 if(!r||!day(r.race_date)||r.race?.race_type==="障害"||r.field_payload?.race?.race_type==="障害"||
   !Array.isArray(candidate)||!Array.isArray(rows)||!Array.isArray(saved)||
   rows.length<6||rows.length>24||rows.length!==candidate.length||rows.length!==saved.length||
   !audit||typeof audit!=="object")return result(false,"UNVERIFIED_CURRENT_FIELD");
 if(audit.market_used_for_ranking!==false||audit.market_used_for_eye!==false||
   audit.target_result_used!==false||!Array.isArray(payload?.bets)||payload.bets.length!==0)
   return result(false,"MARKET_TARGET_RESULT_OR_BETS_NOT_EXCLUDED");
 const base=candidate.slice().sort((a,b)=>a.base_rank-b.base_rank||a.horse_no-b.horse_no).map(x=>x.horse_no);
 if(!base.every(validNo)||!distinct(base)||base.length!==rows.length)return result(false,"BASE_CORE_ORDER_UNAVAILABLE");
 const expected=new Map(rows.map(x=>[x.horse_no,x])),byRank=saved.slice().sort((a,b)=>a.rank-b.rank),
   ranked=byRank.map(x=>x.horse_no), reviews=audit.runner_history_checked;
 if(expected.size!==rows.length||!distinct(ranked)||byRank.some((x,i)=>!validNo(x.horse_no)||
   x.rank!==i+1||!expected.has(x.horse_no)||clean(x.horse_name)!==clean(expected.get(x.horse_no).horse_name)||
   !Number.isInteger(x.score)||x.score<0||x.score>100))
   return result(false,"FULL_FIELD_RANK_OR_SCORE_INVALID");
 if(!Array.isArray(payload.top5)||payload.top5.length!==5||
   byRank.slice(0,5).some((x,i)=>x.horse_no!==payload.top5[i]?.horse_no))
   return result(false,"TOP5_NOT_DERIVED_FROM_FULL_FIELD");
 const check=audit.rank_review_before_eval;
 if(!check||check.review_scope!=="ALL_"+rows.length+"_ACTIVE"||
   !Array.isArray(check.base_core_order)||!Array.isArray(check.independent_reassessment_order)||
   JSON.stringify(check.base_core_order)!==JSON.stringify(base)||
   JSON.stringify(check.independent_reassessment_order)!==JSON.stringify(ranked)||
   text(check.reason).length<55)return result(false,"INDEPENDENT_WHOLE_FIELD_REASSESSMENT_NOT_EVIDENCED");
 if(!Array.isArray(reviews)||reviews.length!==rows.length||
   !distinct(reviews.map(x=>x.horse_no)))
   return result(false,"PER_HORSE_EVIDENCE_REVIEW_REQUIRED");
 const evaluated=new Map((evalInput?.runners??[]).map(x=>[x.horse_no,x]));
 let official=0,corner=0,late=0,priorRuns=0,withEffects=0;
 const fingerprints=[];
 for(const row of rows){
   const review=reviews.find(x=>x.horse_no===row.horse_no);
   const s=saved.find(x=>x.horse_no===row.horse_no);
   const c=candidate.find(x=>x.horse_no===row.horse_no);
   const past=row.past_runs??[];
   if(!review||!s||!c||!Array.isArray(past)||past.length>20||
      review.horse_no!==row.horse_no||review.history_count!==past.length||
      review.rank_before!==c.base_rank||review.rank_after!==s.rank||
      review.score_after!==s.score||text(review.reason).length<55)
     return result(false,"HORSE_REVIEW_MISSING_OR_INCONSISTENT",{horse_no:row.horse_no});
   if(!Array.isArray(review.source_refs)||!Array.isArray(review.evidence_effects)||
      !distinct(review.source_refs)||!review.evidence_effects.length)
     return result(false,"HORSE_PROVENANCE_OR_SCORE_EFFECTS_MISSING",{horse_no:row.horse_no});
   const map=new Map(past.map((p,i)=>[sourceToken(p,row.horse_no,i),p]));
   if(review.source_refs.length!==map.size||review.source_refs.some(x=>!map.has(x)))
     return result(false,"RECENT_OFFICIAL_HISTORY_NOT_FULLY_REVIEWED",{horse_no:row.horse_no});
   if(past.some(p=>!day(p.race_date)||p.race_date>=r.race_date))
     return result(false,"HISTORY_NOT_AS_OF_RACE",{horse_no:row.horse_no});
   const required=new Set();
   if(past.some(p=>finite(p.margin_to_winner)))required.add("margin");
   if(past.some(p=>Array.isArray(p.corner_positions)&&p.corner_positions.length>=2))required.add("corners");
   if(past.some(p=>finite(p.final3f)))required.add("last3f");
   if(past.some(p=>text(p.race_class)))required.add("class");
   if(past.some(p=>text(p.surface)&&finite(p.distance)))required.add("distance");
   if(past.some(p=>text(p.going)))required.add("going");
   const actual=new Set(),seen=new Set();
   let sum=0;
   for(const effect of review.evidence_effects){
      const kind=effect?.kind,ref=effect?.source_ref,pts=effect?.points;
      if(!allTypes.has(kind)||!finite(pts)||!Number.isInteger(pts)||pts<-15||pts>15||
          !text(ref)||seen.has(kind+"|"+ref))
       return result(false,"INVALID_SCORED_EVIDENCE_FACTOR",{horse_no:row.horse_no});
      seen.add(kind+"|"+ref);
      let prior=map.get(ref);
      if(!prior&&["eval","pace"].includes(kind)){
       const e=evaluated.get(row.horse_no);
       const verified=(e?.all_eval_correlated_past_runs??[]).find(x=>
         x.verified_run_ref===ref&&JRA_CLAIM_REF.test(ref)&&x.prior_date<r.race_date&&
         x.official_archive_detail_verified===true&&
         (kind!=="pace"||text(x.official_race_halon_laps)));
       if(!verified)return result(false,"UNVERIFIED_EVAL_OR_LAP_REFERENCE",{horse_no:row.horse_no});
      }else if(!prior){
       return result(false,"UNKNOWN_OFFICIAL_PAST_RUN_REF",{horse_no:row.horse_no});
      }
      if(prior){
        if(kind==="margin"&&!finite(prior.margin_to_winner))return result(false,"UNVERIFIED_MARGIN",{horse_no:row.horse_no});
        if(kind==="corners"&&!(Array.isArray(prior.corner_positions)&&prior.corner_positions.length>=2))return result(false,"UNVERIFIED_CORNERS",{horse_no:row.horse_no});
        if(kind==="last3f"&&!finite(prior.final3f))return result(false,"UNVERIFIED_LAST3F",{horse_no:row.horse_no});
        if(kind==="class"&&!text(prior.race_class))return result(false,"UNVERIFIED_CLASS",{horse_no:row.horse_no});
        if(kind==="going"&&!text(prior.going))return result(false,"UNVERIFIED_GOING",{horse_no:row.horse_no});
        if(kind==="distance"&&(!text(prior.surface)||!finite(prior.distance)))return result(false,"UNVERIFIED_DISTANCE",{horse_no:row.horse_no});
        if(kind==="opponent"||kind==="race_shape")return result(false,"OPPONENT_OR_PACE_INTERPRETATION_NOT_SOURCE_VERIFIED",{horse_no:row.horse_no});
      }
      actual.add(kind);sum+=pts;
   }
   // An available historical feature cannot silently be dropped from review.
   for(const k of required)if(!actual.has(k))
     return result(false,"AVAILABLE_FEATURE_NOT_ASSESSED_"+k,{horse_no:row.horse_no});
   if(!Number.isInteger(review.base_score)||review.base_score<0||review.base_score>100||
       Math.max(0,Math.min(100,review.base_score+sum))!==s.score)
     return result(false,"EVIDENCE_POINTS_NOT_REFLECTED_IN_SCORE",{horse_no:row.horse_no});
   if(past.length&&review.evidence_effects.every(e=>e.points===0))
     return result(false,"EVIDENCE_ALL_ZERO_IMPACT",{horse_no:row.horse_no});
   priorRuns+=past.length;official+=past.filter(p=>text(p.source_ref)).length;
   corner+=past.filter(p=>Array.isArray(p.corner_positions)&&p.corner_positions.length>=2).length;
   late+=past.filter(p=>finite(p.final3f)).length;
   if(review.evidence_effects.some(e=>e.points!==0))withEffects++;
   fingerprints.push({horse_no:row.horse_no,rank_before:c.base_rank,rank_after:s.rank,score_after:s.score,
     history_count:past.length,feature_categories:[...actual].sort(),evidence_effect_count:review.evidence_effects.length,
     source_refs:review.source_refs.slice()});
 }
 if(evalInput?.status!=="READY_FOR_OFFICIAL_WHOLE_FIELD_COURSE_REVIEW"||
   evalInput?.eval_normal_rows!==1942||evalInput?.runners?.length!==rows.length)
   return result(false,"EVAL_1942_CURRENT_FIELD_UNVERIFIED");
 if(audit.eval_normal_relations_checked!==1942||
   audit.runner_history_checked.length!==rows.length||
   audit.market_fields_excluded!==true)
   return result(false,"OFFICIAL_EVIDENCE_COUNTERS_OR_MARKET_EXCLUSION_MISSING");
 return result(true,"FULL_FIELD_ASOF_REVIEW_AND_SCORE_PROOF_CHECKED",{
   field_count:rows.length,prior_run_rows:priorRuns,official_source_refs:official,
   corner_rows:corner,last3f_rows:late,horses_with_scored_evidence:withEffects,
   base_core_order:base,independent_reassessment_order:ranked,reviewed:racesafe(r,rows),
   per_runner:fingerprints
 });
}
function racesafe(r,rows){return {date:r.race_date,track:r.track,race_no:r.race_no,active:rows.length};}

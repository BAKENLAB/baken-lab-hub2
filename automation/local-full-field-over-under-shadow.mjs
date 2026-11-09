/**
 * LOCAL1.6 full-field BOTH-SIDED over/under valuation challenger (V0.1).
 *
 * Not a rank-5-vs-6 shortcut. Review each TOP5 incumbent for disproportionately
 * positive treatment AND every outsider for overly harsh negative treatment.
 * Pure pre-race, official-claimed-history only; no results, market, jobs, DB or
 * existing FROZEN writes. A non-production rank hypothesis is emitted only
 * where independently verified same-venue/surface/distance/class evidence
 * supports BOTH sides of an exchange. Unknown history is NEVER a negative.
 *
 * This detects specific factual contradictions; it does NOT prove the original
 * score wrong or estimate class equivalence for new LOCAL transfers.
 */
import {resolveLocalOfficialClassLiteral} from './local-verified-condition-bridge.mjs';

const clean=x=>String(x??'').normalize('NFKC').replace(/\s+/g,'').trim();
const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T00:00:00Z'));
const instant=x=>typeof x==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(x)&&Number.isFinite(Date.parse(x))?Date.parse(x):NaN;
const horseNo=x=>Number.isInteger(x)&&x>=1&&x<=24;
// Live MCP observation_at is UTC ISO; NAR's race_date is Japan-local.
// Comparing the raw UTC date falsely rejects genuine early-morning CLAIMs.
const japanDate=x=>Number.isFinite(instant(x))?
  new Date(instant(x)+9*3600000).toISOString().slice(0,10):null;
const numeric=x=>typeof x==='number'&&Number.isFinite(x)?x:typeof x==='string'&&/^\d+(?:\.\d+)?$/.test(x.trim())?Number(x):null;
const status=(kind,extra={})=>({
 status:kind,mode:'LOCAL_FULL_FIELD_BIDIRECTIONAL_SHADOW_V0_1',
 production_rank_effect:false,production_score_effect:false,
 frozen_modified:false,market_used:false,target_result_used:false,
 ...extra
});
const refuse=why=>status('UNVERIFIED',{reason:why,candidate_order:null});
const poisoned=o=>o&&['win_odds','odds','popularity','market','result','finishers','payouts'].some(k=>Object.hasOwn(o,k));
const days=(recent,old)=>(Date.parse(recent+'T00:00:00Z')-Date.parse(old+'T00:00:00Z'))/86400000;

function profile(runner, conditions) {
 let matching=0,podium=0,nearMiss=0,bigLoss=0,deepFinishes=0,olderPodium=0,otherVenueOrClass=0;
 const positive=[],negative=[],seen=new Set();
 for(const run of runner.supporting_runs){
  if(!date(run.race_date)||run.race_date>=conditions.race_date||
     poisoned(run)||!Number.isInteger(run.distance)||!Number.isInteger(run.finish)||
     run.finish<1||run.finish>24||!clean(run.track)||!clean(run.surface)||
     typeof run.evidence_ref!=='string'||!/^COMPACT_V1\.runners\[horse_no=\d{1,2}\]\.recent_runs\[\d\]$/.test(run.evidence_ref)||
     !run.evidence_ref.includes('horse_no='+runner.horse_no+']')||
     seen.has(run.evidence_ref))
    return null;
  seen.add(run.evidence_ref);
  // Only verified history whose race and athlete identity were already
  // checked by the trusted CLAIM context is supplied to this function.
  const sameSurface=clean(run.surface)===clean(conditions.surface);
  const sameVenue=clean(run.track)===clean(conditions.track);
  const similar=run.distance>=800&&run.distance<=3600&&
    Math.abs(run.distance-conditions.distance)<=200;
  const cls=clean(run.class??run.race_class??run.class_name);
  const sameClass=cls&&cls===conditions.class_label;
  if(!sameSurface||!sameVenue||!similar||!sameClass){
   otherVenueOrClass++;continue;
  }
  matching++;
  const age=days(conditions.race_date,run.race_date);
  // The NAR 'raw_margin' describes the PRECEDING horse, not the winner.
  // Even if a number happens to be present, it is NOT a winner-relative
  // loss magnitude unless an independent source explicitly verified that.
  const margin=run.margin_basis==='VERIFIED_WINNER_RELATIVE_SECONDS'?
    numeric(run.margin):null;
  if(run.finish<=3){
   if(age<=365){
    podium++;
    positive.push({type:'MATCHED_PODIUM',source_ref:run.evidence_ref,
      past_race_date:run.race_date,finish:run.finish,age_days:age});
   }else olderPodium++;
  } else if(run.finish<=5&&margin!==null&&margin<=0.4&&age<=365) {
   nearMiss++;
   positive.push({type:'CLOSE_LOSS_NOT_PODIUM',source_ref:run.evidence_ref,
     past_race_date:run.race_date,finish:run.finish,margin,age_days:age});
  }
  if(run.finish>=8&&age<=365){
   deepFinishes++;
   negative.push({type:'VERIFIED_LOW_FINISH_POSITION_ONLY',source_ref:run.evidence_ref,
      past_race_date:run.race_date,finish:run.finish,
      winner_gap_status:margin===null?'UNVERIFIED_WINNER_GAP':'VERIFIED',age_days:age});
   if(margin!==null&&margin>=1.5)bigLoss++;
  }
 }
 // The historical context is strictly official pre-race context.  Keep
 // uncalibrated condition changes on the radar instead of discarding them.
 // They are separate REVIEW leads, never automatic promotion evidence.
 const contextLeads=[],contextSeen=new Set();
 const context=Array.isArray(runner.context_runs)?runner.context_runs:runner.supporting_runs;
 if(context.length>5)return null;
 for(const h of context){
  if(!date(h?.race_date)||h.race_date>=conditions.race_date||
     !horseNo(h.finish)&&h.finish!==null||
     !clean(h.track)||poisoned(h)||
     typeof h.evidence_ref!=='string'||
     !/^COMPACT_V1\\.runners\\[horse_no=\\d{1,2}\\]\\.recent_runs\\[\\d\\]$/.test(h.evidence_ref)||
     !h.evidence_ref.includes('horse_no='+runner.horse_no+']')||
     contextSeen.has(h.evidence_ref))return null;
  contextSeen.add(h.evidence_ref);
  const age=days(conditions.race_date,h.race_date);
  if(age>365||!Number.isInteger(h.finish)||h.finish>5||h.finish<1)continue;
  const isSame=h.track===conditions.track&&h.surface===conditions.surface&&
   Number.isInteger(h.distance)&&Math.abs(h.distance-conditions.distance)<=200&&
   clean(h.class)===conditions.class_label;
  if(isSame)continue;
  contextLeads.push({
   type:h.finish===1?'OTHER_CONDITION_WIN':
    h.finish<=3?'OTHER_CONDITION_PODIUM':'OTHER_CONDITION_TOP5',
   source_ref:h.evidence_ref,past_race_date:h.race_date,
   finish:h.finish,track:h.track,surface:h.surface??null,
   distance:h.distance??null,class_literal:h.class??null,
   relevance:'UNVERIFIED_TRANSFER_OR_DISTANCE_CLASS_EQUIVALENCE_REVIEW_ONLY',
   age_days:age
  });
 }
 const freshPositive=positive.some(x=>x.age_days<=180);
 return {
  horse_no:runner.horse_no,horse_name:runner.horse_name,
  matching_comparable_runs:matching,
  recent_matched_podium:podium,small_margin_near_misses:nearMiss,
  recent_matched_big_losses:bigLoss,
  recent_matched_low_finishes:deepFinishes,
  older_matched_podium:olderPodium,
  other_venue_or_class_runs:otherVenueOrClass,
  cross_condition_positive_leads:contextLeads,
  positive_evidence:positive,negative_evidence:negative,
  has_fresh_positive: freshPositive,
  missing_history_is_not_failure:true
 };
}

export function buildLocalFullFieldOverUnderShadow({race,baseline,comparison}={}){
 if(!race||!date(race.race_date)||!clean(race.track)||!horseNo(race.race_no)||
    !Number.isInteger(race.distance)||race.distance<800||race.distance>3600||
    !['ダート','芝'].includes(race.surface)||
    !Number.isFinite(instant(race.observation_at))||
    !Number.isFinite(instant(race.post_time))||
    instant(race.observation_at)>=instant(race.post_time)||
    japanDate(race.observation_at)!==race.race_date||
    poisoned(race))return refuse('RACE_ASOF_OR_CONDITION_INVALID');
 const cls=resolveLocalOfficialClassLiteral(race.class_name??race.race_name);
 if(cls.status!=='OFFICIAL_CLASS_LITERAL')return refuse('OFFICIAL_TARGET_CLASS_UNVERIFIED');
 if(!Array.isArray(baseline)||baseline.length<6||baseline.length>20||
    !comparison||comparison.status!=='READY'||comparison.market_used!==false||
    comparison.target_result_used!==false||comparison.rank_effect!==false||
    comparison.data_scope!=='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY'||
    !Array.isArray(comparison.runner_evidence)||comparison.runner_evidence.length!==baseline.length||
    comparison.target_date!==race.race_date||poisoned(comparison))
  return refuse('SOURCE_OR_COMPLETE_FIELD_INVALID');
 const ranks=new Set(),field=new Map();
 for(const runner of baseline){
  if(!horseNo(runner?.horse_no)||!clean(runner.horse_name)||
     !Number.isInteger(runner.rank)||runner.rank<1||runner.rank>baseline.length||
     !Number.isFinite(runner.score)||runner.score<0||runner.score>100||
     ranks.has(runner.rank)||field.has(runner.horse_no)||poisoned(runner))
    return refuse('BASELINE_FIELD_IDENTITY_INVALID');
  ranks.add(runner.rank);field.set(runner.horse_no,runner);
 }
 if(ranks.size!==baseline.length)return refuse('BASELINE_RANK_GAP');
 const evidenceByNo=new Map();
 for(const e of comparison.runner_evidence){
  if(!horseNo(e?.horse_no)||!field.has(e.horse_no)||
     clean(e.horse_name)!==clean(field.get(e.horse_no).horse_name)||
     evidenceByNo.has(e.horse_no)||!Array.isArray(e.supporting_runs)||
     e.supporting_runs.length>5||
     (e.context_runs!==undefined&&(!Array.isArray(e.context_runs)||e.context_runs.length>5))||
     poisoned(e))
    return refuse('CLAIM_EVIDENCE_IDENTITY_INVALID');
  const p=profile(e,{race_date:race.race_date,surface:race.surface,
    track:race.track,distance:race.distance,class_label:cls.class_label});
  if(!p)return refuse('HISTORICAL_EVIDENCE_NOT_VERIFIED_ASOF');
  evidenceByNo.set(e.horse_no,p);
 }
 const original=baseline.slice().sort((a,b)=>a.rank-b.rank);
 const reports=original.map(h=>{
  const p=evidenceByNo.get(h.horse_no);
  const over=h.rank<=5&&p.matching_comparable_runs>=2&&
    p.recent_matched_podium===0&&p.small_margin_near_misses===0&&
    p.recent_matched_low_finishes>=2;
  const under=h.rank>5&&p.recent_matched_podium>=2&&
    p.has_fresh_positive&&p.recent_matched_low_finishes<=1;
  return {...p,baseline_rank:h.rank,baseline_score:h.score,
    review:over?'TOP5_POSSIBLE_OVERVALUATION':
      under?'OUTSIDE_POSSIBLE_UNDERVALUATION':
      h.rank>5&&p.cross_condition_positive_leads.length?
        'OUTSIDE_UNCALIBRATED_CONDITION_CHANGE_REVIEW':
      p.matching_comparable_runs===0?'INSUFFICIENT_COMPARABLE_HISTORY':
      'NO_TWO_SIDED_SWAP_PROOF'};
 });
 const over=reports.filter(x=>x.review==='TOP5_POSSIBLE_OVERVALUATION')
   .sort((a,b)=>b.recent_matched_big_losses-a.recent_matched_big_losses||a.baseline_rank-b.baseline_rank);
 const under=reports.filter(x=>x.review==='OUTSIDE_POSSIBLE_UNDERVALUATION')
   .sort((a,b)=>b.recent_matched_podium-a.recent_matched_podium||
     a.recent_matched_low_finishes-b.recent_matched_low_finishes||a.baseline_rank-b.baseline_rank);
 const crossReview=reports.filter(x=>x.baseline_rank>5&&x.cross_condition_positive_leads.length>0);
 // Each accepted shadow exchange requires a verified negative incumbent AND
 // positive outsider. Never demote a horse merely for missing evidence.
 const count=Math.min(over.length,under.length);
 const displaced=over.slice(0,count),promoted=under.slice(0,count);
 const disp=new Set(displaced.map(x=>x.horse_no));
 const prom=new Set(promoted.map(x=>x.horse_no));
 const keptTop=original.slice(0,5).filter(x=>!disp.has(x.horse_no));
 const newTop=[...keptTop,...promoted.map(x=>field.get(x.horse_no))];
 const remainder=[...displaced.map(x=>field.get(x.horse_no)),
   ...original.slice(5).filter(x=>!prom.has(x.horse_no))];
 const candidate=[...newTop,...remainder].map(x=>x.horse_no);
 if(candidate.length!==original.length||new Set(candidate).size!==candidate.length||
    newTop.length!==5)return refuse('PROPOSAL_ROSTER_UNSTABLE');
 const baselineOrder=original.map(x=>x.horse_no);
 return status(count?'PROPOSED_FULL_FIELD_EXCHANGE':'UNCHANGED',{
  candidate_order:candidate,baseline_order:baselineOrder,
  baseline_top5:baselineOrder.slice(0,5),proposed_top5:candidate.slice(0,5),
  full_field_checked:original.length,
  overvaluation_review_count:over.length,
  undervaluation_review_count:under.length,
  cross_condition_review_count:crossReview.length,
  overvaluation_review:over,undervaluation_review:under,
  cross_condition_review:crossReview,
  all_runner_audits:reports,
  exchanges:displaced.map((d,i)=>({
   removed_top5_horse_no:d.horse_no,removed_from_rank:d.baseline_rank,
   added_top5_horse_no:promoted[i].horse_no,added_from_rank:promoted[i].baseline_rank,
   incumbent_negative_refs:d.negative_evidence.map(x=>x.source_ref),
   outsider_positive_refs:promoted[i].positive_evidence.map(x=>x.source_ref)
  })),
  rank_deltas:original.map(x=>({
    horse_no:x.horse_no,baseline_rank:x.rank,
    shadow_rank:candidate.indexOf(x.horse_no)+1
   })).filter(x=>x.baseline_rank!==x.shadow_rank),
  special_case_limitations:'OTHER_CONDITION_FORM_IS_REVIEW_ONLY; NOT PROVEN CROSS_CLASS_EQUIVALENCE; NAR GAP TO WINNER UNVERIFIED; NO OFFICIAL LAPS/OPPONENT LEVEL',
  scorer_status:'PRE_RACE_SHADOW_CHALLENGER_NOT_CALIBRATED_NOT_PRODUCTION'
 });
}

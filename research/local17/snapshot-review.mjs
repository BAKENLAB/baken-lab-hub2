/**
 * LOCAL1.7 research-only audit of IMMUTABLE pre-race LOCAL1.6 FROZEN predictions.
 * Never writes to storage, never uses market/payout/results to choose any horse.
 * Keyword matches are prompts for verified re-review, NOT positive factors.
 */
const PROTOCOL='CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013';
const fail=(code)=>{throw new Error(code)};
const asText=x=>typeof x==='string'?x.normalize('NFKC'):'';
const present=r=>r?.status!=='CANCELLED'&&r?.status!=='EXCLUDED';
function allRanked(f){
  if(f?.protocol_version!==PROTOCOL||f?.status!=='FROZEN')fail('UNSUPPORTED_FROZEN');
  if(!f.frozen_at||!f.post_time||!(Date.parse(f.frozen_at)<Date.parse(f.post_time)))fail('NOT_PRESTART_FROZEN');
  const p=f.payload;
  if(!p||!Array.isArray(p.runners)||!Array.isArray(p.top5))fail('PAYLOAD_MISSING');
  if(p.bet_strategy!=='SUSPENDED_FOR_ABILITY_STABILITY'||!Array.isArray(p.bets)||p.bets.length)fail('BET_CONTRACT');
  if(p.audit?.market_used_for_ranking!==false||p.audit?.market_used_for_eye!==false)fail('MARKET_CONTRACT');
  const runners=p.runners.filter(present).slice().sort((a,b)=>a.rank-b.rank);
  if(runners.length<6||runners.some((r,i)=>!Number.isInteger(r.horse_no)||r.horse_no<1||r.rank!==i+1)||new Set(runners.map(r=>r.horse_no)).size!==runners.length)fail('RANK_INVALID');
  if(p.top5.length!==5||p.top5.slice().sort((a,b)=>a.rank-b.rank).some((r,i)=>r.horse_no!==runners[i].horse_no))fail('TOP5_MISMATCH');
  return runners;
}
function mentions(r){
  const t=asText(r?.reason)+' '+asText(r?.evidence_summary);
  return {
    // A mention can say 'no same-condition record'; it is NOT verified positive form.
    prior_condition_mentioned:/(過去|同場|同距離|実績|好走|以前)/.test(t),
    higher_grade_mentioned:/(中央|JRA|Jpn|OP|オープン|重賞|GⅠ|JpnII)/i.test(t),
    risk_mentioned:/(休養|空白|間隔|転入|昇級|級差)/.test(t),
    negative_finish_mentioned:/(大敗|8着|9着|10着|11着|12着|失速|不振|凡走)/.test(t)
  };
}
export function reviewPreRaceFrozen(f){
  const runners=allRanked(f), fifth=runners[4],sixth=runners[5];
  const a=Number(fifth.score),b=Number(sixth.score);
  const gap=Number.isFinite(a)&&Number.isFinite(b)?a-b:null;
  const alerts=[];
  if(gap!==null&&gap>=0&&gap<=2)alerts.push({kind:'CLOSE_RANK5_RANK6_REVIEW',horse_nos:[fifth.horse_no,sixth.horse_no],score_gap:gap});
  for(const r of runners.slice(5)){
    const m=mentions(r);
    for(const [test,kind] of [['higher_grade_mentioned','GRADE_TEXT_REVIEW'],['prior_condition_mentioned','PRIOR_FORM_TEXT_REVIEW'],['risk_mentioned','TRANSFER_RECENCY_TEXT_REVIEW']]){
      if(m[test])alerts.push({kind,horse_no:r.horse_no,original_rank:r.rank,verification:'REQUIRED'});
    }
  }
  return {mode:'SHADOW_REVIEW_ONLY_NO_AUTO_PROMOTION',version:'LOCAL17_20261031',
    race:{date:f.race_date,track:f.track,race_no:f.race_no},
    original_top5:runners.slice(0,5).map(r=>r.horse_no),
    original_eye:f.payload.eye==null?[]:[f.payload.eye.horse_no],
    fifth:{horse_no:fifth.horse_no,score:fifth.score},
    sixth:{horse_no:sixth.horse_no,score:sixth.score},
    gap,fifth_text_flags:mentions(fifth),sixth_text_flags:mentions(sixth),alerts,
    ranking_modified:false,scores_modified:false,no_production_write:true,
    data_warning:'Text flags do not prove class change, older same-condition performance or fitness. Verify official pre-race source and horse identity.'
  };
}
export function hypotheticalShadowTop5(review,policy){
  if(review?.mode!=='SHADOW_REVIEW_ONLY_NO_AUTO_PROMOTION')fail('NOT_REVIEW');
  const g=review.gap,close=g!==null&&g>=0&&g<=2;
  const selected=policy==='ALL_RANK5_6'?g!==null&&g>=0:
    policy==='GAP_LE_2'?close:
    policy==='GAP_LE_2_WITH_PRIOR_TEXT'?close&&review.sixth_text_flags.prior_condition_mentioned:
    policy==='GAP_LE_2_WITH_FIFTH_BAD_TEXT'?close&&review.fifth_text_flags.negative_finish_mentioned:null;
  if(selected===null)fail('UNKNOWN_EXPERIMENTAL_POLICY');
  const top5=[...review.original_top5];if(selected)top5[4]=review.sixth.horse_no;
  return {policy,simulated_only:true,switched:selected,top5,existing_eye:[...review.original_eye]};
}
export function evaluateShadowAfterResult(review,hypothesis,result){
  if(review?.mode!=='SHADOW_REVIEW_ONLY_NO_AUTO_PROMOTION'||!hypothesis?.simulated_only)fail('NOT_SHADOW');
  if(result?.race_date!==review.race.date||result.track!==review.race.track||result.race_no!==review.race.race_no)fail('RESULT_RACE_MISMATCH');
  if(!Array.isArray(result.finishers)||result.finishers.length!==3)fail('REQUIRE_COMPLETE_TOP3');
  const podium=result.finishers.slice().sort((a,b)=>a.finish-b.finish).map(v=>v.horse_no);
  if(podium.some(n=>!Number.isInteger(n)||n<1)||new Set(podium).size!==3)fail('BAD_PODIUM');
  const old=new Set(review.original_top5),next=new Set(hypothesis.top5);
  return {switched:hypothesis.switched,
    newly_covered:podium.filter(n=>!old.has(n)&&next.has(n)),
    lost_covered:podium.filter(n=>old.has(n)&&!next.has(n)),
    newly_captured_winner:!old.has(podium[0])&&next.has(podium[0]),
    lost_winner:old.has(podium[0])&&!next.has(podium[0]),
    eye_preserved:JSON.stringify(hypothesis.existing_eye)===JSON.stringify(review.original_eye)};
}
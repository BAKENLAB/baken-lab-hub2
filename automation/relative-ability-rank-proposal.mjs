/**
 * BAKEN LAB ability overhaul, v0.1: executable PRE-RACE relative-rank proposal.
 *
 * This is a REAL rank-producing evaluator, not an output-only audit.
 * It is intentionally a prospective challenger to an existing full-field rank,
 * NOT a replacement for the JRA0.4 / LOCAL1.6 production ranking.
 * Only official pre-CLAIM history already verified by the guarded context
 * can be supplied. No odds, target result, FROZEN mutation or network I/O.
 *
 * A single, conservatively evidenced boundary exchange is possible; stronger
 * existing TOP5 horses remain protected. No automatic sixth-rank promotion.
 * v0.2 expands deep review into a strict eligible 9+ rank proposal only when
 * there are multiple distinct, fresh, same-class proofs and incumbent downside.
 */
import {resolveLocalOfficialClassLiteral} from './local-verified-condition-bridge.mjs';
const key = x => String(x ?? '').normalize('NFKC').replace(/\s+/g,'').trim();
const date = x => typeof x==='string' && /^\d{4}-\d\d-\d\d$/.test(x) &&
  Number.isFinite(Date.parse(x+'T00:00:00Z'));
const instant = x => typeof x==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(x) &&
  Number.isFinite(Date.parse(x)) ? Date.parse(x) : NaN;
const num = (x,lo,hi) => typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
const no = x => Number.isInteger(x)&&x>=1&&x<=24;
const integer = (x,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi;
const out = (status,extra={})=>({
  status,model_version:'ABILITY_RELATIVE_V0_6',
  stage:'SHADOW_RANK_PROPOSAL_PRE_RACE',
  production_rank_effect:false,production_grade_effect:false,
  frozen_modified:false,market_used:false,target_result_used:false,
  ...extra
});
const stop = status => out(status,{candidate_order:null,rank_deltas:[]});
function level(x,track=null) {
  const venue=key(track);
  // Tokai grade letters are A/B/C; the digits enumerate groups, not
  // generic A1/B1/C2 competitive classes. Never collapse C23 into C2.
  if(venue==='名古屋'||venue==='笠松'){
    const resolved=resolveLocalOfficialClassLiteral(x,track);
    return resolved.class_label?
      'LOCAL_TOKAI_'+venue+'_'+resolved.class_label:null;
  }
  const s=key(x);
  if(/(?:^|[^0-9])未勝利/.test(s))return 'MAIDEN';
  const v=s.match(/([123])勝クラス/);
  if(v)return 'JRA_'+v[1];
  // Official JRA graded stakes are NOT interchangeable with an ordinary OP,
  // listed stakes, or one another. NFKC maps Ⅰ/Ⅱ/Ⅲ to I/II/III.
  // A generic "重賞" without an exact grade is NOT sufficient evidence.
  const grade=s.match(/(?:^|[^A-Z0-9])G(III|II|I|[123])(?=$|[^A-Z0-9])/i);
  if(grade){
    const g=grade[1].toUpperCase();
    return g==='III'||g==='3'?'JRA_G3':
      g==='II'||g==='2'?'JRA_G2':'JRA_G1';
  }
  if(/リステッド|(?:^|[^A-Z0-9])L(?=$|[^A-Z0-9])/.test(s))
    return 'JRA_LISTED';
  if(/オープン|(?:^|[^A-Z0-9])OP(?=$|[^A-Z0-9])/i.test(s))
    return 'JRA_OPEN_UNSPECIFIED';
  // NAR class labels are usually Ｃ２四組, Ｃ３二３歳以上, Ｂ１, etc.
  // NFKC converts the alphabet/digit but keeps the Kanji. "C1 3歳以上"
  // becomes "C13歳以上" after whitespace removal, so that exact
  // age-suffix sequence is explicitly permitted; arbitrary C13 is not.
  // Three-year-old-only "３歳Ｃ２" is NOT adult C2.
  if(/^[ABC][123][・/][ABC][123]/.test(s))return null;
  const ageThree=s.match(/^3歳([ABC])([1-4])(?=$|[^0-9A-Za-z])/);
  if(ageThree)return 'LOCAL_AGE3_'+ageThree[1]+ageThree[2];
  const local=s.match(/^([ABC])([1-4])(?=$|[^0-9A-Za-z]|[23]歳以上)/);
  if(local)return 'LOCAL_'+local[1]+local[2];
  return null;
}
function summarizeEvidence(row,race) {
  const supporting=row.supporting_runs;
  const reasons=[];
  let similar=0,good=0,poor=0,backfield=0,sameClass=0,sameClassGood=0,sameClassPodium=0,recentPodium=0,sustainedFrontPodium=0,lateAdvancePodium=0,front=0,wins=0,recentGood=0;
  const seenPast=new Set();
  const targetClass=level(race.class_name,race.track);
  for(const h of supporting){
    const d=h.date??h.race_date;
    if(!date(d)||d>=race.race_date)return null;
    const pastKey=[d,h.track??'',h.surface??'',h.distance??''].join('|');
    if(seenPast.has(pastKey))continue;
    seenPast.add(pastKey);
    const surface=h.surface??null, distance=Number(h.distance);
    if(surface!==race.surface||!integer(distance,800,3600)||
      Math.abs(distance-race.distance)>200)continue;
    similar++;
    const cls=level(h.class??h.race_class??h.class_name??null,h.track??null);
    const f=h.finish, margin=h.margin;
    // JRA has audited winner-relative seconds. NAR generally records
    // a gap to the PRECEDING finisher in horse lengths. Only an explicitly
    // tagged second-place gap to the winner can prove close; third-place
    // gaps and bare numeric strings must NEVER masquerade as winner-relative.
    const localClose=race.circuit==='LOCAL' && f===2 &&
      h.margin_unit==='LENGTHS_TO_WINNER' &&
      h.margin_basis==='NAR_SECOND_PLACE_PRECEDING_IS_WINNER' &&
      num(margin,0,0.5);
    const close=integer(f,1,24)&&
      (f===1||(race.circuit==='LOCAL'?localClose:
       f<=3&&num(margin,0,0.5)));
    // Do not silently equate LOCAL class C3 across independent districts.
    // JRA's broad "オープン" label also covers many G2/G3 races.
    // Without an explicit official grade, a historical OP is not proven
    // to be the SAME tier; default to no same-class proof rather than
    // manufacture comparable grade evidence from the broad label.
    const openGradeUnknown=race.circuit==='JRA'&&
      (targetClass==='JRA_OPEN_UNSPECIFIED'||cls==='JRA_OPEN_UNSPECIFIED');
    const aClass=!openGradeUnknown&&!!targetClass&&!!cls&&cls===targetClass &&
      (race.circuit!=='LOCAL'||(key(race.track)&&key(h.track)===key(race.track)));
    if(aClass)sameClass++;
    // A verified podium FINISH is known even if LOCAL's margin is only to
    // the preceding runner. Keep this independent of a close-to-winner claim.
    const officialLocalPodium=race.circuit==='LOCAL'&&aClass&&integer(f,1,3);
    if(officialLocalPodium){
      // This is an OBSERVED position pattern, not a proven causal pace
      // explanation. Both early and final-turn positions are required.
      if(integer(h.early_pos,1,3)&&integer(h.final_turn_pos,1,3)){
        sustainedFrontPodium++;
        reasons.push({date:d,type:'VERIFIED_SUSTAINED_FRONT_PODIUM',
          finish:f,early_pos:h.early_pos,final_turn_pos:h.final_turn_pos,
          source_class:cls});
      }
      sameClassPodium++;
      const age=(Date.parse(race.race_date+'T00:00:00Z')-Date.parse(d+'T00:00:00Z'))/86400000;
      if(age>=0&&age<=180)recentPodium++;
      // Verified observation, not a claim about lap pace or cause of defeat.
      if(age>=0&&age<=180&&integer(h.early_pos,6,24)&&
         integer(h.final_turn_pos,1,5)&&h.early_pos-h.final_turn_pos>=4){
        lateAdvancePodium++;
        reasons.push({date:d,type:'VERIFIED_LATE_CORNER_ADVANCE_PODIUM',
          finish:f,early_pos:h.early_pos,final_turn_pos:h.final_turn_pos,
          positions_gained:h.early_pos-h.final_turn_pos,
          source_class:cls,cause:'UNPROVEN'});
      }
    }
    // LOCAL finishing position is verified but is NOT winner-relative margin.
    // Repeated same-class backfield results are a separate factual signal.
    const verifiedLocalBackfield=race.circuit==='LOCAL'&&aClass&&
      integer(f,8,24);
    if(verifiedLocalBackfield)backfield++;
    if(close)good++;
    if(close&&aClass){
      sameClassGood++;
      if(f===1)wins++;
      const age=(Date.parse(race.race_date+'T00:00:00Z')-Date.parse(d+'T00:00:00Z'))/86400000;
      if(age>=0&&age<=180)recentGood++;
    }
    if(integer(f,8,24)&&num(margin,1.5,30)&&aClass &&
       (race.circuit!=='LOCAL' || h.margin_basis==='OFFICIALLY_VERIFIED_WINNER_GAP'))
      poor++;
    if(aClass&&integer(h.early_pos,1,3))front++;
    if(aClass&&close)reasons.push({date:d,type:'MATCHED_CLASS_CLOSE',finish:f,source_class:cls});
    if(officialLocalPodium&&!close)reasons.push({
      date:d,type:'MATCHED_CLASS_PODIUM_FINISH_NOT_WINNER_GAP',
      finish:f,source_class:cls});
    if(verifiedLocalBackfield)reasons.push({date:d,type:'MATCHED_CLASS_BACKFIELD_FINISH_NOT_MARGIN',finish:f,source_class:cls});
    if(aClass&&integer(f,8,24)&&num(margin,1.5,30)&&
      (race.circuit!=='LOCAL'||h.margin_basis==='OFFICIALLY_VERIFIED_WINNER_GAP'))
      reasons.push({date:d,type:'MATCHED_CLASS_DEFEAT',finish:f,source_class:cls});
  }
  return {horse_no:row.horse_no,horse_name:row.horse_name,
    comparable_runs:similar,close_runs:good,
    same_class_runs:sameClass,same_class_close_runs:sameClassGood,
    same_class_wins:wins,same_class_recent_close_runs:recentGood,
    same_class_podium_finishes:sameClassPodium,same_class_recent_podium_finishes:recentPodium,
    same_class_sustained_front_podium_runs:sustainedFrontPodium,
     same_class_late_advance_podium_runs:lateAdvancePodium,
    same_class_decisive_defeats:poor,same_class_backfield_finishes:backfield,
    same_class_front_runs:front,
    target_class_status:targetClass??'UNKNOWN_CLASS_LEVEL',
    qualifying_proof:reasons,proof_count:reasons.length};
}
/**
 * baseline: full-field [{horse_no,horse_name,rank}] (absolute model ranks).
 * race: {race_date,post_time,observation_at,circuit,class_name,surface,distance}.
 * comparison: result of JRA/LOCAL official CLAIMED relative-condition builder.
 * The current runner roster is compared by exact horse_no and normalized name.
 */
export function buildRelativeAbilityRankProposal({race,baseline,comparison}={}) {
  // LOCAL official cards often provide class solely inside race_name.
  // Only a unique, literally printed grade qualifies; missing/ambiguous stays UNKNOWN.
  const targetClassResolution=race?.circuit==='LOCAL'?
    resolveLocalOfficialClassLiteral(race.class_name??race.race_name,race.track):null;
  const verifiedTargetClass=race?.circuit==='LOCAL'?
    targetClassResolution.class_label:race?.class_name;
  const comparisonRace=race?.circuit==='LOCAL'?
    {...race,class_name:verifiedTargetClass}:race;
  if(race?.result!==undefined||race?.finishers!==undefined||
    comparison?.result!==undefined||comparison?.finishers!==undefined||
    baseline?.some?.(h=>h?.result!==undefined||h?.finish!==undefined||h?.odds!==undefined||h?.popularity!==undefined))
    return stop('RESULT_OR_MARKET_IN_PRERACE_INPUT');
  if(!date(race?.race_date)||!['JRA','LOCAL'].includes(race.circuit)||
    !integer(race.distance,800,3600)||typeof race.surface!=='string'||
    !key(verifiedTargetClass)||
    !Number.isFinite(instant(race.post_time))||
    !Number.isFinite(instant(race.observation_at))||
    instant(race.observation_at)>=instant(race.post_time))
    return stop('PRE_RACE_IDENTITY_OR_TIME_UNVERIFIED');
  if(!Array.isArray(baseline)||baseline.length<6||baseline.length>24||
    !Array.isArray(comparison?.runner_evidence)||
    comparison.status!=='READY'||comparison.market_used!==false||
    comparison.target_result_used!==false||
    comparison.rank_effect!==false)
    return stop('BASELINE_OR_EVIDENCE_NOT_READY');
  if(comparison.target_date!==undefined&&comparison.target_date!==race.race_date)
    return stop('EVIDENCE_TARGET_DATE_MISMATCH');
  const source=comparison.source_scope??comparison.data_scope;
  if((race.circuit==='JRA'&&source!=='JRA_CLAIMED_RUNNER_HISTORY')||
     (race.circuit==='LOCAL'&&source!=='ALREADY_OFFICIALLY_VALIDATED_LOCAL_CLAIMED_HISTORY'))
    return stop('UNTRUSTED_EVIDENCE_SOURCE');
  const roster=new Map(),ranks=new Set();
  for(const h of baseline){
    if(!no(h?.horse_no)||!key(h.horse_name)||!integer(h.rank,1,baseline.length)||
      roster.has(h.horse_no)||ranks.has(h.rank))return stop('BASELINE_FIELD_INVALID');
    roster.set(h.horse_no,h);ranks.add(h.rank);
  }
  if(!Array.from({length:baseline.length},(_,i)=>i+1).every(n=>ranks.has(n)))
    return stop('BASELINE_RANK_INVALID');
  if(comparison.runner_evidence.length!==baseline.length)return stop('EVIDENCE_FIELD_SIZE_MISMATCH');
  const reports=new Map();
  for(const e of comparison.runner_evidence){
    if(!no(e?.horse_no)||!roster.has(e.horse_no)||
      key(e.horse_name)!==key(roster.get(e.horse_no).horse_name)||
      reports.has(e.horse_no)||!Array.isArray(e.supporting_runs)||
      e.supporting_runs.length>12)return stop('EVIDENCE_IDENTITY_OR_SHAPE_INVALID');
    const report=summarizeEvidence(e,comparisonRace);
    if(!report)return stop('EVIDENCE_CONTAINS_CURRENT_OR_FUTURE_RACE');
    reports.set(e.horse_no,report);
  }
  const original=baseline.slice().sort((a,b)=>a.rank-b.rank);
  const ordered=original.map(h=>h.horse_no);
  const fifth=original[4],inc=reports.get(fifth.horse_no);
  const selected=[];
  // Require two independently observed same-class close runs before promotion.
  // This is an explicit, falsifiable trial, NOT an assumed performance gain.
  for(const challenger of original.slice(5)){
    const proof=reports.get(challenger.horse_no);
    if(proof.target_class_status==='UNKNOWN_CLASS_LEVEL')continue;
    // LOCALS: a verified third place must not disappear just because there
    // is no audited winning-margin. A repeated podium against a repeatedly
    // backfield incumbent is a SHADOW-ONLY alternative, never proof of a
    // small winner gap. No automatic promotion in special-composition races.
    const specialComposition=race.circuit==='LOCAL'&&
      /特別編成|ファイナル|記者選抜/.test(key(race.race_name??''));
    const localRepeatedPodium=race.circuit==='LOCAL'&&!specialComposition&&
      inc.same_class_runs>=2&&inc.same_class_backfield_finishes>=2&&
      inc.same_class_podium_finishes===0&&
      proof.same_class_podium_finishes>=3&&
      proof.same_class_recent_podium_finishes>=2&&
      proof.same_class_backfield_finishes===0;
    const deep=challenger.rank>=9;
    // Independent pre-race official corner observations can establish a
    // repeated front-position podium pattern. This is stricter than the bare
    // two-podium count but does NOT invent a missing winner-relative gap.
    // Only rank6-8, a demonstrably weak incumbent, and ordinary classes.
    const cornerPodiumRescue=race.circuit==='LOCAL'&&!specialComposition&&!deep&&
      inc.same_class_runs>=2&&inc.same_class_backfield_finishes>=2&&
      inc.same_class_podium_finishes===0&&
      proof.same_class_podium_finishes>=2&&
      proof.same_class_recent_podium_finishes>=2&&
      proof.same_class_sustained_front_podium_runs>=2&&
      proof.same_class_backfield_finishes===0;
    // Shadow-only. Repeated official early-to-final-turn advances in two
    // distinct recent same-class podiums can expose an under-ranked horse.
    // Require verified incumbent downside; no automatic outsider promotion.
    const lateAdvanceRescue=race.circuit==='LOCAL'&&!specialComposition&&!deep&&
      inc.same_class_runs>=2&&inc.same_class_backfield_finishes>=2&&
      inc.same_class_podium_finishes===0&&
      proof.same_class_runs>=2&&proof.same_class_podium_finishes>=2&&
      proof.same_class_recent_podium_finishes>=2&&
      proof.same_class_late_advance_podium_runs>=2&&
      proof.same_class_backfield_finishes===0;
    const podiumRescue=localRepeatedPodium&&(!deep||
      (proof.same_class_podium_finishes>=3&&
       proof.same_class_wins>=1&&proof.same_class_recent_podium_finishes>=2));
    if(proof.same_class_runs<2||
       (proof.same_class_close_runs<2&&!podiumRescue&&!cornerPodiumRescue&&!lateAdvanceRescue))continue;
    const better=proof.same_class_close_runs-inc.same_class_close_runs;
    const safer=inc.same_class_decisive_defeats-proof.same_class_decisive_defeats;
    // NAR official winner-gap often cannot be established. Use 2+ distinct
    // verified backfield finishes (not estimated beaten lengths) only when
    // the challenger has zero same-class backfield results.
    const localRepeatedBackfield=race.circuit==='LOCAL'&&
      inc.same_class_runs>=2&&inc.same_class_backfield_finishes>=2&&
      proof.same_class_backfield_finishes===0;
    // Never punish a fifth horse only for missing or sparse history.
    // Deep rescue must beat BOTH strong prior proof and verified downside.
    if(deep){
      const strictClose=proof.same_class_close_runs>=3&&
        proof.same_class_wins>=1&&proof.same_class_recent_close_runs>=1&&
        proof.same_class_decisive_defeats===0&&inc.same_class_runs>=2&&
        (inc.same_class_decisive_defeats>=1&&safer>=1||localRepeatedBackfield)&&
        better>=2;
      if(!strictClose&&!podiumRescue)continue;
    } else {
      const challengerStrong=(better>=2&&safer>=0||
        better>=1&&(safer>=1||localRepeatedBackfield))||podiumRescue||cornerPodiumRescue||lateAdvanceRescue;
      if(!challengerStrong)continue;
    }
    // Protect a good incumbent: no swap unless challenger is decisively stronger.
    if(inc.same_class_close_runs>=2&&inc.same_class_decisive_defeats===0)continue;
    if(race.circuit==='LOCAL'&&
       inc.same_class_podium_finishes>=2&&inc.same_class_backfield_finishes===0)continue;
    selected.push({horse_no:challenger.horse_no,old_rank:challenger.rank,
      close_delta:better,defeat_delta:safer,
      backfield_evidence_effect:localRepeatedBackfield?'VERIFIED_REPEATED_BACKFIELD_FINISH_ONLY':'NONE',
      podium_evidence_effect:podiumRescue?'VERIFIED_REPEATED_PODIUM_NOT_WINNER_MARGIN':
        cornerPodiumRescue?'VERIFIED_SUSTAINED_FRONT_PODIUM_NO_WINNER_GAP':
         lateAdvanceRescue?'VERIFIED_LATE_CORNER_ADVANCE_PODIUM_NO_PACE_CAUSALITY':'NONE',
      challenger_podium_finishes:proof.same_class_podium_finishes,
      challenger_sustained_front_podium_runs:proof.same_class_sustained_front_podium_runs,
       challenger_late_advance_podium_runs:proof.same_class_late_advance_podium_runs,
      incumbent_podium_finishes:inc.same_class_podium_finishes,
      challenger_positive:proof.qualifying_proof,
      incumbent_positive:inc.qualifying_proof,
      independent_condition_proof:proof.same_class_close_runs,
      depth:deep?'RANK9_PLUS_STRICT':'RANK6_8',
      historical_wins:proof.same_class_wins,
      recent_podium_proof:proof.same_class_recent_podium_finishes,
      recent_close_proof:proof.same_class_recent_close_runs,
      incumbent_known_runs:inc.same_class_runs,
      incumbent_backfield_finishes:inc.same_class_backfield_finishes,
      challenger_backfield_finishes:proof.same_class_backfield_finishes,
      protected_top5:original.slice(0,5).map(h=>{
        const v=reports.get(h.horse_no);
        return {horse_no:h.horse_no,rank:h.rank,
          same_class_close_runs:v.same_class_close_runs,
          same_class_podium_finishes:v.same_class_podium_finishes,
          same_class_sustained_front_podium_runs:v.same_class_sustained_front_podium_runs,
           same_class_late_advance_podium_runs:v.same_class_late_advance_podium_runs,
          same_class_decisive_defeats:v.same_class_decisive_defeats,
          same_class_backfield_finishes:v.same_class_backfield_finishes};
      })});
  }
  selected.sort((a,b)=>b.close_delta-a.close_delta||
    b.defeat_delta-a.defeat_delta||
    b.historical_wins-a.historical_wins||a.old_rank-b.old_rank);
  const deep_review_candidates=original.slice(8).map(h=>{
    const report=reports.get(h.horse_no);
    return {horse_no:h.horse_no,old_rank:h.rank,
      same_class_close_runs:report.same_class_close_runs,
      same_class_podium_finishes:report.same_class_podium_finishes,
      same_class_sustained_front_podium_runs:report.same_class_sustained_front_podium_runs,
       same_class_late_advance_podium_runs:report.same_class_late_advance_podium_runs,
      same_class_decisive_defeats:report.same_class_decisive_defeats,
      same_class_backfield_finishes:report.same_class_backfield_finishes,
      status:report.same_class_close_runs>=2?'REVIEW_LEAD_NOT_PROMOTED':'NOT_QUALIFIED'};
  }).filter(x=>x.status==='REVIEW_LEAD_NOT_PROMOTED');

  // Reporters' selections are NOT ordinary same-tier races. The special
  // selection mechanism and past defeat contexts require a separate
  // evidence policy; never force a standard-class TOP5 swap here.
  if(race.circuit==='LOCAL' &&
    /ファイナル|記者選抜/.test(key(race.race_name??'')+key(race.class_name))){
    return out('SPECIAL_FINAL_REVIEW_ONLY',{
      candidate_order:ordered,top5:ordered.slice(0,5),
      baseline_top5:ordered.slice(0,5),rank_deltas:[],
      candidate_count:selected.length,deep_review_candidates,
      verified_field_count:baseline.length,
      proof_by_horse:original.map(h=>reports.get(h.horse_no)),
      special_handling:'FINAL_REQUIRES_OFFICIAL_CLASS_OPPONENT_AND_LOSS_CAUSE_EVIDENCE'
    });
  }
  const chosen=selected[0]??null;
  for(const candidate of deep_review_candidates){
    if(chosen?.horse_no===candidate.horse_no)
      candidate.status='SHADOW_PROMOTED_NOT_PRODUCTION';
  }
  if(chosen){
    ordered.splice(chosen.old_rank-1,1);
    ordered.splice(4,0,chosen.horse_no);
  }
  const newRanks=new Map(ordered.map((n,i)=>[n,i+1]));
  const rankDeltas=original.filter(h=>newRanks.get(h.horse_no)!==h.rank)
    .map(h=>({horse_no:h.horse_no,horse_name:h.horse_name,
      original_rank:h.rank,shadow_rank:newRanks.get(h.horse_no)}));
  return out(chosen?'REORDERED':'UNCHANGED',{
    candidate_order:ordered,
    top5:ordered.slice(0,5),
    baseline_top5:original.slice(0,5).map(x=>x.horse_no),
    rank_deltas:rankDeltas,
    elected_challenger:chosen,
    protected_incumbent:chosen?fifth.horse_no:null,
    candidate_count: selected.length,
    deep_review_candidates,
    verified_field_count:baseline.length,
    proof_by_horse:original.map(h=>reports.get(h.horse_no)),
    safety_policy:'PROTECT_BASELINE_NO_MISSINGNESS_PENALTY_NO_RESULT_NO_MARKET',
    target_class_evidence:race.circuit==='LOCAL'?
      {status:targetClassResolution.status,class_label:verifiedTargetClass,
       tier_comparison:'SAME_NAR_VENUE_AND_EXPLICIT_TIER_NOT_PROVEN_OPPONENT_EQUIVALENCE'}:
      {status:level(verifiedTargetClass)==='JRA_OPEN_UNSPECIFIED'?
         'JRA_OPEN_GRADE_UNVERIFIED':'JRA_PROVIDED_CLASS',
       class_label:verifiedTargetClass},
    scoring_rule:'V0_6_LOCAL_VERIFIED_POSITION_GAIN_AND_FRONT_PATTERN_SHADOW_ONLY'
  });
}

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
 */
const key = x => String(x ?? '').normalize('NFKC').replace(/\s+/g,'').trim();
const date = x => typeof x==='string' && /^\d{4}-\d\d-\d\d$/.test(x) &&
  Number.isFinite(Date.parse(x+'T00:00:00Z'));
const instant = x => typeof x==='string' && /(?:Z|[+-]\d\d:\d\d)$/.test(x) &&
  Number.isFinite(Date.parse(x)) ? Date.parse(x) : NaN;
const num = (x,lo,hi) => typeof x==='number'&&Number.isFinite(x)&&x>=lo&&x<=hi;
const no = x => Number.isInteger(x)&&x>=1&&x<=24;
const integer = (x,lo,hi)=>Number.isInteger(x)&&x>=lo&&x<=hi;
const out = (status,extra={})=>({
  status,model_version:'ABILITY_RELATIVE_V0_1',
  stage:'SHADOW_RANK_PROPOSAL_PRE_RACE',
  production_rank_effect:false,production_grade_effect:false,
  frozen_modified:false,market_used:false,target_result_used:false,
  ...extra
});
const stop = status => out(status,{candidate_order:null,rank_deltas:[]});
function level(x) {
  const s=key(x);
  if(/(?:^|[^0-9])未勝利/.test(s))return 'MAIDEN';
  const v=s.match(/([123])勝クラス/);
  if(v)return 'JRA_'+v[1];
  if(/(?:G|GⅠ|GⅡ|GⅢ|OP|オープン|重賞)/i.test(s))return 'JRA_OPEN';
  // Within one LOCAL race field use only an explicitly matching class tier.
  // Never assume equivalence across different LOCAL districts.
  const local=s.match(/^([ABC])([123])(?:-|$)/);
  if(local)return 'LOCAL_'+local[1]+local[2];
  return null;
}
function summarizeEvidence(row,race) {
  const supporting=row.supporting_runs;
  const reasons=[];
  let similar=0,good=0,poor=0,sameClass=0,sameClassGood=0,front=0;
  const targetClass=level(race.class_name);
  for(const h of supporting){
    const d=h.date??h.race_date;
    if(!date(d)||d>=race.race_date)return null;
    const surface=h.surface??null, distance=Number(h.distance);
    if(surface!==race.surface||!integer(distance,800,3600)||
      Math.abs(distance-race.distance)>200)continue;
    similar++;
    const cls=level(h.class??h.race_class??h.class_name??null);
    const f=h.finish, margin=h.margin;
    const close=integer(f,1,24)&&(f===1||(f<=3&&num(margin,0,0.5)));
    const aClass=!!targetClass&&!!cls&&cls===targetClass;
    if(aClass)sameClass++;
    if(close)good++;
    if(close&&aClass)sameClassGood++;
    if(integer(f,8,24)&&num(margin,1.5,30)&&aClass)poor++;
    if(aClass&&integer(h.early_pos,1,3))front++;
    if(aClass&&close)reasons.push({date:d,type:'MATCHED_CLASS_CLOSE',finish:f,source_class:cls});
    else if(aClass&&integer(f,8,24)&&num(margin,1.5,30))
      reasons.push({date:d,type:'MATCHED_CLASS_DEFEAT',finish:f,source_class:cls});
  }
  return {horse_no:row.horse_no,horse_name:row.horse_name,
    comparable_runs:similar,close_runs:good,
    same_class_runs:sameClass,same_class_close_runs:sameClassGood,
    same_class_decisive_defeats:poor,same_class_front_runs:front,
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
  if(race?.result!==undefined||race?.finishers!==undefined||
    comparison?.result!==undefined||comparison?.finishers!==undefined||
    baseline?.some?.(h=>h?.result!==undefined||h?.finish!==undefined||h?.odds!==undefined||h?.popularity!==undefined))
    return stop('RESULT_OR_MARKET_IN_PRERACE_INPUT');
  if(!date(race?.race_date)||!['JRA','LOCAL'].includes(race.circuit)||
    !integer(race.distance,800,3600)||typeof race.surface!=='string'||
    !key(race.class_name)||
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
    const report=summarizeEvidence(e,race);
    if(!report)return stop('EVIDENCE_CONTAINS_CURRENT_OR_FUTURE_RACE');
    reports.set(e.horse_no,report);
  }
  const original=baseline.slice().sort((a,b)=>a.rank-b.rank);
  const ordered=original.map(h=>h.horse_no);
  const fifth=original[4],inc=reports.get(fifth.horse_no);
  const selected=[];
  // Require two independently observed same-class close runs before promotion.
  // This is an explicit, falsifiable trial, NOT an assumed performance gain.
  for(const challenger of original.slice(5,8)){
    const proof=reports.get(challenger.horse_no);
    if(proof.target_class_status==='UNKNOWN_CLASS_LEVEL')continue;
    if(proof.same_class_runs<2||proof.same_class_close_runs<2)continue;
    const better=proof.same_class_close_runs-inc.same_class_close_runs;
    const safer=inc.same_class_decisive_defeats-proof.same_class_decisive_defeats;
    const challengerStrong=better>=2&&safer>=0||
      better>=1&&safer>=1;
    if(!challengerStrong)continue;
    // Protect a good incumbent: no swap unless challenger is decisively stronger.
    if(inc.same_class_close_runs>=2&&inc.same_class_decisive_defeats===0)continue;
    selected.push({horse_no:challenger.horse_no,old_rank:challenger.rank,
      close_delta:better,defeat_delta:safer,
      challenger_positive:proof.qualifying_proof,
      incumbent_positive:inc.qualifying_proof,
      independent_condition_proof:proof.same_class_close_runs});
  }
  selected.sort((a,b)=>b.close_delta-a.close_delta||
    b.defeat_delta-a.defeat_delta||a.old_rank-b.old_rank);
  const deep_review_candidates=original.slice(8).map(h=>{
    const report=reports.get(h.horse_no);
    return {horse_no:h.horse_no,old_rank:h.rank,
      same_class_close_runs:report.same_class_close_runs,
      same_class_decisive_defeats:report.same_class_decisive_defeats,
      status:report.same_class_close_runs>=2?'REVIEW_LEAD_NOT_PROMOTED':'NOT_QUALIFIED'};
  }).filter(x=>x.status==='REVIEW_LEAD_NOT_PROMOTED');
  const chosen=selected[0]??null;
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
    safety_policy:'NO_AUTOMATIC_RANK6_NO_RESULT_NO_MARKET_NO_MODEL_ADOPTION',
    scoring_rule:'CLASS_AND_CONDITION_MATCHED_REPEATED_FORM_V0_1'
  });
}

/**
 * BAKEN LAB JRA 0.4 / tie-band shadow ranker.
 * Offline, research-only. No side effects, no FROZEN writes and NO market input.
 *
 * Only reorders exactly tied validated_core_base_rate groups. If any member
 * lacks reliable, comparable archived race content, the entire group retains
 * its original order. No imputed zero penalties for missing history.
 * This is an EXPLORATORY ranker, not an accepted prediction model.
 */
const num = x => x !== null && x !== undefined && x !== "" && Number.isFinite(Number(x)) ? Number(x) : null;
const day = x => typeof x==="string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
const isInt=x=>Number.isInteger(x)&&x>0;
const round=x=>Math.round(x*1000)/1000;
const softLimit=(x,cap)=>Math.min(cap,Math.max(0,x));

function deriveEvidence(row,date,surface,distance){
  const hist=Array.isArray(row?.past_race_content)?row.past_race_content:[];
  const filtered=hist.filter(h=>h&&day(h.prior_date)&&h.prior_date<date&&
    num(h.archive_match_count)===1&&h.prior_surface===surface&&
    num(h.prior_distance)!==null && Math.abs(Number(h.prior_distance)-distance)<=200);
  const seen=new Set();
  const eligible=filtered.filter(h=>{const key=h.prior_date+"|"+h.prior_track;
    if(seen.has(key))return false;seen.add(key);return true;});
  if(!eligible.length)return {status:"INSUFFICIENT_COMPARABLE_EVIDENCE",quality:null,sources:[],flags:[]};
  // At most 4 historic runs, each considered once, no news popularity or odds.
  let quality=0;const sources=[],flags=[];
  for(const h of eligible.slice(0,4)){
    const fin=num(h.finish),gap=num(h.margin_to_winner);
    if(fin===null||fin<1)continue;
    // In past_run sources, winner margin means victory gap, not time beaten.
    let part=0;
    if(fin===1)part=1.1;
    else if(fin<=3 && gap!==null && gap>=0 && gap<=0.5)part=1.0;
    else if(fin<=3)part=0.65;
    else if(fin<=10 && gap!==null && gap>=0 && gap<=0.5)part=0.65;
    else if(fin<=10 && gap!==null && gap>=0 && gap<=1.0)part=0.15;
    const speedRank=num(h.final3f_rank);
    if(speedRank!==null&&speedRank>=1&&speedRank<=3)part+=0.2;
    // Track must be explicitly known; conditions compared for all horses.
    if(h.prior_track===row.target_track && part>0.6)part+=0.15;
    quality+=part;
    sources.push({prior_date:h.prior_date,prior_track:h.prior_track,finish:fin,
      win_or_beaten_gap_seconds:gap,finish_3f_rank:speedRank,part:round(part)});
  }
  if(!sources.length)return {status:"INSUFFICIENT_COMPARABLE_EVIDENCE",quality:null,sources:[],flags:[]};
  // Average of up to 4 observed comparisons, rather than "more races => bonus".
  const raceQuality=quality/sources.length;
  const followups=Array.isArray(row?.opponent_followups)?row.opponent_followups:[];
  const eligibleDates=new Set(sources.map(s=>s.prior_date));
  const rivals=new Set(followups.filter(x=>x&&day(x.historical_race_date)
    &&eligibleDates.has(x.historical_race_date)
    &&day(x.later_date)&&x.later_date> x.historical_race_date
    &&x.later_date<date&&num(x.later_finish)!==null
    &&Number(x.later_finish)>=1&&Number(x.later_finish)<=3
    &&typeof x.rival_name==="string").map(x=>x.rival_name));
  // Tiny capped contextual signal, not proportional to the number of articles/runs.
  const opponentSupport = softLimit(rivals.size,2)*0.08;
  flags.push("ONLY_VERIFIED_SAME_SURFACE_NEAR_DISTANCE");
  if(rivals.size)flags.push("LIMITED_OPPONENT_EVIDENCE");
  return {status:"COMPARABLE",quality:round(raceQuality+opponentSupport),
    sources,unique_rivals_with_later_top3:rivals.size,flags};
}

export function buildJraV04TieShadow(baseRunners,bundle,{
  targetSurface,targetDistance,targetTrack,
}={}){
  const unavailable=(reason)=>({status:reason,reordered:false,runners:[],
    changes:[],rank_effect_on_saved_prediction:false});
  if(!Array.isArray(baseRunners)||!bundle||!day(bundle.race_date)
    ||!Array.isArray(bundle.runners)||baseRunners.length<2)
    return unavailable("BASE_OR_EVIDENCE_MISSING");
  if(!["芝","ダート"].includes(targetSurface)||!Number.isInteger(targetDistance)
    ||targetDistance<=0||typeof targetTrack!=="string"||targetTrack!==bundle.track)
    return unavailable("INVALID_TARGET_CONDITIONS");
  if(baseRunners.length!==bundle.runners.length)
    return unavailable("FIELD_SIZE_DISAGREEMENT");
  const baseNos=baseRunners.map(r=>num(r?.horse_no)),evNos=bundle.runners.map(r=>num(r?.horse_no));
  if(baseNos.some(n=>!isInt(n))||new Set(baseNos).size!==baseNos.length
    ||evNos.some(n=>!isInt(n))||new Set(evNos).size!==evNos.length
    ||baseNos.some(n=>!evNos.includes(n)))
    return unavailable("HORSE_NUMBER_MISMATCH");
  const evidenceMap=new Map(bundle.runners.map(e=>[Number(e.horse_no),e]));
  const records=baseRunners.map(r=>{
    const baseline=num(r.rank),prob=num(r.validated_core_base_rate);
    const e=evidenceMap.get(Number(r.horse_no));
    const nameMatch=r.horse_name===e.horse_name;
    const detail=deriveEvidence({...e,target_track:targetTrack},bundle.race_date,targetSurface,targetDistance);
    return {horse_no:Number(r.horse_no),horse_name:r.horse_name,
      original_rank:baseline,validated_core_base_rate:prob,
      verified_identity:nameMatch,detail};
  });
  if(records.some(r=>!r.verified_identity||!isInt(r.original_rank)
    ||r.validated_core_base_rate===null
    ||r.validated_core_base_rate<0||r.validated_core_base_rate>1)
    ||new Set(records.map(r=>r.original_rank)).size!==records.length)
    return unavailable("INCOMPLETE_OR_CONFLICTING_BASE");
  const ranks=[...records.map(r=>r.original_rank)].sort((a,b)=>a-b);
  if(ranks.some((rank,i)=>rank!==i+1))return unavailable("NONCONTIGUOUS_BASE_RANKS");
  const ordered=[...records].sort((a,b)=>a.original_rank-b.original_rank);
  const groups=new Map();
  for(const r of ordered){
    const key=r.validated_core_base_rate.toFixed(6);
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(r);
  }
  let comparedGroups=0;
  const shadow=new Map(records.map(r=>[r.horse_no,r.original_rank]));
  const safeguards=[];
  for(const group of groups.values()){
    if(group.length<=1)continue;
    // Probabilities tied to six decimals only. Never reorder across bands.
    const currentRanks=group.map(x=>x.original_rank).sort((a,b)=>a-b);
    const contiguous=currentRanks.every((x,i)=>x===currentRanks[0]+i);
    if(!contiguous){safeguards.push("NONCONTIGUOUS_PROBABILITY_BAND");continue;}
    if(group.some(x=>x.detail.status!=="COMPARABLE")){
      safeguards.push("NO_CHANGE_INCOMPLETE_EQUAL_RATE_BAND");continue;
    }
    comparedGroups++;
    const sorted=[...group].sort((a,b)=>b.detail.quality-a.detail.quality
      ||a.original_rank-b.original_rank);
    // If the evidence quality is tied keep original order, exactly.
    sorted.forEach((r,i)=>shadow.set(r.horse_no,currentRanks[i]));
  }
  const rows=ordered.map(r=>({
    horse_no:r.horse_no,horse_name:r.horse_name,
    baseline_rank:r.original_rank,shadow_rank:shadow.get(r.horse_no),
    validated_core_base_rate:r.validated_core_base_rate,
    evidence_quality:r.detail.quality,evidence_status:r.detail.status,
    evidence_sources:r.detail.sources,opponent_sample:r.detail.unique_rivals_with_later_top3??0,
  }));
  const changes=rows.filter(r=>r.baseline_rank!==r.shadow_rank)
    .map(({horse_no,horse_name,baseline_rank,shadow_rank})=>
      ({horse_no,horse_name,baseline_rank,shadow_rank}));
  return {status:"SHADOW_READY",mode:"SAME_BASE_PROBABILITY_ONLY",
    compared_groups:comparedGroups,safeguards:[...new Set(safeguards)],
    reordered:changes.length>0,changes,runners:rows,
    rank_effect_on_saved_prediction:false,
    score_calibrated:false,extra_evidence_required_for_live_prediction:false};
}

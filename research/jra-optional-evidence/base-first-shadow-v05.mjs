/**
 * BAKEN LAB JRA 0.5 – base-first, class-aware evidence challenge (shadow only).
 *
 * The old experimental 0.4 tie scorer ignored even valid prior wins/close 2nds
 * when a rich archive match did not exist. 0.5 uses merged, dated fundamental
 * facts regardless of archive availability. Extra detail (3f/pace) adds only
 * corroboration. One bad run never cancels the runner's strongest effort.
 *
 * No popularity/odds, no current-race results, no changes to FROZEN/TOP5/EYE.
 * Coefficients below are *exploratory and uncalibrated*, not win probabilities.
 */
const n=x=>x!==null&&x!==undefined&&x!==""&&Number.isFinite(Number(x))?Number(x):null;
const day=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x);
const round=x=>Math.round(x*10000)/10000;
const same=(x,y)=>String(x??"").normalize("NFC")===String(y??"").normalize("NFC");
const positive=x=>Number.isInteger(x)&&x>0;

function classTier(s){
 if(typeof s!=="string")return null;
 if(/未勝利/.test(s))return 0;
 if(/1勝/.test(s))return 1;
 if(/2勝/.test(s))return 2;
 if(/3勝/.test(s))return 3;
 if(/オープン|G[1-3]|重賞|リステッド|ステークス/.test(s))return 4;
 return null;
}

export function inspectV05Horse(row,ctx){
 const raw=Array.isArray(row?.past_race_content)?row.past_race_content:[];
 const history=raw.filter(h=>h&&day(h.prior_date)&&h.prior_date<ctx.date
     &&h.prior_surface===ctx.surface&&n(h.prior_distance)!==null);
 const past=[];
 for (const h of history){
  const finish=n(h.finish),dist=n(h.prior_distance),gap=n(h.margin_to_winner);
  if(finish===null||finish<1||gap===null||gap<0)continue;
  const distanceDiff=Math.abs(dist-ctx.distance);
  // Relative distance: 200m is much more on a sprint than on 2200m.
  const differenceRatio=distanceDiff/ctx.distance;
  // Do not treat unrelated distances as the same ability test:
  // ±200m for sprints, ±330m around 2200m, capped at ±400m.
  const maxMeters=Math.max(200,Math.min(400,ctx.distance*0.15));
  if(distanceDiff>maxMeters)continue;
  const relevance=Math.max(0.3,1-differenceRatio*1.4);
  let achievement;
  if(finish===1) achievement=1.00;
  else if(finish<=3 && gap<=0.25)achievement=0.91;
  else if(finish<=3 && gap<=0.5)achievement=0.80;
  else if(finish<=3)achievement=0.60;
  else if(finish<=10&&gap<=0.25)achievement=0.66;
  else if(finish<=10&&gap<=0.5)achievement=0.48;
  else if(finish<=10&&gap<=1.0)achievement=0.25;
  else achievement=0.03;
  const from=classTier(h.prior_class),to=classTier(ctx.className);
  // Graduating from a lower class may be useful but isn't equivalent
  // to proving the same effort against higher-class opposition.
  const classFactor=from!==null&&to!==null && from<to?
    Math.max(0.68,1-0.13*(to-from)):1;
  const trackBonus=h.prior_track===ctx.track?0.035:0;
  // Rich archive is supplementary context only. A missing 3F rank must
  // NEVER reduce this numeric evidence score relative to the same base run.
  const score=Math.max(0,
    relevance*achievement*classFactor+trackBonus);
  // Exact, verifiable fractions of the RACE pace (not the horse's personal
  // sectionals). Can help contextualize positional changes without claiming
  // interference, being boxed-in or a wide trip.
  const fractions=typeof h.race_halons==="string"?
    h.race_halons.split(/\s*-\s*/).map(v=>Number(v.trim())):[];
  const validFractions=fractions.length>=6&&fractions.every(v=>
    Number.isFinite(v)&&v>=8&&v<=20);
  const first600=validFractions?round(fractions.slice(0,3).reduce((a,b)=>a+b,0)):null;
  const last600=validFractions?round(fractions.slice(-3).reduce((a,b)=>a+b,0)):null;
  past.push({date:h.prior_date,track:h.prior_track,distance:dist,finish,
   gap:round(gap),prior_class:h.prior_class??null,source_kind:h.source_kind??null,
   detailed:n(h.archive_match_count)===1,threef_rank:n(h.final3f_rank),
   early_pos:n(h.early_pos),pos_change:n(h.pos_change),
   race_first600:first600,race_last600:last600,
   race_first_minus_last600:first600!==null?round(first600-last600):null,
   relevance:round(relevance),class_factor:round(classFactor),
   evidence_quality:round(score)});
 }
 const unique=new Map();
 for(const h of past.sort((a,b)=>b.date.localeCompare(a.date))){
  const key=h.date+"|"+h.track+"|"+h.distance;
  if(!unique.has(key)) unique.set(key,h);
 }
 const runs=[...unique.values()];
 if(runs.length===0)return {status:"NO_COMPARABLE_BASIC_HISTORY",quality:null,
    max_effort:null,repeatability:null,sources:[],source_archive_gap:raw.length};
 const ordered=[...runs].sort((a,b)=>b.evidence_quality-a.evidence_quality);
 const strongest=ordered[0].evidence_quality;
 const second=ordered[1]?.evidence_quality??null;
 const repeatability=second===null?null:(strongest+second)/2;
 // Do not use raw COUNT as a score. One strong run is meaningful, but
 // with a single comparable run, conservative ranking behavior applies.
 const summary=second===null?strongest*0.93:strongest*0.72+second*0.28;
 const earlierWins=ordered.filter(h=>h.finish===1).length;
 const knownPastDates=new Set(ordered.map(h=>h.date));
 const rivalRuns=Array.isArray(row?.opponent_followups)?
   row.opponent_followups.filter(v=>v&&day(v.historical_race_date)
     &&knownPastDates.has(v.historical_race_date)&&day(v.later_date)
     &&v.later_date>v.historical_race_date&&v.later_date<ctx.date
     &&n(v.later_finish)!==null&&Number(v.later_finish)<=3
     &&Number(v.later_finish)>=1):[];
 const rivals=[...new Set(rivalRuns.map(v=>v.rival_name).filter(Boolean))];
 return {
  status:"COMPARABLE_BASE_FACTS",quality:round(summary),
  max_effort:strongest,repeatability:repeatability===null?null:round(repeatability),
  prior_wins:earlierWins,
  opponent_context:{unique_rival_count:rivals.length,
    followup_results:rivalRuns.length,score_effect:0},
  eligible_source_count:runs.length,
  source_archive_gap:raw.filter(h=>n(h.archive_match_count)!==1).length,
  sources:ordered,
  source_policy:"ORIGINAL_MERGED_HISTORY_USED_EVEN_WITHOUT_ARCHIVE",
 };
}

export function compareV05EqualBands(baseline,bundle,{
 targetSurface,targetDistance,targetTrack,targetClass,
 minimumQualityEdge=0.10,
 protectTop5=true
}={}){
 const stop=reason=>({status:reason,runners:[],changes:[],top5_changes:[],
  rank_effect_on_saved:false,scoring_research_only:true});
 if(!Array.isArray(baseline)||!bundle||!day(bundle.race_date)||
   !Array.isArray(bundle.runners))return stop("INVALID_INPUT");
 if(!["芝","ダート"].includes(targetSurface)||!positive(targetDistance)||
  bundle.track!==targetTrack||typeof targetClass!=="string")return stop("INVALID_TARGET_CONDITIONS");
 if(baseline.length!==bundle.runners.length)return stop("ROSTER_LENGTH_MISMATCH");
 const ev=new Map(bundle.runners.map(r=>[Number(r.horse_no),r]));
 const x=baseline.map(b=>{
  const code=Number(b.horse_no),saved=n(b.rank),baseRate=n(b.validated_core_base_rate);
  const source=ev.get(code);
  return {horse_no:code,horse_name:b.horse_name,baseline_rank:saved,
   base_rate:baseRate,identity:source&&same(source.horse_name,b.horse_name),
   detail:source?inspectV05Horse(source,{date:bundle.race_date,
     track:targetTrack,surface:targetSurface,distance:targetDistance,
     className:targetClass}):null};
 });
 if(ev.size!==x.length||x.some(r=>!positive(r.horse_no)||!positive(r.baseline_rank)||
   !r.identity||r.base_rate===null||r.base_rate<0||r.base_rate>1)||
  new Set(x.map(r=>r.horse_no)).size!==x.length||
  new Set(x.map(r=>r.baseline_rank)).size!==x.length)return stop("IDENTITY_OR_BASE_INVALID");
 const sorted=[...x].sort((a,b)=>a.baseline_rank-b.baseline_rank);
 if(sorted.some((r,i)=>r.baseline_rank!==i+1))return stop("NON_CONTIGUOUS_RANKS");
 const byRate=new Map();
 for(const r of sorted){
  const k=r.base_rate.toFixed(6);if(!byRate.has(k))byRate.set(k,[]);
  byRate.get(k).push(r);
 }
 const newRanks=new Map(sorted.map(r=>[r.horse_no,r.baseline_rank]));
 const declined=[];
 for(const group of byRate.values()){
  if(group.length<=1)continue;
  const band=[...group].sort((a,b)=>a.baseline_rank-b.baseline_rank);
  if(band.some((r,i)=>r.baseline_rank!==band[0].baseline_rank+i)){
   declined.push("NONCONTIGUOUS_BASE_GROUP");continue;
  }
  // Compare every member of the tied cohort, not the top candidate alone.
  // Missing baseline source for even one horse = do not reshuffle that cohort.
  if(band.some(r=>r.detail.status!=="COMPARABLE_BASE_FACTS")){
   declined.push("MISSING_COMPARABLE_BASIC_HISTORY");continue;
  }
  // Eligibility to swap is deliberately conservative. Whole group keeps
  // original if no evidence differential exceeds the fixed threshold.
  const candidate=[...band].sort((a,b)=>b.detail.quality-a.detail.quality||
    a.baseline_rank-b.baseline_rank);
  const strengthGap=Math.max(...band.map(r=>r.detail.quality))-
    Math.min(...band.map(r=>r.detail.quality));
  if(strengthGap<minimumQualityEdge){
   declined.push("NO_CREDIBLE_QUALITY_SEPARATION");continue;
  }
  // Protection gate does not ignore horses at the boundary. If a proposed
  // swap would discard a previous TOP5 horse who has demonstrable same-surface
  // top3 form in the last 4 runs, mark it as REVIEW_REQUIRED not auto-change.
  if(protectTop5&&candidate.some((r,i)=>{
   const old=r.baseline_rank,newRank=band[i].baseline_rank;
   return old<=5&&newRank>5 && r.detail.sources.some(s=>s.finish<=3);
  })){
   declined.push("TOP5_DISPLACEMENT_HAS_GOOD_FORM");continue;
  }
  candidate.forEach((r,i)=>newRanks.set(r.horse_no,band[i].baseline_rank));
 }
 const rows=sorted.map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
  baseline_rank:r.baseline_rank,shadow_rank:newRanks.get(r.horse_no),
  validated_core_base_rate:r.base_rate,quality:r.detail.quality,
  evidence:r.detail}));
 const changes=rows.filter(r=>r.baseline_rank!==r.shadow_rank)
  .map(r=>({horse_no:r.horse_no,horse_name:r.horse_name,
    baseline_rank:r.baseline_rank,shadow_rank:r.shadow_rank}));
 return {status:"V05_SHADOW_READY",runners:rows,changes,
  top5_changes:changes.filter(r=>(r.baseline_rank<=5)!==(r.shadow_rank<=5)),
  declined_reasons:[...new Set(declined)],
  rank_effect_on_saved:false,scoring_research_only:true,
  formula:"BEST_EFFORT_AND_REPEATABILITY_WITH_CLASS_DISTANCE_WEIGHT"};
}

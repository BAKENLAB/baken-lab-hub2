import { compareHistory } from './trends.mjs';

const dims=['track','turn','surface','distance','going','label'];
const present=v=>v!==null&&v!==undefined&&v!=='';
const cohort=(a,b,keys)=>keys.every(k=>present(a[k])&&a[k]===b[k]);
const time=v=>typeof v==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(v)?Date.parse(v):NaN;
const clean=v=>typeof v==='string'?v.normalize('NFKC').trim():null;
const median=d=>Array.isArray(d?.quartiles)&&d.quartiles.length===3&&
  d.quartiles.every(x=>Number.isFinite(x)&&x>0)&&d.quartiles[0]<=d.quartiles[1]&&
  d.quartiles[1]<=d.quartiles[2]&&Number.isInteger(d.n)&&d.n>0?d.quartiles[1]:null;

export function evaluateLocalBenchmark({runs,benchmarks,targetDate,cutoff,chronologyProven=false}) {
  const ids=new Set(runs.filter(r=>r.identity_verified===true).map(r=>r.horse_id));
  if(ids.size>1 || ids.has(undefined) || ids.has(null)) throw Error('BENCHMARK_HORSE_ID_CONFLICT');
  const seen=new Set(), observations=[], admitted=[];
  for(const run of runs){
    if(!/^\d{4}-\d\d-\d\d$/.test(run.race_date) || !run.evidence_id || seen.has(run.evidence_id) || !(run.race_date<targetDate))
      throw Error('BENCHMARK_HISTORY_KEY');
    seen.add(run.evidence_id);
    if(!(time(run.observed_at)<=time(cutoff)))continue;
    const matches=benchmarks.filter(b=>b.circuit==='LOCAL'&&cohort({...run,label:clean(run.label)},b,dims)&&
      b.period_start<b.period_end && b.first_date>=b.period_start && b.last_date>=b.first_date &&
      b.last_date<b.period_end && b.period_end<=run.race_date &&
      Number.isInteger(b.n_races)&&b.n_races>0 && b.finisher_elapsed?.n===b.n_horses &&
      b.individual_final3f?.n===b.n_horses && b.winner_elapsed?.n===b.n_races);
    if(matches.length!==1)continue;
    const b=matches[0], elapsed=median(b.finisher_elapsed), closing=median(b.individual_final3f);
    const validated=run.identity_verified===true&&Boolean(run.horse_id)&&run.conditions_verified===true&&
      b.benchmark_admitted===true&&b.asof_verified===true&&b.lineage_verified===true&&
      Boolean(b.source_ref&&b.version)&&cohort(run,b,['course_layout','verified_class','verified_eligibility'])&&
      time(b.available_at)<time(run.start_at)&&time(run.start_at)<=time(run.observed_at);
    const residual=(value,base)=>Number.isFinite(value)&&value>0&&base!==null?Math.round((value-base)*1000)/1000:null;
    const elapsedResidual=residual(run.elapsed_seconds,elapsed);
    const final3fResidual=run.final3f_kind==='INDIVIDUAL_FINAL3F'?residual(run.final3f,closing):null;
    const finding={evidence_id:run.evidence_id,n_races:b.n_races,period_end:b.period_end,
      benchmark_ref:b.source_ref??null,status:validated?'ADMITTED_HISTORICAL_COMPARISON':'ARCHIVE_COHORT_CANDIDATE',
      elapsed_residual_seconds:elapsedResidual,individual_final3f_residual_seconds:final3fResidual};
    observations.push(finding);
    if(validated)admitted.push({...run,layout:run.course_layout,class_name:run.verified_class,
      weight_group:run.verified_eligibility,benchmark_verified:true,residual_seconds:elapsedResidual});
  }
  const comparisons=admitted.flatMap((a,i)=>admitted.slice(i+1).filter(b=>a.distance!==b.distance&&
    Number.isFinite(a.residual_seconds)&&Number.isFinite(b.residual_seconds)&&
    cohort(a,b,['track','surface','turn','going','course_layout','verified_class','verified_eligibility']))
    .map(b=>({evidence_ids:[a.evidence_id,b.evidence_id],distances:[a.distance,b.distance],
      residuals:[a.residual_seconds,b.residual_seconds],fatigue_cause:null})));
  const admittedById=new Map(admitted.map(run=>[run.evidence_id,run]));
  // Keep unusable latest runs in the chronology rather than substituting older favorable runs.
  const history=runs.filter(r=>r.identity_verified===true).map(r=>admittedById.get(r.evidence_id)??{...r,benchmark_verified:false,residual_seconds:null});
  return {observations,admitted:admitted.length,comparisons,
    trends:compareHistory(history,targetDate,chronologyProven&&history.length===runs.length)};
}

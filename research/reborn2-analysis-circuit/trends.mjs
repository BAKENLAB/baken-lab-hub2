// Admitted source rows only. A complete chronology witness must include unusable latest starts.
const fields=['track','surface','distance','going','class_name','layout','weight_group'];
const median=xs=>{const a=xs.slice().sort((x,y)=>x-y),i=Math.floor(a.length/2);return (a[i]+a[Math.floor((a.length-1)/2)])/2;};
export function compareHistory(runs, targetDate, chronologyProven) {
  const result={};
  const keys=new Set();
  const sorted=runs.slice().sort((a,b)=>b.race_date.localeCompare(a.race_date));
  for(const r of sorted){
    if(!r.evidence_id||keys.has(r.evidence_id)||r.identity_verified!==true||
       !/^\d{4}-\d\d-\d\d$/.test(r.race_date)||r.race_date>=targetDate) throw Error('UNADMITTED_HISTORY');
    keys.add(r.evidence_id);
  }
  const usable=r=>Number.isFinite(r.residual_seconds)&&r.benchmark_verified===true&&fields.every(k=>r[k]!=null&&r[k]!=='');
  const cohorts=new Map();
  for(const run of sorted.slice(0,10).filter(usable)){
    const key=JSON.stringify(fields.map(k=>run[k]));
    if(!cohorts.has(key))cohorts.set(key,[]);
    cohorts.get(key).push(run);
  }
  for(const group of cohorts.values()){
    const vals=group.map(r=>r.residual_seconds);
    if(vals.length>=3){
      const center=median(vals);
      (result['13']??=[]).push({median_seconds:center,mad_seconds:median(vals.map(v=>Math.abs(v-center))),evidence_ids:group.map(r=>r.evidence_id)});
    }
    if(vals.length>=4){
      const split=Math.min(3,Math.floor(vals.length/2));
      const recent=vals.slice(0,split),earlier=vals.slice(split,split+3);
      (result['14']??=[]).push({recent_n:recent.length,earlier_n:earlier.length,
        recent_minus_earlier_seconds:median(recent)-median(earlier),evidence_ids:group.slice(0,split+3).map(r=>r.evidence_id)});
    }
  }
  const [latest,prior]=sorted;
  if(chronologyProven===true && latest && prior && latest.race_date!==prior.race_date &&
    usable(latest)&&usable(prior)&&fields.every(k=>latest[k]===prior[k])){
    result['32']=[{latest_minus_prior_seconds:latest.residual_seconds-prior.residual_seconds,evidence_ids:[latest.evidence_id,prior.evidence_id]}];
  }
  return result;
}

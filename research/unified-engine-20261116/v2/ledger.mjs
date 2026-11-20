import {meaningful} from '../input.mjs';
export function allocateClaims(claims,facts,policy){
 const ledger=[],usedAtoms=new Map(),usedPairs=new Set(),raceSpent=new Map();let total=0,complete=true;
 for(const c of claims){const row={criterion:c.criterion,mechanism:c.mechanism,requested_points:c.points,applied_points:null,status:'PENDING',shared_prior_races:[]};ledger.push(row);
  const ev=Array.isArray(c.fact_ids)?c.fact_ids.map(id=>facts.get(id)):[];
  if(!Number.isFinite(c.points)||c.points<0||!meaningful(c.reason)||!meaningful(c.current_relevance)||typeof c.mechanism!=='string'||!c.mechanism||ev.some(f=>!f||f.verified!==true)||(c.points>0&&!ev.length)){row.status='BLOCKED_UNVERIFIED_CLAIM';complete=false;continue;}
  if(c.points===0){row.status='ASSESSED_ZERO';row.applied_points=0;continue;}
  if(ev.some(f=>usedPairs.has(f.id+'|'+c.mechanism))){row.status='DUPLICATE_FACT_MECHANISM_SUPPRESSED';row.applied_points=0;continue;}
  if(ev.some(f=>usedAtoms.has(f.id))){row.status='SAME_ATOMIC_FACT_REUSED';row.applied_points=0;continue;}
  const roots=[...new Set(ev.map(f=>f.prior_key))],shared=roots.filter(k=>raceSpent.has(k));row.shared_prior_races=shared;
  if(shared.length&&policy.dependency_mode==='STRICT_PRIOR_RACE'){row.status='STRICT_SHARED_RACE_SUPPRESSED';row.applied_points=0;continue;}
  if(shared.length&&(c.dependence_audit?.distinct_dimensions!==true||!meaningful(c.dependence_audit?.reason))){row.status='BLOCKED_SHARED_RACE_DEPENDENCE_AUDIT';complete=false;continue;}
  const cap=policy.shared_prior_race_cap;
  if(!Number.isFinite(cap)||cap<=0||cap>100){row.status='BLOCKED_MISSING_PREDECLARED_CAP';complete=false;continue;}
  const applied=Math.max(0,Math.min(c.points,...roots.map(k=>cap-(raceSpent.get(k)??0))));
  row.applied_points=applied;row.status=applied<c.points?'CAPPED_SHARED_RACE':'SCORED';total+=applied;
  for(const f of ev){usedAtoms.set(f.id,c.criterion);usedPairs.add(f.id+'|'+c.mechanism);}for(const root of roots)raceSpent.set(root,(raceSpent.get(root)??0)+applied);
 }
 return {complete,total,ledger,dependency_mode:policy.dependency_mode};
}

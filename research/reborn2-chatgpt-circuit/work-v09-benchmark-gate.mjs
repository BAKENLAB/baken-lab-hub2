import {readFileSync} from 'node:fs';
const contract=JSON.parse(readFileSync(new URL('./work-v09-acceptance-link.json',import.meta.url),'utf8'));
export function inspectBenchmarkCandidate(row){
 const keys=contract.required_key,missing=keys.filter(k=>k==='distance'?!Number.isInteger(row?.[k])||row[k]<=0:typeof row?.[k]!=='string'||!row[k].trim());
 const invalid=contract.distributions.filter(k=>{const d=row?.[k];return !d||!Number.isInteger(d.n)||d.n<=0||![d.min,d.max,d.mean,d.stdev].every(Number.isFinite)||d.stdev<0||!Array.isArray(d.quartiles)||d.quartiles.length!==3||!d.quartiles.every(Number.isFinite)||d.min>d.quartiles[0]||d.quartiles[0]>d.quartiles[1]||d.quartiles[1]>d.quartiles[2]||d.quartiles[2]>d.max||d.mean<d.min||d.mean>d.max;});
 const unresolved=contract.required_gates.filter(k=>row?.[k]!==true);
 // Never turn assertions in a new research packet into formal authorization.
 return {key:Object.fromEntries(keys.map(k=>[k,row?.[k]??null])),missing_keys:missing,invalid_distributions:invalid,unresolved_gates:unresolved,observed_version:row?.observation_version??null,observation_status:missing.length||invalid.length?'INVALID_RESEARCH_PACKET':'RESEARCH_CANDIDATE_ONLY',origin_identity:'NOT_PROVEN_IDENTICAL_TO_OLD_REPLAY',benchmark_admitted:false,scoring_authorized:false,formal_consumption:false};
}
export function workV09Status(){return {...contract,formal_consumer_connected:false};}

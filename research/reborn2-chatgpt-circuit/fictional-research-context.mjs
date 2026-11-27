// Isolated fictional local-clock context; no official admission.
export const fictionalTime=x=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/.test(x)?((n)=>Number.isFinite(n)&&new Date(n).toISOString().slice(0,19)===x?n:NaN)(Date.parse(x+'Z')):NaN; // wall-clock ordering coordinate only, NOT a UTC instant
export const fixtureHorse=x=>typeof x==='string'&&/^FIXTURE-[A-Z]\d*$/.test(x);
export const fixtureEvidence=x=>x?.fixture_only===true&&x.official_evidence===false&&x.formal_admission===false&&typeof x.evidence_id==='string'&&x.evidence_id.startsWith('fixture-v2:')&&(!Object.hasOwn(x,'identity_status')||x.identity_status==='FICTIONAL_ONLY')&&x.source_verified!==true&&x.source_authenticity_verified!==true&&x.identity_attestation_verified!==true;
export function assertFictionalTarget(target,roster){
 if(target?.circuit!=='FIXTURE'||target.fixture_only!==true||target.official_evidence!==false||target.formal_admission!==false||!/^FK-/.test(target.race_id??'')||!(fictionalTime(target.cutoff)<fictionalTime(target.started_at))||roster.length!==target.field_size||new Set(roster.map(h=>h.horse_id)).size!==roster.length||new Set(roster.map(h=>h.horse_no)).size!==roster.length||roster.some(h=>!fixtureHorse(h.horse_id)||!fixtureEvidence(h)))throw Error('FICTIONAL_CONTEXT_REQUIRED');
}
export const localAdmission=(target,e)=>fixtureEvidence(e)&&fictionalTime(e.published_at)<=fictionalTime(target.cutoff);
export function fixtureCommon(target,roster,evidence){
 assertFictionalTarget(target,roster);
 const ts=fictionalTime,unique=(xs,key)=>{const n=new Map();for(const x of xs)n.set(key(x),(n.get(key(x))??0)+1);return xs.filter(x=>n.get(key(x))===1);};
 const byId=new Map(unique(evidence.filter(e=>localAdmission(target,e)),e=>e.evidence_id).map(e=>[e.evidence_id,e]));
 const bound=(x,h,r)=>{const e=byId.get(x?.evidence_id);return !!e&&e.horse_id===h&&e.race_id===r;};
 const identities=roster.filter(h=>bound(h,h.horse_id,target.race_id)&&byId.get(h.evidence_id).runner_no===h.horse_no);
 const prior=r=>identities.some(h=>h.horse_id===r.horse_id)&&r.circuit==='FIXTURE'&&r.race_id!==target.race_id&&bound(r,r.horse_id,r.race_id)&&ts(r.started_at)<ts(byId.get(r.evidence_id).published_at)&&r.conditions_observed===true;
 const items=(lo,hi)=>Object.fromEntries(Array.from({length:hi-lo+1},(_,i)=>[String(i+lo),{facts:[],hypotheses:[],counterevidence:[],unknowns:[],effect:'NO_RECORDED_USE'}]));
 const add=(i,n,k,v,refs)=>i[n][k].push({value:v,evidence_ids:[...new Set(refs.filter(Boolean))]});
 const close=i=>{for(const x of Object.values(i))if(!x.facts.length&&!x.hypotheses.length&&!x.unknowns.length)x.unknowns.push('NO_USABLE_FIXTURE_MATERIAL');return i;};
 const finish=(runners,lo,hi)=>({runners,fixture_only:true,formal_admission:false,scoring_authorized:false,final_grade:null});
 return {ts,cutoff:ts(target.cutoff),start:ts(target.started_at),unique,byId,bound,identities,prior,items,add,close,finish};
}
export function historyKnown(target,x){return target.circuit==='FIXTURE'?x?.fixture_chronology_consistent===true:x?.chronology_verified===true;}
export function segmentKnown(target,x){return target.circuit==='FIXTURE'?x?.fixture_segment_labels_consistent===true:x?.segment_definition_verified===true;}
export function segmentComplete(target,x){return target.circuit==='FIXTURE'?x?.fixture_segment_grid_complete===true:x?.all_segments_verified===true;}
export function gateKnown(target,x){return target.circuit==='FIXTURE'?x?.fixture_gate_consistent===true:x?.actual_gate_verified===true;}

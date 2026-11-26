export function common(target,roster,evidence){
 const ts=x=>typeof x==="string"&&/(Z|[+-]\d\d:\d\d)$/.test(x)?Date.parse(x):NaN;
 const str=x=>typeof x==="string"&&x.trim().length>0;
 const cutoff=ts(target.cutoff),start=ts(target.started_at);
 const unique=(xs,key)=>{const n=new Map();for(const x of xs)n.set(key(x),(n.get(key(x))||0)+1);return xs.filter(x=>n.get(key(x))===1)};
 if(!["JRA","LOCAL"].includes(target.circuit)||!str(target.race_id)||!(cutoff<start)||!Number.isInteger(target.field_size)||target.field_size<1||roster.length!==target.field_size||roster.some(r=>!Number.isInteger(r.horse_no)||r.horse_no<1)||unique(roster,r=>r.horse_no).length!==roster.length)throw Error("TARGET_OR_ROSTER_INVALID");
 const valid=e=>str(e.evidence_id)&&str(e.source_id)&&str(e.source_url)&&str(e.source_version)&&e.cutoff===target.cutoff&&e.identity_status==="VERIFIED"&&e.permission_status==="CLEARED_FOR_RESEARCH_USE"&&/^[a-f0-9]{64}$/.test(e.raw_sha256_or_null??"")&&e.fact_or_proxy==="FACT"&&ts(e.published_at_or_null)<=ts(e.observed_at)&&ts(e.observed_at)<=cutoff;
 const admitted=unique(evidence.filter(valid),e=>e.evidence_id);
 const byId=new Map(admitted.map(e=>[e.evidence_id,e]));
 const bound=(x,h,r)=>{const e=byId.get(x?.evidence_id);return !!e&&e.horse_id===h&&e.race_id===r};
 const identities=unique(roster.filter(r=>typeof r.horse_id==="string"&&new RegExp("^"+target.circuit+":\\d+$").test(r.horse_id)&&bound(r,r.horse_id,target.race_id)&&byId.get(r.evidence_id).runner_no===r.horse_no),r=>r.horse_id);
 const prior=r=>identities.some(h=>h.horse_id===r.horse_id)&&r.circuit===target.circuit&&r.race_id!==target.race_id&&str(r.race_id)&&ts(r.started_at)<start&&bound(r,r.horse_id,r.race_id)&&ts(byId.get(r.evidence_id).published_at_or_null)>ts(r.started_at)&&r.conditions_verified===true;
 const items=(lo,hi)=>Object.fromEntries(Array.from({length:hi-lo+1},(_,i)=>[String(i+lo),{facts:[],hypotheses:[],counterevidence:[],unknowns:[],effect:"NO_RECORDED_USE"}]));
 const finish=(runners,lo,hi)=>({runners,coverage:Object.fromEntries(Array.from({length:hi-lo+1},(_,i)=>{const n=String(i+lo);return [n,{target:roster.length,with_output:runners.filter(h=>h.items[n].facts.length||h.items[n].hypotheses.length).length,consumed:0}]})),scoring_authorized:false,final_grade:null});
 const add=(items,n,kind,value,refs)=>items[n][kind].push({value,evidence_ids:[...new Set(refs.filter(Boolean))]});
 const close=items=>{for(const i of Object.values(items))if(!i.facts.length&&!i.hypotheses.length&&!i.unknowns.length)i.unknowns.push("NO_ADMITTED_MATERIAL");return items};
 return {ts,str,cutoff,start,unique,byId,bound,identities,prior,items,finish,add,close};
}

import {common} from './common-evidence.mjs';
function evidenceRefs(item){
 if(!item)return [];
 const entries=Array.isArray(item)?item:[...(item.facts??[]),...(item.hypotheses??[]),...(item.counterevidence??[])];
 return [...new Set(entries.flatMap(e=>[...(e.evidence_ids??[]),...(e.evidence_id?[e.evidence_id]:[]),...(e.value?.evidence_ids??[])]))];
}
export function auditAll100({target,roster,sections,evidence=[],canonical,sourceIndex}){
 const ids=canonical.map(x=>x.id);
 if(ids.length!==100||ids.some((id,i)=>id!==String(i+1).padStart(2,"0"))||sourceIndex.length!==100||sourceIndex.some((x,i)=>x.id!==ids[i]||x.name!==canonical[i].name))throw Error("CATALOG_MISMATCH");
 const c=common(target,roster,evidence);
 const runners=roster.map(entry=>{
  const h=c.identities.find(x=>x.horse_no===entry.horse_no);
  const items=ids.map((id,i)=>{
   const sec=sections.find(s=>Number(id)>=s.lo&&Number(id)<=s.hi);
   const row=sec?.result?.runners.find(r=>r.horse_no===entry.horse_no);
   const item=row?.items?.[id];
   const refs=evidenceRefs(item),sourceIds=target.circuit==="JRA"?sourceIndex[i].jra_source_ids:sourceIndex[i].local_source_ids;
   const matched=refs.filter(eid=>{const e=c.byId.get(eid);return e&&sourceIds.includes(e.source_id)&&h&&(e.horse_id===h.horse_id||e.horse_id===null||Number(id)>=33&&Number(id)<=77||Number(id)>=85&&Number(id)<=90)});
   const hasOutput=Array.isArray(item)?item.length>0:!!(item?.facts?.length||item?.hypotheses?.length||item?.counterevidence?.length);
   const applicability=item?.unknowns?.includes("NOT_APPLICABLE_STRAIGHT")?"CANDIDATE_NOT_APPLICABLE":"UNRESOLVED";
   const legacy=Number(id)<=32?row?.integrated_audit?.items?.[id]??null:null;
   return {horse_id:h?.horse_id??null,horse_no:entry.horse_no,item_id:id,name:canonical[i].name,source_cutoff:target.cutoff,input_version:"research-v0.1",source_planned:sourceIds,implementation:item?"INITIAL_RESEARCH_PRESENT":"MISSING",analysis_status:hasOutput?"OUTPUT_CANDIDATE":item?"NO_OUTPUT":"NOT_IMPLEMENTED",evidence_ids:refs,contract_matched_evidence_ids:matched,upstream_legacy_audit:legacy,observed:refs.length?"REFERENCE_PRESENT_UNVERIFIED":"NOT_ESTABLISHED",identity_bound:"NOT_INDEPENDENTLY_ESTABLISHED",asof_eligible:"NOT_INDEPENDENTLY_ESTABLISHED",analysis_validated:false,assessment_consumed:false,release_eligible:false,applicability,unknowns:Array.isArray(item)?[]:item?.unknowns??["MISSING_ITEM"],finding:item??null};
  });
  const axes=[["A",1,42],["B",43,57],["C",33,42],["D",58,77],["E",78,100]].map(([axis,lo,hi])=>({axis,status:"UNKNOWN",candidate_item_ids:items.filter(i=>Number(i.item_id)>=lo&&Number(i.item_id)<=hi&&i.analysis_status==="OUTPUT_CANDIDATE").map(i=>i.item_id),support:[],counter:[],unknown:"UNVALIDATED_CURRENT_ABILITY"}));
  // Keep a deduplicated index; aliases are not asserted independent.
  const evidenceIndex=new Map();for(const item of items)for(const e of item.evidence_ids){if(!evidenceIndex.has(e))evidenceIndex.set(e,[]);evidenceIndex.get(e).push(item.item_id)}
  return {horse_no:entry.horse_no,horse_id:h?.horse_id??null,items,assessment:{axes,rank_candidate:null,decision_status:"UNAPPROVED_RESEARCH",item_consumption:items.map(i=>({item_id:i.item_id,used:false,reason:"NO_APPROVED_DECISION_CONSUMER"})),shared_evidence_index:[...evidenceIndex].map(([evidence_id,item_ids])=>({evidence_id,item_ids})),independent_evidence_groups:null,eye_candidate:null}};
 });
 return {runners,coverage:Object.fromEntries(ids.map(id=>[id,{target:roster.length,implemented:runners.filter(h=>h.items.find(i=>i.item_id===id).implementation==="INITIAL_RESEARCH_PRESENT").length,candidate_output:runners.filter(h=>h.items.find(i=>i.item_id===id).analysis_status==="OUTPUT_CANDIDATE").length,validated:0,consumed:0,release_eligible:0}])),release_eligible:false,scoring_authorized:false};
}

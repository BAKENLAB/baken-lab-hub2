const canon=v=>Array.isArray(v)?v.map(canon):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canon(v[k])])):v;
const key=v=>JSON.stringify(canon(v));
const uniq=xs=>[...new Set(xs)].sort();
const dedup=xs=>[...new Map(xs.map(x=>[key(x),x])).values()];
const refs=x=>x?.evidence_ids??(x?.evidence_id?[x.evidence_id]:[]);
// Corrections must reference an accepted new record and the exact old source identity.
// No caller-supplied correction can silently remove a contrary hypothesis.
export function mergeTypedFinding({item,typedItem,intake,corrections=[]}){
 const old=Array.isArray(item.finding)?{facts:item.finding}:item.finding??{};
 const fresh=typedItem?.observations??[];
 const byRef=new Map(intake.accepted.flatMap(g=>g.evidence_ids.map(id=>[id,g])));
 const history=[],conflicts=[];
 const valid=new Map();
 for(const c of corrections){
  const newer=byRef.get(c.new_evidence_id),w=newer?.record?.correction_witness;
  if(!newer||!w||w.old_evidence_id!==c.old_evidence_id||w.old_raw_sha256!==c.old_raw_sha256||w.old_source_version!==c.old_source_version||w.official_correction_verified!==true||w.independent_attestation_verified!==true||newer.record.source_version===c.old_source_version)continue;
  const previous=intake.inspected.find(x=>x.evidence_id===c.old_evidence_id)?.record;
  if(!previous||previous.raw_sha256_or_null!==c.old_raw_sha256||previous.source_version!==c.old_source_version||previous.horse_id!==newer.record.horse_id||previous.race_id!==newer.record.race_id||previous.kind!==newer.record.kind)continue;
  valid.set(c.old_evidence_id,c);
 }
 const keep=(entries,kind)=>entries.filter(o=>{
  const affected=refs(o).filter(id=>valid.has(id));
  // Compound hypotheses need revalidation; never delete a counter just because one constituent changed.
  if(affected.length){history.push({kind,previous:o,corrections:affected.map(id=>valid.get(id)),status:refs(o).every(id=>valid.has(id))?'SUPERSEDED_REVALIDATION_REQUIRED':'PARTIAL_CORRECTION_REVALIDATION_REQUIRED'});}
  return !affected.length||kind!=='facts'||!refs(o).every(id=>valid.has(id));
 });
 const oldFacts=keep(old.facts??[],'facts'),hypotheses=keep(old.hypotheses??[],'hypotheses'),counterevidence=keep(old.counterevidence??[],'counterevidence');
 const factsNew=fresh.map(o=>({value:o.value,evidence_ids:o.evidence_ids,typed_kind:o.kind,original_event_keys:o.original_event_keys}));
 for(const a of oldFacts)for(const b of factsNew){
  const overlap=refs(a).some(id=>refs(b).includes(id));
  if(overlap&&key(a.value??a)!==key(b.value))conflicts.push({old:a,new:b,status:'SHARED_SOURCE_DIFFERENT_REPRESENTATION_REVIEW'});
 }
 const unknowns=uniq([...(old.unknowns??[]),...(item.unknowns??[]),...(typedItem?.unknowns??[]),...(conflicts.length?['TYPED_LEGACY_RECONCILIATION_REQUIRED']:[]),...(history.length?['CORRECTION_DEPENDENCIES_REVALIDATION_REQUIRED']:[])]);
 return {...item,analysis_status:fresh.length?'OUTPUT_CANDIDATE':item.analysis_status,finding:{...old,facts:dedup([...oldFacts,...factsNew]),hypotheses,counterevidence,unknowns},unknowns,evidence_ids:uniq([...oldFacts,...factsNew,...hypotheses,...counterevidence].flatMap(refs).concat(item.evidence_ids??[]).filter(id=>!valid.has(id))),typed_v2:fresh.length>0,merge_audit:{correction_history:history,conflicts,final_consumption:false}};
}

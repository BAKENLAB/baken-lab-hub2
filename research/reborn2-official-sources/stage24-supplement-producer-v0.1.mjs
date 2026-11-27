function work24(packet,bundle,pin,canonical,crypto){
 const {sha,canon,digest}=crypto;const must=(ok,msg)=>{if(!ok)throw Error(msg)};
 const int=x=>Number.isSafeInteger(x);const ptr=(o,p)=>p.split("/").slice(1).reduce((v,k)=>v?.[k],o);
 const evidence=new Map(packet.evidence.map(e=>[e.evidence_id,e]));const states=new Map(packet.field_states.map(e=>[e.evidence_id,e]));
 must(packet.schema==="WORK23_SYNTHETIC_HANDOFF_0.2"&&packet.scope==="SYNTHETIC_ONLY"&&packet.formal_admissions===0&&packet.formal_eligible===false,"PACKET_SCOPE");
 must(evidence.size===packet.evidence.length&&states.size===packet.field_states.length,"DUPLICATES");
 must(canonical.length===115&&new Set(canonical.map(x=>x.item)).size===115,"CANONICAL");
 const output={schema:"WORK24_SUPPLEMENT_0.1",scope:"SYNTHETIC_ONLY",parent_packet:pin,issuer:packet.issuer,event:packet.event,status:packet.status,formal_admissions:0,formal_eligible:false,analysis_consumed:0,official_group_id:null,extensions:[],events:[],relations:[],runners:[]};
 if(packet.status==="HELD"){
   must(!packet.evidence.length&&!packet.runners.length&&packet.items?.length===115,"HELD_LEAK");
   output.reason=packet.reason;output.global_items=packet.items.map(x=>({item:x.item,parent_state:x.state,material_state:"HELD",observation_status:"HELD",analysis_sufficient:false,reasons:[x.reason],available_refs:[],unavailable_refs:[]}));return output;
 }
 must(packet.status==="TEST_ONLY_PACKET","STATUS");
 const v=bundle.versions.find(x=>x.manifest.version===packet.selected_version),m=v?.manifest,reg=bundle.registry_receipt.registry,anchor=bundle.anchor;
 must(m&&sha(v.raw_ascii)===m.raw_sha256&&v.raw_ascii.length===m.byte_length&&digest(bundle.registry_receipt)===anchor.registry_sha&&packet.registry_sha===anchor.registry_sha&&packet.selected_receipt_sha===reg.entries[m.version-1].receipt_sha,"SOURCE_BINDING");
 must(m.cutoff===packet.cutoff&&reg.checked_at===packet.analysis_at&&m.seal_at+m.uncertainty<=packet.cutoff&&packet.cutoff<m.scheduled_start-m.uncertainty,"TIME");
 must(reg.complete===true&&reg.rights.private===true&&reg.rights.ai===true&&reg.rights.processor===true&&reg.rights.storage===true&&reg.rights.capture===true&&reg.rights.valid_from<=packet.analysis_at&&packet.analysis_at<Math.min(reg.rights.valid_until,reg.rights.retain_until)&&[reg.rights.revoked_at,reg.rights.deleted_at].every(x=>x===null||packet.analysis_at<x),"RIGHTS");
 const raw=JSON.parse(v.raw_ascii);
 for(const e of packet.evidence)must(e.formal_usable===false&&e.raw_sha256===m.raw_sha256&&e.source_version===m.version&&e.registry_sha===anchor.registry_sha&&e.state==="TEST_INPUT_AVAILABLE"&&e.published_at<=e.observed_at&&e.observed_at<=m.capture_end&&canon(ptr(raw,e.pointer))===canon(e.value),"PARENT_EVIDENCE_BINDING");
 for(const e of packet.field_states)must(e.state==="TEST_INPUT_AVAILABLE"?evidence.has(e.evidence_id):e.value===null&&!evidence.has(e.evidence_id),"FIELD_STATE");
 const field=(event,subject,name)=>packet.field_states.find(x=>x.event_id===event&&x.subject_id===subject&&x.field===name);
 const id=e=>e?.evidence_id??null;
 const ref=(e,role)=>({role,ref:id(e),state:e?.state??"MISSING",reason:e?.reason??(e?"": "SOURCE_FIELD_NOT_PROVIDED")});
 const isgood=e=>e?.state==="TEST_INPUT_AVAILABLE";
 function extend(event,subject,no,fieldName,pointer,unit,valid,anchorRefs,reason="SOURCE_CONTEXT_UNVERIFIED"){
  const val=ptr(raw,pointer),state=val===null||val===undefined?"MISSING":valid?"TEST_INPUT_AVAILABLE":"HELD",role=event.id===packet.event?"CURRENT_CARD":subject===null?"HISTORICAL_RACE":"HISTORICAL_RUNNER",root="TESTROOT:"+digest([packet.issuer,event.id,subject,no,fieldName]);
  const e={evidence_id:"TESTEV:"+digest([root,m.version,m.raw_sha256,pointer]),root,issuer:packet.issuer,subject_id:subject,event_id:event.id,event_role:role,current_event:packet.event,current_no:role==="CURRENT_CARD"?no:packet.runners.find(x=>x.id===subject)?.no??null,historical_no:role==="CURRENT_CARD"?null:no,source_version:m.version,raw_sha256:m.raw_sha256,hash_domain:m.hash_domain,pointer,field:fieldName,unit,event_at:event.at,published_at:event.published,observed_at:event.observed,capture_start:m.capture_start,capture_end:m.capture_end,seal_at:m.seal_at,uncertainty:m.uncertainty,cutoff:m.cutoff,analysis_at:packet.analysis_at,registry_sequence:reg.sequence,registry_sha:anchor.registry_sha,identity_status:"SYNTHETIC_SAME_ISSUER_ONLY",permission_status:"TEST_ONLY_LATEST_REGISTRY",state,reason:state==="MISSING"?"SOURCE_FIELD_MISSING":state==="HELD"?reason:null,value:state==="TEST_INPUT_AVAILABLE"?val:null,depends_on:anchorRefs.filter(Boolean),formal_usable:false};
  output.extensions.push(e);return e;
 }
 const eventMap=new Map();
 for(const [i,x] of [raw.target,...raw.history].entries()){
  const current=i===0,base=current?"/target":`/history/${i-1}`,rows=current?x.roster:x.rows;
  must(Array.isArray(rows)&&x.published<=x.observed&&x.observed<=m.capture_end,"EVENT_SCOPE");
  const cond=field(x.id,null,"conditions"),geom=field(x.id,null,"course_geometry"),lap=current?null:field(x.id,null,"race_leader_laps");
  const rowRecords=rows.map((y,j)=>{
   const identity=field(x.id,y.id,current?"current_runner":"historical_runner_identity");
   const own=packet.field_states.filter(z=>z.event_id===x.id&&z.subject_id===y.id);
   const status=current?null:extend(x,y.id,y.no,"historical_run_status",`${base}/rows/${j}/status`,"run_status",isgood(identity)&&["FINISHED","DNF","CANCELLED","EXCLUDED"].includes(y.status),[id(identity)],"IDENTITY_NOT_VERIFIED");
   const final3f=field(x.id,y.id,"individual_final3f"),cp=field(x.id,y.id,"checkpoint_positions");
   return {subject_id:y.id,historical_no:current?null:y.no,current_no:current?y.no:packet.runners.find(z=>z.id===y.id)?.no??null,identity:ref(identity,"native_identity"),status:current?(isgood(identity)?y.status:null):isgood(status)?status.value:null,status_ref:current?id(identity):id(status),observations:own.map(z=>ref(z,z.field)),final3f_scope:current?null:{measurement:"INDIVIDUAL_FINAL_600M_DURATION",value_ref:isgood(final3f)?id(final3f):null,conditions_ref:id(cond),interval_m:isgood(final3f)&&isgood(cond)&&cond.value.distance_m>=600?[cond.value.distance_m-600,cond.value.distance_m]:null,interval_basis:"FINAL3F_FIELD_DEFINITION_AND_VERIFIED_DISTANCE_NOT_INTERMEDIATE_CLOCK",state:isgood(final3f)&&isgood(cond)?"INTERVAL_IDENTIFIED":"HELD_OR_MISSING"},checkpoint_scope:current?null:{measurement:"ORDINAL_RANK_NOT_CLOCK",value_ref:isgood(cp)?id(cp):null,geometry_ref:id(geom),locations_m:isgood(cp)&&isgood(geom)?geom.value.checkpoints_m:null,state:isgood(cp)&&isgood(geom)?"LOCATIONS_IDENTIFIED":"HELD_OR_MISSING"},individual_intermediate_clock:{state:"MISSING",reason:"NO_EXPLICIT_INDIVIDUAL_CHECKPOINT_CLOCK_IN_SOURCE",value:null}};
  });
  const idsOK=rowRecords.every(y=>y.identity.state==="TEST_INPUT_AVAILABLE"),countOK=rows.length===(current?x.registered_count:x.field_count);
  const count=extend(x,null,null,current?"registered_count":"historical_field_count",base+(current?"/registered_count":"/field_count"),"runner_count",countOK&&int(current?x.registered_count:x.field_count),rowRecords.map(y=>y.identity.ref),"FIELD_COUNT_MISMATCH");
  const active=current?extend(x,null,null,"active_count",base+"/active_count","runner_count",countOK&&rows.filter(y=>y.status==="ACTIVE").length===x.active_count,rowRecords.map(y=>y.identity.ref),"FIELD_COUNT_MISMATCH"):null;
  const validClass=isgood(cond)&&cond.value.class_effective[0]<=x.at&&x.at<cond.value.class_effective[1];
  // Same source roots: class/geometry projection is never counted as independent evidence.
  const conditionContext={condition_ref:id(cond),geometry_ref:id(geom),condition_state:cond?.state??"MISSING",geometry_state:geom?.state??"MISSING",class_id:validClass?cond.value.class_id:null,class_effective:validClass?cond.value.class_effective:null,class_provenance:validClass?{parent_evidence_id:cond.evidence_id,parent_root:cond.root,class_pointer:cond.pointer+"/class_id",effective_pointer:cond.pointer+"/class_effective",effective_at_event:true,source_authority:"SYNTHETIC_CARD_LABEL_ONLY",official_grade_rules:"MISSING",grade_eligibility:"NOT_ESTABLISHED",cross_class_strength:"NOT_ESTABLISHED"}:null};
  const laps=isgood(lap)?{ref:lap.evidence_id,scope:"RACE_LEADER_INTERVALS",segments:lap.value.segments.reduce((a,s)=>{let start=a.length?a.at(-1).end_m:0;a.push({start_m:start,end_m:start+s.distance_m,ticks:s.ticks});return a},[]),individual_clock_inference:false}:null;
  const eventRecord={event_id:x.id,event_role:current?"CURRENT_CARD":"HISTORICAL_RACE",event_at:x.at,published_at:x.published,observed_at:x.observed,field_count_ref:count.evidence_id,active_count_ref:id(active),roster_identity_complete:idsOK,roster_count_consistent:countOK,source_scope:"ALL_ROWS_IN_FIXTURE_NOT_COMPLETE_CAREER",conditions:conditionContext,lap_scope:laps,rows:rowRecords};
  output.events.push(eventRecord);eventMap.set(x.id,eventRecord);
 }
 const extMap=new Map(output.extensions.map(x=>[x.evidence_id,x]));must(extMap.size===output.extensions.length&&output.extensions.every(x=>!states.has(x.evidence_id)),"EXTENSION_DUPLICATE");
 for(const r of packet.relations){must(r.evidence_ids.every(x=>evidence.has(x)),"RELATION_REF");const source=eventMap.get(r.reference_event),later=r.followup_event?eventMap.get(r.followup_event):null;must(source&&(!r.followup_event||later),"RELATION_EVENT");
  const refs=[...new Set([...r.evidence_ids,source.field_count_ref,source.conditions.condition_ref,...(later?[later.field_count_ref,later.conditions.condition_ref]:[])].filter(Boolean))];
  const roots=[...new Set(refs.map(k=>(evidence.get(k)||extMap.get(k)||states.get(k))?.root).filter(Boolean))];
  const scopeComparison=source.conditions.class_id!==null&&later?.conditions.class_id!==null&&later?{same_class_label:source.conditions.class_id===later.conditions.class_id,class_strength_comparable:"NOT_ESTABLISHED",condition_refs:[source.conditions.condition_ref,later.conditions.condition_ref]}:null;
  output.relations.push({...r,context_refs:refs,stable_roots:roots,event_pair_key:[r.reference_event,r.followup_event].filter(Boolean).sort().join("|"),source_field_identity_complete:source.roster_identity_complete,followup_field_identity_complete:later?.roster_identity_complete??null,followup_is_later:r.type==="OPPONENT_LATER_PRIOR_TO_CUTOFF"?later.event_at>source.event_at&&later.observed_at<=packet.cutoff:null,scope_comparison:scopeComparison,relation_strength:"NOT_ESTABLISHED",full_peer_career:"MISSING"});
 }
 // These are explicit dependency plans for the narrow observations; not complete canonical item analysis.
 const req={RANK02:["finish","historical_field_count"],RANK03:["margin_to_winner","finish_clock","finish","historical_field_count"],RANK04:["margin_to_next","finish","historical_field_count"],RANK05:["finish_clock"],RANK06:["individual_final3f","conditions"],RANK17:["checkpoint_positions","course_geometry","historical_field_count"],RANK19:["race_leader_laps","conditions"],RANK33:["conditions","historical_field_count"],RANK34:["finish","historical_field_count","conditions"],RANK35:["finish","historical_field_count","conditions"],RANK36:["finish","historical_field_count","conditions"],RANK37:["finish","historical_field_count","conditions"],RANK43:["conditions","finish","finish_clock"],RANK44:["conditions","finish","finish_clock"],RANK45:["conditions","finish"],RANK47:["conditions","finish"],RANK48:["conditions","finish"],RANK49:["conditions","finish"],RANK50:["course_geometry","finish"],RANK51:["course_geometry","finish"],RANK52:["course_geometry","finish"],RANK54:["weight","finish","conditions"],RANK67:["course_geometry","checkpoint_positions"]};
 const narrow=new Set(["RANK02","RANK03","RANK04","RANK05","RANK06","RANK17","RANK19"]);
 const needed={RANK02:["COMPLETE_CAREER_AND_RECENCY_SCOPE_UNVERIFIED"],RANK03:["COMPARABLE_RACE_LEVEL_AND_MARGIN_CONTEXT_UNVERIFIED"],RANK04:["FULL_COMPETITIVE_CONTEXT_UNVERIFIED"],RANK05:["COMPARABLE_CLOCK_BASELINE_UNAVAILABLE"],RANK06:["COMPARABLE_PACE_AND_FINAL600_BASELINE_UNAVAILABLE"],RANK17:["POSITION_CHANGE_INTERPRETATION_AND_ACTUAL_CHECKPOINT_TIMES_UNAVAILABLE"],RANK19:["COMPARABLE_PACE_REFERENCE_AND_INDIVIDUAL_SECTIONALS_UNAVAILABLE"],RANK33:["OFFICIAL_CLASS_RULE_AND_ELIGIBILITY_UNAVAILABLE"],RANK34:["FULL_PEER_CAREER_AND_ABILITY_REFERENCE_UNAVAILABLE"],RANK35:["CURRENT_CONDITIONAL_APPLICABILITY_UNESTABLISHED"],RANK36:["COMMON_PEER_COMPARABILITY_AND_TRANSITIVITY_UNESTABLISHED"],RANK37:["FOLLOWUP_SCOPE_AND_PEER_STRENGTH_UNESTABLISHED"],RANK67:["CURRENT_GEOMETRY_ONLY_NOT_PHYSICAL_FEASIBILITY"]};
 const currentFields=new Set(["conditions","course_geometry","weight"]);
 for(const runner of packet.runners){
  const relevant=output.events.filter(x=>x.event_role==="HISTORICAL_RACE"&&x.rows.some(y=>y.subject_id===runner.id));
  const current=output.events.find(x=>x.event_role==="CURRENT_CARD");
  const result={id:runner.id,no:runner.no,status:runner.status,items:[]};
  for(const item of runner.items){
   const available=new Set(item.evidence_ids||[]),unavailable=new Set(item.unavailable_field_ids||[]);const deps=[],reasons=[];
   if(runner.status!=="ACTIVE"){result.items.push({item:item.item,parent_state:item.state,material_state:"NOT_APPLICABLE",observation_status:"NOT_APPLICABLE",analysis_sufficient:false,available_refs:[],unavailable_refs:[],dependencies:[],reasons:["NOT_ACTIVE"]});continue;}
   for(const ev of relevant){
    const row=ev.rows.find(y=>y.subject_id===runner.id);const rowrefs=row.observations,ls=[];
    for(const name of req[item.item]||[]){
     let f=name==="historical_field_count"?extMap.get(ev.field_count_ref):name==="conditions"?states.get(ev.conditions.condition_ref):name==="course_geometry"?states.get(ev.conditions.geometry_ref):name==="race_leader_laps"?field(ev.event_id,null,name):states.get(rowrefs.find(z=>z.role===name)?.ref);
     const rr=ref(f,name);if(f?.state==="TEST_INPUT_AVAILABLE")available.add(f.evidence_id);else if(f)unavailable.add(f.evidence_id);ls.push(rr);
    }
    if(ls.length)deps.push({scope:"HISTORICAL_RACE",event_id:ev.event_id,fields:ls,complete_for_declared_fields:ls.every(z=>z.state==="TEST_INPUT_AVAILABLE")});
   }
   if(req[item.item]&&!narrow.has(item.item)&&["RANK43","RANK44","RANK45","RANK47","RANK48","RANK49","RANK50","RANK51","RANK52","RANK54","RANK67"].includes(item.item)){
    const rr=req[item.item].filter(x=>currentFields.has(x)).map(name=>{const f=name==="conditions"?states.get(current.conditions.condition_ref):name==="course_geometry"?states.get(current.conditions.geometry_ref):field(current.event_id,runner.id,name);if(f?.state==="TEST_INPUT_AVAILABLE")available.add(f.evidence_id);else if(f)unavailable.add(f.evidence_id);return ref(f,name)});
    deps.push({scope:"CURRENT_CARD",event_id:current.event_id,fields:rr,complete_for_declared_fields:rr.length>0&&rr.every(z=>z.state==="TEST_INPUT_AVAILABLE")});
   }
   // Existing item routes remain authoritative only for availability; supplementation adds context, not a positive decision.
   const missing=deps.flatMap(x=>x.fields.filter(z=>z.state!=="TEST_INPUT_AVAILABLE").map(z=>({event_id:x.event_id,...z})));
   if(item.reason)reasons.push(item.reason);
   if(missing.length)reasons.push("DEPENDENT_OR_SIBLING_FIELDS_UNAVAILABLE");
   if(req[item.item])reasons.push(...(needed[item.item]||["COMPARATIVE_CONDITION_RESPONSE_UNESTABLISHED"]));
   else reasons.push("CANONICAL_ANALYSIS_INPUT_MAPPING_NOT_IMPLEMENTED");
   const ownObs=deps.filter(x=>x.scope==="HISTORICAL_RACE"),obsComplete=narrow.has(item.item)&&ownObs.length>0&&ownObs.every(x=>x.complete_for_declared_fields);
   const materialState=available.size?(missing.length?"PARTIAL_WITH_UNAVAILABLE_DEPENDENCIES":"PARTIAL_MATERIAL"):item.state;
   const observationStatus=obsComplete?"COMPLETE_FOR_DECLARED_HISTORICAL_OBSERVATION_ONLY":available.size?"PARTIAL_CONTEXT":item.state;
   result.items.push({item:item.item,parent_state:item.state,material_state:materialState,observation_status:observationStatus,analysis_sufficient:false,available_refs:[...available],unavailable_refs:[...unavailable],dependencies:deps,missing_dependencies:missing,reasons:[...new Set(reasons)]});
  }
  output.runners.push(result);
 }
 const all=new Map([...states,...extMap]);for(const r of output.runners){must(r.items.length===115,"ITEM_COUNT");for(const i of r.items){must(i.available_refs.every(k=>all.get(k)?.state==="TEST_INPUT_AVAILABLE")&&i.unavailable_refs.every(k=>all.has(k)&&all.get(k).state!=="TEST_INPUT_AVAILABLE"),"ITEM_REF");}}
 for(const e of output.extensions){must(e.value===null||canon(ptr(raw,e.pointer))===canon(e.value),"EXT_POINTER");must(e.depends_on.every(k=>states.has(k)),"EXT_DEPENDENCY");}
 return output;
}
export { work24 };

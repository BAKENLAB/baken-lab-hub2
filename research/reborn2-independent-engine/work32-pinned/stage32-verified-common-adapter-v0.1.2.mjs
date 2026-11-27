// Work32 verified synthetic intake. The pinned input file hash includes final LF; packet digest is JSON.stringify(packet) without LF.
export const BUNDLE_SHA256="befda1231124e5c9aef088659436077c5c9027c7301ff66d29e6ae8827b1af69";
export const PRODUCER_SHA256="2d1a8a6c6d6f15504a660478f60a626d47ec3ec6dee8a94175b82e920dd7fa23";
function verify32(bundleText,n,candidate,sha,pipeline,verifier,expectedBundleSha){
 const fail=r=>({state:"REJECTED",reason:r,pack:null,formal:false});
 try{
 if(typeof bundleText!=="string"||!bundleText.endsWith("\n")||sha(bundleText)!==expectedBundleSha)return fail("PINNED_BUNDLE_BYTES");
 const b=JSON.parse(bundleText),matches=b.cases.filter(x=>x.n===n);
 if(b.scope!=="SYNTHETIC_ONLY"||matches.length!==1||b.canonical.length!==115||new Set(b.canonical.map(x=>x.item)).size!==115)return fail("BUNDLE_SCHEMA");
 const q=matches[0],replayed=pipeline(q.input,q.registry,b.canonical,sha,verifier);
 if(replayed.state!=="TEST_PACKET"||replayed.digest!==q.expectedDigest||sha(JSON.stringify(replayed.packet))!==q.expectedDigest)return fail("REPLAY_OR_DIGEST");
 if(!candidate||JSON.stringify(candidate)!==JSON.stringify(replayed))return fail("COMPLETE_ENVELOPE_MISMATCH");
 const p=replayed.packet,ids=new Map(p.evidence.map(e=>[e.evidenceId,e]));if(p.schema!=="WORK32_TYPED_SYNTHETIC_0.1"||p.scope!=="SYNTHETIC_ONLY_NEVER_OFFICIAL"||p.formal_admissions!==0||p.benchmark_admissions!==0||p.scoring_authorized!==false||ids.size!==p.evidence.length||new Set(p.evidence.map(e=>e.root)).size!==ids.size)return fail("SCOPE_OR_UNIQUENESS");
 const done=new Set();const visit=(id,stack=new Set())=>{if(stack.has(id)||!ids.has(id))return false;if(done.has(id))return true;const e=ids.get(id);if(e.formal!==false||!Array.isArray(e.dependencies)||!e.dependencies.every(d=>visit(d,new Set([...stack,id]))))return false;done.add(id);return true};
 if(!p.evidence.every(e=>visit(e.evidenceId))||!p.runners.every(r=>r.items.length===115&&r.items.every((i,j)=>i.item===b.canonical[j].item&&i.name===b.canonical[j].name&&i.refs.every(d=>ids.has(d)))))return fail("DEPENDENCIES");
 if(!p.allPairs.every(x=>ids.get(x.ref)?.field==="historical_pair")||!p.followups.every(x=>ids.get(x.ref)?.field==="peer_followup")||!p.common.every(x=>x.refs.every(d=>ids.has(d))))return fail("RELATION_REFS");
 const docs=q.input.documents.map(d=>({doc:d,x:JSON.parse(String.fromCharCode(...d.bytes))}));
 return {state:"VERIFIED_SYNTHETIC_ENVELOPE",packet:p,raw:docs,canonical:b.canonical,digest:replayed.digest,formal:false};
 }catch(e){return fail("MALFORMED_OR_REPLAY_FAILURE")}
}
function adapt32(verified,sha){
 if(verified.state!=="VERIFIED_SYNTHETIC_ENVELOPE"||verified.formal!==false)throw Error("VERIFIED_ONLY");
 const p=verified.packet,ev=p.evidence,lookup=new Map(ev.map(e=>[e.evidenceId,e])),issuer=p.issuer,ns=h=>issuer+"|"+h,event=h=>ns(h),E=[],aliases=new Map(),unique=new Set();
 const add=e=>{if(unique.has(e.evidence_id))throw Error("ADAPTER_DUP");unique.add(e.evidence_id);E.push(e);return e};
 // Original typed evidence remains traceable. Separate source namespace avoids implicit identity dependency cycles.
 for(const x of ev)add({evidence_id:x.evidenceId,event_id:event(x.event),subject_id:null,field:"SOURCE:"+x.evidenceId,value:x.value,root:x.root,pointer:x.event+":"+x.pointer,state:"SYNTHETIC_OBSERVATION",formal_usable:false,source_sha256:x.receipt.digest,depends_on:x.dependencies,typed_source:x});
 const source=(evId,h,f)=>ev.find(e=>e.event===evId&&e.subject===h&&e.field===f);
 const alias=(evId,h,field,value,refs,pointer,extra={})=>{if(!refs.length||refs.some(r=>!lookup.has(r)))throw Error("SOURCE_REF");const root=JSON.stringify([issuer,evId,h,field,"COMMON_ALIAS"]),eid=sha(JSON.stringify([root,refs,value,pointer]));const x=add({evidence_id:eid,event_id:event(evId),subject_id:h===null?null:ns(h),field,value,root,pointer:evId+":"+pointer,state:"SYNTHETIC_OBSERVATION",formal_usable:false,source_sha256:lookup.get(refs[0]).receipt.digest,depends_on:[...new Set(refs)],...extra});aliases.set(JSON.stringify([evId,h,field]),x);return x};
 const rows=(doc,isTarget)=>{const x=doc.x,hist=p.histories.find(z=>z.event===x.eventId),cls=hist?.classification,conflict=new Set(p.conflicts.filter(z=>z.event===x.eventId).flatMap(z=>[z.a,z.b]));
 // The common analyzer currently lacks tied-rank support; leave tied finish values outside its rank kernel.
 const classification=cls&&lookup.get(cls),tied=classification?.value.some(r=>r.status==="DEAD_HEAT");
 return x.rows.map((r,i)=>{const h=r.nativeId,rr=source(x.eventId,h,isTarget?"current_card_row":"historical_row"),ref=rr.evidenceId,ptr="/rows/"+i;
 const ident=alias(x.eventId,h,"id",ns(h),[ref],ptr+"/nativeId",{native_id:h}),status=alias(x.eventId,h,"status",r.status,[ref],ptr+"/status"),no=alias(x.eventId,h,"horse_number",r.no,[ref],ptr+"/no");
 const g=source(x.eventId,h,"gate_number"),w=source(x.eventId,h,"weight_grams");
 const gate=g?alias(x.eventId,h,"gate_number",g.value,[g.evidenceId],g.pointer):null,weight=w?alias(x.eventId,h,"weight_grams",w.value,[w.evidenceId],w.pointer):null;
 if(!isTarget&&r.status==="FINISHED"){
 const f=source(x.eventId,h,"finish"),c=source(x.eventId,h,"finish_clock"),last=source(x.eventId,h,"individual_final600"),cp=source(x.eventId,h,"checkpoint_ms"),rank=source(x.eventId,h,"ranks");
 if(f&&cls&&!tied)alias(x.eventId,h,"finish",f.value,[f.evidenceId,cls],f.pointer);
 if(!conflict.has(h)){if(c)alias(x.eventId,h,"finish_ms",c.value,[c.evidenceId],c.pointer);if(last)alias(x.eventId,h,"final600_ms",last.value,[last.evidenceId],last.pointer);if(cp)alias(x.eventId,h,"checkpoint_ms",cp.value,[cp.evidenceId],cp.pointer);}
 if(rank)alias(x.eventId,h,"ranks",rank.value,[rank.evidenceId],rank.pointer);
 }
 return {id:ns(h),identity_ref:ident.evidence_id,horse_number:no,gate_number:gate,weight,margin:{winner_pointer:null}};
 });};
 const all=verified.raw.map(doc=>{const x=doc.x,isTarget=x.kind==="TARGET_CARD",rs=rows(doc,isTarget),c=source(x.eventId,null,"conditions"),g=source(x.eventId,null,"geometry");
 const conditions=c?alias(x.eventId,null,"conditions",c.value,[c.evidenceId],c.pointer):null,geometry=g?alias(x.eventId,null,"geometry",g.value,[g.evidenceId],g.pointer):null;
 const rowRefs=x.rows.map(r=>source(x.eventId,r.nativeId,isTarget?"current_card_row":"historical_row").evidenceId);
 const counts=isTarget?{registered_count:alias(x.eventId,null,"registered_count",x.rows.length,rowRefs,"/rows"),declared_active_count:alias(x.eventId,null,"declared_active_count",x.rows.filter(r=>r.status==="ACTIVE").length,rowRefs,"/rows"),actual_starters:null}:{actual_starters:alias(x.eventId,null,"actual_starters",x.actualStarters,rowRefs,"/actualStarters")};
 if(!isTarget){const lap=source(x.eventId,null,"race_leader_laps");if(lap){let t=0;alias(x.eventId,null,"leader_crossings",{elapsed_ms:[0,...lap.value.map(v=>t+=v)],distances_m:lap.measurement.boundariesM,uncertainty_ms:x.precisionMs,scope:"RACE_LEADER_EXPLICIT_REPORTED_CLOCK"},[lap.evidenceId],lap.pointer);}
 const winner=x.rows.filter(r=>r.finish===1&&r.status==="FINISHED");if(winner.length===1){const w=aliases.get(JSON.stringify([x.eventId,winner[0].nativeId,"finish_ms"]));if(w)rs.forEach(r=>r.margin.winner_pointer=w.pointer);}
 }
 return {event_id:event(x.eventId),event_at:x.eventAt??null,rows:rs,conditions,geometry,relative:[],...counts};
 });
 const target=all.find(x=>x.event_id===event(p.targetId)),hist=all.filter(x=>x!==target).sort((a,b)=>a.event_at-b.event_at);
 const active=p.runners.filter(r=>r.status==="ACTIVE").map(r=>ns(r.nativeId)),followups=p.followups.map(f=>({subject:ns(f.subject),opponent:ns(f.peer),reference_event:event(f.priorEvent),followup_event:event(f.laterEvent),source_ref:f.ref}));
 const precision=verified.raw.filter(x=>x.x.kind==="HISTORICAL_RESULT").map(x=>x.x.precisionMs);
 if(!precision.length||new Set(precision).size!==1)throw Error("MIXED_MEASUREMENT_BOUND_NOT_SUPPORTED");
 return {r:{scope:"WORK32_VERIFIED_SYNTHETIC_ONLY",cutoff:p.cutoff,measurement:{checkpoint_scope:"COURSE_DISTANCE_CROSSING_ELAPSED_FROM_COMMON_START",clock_uncertainty_ms:precision[0],snapshot_uncertainty_m:null}},o:{events:[target,...hist],evidence:E,followups,active_ids:active},f:{active_ids:active,pairs:[]},packet:p,aliases:[...aliases.entries()].map(([key,value])=>({key,id:value.evidence_id}))};
}
function consume32(bundleText,n,candidate,sha,pipeline,verifier,analyze,withdraw=null,options={}){
 const v=verify32(bundleText,n,candidate,sha,pipeline,verifier,BUNDLE_SHA256);
 if(v.state!=="VERIFIED_SYNTHETIC_ENVELOPE")return v;
 try{
 const pack=adapt32(v,sha),all=new Map(pack.o.evidence.map(e=>[e.evidence_id,e]));
 if(withdraw!==null&&!all.has(withdraw))return {state:"REJECTED",reason:"UNKNOWN_WITHDRAWAL",formal:false};
 const ok=(id,seen=new Set())=>{const e=all.get(id);return !!e&&id!==withdraw&&!seen.has(id)&&e.depends_on.every(d=>ok(d,new Set([...seen,id])))};
 pack.o.followups=pack.o.followups.filter(x=>ok(x.source_ref));
 const name="WORK32_"+n,L={cases:new Map([[name,pack]]),canonical:v.canonical,work30:new Map(),work27:new Map()};
 const result=analyze(L,name,withdraw,options);
 return {state:"COMMON_ANALYZER_EXECUTED",pack,L,result,formal:false};
 }catch(e){return {state:"REJECTED",reason:"ADAPTER_OR_ANALYZER:"+String(e?.message||e),formal:false}}
}
export {consume32};

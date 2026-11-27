/* Work35: evidence supply and exact shared research circuit invocation; synthetic only. */
function fixtures35(raw){
 const clone=x=>JSON.parse(JSON.stringify(x)),full=raw.fixtures.find(x=>x.id==="FK34_FULL"),ns="TEST:NAR|";
 const missing=clone(full);missing.id="FK35_ACTIVE_MISSING";for(const d of missing.docs.filter(d=>d.kind==="HISTORICAL_RESULT")){const r=d.rows[4];for(const k of ["checkpointMs","checkpointRanks","clockMs","final600Ms","finish","officialMargin"])r[k]=null;d.leaderLaps=null;d.passing=null;}
 // Keep the original historical classification for the other horses in a second, more local missingness experiment.
 const local=clone(full);local.id="FK35_ACTIVE_NO_CHECKPOINT";for(const d of local.docs.filter(d=>d.kind==="HISTORICAL_RESULT")){d.rows[4].checkpointMs=null;d.rows[4].checkpointRanks=null;}
 const context=clone(full);context.id="FK35_CONTEXT_CHANGE";const t=context.docs[0];t.conditions.going="TEST:SOFT";t.rows[0].weightG=57000;t.geometry.straight_m=350;t.geometry.course_version="TEST:COURSE_A2";
 // One observed synthetic historical context matches new card, not proof of isolated effects.
 const past=context.docs.find(d=>d.eventId==="TEST:CONTEST");past.conditions.going=t.conditions.going;past.rows[0].weightG=57000;past.geometry.straight_m=350;past.geometry.course_version=t.geometry.course_version;
 const eye=clone(full);eye.id="FK35_EYE"; // new, independent stipulated history; H4 actually loses to H2 in COUNTER, reverses in this event.
 const d=clone(eye.docs.find(d=>d.eventId==="TEST:RECOVERY_A"));d.eventId="TEST:DISCOVERED";d.eventAt=62;d.publishedAt=63;d.updatedAt=64;
 const clocks=[[12500,49300,74400,86400],[11700,48000,73300,85800],[13700,50500,75000,87000],[12300,50200,73900,84900],[11900,48200,75700,89000]];
 const set=(d,clocks)=>{for(let i=0;i<5;i++){const r=d.rows[i];r.checkpointMs=clocks[i].slice(0,3);r.clockMs=clocks[i][3];r.final600Ms=r.clockMs-r.checkpointMs[1];}
 const rank=(r,k)=>[...d.rows].sort((a,b)=>k(a)-k(b)).indexOf(r)+1;
 for(const r of d.rows){r.finish=rank(r,x=>x.clockMs);r.checkpointRanks=[0,1,2].map(j=>rank(r,x=>x.checkpointMs[j]));r.officialMargin=r.finish===1?null:"TEST_LITERAL";}
 const elapsed=[0,...[0,1,2].map(j=>Math.min(...d.rows.map(r=>r.checkpointMs[j]))),Math.min(...d.rows.map(r=>r.clockMs))];d.leaderLaps.valuesMs=elapsed.slice(1).map((x,i)=>x-elapsed[i]);d.passing.groups=[...d.rows].sort((a,b)=>a.checkpointMs[0]-b.checkpointMs[0]).map(r=>[r.no]);};
 set(d,clocks);eye.docs.push(d);
 // BASE vs added evidence is same target and prior observations; new event is explicitly a distinct source, not merely removing a counter.
 const adverse=clone(eye);adverse.id="FK35_EYE_COUNTER";const c=clone(d);c.eventId="TEST:NEW_COUNTER";c.eventAt=66;c.publishedAt=67;c.updatedAt=68;
 set(c,[[12500,49300,74400,86400],[11700,48000,73300,85000],[13700,50500,75000,87000],[12300,50200,76600,89000],[11900,48200,75700,87500]]);adverse.docs.push(c);
 return [missing,local,context,eye,adverse];
}
function branches35(f){
 const ns="TEST:NAR|",ids=[1,2,3,4,5].map(n=>ns+"TEST:H"+n);
 const starts=(xs)=>Object.fromEntries(xs.flatMap((x,i)=>x===null?[]:[[ids[i],[x-50,x+50]]]));
 // Explicit hypothetical 800m elapsed intervals, not current measurements; order close to observed historical role, different absolute values and gaps.
 const a=[49250,47850,50650,51150,48100],b=[49500,48100,50800,51300,48400],c=[49000,48200,50600,51000,47900],solo=[49400,48000,50700,51100,48400];
 const event=x=>ns+"TEST:"+x;
 return [
 {id:"ALPHA_H5_NEAR_H2",checkpoint_m:800,response_event:event("CONTEST"),starts:starts(a)},
 {id:"ALPHA_CHANGED_DEFICIT",checkpoint_m:800,response_event:event("CONTEST"),starts:starts(b)},
 {id:"BETA_H2_LEADS",checkpoint_m:800,response_event:event("LONE"),starts:starts(solo)},
 {id:"GAMMA_H5_LEADS",checkpoint_m:800,response_event:event("CONTEST"),starts:starts(c)},
 {id:"SAME_START_COUNTER_RESPONSE",checkpoint_m:800,response_event:event("COUNTER"),starts:starts(a)},
 {id:"H5_START_MISSING",checkpoint_m:800,response_event:event("CONTEST"),starts:starts([...a.slice(0,4),null])},
 ...(["FK35_EYE","FK35_EYE_COUNTER"].includes(f.id)?[{id:"NEW_RESPONSE_SAME_START",checkpoint_m:800,response_event:event("DISCOVERED"),starts:starts(a)}]:[]),
 ...(f.id==="FK35_EYE_COUNTER"?[{id:"NEW_COUNTER_SAME_START",checkpoint_m:800,response_event:event("NEW_COUNTER"),starts:starts(a)}]:[])
 ].filter(b=>f.docs.some(d=>ns+d.eventId===b.response_event));
}
function run35({raw,independent,canonical,sha,producer,adapter,v34,v35,variantsOnly=false,caseIds=null}){
 const checkList=[],check=(name,ok)=>{checkList.push({name,pass:!!ok});if(!ok)throw Error(name)};
 const fixtures=(variantsOnly?fixtures35(raw):raw.fixtures).filter(f=>!caseIds||caseIds.includes(f.id));
 const results=[];
 for(const f of fixtures){
 const {input,registry,out}=producer.run31(f.docs,canonical,sha);
 check(f.id+":PACKET",out.state==="TEST_PACKET"&&out.digest===sha(JSON.stringify(out.packet)));
 const q={n:f.id,input,registry,expectedDigest:out.digest},txt=JSON.stringify({scope:"SYNTHETIC_ONLY",canonical,cases:[q]})+"\n",bundle_sha256=sha(txt);
 const stored=independent.cases.find(x=>x.id===f.id);
 if(!variantsOnly)check(f.id+":INDEPENDENT_DIGEST",stored&&stored.source_digest===out.digest&&stored.bundle_sha256===bundle_sha256&&stored.evidence===out.packet.evidence.length);
 const verified=adapter.verify32(txt,f.id,out,sha,producer.pipeline31,producer.verifier31,bundle_sha256);
 check(f.id+":VERIFIED",verified.state==="VERIFIED_SYNTHETIC_ENVELOPE");
 const altered=JSON.parse(JSON.stringify(out));altered.packet.evidence[0].value.no=999;altered.digest=sha(JSON.stringify(altered.packet));
 check(f.id+":REHASH_REJECTED",adapter.verify32(txt,f.id,altered,sha,producer.pipeline31,producer.verifier31,bundle_sha256).state==="REJECTED");
 const pin={source_digest:stored?.source_digest??out.digest,bundle_sha256:stored?.bundle_sha256??bundle_sha256,blob:independent.rawBlob},C={canonical,fixtures:[f],receipt:{summary:[{id:f.id,evidence:out.packet.evidence.length,itemRows:out.packet.runners.length*115}]},verify32:adapter.verify32,adapt32:adapter.adapt32};
 const V={C,fixed:new Map([[f.id,{raw:{raw:f.docs},pin}]])};
 const b=branches35(f),a=v34.analyzeV34(V,f.id,{eyeEnabled:true,placeThreshold:2}),z=v35.analyzeV35(V,f.id,{eyeEnabled:true,placeThreshold:2,branches:b}),base=v35.analyzeV35(V,f.id,{eyeEnabled:false,placeThreshold:2,branches:b});
 check(f.id+":COMMON_V35",z.runners.length===5&&z.runners.every(h=>h.items.length===115&&h.axes.length===5&&h.grade===null)&&z.formal===false&&z.groups===118&&z.held===826);
 check(f.id+":SHARED_FIELD",z.roster.possible_active.length===5&&z.conditional_scenarios.every(s=>s.edges.length===10&&!s.prediction&&s.actual_current_applicability==="UNPROVEN"));
 check(f.id+":NO_CURRENT_MEASUREMENT",z.conditional_scenarios.every(s=>s.observed_current_pace===false));
 const compact=x=>({grades:x.runners.map(h=>h.research_grade),roster:x.roster,feedback:x.feedback.map(f=>({id:f.id,state:f.state,counter:f.counter_refs.length,changed:f.changed})),paths:x.runners.map(h=>({slot:h.slot,status:h.status,grade:h.research_grade,formal:h.grade,paths:(h.conditional_paths_v35??[]).map(p=>({scenario:p.scenario,axes:p.axes,env:p.envelope,blocked:p.blocked,candidate:p.candidate,WIN:p.WIN,PLACE:p.PLACE})),eye:h.eye_reanalysis?.map(e=>({id:e.id,state:e.state,refs:e.refs}))})),scenarios:(x.conditional_scenarios??[]).map(s=>({id:s.id,comparable:s.comparable,roleConflicts:s.roleConflicts,complete:s.complete,valid:s.valid,edges:s.edges,envelopes:s.field.envelopes}))});
 const w=out.packet.evidence.find(e=>e.event==="TEST:DISCOVERED"&&e.subject==="TEST:H4"&&e.field==="checkpoint_ms")?.evidenceId;
 let withdraw=null;if(w){const zz=v35.analyzeV35(V,f.id,{withdraw:w,eyeEnabled:true,placeThreshold:2,branches:b});withdraw=compact(zz);check(f.id+":ROOT_WITHDRAWAL",zz.formal===false&&zz.conditional_scenarios.find(x=>x.id==="NEW_RESPONSE_SAME_START")?.comparable===false);}
 const same=z.conditional_scenarios.find(x=>x.id==="ALPHA_H5_NEAR_H2"),different=z.conditional_scenarios.find(x=>x.id==="ALPHA_CHANGED_DEFICIT");
 // No assertion that a mere uniform shift changes gaps.
 if(same?.comparable&&different?.comparable)check(f.id+":INDEPENDENT_START_CHANGE",JSON.stringify(same.edges.map(e=>e.interval_ms))!==JSON.stringify(different.edges.map(e=>e.interval_ms)));
 results.push({id:f.id,source_digest:out.digest,bundle_sha256,evidence:out.packet.evidence.length,itemRows:575,raw:f.docs,branches:b,v34:compact(a),v35:compact(z),eyeOff:compact(base),withdraw_id:w??null,withdraw});
 }
 return {checks:checkList,results};
}
export {fixtures35,branches35,run35};

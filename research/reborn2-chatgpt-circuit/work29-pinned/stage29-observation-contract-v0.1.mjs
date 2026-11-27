// Work29 synthetic trust simulation only. Not a real source verifier, no official intake, no group gate changes.
function candidateObservation(e,registry){
 const result=(state,reason,observations=[])=>({state,reason,observations,formal:false,benchmark_admission:false,score_authorized:false});
 const held=r=>result("HELD",r),bad=r=>result("REJECTED",r),missing=r=>result("MISSING",r);
 const num=Number.isSafeInteger,exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 if(registry?.scope!=="SYNTHETIC_TRUST_SIMULATION_ONLY"||e?.scope!=="SYNTHETIC_OBSERVATION_TEST_ONLY")return held("OFFICIAL_PATH_DISABLED");
 if(!e.record||!e.target||!e.observation||!e.subject)return bad("ENVELOPE");
 const {record:s,target:t,observation:o,subject:p}=e;
 const fields=["finish","finish_clock","individual_final600","individual_intermediate_clock","race_leader_laps","passing_order","historical_peer_result","peer_followup"];
 if(!fields.includes(o.field)||s.eventId===t.id)return bad("TARGET_OR_UNSUPPORTED_FIELD");
 if(![s.eventAt,s.publishedAt,s.updatedAt,s.captureStart,s.captureEnd,s.sealAt,s.uncertainty,t.cutoff,t.post,t.analysisAt,t.processingAt].every(num))return held("TIME_MISSING");
 if(!(s.eventAt<s.publishedAt&&s.publishedAt<=s.updatedAt&&s.updatedAt<=s.captureStart&&s.captureStart<=s.captureEnd&&s.captureEnd<=s.sealAt&&s.uncertainty>=0&&s.sealAt+s.uncertainty<=t.cutoff&&t.cutoff<t.post&&t.cutoff<=t.analysisAt&&t.analysisAt<=t.processingAt))return held("ASOF_TIME");
 if(t.mode==="PROSPECTIVE"&&t.analysisAt>=t.post||!["PROSPECTIVE","REPLAY"].includes(t.mode))return held("ANALYSIS_MODE");
 const trusted=registry.records.filter(x=>x.recordId===s.recordId);
 if(trusted.length!==1||!exact(trusted[0],s)||!s.originalDigest||!s.authorityReceipt||!s.timestampReceipt||!s.hashDomain||!s.parserVersion||!s.rowPointer)return held("SOURCE_BINDING");
 const versions=registry.versions.filter(v=>v.eventId===s.eventId&&v.sourceId===s.sourceId);
 if(!registry.inventoryComplete||!versions.length||new Set(versions.map(v=>v.version)).size!==versions.length||versions.some(v=>!num(v.publishedAt)||!num(v.updatedAt)||v.publishedAt>v.updatedAt||!num(v.version)))return held("VERSION_INVENTORY");
 const sorted=[...versions].sort((a,b)=>a.version-b.version);
 if(sorted.some((v,i)=>i>0&&(v.version!==sorted[i-1].version+1||v.publishedAt<sorted[i-1].publishedAt||v.updatedAt<sorted[i-1].updatedAt||v.previousVersion!==sorted[i-1].version)))return held("CORRECTION_CHAIN");
 const selected=sorted.filter(v=>v.publishedAt<=t.cutoff&&v.updatedAt<=t.cutoff).at(-1);
 if(!selected||selected.version!==s.version||selected.publishedAt!==s.publishedAt||selected.updatedAt!==s.updatedAt||selected.digest!==s.originalDigest)return held("LATEST_ASOF_VERSION");
 const rights=registry.rights.filter(r=>r.sourceId===s.sourceId&&r.rightsId===s.rightsId);
 if(rights.length!==1||!registry.latestRightsComplete)return held("RIGHTS_INVENTORY");
 const r=rights[0],valid=(purpose,a,b)=>r.purposes.includes(purpose)&&num(r.validFrom)&&num(r.validUntil)&&r.validFrom<=a&&b<r.validUntil&&(r.revokedAt===null||num(r.revokedAt)&&b<r.revokedAt);
 if(!valid("ACQUIRE",s.captureStart,s.captureEnd)||!valid("RETAIN",s.captureEnd,t.processingAt)||!valid("AI_PROCESS",t.processingAt,t.processingAt))return held("RIGHTS_TIME_OR_PURPOSE");
 if(t.releaseAt!==null&&(!num(t.releaseAt)||t.releaseAt<t.processingAt||!valid("DERIVED_RELEASE",t.releaseAt,t.releaseAt)))return held("RELEASE_RIGHTS");
 const native=registry.identities.filter(x=>x.eventId===s.eventId&&x.issuer===s.issuer&&x.rowId===p.rowId);
 if(native.length!==1||native[0].nativeId!==p.nativeId||native[0].runnerNo!==p.runnerNo||p.nativeId!==s.nativeId||p.rowId!==s.rowId||p.issuer!==s.issuer||o.subjectId!==p.nativeId||native[0].rowPointer!==s.rowPointer)return held("NATIVE_IDENTITY_BINDING");
 const target=registry.rosters.filter(x=>x.targetId===t.id&&x.issuer===t.issuer&&x.runnerNo===p.targetRunnerNo);
 if(target.length!==1||target[0].nativeId!==p.targetNativeId||target[0].status!=="ACTIVE"||!num(target[0].observedAt)||target[0].observedAt>t.cutoff)return held("TARGET_ROSTER_BINDING");
 if(p.issuer===t.issuer){if(p.nativeId!==p.targetNativeId)return held("SAME_ISSUER_ID_MISMATCH");}
 else{const cw=registry.crosswalks.filter(x=>x.fromIssuer===p.issuer&&x.fromId===p.nativeId&&x.toIssuer===t.issuer&&x.toId===p.targetNativeId&&x.validFrom<=s.eventAt&&x.validUntil>t.cutoff&&x.publishedAt<=t.cutoff&&x.authorityReceipt);if(cw.length!==1)return held("CROSSWALK_REQUIRED");}
 const raw=registry.observations.filter(x=>x.recordId===s.recordId&&x.pointer===o.pointer);
 if(raw.length!==1||!exact(raw[0].observation,o))return held("RAW_FIELD_BINDING");
 const deps=[];
 if(["historical_peer_result","peer_followup"].includes(o.field)){
 const v=o.value;if(!v||v.subjectRowId!==s.rowId||!Array.isArray(v.peerRefs)||v.peerRefs.length!==(o.field==="peer_followup"?2:1))return bad("PEER_SHAPE");
 for(const ref of v.peerRefs){const pRows=registry.peerRows.filter(x=>x.ref===ref);if(pRows.length!==1)return held("PEER_REF_UNRESOLVED");const x=pRows[0];if(x.issuer!==s.issuer||x.nativeId!==v.peerNativeId||!x.sourceRoot||x.nativeId===s.nativeId||!num(x.eventAt)||!num(x.publishedAt)||!num(x.observedAt)||!(x.eventAt<x.publishedAt&&x.publishedAt<=x.observedAt&&x.observedAt<=t.cutoff)||!x.sourceReceipt||!x.rightsReceipt)return held("PEER_SCOPE_OR_TIME");deps.push(x);}
 if(deps[0].eventId!==s.eventId||deps[0].eventAt!==s.eventAt)return held("PEER_REFERENCE_EVENT");
 if(deps.length===2&&!(deps[0].eventAt<deps[1].eventAt&&deps[0].eventId!==deps[1].eventId))return held("PEER_FOLLOWUP_ORDER");
 }
 if(o.value===null)return missing("FIELD_NOT_SUPPLIED");
 if(o.field==="race_leader_laps"){
 if(o.unit!=="ms"||o.measurementScope!=="RACE_LEADER"||!Array.isArray(o.value)||!o.value.length||!Array.isArray(o.boundariesM)||o.boundariesM.length!==o.value.length+1||o.boundariesM[0]!==0||o.boundariesM.at(-1)!==o.distanceM||!num(o.distanceM)||o.value.some(x=>!num(x)||x<=0)||o.boundariesM.some((x,i)=>!num(x)||i>0&&x<=o.boundariesM[i-1]))return bad("LAP_UNIT_INTERVAL_SCOPE");
 }
 if(["finish_clock","individual_final600","individual_intermediate_clock"].includes(o.field)){
 if(o.unit!=="ms"||!num(o.value)||o.value<=0||o.measurementScope!=="INDIVIDUAL_NATIVE_EXPLICIT")return bad("INDIVIDUAL_CLOCK_SCOPE");
 if(o.field!=="finish_clock"&&(!num(o.fromM)||!num(o.toM)||o.fromM<0||o.toM<=o.fromM||!num(o.distanceM)||o.toM>o.distanceM||o.field==="individual_final600"&&(o.toM!==o.distanceM||o.toM-o.fromM!==600)))return bad("INDIVIDUAL_INTERVAL");
 }
 if(o.field==="finish"){if(!["FINISHED","DEAD_HEAT"].includes(o.status)||!num(o.value)||o.value<1||o.status==="DEAD_HEAT"&&!o.tieGroupId)return bad("FINISH_STATUS");}
 if(o.field==="passing_order"){if(o.semantics!=="SOURCE_GROUPED_ORDER"||!Array.isArray(o.value)||!o.value.length||o.value.some(g=>!Array.isArray(g)||!g.length||g.some(n=>!num(n)||n<1))||new Set(o.value.flat()).size!==o.value.flat().length)return bad("PASSING_GROUPS");}
 return result("TEST_OBSERVATION_ELIGIBLE","SYNTHETIC_ONLY_NOT_OFFICIAL",[{field:o.field,value:o.value,unit:o.unit??null,scope:o.measurementScope??o.semantics??null,root:[s.issuer,s.eventId,s.rowId,o.field].join("|"),version:s.version,sourceDigest:s.originalDigest,pointer:o.pointer,dependencies:deps.map(x=>x.sourceRoot),current_applicability:"UNDETERMINED",formal:false}]);
}
function fixture29(field="finish_clock"){
 const record={recordId:"TEST:REC1",eventId:"TEST:H",sourceId:"TEST:SOURCE",issuer:"TEST:JRA",nativeId:"TEST:A",rowId:"TEST:ROW1",rowPointer:"/rows/0",eventAt:10,publishedAt:20,updatedAt:21,captureStart:22,captureEnd:23,sealAt:24,uncertainty:1,originalDigest:"TEST_DIGEST",hashDomain:"TEST_RECEIVED_BYTES",parserVersion:"TEST:1",authorityReceipt:"TEST:AUTH",timestampReceipt:"TEST:STAMP",rightsId:"TEST:RIGHT",version:1};
 const observation={field,subjectId:"TEST:A",pointer:"/rows/0/"+field,value:60000,unit:"ms",measurementScope:"INDIVIDUAL_NATIVE_EXPLICIT"};
 if(field==="race_leader_laps")Object.assign(observation,{value:[20000,20000,20000],unit:"ms",measurementScope:"RACE_LEADER",boundariesM:[0,400,800,1200],distanceM:1200});
 if(field==="individual_intermediate_clock")Object.assign(observation,{fromM:200,toM:600,distanceM:1200});
 if(field==="individual_final600")Object.assign(observation,{fromM:600,toM:1200,distanceM:1200});
 if(field==="passing_order")Object.assign(observation,{value:[[1,2],[3]],semantics:"SOURCE_GROUPED_ORDER"});
 if(field==="finish")Object.assign(observation,{value:1,status:"FINISHED"});
 if(field==="peer_followup")Object.assign(observation,{value:{subjectRowId:"TEST:ROW1",peerNativeId:"TEST:B",peerRefs:["TEST:PEER1","TEST:PEER2"]},unit:null,measurementScope:null});
 const e={scope:"SYNTHETIC_OBSERVATION_TEST_ONLY",record,target:{id:"TEST:T",issuer:"TEST:JRA",cutoff:30,post:40,analysisAt:31,processingAt:31,releaseAt:null,mode:"PROSPECTIVE"},subject:{issuer:"TEST:JRA",nativeId:"TEST:A",rowId:"TEST:ROW1",runnerNo:1,targetNativeId:"TEST:A",targetRunnerNo:4},observation};
 const registry={scope:"SYNTHETIC_TRUST_SIMULATION_ONLY",inventoryComplete:true,latestRightsComplete:true,records:[JSON.parse(JSON.stringify(record))],versions:[{eventId:record.eventId,sourceId:record.sourceId,version:1,publishedAt:20,updatedAt:21,digest:record.originalDigest,previousVersion:null}],rights:[{sourceId:record.sourceId,rightsId:record.rightsId,purposes:["ACQUIRE","RETAIN","AI_PROCESS"],validFrom:0,validUntil:100,revokedAt:null}],identities:[{issuer:"TEST:JRA",eventId:record.eventId,rowId:record.rowId,nativeId:"TEST:A",runnerNo:1,rowPointer:record.rowPointer}],rosters:[{targetId:"TEST:T",issuer:"TEST:JRA",nativeId:"TEST:A",runnerNo:4,status:"ACTIVE",observedAt:29}],crosswalks:[],observations:[{recordId:record.recordId,pointer:observation.pointer,observation:JSON.parse(JSON.stringify(observation))}],peerRows:[{ref:"TEST:PEER1",issuer:"TEST:JRA",nativeId:"TEST:B",eventId:"TEST:H",eventAt:10,publishedAt:20,observedAt:22,sourceRoot:"TEST:B:H",sourceReceipt:"TEST:SOURCE1",rightsReceipt:"TEST:RIGHT1"},{ref:"TEST:PEER2",issuer:"TEST:JRA",nativeId:"TEST:B",eventId:"TEST:H2",eventAt:25,publishedAt:26,observedAt:27,sourceRoot:"TEST:B:H2",sourceReceipt:"TEST:SOURCE2",rightsReceipt:"TEST:RIGHT2"}]};
 return {e,registry};
}
export {candidateObservation,fixture29};

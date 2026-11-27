/* Work34 fixture and exact shared V34 research invocation; synthetic only. */
function make34(){
 const issuer="TEST:NAR",ids=["TEST:H1","TEST:H2","TEST:H3","TEST:H4","TEST:H5"],d=1400;
 const context={distance_m:d,surface:"DIRT",going:"TEST:GOOD",venue:"TEST:VENUE_A",class_label:"TEST:FIELD_CLASS",class_version:"TEST:CLASS_V1",effective_from:0,effective_until:120},geometry={direction:"RIGHT",first_turn_m:200,straight_m:300,checkpoints_m:[200,800,1200],course_version:"TEST:COURSE_A",effective_from:0,effective_until:120};
 const copy=x=>JSON.parse(JSON.stringify(x));
 const card={kind:"TARGET_CARD",issuer,eventId:"TEST:T",version:1,publishedAt:70,updatedAt:70,scheduledPost:100,conditions:copy(context),geometry:copy(geometry),rows:ids.map((nativeId,i)=>({nativeId,no:i+1,status:"ACTIVE",gate:i+1,weightG:55000}))};
 const profiles=[
 ["CONTEST",8,[[12600,49000,74200,86000],[11500,47500,73900,87900],[13500,50400,74900,86700],[12900,50600,75400,87200],[11600,47600,75200,89000]]],
 ["LONE",20,[[12700,49300,74200,86600],[11700,48200,72500,85200],[13700,50500,74700,86100],[13000,50900,75500,87100],[13300,51200,76800,89200]]],
 ["RECOVERY_A",32,[[12600,48900,74100,86200],[11700,47900,73800,87300],[13500,50500,74800,86800],[12100,51100,75100,85500],[11800,48000,76000,89300]]],
 ["RECOVERY_B",44,[[12700,49100,74300,86400],[11800,48000,74000,87500],[13600,50700,75000,87000],[12200,51300,75300,85700],[11900,48100,76200,89500]]],
 ["COUNTER",56,[[12600,49000,74300,86300],[11600,47900,73200,85100],[13600,50500,75000,86900],[12100,51000,76200,88400],[11700,48000,75800,89200]]]
 ];
 function race([id,eventAt,p]){
  const rows=ids.map((nativeId,i)=>({nativeId,no:i+1,status:"FINISHED",gate:i+1,weightG:55000,clockMs:p[i][3],final600Ms:p[i][3]-p[i][1],checkpointMs:p[i].slice(0,3)}));
  const rank=(r,key)=>[...rows].sort((a,b)=>key(a)-key(b)).indexOf(r)+1;
  for(const r of rows){r.finish=rank(r,q=>q.clockMs);r.checkpointRanks=[0,1,2].map(j=>rank(r,q=>q.checkpointMs[j]));r.officialMargin=r.finish===1?null:"TEST_LITERAL";}
  const elapsed=[0,...[0,1,2].map(j=>Math.min(...rows.map(r=>r.checkpointMs[j]))),Math.min(...rows.map(r=>r.clockMs))];
  return {kind:"HISTORICAL_RESULT",issuer,eventId:"TEST:"+id,eventAt,version:1,publishedAt:eventAt+1,updatedAt:eventAt+2,distanceM:d,registeredCount:5,actualStarters:5,precisionMs:50,rows,conditions:copy(context),geometry:copy(geometry),leaderLaps:{unit:"ms",scope:"RACE_LEADER",boundariesM:[0,...geometry.checkpoints_m,d],valuesMs:elapsed.slice(1).map((t,i)=>t-elapsed[i])},passing:{checkpointM:200,groups:[...rows].sort((a,b)=>a.checkpointMs[0]-b.checkpointMs[0]).map(r=>[r.no]),semantics:"SOURCE_GROUPED_ORDER"}};
 }
 const hist=profiles.map(race),negativeOnly=copy([card,hist[4]]),negativeRemoved=copy(negativeOnly);
 for(const k of ["checkpointMs","checkpointRanks","clockMs","final600Ms","finish","officialMargin"])negativeRemoved[1].rows[3][k]=null;
 const unknown=copy([card,...hist]);unknown[0].rows[4].status="UNKNOWN";
 return [{id:"FK34_FULL",docs:[card,...hist]},{id:"FK34_DISCOVERY",docs:copy([card,...hist.slice(0,4)])},{id:"FK34_UNKNOWN",docs:unknown},{id:"FK34_NEGATIVE_ONLY",docs:negativeOnly},{id:"FK34_NEGATIVE_REMOVED",docs:negativeRemoved}];
}
function run34({fixtures,canonical,sha,producer,adapter,core}){
 const results=[],checks=[],check=(name,p)=>{checks.push({name,pass:!!p});if(!p)throw Error(name)};
 for(const f of fixtures){
 const {input,registry,out}=producer.run31(f.docs,canonical,sha);check(f.id+":PACKET",out.state==="TEST_PACKET"&&sha(JSON.stringify(out.packet))===out.digest);
 const q={n:f.id,input,registry,expectedDigest:out.digest},text=JSON.stringify({scope:"SYNTHETIC_ONLY",canonical,cases:[q]})+"\n",bundle_sha256=sha(text);
 const v=adapter.verify32(text,f.id,out,sha,producer.pipeline31,producer.verifier31,bundle_sha256);check(f.id+":VERIFIED",v.state==="VERIFIED_SYNTHETIC_ENVELOPE");
 const tampered=JSON.parse(JSON.stringify(out));tampered.packet.evidence[0].value.no=99;tampered.digest=sha(JSON.stringify(tampered.packet));check(f.id+":REHASH_REJECTED",adapter.verify32(text,f.id,tampered,sha,producer.pipeline31,producer.verifier31,bundle_sha256).state==="REJECTED");
 const pin={source_digest:out.digest,bundle_sha256,blob:null},C={canonical,fixtures:[f],receipt:{summary:[{id:f.id,evidence:out.packet.evidence.length,itemRows:out.packet.runners.length*115}]},verify32:adapter.verify32,adapt32:adapter.adapt32};
 const V={C,fixed:new Map([[f.id,{raw:{raw:f.docs},pin}]])};
 const before=core.analyzeV34(V,f.id,{eyeEnabled:false,placeThreshold:2}),after=core.analyzeV34(V,f.id,{eyeEnabled:true,placeThreshold:2});
 check(f.id+":COMMON_V34",after.runners.length===5&&after.runners.every(h=>h.items.length===115&&h.axes.length===5&&h.grade===null)&&after.groups===118&&after.held===826&&after.formal===false);
 check(f.id+":BASELINE_STABLE",JSON.stringify(before.scenarios)===JSON.stringify(after.scenarios.filter(s=>s.kind==="OBSERVED_FIELD_RESPONSE_SCENARIO")));
 check(f.id+":FULL_FIELD",after.roster.possible_active.length===5&&after.scenarios.every(s=>s.edges.length===10&&!s.prediction));
 const withdraw=out.packet.evidence.find(e=>e.event==="TEST:RECOVERY_B"&&e.subject==="TEST:H4"&&e.field==="checkpoint_ms")?.evidenceId;
 let withdrawn=null;if(withdraw){withdrawn=core.analyzeV34(V,f.id,{withdraw,eyeEnabled:true,placeThreshold:2});check(f.id+":WITHDRAW_REPLAY",withdrawn.formal===false&&withdrawn.runners.length===5);}
 const brief=x=>({roster:x.roster,runners:x.runners.map(h=>({slot:h.slot,status:h.status,identity_known:h.identity_known,candidate:h.research_grade,reason:h.research_reason,axes:h.axes.map(a=>({axis:a.axis,state:a.state,support:a.research_support?.length,counter:a.research_counter?.length})),win:h.WIN?.comparable_paths?.map(z=>({event:z.event,min:z.envelope.min,max:z.envelope.max})),place:h.PLACE?.comparable_paths?.map(z=>({event:z.event,min:z.envelope.min,max:z.envelope.max})),discovery:h.WIN?.discovery_paths?.map(z=>({id:z.id,state:z.state,min:z.envelope?.min,max:z.envelope?.max})),grade:h.grade})),scenarios:x.scenarios.map(s=>({id:s.id,event:s.event,checkpoint_m:s.checkpoint_m,kind:s.kind,applicability:s.applicability,valid:s.valid,edges:s.edges.map(e=>({a:e.a,b:e.b,order:e.order,interval_ms:e.interval_ms})),envelopes:s.field.envelopes.map(z=>({slot:z.slot,min:z.min,max:z.max}))})),feedback:x.feedback.map(z=>({id:z.id,subject:z.subject,rival:z.rival,state:z.state,changed:z.changed,order_changed:z.order_changed,checkpoint_m:z.checkpoint_m,before:z.before.envelope,after:z.after.envelope,counter_refs:z.counter_refs,refs:z.refs})),formal:x.formal});
 results.push({id:f.id,raw:f.docs,source_digest:out.digest,bundle_sha256,evidence:out.packet.evidence.length,itemRows:575,before:brief(before),after:brief(after),withdraw,withdrawn:withdrawn?brief(withdrawn):null});
 }
 return {checks,results};
}
export {make34,run34};

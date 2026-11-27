/* Work33 synthetic controlled contrasts. No official use. */
function makeCases(){
 const cases=[];
 const types=["DISTANCE","WEIGHT","GOING","SURFACE","COURSE","PACE","COMPETITION","TERMINAL_REPEAT","MULTI"];
 for(const type of types){
 const n=type==="COMPETITION"||type==="MULTI"?5:3,ids=Array.from({length:n},(_,i)=>"TEST:H"+(i+1)),issuer="TEST:JRA";
 const context=(d,going="TEST:GOOD",venue="TEST:VENUE_A")=>({distance_m:d,surface:"TURF",going,venue,class_label:"TEST:CLASS_BASE",class_version:"TEST:CLASS_V1",effective_from:0,effective_until:120});
 const geo=(d,venue)=>({direction:venue==="TEST:VENUE_A"?"RIGHT":"LEFT",first_turn_m:200,straight_m:venue==="TEST:VENUE_A"?300:400,checkpoints_m:[200,d-600,d-200],course_version:venue==="TEST:VENUE_A"?"TEST:COURSE_A":"TEST:COURSE_B",effective_from:0,effective_until:120});
 const condition=(variant)=>{const d=variant&&(type==="DISTANCE"||type==="MULTI")?1400:1200,going=variant&&(type==="GOING"||type==="MULTI")?"TEST:SOFT":"TEST:GOOD",venue=variant&&(type==="COURSE"||type==="MULTI")?"TEST:VENUE_B":"TEST:VENUE_A";return {conditions:{...context(d,going,venue),surface:variant&&type==="SURFACE"?"DIRT":"TURF"},geometry:geo(d,venue)}};
 const weight=(i,variant)=>55000+(i===0&&variant&&(type==="WEIGHT"||type==="MULTI")?2000:0);
 // Two explicit sets of horse-specific crossings; not proportional rescaling.
 const profilesA=[[12500,36600,60800,73200],[12900,36200,60900,73500],[13200,37100,61600,73900],[13200,37400,62100,74300],[13400,37800,62500,74700]];
 const profilesB=type==="DISTANCE"||type==="MULTI"?[[12600,49600,74900,87800],[12800,48300,73700,86100],[13100,49100,74400,87000],[13400,49900,75300,88400],[13500,50400,75900,89100]]:
 type==="PACE"||type==="COMPETITION"?[[11500,34500,61000,74800],[11600,35100,60500,73100],[12800,36400,61500,73900],[12900,37200,62300,74850],[13200,37600,62800,75200]]:
 type==="TERMINAL_REPEAT"?[[12500,36700,61200,73100],[12700,36300,61000,73550],[13000,37200,61700,74000]]:
 [[12500,36800,61800,74400],[12700,36400,60700,72900],[13000,37100,61400,73600],[13200,37400,62200,74500],[13400,37800,62600,74900]];
 const history=(eventId,eventAt,variant,profile)=>{const c=condition(variant),d=c.conditions.distance_m;
 const rows=ids.map((nativeId,i)=>({nativeId,no:i+1,status:"FINISHED",gate:i+1,weightG:weight(i,variant),clockMs:profile[i][3],final600Ms:profile[i][3]-profile[i][1],checkpointMs:profile[i].slice(0,3)}));
 const rank=(r,key)=>[...rows].sort((a,b)=>key(a)-key(b)).indexOf(r)+1;
 for(const r of rows){r.finish=rank(r,q=>q.clockMs);r.checkpointRanks=[0,1,2].map(j=>rank(r,q=>q.checkpointMs[j]));r.officialMargin=r.finish===1?null:"TEST_LITERAL"}
 const elapsed=[0,...[0,1,2].map(j=>Math.min(...rows.map(r=>r.checkpointMs[j]))),Math.min(...rows.map(r=>r.clockMs))];
 return {kind:"HISTORICAL_RESULT",issuer,eventId,eventAt,version:1,publishedAt:eventAt+1,updatedAt:eventAt+2,distanceM:d,registeredCount:n,actualStarters:n,precisionMs:50,rows,...c,leaderLaps:{unit:"ms",scope:"RACE_LEADER",boundariesM:[0,...c.geometry.checkpoints_m,d],valuesMs:elapsed.slice(1).map((t,i)=>t-elapsed[i])},passing:{checkpointM:200,groups:[...rows].sort((a,b)=>a.checkpointMs[0]-b.checkpointMs[0]).map(r=>[r.no]),semantics:"SOURCE_GROUPED_ORDER"}};
 };
 const c=condition(false),card={kind:"TARGET_CARD",issuer,eventId:"TEST:T",version:1,publishedAt:70,updatedAt:70,scheduledPost:100,rows:ids.map((nativeId,i)=>({nativeId,no:i+1,status:"ACTIVE",gate:i+1,weightG:weight(i,false)})),...c};
 // COMPETITION changes measured historical early proximity, not actual target pace.
 // All target conditions are baseline; past variant is distinct. Repeat is an independent event.
 cases.push({id:type,docs:[card,history("TEST:BASE",10,false,profilesA),history("TEST:VAR",30,type!=="TERMINAL_REPEAT",profilesB),history("TEST:RETURN",50,false,profilesA.map((p,i)=>p.map((v,j)=>v+[40,80,120,160][j]+i*20)))]});
 }
 return cases;
}
function research33({cases,canonical,sha,producer,adapter,core,manifest}){
 const named=[],results=[],check=(name,ok)=>{named.push({name,pass:!!ok});if(!ok)throw Error(name)};
 for(const f of cases){
 const {input,registry,out}=producer.run31(f.docs,canonical,sha);
 check(f.id+":REPLAY",out.state==="TEST_PACKET"&&out.digest===sha(JSON.stringify(out.packet)));
 const q={n:f.id,input,registry,expectedDigest:out.digest},bundleText=JSON.stringify({scope:"SYNTHETIC_ONLY",canonical,cases:[q]})+"\n",bundleSha=sha(bundleText);
 const v=adapter.verify32(bundleText,f.id,out,sha,producer.pipeline31,producer.verifier31,bundleSha);
 check(f.id+":VERIFIED",v.state==="VERIFIED_SYNTHETIC_ENVELOPE");
 const tampered=JSON.parse(JSON.stringify(out));tampered.packet.evidence[0].value.no=99;tampered.digest=sha(JSON.stringify(tampered.packet));
 check(f.id+":REHASH_TAMPER",adapter.verify32(bundleText,f.id,tampered,sha,producer.pipeline31,producer.verifier31,bundleSha).state==="REJECTED");
 const pack=adapter.adapt32(v,sha),L={cases:new Map([[f.id,pack]]),canonical,work30:new Map(),work27:new Map()};
 const ns=x=>out.packet.issuer+"|"+x,subject=ns("TEST:H1"),rival=ns("TEST:H2"),first=ns("TEST:BASE"),second=ns("TEST:VAR"),third=ns("TEST:RETURN"),target=ns("TEST:T");
 const original=core.analyzeV31(L,f.id,null,{placeThreshold:3});
 const comparison=core.compareV31Response(L,f.id,subject,rival,first,second);
 const repeat=core.compareV31Response(L,f.id,subject,rival,first,third);
 const own=original.runners.find(h=>h.slot===subject);
 const src=(event,horse,field)=>out.packet.evidence.find(e=>e.event===event&&e.subject===horse&&e.field===field);
 const depIds=(event,horse,fields)=>fields.map(k=>src(event,horse,k)?.evidenceId).filter(Boolean);
 const conditions=out.packet.evidence.filter(e=>e.field==="conditions"||e.field==="geometry");
 const byEvent=new Map(f.docs.map(d=>[d.eventId,d]));
 const a=byEvent.get("TEST:BASE"),b=byEvent.get("TEST:VAR"),t=byEvent.get("TEST:T");
 const dimensions=["distance_m","surface","going","venue","class_label"].filter(k=>a.conditions[k]!==b.conditions[k]);
 if(a.rows[0].weightG!==b.rows[0].weightG)dimensions.push("subject_weight");
 if(a.geometry.course_version!==b.geometry.course_version)dimensions.push("course_geometry");
 const known=original.roster.known_active;
 const response=known.flatMap(h=>known.filter(r=>r!==h).map(r=>({subject:h,rival:r,comparison:core.compareV31Response(L,f.id,h,r,first,second),repeat:core.compareV31Response(L,f.id,h,r,first,third)})));
 const eye=[];
 const add=(item,targets,observation,refs,scope="CONDITIONAL_REVIEW_ONLY")=>eye.push({item,targets,observation,refs:[...new Set(refs)],scope,current_relevance:"UNPROVEN",canonical_return:false,independent_vote:false,grade_effect:false});
 const h1=a.rows[0],h2=b.rows[0],baseRank=h1.checkpointRanks,varRank=h2.checkpointRanks;
 const rref=depIds("TEST:BASE","TEST:H1",["ranks","finish","checkpoint_ms"]);
 if(baseRank.some((r,i)=>i>0&&r>baseRank[i-1])&&h1.finish<Math.max(...baseRank))add("EYE03",["RANK18","RANK21"],{event:"TEST:BASE",ranks:baseRank,finish:h1.finish},rref,"OBSERVED_ORDINAL_RECOVERY");
 const condRefs=conditions.filter(e=>["TEST:T","TEST:BASE","TEST:VAR","TEST:RETURN"].includes(e.event)).map(e=>e.evidenceId);
 const pairRefs=[...comparison.first.refs,...comparison.second.refs,...repeat.second.refs];
 if(dimensions.length&&JSON.stringify(t.conditions)===JSON.stringify(a.conditions)&&t.rows[0].weightG===a.rows[0].weightG)add("EYE07",["RANK43","RANK44","RANK48","RANK54"],{target_returns_to_baseline:true,changed_dimensions:dimensions,observed_reversal:comparison.observed_reversal,repeat_relation:repeat.second.relative_finish},[...condRefs,...pairRefs,...depIds("TEST:T","TEST:H1",["weight_grams","current_card_row"])]);
 if(dimensions.includes("course_geometry"))add("EYE08",["RANK45","RANK49","RANK50","RANK52"],{course_change:dimensions,return_to_baseline:true,causal_response:null},[...condRefs,...pairRefs]);
 if(f.id==="PACE"||f.id==="COMPETITION"){
 const pace=(event)=>{const x=byEvent.get(event);return {first_crossing_ms:x.leaderLaps.valuesMs[0],within_250ms:x.rows.filter(r=>r.checkpointMs[0]-x.leaderLaps.valuesMs[0]+2*x.precisionMs<=250).map(r=>r.nativeId),individual_ms:x.rows[0].checkpointMs,terminal_ms:x.rows[0].final600Ms}};
 const refs=["TEST:BASE","TEST:VAR","TEST:RETURN"].flatMap(event=>[...depIds(event,null,["race_leader_laps","geometry"]),...byEvent.get(event).rows.flatMap(r=>depIds(event,r.nativeId,["checkpoint_ms","ranks","finish","individual_final600"]))]);
 add("EYE06",["RANK19","RANK08"],{baseline:pace("TEST:BASE"),variant:pace("TEST:VAR"),current_pressure:null},refs);
 add("EYE09",["RANK19"],{historical_early_proximity:pace("TEST:VAR").within_250ms,not_current_style_occupancy:true},refs);
 add("EYE11",["RANK19","RANK18"],{historical_proximity_change:[pace("TEST:VAR").within_250ms,pace("TEST:RETURN").within_250ms],current_same_style_count:null},refs);
 add("EYE12",["RANK18","RANK21"],{historical_checkpoint_rank:varRank,target_queue:null},refs);
 }
 if(f.id==="MULTI")add("EYE15",["RANK43","RANK48","RANK54"],{joint_condition_change:dimensions,no_additive_effect:true},[...condRefs,...pairRefs]);
 // No adjacency-based escape sandwich without independently supported roles.
 for(const id of ["EYE03","EYE06","EYE07","EYE08","EYE09","EYE10","EYE11","EYE12","EYE15"])if(!eye.some(e=>e.item===id))add(id,[],{reason:id==="EYE10"?"CURRENT_NEIGHBOR_STYLE_AND_ROLE_UNVERIFIED":"NO_RELEVANT_COMPARISON"},[],"HELD");
 const wd=src("TEST:VAR","TEST:H1","finish").evidenceId;
 const withdrawn=core.compareV31Response(L,f.id,subject,rival,first,second,wd);
 check(f.id+":RESPONSE_WITHDRAWAL",comparison.second.relative_finish!=="UNKNOWN"&&withdrawn.second.relative_finish==="UNKNOWN"&&comparison.first.relative_finish===withdrawn.first.relative_finish);
 const axisFacts=[["A",["RANK02","RANK06"]],["B",["RANK43","RANK54"]],["C",["RANK35"]],["D",["RANK19","RANK18"]],["E",["RANK21"]]].map(([axis,items])=>({axis,current_relevance_reviewed:false,direction:"NEUTRAL",evidence_ids:[...new Set(own.items.filter(i=>items.includes(i.item)).flatMap(i=>i.refs))],facts:own.items.filter(i=>items.includes(i.item)).map(i=>({item:i.item,state:i.state,refs:i.refs})),grade_effect:false}));
 const grade=core.reviewGradeBoundary({axes:axisFacts,claim:"WIN_PATH"});
 const rankWithdrawal=src("TEST:BASE","TEST:H1","ranks").evidenceId;
 const rankReplay=core.analyzeV31(L,f.id,rankWithdrawal,{placeThreshold:3});
 const removed=rankReplay.runners.find(h=>h.slot===subject);
 const selectReview=h=>(h.eye_feedback_v29??[]).filter(x=>x.item==="EYE03");
 const baselineEye=selectReview(own),withdrawnEye=selectReview(removed);
 const matchingReview=h=>(h.review??[]).filter(x=>x.item==="EYE03");
 const baseReview=matchingReview(own),replayReview=matchingReview(removed);
 const path=(h,event)=>(h.repeat_paths??[]).find(x=>x.event===event)??null;
 const eyeEffect={withdraw:rankWithdrawal,baselineEye,withdrawnEye,baseReview,replayReview,beforePath:path(own,first),afterPath:path(removed,first),beforeRepeat:path(own,third),afterRepeat:path(removed,third),independent_vote:false};
 check(f.id+":EYE03_SHARED_REVIEW",baseReview.some(x=>x.refs.includes(rankWithdrawal))&&!replayReview.some(x=>x.refs.includes(rankWithdrawal))&&baselineEye.length>0);
 check(f.id+":EYE03_REVIEW_PATH",eyeEffect.beforePath?.reviewed_recovery!==eyeEffect.afterPath?.reviewed_recovery&&eyeEffect.beforeRepeat?.reviewed_recovery===eyeEffect.afterRepeat?.reviewed_recovery);
 check(f.id+":GRADE_HELD",grade.grade===null&&own.items.length===115&&original.runners.every(r=>r.items.length===115));
 const ret={eyeEffect,id:f.id,kind:dimensions.length>1?"MULTIPLE_CHANGED_OR_COURSE_GEOMETRY_BUNDLE":dimensions.length===1?"ONE_RECORDED_CONTEXT_DIMENSION":"OBSERVED_RESPONSE_VARIATION_NOT_CONTROLLED_CAUSE",dimensions,source_digest:out.digest,bundle_sha256:bundleSha,evidence:out.packet.evidence.length,itemRows:out.packet.runners.length*115,comparison,repeat,response,eye,common_eye_feedback:own.eye_feedback_v29,common_review:own.review,common_condition_paths:own.condition_paths,common_pace_paths:own.pace_paths,WIN:own.WIN,PLACE:own.PLACE,axes:axisFacts,grade,withdrawal:{id:wd,before:comparison.second.relative_finish,after:withdrawn.second.relative_finish,first_preserved:comparison.first.relative_finish===withdrawn.first.relative_finish},formal:false};
 results.push({ret,bundle:{...q},raw:f.docs});
 }
 return {scope:"SYNTHETIC_ONLY_RESEARCH",manifest,checks:named,results,groups:118,held:826,formal_admissions:0,grade_effects:0,priorRecorded:475};
}
export {makeCases,research33};

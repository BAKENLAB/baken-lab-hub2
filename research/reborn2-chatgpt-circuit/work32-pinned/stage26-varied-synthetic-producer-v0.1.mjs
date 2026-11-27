// Work26 synthetic research only. No official evidence. Use the exact serialized JSON per case, validate and then supply.
function sha256(s){
 const bytes=Array.from(encodeURIComponent(s).match(/%[0-9A-F]{2}|./g)||[],x=>x[0]==="%"?parseInt(x.slice(1),16):x.charCodeAt(0)), n=bytes.length;
 const k=[],h=[];for(let p=2;k.length<64;p++){if(Array.from({length:Math.floor(Math.sqrt(p))-1},(_,i)=>i+2).some(d=>p%d===0))continue;if(h.length<8)h.push((Math.sqrt(p)%1*4294967296)|0);k.push((Math.cbrt(p)%1*4294967296)|0)}
 bytes.push(128);while(bytes.length%64!==56)bytes.push(0);for(let i=7;i>=0;i--)bytes.push(Math.floor(n*8/2**(i*8))&255);
 const r=(x,n)=>(x>>>n)|(x<<(32-n));for(let i=0;i<bytes.length;i+=64){const w=[];for(let j=0;j<16;j++)w.push((bytes[i+4*j]<<24)|(bytes[i+4*j+1]<<16)|(bytes[i+4*j+2]<<8)|bytes[i+4*j+3]);for(let j=16;j<64;j++){let a=w[j-15],b=w[j-2];w.push((w[j-16]+(r(a,7)^r(a,18)^(a>>>3))+w[j-7]+(r(b,17)^r(b,19)^(b>>>10)))|0)}let [a,b,c,d,e,f,g,z]=h;for(let j=0;j<64;j++){let t=(z+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+k[j]+w[j])|0,u=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;z=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+u)|0} [a,b,c,d,e,f,g,z].forEach((v,j)=>h[j]=(h[j]+v)|0)}return h.map(x=>(x>>>0).toString(16).padStart(8,"0")).join("");
}
function makeFixtures(){
 const geom=(first,straight,cp,direction)=>({first_turn_m:first,straight_m:straight,checkpoints_m:cp,direction,effective:[0,200],source:"SYNTHETIC_STIPULATION"});
 const cond=(d,first,straight,cp,venue,going,cls,dir="RIGHT")=>({distance_m:d,venue,surface:"TURF",going,class_label:cls,class_effective:[0,200],class_rule:null,geometry:geom(first,straight,cp,dir)});
 const row=(id,no,gate,weight,ranks,finish,clock,final600,times=null)=>({id:"S26:"+id,verified_identity:true,horse_number:no,gate_number:gate,weight_grams:weight,status:"FINISHED",ranks,finish,finish_ms:clock,final600_ms:final600,checkpoint_ms:times});
 const cancelled=(id,no,gate)=>({id:"S26:"+id,verified_identity:true,horse_number:no,gate_number:gate,weight_grams:55000,status:"CANCELLED",ranks:null,finish:null,finish_ms:null,final600_ms:null,checkpoint_ms:null});
 const history=[
 {id:"S26:H1",event_at:10,published_at:11,observed_at:12,registered_count:6,actual_starters:5,conditions:cond(1200,200,200,[200,600,1000],"SYN:A","GOOD","SYN:LOW"),rows:[
 row("A",5,3,56000,[3,2,1],2,73500,36500,[13000,37000,61000]),
 row("B",1,1,57000,[1,1,3],3,74000,37500,[12000,36500,62000]),
 row("C",3,2,55000,[2,4,2],1,73000,35000,[12500,38000,61500]),
 row("D",4,3,56000,[4,3,4],4,75000,37500),
 row("X",6,4,58000,[5,5,5],5,76500,37500),
 cancelled("Y",2,2)],snapshots:[{elapsed_ms:30000,positions_m:{"S26:A":490,"S26:B":500,"S26:C":475,"S26:D":470,"S26:X":450}},{elapsed_ms:40000,positions_m:{"S26:A":650,"S26:B":640,"S26:C":625,"S26:D":635,"S26:X":615}}]},
 {id:"S26:H2",event_at:20,published_at:21,observed_at:22,registered_count:5,actual_starters:5,conditions:cond(1600,350,300,[350,800,1300],"SYN:B","SOFT","SYN:MID","LEFT"),rows:[
 row("A",1,1,57000,[2,3,2],1,99500,36500),
 row("B",3,2,57000,[1,2,4],4,101000,38000),
 row("C",5,3,55000,[3,1,1],2,99800,36900),
 row("D",2,1,55000,[4,4,3],3,100400,37200),
 row("X",4,2,58000,[5,5,5],5,103200,39500)],snapshots:[]},
 {id:"S26:H3",event_at:30,published_at:31,observed_at:32,registered_count:3,actual_starters:3,conditions:cond(1000,150,250,[150,450,750],"SYN:C","GOOD","SYN:LOW"),rows:[
 row("X",3,2,56000,[3,2,1],1,61000,36500),
 row("Y",1,1,54000,[1,1,2],2,61600,38000),
 row("Z",2,1,55000,[2,3,3],3,63000,39000)],snapshots:[]}
 ];
 const roster=[["A",4,2,56000],["B",6,4,55000],["C",1,1,55000],["D",3,2,57000],["E",2,1,54000],["F",5,3,56000]].map(([id,horse_number,gate_number,weight_grams])=>({id:"S26:"+id,verified_identity:true,horse_number,gate_number,weight_grams,status:id==="F"?"CANCELLED":"ACTIVE"}));
 const target={id:"S26:T",event_at:110,published_at:79,observed_at:80,registered_count:6,declared_active_count:5,actual_starters:null,conditions:cond(1400,280,350,[280,800,1050],"SYN:D","GOOD","SYN:MID"),rows:roster};
 const base={schema:"WORK26_SYNTHETIC_RAW_0.1",scope:"EXPLICITLY_SYNTHETIC_NEVER_OFFICIAL",family:"S26",case_id:"BASE",source_version:1,cutoff:100,analysis_at:101,seal_at:90,seal_uncertainty:1,rights:{state:"SYNTHETIC_TEST_ONLY",valid_from:0,valid_until:200,revoked_at:null},measurement:{clock_unit:"ms",checkpoint_scope:"COURSE_DISTANCE_CROSSING_ELAPSED_FROM_COMMON_START",clock_uncertainty_ms:20,snapshot_scope:"SYNCHRONIZED_COURSE_COORDINATE_NOT_ACTUAL_PATH_LENGTH",snapshot_uncertainty_m:1},target,history,formal_admissions:0};
 const copy=(name)=>{const p=JSON.parse(JSON.stringify(base));p.case_id=name;return p};
 const short=copy("TARGET_SHORT");short.target.conditions=cond(1000,150,250,[150,450,750],"SYN:C","GOOD","SYN:LOW");
 const long=copy("TARGET_LONG");long.target.conditions=cond(1800,420,450,[420,900,1350],"SYN:E","SOFT","SYN:MID","LEFT");
 const fast=copy("SAME_RANK_DIFFERENT_SPEED");let a=fast.history[0].rows[0];a.checkpoint_ms=[13000,37400,60800];a.final600_ms=36100;fast.history[0].snapshots[0].positions_m["S26:A"]=480;fast.history[0].snapshots[1].positions_m["S26:A"]=660;
 const missing=copy("MISSING_MEASUREMENTS");for(const r of missing.history[0].rows)r.checkpoint_ms=null;missing.history[0].snapshots=[];missing.target.rows[4].gate_number=null;
 const geo=copy("MISSING_GEOMETRY");geo.history[0].conditions.geometry=null;
 const peer=copy("PEER_LATER_SEVERE_LOSS");const rr=peer.history[2].rows;rr[0].ranks=[3,3,3];rr[0].finish=3;rr[0].finish_ms=67000;rr[0].final600_ms=41000;rr[1].ranks=[1,1,1];rr[1].finish=1;rr[1].finish_ms=61000;rr[1].final600_ms=36500;rr[2].ranks=[2,2,2];rr[2].finish=2;rr[2].finish_ms=61600;rr[2].final600_ms=38000;
 return [base,short,long,fast,missing,geo,peer];
}
function validate(raw){
 const must=(x,m)=>{if(!x)throw Error(m)},int=Number.isSafeInteger,unique=a=>new Set(a).size===a.length,perm=(a,n)=>a.length===n&&unique(a)&&a.every(x=>int(x)&&x>=1&&x<=n);
 must(raw.schema==="WORK26_SYNTHETIC_RAW_0.1"&&raw.scope==="EXPLICITLY_SYNTHETIC_NEVER_OFFICIAL"&&raw.formal_admissions===0,"SCOPE");
 must(raw.rights.state==="SYNTHETIC_TEST_ONLY"&&raw.rights.valid_from<=raw.analysis_at&&raw.analysis_at<raw.rights.valid_until&&(raw.rights.revoked_at===null||raw.analysis_at<raw.rights.revoked_at),"RIGHTS");
 must(raw.seal_at+raw.seal_uncertainty<=raw.cutoff&&raw.cutoff<raw.target.event_at-raw.seal_uncertainty&&raw.analysis_at>=raw.cutoff,"CUTOFF");
 must(raw.measurement.clock_unit==="ms"&&raw.measurement.clock_uncertainty_ms>=0&&raw.measurement.snapshot_uncertainty_m>=0,"MEASUREMENT");
 const events=[raw.target,...raw.history];must(unique(events.map(e=>e.id)),"EVENT_DUPLICATE");
 for(const [i,e] of events.entries()){
 const cur=i===0,c=e.conditions,g=c.geometry;must(e.published_at<=e.observed_at&&e.observed_at<=raw.seal_at&&e.observed_at<=raw.cutoff&&(cur?e.event_at>raw.cutoff:e.event_at<e.published_at),"EVENT_TIME");
 must(int(c.distance_m)&&c.distance_m>600&&c.class_effective[0]<=e.event_at&&e.event_at<c.class_effective[1]&&c.class_rule===null,"CONDITION");
 if(g!==null)must(g.effective[0]<=e.event_at&&e.event_at<g.effective[1]&&[g.first_turn_m,g.straight_m,...g.checkpoints_m].every(v=>int(v)&&v>0&&v<c.distance_m)&&g.checkpoints_m.every((v,j,a)=>j===0||v>a[j-1])&&g.direction&&g.source==="SYNTHETIC_STIPULATION","GEOMETRY");
 must(e.registered_count===e.rows.length&&unique(e.rows.map(r=>r.id))&&perm(e.rows.map(r=>r.horse_number),e.registered_count),"ROSTER");
 for(const r of e.rows){must(r.verified_identity===true&&r.id.startsWith("S26:")&&int(r.weight_grams)&&r.weight_grams>0,"IDENTITY_OR_WEIGHT");must(r.gate_number===null||int(r.gate_number)&&r.gate_number>=1&&r.gate_number<=e.registered_count,"GATE");}
 const active=e.rows.filter(r=>r.status===(cur?"ACTIVE":"FINISHED"));
 must(e.rows.every(r=>r.status===(cur?"ACTIVE":"FINISHED")||r.status==="CANCELLED"),"STATUS");
 if(cur){must(e.declared_active_count===active.length&&e.actual_starters===null&&e.rows.every(r=>!["ranks","finish","finish_ms","final600_ms","checkpoint_ms"].some(k=>k in r)),"CURRENT_CARD");continue;}
 must(e.actual_starters===active.length&&perm(active.map(r=>r.finish),active.length),"STARTERS_FINISH");
 const n=active[0].ranks.length;must(n>0&&active.every(r=>Array.isArray(r.ranks)&&r.ranks.length===n)&&(!g||g.checkpoints_m.length===n),"RANK_SHAPE");
 for(let j=0;j<n;j++)must(perm(active.map(r=>r.ranks[j]),active.length),"RANK_COLLISION");
 const byFinish=[...active].sort((a,b)=>a.finish-b.finish);
 must(byFinish.every((r,j)=>int(r.finish_ms)&&r.finish_ms>0&&int(r.final600_ms)&&r.final600_ms>0&&r.final600_ms<r.finish_ms&&(j===0||r.finish_ms>byFinish[j-1].finish_ms)),"FINISH_CLOCK");
 for(const r of e.rows.filter(r=>r.status==="CANCELLED"))must(["ranks","finish","finish_ms","final600_ms","checkpoint_ms"].every(k=>r[k]===null),"CANCELLED_LEAK");
 for(const r of active.filter(r=>r.checkpoint_ms!==null)){
  must(r.checkpoint_ms.length===n&&r.checkpoint_ms.every((t,j,a)=>int(t)&&t>0&&t<r.finish_ms&&(j===0||t>a[j-1])),"CHECKPOINT_CLOCK");
  for(let j=0;j<n;j++)for(const b of active.filter(q=>q!==r&&q.checkpoint_ms!==null))must(Math.sign(r.ranks[j]-b.ranks[j])===Math.sign(r.checkpoint_ms[j]-b.checkpoint_ms[j]),"CLOCK_RANK_ORDER");
  if(g){let j=g.checkpoints_m.indexOf(c.distance_m-600);if(j>=0)must(r.finish_ms-r.checkpoint_ms[j]===r.final600_ms,"FINAL600_CONSISTENCY");}
 }
 for(const [j,s] of e.snapshots.entries()){
 must(int(s.elapsed_ms)&&s.elapsed_ms>0&&(j===0||s.elapsed_ms>e.snapshots[j-1].elapsed_ms)&&Object.keys(s.positions_m).length===active.length&&active.every(r=>Object.hasOwn(s.positions_m,r.id)),"SNAPSHOT_FIELD");
 for(const r of active){let d=s.positions_m[r.id];must(int(d)&&d>0&&d<c.distance_m&&s.elapsed_ms<r.finish_ms&&(j===0||d>=e.snapshots[j-1].positions_m[r.id]),"SNAPSHOT_DISTANCE");if(g&&r.checkpoint_ms)for(let k=0;k<n;k++)must(Math.sign(d-g.checkpoints_m[k])===Math.sign(s.elapsed_ms-r.checkpoint_ms[k]),"SNAPSHOT_CLOCK_CONSISTENCY");}
 }
 }
 return true;
}
function supply(raw,sha){
 validate(raw);
 const digest=sha(JSON.stringify(raw)),none=reason=>({state:"MISSING",value:null,reason}),all=[];
 const observation=(event,subject,field,value,pointer)=>{const root="S26ROOT:"+sha(JSON.stringify([raw.family,event,subject,field]));const rec={evidence_id:"S26EV:"+sha(JSON.stringify([root,digest,pointer])),root,source_sha256:digest,source_version:raw.source_version,case_id:raw.case_id,event_id:event,subject_id:subject,field,pointer,state:value===null?"MISSING":"SYNTHETIC_OBSERVATION",value,reason:value===null?"NOT_STIPULATED":null,formal_usable:false};all.push(rec);return rec;};
 const event=(e,i)=>{const cur=i===0,p=cur?"/target":`/history/${i-1}`,c=e.conditions,g=c.geometry;
 const conditions=observation(e.id,null,"conditions",c,p+"/conditions"),geometry=observation(e.id,null,"geometry",g,p+"/conditions/geometry"),registered=observation(e.id,null,"registered_count",e.registered_count,p+"/registered_count"),starters=observation(e.id,null,"actual_starters",e.actual_starters,p+"/actual_starters"),declared=cur?observation(e.id,null,"declared_active_count",e.declared_active_count,p+"/declared_active_count"):null;
 const rows=e.rows.map((r,j)=>{const q=p+"/rows/"+j,obs=(k)=>observation(e.id,r.id,k,r[k]??null,q+"/"+k),ident=obs("id"),status=obs("status"),number=obs("horse_number"),gate=obs("gate_number"),weight=obs("weight_grams");
 const out={id:r.id,status:r.status,identity_ref:ident.evidence_id,status_ref:status.evidence_id,horse_number:number,gate_number:gate,weight,rank_path:none("NO_HISTORICAL_RANKS"),speed_change:none("NO_COMPARABLE_INDIVIDUAL_INTERVALS"),initial_acceleration:none("NO_START_REACTION_OR_SUBINTERVAL_MEASUREMENTS"),pressure_tolerance:none("NO_MATCHED_PRESSURE_LOAD_MEASUREMENT")};
 if(cur||r.status!=="FINISHED")return out;
 const rank=obs("ranks"),fin=obs("finish"),clock=obs("finish_ms"),final=obs("final600_ms"),times=obs("checkpoint_ms");
 const winner=e.rows.find(x=>x.finish===1),winPointer=p+"/rows/"+e.rows.indexOf(winner)+"/finish_ms";
 out.finish=fin;out.finish_clock=clock;out.final600={observation:final,interval_m:[c.distance_m-600,c.distance_m],scope:"INDIVIDUAL_TERMINAL_AVERAGE_NOT_ACCELERATION"};out.margin={state:"DERIVED_TIME_MARGIN",unit:"ms",value:r.finish_ms-winner.finish_ms,source_refs:[clock.evidence_id],winner_pointer:winPointer,source_sha256:digest};
 out.rank_path={state:g?"LOCATED_ORDINAL":"UNLOCATED_ORDINAL",ranks:r.ranks,locations_m:g?.checkpoints_m??null,field_count:e.actual_starters,refs:[rank.evidence_id,geometry.evidence_id,starters.evidence_id],transitions:r.ranks.slice(1).map((v,k)=>({from_index:k,to_index:k+1,ordinal_gain:r.ranks[k]-v,kind:r.ranks[k]>v?"RANK_GAIN":r.ranks[k]<v?"RANK_LOSS":"RANK_UNCHANGED"})),not_physical_gain:true};
 out.individual_checkpoint_clock=times;
 if(g&&r.checkpoint_ms&&r.checkpoint_ms.length>=3){
 const u=raw.measurement.clock_uncertainty_ms*2,intervals=r.checkpoint_ms.slice(1).map((t,k)=>{const dt=t-r.checkpoint_ms[k],d=g.checkpoints_m[k+1]-g.checkpoints_m[k];return {start_m:g.checkpoints_m[k],end_m:g.checkpoints_m[k+1],elapsed_ms:dt,course_progress_mps:d*1000/dt,lower_mps:dt>u?d*1000/(dt+u):null,upper_mps:dt>u?d*1000/(dt-u):null}});
 const comparisons=intervals.slice(1).map((b,k)=>{const a=intervals[k];return {earlier_interval:k,later_interval:k+1,state:a.lower_mps===null||b.lower_mps===null?"UNRESOLVED":b.lower_mps>a.upper_mps?"HIGHER_INTERVAL_AVERAGE":b.upper_mps<a.lower_mps?"LOWER_INTERVAL_AVERAGE":"UNCERTAINTY_OVERLAP"}});
 out.speed_change={state:"COURSE_PROGRESS_INTERVAL_AVERAGES_ONLY",refs:[times.evidence_id,geometry.evidence_id],intervals,comparisons,measurement:raw.measurement,not_instantaneous_acceleration:true,not_actual_travelled_path_speed:true};
 }
 return out;});
 const snapshots=cur?[]:e.snapshots.map((s,j)=>observation(e.id,null,"synchronized_course_positions",s,p+"/snapshots/"+j));
 const relative=[];if(snapshots.length>=2){for(let j=1;j<snapshots.length;j++)for(let k=0;k<rows.length;k++)for(let l=k+1;l<rows.length;l++){let a=rows[k].id,b=rows[l].id,x=snapshots[j-1].value,y=snapshots[j].value;if(!(a in x.positions_m)||!(b in x.positions_m))continue;let start=x.positions_m[a]-x.positions_m[b],end=y.positions_m[a]-y.positions_m[b];relative.push({a,b,start_gap_m:start,end_gap_m:end,relative_course_gain_m:end-start,uncertainty_bound_m:4*raw.measurement.snapshot_uncertainty_m,refs:[snapshots[j-1].evidence_id,snapshots[j].evidence_id],scope:"SYNCHRONIZED_COURSE_COORDINATE_DIFFERENCE_NOT_ACTUAL_PATH_LENGTH"});}}
 return {event_id:e.id,event_at:e.event_at,observed_at:e.observed_at,conditions,geometry,registered_count:registered,actual_starters:starters,declared_active_count:declared,class_rule:none("OFFICIAL_RULE_NOT_SUPPLIED"),opponent_strength:none("NO_VALIDATED_STRENGTH_REFERENCE"),leader_laps:none("NOT_STIPULATED_NO_INFERENCE"),rows,snapshots,relative};};
 const events=[raw.target,...raw.history].map(event),target=events[0],history=events.slice(1);
 const active=target.rows.filter(r=>r.status==="ACTIVE").map(r=>r.id);
 const runners=target.rows.map(r=>{const hs=history.filter(e=>e.rows.some(q=>q.id===r.id&&q.status==="FINISHED")).map(e=>({event_id:e.event_id,distance_delta_m:target.conditions.value.distance_m-e.conditions.value.distance_m,condition_refs:[e.conditions.evidence_id,target.conditions.evidence_id],geometry_refs:[e.geometry.evidence_id,target.geometry.evidence_id],causal_distance_response:none("NO_MATCHED_CAUSAL_COMPARISON")}));return {id:r.id,status:r.status,history:r.status==="ACTIVE"?hs:[],role:r.status!=="ACTIVE"?"NOT_ACTIVE":hs.length?"HISTORICAL_OBSERVATIONS_ONLY":"UNKNOWN_ACTIVE",win:null,place:null,grade:null}});
 const pair_inputs=[];for(const e of history)for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){const a=e.rows.find(r=>r.id===active[i]&&r.status==="FINISHED"),b=e.rows.find(r=>r.id===active[j]&&r.status==="FINISHED");if(a&&b)pair_inputs.push({event_id:e.event_id,a:a.id,b:b.id,first_ranks:[a.rank_path.ranks[0],b.rank_path.ranks[0]],field_count:e.actual_starters.value,refs:[...a.rank_path.refs,...b.rank_path.refs],state:"PAST_PAIR_OBSERVATION_ONLY"});}
 const followups=[];for(let i=0;i<history.length;i++)for(let j=i+1;j<history.length;j++){const e=history[i],f=history[j];for(const a of e.rows.filter(r=>active.includes(r.id)&&r.status==="FINISHED"))for(const x of e.rows.filter(r=>r.id!==a.id&&r.status==="FINISHED")){const y=f.rows.find(r=>r.id===x.id&&r.status==="FINISHED");if(!y)continue;followups.push({subject:a.id,opponent:x.id,reference_event:e.event_id,followup_event:f.event_id,reference_observation:{finish:x.finish,clock:x.finish_clock,margin:x.margin,final600:x.final600,ranks:x.rank_path,weight:x.weight,conditions:e.conditions,field_count:e.actual_starters},later_observation:{finish:y.finish,clock:y.finish_clock,margin:y.margin,final600:y.final600,ranks:y.rank_path,weight:y.weight,conditions:f.conditions,field_count:f.actual_starters},later_event_key:[x.id,f.event_id].join("|"),link_key:[a.id,x.id,e.event_id,f.event_id].join("|"),strength:none("OBSERVATION_NOT_STABLE_STRENGTH")});}}
 return {schema:"WORK26_CODEX_SYNTHETIC_OBSERVATIONS_0.1",case_id:raw.case_id,scope:raw.scope,raw_sha256:digest,source_version:raw.source_version,cutoff:raw.cutoff,formal_admissions:0,analysis_sufficient:false,events,runners,active_ids:active,unknown_active_ids:runners.filter(r=>r.role==="UNKNOWN_ACTIVE").map(r=>r.id),pair_inputs,followups,evidence:all,missing:{current_pace:"FUTURE_UNKNOWN",actual_current_starters:"NOT_KNOWN_PRE_RACE",pressure:"NO_DIRECT_PRESSURE_LOAD_OBSERVATION",class_rules:"NOT_STIPULATED",complete_career:"NOT_ASSERTED"}};
}
export {sha256,makeFixtures,validate,supply};

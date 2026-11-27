// Work27: requires exact pinned Work26 upstream exports (sha256, validate, supply). Synthetic only.
function make27(source){
 const copy=x=>JSON.parse(JSON.stringify(x)), base=copy(source.find(x=>x.case_id==="BASE"));
 const make=(name,src=base)=>{const z=copy(src);z.family="S27";z.case_id=name;return z};
 const b=make("CONTROL"),d=make("DISTANCE_ONLY"),g=make("GEOMETRY_ONLY"),gate=make("GATE_ONLY"),num=make("NUMBER_ONLY"),clock=make("CLOCK_ONLY_MISSING"),gm=make("GATE_ONLY_MISSING"),loss=make("PEER_LOSS",source.find(x=>x.case_id==="PEER_LATER_SEVERE_LOSS")),abs=make("PEER_NO_ASOF"),near=make("NEAR_COMPETITION"),surface=make("SURFACE_ONLY");
 d.target.conditions.distance_m=1600; // Synthetic same layout, alternate start configuration; fixed first turn/straight/checkpoints stipulated, no real course claim.
 g.target.conditions.geometry.first_turn_m=340;g.target.conditions.geometry.straight_m=410;
 gate.target.rows[0].gate_number=3;gate.target.rows[5].gate_number=2;
 [num.target.rows[0].horse_number,num.target.rows[1].horse_number]=[num.target.rows[1].horse_number,num.target.rows[0].horse_number];
 clock.history[0].rows[0].checkpoint_ms=null;
 gm.target.rows[0].gate_number=null;
 abs.history=abs.history.filter(e=>e.id!=="S26:H3");
 near.history[0].snapshots[0].positions_m["S26:A"]=498;near.history[0].snapshots[1].positions_m["S26:A"]=642;
 surface.target.conditions.surface="DIRT";
 // Explicit synthetic 900m individual crossing clock matrix in milliseconds.
 // Ranks derived FROM generated clocks, never clocks from ranks or leader laps.
 const matrix=[
 [9400,18100,36700,55000],[9200,17700,36100,55300],[9800,18400,36500,54800],
 [9550,18200,37000,55700],[9900,18700,37400,56000],[9700,18300,36900,55500],
 [10100,18900,37200,56300],[9500,18000,37100,56100],[10300,19100,37900,56800],
 [10000,18600,37500,56600],[10200,19000,37800,57100],[10400,19300,38000,57600]];
 const local=make("LOCAL_DIRT900_LARGE");const ids=Array.from({length:13},(_,i)=>"S26:L"+String(i+1).padStart(2,"0"));
 const cond={distance_m:900,venue:"SYN:LOCAL900",surface:"DIRT",going:"GOOD",class_label:"SYN:LOCAL:C",class_effective:[0,200],class_rule:null,geometry:{first_turn_m:150,straight_m:200,checkpoints_m:[150,300,600],direction:"RIGHT",effective:[0,200],source:"SYNTHETIC_STIPULATION"}};
 const card=ids.map((id,i)=>({id,verified_identity:true,horse_number:i+1,gate_number:Math.ceil((i+1)/2),weight_grams:54000+(i%4)*1000,status:i===12?"CANCELLED":"ACTIVE"}));
 local.target={...local.target,id:"S26:LT",conditions:copy(cond),registered_count:13,declared_active_count:12,actual_starters:null,rows:card};
 const ranks=(col,i)=>1+matrix.filter(row=>row[col]<matrix[i][col]).length;
 const rows=card.map((r,i)=>i===12?{...r,ranks:null,finish:null,finish_ms:null,final600_ms:null,checkpoint_ms:null}:{...r,status:"FINISHED",ranks:[0,1,2].map(c=>ranks(c,i)),finish:ranks(3,i),finish_ms:matrix[i][3],final600_ms:matrix[i][3]-matrix[i][1],checkpoint_ms:matrix[i].slice(0,3)});
 local.history=[{id:"S26:LH1",event_at:10,published_at:11,observed_at:12,registered_count:13,actual_starters:12,conditions:copy(cond),rows,snapshots:[]}];
 // Leader crossings explicitly stipulated and consistent with fastest observed individual crossing at each checkpoint.
 for(const z of [b,d,g,gate,num,clock,gm,loss,abs,near,surface]){
  z.leader_measurements=[{event_id:"S26:H1",distances_m:[0,200,600,1000,1200],elapsed_ms:[0,12000,36500,61000,73000],scope:"SYNTHETIC_LEADER_CROSSING_COMMON_START",uncertainty_ms:20}];
  z.condition_configuration={venue:z.target.conditions.venue,configuration_kind:"FICTIONAL_INDEPENDENT_DIMENSIONS",distance_and_layout_stipulated_independently:true};
 }
 local.leader_measurements=[{event_id:"S26:LH1",distances_m:[0,150,300,600,900],elapsed_ms:[0,...[0,1,2,3].map(c=>Math.min(...matrix.map(r=>r[c])))],scope:"SYNTHETIC_LEADER_CROSSING_COMMON_START",uncertainty_ms:20}];
 local.condition_configuration={venue:cond.venue,configuration_kind:"FICTIONAL_LOCAL_DIRT_900",distance_and_layout_stipulated_independently:true};
 return [b,d,g,gate,num,clock,gm,loss,abs,near,surface,local];
}
function validate27(raw,up){
 const must=(v,m)=>{if(!v)throw Error(m)};
 must(raw.family==="S27"&&raw.condition_configuration.venue===raw.target.conditions.venue,"S27_SCOPE");
 must(raw.measurement.checkpoint_scope==="COURSE_DISTANCE_CROSSING_ELAPSED_FROM_COMMON_START"&&raw.measurement.snapshot_scope==="SYNCHRONIZED_COURSE_COORDINATE_NOT_ACTUAL_PATH_LENGTH"&&Number.isFinite(raw.measurement.clock_uncertainty_ms)&&Number.isFinite(raw.measurement.snapshot_uncertainty_m),"MEASUREMENT_SCOPE");
 must(raw.history.every((e,i,a)=>i===0||e.event_at>a[i-1].event_at),"HISTORY_CHRONOLOGY");
 up.validate(raw);
 for(const m of raw.leader_measurements){
 const e=raw.history.find(e=>e.id===m.event_id);must(e&&m.scope==="SYNTHETIC_LEADER_CROSSING_COMMON_START"&&Number.isFinite(m.uncertainty_ms)&&m.uncertainty_ms>=0,"LEADER_SCOPE");
 const d=m.distances_m,t=m.elapsed_ms;must(d.length===t.length&&d[0]===0&&t[0]===0&&d.at(-1)===e.conditions.distance_m&&d.slice(1).every((v,i)=>v>d[i])&&t.slice(1).every((v,i)=>v>t[i]),"LEADER_SEQUENCE");
 must(t.at(-1)===e.rows.find(r=>r.finish===1).finish_ms,"LEADER_FINISH");
 for(const [j,cp] of e.conditions.geometry.checkpoints_m.entries()){
 const k=d.indexOf(cp),r=e.rows.find(r=>r.ranks?.[j]===1);must(k>=0&&r&&(!r.checkpoint_ms||r.checkpoint_ms[j]===t[k]),"LEADER_RANK_CLOCK");
 for(const r of e.rows.filter(r=>r.checkpoint_ms))must(r.checkpoint_ms[j]>=t[k],"LEADER_CLOCK_MIN");
 }
 }
 return true;
}
function project27(raw,up){
 validate27(raw,up);const o=up.supply(raw,up.sha256);
 const all=o.evidence,lookup=new Map(all.map(e=>[e.evidence_id,e])),pointerMap=new Map(all.map(e=>[e.pointer,e]));
 const marginLinks=[];
 for(const e of o.events)for(const r of e.rows){if(!r.margin)continue;const w=pointerMap.get(r.margin.winner_pointer);if(!w||w.field!=="finish_ms"||w.event_id!==e.event_id)throw Error("WINNER_BINDING");r.margin.source_refs=[...new Set([...r.margin.source_refs,w.evidence_id])];r.margin.roots=r.margin.source_refs.map(k=>lookup.get(k).root);marginLinks.push({event:e.event_id,subject:r.id,value:r.margin.value,refs:r.margin.source_refs,roots:r.margin.roots});}
 const leaders=raw.leader_measurements.map((m,i)=>{const pointer="/leader_measurements/"+i,root="S27ROOT:"+up.sha256(JSON.stringify([raw.family,m.event_id,"leader_crossings"])),evidence_id="S27EV:"+up.sha256(JSON.stringify([root,o.raw_sha256,pointer]));const rec={evidence_id,root,source_sha256:o.raw_sha256,source_version:raw.source_version,case_id:raw.case_id,event_id:m.event_id,subject_id:null,field:"leader_crossings",pointer,state:"SYNTHETIC_OBSERVATION",value:m,reason:null,formal_usable:false};all.push(rec);return {event:m.event_id,ref:evidence_id,root,segments:m.elapsed_ms.slice(1).map((v,j)=>({from_m:m.distances_m[j],to_m:m.distances_m[j+1],elapsed_ms:v-m.elapsed_ms[j]})),individual_clock_inference:false};});
 const proximity=[];
 for(const e of o.events)for(const rel of e.relative){if(rel.a==="S26:A"&&rel.b==="S26:B")proximity.push({...rel,observed_proximity_m:[Math.abs(rel.start_gap_m),Math.abs(rel.end_gap_m)],actual_pressure:null,physiological_load:null,tolerance:null,reason:"SYNCHRONIZED_PROXIMITY_AND_PACE_NOT_DIRECT_PRESSURE_OR_LOAD"});}
 const active=o.active_ids,pairs=[];for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){const a=active[i],b=active[j],obs=o.pair_inputs.filter(p=>p.a===a&&p.b===b);pairs.push({a,b,observations:obs,actual_current_pressure:null,state:obs.length?"PAST_PAIR_OBSERVATIONS":"UNKNOWN_PAIR"});}
 const eBy=new Map(o.events.map(e=>[e.event_id,e]));for(const l of o.followups){if(!(eBy.get(l.reference_event).event_at<eBy.get(l.followup_event).event_at&&eBy.get(l.followup_event).observed_at<=raw.cutoff))throw Error("FOLLOWUP_TIME");}
 const followups=o.followups.map(l=>({subject:l.subject,opponent:l.opponent,reference_event:l.reference_event,followup_event:l.followup_event,later_event_key:l.later_event_key,link_key:l.link_key,reference_observation:l.reference_observation,later_observation:l.later_observation,temporal:{reference_at:eBy.get(l.reference_event).event_at,later_at:eBy.get(l.followup_event).event_at,observed_at:eBy.get(l.followup_event).observed_at,cutoff:raw.cutoff},strength:null}));
 // Compact output uses typed Work26 events, refs and explicit absence. No invented performance.
 return {schema:"WORK27_CODEX_CONTRAST_0.1",scope:raw.scope,case_id:raw.case_id,raw_sha256:o.raw_sha256,formal_admissions:0,analysis_sufficient:false,events:o.events,runners:o.runners,active_ids:active,unknown_active_ids:o.unknown_active_ids,evidence:all,leaders,proximity,pairs,followups,marginLinks,missing_followup:raw.case_id==="PEER_NO_ASOF"?{peer:"S26:X",event:"S26:H3",state:"NO_ADMISSIBLE_OBSERVATION",not_loss:true,reason:"EVENT_NOT_IN_ASOF_RAW"}:null,pressure_tolerance:{state:"UNRESOLVED",reason:"NO_DIRECT_PHYSIOLOGICAL_OR_MATCHED_LOAD_MEASUREMENT"},current_actual_starters:null};
}
export {make27,validate27,project27};

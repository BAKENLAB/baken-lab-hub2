import {common} from './common-evidence.mjs';
export function analyzePace58to77({target,roster,evidence=[],runs=[],history=[],gates=[],course=[],today=[],paceBenchmarks=[]}){
 const c=common(target,roster,evidence),{ts,unique,bound,identities,prior,add,close}=c;
 const validRuns=unique(runs.filter(prior),r=>r.horse_id+"|"+r.race_id);
 const position=r=>{if(!Number.isInteger(r.field_size)||r.field_size<1||!Array.isArray(r.positions))return [];return unique(r.positions.filter(p=>Number.isInteger(p.segment)&&p.segment>0&&Number.isInteger(p.rank_min)&&Number.isInteger(p.rank_max)&&p.rank_min>=1&&p.rank_max>=p.rank_min&&p.rank_max<=r.field_size),p=>p.segment).sort((a,b)=>a.segment-b.segment)};
 const early=r=>position(r).find(p=>p.segment===r.first_segment&&r.segment_definition_verified===true);
 const exact=(a,b)=>["course_id","course_version","surface","distance","going","class_key"].every(k=>a[k]!=null&&a[k]===b[k]);
 const allStates=roster.map(entry=>{
 const h=identities.find(x=>x.horse_no===entry.horse_no),own=validRuns.filter(r=>r.horse_id===h?.horse_id).sort((a,b)=>ts(b.started_at)-ts(a.started_at));
 const w=unique(history.filter(x=>h&&bound(x,h.horse_id,target.race_id)&&x.chronology_verified===true&&Array.isArray(x.ordered_race_ids)),x=>x.horse_id).find(x=>x.horse_id===h?.horse_id);
 const last=w&&own[0]?.race_id===w.ordered_race_ids[0]?own[0]:null;
 const p=last?position(last):[],ep=last?early(last):null;
 const full=last?.all_segments_verified===true&&Number.isInteger(last.expected_segments)&&last.expected_segments>0&&p.length===last.expected_segments&&last.segment_definition_verified===true;
 const front=p.some(q=>q.rank_max<=3)?"YES":full&&p.every(q=>q.rank_min>3)?"NO":"UNKNOWN";
 const lead=own.filter(r=>early(r)?.rank_max===1);
 const g=unique(gates.filter(x=>h&&x.horse_id===h.horse_id&&bound(x,h.horse_id,target.race_id)&&x.actual_gate_verified===true&&Number.isInteger(x.gate)&&x.gate>=1&&x.gate<=target.field_size),x=>x.horse_id)[0];
 return {entry,h,own,w,last,p,ep,front,lead,g};
 });
 const states=allStates.filter(s=>s.entry.active!==false);
 const known=states.filter(s=>s.front==="YES").length,unknown=states.filter(s=>s.front==="UNKNOWN").length;
 const allGate=states.length>0&&states.every(s=>s.g)&&new Set(states.map(s=>s.g?.gate)).size===states.length;
 const sorted=allGate?states.slice().sort((a,b)=>a.g.gate-b.g.gate):[];
 const lead=states.filter(s=>s.lead.some(r=>exact(r,target)));
 const allRefs=states.flatMap(s=>[s.last?.evidence_id,s.w?.evidence_id,s.g?.evidence_id].filter(Boolean));
 const g=unique(course.filter(x=>bound(x,null,target.race_id)&&x.course_id===target.course_id&&x.course_version===target.course_version&&x.distance===target.distance&&ts(x.effective_from)<=ts(target.started_at)&&ts(target.started_at)<ts(x.effective_until)),x=>x.course_id)[0];
 const todayRaces=unique(today.filter(r=>bound(r,null,r.race_id)&&r.race_id!==target.race_id&&r.circuit===target.circuit&&r.local_date===target.local_date&&r.course_id===target.course_id&&r.course_version===target.course_version&&r.surface===target.surface&&ts(r.started_at)<c.cutoff&&ts(c.byId.get(r.evidence_id).published_at_or_null)>ts(r.started_at)&&r.complete_field_verified===true&&Array.isArray(r.results)&&r.results.length===r.field_size&&unique(r.results,q=>q.horse_id).length===r.field_size),r=>r.race_id);
 const positionRefs=new Map(validRuns.filter(r=>r.position_evidence_id&&c.byId.has(r.position_evidence_id)).map(r=>[r.evidence_id,r.position_evidence_id]));
 const runners=allStates.map(s=>{
 const {h,own,w,last,p,ep,front}=s,I=c.items(58,77),put=(n,v,refs,kind="facts")=>add(I,n,kind,v,[...refs,...(["58","59","60","61","62","63","64","65","66","68","69","70","71","72","73","74","75"].includes(String(n))?refs.map(e=>positionRefs.get(e)).filter(Boolean):[])]);
 if(s.entry.active===false){for(const v of Object.values(I))v.unknowns.push('INACTIVE_NOT_APPLICABLE');return {horse_no:s.entry.horse_no,horse_id:null,items:I};}
 if(!h||!h.horse_id){for(const v of Object.values(I))v.unknowns.push("IDENTITY_UNVERIFIED");return {horse_no:s.entry.horse_no,horse_id:null,items:I}}
 const hist=own.filter(r=>position(r).length).map(r=>({race_id:r.race_id,field_size:r.field_size,positions:position(r),conditions_match:exact(r,target),finish:r.finish??null,evidence_id:r.evidence_id}));
 if(hist.length)put("58",{segment_positions:hist,style_distribution:{early_observed:own.filter(early).length,early_lead:own.filter(r=>early(r)?.rank_max===1).length,early_top3:own.filter(r=>early(r)?.rank_max<=3).length,early_outside_top3:own.filter(r=>early(r)?.rank_min>3).length,early_ambiguous_or_missing:own.filter(r=>!early(r)||early(r).rank_min<=3&&early(r).rank_max>3).length}},hist.map(r=>r.evidence_id));
 if(last)put("59",{last_run_id:last.race_id,top3_any_corner:front,early_top3:ep?ep.rank_max<=3?"YES":ep.rank_min>3?"NO":"UNKNOWN":"UNKNOWN",late_only:ep?.rank_min>3&&p.some(q=>q.segment!==ep.segment&&q.rank_max<=3)},[last.evidence_id,w.evidence_id]);
 const frequency=rs=>({n:rs.length,observed:rs.filter(early).length,early_front:rs.filter(r=>early(r)?.rank_max<=3).length,unknown:rs.filter(r=>!early(r)||early(r).rank_min<=3&&early(r).rank_max>3).length});
 if(own.length){put("60",{long_term:frequency(own.filter(r=>exact(r,target))),recent:w?frequency(w.ordered_race_ids.slice(0,5).map(id=>own.find(r=>r.race_id===id)).filter(Boolean).filter(r=>exact(r,target))):null,prior5_missing:w?w.ordered_race_ids.slice(0,5).filter(id=>!own.some(r=>r.race_id===id)).length:null},own.map(r=>r.evidence_id));
 const e=own.filter(early);if(e.length)put("62",{lead:e.filter(r=>early(r).rank_max===1).map(r=>({race_id:r.race_id,finish:r.finish??null})),nonlead:e.filter(r=>early(r).rank_min>1).map(r=>({race_id:r.race_id,finish:r.finish??null})),dependence_hypothesis:null},e.map(r=>r.evidence_id));}
 put("63",{known_front:known,unknown,active_n:states.length,lower:states.length?known/states.length:null,upper:states.length?(known+unknown)/states.length:null,band_hypothesis:null},allRefs);
 if(s.lead.length)put("61",{observed_leads:s.lead.map(r=>r.race_id),matching_leads:s.lead.filter(r=>exact(r,target)).map(r=>r.race_id),candidate_ids:lead.map(x=>x.h.horse_id)},[...s.lead.map(r=>r.evidence_id),...lead.flatMap(x=>x.lead.map(r=>r.evidence_id))],"hypotheses");
 if(allGate){const j=sorted.indexOf(s),left=sorted[j-1],right=sorted[j+1];put("64",{gate_order:sorted.map(x=>({horse_id:x.h.horse_id,gate:x.g.gate,front:x.front}))},allRefs);
 const pattern=!left||!right?"NOT_APPLICABLE":s.front==="NO"&&left.front==="YES"&&right.front==="YES"?"PATTERN":s.front==="UNKNOWN"||left.front==="UNKNOWN"||right.front==="UNKNOWN"?"UNKNOWN":"NO_PATTERN";
 put("66",{pattern,left_right_ids:[left?.h.horse_id??null,right?.h.horse_id??null],realized_benefit:null},allRefs,"hypotheses");}
 if(g){if(g.straight_only===true)I["67"].unknowns.push("NOT_APPLICABLE_STRAIGHT");else if(Number.isFinite(g.first_turn_m)&&g.first_turn_m>0&&["exact","approximate"].includes(g.first_turn_precision))put("67",{first_turn_m:g.first_turn_m,precision:g.first_turn_precision,course_version:g.course_version},[g.evidence_id]);}
 if(lead.includes(s)&&lead.length>1)put("65",{competition_edges:lead.filter(x=>x!==s).map(x=>[h.horse_id,x.h.horse_id]),scenarios:["CONTEST","YIELD"],pace_conclusion:null},lead.flatMap(x=>x.lead.map(r=>r.evidence_id)),"hypotheses");
 if(ep)put("68",{prior_early_rank:[ep.rank_min,ep.rank_max],scenarios:lead.includes(s)?["LEAD_OR_CONTEST","YIELD"]:["POSITION_UNCERTAIN"]},[last.evidence_id],"hypotheses");
 if(lead.length){const groups=lead.map(x=>x.h.horse_id);put("70",{scenario_id:"LEAD_CANDIDATE_GROUP",lead_candidates:groups,uncertain_horses:states.filter(x=>!lead.includes(x)).map(x=>x.h?.horse_id??null),strict_order:null},lead.flatMap(x=>x.lead.map(r=>r.evidence_id)),"hypotheses");}
 if(g&&allGate&&lead.includes(s)&&lead.length>1)put("71",{scenario_id:"CONTEST",route_loss_risk:"UNRESOLVED",distance_loss_m:null},[g.evidence_id,...allRefs],"hypotheses");
 if(lead.includes(s)&&lead.length>1)put("72",{scenarios:["PRESSURE_PERSISTS","PRESSURE_EASES"],historical_refs:s.lead.map(r=>r.evidence_id),individual_fatigue:null},s.lead.map(r=>r.evidence_id),"hypotheses");
 const comparable=own.filter(r=>exact(r,target)&&early(r));
 if(comparable.length){const obs=comparable.map(r=>({race_id:r.race_id,early:early(r),finish:r.finish??null,race_pace:r.verified_race_pace??null}));put("74",{observations:obs,adaptability:null},comparable.map(r=>r.evidence_id));put("75",{observations:obs,dependency:null},comparable.map(r=>r.evidence_id),"hypotheses");}
 if(todayRaces.length){const refs=todayRaces.map(r=>r.evidence_id);const obs=todayRaces.flatMap(r=>r.results.filter(q=>Number.isInteger(q.gate)&&q.gate>=1&&q.gate<=r.field_size&&Number.isInteger(q.finish)&&q.finish>=1&&q.finish<=r.field_size).map(q=>({race_id:r.race_id,gate:q.gate,field_size:r.field_size,finish:q.finish})));if(obs.length)put("76",{observations:obs,n_races:todayRaces.length,proxy_flag:"GATE_NOT_ROUTE",bias:null},refs);
 const pos=todayRaces.flatMap(r=>r.results.filter(q=>Number.isInteger(q.early_rank)&&q.early_rank>=1&&q.early_rank<=r.field_size&&Number.isInteger(q.finish)&&q.finish>=1&&q.finish<=r.field_size).map(q=>({race_id:r.race_id,early_rank:q.early_rank,finish:q.finish,field_size:r.field_size})));if(pos.length)put("77",{observations:pos,n_races:todayRaces.length,n_runners:pos.length,bias:null},refs);}

 const benchmark=unique(paceBenchmarks.filter(b=>bound(b,null,b.race_id)&&b.race_id!==target.race_id&&b.circuit===target.circuit&&exact(b,target)&&ts(b.started_at)<c.cutoff&&ts(c.byId.get(b.evidence_id).published_at_or_null)>ts(b.started_at)&&b.race_level_only===true&&b.early_segment_m===target.early_segment_m&&Number.isFinite(b.early_segment_m)&&b.early_segment_m>0&&Number.isFinite(b.early_seconds)&&b.early_seconds>0),b=>b.race_id);
 if(benchmark.length){
   const values=benchmark.map(b=>b.early_seconds).sort((a,b)=>a-b),middle=(values[Math.floor(values.length/2)]+values[Math.floor((values.length-1)/2)])/2;
   const hypotheses=lead.length>1?["CONTEST_PERSISTS","CONTEST_EASES"]:lead.length===1?["SINGLE_LEAD_CANDIDATE","LEAD_UNCERTAIN"]:["LEAD_UNCERTAIN"];
   put("69",{benchmark_n:values.length,observed_range_seconds:[values[0],values.at(-1)],median_seconds:middle,early_segment_m:target.early_segment_m,scenario_assumptions:hypotheses,pace_band:null,probability:null,race_level_only:true},[...benchmark.map(b=>b.evidence_id),...allRefs],"hypotheses");
   const sample=own.filter(r=>exact(r,target)&&early(r)&&Number.isInteger(r.finish)&&r.finish>=1&&r.finish<=r.field_size&&benchmark.some(b=>b.race_id===r.race_id));
   if(sample.length)put("73",{scenario_candidates:hypotheses,historical_observations:sample.map(r=>({race_id:r.race_id,early_rank:early(r),finish:r.finish,early_seconds:benchmark.find(b=>b.race_id===r.race_id).early_seconds})),scenario_fit:null,uncertainty:"UNVALIDATED_CURRENT_ABILITY"},[...sample.map(r=>r.evidence_id),...benchmark.map(b=>b.evidence_id)],"hypotheses");
 }
 I["69"].unknowns.push("PACE_SCENARIO_CALIBRATION_REQUIRED");I["73"].unknowns.push("SCENARIO_FIT_REQUIRES_ABILITY_AND_COUNTEREVIDENCE_BINDING");
 return {horse_no:s.entry.horse_no,horse_id:h.horse_id,items:close(I)};
 });
 return c.finish(runners,58,77);
}

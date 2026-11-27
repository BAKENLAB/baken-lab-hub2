// Research projection only; verify exact bytes and upstream source custody before use.
function sha256(s){
 const bytes=Array.from(encodeURIComponent(s).match(/%[0-9A-F]{2}|./g)||[],x=>x[0]==="%"?parseInt(x.slice(1),16):x.charCodeAt(0)), n=bytes.length;
 const k=[],h=[];for(let p=2;k.length<64;p++){if(Array.from({length:Math.floor(Math.sqrt(p))-1},(_,i)=>i+2).some(d=>p%d===0))continue;if(h.length<8)h.push((Math.sqrt(p)%1*4294967296)|0);k.push((Math.cbrt(p)%1*4294967296)|0)}
 bytes.push(128);while(bytes.length%64!==56)bytes.push(0);for(let i=7;i>=0;i--)bytes.push(Math.floor(n*8/2**(i*8))&255);
 const r=(x,n)=>(x>>>n)|(x<<(32-n));for(let i=0;i<bytes.length;i+=64){const w=[];for(let j=0;j<16;j++)w.push((bytes[i+4*j]<<24)|(bytes[i+4*j+1]<<16)|(bytes[i+4*j+2]<<8)|bytes[i+4*j+3]);for(let j=16;j<64;j++){let a=w[j-15],b=w[j-2];w.push((w[j-16]+(r(a,7)^r(a,18)^(a>>>3))+w[j-7]+(r(b,17)^r(b,19)^(b>>>10)))|0)}let [a,b,c,d,e,f,g,z]=h;for(let j=0;j<64;j++){let t=(z+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+k[j]+w[j])|0,u=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;z=g;g=f;f=e;e=(d+t)|0;d=c;c=b;b=a;a=(t+u)|0} [a,b,c,d,e,f,g,z].forEach((v,j)=>h[j]=(h[j]+v)|0)}return h.map(x=>(x>>>0).toString(16).padStart(8,"0")).join("");
}
function project(p,s,pin){
 const must=(v,m)=>{if(!v)throw Error(m)},none=reason=>({state:"MISSING",reason,value:null}),good=e=>e?.state==="TEST_INPUT_AVAILABLE";
 must(p.schema==="WORK23_SYNTHETIC_HANDOFF_0.2"&&s.schema==="WORK24_SUPPLEMENT_0.1"&&p.scope==="SYNTHETIC_ONLY"&&s.scope==="SYNTHETIC_ONLY"&&p.formal_admissions===0&&s.formal_admissions===0&&p.formal_eligible===false&&s.formal_eligible===false&&p.status===s.status&&p.event===s.event&&p.issuer===s.issuer,"SCOPE");
 must(["ref","path","blob","sha256"].every(k=>s.parent_packet[k]===pin.original[k]),"PIN");
 const out={schema:"WORK25_PACE_OBSERVATIONS_0.1",scope:"SYNTHETIC_ONLY",pins:pin,status:p.status,event:p.event,formal_admissions:0,analysis_sufficient:false,events:[],runners:[],followups:[]};
 if(p.status==="HELD"){must(!p.evidence.length&&!s.extensions.length&&!s.events.length&&!s.runners.length&&s.global_items.length===115,"HELD_LEAK");out.reason=p.reason;return out}
 must(p.status==="TEST_ONLY_PACKET","STATUS");
 const ev=new Map(p.evidence.map(e=>[e.evidence_id,e])),st=new Map(p.field_states.map(e=>[e.evidence_id,e])),ex=new Map(s.extensions.map(e=>[e.evidence_id,e]));
 must(ev.size===p.evidence.length&&st.size===p.field_states.length&&ex.size===s.extensions.length&&[...ex.keys()].every(k=>!st.has(k)),"DUPLICATE");
 const admissible=e=>good(e)&&e.formal_usable===false&&e.registry_sha===p.registry_sha&&e.source_version===p.selected_version&&e.published_at<=e.observed_at&&e.observed_at<=p.cutoff;
 for(const e of ev.values())must(admissible(e)&&good(st.get(e.evidence_id)),"PARENT");
 const lookup=k=>{const e=ev.get(k)||ex.get(k);return admissible(e)&&(!ex.has(k)||e.depends_on.every(k=>admissible(ev.get(k))))?e:null};
 const ref=(k,name,event,subject)=>{const e=lookup(k);if(!e)return {...none((st.get(k)||ex.get(k))?.reason||"FIELD_UNAVAILABLE"),ref:k??null};must(e.field===name&&e.event_id===event&&e.subject_id===subject,"FIELD_BINDING");return {state:"OBSERVED",ref:k,root:e.root,value:e.value}};
 const f=(event,subject,name)=>ref(p.field_states.find(e=>e.event_id===event&&e.subject_id===subject&&e.field===name)?.evidence_id,name,event,subject);
 for(const e of s.events){
  const cur=e.event_role==="CURRENT_CARD",id=e.event_id;must(cur?id===p.event:e.event_at<p.cutoff&&e.published_at<=e.observed_at&&e.observed_at<=p.cutoff,"TIME");
  const c=f(id,null,"conditions"),g=f(id,null,"course_geometry"),n=ref(e.field_count_ref,cur?"registered_count":"historical_field_count",id,null);
  const geo=g.state==="OBSERVED"&&c.state==="OBSERVED"&&g.value.effective[0]<=e.event_at&&e.event_at<g.value.effective[1]&&[g.value.first_turn_m,g.value.straight_m,...g.value.checkpoints_m].every(v=>Number.isInteger(v)&&v>=0&&v<=c.value.distance_m)&&g.value.checkpoints_m.every((v,i,a)=>i===0||v>a[i-1])?g:none("GEOMETRY_OR_DISTANCE_UNVERIFIED");
  const cls=c.state==="OBSERVED"&&c.value.class_effective[0]<=e.event_at&&e.event_at<c.value.class_effective[1]?{state:"OBSERVED_LABEL_ONLY",ref:c.ref,root:c.root,value:c.value.class_id,effective:c.value.class_effective}:none("CLASS_INTERVAL_UNVERIFIED");
  const rows=e.rows.map(r=>{
   const ident=f(id,r.subject_id,cur?"current_runner":"historical_runner_identity"),verified=ident.state==="OBSERVED";
   const row={id:r.subject_id,identity:ident,horse_number:verified?{state:"SOURCE_ROW_NUMBER",value:cur?ident.value.no:r.historical_no,identity_ref:ident.ref}:none("IDENTITY_UNVERIFIED"),gate:none("NATIVE_GATE_NOT_SUPPLIED"),status:verified?r.status:null,initial_acceleration:none("NO_INDIVIDUAL_START_MEASUREMENT"),intermediate_clock:none("NO_INDIVIDUAL_CHECKPOINT_CLOCK"),physical_gain:none("NO_MEASURED_INTERHORSE_DISTANCE"),rank_path:none("NO_VERIFIED_CHECKPOINT_PATH")};
   if(cur||!verified||r.status!=="FINISHED")return row;
   const cp=f(id,r.subject_id,"checkpoint_positions");row.finish=f(id,r.subject_id,"finish");row.finish_clock=f(id,r.subject_id,"finish_clock");row.final600=f(id,r.subject_id,"individual_final3f");row.margin=f(id,r.subject_id,"margin_to_winner");
   if(cp.state==="OBSERVED"&&geo.state==="OBSERVED"&&n.state==="OBSERVED"&&e.complete_for_field_comparison&&cp.value.length===geo.value.checkpoints_m.length&&cp.value.length>0&&cp.value.every(v=>Number.isInteger(v)&&v>=1&&v<=n.value)){
    const points=cp.value.map((rank,i)=>({rank,distance_m:geo.value.checkpoints_m[i],field_count:n.value}));
    row.rank_path={state:"OBSERVED_ORDINAL_ONLY",refs:[cp.ref,geo.ref,n.ref],roots:[cp.root,geo.root,n.root],first_observed:points[0],points,transitions:points.slice(1).map((b,i)=>({from_m:points[i].distance_m,to_m:b.distance_m,ordinal_gain:points[i].rank-b.rank,kind:points[i].rank>b.rank?"RANK_GAIN":points[i].rank<b.rank?"RANK_LOSS":"RANK_UNCHANGED"})),not_acceleration:true,not_physical_gain:true};
   }else row.rank_path={...none("CHECKPOINT_GEOMETRY_COUNT_OR_IDENTITY_UNAVAILABLE"),dependencies:[cp,geo,n].map(x=>({state:x.state,ref:x.ref??null,reason:x.reason??null}))};
   return row;
  });
  out.events.push({id,at:e.event_at,current:cur,conditions:c.state==="OBSERVED"?{...c,value:{venue:c.value.venue,surface:c.value.surface,distance_m:c.value.distance_m,going:c.value.going,direction:c.value.direction}}:c,geometry:geo,count:n,class_label:cls,class_rules:none("OFFICIAL_CLASS_RULES_NOT_SUPPLIED"),strength:none("NO_VALIDATED_STRENGTH_REFERENCE"),leader_laps:cur?none("CURRENT_RACE_NOT_RUN"):f(id,null,"race_leader_laps"),rows});
 }
 const target=out.events.find(e=>e.current);must(target&&out.events.filter(e=>e.current).length===1,"TARGET");
 for(const r of p.runners){
  const row=target.rows.find(x=>x.id===r.id);must(row&&row.status===r.status&&row.horse_number.value===r.no,"RUNNER_BINDING");
  const history=out.events.filter(e=>!e.current&&e.rows.some(x=>x.id===r.id)).map(e=>{const h=e.rows.find(x=>x.id===r.id),a=e.conditions,b=target.conditions,ok=h.identity.state==="OBSERVED"&&a.state==="OBSERVED"&&b.state==="OBSERVED";const d=ok?b.value.distance_m-a.value.distance_m:null;return {event:e.id,rank_path:h.rank_path,distance_change:ok?{state:"OBSERVED_CONDITION_DELTA_ONLY",value:d,kind:d>0?"EXTENSION":d<0?"SHORTENING":"SAME_DISTANCE",refs:[a.ref,b.ref],roots:[a.root,b.root]}:none("CONDITION_OR_IDENTITY_UNVERIFIED"),response:none("NO_CAUSAL_DISTANCE_RESPONSE_PROOF")}});
  out.runners.push({id:r.id,no:r.no,status:r.status,gate:row.gate,history:r.status==="ACTIVE"?history:[],early_role:none(r.status==="ACTIVE"?"FIRST_OBSERVED_RANK_NOT_CURRENT_ROLE_PROOF":"NOT_ACTIVE"),scenario:none("REQUIRES_FULL_FIELD_ANALYSIS")});
 }
 for(const rel of s.relations.filter(x=>x.type==="OPPONENT_LATER_PRIOR_TO_CUTOFF")){
  const a=out.events.find(e=>e.id===rel.reference_event),b=out.events.find(e=>e.id===rel.followup_event),x=a?.rows.find(r=>r.id===rel.opponent_id),y=b?.rows.find(r=>r.id===rel.opponent_id);
  if(!a||!b||a.at>=b.at||b.at>=p.cutoff||!rel.followup_is_later||!x||!y||x.identity.state!=="OBSERVED"||y.identity.state!=="OBSERVED"||!rel.evidence_ids.every(k=>lookup(k)))continue;
  out.followups.push({subject:rel.subject_id,opponent:rel.opponent_id,reference_event:a.id,followup_event:b.id,reference_finish:x.finish??none("FINISH_UNAVAILABLE"),followup_finish:y.finish??none("FINISH_UNAVAILABLE"),reference_conditions:a.conditions,followup_conditions:b.conditions,reference_count:a.count,followup_count:b.count,reference_class:a.class_label,followup_class:b.class_label,refs:rel.evidence_ids,independence_key:[rel.opponent_id,a.id,b.id].join("|"),strength:none("OBSERVATIONS_NOT_STRENGTH_PROOF")});
 }
 return out;
}
export {sha256,project};

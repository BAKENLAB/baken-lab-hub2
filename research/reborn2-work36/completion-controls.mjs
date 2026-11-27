// Targeted synthetic evidence completion controls, no grading logic.
import assert from 'node:assert/strict';
const copy=x=>JSON.parse(JSON.stringify(x));
export function completionFixtures(raw){
 const f=raw.fixtures.find(x=>x.id==='FK34_FULL');assert.ok(f);
 const original=copy(f.docs), card=original[0], by=id=>original.find(d=>d.eventId==='TEST:'+id);
 const base=[card,by('LONE'),by('COUNTER')];
 const gen=(id,at,clocks,template=by('COUNTER'))=>{
  const d=copy(template);d.eventId='TEST:'+id;d.eventAt=at;d.publishedAt=at+1;d.updatedAt=at+2;
  for(const [i,r] of d.rows.entries()){r.checkpointMs=clocks[i].slice(0,3);r.clockMs=clocks[i][3];r.final600Ms=r.clockMs-r.checkpointMs[1];}
  const rank=(r,key)=>[...d.rows].sort((a,b)=>key(a)-key(b)).indexOf(r)+1;
  for(const r of d.rows){r.finish=rank(r,x=>x.clockMs);r.checkpointRanks=[0,1,2].map(j=>rank(r,x=>x.checkpointMs[j]));r.officialMargin=r.finish===1?null:'TEST_LITERAL';}
  const elapsed=[0,...[0,1,2].map(j=>Math.min(...d.rows.map(r=>r.checkpointMs[j]))),Math.min(...d.rows.map(r=>r.clockMs))];
  d.leaderLaps.valuesMs=elapsed.slice(1).map((t,i)=>t-elapsed[i]);d.passing.groups=[...d.rows].sort((a,b)=>a.checkpointMs[0]-b.checkpointMs[0]).map(r=>[r.no]);return d;
 };
 // H4 never beat H2 in baseline. Two distinct pre-cutoff source observations, not duplicates of old RECOVERY_A/B.
 const posA=gen('W36_POS_A',60,[[12500,49300,74400,86400],[11700,48000,73300,85800],[13700,50500,75000,87000],[12300,50200,73900,84900],[11900,48200,75700,89000]]);
 const posB=gen('W36_POS_B',63,[[12800,49600,74700,87000],[11600,48100,73700,86300],[13600,50400,74600,86500],[12200,51400,74900,85200],[12000,48500,76600,90000]]);
 const counter=gen('W36_COUNTER_MATCHED',66,[[12500,49300,74400,86400],[11700,48000,73300,85000],[13700,50500,75000,87000],[12300,50200,76600,89000],[11900,48200,75700,87500]]);
 const other=copy(counter);other.eventId='TEST:W36_COUNTER_OTHER_GOING';other.eventAt=69;other.publishedAt=70;other.updatedAt=71;other.conditions.going='TEST:SOFT';
 const master=[...base,posA,posB,counter,other];
 const select=(id,events)=>({id,docs:copy(master.filter(d=>events.includes(d.eventId)))});
 const baseIds=base.map(d=>d.eventId),posIds=[posA.eventId,posB.eventId],admitted=[...baseIds,...posIds];
 const fixtures=[select('W36_BASE',baseIds),select('W36_POSITIVE',admitted),select('W36_WITHDRAWN',baseIds),select('W36_RELEVANT_COUNTER',[...admitted,counter.eventId]),select('W36_OTHER_COUNTER',[...admitted,other.eventId]),select('W36_NEGATIVE_ONLY',[...baseIds,counter.eventId])];
 // Single-factor target controls, not synthetic proof that changing a condition caused performance.
 for(const dim of ['going','weight','gate','course','distance','joint']){
  const v=copy(base);const t=v[0];
  if(dim==='going'||dim==='joint')t.conditions.going='TEST:SOFT';
  if(dim==='weight'||dim==='joint')t.rows[0].weightG=57000;
  if(dim==='gate'){[t.rows[0].gate,t.rows[1].gate]=[t.rows[1].gate,t.rows[0].gate];}
  if(dim==='course'||dim==='joint'){t.geometry.straight_m=350;t.geometry.course_version='TEST:COURSE_A2';}
  if(dim==='distance'){t.conditions.distance_m=1600;t.geometry.checkpoints_m=[200,1000,1400];t.geometry.course_version='TEST:COURSE_1600';}
  fixtures.push({id:'W36_CONTEXT_'+dim.toUpperCase(),docs:v});
 }
 // Separate event-level conflict from missing one horse's checkpoint. Shared leader lap intentionally inconsistent.
 const single=copy(base);single[1].rows[4].checkpointMs=null;single[1].rows[4].checkpointRanks=null;
 const shared=copy(base);shared[1].leaderLaps.valuesMs[0]+=500;shared[1].leaderLaps.valuesMs[1]-=500;
 fixtures.push({id:'W36_LOCAL_MISSING',docs:single},{id:'W36_SHARED_CONFLICT',docs:shared});
 // Independent opponent result: H6 is an opponent in one H1 history, then runs again at a different stipulated class.
 // These are literal class contexts and opponent finishes, not a class-strength scale.
 const peer=gen('W36_PEER_DIRECT',60,[[12500,49300,74400,86400],[11700,48000,73300,85800],[13700,50500,75000,87000],[12300,50200,73900,84900],[11900,48200,75700,89000]]);peer.rows[4].nativeId='TEST:H6';
 const later=gen('W36_PEER_LATER',65,[[12500,49300,74400,86400],[11700,48000,73300,85800],[13700,50500,75000,87000],[12300,50200,73900,84900],[11900,48200,75700,83900]]);later.rows[4].nativeId='TEST:H6';later.conditions.class_label='TEST:CLASS_HIGH';later.conditions.class_version='TEST:CLASS_V2';
 fixtures.push({id:'W36_PEER_CLASS',docs:copy([...base,peer,later])});
 return {master,fixtures,scope:'FICTIONAL_OBSERVATIONS_AND_ADMISSION_MASKS_NOT_OFFICIAL'};
}
export async function runControls({raw,sha,producer,adapter,normal,common}){
 const {master,fixtures}=completionFixtures(raw),checks=[],results=[];
 const check=(id,ok)=>{assert.ok(ok,id);checks.push(id);console.log('WORK36_CONTROL '+id+' PASS');};
 const byId=new Map();
 for(const f of fixtures){
  const {input,registry,out}=producer.run31(f.docs,raw.canonical,sha);
  check(f.id+':PACKET',out.state==='TEST_PACKET'&&out.digest===sha(JSON.stringify(out.packet)));
  const q={n:f.id,input,registry,expectedDigest:out.digest},txt=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical:raw.canonical,cases:[q]})+'\n',bundle=sha(txt);
  const v=adapter.verify32(txt,f.id,out,sha,producer.pipeline31,producer.verifier31,bundle);
  check(f.id+':ENVELOPE',v.state==='VERIFIED_SYNTHETIC_ENVELOPE');
  const pin={id:f.id,source_digest:out.digest,bundle_sha256:bundle,evidence:out.packet.evidence.length,itemRows:575,blob:null};
  const V={C:{...normal.C,fixtures:[f],receipt:{summary:[pin]}},fixed:new Map([[f.id,{raw:{raw:f.docs},pin}]])};
  const z=common.analyzeV34(V,f.id,{placeThreshold:2,eyeEnabled:true});
  check(f.id+':COMMON',z.runners.length===5&&z.roster.possible_active.length===5&&z.runners.every(h=>h.items.length===115&&h.axes.length===5&&h.grade===null)&&z.formal===false);
  const h=z.runners.find(x=>x.slot.endsWith('|TEST:H4'));
  const items=h.items.filter(i=>['RANK18','RANK21','RANK35','RANK100','EYE03'].includes(i.item)).map(i=>({item:i.item,refs:i.refs,findings:i.v33_findings??[],review:i.v34_reanalysis??[]}));
  const compact={id:f.id,digest:out.digest,bundle,evidence:out.packet.evidence.length,roster:z.roster,grades:z.runners.map(h=>h.research_grade),h4:{items,axes:h.axes.map(a=>({axis:a.axis,state:a.state})),win:h.WIN?.comparable_paths?.map(p=>p.event),place:h.PLACE?.comparable_paths?.map(p=>p.event)},feedback:z.feedback.filter(x=>x.subject.endsWith('|TEST:H4')).map(x=>({id:x.id,state:x.state,refs:x.refs,counter_refs:x.counter_refs,before:x.before.envelope,after:x.after.envelope})),contexts:z.scenarios.filter(s=>s.kind==='OBSERVED_FIELD_RESPONSE_SCENARIO').map(s=>({id:s.id,applicability:s.applicability,knownField:s.knownField,paceUsable:s.paceUsable,knownEdges:s.edges.filter(e=>e.interval_ms).length})),followups:out.packet.followups.filter(x=>x.peer==='TEST:H6'),issues:out.packet.issues};
  results.push(compact);byId.set(f.id,{f,z,out,compact});
 }
 const b=byId.get('W36_BASE'),p=byId.get('W36_POSITIVE'),w=byId.get('W36_WITHDRAWN'),n=byId.get('W36_NEGATIVE_ONLY');
 const rootIds=x=>new Set(x.out.packet.evidence.map(e=>e.evidenceId));
 const bs=rootIds(b),ps=rootIds(p);const added=p.out.packet.evidence.filter(e=>!bs.has(e.evidenceId)&&['TEST:W36_POS_A','TEST:W36_POS_B'].includes(e.event));
 check('ADMISSION_BASE_ROOTS_PRESERVED',[...bs].every(id=>ps.has(id)));
 check('ADMISSION_POSITIVE_ROOTS_NEW',added.some(e=>e.subject==='TEST:H4'&&e.field==='checkpoint_ms')&&added.some(e=>e.subject==='TEST:H4'&&e.field==='finish'));
 const ahead=(docs)=>docs.filter(d=>d.kind==='HISTORICAL_RESULT').map(d=>({id:d.eventId,h4:d.rows.find(r=>r.nativeId==='TEST:H4').finish,h2:d.rows.find(r=>r.nativeId==='TEST:H2').finish}));
 check('NEW_PAIR_SUPERIORITY_NOT_IN_BASE',ahead(b.f.docs).every(x=>x.h4>x.h2)&&ahead(p.f.docs).some(x=>x.h4<x.h2));
 check('WITHDRAWAL_EXACT_BASE',JSON.stringify(b.f.docs)===JSON.stringify(w.f.docs)&&b.out.digest===w.out.digest);
 check('NEGATIVE_ONLY_NO_POSITIVE_ROOT',n.out.packet.evidence.every(e=>!['TEST:W36_POS_A','TEST:W36_POS_B'].includes(e.event)));
 check('PEER_FOLLOWUP_PRESENT',byId.get('W36_PEER_CLASS').compact.followups.length>0);
 return {scope:'SYNTHETIC_ONLY',master,fixtures,checks,results,added_roots:added.map(e=>({id:e.evidenceId,event:e.event,subject:e.subject,field:e.field,root:e.root,dependencies:e.dependencies})),limitations:['Source selection is explicit admission mask over one master; not an isolated EYE gate within common packet. Existing analyzer grades are diagnostic only.','Class labels and follow-up finish do not establish class-strength transfer.','Context variants change target conditions only; no isolated causal effect.','No actual observed current role, physiological load, or official evidence.']};
}

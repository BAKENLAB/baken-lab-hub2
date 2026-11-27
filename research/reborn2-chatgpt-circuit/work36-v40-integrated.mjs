// V40: fixed Work36 evidence intake + immutable analysis admission + evidence-cross research.
// Only synthetic research. Current role/pace, physiological state and full coverage remain unobserved.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {loadV38,analyzeV38} from './work35-v38-completion.mjs';
import {completionFixtures} from './work36-pinned/completion-controls.mjs';
import {run31,pipeline31,verifier31} from './work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
import {jointField} from './work29-v30-terminal.mjs';
import {orderOracle} from './work35-v39-decision.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const read=n=>readFileSync(new URL(n,import.meta.url));
const H=n=>'TEST:NAR|TEST:H'+n, E=n=>'TEST:'+n, ns=n=>'TEST:NAR|'+n;
const uniq=a=>[...new Set(a)].sort(), eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const candidates=['W36_POS_A','W36_POS_B','W36_COUNTER_MATCHED','W36_COUNTER_OTHER_GOING'].map(E);
const named=(s,t)=>s.event===ns(E(t));
const t=(id,f)=>{f();console.log(id+' PASS');};
function pin(n,b,s){const x=read(n);assert.equal(blob(x),b,n);if(s)assert.equal(sha(x),s,n);return x;}
function buildPacket(C,f){
 const {input,registry,out}=run31(f.docs,C.canonical,sha);
 assert.equal(out.state,'TEST_PACKET');assert.equal(out.digest,sha(JSON.stringify(out.packet)));
 const q={n:f.id,input,registry,expectedDigest:out.digest},txt=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical:C.canonical,cases:[q]})+'\n';
 const bundle=sha(txt),v=C.verify32(txt,f.id,out,sha,pipeline31,verifier31,bundle);
 assert.equal(v.state,'VERIFIED_SYNTHETIC_ENVELOPE');
 const p={id:f.id,source_digest:out.digest,bundle_sha256:bundle,evidence:out.packet.evidence.length,itemRows:575,blob:null};
 return {f,p,out};
}
export async function loadV40(){
 const W=await loadV38();
 const m=JSON.parse(pin('./work36-pinned/stage36-final-handoff-v0.1.json','cbc9b646d925011c3b494877cea56766fc694746'));
 assert.equal(m.scope,'SYNTHETIC_ONLY');assert.equal(m.ci.head,'8aa9fce53eec7163ab2580f45baff9a68cdd9a2c');
 assert.equal(m.canonical,115);assert.equal(m.groups,118);assert.equal(m.held,826);
 const c=m.pins.find(p=>p.path.endsWith('/completion-controls.mjs'));
 pin('./work36-pinned/completion-controls.mjs',c.blob,c.sha256);
 pin('./work32-pinned/stage32-condition-pipeline-v0.1.2.mjs','93d87bb022dae3bae021ba62fc433504bc16f924','2d1a8a6c6d6f15504a660478f60a626d47ec3ec6dee8a94175b82e920dd7fa23');
 pin('./work32-pinned/stage32-verified-common-adapter-v0.1.2.mjs','1693dfd4657483a1f9e457188c28b38b9d8b2166','098f94a2738d68d30030403788dc15f707dba4438719256f08b846403fba0e92');
 pin('./work34-pinned/stage34-raw-fixtures-v0.2.json','21fc312418165985504fb6c230ebeb3321ae9ae6','ec46adc52a23545a1f923956b919407ec95f081ed26ecdbbc5e0b7f918c28555');
 const raw={canonical:W.C.canonical,fixtures:W.C.fixtures};
 const {master,fixtures}=completionFixtures(raw);
 assert.equal(fixtures.length,15);assert.equal(new Set(fixtures.map(f=>f.id)).size,15);
 const masterFixture={id:'W36_MASTER_IMMUTABLE',docs:master};
 const generated=[...fixtures,masterFixture].map(f=>buildPacket(W.C,f));
 // Independently recovered from original CI artifact 15228065171, not
 // produced by this analysis execution. Pin exact raw docs and 15 packets.
 const receipt=JSON.parse(read('./work36-pinned/native-receipt-pins.json'));
 assert.equal(receipt.source.zip_sha256,m.ci.artifact.digest.split(':')[1]);
 assert.equal(sha(JSON.stringify(master)),receipt.source.master_sha256);
 assert.equal(sha(JSON.stringify(fixtures)),receipt.source.fixtures_sha256);
 assert.equal(receipt.rows.length,15);
 for(const p of receipt.rows){
  const g=generated.find(g=>g.p.id===p.id);assert.ok(g);
  for(const k of ['source_digest','bundle_sha256','evidence'])assert.equal(g.p[k],p[k],p.id+':'+k);
 }
 assert.equal(receipt.rows.reduce((n,p)=>n+p.evidence,0),3756);
 const p=generated.find(g=>g.p.id==='W36_POSITIVE').out.packet;
 const mRoots=new Set(generated.at(-1).out.packet.evidence.map(e=>e.evidenceId));
 for(const id of receipt.positiveRoots){assert.ok(p.evidence.some(e=>e.evidenceId===id));assert.ok(mRoots.has(id));}
 console.log('V40_INDEPENDENT_WORK36_PINS 15/15 evidence=3756 roots=12');
 const C={...W.C,fixtures:[...W.C.fixtures,...fixtures,masterFixture],receipt:{summary:[...W.C.receipt.summary,...generated.map(g=>g.p)]}};
 const fixed=new Map([...W.fixed,...generated.map(g=>[g.f.id,{raw:{raw:g.f.docs},pin:g.p}])]);
 return {C,fixed,manifest:W.manifest,work36:m,generated,master:generated.at(-1)};
}
const interval=x=>x.interval_ms??null;
function strictOracle(roster,edges){
 assert.equal(new Set(roster).size,roster.length);
 assert.ok(roster.length<=7);
 const seen=new Set();
 for(const e of edges){
  assert.ok(roster.includes(e.a)&&roster.includes(e.b)&&e.a!==e.b);
  assert.ok(['AHEAD','BEHIND','UNKNOWN'].includes(e.order),'INVALID_EDGE_LABEL');
  const k=[e.a,e.b].sort().join('\0');assert.ok(!seen.has(k),'DUPLICATE_EDGE');seen.add(k);
  if(e.interval_ms){assert.ok(e.interval_ms.length===2&&e.interval_ms.every(Number.isFinite)&&e.interval_ms[0]<=e.interval_ms[1]);}
 }
 assert.equal(seen.size,roster.length*(roster.length-1)/2);
 return orderOracle(roster,edges);
}
const bounds=x=>x.map(e=>[e.slot,e.min,e.max]).sort((a,b)=>a[0].localeCompare(b[0]));
const state=(s,t)=>s.max<=t?'SUPPORT':s.min>t?'COUNTER':'UNKNOWN';
function route(x,h,s,threshold){
 const obs=x.historical_scenarios;
 const b=obs.find(q=>q.event===s.response_event&&q.checkpoint_m===s.checkpoint_m);
 const startId=s.id.startsWith('EVIDENCE_CROSS:')?s.id.slice('EVIDENCE_CROSS:'.length).split('>')[0]:null;
 const a=obs.find(q=>q.id===startId);
 const env=s.field.envelopes.find(e=>e.slot===h.slot)??null;
 const own=s.edges.filter(e=>e.a===h.slot||e.b===h.slot);
 const roots=uniq(own.flatMap(e=>e.refs));
 const pairs=own.map(e=>{
  const sign=e.a===h.slot?1:-1,rival=sign===1?e.b:e.a,i=s.starts[h.slot],j=s.starts[rival];
  const initial=i&&j?[j[0]-i[1],j[1]-i[0]]:null,finish=e.interval_ms?(sign===1?e.interval_ms:[-e.interval_ms[1],-e.interval_ms[0]]):null;
  const gain=Number.isFinite(e.change_ms)?sign*e.change_ms:null,bound=e.change_bound_ms;
  return {rival,initial,finish,gain,bound,recovery:!!(initial&&finish&&initial[1]<0&&finish[0]>0&&gain>bound),retained:!!(initial&&finish&&initial[0]>0&&finish[0]>0),loss:Number.isFinite(gain)&&Number.isFinite(bound)&&gain< -bound,refs:e.refs};
 });
 const known=x.roster.known_active.includes(h.slot)&&h.identity_known&&h.status==='ACTIVE';
 const measured=pairs.length>0&&pairs.every(p=>p.finish&&p.initial&&p.refs.length&&Number.isFinite(p.gain)&&Number.isFinite(p.bound));
 // Pace compatibility is a measured historical band, not current pace.
 // Require actual leader crossings at the first and selected checkpoint;
 // compare both early and middle elapsed segments separately.
 const pace=(z)=>z?.leader?.elapsed_ms?.slice(0,3)??null;
 const pa=pace(a),pb=pace(b),u=b?.leader?.uncertainty_ms;
 const paceComparable=!!(pa&&pb&&pa.length===3&&pb.length===3&&Number.isFinite(u)&&Math.abs(pa[1]-pb[1])<=2*u&&Math.abs((pa[2]-pa[1])-(pb[2]-pb[1]))<=4*u);
 const conditions=!!(a&&b&&a.contextMatched&&b.contextMatched&&a.knownField&&b.knownField&&a.paceUsable&&b.paceUsable&&s.comparable&&s.condition_refs?.length&&s.historical_role_refs?.length);
 const roles=!!(a&&b&&!s.roleConflicts.length);
 const applicable=known&&s.valid&&s.complete&&measured&&conditions&&roles&&paceComparable&&!!env;
 const win=applicable?state(env,1):'UNKNOWN',place=applicable?state(env,threshold):'UNKNOWN';
 const feedback=(h.findings_v33??[]).filter(f=>f.item==='RANK18'&&f.eye_id&&f.observation?.checkpoint_m===s.checkpoint_m);
 const eye=feedback.flatMap(f=>[...(f.observation.measurements??[]).filter(m=>m.event===s.response_event&&m.supported).map(m=>({kind:'SUPPORT',event:m.event,refs:m.refs,gain:m.gain})),...(f.observation.counterexamples??[]).filter(m=>m.event===s.response_event).map(m=>({kind:'COUNTER',event:m.event,refs:m.refs,gain:m.gain}))]);
 const recoveries=pairs.filter(p=>p.recovery),losses=pairs.filter(p=>p.loss),retained=pairs.filter(p=>p.retained);
 const axes=[
  {axis:'A',state:measured?'MEASURED_ALL_RIVALS':'UNKNOWN',support:measured?pairs:[],counter:[],unknown:!measured,refs:roots},
  {axis:'B',state:conditions&&roles&&paceComparable?'MATCHED_OBSERVED_ANTECEDENT':'HELD',support:conditions&&roles&&paceComparable?[{start:a.id,response:b.id,pace:[pa,pb]}]:[],counter:s.roleConflicts,unknown:!conditions||!paceComparable,refs:uniq([...(a?.refs??[]),...(s.condition_refs??[]),...(s.historical_role_refs??[])])},
  {axis:'C',state:win==='SUPPORT'?'WIN_SUPPORT':place==='SUPPORT'?'PLACE_SUPPORT':place==='COUNTER'?'PLACE_COUNTER':'UNKNOWN',support:win==='SUPPORT'||place==='SUPPORT'?[env]:[],counter:place==='COUNTER'?[env]:[],unknown:!applicable||place==='UNKNOWN',refs:uniq(s.edges.flatMap(e=>e.refs))},
  {axis:'D',state:recoveries.length?'ADVERSE_POSITION_OVERTAKEN':retained.length===pairs.length&&pairs.length?'FAVORABLE_POSITION_RETAINED':measured?'MIXED_MEASURED_RESPONSE':'UNKNOWN',support:[...recoveries,...retained],counter:losses,unknown:!measured,refs:roots},
  {axis:'E',state:eye.some(e=>e.kind==='SUPPORT')?'POSITIVE_INCIDENT_RELEVANT':eye.some(e=>e.kind==='COUNTER')?'COUNTER_INCIDENT_RELEVANT':'NO_RELEVANT_DISCOVERY',support:eye.filter(e=>e.kind==='SUPPORT'),counter:eye.filter(e=>e.kind==='COUNTER'),unknown:!eye.length,refs:uniq(eye.flatMap(e=>e.refs))}
 ];
 // D must actually establish retention or overcoming measured deficit against
 // every rival for a win. This is not physiological load inference.
 const dWin=measured&&pairs.every(p=>p.recovery||p.retained||(p.finish?.[0]>0&&p.initial?.[0]<=0&&p.initial?.[1]>=0));
 const decision=applicable&&axes[0].support.length&&axes[1].support.length&&(!eye.length||axes[4].refs.length)?
  win==='SUPPORT'&&dWin?'WIN_SUPPORT':place==='SUPPORT'?'PLACE_SUPPORT':place==='COUNTER'?'PLACE_COUNTER':'HELD':'HELD';
 return {id:s.id,horse:h.slot,start_event:a?.event??null,response_event:s.response_event,env,axes,decision,paceComparable,conditions,roles,measured,applicable,WIN:win,PLACE:place,pairs,formal:false,actual_current:'UNPROVEN'};
}
export function analyze(V,id,threshold=2){
 const x=analyzeV38(V,id,{eyeEnabled:true,placeThreshold:threshold,evidenceCross:true});
 const runners=x.runners.map(h=>{
  const routes=x.conditional_scenarios.filter(s=>s.id.startsWith('EVIDENCE_CROSS:')).map(s=>route(x,h,s,threshold));
  const obs=x.historical_scenarios.filter(s=>s.checkpoint_m===800&&s.valid&&s.applicability==='COMPARABLE_SYNTHETIC_RESPONSE');
  const history=obs.map(s=>({event:s.event,env:s.field.envelopes.find(e=>e.slot===h.slot),refs:s.edges.filter(e=>e.a===h.slot||e.b===h.slot).flatMap(e=>e.refs)})).filter(q=>q.env&&q.refs.length);
  const winEvents=uniq(history.filter(q=>q.env.max===1).map(q=>q.event)),placeEvents=uniq(history.filter(q=>q.env.max<=threshold).map(q=>q.event));
  const winRoutes=routes.filter(p=>p.decision==='WIN_SUPPORT'),placeRoutes=routes.filter(p=>p.decision==='WIN_SUPPORT'||p.decision==='PLACE_SUPPORT');
  // Require independent observed response events plus a cross-event route.
  // Counter routes remain visible and prevent a robust/unconditional S claim.
  // Repeated historical wins alone do not establish a credible current route.
  // Include the actual historical outcome from the SAME start event as a
  // counter to the transfer, instead of excluding the self case from review.
  const assess=(p,t)=>{
   const same=history.find(q=>q.event===p.start_event);
   const alternatives=routes.filter(q=>q.start_event===p.start_event&&q.applicable);
   const negative=alternatives.filter(q=>q.env&&q.env.min>t).map(q=>q.response_event);
   if(same?.env.min>t)negative.push(same.event);
   return {start:p.start_event,response:p.response_event,claim:t,counterEvents:uniq(negative),unknown:alternatives.some(q=>q.env.min<=t&&q.env.max>t)||!same,formal:false};
  };
  const winReviews=winRoutes.map(p=>assess(p,1)),placeReviews=placeRoutes.map(p=>assess(p,threshold));
  const coherentWin=winReviews.filter(q=>!q.counterEvents.length&&!q.unknown);
  const coherentPlace=placeReviews.filter(q=>!q.counterEvents.length&&!q.unknown);
  const candidate=winEvents.length>=2&&coherentWin.length?'A':placeEvents.length>=2&&coherentPlace.length?'B':null;
  return {...h,routes_v40:routes,history_v40:history,research_grade:candidate,current_grade:null,grade:null,formal:false,
   scope:'EVIDENCE_BACKED_HISTORICAL_ANTECEDENT_TRANSFER_NOT_ACTUAL_CURRENT',winEvents,placeEvents,winReviews,placeReviews,
   research_reason:candidate?'REPEATED_MATCHED_OBSERVATIONS_AND_INDEPENDENT_CROSS_ROUTE':'INSUFFICIENT_MATCHED_REPEATED_ROUTE',
   material_unknowns:['TODAY_ROLE_PACE_NOT_OBSERVED','CURRENT_FORM_AND_LOAD','EXHAUSTIVE_CURRENT_ROUTE_COVERAGE']};
 });
 return {...x,runners,formal:false,grade:null,placeThreshold:threshold};
}
function mask(V,available){
 const {out}=V.master,packet=out.packet,docs=V.master.f.docs,card=docs[0];
 // Gate by verified literal source roots and actual incident identity before
 // invoking any shared analysis. Counter observations are not screened out for
 // being negative. Different conditions are retained as contrast only.
 const reviews=candidates.map(event=>{
  const doc=docs.find(d=>d.eventId===event),h=doc.rows.find(r=>r.nativeId==='TEST:H4'),r=doc.rows.find(r=>r.nativeId==='TEST:H2');
  const roots=packet.evidence.filter(e=>e.event===event&&['TEST:H4','TEST:H2'].includes(e.subject)&&['checkpoint_ms','finish_clock','finish'].includes(e.field));
  const matched=eq(doc.conditions,card.conditions)&&eq(doc.geometry,card.geometry)&&doc.rows.every(q=>card.rows.some(k=>q.nativeId===k.nativeId&&q.gate===k.gate&&q.weightG===k.weightG));
  const deficit=h.checkpointMs[1]-r.checkpointMs[1],advantage=r.clockMs-h.clockMs;
  const bound=2*doc.precisionMs,positive=matched&&deficit>bound&&advantage>bound&&h.checkpointRanks[1]>h.checkpointRanks[0]&&h.finish<h.checkpointRanks[1];
  const admissible=doc.updatedAt<=card.scheduledPost&&roots.length===6&&new Set(roots.map(e=>e.evidenceId)).size===6;
  return {event,available:available.includes(event),admissible,matched,positive,deficit,advantage,roots:roots.map(e=>e.evidenceId),incident:packet.issuer+'|'+event,kind:!matched?'OTHER_CONTEXT':positive?'POSITIVE':'MATCHED_COUNTER'};
 });
 const admitted=reviews.filter(q=>q.available&&q.admissible).map(q=>q.event);
 const W={...V,C:{...V.C,admission:{candidateEvents:candidates,admittedEvents:admitted}}};
 const x=analyze(W,V.master.f.id);
 assert.equal(x.source_digest,out.digest);assert.equal(sha(JSON.stringify(x.source_packet)),out.digest);
 return {x,reviews,admitted};
}
function itemSemantic(i){
 // Numeric and categorical facts only; root IDs and commentary are not effects.
 const clean=x=>Array.isArray(x)?x.map(clean):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!/(refs?|hash|digest|lineage|reason|prose|evidence_ids|root_keys|grade_effect)/i.test(k)).map(([k,v])=>[k,clean(v)])):x;
 return clean({state:i.state,missing:i.missing,findings:i.v33_findings??[]});
}
function delta(b,a){
 const changes=a.runners.flatMap(h=>h.items.filter(i=>i.item.startsWith('RANK')).flatMap(i=>{
  const j=b.runners.find(q=>q.slot===h.slot).items.find(q=>q.item===i.item);
  return eq(itemSemantic(i),itemSemantic(j))?[]:[{horse:h.slot,item:i.item,before:itemSemantic(j),after:itemSemantic(i)}];
 }));
 const routeChanges=a.runners.flatMap(h=>h.routes_v40.flatMap(p=>{
  const q=b.runners.find(z=>z.slot===h.slot).routes_v40.find(z=>z.id===p.id);
  return p.decision==='HELD'&&!q||q&&p.decision===q.decision?[]:[{horse:h.slot,id:p.id,before:q?.decision??null,after:p.decision,axes:p.axes.map(a=>[a.axis,a.state])}];
 }));
 return {changes,routeChanges,grades:a.runners.map(h=>({horse:h.slot,before:b.runners.find(z=>z.slot===h.slot).research_grade,after:h.research_grade}))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
const V=await loadV40();
const all=V.C.fixtures.filter(f=>f.id!=='W36_MASTER_IMMUTABLE').map(f=>analyze(V,f.id));
const by=id=>all.find(x=>x.id===id);
t('F40-01',()=>{
 assert.equal(all.length,25);assert.equal(all.filter(x=>x.id.startsWith('W36_')).length,15);assert.equal(all.reduce((n,x)=>n+x.source_packet.evidence.length,0),8190);
 for(const x of all){const p=V.fixed.get(x.id).pin;assert.equal(x.source_digest,p.source_digest);assert.equal(x.source_packet.evidence.length,p.evidence);assert.equal(x.groups,118);assert.equal(x.held,826);assert.equal(x.runners.length,5);assert.ok(x.runners.every(h=>h.items.length===115&&h.grade===null&&h.current_grade===null));}
 assert.equal(all.filter(x=>!x.id.startsWith('W36_')).reduce((n,x)=>n+x.source_packet.evidence.length,0),4434);
});
t('F40-02',()=>{
 const l=by('W36_LOCAL_MISSING').historical_scenarios.filter(s=>named(s,'LONE')&&s.valid);
 assert.ok(l.some(s=>s.edges.filter(e=>e.interval_ms).length===6));
 const b=by('W36_BASE').historical_scenarios;
 for(const s of l.filter(s=>s.edges.filter(e=>e.interval_ms).length===6)){
  const q=b.find(z=>z.id===s.id);assert.ok(q);
  for(const e of s.edges){if(e.a===H(5)||e.b===H(5)){assert.equal(e.interval_ms,null);assert.equal(e.order,'UNKNOWN');}else assert.deepEqual(e.interval_ms,q.edges.find(z=>z.a===e.a&&z.b===e.b).interval_ms);}
 }
 const s=by('W36_SHARED_CONFLICT').historical_scenarios.filter(s=>named(s,'LONE'));assert.ok(s.length&&s.every(q=>!q.valid||q.applicability!=='COMPARABLE_SYNTHETIC_RESPONSE'));
});
t('F40-03',()=>{
 for(const x of all)for(const s of [...x.historical_scenarios,...x.conditional_scenarios]){
  if(!s.valid)continue;
  const q=strictOracle(x.roster.possible_active,s.edges);assert.ok(q.orders>0);assert.deepEqual(bounds(q.envelopes),bounds(s.field.envelopes));
 }
 assert.throws(()=>strictOracle(['A','B'],[{a:'A',b:'B',order:'INVALID'}]),/INVALID_EDGE_LABEL/);
 assert.throws(()=>strictOracle(['A','B'],[{a:'A',b:'B',order:'UNKNOWN'},{a:'B',b:'A',order:'UNKNOWN'}]),/DUPLICATE_EDGE/);
});
t('F40-04',()=>{
 for(const dim of ['GOING','WEIGHT','GATE','COURSE','DISTANCE','JOINT']){
  const x=by('W36_CONTEXT_'+dim);assert.ok(x);
  assert.ok(x.runners.every(h=>h.routes_v40.every(p=>!p.applicable)&&h.research_grade===null));
 }
 const x=by('W36_PEER_CLASS');assert.ok(x.source_packet.followups.some(f=>f.peer==='TEST:H6'));
 assert.ok(x.runners.every(h=>h.current_grade===null));
});
const base=mask(V,[]),pos=mask(V,candidates.slice(0,2)),negative=mask(V,[candidates[2]]),counter=mask(V,candidates.slice(0,3)),other=mask(V,[...candidates.slice(0,2),candidates[3]]);
const dp=delta(base.x,pos.x),dc=delta(pos.x,counter.x),doo=delta(pos.x,other.x);
t('F40-05',()=>{
 for(const m of [base,pos,negative,counter,other])assert.equal(m.x.source_digest,base.x.source_digest);
 assert.equal(pos.reviews.filter(q=>q.available&&q.admissible&&q.positive).length,2);
 assert.equal(new Set(pos.reviews.filter(q=>q.available&&q.positive).map(q=>q.incident)).size,2);
 assert.equal(negative.reviews.filter(q=>q.available&&q.positive).length,0);
 assert.ok(counter.reviews.some(q=>q.event===candidates[2]&&q.available&&q.matched&&!q.positive&&q.admissible));
 assert.ok(other.reviews.some(q=>q.event===candidates[3]&&q.available&&!q.matched&&!q.positive&&q.admissible));
 assert.ok(base.x.historical_scenarios.every(s=>!candidates.includes(s.event.split('|').at(-1))));
 assert.ok(pos.x.historical_scenarios.some(s=>s.event===ns(candidates[0])));
});
t('F40-06',()=>{
 assert.ok(dp.changes.some(q=>q.horse===H(4)&&['RANK18','RANK21','RANK100'].includes(q.item)));
 assert.ok(negative.x.runners.find(h=>h.slot===H(4)).findings_v33.filter(f=>f.eye_id).every(f=>!f.observation?.events?.some(e=>candidates.slice(0,2).map(ns).includes(e))));
 const a=base.x.historical_scenarios,b=pos.x.historical_scenarios;
 for(const s of a){const q=b.find(z=>z.id===s.id);assert.ok(q);assert.deepEqual(s.edges.map(interval),q.edges.map(interval));}
 for(const x of [base.x,pos.x,negative.x,counter.x,other.x])for(const h of x.runners)for(const p of h.routes_v40){
  assert.equal(p.axes.length,5);assert.equal(p.actual_current,'UNPROVEN');
  if(p.decision!=='HELD'){assert.ok(p.applicable&&p.paceComparable&&p.conditions&&p.roles&&p.measured);assert.notEqual(p.start_event,p.response_event);}
 }
});
const compact=x=>({id:x.id,digest:x.source_digest,evidence:x.source_packet.evidence.length,groups:x.groups,held:x.held,runners:x.runners.map(h=>({horse:h.slot,grade:h.research_grade,winEvents:h.winEvents,placeEvents:h.placeEvents,winReviews:h.winReviews,placeReviews:h.placeReviews,routes:h.routes_v40.map(p=>({id:p.id,decision:p.decision,WIN:p.WIN,PLACE:p.PLACE,env:p.env&&[p.env.min,p.env.max],axes:p.axes.map(a=>[a.axis,a.state]),paceComparable:p.paceComparable,roles:p.roles}))}))});
for(const x of all)console.log('V40_CASE '+JSON.stringify(compact(x)));
for(const g of V.generated)console.log('V40_PIN '+JSON.stringify({...g.p,rootMap:g.out.packet.evidence.filter(e=>candidates.includes(e.event)&&['TEST:H4','TEST:H2'].includes(e.subject)&&['checkpoint_ms','finish_clock','finish'].includes(e.field)).map(e=>({id:e.evidenceId,event:e.event,subject:e.subject,field:e.field,root:e.root,dependencies:e.dependencies}))}));
// This tests a literal fixed Work36 contrast, not an expected grade label.
 // The 800m COUNTER starting vector plus POS_B measured response yields
 // H4-H2 1300ms advantage (before combined interval uncertainty).
 t('F40-07',()=>{
  const h=pos.x.runners.find(h=>h.slot===H(4)),p=h.routes_v40.find(q=>q.start_event===ns(E('COUNTER'))&&q.response_event===ns(E('W36_POS_B')));
  assert.ok(p,'INDEPENDENT_NONREPLAY_PATH');
  const e=p.pairs.find(q=>q.rival===H(2));
  assert.ok(e&&e.finish&&e.finish[0]>0&&e.recovery);
  assert.equal((e.finish[0]+e.finish[1])/2,1300);
  assert.equal(p.decision,'WIN_SUPPORT');
  assert.ok(p.axes.find(a=>a.axis==='E').support.some(q=>q.event===ns(E('W36_POS_B'))));
  assert.ok(!base.x.runners.find(h=>h.slot===H(4)).routes_v40.some(q=>q.id===p.id));
  assert.ok(dp.routeChanges.some(q=>q.id===p.id&&q.horse===H(4)&&q.after==='WIN_SUPPORT'));
  const c=h.winReviews.find(q=>q.start===p.start_event&&q.response===p.response_event);
  assert.ok(c?.counterEvents.includes(ns(E('COUNTER'))),'OBSERVED_SAME_START_COUNTER_NOT_DISCARDED');
  const o=other.x.runners.find(h=>h.slot===H(4)).routes_v40.find(q=>q.id===p.id);
  assert.ok(o);assert.equal(o.decision,p.decision);assert.deepEqual(o.pairs.map(q=>q.finish),p.pairs.map(q=>q.finish));
  assert.ok(counter.x.runners.find(h=>h.slot===H(4)).routes_v40.some(q=>q.response_event===ns(E('W36_COUNTER_MATCHED'))&&q.decision==='PLACE_COUNTER'));
 });
 const brief=d=>({...d,changes:d.changes.map(q=>({horse:q.horse,item:q.item}))});
for(const [label,m] of [['BASE',base],['POSITIVE',pos],['NEGATIVE',negative],['COUNTER',counter],['OTHER',other]])console.log('V40_MASK '+JSON.stringify({label,reviews:m.reviews,admitted:m.admitted,result:compact(m.x)}));
console.log('V40_DELTA '+JSON.stringify({positive:brief(dp),counter:brief(dc),other:brief(doo),scope:'SAME_MASTER_PRE_ANALYSIS_MASK_NOT_OFFICIAL_ADMISSION'}));

}

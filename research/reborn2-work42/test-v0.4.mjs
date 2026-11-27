import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {makeEnvelope,validateEnvelope,sha} from './validate-v0.4.mjs';
import {definitions,buildSupply,selectClaims,frontBounds,flankState,rivalBounds,sectionContrast} from './eye-supply-v0.4.mjs';
import {run31,pipeline31,verifier31} from '../reborn2-chatgpt-circuit/work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';
const t=(n,f)=>{f();checks.push(n);console.log('WORK42 '+n+' PASS');},checks=[],copy=structuredClone;
const blob=x=>createHash('sha1').update('blob '+x.length+'\0').update(x).digest('hex');
const read=n=>readFileSync(new URL(n,import.meta.url));
const old=JSON.parse(read('../reborn2-chatgpt-circuit/work34-pinned/stage34-raw-fixtures-v0.2.json')),base=old.fixtures.find(f=>f.id==='FK34_FULL').docs;
const original=read('./independent-reference-v2.mjs');
t('CANONICAL_AND_INDEPENDENT_PINS',()=>{assert.equal(blob(original),'14b854d7be1195c824113b15f458e8a34d4a96ab');assert.equal(blob(read('./canonical-eye.json')),'64105a0f0fb802bc1c45eb78a1169f64aa5dcd16');assert.equal(blob(read('./canonical-eye-design.md')),'130ec849e3b8b3648bd66e0aca798d22eb39fb83');assert.deepEqual(definitions.map(d=>[d.category,d.name]),old.canonical.slice(100).map(d=>[d.item,d.name]));});
const reference=JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('./independent-reference-v2.mjs',import.meta.url))],{encoding:'utf8'}));
t('INDEPENDENT_REFERENCE_EXECUTED',()=>assert.ok(Object.values(reference.checks).every(Boolean)));
// Explicit projection from independent seven 200m crossings to native common 3 checkpoints.
// Original full vector remains pinned. First-turn geometry is a synthetic proxy,
// not a measured statement about the independent reference's 300m turn.
const card=copy(base[0]);card.eventId='TEST:W42_TARGET';card.rows.forEach((r,i)=>{r.weightG=56000;r.nativeId='TEST:'+String.fromCharCode(65+i);});
card.geometry={...card.geometry,first_turn_m:200,straight_m:350,course_version:'TEST:W42_PROXY_1400'};
card.conditions={...card.conditions,venue:'TEST:W42_OVAL',class_label:'TEST:W42_SAME_CLASS'};
function history(e,i){
 const d=copy(base[1]);d.eventId='TEST:W42_'+e.id;d.eventAt=10+i*10;d.publishedAt=d.eventAt+1;d.updatedAt=d.eventAt+2;d.conditions=copy(card.conditions);d.geometry=copy(card.geometry);
 d.rows=e.runners.map((r,j)=>({nativeId:'TEST:'+r.horse,no:j+1,status:'FINISHED',gate:j+1,weightG:r.weight_g,finish:r.finish_rank,clockMs:r.clock_ms[6],final600Ms:r.final600_ms,checkpointMs:[r.clock_ms[0],r.clock_ms[3],r.clock_ms[5]],checkpointRanks:[r.rank_at[0],r.rank_at[3],r.rank_at[5]],officialMargin:r.finish_rank===1?null:'TEST_LITERAL'}));
 const cum=[0,...[0,1,2].map(j=>Math.min(...d.rows.map(r=>r.checkpointMs[j]))),Math.min(...d.rows.map(r=>r.clockMs))];d.leaderLaps.valuesMs=cum.slice(1).map((v,j)=>v-cum[j]);d.passing.groups=[...d.rows].sort((a,b)=>a.checkpointMs[0]-b.checkpointMs[0]).map(r=>[r.no]);return d;
}
const refs=[card,...reference.events.map(history)];
t('REFERENCE_PROJECTION_EXACT_CLOCKS',()=>{validateEnvelope(makeEnvelope(refs));for(const [i,d] of refs.slice(1).entries())for(const [j,r] of d.rows.entries()){const q=reference.events[i].runners[j];assert.deepEqual(r.checkpointMs,[q.clock_ms[0],q.clock_ms[3],q.clock_ms[5]]);assert.equal(r.clockMs,q.clock_ms[6]);assert.equal(r.final600Ms,q.final600_ms);}assert.ok(refs.slice(1).every(d=>d.rows[2].finish>1));assert.equal(reference.hypothetical[0].rank[2],1);assert.equal(reference.hypothetical[1].rank[2],2);});
// Paired counterfactual historical fixture, not an extra observed event in base.
// Preserve same field, prefix, and all other horses' measured clocks; only B's
// late section response changes. No expected grade.
const strongerPeer=copy(refs),peer=strongerPeer.at(-1);peer.eventId='TEST:W42_PEER_STRONGER';
const bRow=peer.rows[1];bRow.clockMs-=900;bRow.final600Ms=bRow.clockMs-bRow.checkpointMs[1];bRow.checkpointMs[2]=bRow.checkpointMs[1]+Math.round(bRow.final600Ms*2/3);
for(const row of peer.rows){row.finish=1+peer.rows.filter(q=>q.clockMs<row.clockMs).length;row.officialMargin=row.finish===1?null:'TEST_LITERAL';row.checkpointRanks=row.checkpointMs.map((v,j)=>1+peer.rows.filter(q=>q.checkpointMs[j]<v).length);}
const peerCum=[0,...[0,1,2].map(j=>Math.min(...peer.rows.map(r=>r.checkpointMs[j]))),Math.min(...peer.rows.map(r=>r.clockMs))];peer.leaderLaps.valuesMs=peerCum.slice(1).map((v,j)=>v-peerCum[j]);
t('SAME_FIELD_CHANGED_PEER_RESPONSE',()=>{validateEnvelope(makeEnvelope(strongerPeer));const a=refs.at(-1);assert.deepEqual(peer.conditions,a.conditions);assert.deepEqual(peer.geometry,a.geometry);for(const [i,r] of a.rows.entries()){assert.deepEqual(peer.rows[i].checkpointMs.slice(0,2),r.checkpointMs.slice(0,2));if(i!==1){assert.equal(peer.rows[i].clockMs,r.clockMs);assert.deepEqual(peer.rows[i].checkpointMs,r.checkpointMs);}}assert.equal(peer.rows[2].finish,a.rows[2].finish+1);});
const unknown=copy(refs);unknown[0].rows[1].status='UNKNOWN';
const partial=copy(refs);partial[1].rows[4].checkpointMs=null;partial[1].rows[4].checkpointRanks=null;
const missingCondition=copy(refs);missingCondition[0].conditions=null;missingCondition[0].geometry=null;
const noHistory=copy(refs);noHistory[0].rows[4].nativeId='TEST:NO_HISTORY';
const cancelled=copy(refs);cancelled[0].rows[1].status='CANCELLED';
const changed=copy(base);changed[2].conditions.going='TEST:SOFT';
const prepared=[];
for(const [name,docs] of [['BASE',base],['REFERENCE',refs],['STRONGER_PEER',strongerPeer],['UNKNOWN',unknown],['PARTIAL',partial],['CONDITION_MISSING',missingCondition],['NO_HISTORY',noHistory],['CANCELLED',cancelled],['OTHER_CONDITION',changed]]){
 const envelope=makeEnvelope(docs),validated=validateEnvelope(envelope),{input,registry,out}=run31(validated.docs,old.canonical,sha);
 assert.equal(out.state,'TEST_PACKET',JSON.stringify(out).slice(0,1000));
 const id='WORK42_'+name,bundleText=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical:old.canonical,cases:[{n:id,input,registry,expectedDigest:out.digest}]})+'\n',receipt={id,source_digest:out.digest,bundle_sha256:sha(bundleText),evidence:out.packet.evidence.length,itemRows:docs[0].rows.length*115,blob:null};
 const supply=buildSupply(envelope,out.packet);assert.equal(supply.commonSha256,out.digest);
 prepared.push({name,envelope,request:{id,bundleText,envelope:out},receipt,supply});
}
const get=n=>prepared.find(x=>x.name===n),horse=(n,h)=>get(n).supply.runners.find(r=>r.horse_id.endsWith('|TEST:'+h)),cat=(n,h,i)=>horse(n,h).categories[i-1];
t('UNKNOWN_FIELD_NOT_ABSENCE',()=>{const a=cat('UNKNOWN','C',9).claims[0].observed_facts;assert.equal(a.knownActive,4);assert.equal(a.possibleActive,5);assert.ok(a.statusUnknown.includes('TEST:B'));assert.equal(cat('UNKNOWN','C',10).claims[0].status,'UNKNOWN');const r=cat('UNKNOWN','C',11).claims[0].observed_facts;assert.ok(r.unknown.includes('TEST:B'));assert.ok(r.current[1]>=r.current[0]);assert.notEqual(r.reduction,'PROVEN_COUNT_REDUCTION');});
t('CANCELLED_DISTINCT_FROM_UNKNOWN',()=>{const a=cat('CANCELLED','C',9).claims[0].observed_facts,b=cat('UNKNOWN','C',9).claims[0].observed_facts;assert.equal(a.possibleActive,4);assert.equal(b.possibleActive,5);assert.equal(a.statusUnknown.length,0);assert.ok(!cat('CANCELLED','C',11).claims[0].observed_facts.unknown.includes('TEST:B'));});
t('ANY_CHECKPOINT_FRONT_PROXY',()=>{const f=frontBounds([{horse:'X',status:'ACTIVE',role:'FRONT_OBSERVED'},{horse:'Y',status:'ACTIVE',role:'UNKNOWN'},{horse:'Z',status:'UNKNOWN',role:'NON_FRONT_OBSERVED'}]);assert.deepEqual(f.ratioBounds,[1/3,1]);});
t('EYE13_SEPARATE_CLOCK_AND_RANK',()=>{const a=copy(base[1]),b=copy(a),h=a.rows[2].nativeId,x=b.rows[2];x.final600Ms-=500;x.finish+=1;const v=sectionContrast(a,b,h);assert.equal(v.section,'IMPROVED');assert.equal(v.placing,'WORSENED');assert.equal(v.status,'SUPPORT_ANTECEDENT');x.finish=a.rows[2].finish-1;assert.equal(sectionContrast(a,b,h).placing,'IMPROVED');x.final600Ms=a.rows[2].final600Ms+500;assert.equal(sectionContrast(a,b,h).section,'WORSENED');b.conditions.going='TEST:OTHER';assert.equal(sectionContrast(a,b,h).status,'IRRELEVANT_CONDITION');b.conditions=null;assert.equal(sectionContrast(a,b,h).context,'UNKNOWN');});
t('MISSING_TYPES_SEPARATE',()=>{for(const [name,type] of [['UNKNOWN','CURRENT_START_STATUS_UNKNOWN'],['PARTIAL','PARTIAL_HISTORICAL_ROW'],['CONDITION_MISSING','CONDITION_OR_GEOMETRY_MISSING'],['NO_HISTORY','NO_HORSE_HISTORY']])assert.ok(get(name).supply.missing.some(q=>q.type===type&&q.materialTo.length&&q.notTo.length));const p=get('PARTIAL').request.envelope.packet.evidence;assert.ok(p.some(e=>e.event==='TEST:W42_CONTEST'&&e.subject==='TEST:A'&&e.field==='checkpoint_ms'));assert.ok(!p.some(e=>e.event==='TEST:W42_CONTEST'&&e.subject==='TEST:E'&&e.field==='checkpoint_ms'));});
t('PER_CATEGORY_CONTRACT_AND_DUPLICATE_IRRELEVANT',()=>{const s=get('BASE').supply;for(const d of definitions){const h=s.runners.find(r=>r.categories.find(c=>c.category===d.category).claims.length),c=h.categories.find(c=>c.category===d.category),q=c.claims[0];const selection=selectClaims(s,h.horse_id,d.category,[q.claim_id,q.claim_id,'other-source']);assert.equal(selection.accepted.length,1);assert.deepEqual(selection.rejected.map(x=>x.reason),['DUPLICATE_CLAIM','IRRELEVANT_OR_UNVERIFIED_CLAIM']);assert.ok(c.claims.every(x=>x.evidence_ids.every(id=>s.nativeIds.includes(id))&&x.source_root_ids.every(id=>s.rootIds.includes(id))&&x.upstream_item_ids.length>0));}});
t('OTHER_CONDITION_EYE07_AND_13_HELD',()=>{const h=horse('OTHER_CONDITION','H1');assert.ok(h.categories[6].claims.some(q=>q.status==='IRRELEVANT_CONDITION'));assert.ok(h.categories[12].claims.some(q=>q.status==='IRRELEVANT_CONDITION'));});
const v43path=resolve(process.env.V43_ROOT,'research/reborn2-independent-engine/main47-integration/v43-generic.mjs');
t('V43_PIN',()=>assert.equal(blob(readFileSync(v43path)),'0c2c10badca820e447f3464f78b3a4b545ba11f8'));
const {loadV40,verifyIntake,analyzeVerified}=await import(pathToFileURL(v43path)),V=await loadV40(),results=[];
for(const name of ['REFERENCE','STRONGER_PEER','UNKNOWN','PARTIAL','CONDITION_MISSING','NO_HISTORY']){
 const p=get(name);try{const verified=verifyIntake(V,p.request,p.receipt);assert.equal(verified.packet.evidence.length,p.receipt.evidence);const z=await analyzeVerified(V,p.request,p.receipt);assert.equal(z.digest,p.receipt.source_digest);assert.equal(z.groups,118);assert.equal(z.held,826);assert.ok(z.runners.every(r=>r.itemConsumption.length===115&&r.grade===null));results.push({name,state:'EXECUTED',evidence:z.evidence,roster:z.roster,runners:z.runners.map(r=>({horse:r.horse,grade:r.research_grade,current:r.current_grade,summary:r.summary,items:r.itemConsumption.length}))});t('V43_'+name,()=>assert.equal(z.runners.length,5));}catch(e){results.push({name,state:'BLOCKED',error:String(e.stack??e)});console.log('WORK42 V43_'+name+' BLOCKED '+String(e.message));}
}
const categoryCounts=prepared.map(p=>({name:p.name,evidence:p.receipt.evidence,categories:definitions.map(d=>{const claims=p.supply.runners.flatMap(h=>h.categories.find(c=>c.category===d.category).claims);return {id:d.category,count:claims.length,states:Object.fromEntries([...new Set(claims.map(q=>q.status))].map(s=>[s,claims.filter(q=>q.status===s).length]))};}),missing:p.supply.missing}));
const summary={priorAccepted:811,addedAccepted:0,checks,results,categoryCounts,referenceChecks:reference.checks,formal:false,scope:'SYNTHETIC_ONLY',limitations:['Independent 7-point clocks projected onto 3 common checkpoints; proxy first turn explicitly changed. Hypothetical result never fed as source.','No independent source authenticity; receipts are self-generated synthetic research, not external custody.','Native claim IDs and canonical target mapping supplied; V43 does not yet consume the complete EYE sidecar.','EYE04/06/14/15 and other current benefit remain held absent strength/causal evidence. Per-category antecedent contrast is not proof of positive current benefit.','EYE13 unit sign contrast is arithmetic not a source observation.']};
console.log('WORK42_SUMMARY '+JSON.stringify(summary));
if(process.env.WORK42_RECEIPT)writeFileSync(process.env.WORK42_RECEIPT,JSON.stringify({summary,prepared,reference},null,2));
if(results.some(r=>r.state==='BLOCKED'))process.exitCode=1;

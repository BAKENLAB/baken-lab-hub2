import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {buildBlindBundle,buildRunnerSupply,normalizeObservation} from '../../reborn2-work40-evidence-completion/evidence-contract-v0.1.mjs';
import {supply115} from '../../reborn2-work40-evidence-completion/supply-map-115-v0.1.mjs';
import {loadV40} from '../../reborn2-chatgpt-circuit/work36-v40-integrated.mjs';
import {analyze} from '../../reborn2-chatgpt-circuit/work36-v41-local-decision.mjs';
import {integrate} from '../../reborn2-chatgpt-circuit/work36-v42-propagation.mjs';
import {pipeline31,run31,verifier31} from '../../reborn2-chatgpt-circuit/work32-pinned/stage32-condition-pipeline-v0.1.2.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const id='FK34_FULL';
const fixture=new URL('../../reborn2-chatgpt-circuit/work34-pinned/stage34-raw-fixtures-v0.2.json',import.meta.url);
const iso=n=>new Date(n*1000).toISOString();
function pinnedDocs(){
  const bytes=readFileSync(fixture);
  assert.equal(sha(bytes),'ec46adc52a23545a1f923956b919407ec95f081ed26ecdbbc5e0b7f918c28555');
  return JSON.parse(bytes).fixtures.find(f=>f.id===id).docs;
}

function validateCompetition(d){
  if(d.kind==='TARGET_CARD')return;
  const rows=d.rows, checkpoints=d.geometry.checkpoints_m;
  assert.equal(d.actualStarters,rows.length);
  assert.equal(new Set(rows.map(r=>r.nativeId)).size,rows.length);
  assert.equal(d.leaderLaps.valuesMs.length,checkpoints.length+1);
  assert.deepEqual(d.leaderLaps.boundariesM,[0,...checkpoints,d.distanceM]);
  let cumulative=0;
  for(const [i,l] of d.leaderLaps.valuesMs.entries()){
    assert.ok(l>0);
    cumulative+=l;
    const leader=Math.min(...rows.map(r=>i===checkpoints.length?r.clockMs:r.checkpointMs[i]));
    assert.equal(cumulative,leader,'LEADER_CROSSING');
  }
  for(const r of rows){
    assert.equal(r.checkpointMs.length,checkpoints.length);
    assert.ok([...r.checkpointMs,r.clockMs].every((v,i,a)=>Number.isInteger(v)&&v>(a[i-1]??0)));
    assert.equal(r.clockMs-r.checkpointMs[checkpoints.indexOf(d.distanceM-600)],r.final600Ms);
    assert.equal(r.finish,1+rows.filter(q=>q.clockMs<r.clockMs).length);
    assert.deepEqual(r.checkpointRanks,r.checkpointMs.map((v,i)=>1+rows.filter(q=>q.checkpointMs[i]<v).length));
  }
}

export function prepareWork40(resultDocs=[]){
  const docs=pinnedDocs(),card=docs[0],cutoff=iso(card.scheduledPost-1);
  const source=docs.map(raw=>{
    validateCompetition(raw);
    const bytes=JSON.stringify(raw);
    const metadata={evidence_id:raw.eventId,kind:raw.kind,issuer:'SYNTHETIC',source_url:'https://www.jra.go.jp/synthetic-not-fetched',
      raw_sha256:sha(bytes),published_at:iso(raw.publishedAt),captured_at:iso(raw.updatedAt),version:String(raw.version),
      parser_version:'PR95_PINNED_JSON_1',format:'SYNTHETIC_JSON',observations:{event_id:raw.eventId,
        rows:raw.rows.map((r,index)=>({native_horse_id:r.nativeId,row_pointer:index}))}};
    assert.ok(raw.issuer===card.issuer&&raw.publishedAt<=raw.updatedAt&&raw.updatedAt<card.scheduledPost);
    if(raw.kind==='HISTORICAL_RESULT')assert.ok(raw.eventAt<raw.publishedAt);
    return {bytes,metadata};
  });
  const {metadata:cardMeta}=source[0];
  const runner_supplies=card.rows.map(r=>{
    const histories=source.slice(1).filter(s=>s.metadata.observations.rows.some(q=>q.native_horse_id===r.nativeId)).map(s=>s.metadata);
    const observations=histories.flatMap(d=>{
      const raw=docs.find(q=>q.eventId===d.evidence_id).rows.find(q=>q.nativeId===r.nativeId);
      return ['clockMs','final600Ms','checkpointMs','checkpointRanks'].map(field=>normalizeObservation({field,value:raw[field],evidence_ids:[d.evidence_id]}));
    });
    return buildRunnerSupply({horse:{issuer:card.issuer,native_horse_id:r.nativeId},card:cardMeta,histories,observations},{cutoff,mode:'SYNTHETIC'});
  });
  const bundle=buildBlindBundle({target:{issuer:card.issuer,event_id:card.eventId,scheduled_post:iso(card.scheduledPost)},
    runner_supplies,pre_race_docs:source.map(s=>s.metadata),result_docs:resultDocs},cutoff);
  const analysis={...bundle.analysis,source};
  return {analysis,analysisSha256:sha(JSON.stringify(analysis)),sealedResults:bundle.sealed_results};
}

export async function analyzeWork40(input,{eyeEnabled=true}={}){
  const {analysis,analysisSha256}=prepareWork40();
  // Admits only this pinned synthetic control. Comparing the complete input
  // prevents altered identities, nested fields, time, bytes and metadata.
  assert.deepEqual(Object.keys(input).sort(),['analysis','analysisSha256']);
  assert.equal(input.analysisSha256,analysisSha256);
  assert.deepEqual(input.analysis,analysis,'UNPINNED_ANALYSIS');
  const docs=input.analysis.source.map(s=>JSON.parse(s.bytes));
  const V=await loadV40();
  const mapped=new Map(supply115.items.map(i=>[i.id.startsWith('EYE-')?i.id.replace('-',''):'RANK'+i.id,i.name]));
  assert.equal(mapped.size,115);
  for(const item of V.C.canonical)assert.equal(mapped.get(item.item),item.name,item.item);
  const {input:raw,registry,out}=run31(docs,V.C.canonical,sha);
  const verifyText=JSON.stringify({scope:'SYNTHETIC_ONLY',canonical:V.C.canonical,cases:[{n:id,input:raw,registry,expectedDigest:out.digest}]})+'\n';
  assert.equal(V.C.verify32(verifyText,id,out,sha,pipeline31,verifier31,sha(verifyText)).state,'VERIFIED_SYNTHETIC_ENVELOPE');
  const original=V.fixed.get(id).pin;
  assert.equal(out.digest,original.source_digest);
  const W={...V,C:{...V.C,fixtures:V.C.fixtures.map(f=>f.id===id?{...f,docs}:f)},
    fixed:new Map([...V.fixed,[id,{raw:{raw:docs},pin:original}]])};
  const common=analyze(W,id,{eyeEnabled});
  const decision=integrate(common,docs,{eyeEnabled});
  assert.equal(decision.digest,out.digest);
  return {analysisSha256,decision,groups:common.groups,held:common.held,evidence:out.packet.evidence.length,
    scope:'PINNED_SYNTHETIC_ONLY',formal:false};
}

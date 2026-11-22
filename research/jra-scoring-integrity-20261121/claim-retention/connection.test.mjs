import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHistoryWriter } from './acquisition.mjs';
import { openResearchStore } from './store.mjs';
import { createClaimObserver } from './claim-boundary.mjs';
import { sha } from '../../../automation/jra-score-ledger/declared-ledger.mjs';
const json = file => JSON.parse(readFileSync(new URL(file, import.meta.url)));
const archived = json('../remaining-blockers/archive-lineage.json').rows[0].exact_archive_candidates[0];
const races = [1,2].flatMap(i=>json('../final-provider/morning-20261122-part-'+i+'.json').rows);

test('independent submission observer flags missing method and incomplete deep-analysis declaration',async()=>{
  const {auditSubmission}=await import('./submission-audit.mjs');
  const missing=races[0].payload;
  const r=auditSubmission(missing,{rows:[],activeRunners:missing.runners,eyeChecklist:[]});
  assert.equal(r.formalScoringAllowed,false);
  assert.equal(r.fixedScoring.ok,false);
  assert.equal(r.fixedScoring.reason,'TRUSTED_FIXED_SCORE_CONTRACT_MISSING');
  assert.equal(r.factToPoints.ok,false);
  assert.ok(r.findings.some(f=>f.code==='FACT_TO_POINTS_SIGNED_V11_PROVIDER_UNAVAILABLE'));
  assert.ok(r.findings.some(x=>x.code==='SCORE_METHOD_MISSING'));
  assert.ok(r.findings.some(x=>x.code==='FULL_DEPTH_COMPARISON_UNDECLARED'));
  const matched=structuredClone(missing);
  matched.audit.score_method='RESEARCH_TEST_ONLY_PIN';
  matched.audit.full_depth_comparison=true;
  const ok=auditSubmission(matched,{rows:[],activeRunners:matched.runners,
    trustedScoreMethod:'RESEARCH_TEST_ONLY_PIN',eyeChecklist:[]});
  assert.ok(!ok.findings.some(x=>x.code==='SCORE_METHOD_MISSING'||x.code==='SCORE_METHOD_UNPINNED_OR_DRIFTED'||x.code==='FULL_DEPTH_COMPARISON_UNDECLARED'));
  const drift=auditSubmission(matched,{rows:[],activeRunners:matched.runners,
    trustedScoreMethod:'ANOTHER_METHOD',eyeChecklist:[]});
  assert.ok(drift.findings.some(x=>x.code==='SCORE_METHOD_UNPINNED_OR_DRIFTED'));
  assert.equal(drift.formalScoringAllowed,false);
});

test('official acquisition rejects duplicate and incomplete persisted-run identities before retention', async () => {
  const a = { race_id:'fixture-race', source_ref:'fixture-source',
    horse_name:'Alpha', horse_ref:'ref-alpha', horse_id:'horse-alpha', run_id:'run-alpha' };
  const b = { race_id:'fixture-race', source_ref:'fixture-source',
    horse_name:'Beta', horse_ref:'ref-beta', horse_id:'horse-beta', run_id:'run-beta' };
  let persisted = [a,b];
  let retained = 0;
  const writer = createHistoryWriter({
    store:{ retain: async () => { retained++; return 'research-id'; } },
    readPersistedRuns: async () => persisted
  });
  const parsedRefs = [a,b].map(({horse_name,horse_ref}) => ({horse_name,horse_ref}));
  const submission = { rawBytes:Uint8Array.of(1), decodedText:'fixture',
    sourceRef:'fixture-source', raceId:'fixture-race',
    sourceUrl:'https://www.jra.go.jp/JRADB/accessS.html?CNAME=fixture',
    fetchedAt:'2026-11-22T00:00:00Z', extractorId:'fixture', parsedRefs };
  // Prior implementation silently retained [Alpha,Alpha] against [Alpha,Beta].
  await assert.rejects(writer({...submission,parsedRefs:[parsedRefs[0],parsedRefs[0]]}),
    /DUPLICATE_ARCHIVE_IDENTITY/);
  assert.equal(retained,0);
  // Two apparent horses cannot share the same persisted run UUID.
  persisted = [a,{...b,run_id:a.run_id}];
  await assert.rejects(writer(submission),/DUPLICATE_ARCHIVE_IDENTITY/);
  assert.equal(retained,0);
  persisted = [a,{...b,run_id:null}];
  await assert.rejects(writer(submission),/ARCHIVE_IDENTITY_INCOMPLETE/);
  assert.equal(retained,0);
  persisted = [a,b];
  assert.equal(await writer(submission),'research-id');
  assert.equal(retained,1);
});

test('reopens exact retained bytes; only scoped and timely selection can record submitted decisions', async () => {
  const dir = mkdtempSync(join(tmpdir(),'jra-proof-'));
  const path = join(dir,'private.sqlite');
  let store = openResearchStore(path);
  try {
    const bytes = Uint8Array.of(0x94,0x6e);
    const r = archived;
    const horse_ref='fixture-ref';
    const writer=createHistoryWriter({store,readPersistedRuns:async()=>[{...r,horse_ref}]});
    const documentId = await writer({rawBytes:bytes,decodedText:'馬',sourceUrl:
      'https://www.jra.go.jp/JRADB/accessS.html?CNAME='+encodeURIComponent(r.source_ref),
      sourceRef:r.source_ref,fetchedAt:'2026-09-18T00:00:00Z',extractorId:'fixture',
      raceId:r.race_id,parsedRefs:[{horse_ref,horse_name:r.horse_name}]});
    store.close();
    store=openResearchStore(path);
    assert.deepEqual(Buffer.from(store.read(documentId).raw_bytes,'base64'),Buffer.from(bytes));
    const context={fixture:true}, jobId='isolated-job', now=Date.parse('2026-11-22T01:00:00Z');
    const selection={jobId, contextHash:sha(context), ready:true,claimed:true,
      leaseUntil:new Date(now+10000).toISOString(),saveCutoff:new Date(now+9000).toISOString(),
      observedAt:new Date(now-1000).toISOString(),rows:[{documentId,sourceRef:r.source_ref,
        raceId:r.race_id,runId:r.run_id,horseId:r.horse_id}]};
    const selectedRow={source_kind:'DB',selected_run_id:r.run_id,selected_horse_id:r.horse_id,
      selected_source_ref:r.source_ref,selected_race_id:r.race_id};
    selection.rows=[store.selectedDocument(selectedRow,selection.observedAt)];
    assert.equal(selection.rows[0].documentId,documentId);
    assert.throws(()=>store.selectedDocument({...selectedRow,source_kind:'LIVE'},selection.observedAt));
    assert.throws(()=>store.selectedDocument(selectedRow,'2000-01-01T00:00:00Z'));
    const observe=createClaimObserver({store,resolveCheckedSelection:async()=>selection,now:()=>now});
    for(const {payload} of races){
      const request={context,jobId,payload};
      const decision=store.read(await observe(request)).decision;
      assert.equal(decision.submittedPayloadHash,sha(payload));
      assert.deepEqual(decision.reviews.map(h=>h.base_score),payload.audit.runner_history_checked.map(h=>h.base_score));
      assert.equal(decision.formalScoringAllowed,false);
      assert.equal(decision.submissionAudit.arithmeticOK,true);
      assert.ok(decision.submissionAudit.findings.some(f=>f.code==="FACTOR_PROOF_UNVERIFIED"));
      assert.equal(decision.submissionAudit.findings.filter(f=>f.code==="EYE_REVIEW_INCOMPLETE").length,payload.runners.length-5);
    }
    const args={context,jobId,payload:races[0].payload};
    await assert.rejects(observe({...args,context:{different:true}}),/CLAIM_SCOPE/);
    await assert.rejects(observe({...args,signal:AbortSignal.abort()}));
    selection.rows[0].horseId='0000000000';
    await assert.rejects(observe(args),/HISTORY_MISMATCH/);
    selection.leaseUntil=new Date(now).toISOString();
    await assert.rejects(observe(args),/EXPIRED/);
  } finally {store.close();rmSync(dir,{recursive:true,force:true});}
});

test('a tied winning priority discards candidate history and skips proof lookup', async () => {
  const { loadCheckedContext } = await import('./checked-context.mjs');
  const legacy = { runner_history: [{ horse_no: 1, past_runs: [{finish: 2}] }] };
  const candidate = { _research_selection: { rows: [{ runs: [{ selection_tied: true }] }] } };
  const result = await loadCheckedContext({
    readCandidate: async () => candidate,
    readLegacy: async () => legacy
  }, { authorizedRead: () => assert.fail('proof lookup must be skipped') });
  assert.equal(result.context, legacy);
  assert.deepEqual(result.accepted, []);
});

test('LIVE evidence requires the exact capture, horse ID, parsed run and as-of time', async () => {
  const {createLiveWriter, verifyLiveSlot} = await import('./live-evidence.mjs');
  const ref='/JRADB/accessU.html?CNAME=pw01dud002019100606/AA';
  const run={race_date:'2026-08-30',finish:1};
  const at='2026-11-22T00:00:00Z';
  const runner={horse_no:1,horse_ref:ref,past_runs:[run],source_checked_at:at};
  const doc=await createLiveWriter({retain:x=>x})({
    capture:{bytes:Uint8Array.of(1,2),at},raceId:'race',cname:'pw01dde0123/AA',runners:[runner]
  });
  const args={contextHash:'fixture',jobId:'fixture',horseNo:1,observedAt:at,
    leaseUntil:'2026-11-22T01:00:00Z',saveCutoff:'2026-11-22T01:00:00Z',
    slot:{source_kind:'LIVE',live_race_id:'race',horse_ref:ref,source_checked_at:at,live_input:run}};
  const deps={readAuthorized:async()=>[{document:doc}],verifyReceipt:async()=>true,
    parsePinnedCard:async()=>[runner],now:()=>Date.parse(at)};
  assert.ok(await verifyLiveSlot(args,deps));
  assert.equal(await verifyLiveSlot(args,{...deps,verifyReceipt:async()=>false}),null);
  assert.equal(await verifyLiveSlot(args,{...deps,parsePinnedCard:async()=>[{...runner,past_runs:[{...run,finish:2}]}]}),null);
  assert.equal(await verifyLiveSlot({...args,observedAt:'2026-11-21T00:00:00Z'},deps),null);
  assert.equal(await verifyLiveSlot(args,{...deps,readAuthorized:async()=>[{document:doc},{document:doc}]}),null);
});

test('broker signs exact private document and slot, rejects changed claim and expired read', async () => {
  const {generateKeyPairSync}=await import('node:crypto');
  const {createLiveReadBroker,createLiveReceiptVerifier}=await import('./live-receipt.mjs');
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const request={jobId:'fixture',contextHash:'ctx',raceId:'r',horseId:'h',historyHash:'hash'};
  let now=10, expiresAt=20;
  const broker=createLiveReadBroker({
    authorizeExactSlot:async r=>r===request?{expiresAt,lookup:{raceId:r.raceId}}:null,
    readPrivateArchive:async()=>[{bytes:'AQI='}], issuer:'fixture',signingKey:privateKey,now:()=>now
  });
  const verify=createLiveReceiptVerifier({authorities:{fixture:publicKey},now:()=>now});
  const [packet]=await broker(request);
  assert.equal(verify(packet,request),true);
  assert.equal(verify({...packet,document:{bytes:'AwQ='}},request),false);
  assert.equal(verify(packet,{...request,jobId:'other'}),false);
  now=expiresAt;
  assert.equal(verify(packet,request),false);
  assert.deepEqual(await broker(request),[]);
});

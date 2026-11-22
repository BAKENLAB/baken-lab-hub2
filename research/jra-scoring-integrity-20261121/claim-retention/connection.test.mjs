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

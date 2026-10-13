import test from 'node:test';
import assert from 'node:assert/strict';
import {collectClaimedContext, ContextError} from './local-worker-data.mjs';

const T=Date.parse('2026-10-13T01:10:00Z');
const iso=x=>new Date(x).toISOString();
const race={race_date:'2026-10-13',track:'盛岡',race_no:1,circuit:'LOCAL',
  race_name:'regression fixture',post_time:iso(T+7200000),prediction_status:'PENDING',
  field_payload:{runners:[{horse_no:1,horse_name:'HORSE_A',status:'ACTIVE'},
                          {horse_no:2,horse_name:'HORSE_B',status:'ACTIVE'}]}};
const state={race,
  job:{id:'job-fixture',race_date:race.race_date,track:race.track,race_no:1,circuit:'LOCAL',
    worker_run_id:'run-fixture',claimed_by:'test-worker',claim_token:'test-token',
    attempts:1,max_attempts:3,job_status:'CLAIMED',lease_until:iso(T+1800000)},
  run:{id:'run-fixture',worker_id:'test-worker',status:'RUNNING'},
  protocol:{protocol_key:'LOCAL_MAIN',version:'TEST_LOCAL',is_active:true}};
const ref=n=>'https://www.keiba.go.jp/KeibaWeb/Horse/?k_lineageLoginCode='+n;
const current=n=>({horse_no:n,horse_name:n===1?'HORSE_A':'HORSE_B',status:'ACTIVE',
  sex_age:'牡3',weight_carried:54,jockey:'TEST',identity_refs:[ref(n)]});
const history=(n,i)=>({race_date:'2026-09-'+String(25-i).padStart(2,'0'),
  track:'盛岡',race_no:i+1,horse_no:n,horse_name:n===1?'HORSE_A':'HORSE_B',
  horse_ref:ref(n),source:'NAR_OFFICIAL_RESCUE',source_ref:ref(n),finish:i+1});
function fixture({cardCount=6,badField=false,nullHistory=false}={}){
  const snapshot={...race,source:'NAR_OFFICIAL_DEBA',
    source_ref:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=10&k_raceDate=2026%2F10%2F13&k_raceNo=1',
    fetched_at:iso(T-1000),
    runners:[current(1),{...current(2),horse_name:badField?'WRONG_HORSE':'HORSE_B'}],
    conditions:{surface:'ダート',distance:1200},
    history:[...Array.from({length:cardCount},(_,i)=>({...history(1,i),horse_no:1,past_horse_no:1})),
      ...(nullHistory?[null]:[])]};
  return {now:()=>T,timeoutMs:500,predictionReserveMs:20000,
    db:{readHorseRuns:async runner=>runner.horse_no===2?Array.from({length:5},(_,i)=>history(2,i)):[],
      readOfficialHistory:async()=>[]},
    official:{readRace:async()=>snapshot,readHistory:async()=>[]}};
}
test('one horse oversized history is isolated; other horse retains all 5 verified runs',async()=>{
  const context=await collectClaimedContext(state,fixture({cardCount:6}));
  assert.equal(context.runners.length,2);
  assert.equal(context.runners.find(x=>x.horse_no===1).recent_runs.length,0);
  assert.equal(context.runners.find(x=>x.horse_no===2).recent_runs.length,5);
  assert.ok(context.runners.find(x=>x.horse_no===1).missing_items.some(x=>x.startsWith('history_quarantined:')));
  assert.deepEqual(context.supplementation_audit.filter(x=>x.stage==='HISTORY_QUARANTINE').map(x=>x.horse_no),[1]);
});
test('normal five-run input preserves unchanged history count',async()=>{
  const context=await collectClaimedContext(state,fixture({cardCount:5}));
  assert.deepEqual(context.runners.map(x=>x.recent_runs.length),[5,5]);
  assert.equal(context.supplementation_audit.filter(x=>x.stage==='HISTORY_QUARANTINE').length,0);
});
test('malformed single historical item does not crash entire race',async()=>{
  const context=await collectClaimedContext(state,fixture({cardCount:2,nullHistory:true}));
  assert.deepEqual(context.runners.map(x=>x.recent_runs.length),[2,5]);
});
test('a mismatched current official field still blocks the entire race',async()=>{
  await assert.rejects(()=>collectClaimedContext(state,fixture({badField:true})),
    e=>e instanceof ContextError && e.code==='FIELD_STATUS_CONFLICT');
});

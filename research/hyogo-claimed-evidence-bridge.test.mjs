import test from 'node:test';
import assert from 'node:assert/strict';
import {collectClaimedContext} from '../automation/local-worker-data.mjs';
import {buildLocalRelativeConditionComparison} from '../automation/local-relative-condition-comparison.mjs';
const now=Date.parse('2026-11-11T10:15:00+09:00');
const race={race_date:'2026-11-11',track:'園田',race_no:1,circuit:'LOCAL',
 post_time:'2026-11-11T10:40:00+09:00',prediction_status:'PENDING',
 field_payload:{runners:[{horse_no:2,horse_name:'エディットフォース',status:'ACTIVE'}]}};
const state={race,run:{id:'run1',status:'RUNNING',worker_id:'worker1'},
 job:{race_date:race.race_date,track:race.track,race_no:race.race_no,
  circuit:'LOCAL',job_status:'CLAIMED',worker_run_id:'run1',
  claimed_by:'worker1',claim_token:'safe-claim',attempts:1,max_attempts:2,
  lease_until:'2026-11-11T10:35:00+09:00',id:'job1'},
 protocol:{version:'1.6',protocol_key:'LOCAL_MAIN',is_active:true}};
const source=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable');
source.searchParams.set('k_babaCode','27');
source.searchParams.set('k_raceDate','2026/11/11');
source.searchParams.set('k_raceNo','1');
const officialRunner={horse_no:2,horse_name:'エディットフォース',status:'ACTIVE',
 sex_age:'牡3',jockey:'廣瀬航',trainer:'柏原誠路'};
const snapshot={race_date:'2026-11-11',track:'園田',race_no:1,circuit:'LOCAL',
 source:'NAR_OFFICIAL_DEBA',source_ref:source.href,
 fetched_at:'2026-11-11T10:14:57+09:00',
 runners:[officialRunner],history:[],conditions:{surface:'ダート',
 distance:1400,going:'良',weather:'晴',turn:'右',class_name:'C3三組'}};
const ability={horse_no:2,horse_name:'エディットフォース',source:'HYOGO_OFFICIAL_ABILITY_TEST',
 category:'能力検査',identity_method:'EXACT_NAME_AGE_TRAINER_NOT_STABLE_HORSE_ID',
 trainer:'柏原 誠路',age:3,passed:true,official_race_result:false,
 valid_for_provisional_comparison:true,
 event_date:'2026-10-27',source_ref:'https://www.sonoda-himeji.jp/data/ability/detail/135',
 time_seconds:78,distance:1200,same_session_distance_peer_count:3,
 same_session_faster_or_equal_count:1,as_of:'2026-11-11T10:15:00+09:00'};
const db={readHorseRuns:async()=>[],readOfficialHistory:async()=>[]};
test('verified zero-run official claimed context carries Hyogo test into comparison, never invents old races',async()=>{
 let readCount=0;
 const official={readRace:async()=>snapshot,readHistory:async()=>[],
  readAbility:async (_race,opts)=>{readCount++;
   assert.equal(opts.runners.length,1);
   assert.equal(opts.runners[0].trainer,'柏原誠路');
   return {status:'READY_RESEARCH_ONLY',market_used:false,
    production_rank_effect:false,evidence:[ability]};}};
 const ctx=await collectClaimedContext(state,{db,official,now:()=>now});
 assert.equal(readCount,1);
 assert.equal(ctx.runners[0].recent_runs.length,0);
 assert.equal(ctx.runners[0].ability_test.source_ref,ability.source_ref);
 assert.ok(ctx.runners[0].missing_items.includes('verified_history'));
 const paired=buildLocalRelativeConditionComparison(
  [ctx.runners[0],{horse_no:3,horse_name:'対戦馬',recent_runs:[]}],
  ctx.race.conditions,ctx.race.race_date);
 assert.equal(paired.status,'READY');
 assert.equal(paired.runner_evidence.find(x=>x.horse_no===2).ability_test.time_seconds,78);
 assert.equal(paired.market_used,false);
 assert.equal(paired.rank_effect,false);
});
test('missing official trainer or source failure never fabricates ability evidence',async()=>{
 let calls=0;
 const field={...snapshot,runners:[{...officialRunner,trainer:null}]};
 const out=await collectClaimedContext(state,{db,now:()=>now,
  official:{readRace:async()=>field,readHistory:async()=>[],
   readAbility:async()=>{calls++;throw Error('must not fetch without verified trainer');}}});
 assert.equal(calls,0);
 assert.equal(out.runners[0].ability_test,undefined);
});

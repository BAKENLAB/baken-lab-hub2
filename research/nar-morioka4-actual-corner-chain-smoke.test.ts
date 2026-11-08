/**
 * Diagnostic one-day NAR actual result chain, no server secret and no DB.
 * Reuses the actual official card reader, actual NAR horse-profile reader,
 * actual NAR past-result corner reader, and actual snapshot-sanitizing gate.
 * Only two selected horse profiles, at most two prior starts per horse.
 * Store is MEMORY ONLY and no CLAIM, prediction, betting, or FROZEN happens.
 */
import {createNarOfficialReader} from '../automation/nar-official-data.mjs';
import {runAuthorizedLocalCornerPreclaim} from '../automation/local-official-preclaim-workflow.mjs';
import {prepareLocalOfficialCornerPacket} from '../automation/nar-official-corner-acquisition.mjs';
import {lookupLocalCornerSnapshot} from '../automation/local-corner-snapshot-handoff.mjs';
const race={
 race_date:'2026-11-08',track:'盛岡',race_no:4,circuit:'LOCAL',
 post_time:'2026-11-08T13:30:00+09:00',prediction_status:'PENDING',
 field_payload:{runners:[
  {horse_no:1,horse_name:'センゲントップ',status:'ACTIVE'},
  {horse_no:2,horse_name:'イコミキマル',status:'ACTIVE'},
  {horse_no:3,horse_name:'スパンキーウェーブ',status:'ACTIVE'},
  {horse_no:4,horse_name:'チュオンソン',status:'ACTIVE'},
  {horse_no:5,horse_name:'グレースアイリス',status:'ACTIVE'},
  {horse_no:6,horse_name:'ハラマキ',status:'ACTIVE'},
  {horse_no:7,horse_name:'マトリカリア',status:'ACTIVE'},
  {horse_no:8,horse_name:'エサン',status:'ACTIVE'},
  {horse_no:9,horse_name:'ブライティアロード',status:'ACTIVE'},
  {horse_no:10,horse_name:'ノボキセキ',status:'ACTIVE'}
 ]}
};
Deno.test('NAR current Morioka4 REAL reader -> past race corners -> append-only memory snapshot -> readback',async()=>{
 if(Date.now()>=Date.parse(race.post_time)-10*60*1000){
  console.log('SKIPPED_OUTSIDE_PRECLAIM_WINDOW');
  return;
 }
 const real=createNarOfficialReader({now:()=>Date.now()});
 let stored:Record<string,unknown>|null=null;
 const store={
  async insertIfAbsent(row:Record<string,unknown>){
   if(stored)throw Error('APPEND_ONLY_REINSERT_DENIED');
   stored={...structuredClone(row),captured_at:row.as_of};
   return {inserted:true};
  },
  async findLatest(){return stored;}
 };
 let officialProfiles=0,oldResultRequests=0;
 const originalFetch=fetch;
 const result=await runAuthorizedLocalCornerPreclaim({
  race,clock:()=>Date.now(),store,
  assertAuthorized:async ({raceKey})=>{
   if(JSON.stringify(raceKey)!==JSON.stringify([race.race_date,race.track,race.race_no]))
    throw Error('UNAUTHORIZED_RACE_KEY');
  },
  officialReader:{
   readRace:(current,opts,signal)=>real.readRace(current,opts,signal),
   readHistory:async (current,opts,signal)=>{
    // This bounded canary intentionally selects only two current horse IDs.
    // It does not claim to check all ten official profiles.
    if(current.horse_no!==1&&current.horse_no!==2)return [];
    officialProfiles++;
    const runs=await real.readHistory(current,opts,signal);
    return runs.slice(0,2);
   }
  },
  prepareCorners:(args)=>prepareLocalOfficialCornerPacket({
   ...args,maxPriorRaces:4,timeoutMs:1800,
   fetchImpl:(url,options)=>{
    oldResultRequests++;
    return originalFetch(url,options);
   }
  }),
  perHorseDeadlineMs:2500,officialCardTimeoutMs:7000,
  reserveMs:300000
 });
 console.log(JSON.stringify({status:result.status,profiles_attempted:officialProfiles,
  verified_horse_profile_calls:result.readCount,old_result_requests:oldResultRequests,
  linked_prior_runs:result.linkedRunEvidence,store_written:result.storeWritten,
  report_statuses:(result.horseReports??[]).map((r)=>r.status),
  claim_started:false,prediction_saved:false,rank_changed:false
 }));
 if(result.status!=='STORED'||!stored||result.linkedRunEvidence<1)
  throw Error('LIVE_OFFICIAL_PAST_CORNER_MEMORY_HANDOFF_NOT_COMPLETED');
 const copy=await lookupLocalCornerSnapshot({
  race,officialRunners:race.field_payload.runners,store,clock:()=>Date.now()
 });
 if(!copy||copy.linkedRunEvidence<1||copy.evidence.some((x)=>
  ![1,2].includes(x.horseNo)||x.source!=='NAR_OFFICIAL_PAST_RACE_RESULT'))
  throw Error('SAFE_READBACK_NOT_VERIFIED');
 console.log(JSON.stringify({status:'REAL_PAST_OFFICIAL_CORNER_READBACK_OK',
  linked_runs:copy.linkedRunEvidence,
  current_horse_nos:[...new Set(copy.evidence.map((x)=>x.horseNo))],
  claim_started:false,prediction_saved:false,market_used:false}));
});

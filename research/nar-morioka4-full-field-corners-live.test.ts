/**
 * One-time research canary: real current NAR field, all 10 official horse
 * profiles, up to 3 prior starts per horse, past result corners, and the same
 * append-only snapshot/readback validation used by server preclaim.
 *
 * PUBLIC OFFICIAL WEB ONLY. MEMORY STORE ONLY. No Supabase writes, no credentials,
 * no ranks, no CLAIM, no prediction save, no race results after departure.
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
Deno.test('REAL NAR full Morioka4 all 10 historic horse profiles and bounded official corner handoff',async()=>{
 const now=Date.now(),post=Date.parse(race.post_time);
 if(now>=post-10*60*1000){
  console.log(JSON.stringify({status:'SKIPPED_POST_EVIDENCE_DEADLINE'}));
  return;
 }
 const actual=createNarOfficialReader({now:()=>Date.now()});
 let storeRow:any=null;
 let profileRequests=0,profileWithResults=0,historicResultRequests=0;
 const fakeDb={
  async insertIfAbsent(row:Record<string,unknown>){
   if(storeRow)throw Error('APPEND_ONLY_ALREADY_STORED');
   storeRow={...structuredClone(row),captured_at:row.as_of};
   return {inserted:true};
  },
  async findLatest(){return storeRow;}
 };
 const result=await runAuthorizedLocalCornerPreclaim({
  race,clock:()=>Date.now(),store:fakeDb,
  assertAuthorized:async ({raceKey}:{raceKey:unknown[]})=>{
   if(JSON.stringify(raceKey)!==JSON.stringify([race.race_date,race.track,race.race_no]))
    throw Error('RACE_KEY_UNAUTHORIZED');
  },
  officialReader:{
   readRace:(r:any,opts:any,signal:AbortSignal)=>actual.readRace(r,opts,signal),
   readHistory:async(r:any,opts:any,signal:AbortSignal)=>{
    profileRequests++;
    const history=await actual.readHistory(r,opts,signal);
    if(history.length)profileWithResults++;
    return history.slice(0,3);
   }
  },
  prepareCorners:(params:any)=>prepareLocalOfficialCornerPacket({
   ...params,maxPriorRaces:24,timeoutMs:1500,
   fetchImpl:(url:RequestInfo|URL,options:RequestInit)=>{
    historicResultRequests++;return fetch(url,options);
   }
  }),
  perHorseDeadlineMs:2000,officialCardTimeoutMs:6500,reserveMs:5*60000
 });
 let lookup:any=null;
 if(storeRow)lookup=await lookupLocalCornerSnapshot({
  race,officialRunners:race.field_payload.runners,store:fakeDb,clock:()=>Date.now()
 });
 const horseNos=new Set((lookup?.evidence??[]).map((x:{horseNo:number})=>x.horseNo));
 console.log(JSON.stringify({
  status:result.status,profiles_attempted:profileRequests,
  profiles_with_history:profileWithResults,
  profile_read_calls:result.readCount,
  official_prior_result_requests:historicResultRequests,
  official_corner_runs:result.linkedRunEvidence??0,
  horses_with_matched_corners:horseNos.size,
  stored_memory:result.storeWritten===true,
  safe_readback:Boolean(lookup),
  reasons:(result.horseReports??[]).map((r:{horseNo:number;status:string;runs?:number})=>({
   no:r.horseNo,status:r.status,verified_profile_runs:r.runs??0
  })),
  claimed:false,save:false,rank_changed:false,market_used:false
 }));
 if(profileRequests!==10||profileWithResults<8)
  throw Error('NAR_FULL_CURRENT_FIELD_HORSE_PROFILE_COVERAGE_LOW');
 if(result.status!=='STORED'||!lookup||horseNos.size<3)
  throw Error('NAR_CURRENT_FIELD_CORNERS_HANDOFF_COVERAGE_LOW');
});

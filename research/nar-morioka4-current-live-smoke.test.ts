/**
 * Operational, read-only, one-day smoke of current NAR official runner + identity.
 * Neither claims nor saves a prediction, nor accesses market data or DB.
 * After 2026-11-08 13:20 JST the test skips rather than fetching a finished
 * race's results. A failure is diagnostic; it must not change normal FROZEN.
 */
import {createNarOfficialReader} from '../automation/nar-official-data.mjs';
type OfficialRunner = {horse_no:number;horse_name:string;status:string;horse_link_evidence?:{horse_ref:string};identity_refs?:string[]};
const race={
 race_date:'2026-11-08',track:'盛岡',race_no:4,circuit:'LOCAL',
 post_time:'2026-11-08T13:30:00+09:00',prediction_status:'PENDING'
};
const expected=[
 [1,'センゲントップ'],[2,'イコミキマル'],[3,'スパンキーウェーブ'],
 [4,'チュオンソン'],[5,'グレースアイリス'],[6,'ハラマキ'],
 [7,'マトリカリア'],[8,'エサン'],[9,'ブライティアロード'],
 [10,'ノボキセキ']
];
Deno.test('LIVE READ ONLY: NAR Morioka4 official current horse links and past-run ID',async()=>{
 const now=Date.now();
 if(now>=Date.parse(race.post_time)-10*60*1000){
  console.log('SKIPPED_AFTER_SAFE_PREFLIGHT_WINDOW');
  return;
 }
 const reader=createNarOfficialReader({now:()=>Date.now()});
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),12000);
 try{
  const card=await reader.readRace(race,{limit:5},controller.signal);
  if(card.source!=='NAR_OFFICIAL_DEBA'||card.runners.length!==expected.length)
   throw Error('LIVE_CURRENT_OFFICIAL_ROSTER_UNVERIFIED');
  for(const [no,name] of expected){
   const x=card.runners.find((h:OfficialRunner)=>h.horse_no===no);
   if(!x||x.horse_name!==name||x.status!=='ACTIVE')
    throw Error('LIVE_OFFICIAL_ROSTER_IDENTITY_MISMATCH_'+no);
  }
  const identities=card.runners.filter((h:OfficialRunner)=>
   h.horse_link_evidence?.horse_ref&&
   h.identity_refs?.includes(h.horse_link_evidence.horse_ref));
  if(identities.length<1)throw Error('NO_OFFICIAL_DOM_OWNED_HORSE_REFERENCE');
  const h=identities[0];
  const runs=await reader.readHistory(h,{race,before:race.race_date,limit:5},controller.signal);
  if(!Array.isArray(runs)||runs.length===0||runs.some((p)=>
   p.horse_ref!==h.horse_link_evidence.horse_ref||
   p.horse_name!==h.horse_name||p.race_date>=race.race_date||
   !Number.isInteger(p.horse_no)))throw Error('LIVE_OFFICIAL_HORSE_HISTORY_NOT_VERIFIED');
  console.log(JSON.stringify({
   status:'OFFICIAL_CURRENT_CARD_AND_HISTORY_VERIFIED',
   field_horses:card.runners.length,
   independent_identity_links:identities.length,
   checked_horse_no:h.horse_no,
   verified_prior_runs:runs.length,
   claim_started:false,prediction_saved:false,market_used:false
  }));
 }finally{clearTimeout(timer);controller.abort();}
});

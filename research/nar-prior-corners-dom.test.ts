import {extractNarPriorCornerHtml} from '../automation/nar-prior-corners-official-source.mjs';
import {buildVerifiedPriorCornerEvidence} from '../automation/nar-prior-corners.mjs';
import {prepareLocalOfficialCornerPacket} from '../automation/nar-official-corner-acquisition.mjs';
import {runAuthorizedLocalCornerPreclaim} from '../automation/local-official-preclaim-workflow.mjs';
import {lookupLocalCornerSnapshot} from '../automation/local-corner-snapshot-handoff.mjs';
import {buildLocalClaimedCornerShadow} from '../automation/local-claimed-corner-shadow.mjs';

const html = [
 '<!DOCTYPE html><html><body>',
 '<h2>2026年11月7日（土）　佐　賀　第5競走　競走成績</h2>',
 '<table><thead><tr>',
 '<th>着順</th><th>枠</th><th>馬番</th><th>馬名</th><th>所属</th>',
 '</tr></thead><tbody>',
 ...Array.from({length:11},(_,i)=>'<tr><td>'+String(i+1)+'</td><td>1</td><td>'+String(i+1)+'</td><td>架空馬'+String(i+1)+'</td><td>佐賀</td></tr>'),
 '</tbody></table>',
 '<h3>全馬コーナー通過順</h3>',
 '<table>',
 '<tr><th>１角</th><td>6 , 7 , ( 4 , 9 ) , ( 8 , 11 ) , 5 - 1 , ( 3 , 10 )- 2</td></tr>',
 '<tr><th>４角</th><td>11 , 9 - 8 , 7 - 3 , 10 , 4 , 1 , 5 , ( 6 , 2 )</td></tr>',
 '</table></body></html>'
].join('');
function check(value:unknown,expected:unknown,msg:string){if(value!==expected)throw new Error(msg+' expected '+expected+' got '+value);}
Deno.test('Deno+Cheerio: official prior-corner DOM bridge extracts only verified corner rows',()=>{
 const priorRace={raceDate:'2026-11-07',track:'佐賀',raceNo:5};
 const got=extractNarPriorCornerHtml(html,priorRace);
 check(got.knownHorseNos.length,11,'Horse count');
 check(got.officialHorseNames['6'],'架空馬6','Official prior-race horse name');
 check(got.cornerRows.length,2,'Corner count');
 const packet=buildVerifiedPriorCornerEvidence({
  ...got,priorRace,targetRaceDate:'2026-11-08',targetPostTime:'2026-11-08T09:00:00+09:00',
  sourceUrl:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=32&k_raceDate=2026%2F11%2F07&k_raceNo=5',
  sourceCheckedAt:'2026-11-08T07:00:00+09:00'
 });
 check(packet.runners.length,11,'Results mapped');
 check(packet.runners.find((v)=>v.prior_horse_no===6)?.early_pos,1,'First-corner 6');
 check(packet.runners.find((v)=>v.prior_horse_no===11)?.final_turn_pos,1,'Last-corner 11');
 check(packet.market_used,false,'No market');
 check(packet.scoring_effect,0,'No ranking change');
});
Deno.test('Deno+Cheerio: wrong official HTML structure fails closed',()=>{
 let rejected=false;
 try{extractNarPriorCornerHtml(html.replace('全馬コーナー通過順','出走表'),{raceDate:'2026-11-07',track:'佐賀',raceNo:5});}
 catch{rejected=true;}
 check(rejected,true,'Required official corner heading missing');
});
Deno.test('Deno+Cheerio: false title or horse number may not pass identity gate',()=>{
 const priorRace={raceDate:'2026-11-07',track:'佐賀',raceNo:5};
 const faulty=html.replace('佐　賀','高　知');
 const s=extractNarPriorCornerHtml(faulty,priorRace);
 let rejected=false;
 try{buildVerifiedPriorCornerEvidence({...s,priorRace,
 targetRaceDate:'2026-11-08',targetPostTime:'2026-11-08T09:00:00+09:00',
 sourceUrl:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=32&k_raceDate=2026%2F11%2F07&k_raceNo=5',
 sourceCheckedAt:'2026-11-08T07:00:00+09:00'});}
 catch{rejected=true;}
 check(rejected,true,'Race header mismatch');
});

Deno.test('full read-only preclaim chain: prior official HTML -> exact horse numbers -> position packet',async()=>{
 const targetRace={raceDate:'2026-11-08',track:'佐賀',raceNo:7,postTime:'2026-11-08T09:00:00+09:00'};
 const clock=()=>Date.parse('2026-11-08T07:00:00+09:00');
 let calls=0;
 const officialVerifiedRunners=[
  {horseNo:1,horseName:'架空馬6',verifiedRecentRuns:[{
    raceDate:'2026-11-07',track:'佐賀',raceNo:5,pastHorseNo:6,
    source:'NAR_OFFICIAL_RESCUE',identityVerifiedBy:'OFFICIAL_HORSE_REF',
    horseRef:'https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456',
    earlyPos:null,finalTurnPos:null
  }]},
  {horseNo:2,horseName:'架空馬11',verifiedRecentRuns:[{
    raceDate:'2026-11-07',track:'佐賀',raceNo:5,pastHorseNo:11,
    source:'NAR_OFFICIAL_RESCUE',identityVerifiedBy:'OFFICIAL_HORSE_REF',
    horseRef:'https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=223456',
    earlyPos:null,finalTurnPos:null
  }]}
 ];
 const result=await prepareLocalOfficialCornerPacket({targetRace,officialVerifiedRunners,
   clock,fetchImpl:async()=>{calls++;return new Response(html,{status:200,headers:{'content-type':'text/html'}});}});
 check(calls,1,'One past-result fetch for two horses');
 check(result.linkedRunEvidence,2,'Linked prior-running positions');
 check(result.evidence.find((e)=>e.horseNo===1)?.earlyPos,1,'Original 6 early');
 check(result.evidence.find((e)=>e.horseNo===2)?.finalTurnPos,1,'Original 11 final');
 check(result.claimStarted,false,'No CLAIM');
 check(result.saveAuthorized,false,'No SAVE');
});

Deno.test('FULL SHADOW PIPELINE: official card and past-horse witness -> real HTML parser -> snapshot -> claimed pace',async()=>{
 const postTime='2026-11-08T09:00:00+09:00';
 const clock=()=>Date.parse('2026-11-08T07:00:00+09:00');
 const race={
  circuit:'LOCAL',race_date:'2026-11-08',track:'佐賀',race_no:7,
  post_time:postTime,prediction_status:'PENDING',
  field_payload:{runners:[{horse_no:1,horse_name:'架空馬6',status:'ACTIVE'}]}
 };
 const url=new URL('https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable');
 url.searchParams.set('k_babaCode','32');
 url.searchParams.set('k_raceDate','2026/11/08');
 url.searchParams.set('k_raceNo','7');
 const horseRef='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456';
 const current={
  horse_no:1,horse_name:'架空馬6',status:'ACTIVE',
  identity_refs:[horseRef],horse_link_evidence:{horse_no:1,horse_ref:horseRef}
 };
 const history={
  race_date:'2026-11-07',track:'佐賀',race_no:5,horse_no:6,
  horse_name:'架空馬6',horse_ref:horseRef,source:'NAR_OFFICIAL_RESCUE'
 };
 const source={
  source:'NAR_OFFICIAL_DEBA',source_ref:url.href,
  circuit:'LOCAL',race_date:race.race_date,track:race.track,race_no:race.race_no,
  fetched_at:'2026-11-08T06:59:50+09:00',
  runners:[current]
 };
 let http=0,stored:Record<string,unknown>|null=null;
 const store={
  async insertIfAbsent(row:Record<string,unknown>){stored={...structuredClone(row),captured_at:row.as_of};return {inserted:true};},
  async findLatest(){return stored;}
 };
 const result=await runAuthorizedLocalCornerPreclaim({
  race,clock,store,assertAuthorized:async()=>{},
  officialReader:{
   readRace:async()=>source,
   readHistory:async()=>[history]
  },
  prepareCorners:(input:Parameters<typeof prepareLocalOfficialCornerPacket>[0])=>prepareLocalOfficialCornerPacket({
   ...input,fetchImpl:async()=>{http++;return new Response(html,{status:200,headers:{'content-type':'text/html'}});}
  })
 });
 check(result.status,'STORED','NAR archived DOM to append-only store');
 check(result.linkedRunEvidence,1,'Linked one official prior run');
 check(http,1,'Only one official archived result downloaded');
 const cornerPacket=await lookupLocalCornerSnapshot({
  race,officialRunners:[{horse_no:1,horse_name:'架空馬6'}],
  store,clock:()=>clock()+1000
 });
 check(cornerPacket?.evidence.length,1,'Safe claim-side read');
 const compact=[{horse_no:1,horse_name:'架空馬6',recent_runs:[
  {race_date:'2026-11-07',track:'佐賀',race_no:5,
   surface:'ダート',distance:1300,early_pos:null,final_turn_pos:null}
 ]}];
 const rich=[{...current,recent_runs:[{...history,
  identity_verified_by:'OFFICIAL_HORSE_REF',early_pos:null,final_turn_pos:null}]}];
 const shadow=buildLocalClaimedCornerShadow({
  targetRace:{raceDate:race.race_date,track:race.track,raceNo:race.race_no,
    postTime:race.post_time},
  verifiedRunners:rich,compactRunners:compact,cornerPacket,
  conditions:{surface:'ダート',distance:1300},clock:()=>clock()+1000
 });
 check(shadow.applied_prior_runs,1,'One verified prior run enriched');
 check(shadow.runners[0].recent_runs[0].early_pos,1,'First position fed to field pace');
 check(shadow.runners[0].recent_runs[0].final_turn_pos,10,'Final position fed to field pace');
 check(compact[0].recent_runs[0].early_pos,null,'Original production input unchanged');
 check(shadow.use_for_rank,false,'Still no ranking changes');
 check(shadow.use_for_save_gate,false,'Still no saving gate changes');
});

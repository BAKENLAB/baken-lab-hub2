import {extractNarPriorCornerHtml} from '../automation/nar-prior-corners-official-source.mjs';
import {buildVerifiedPriorCornerEvidence} from '../automation/nar-prior-corners.mjs';
import {prepareLocalOfficialCornerPacket} from '../automation/nar-official-corner-acquisition.mjs';

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
  {horseNo:1,horseName:'架空馬A',verifiedRecentRuns:[{
    raceDate:'2026-11-07',track:'佐賀',raceNo:5,pastHorseNo:6,
    source:'NAR_OFFICIAL_RESCUE',identityVerifiedBy:'OFFICIAL_HORSE_REF',
    horseRef:'https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123456',
    earlyPos:null,finalTurnPos:null
  }]},
  {horseNo:2,horseName:'架空馬B',verifiedRecentRuns:[{
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

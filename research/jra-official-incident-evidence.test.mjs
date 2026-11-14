import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJraOfficialIncidents,extractJraIncidentSection} from '../automation/jra-official-incident-evidence.mjs';
// Synthetic roster and statements, patterned on official JRA result examples; not actual race assertions.
function fixtures(parse){
 const url="https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw01sde0101202602050520260905%2FCA",now=Date.parse("2026-11-15T08:00:00+09:00");
 const run=(rows,overrides={},prior={},target={})=>parse({clock:()=>now,targetRace:{raceDate:"2026-11-15",postTime:"2026-11-15T12:00:00+09:00",...target},priorRace:{raceDate:"2026-09-05",track:"札幌",raceNo:5,raceKey:"fixture-race",sourceRef:url,...prior},source:{url,checkedAt:"2026-11-15T07:59:00+09:00",raceDate:"2026-09-05",track:"札幌",raceNo:5,raceKey:"fixture-race",verifiedOfficialResponse:true,fullFieldVerified:true,expectedRunnerCount:3,runners:[{horseNo:1,horseName:"サンプルA"},{horseNo:2,horseName:"サンプルB"},{horseNo:3,horseName:"サンプルC"}],sectionStatus:"PRESENT",sectionRows:rows,...overrides}});
 return [
 ["slow start",()=>run(["サンプルA号は、発進不良〔出遅れ〕。"]).events[0]?.kind==="SLOW_START"],
 ["other start not slow",()=>run(["サンプルB号は、発進不良〔内側に逃避〕。"]).events[0]?.kind==="OTHER_START_PROBLEM"],
 ["multi victim actor distinction",()=>run(["サンプルA号の騎手は、内側に斜行。（被害馬：２番・３番）"]).events.map(x=>x.role+":"+x.horse_no).join(",")==="ACTOR:1,VICTIM:2,VICTIM:3"],
 ["unknown victim",()=>run(["サンプルA号の騎手は、内側に斜行。（被害馬：９番）"]).status==="PARTIAL_OFFICIAL_INCIDENTS"&&run(["サンプルA号の騎手は、内側に斜行。（被害馬：９番）"]).events.length===0],
 ["self victim rejected",()=>run(["サンプルA号の騎手は、内側に斜行。（被害馬：１番）"]).events.length===0],
 ["other horse impact before exclusion",()=>run(["サンプルB号は、他の馬の影響を受けたため、出走制限の適用を除外。"]).events[0]?.kind==="OTHER_HORSE_IMPACT"],
 ["administration not ability",()=>run(["サンプルA号の調教師は、登録服色を使用できなかった。"]).non_performance?.length===1],
 ["missing is not clean",()=>!run([],{sectionStatus:"MISSING"}).verified],
 ["explicit none",()=>run(["なし"],{sectionStatus:"EXPLICIT_NONE"}).status==="EXPLICIT_NO_RECORDED_INCIDENTS"],
 ["unclassified preserved",()=>run(["サンプルA号は、未知の記載。"]).unresolved.length===1],
 ["wrong race",()=>!run(["なし"],{raceNo:4}).verified],
 ["unverified response",()=>!run(["なし"],{verifiedOfficialResponse:false}).verified],
 ["incomplete field",()=>!run(["なし"],{expectedRunnerCount:4}).verified],
 ["future checked time",()=>!run(["なし"],{checkedAt:"2026-11-15T12:00:00+09:00"}).verified],
 ["target race rejected",()=>!run(["なし"],{}, {raceDate:"2026-11-15"}).verified],
 ["no invented time loss",()=>run(["サンプルA号は、発進不良〔出遅れ〕。"]).events[0]?.time_loss_seconds===null],
 ["duplicates dedup",()=>run(["サンプルA号は、発進不良〔出遅れ〕。","サンプルA号は、発進不良〔出遅れ〕。"]).events.length===1],
 ["fake hostname",()=>!run(["なし"],{url:"https://www.jra.go.jp.example.com/JRADB/accessS.html?CNAME=pw01sde0101202602050520260905%2FCA"}).verified]
 ];
}
for(const [name,fn] of fixtures(parseJraOfficialIncidents))test(name,()=>assert.equal(fn(),true));
test('missing DOM',()=>assert.equal(extractJraIncidentSection(null).sectionStatus,'MISSING'));

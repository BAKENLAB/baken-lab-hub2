import test from 'node:test';
import assert from 'node:assert/strict';
import {officialHorseId,officialRaceCore,parseJraStewardsReport as parse,attachJraPriorIncidentEvidence as attach} from '../automation/jra-official-stewards-incident-link.mjs';
import {parseJraOfficialIncidents as resultParse} from '../automation/jra-official-incident-evidence.mjs';
// Regression fixtures: official report dated 2025-07-13 Fukushima 1R plus
// read-only archived roster refs. Text is a minimal normalized test sentence,
// not a recorded live fetch. Test timestamps are synthetic, never live evidence.
const ref='/JRADB/accessS.html?CNAME=pw01sde1003202502060120250713/BF';
const url='https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw2fsrp1003202502060120250713%2F4A';
const resultUrl='https://www.jra.go.jp'+ref;
const names=['リアアーテシアン','エレクトロン','コパノセビリア','リュウノエッセンス','ナンヨーラーク','リオンアンサー','フォトンゲイザー','イイクニパッション','ビップレオン'];
const refs=['2023103702/53','2023106608/A1','2023101306/7D','2023102830/DF','2023102598/44','2023100328/94','2023106479/22','2023100102/60','2023105996/EF'];
const roster=names.map((horseName,i)=>({horseNo:i+1,horseName,horseRef:'/JRADB/accessU.html?CNAME=pw01dud10'+refs[i]}));
const targetRace={raceDate:'2026-11-15',postTime:'2026-11-15T12:00:00+09:00'};
const clock=()=>Date.parse('2026-11-15T08:00:00+09:00');
const priorRace={raceDate:'2025-07-13',track:'福島',raceNo:1,raceKey:'20250713_福島_1R',sourceRef:ref};
const source={raceKey:priorRace.raceKey,raceDate:priorRace.raceDate,track:priorRace.track,raceNo:1,checkedAt:'2026-11-15T07:59:00+09:00',verifiedOfficialResponse:true,fullFieldVerified:true,expectedRunnerCount:9,runners:roster,url,paragraphs:['3コーナーで、1番リアアーテシアンの進路が狭くなる事象がありました。なお、この件についての制裁はありません。']};
const report=(s={})=>parse({targetRace,priorRace,source:{...source,...s},clock});
const current=[{horse_no:7,horse_name:names[0],horse_ref:roster[0].horseRef,status:'ACTIVE'}];
const live=[{...current[0],past_runs:[{race_date:priorRace.raceDate,source_ref:ref}]}];
const join=(packets,l=live,o=current)=>attach({targetRace,clock,officialRunners:o,liveRunners:l,packets});
test('stable id ignores official checksum and current number',()=>{assert.equal(officialHorseId(roster[0].horseRef),'2023103702');assert.equal(officialHorseId(roster[0].horseRef.replace('/53','/AA')),'2023103702');assert.equal(officialHorseId('https://evil.example'+roster[0].horseRef),null);});
test('report/result race identity',()=>{assert.equal(officialRaceCore(ref,'result'),officialRaceCore(url,'report'));assert.equal(officialRaceCore(url,'result'),null);});
test('no sanction still recorded victim',()=>{const p=report();assert.equal(p.verified,true);assert.equal(p.events.length,1);assert.equal(p.events[0].horse_id,'2023103702');assert.equal(p.events[0].role,'VICTIM');assert.equal(p.events[0].time_loss_seconds,null);});
test('multiple affected horses, actor not labeled victim',()=>{const p=report({paragraphs:['3コーナーで、3番コパノセビリアが内側に斜行したため、1番リアアーテシアン、2番エレクトロンの進路が狭くなりました。']});assert.deepEqual(p.events.map(e=>e.horse_no),[1,2]);});
test('number and name disagreement not credited',()=>{assert.equal(report({paragraphs:['3コーナーで、2番リアアーテシアンの進路が狭くなりました。']}).events.length,0);});
test('unverified report or future checkedAt refused',()=>{assert.equal(report({verifiedOfficialResponse:false}).verified,false);assert.equal(report({checkedAt:'2026-11-15T13:00:00+09:00'}).verified,false);});
test('mismatched report race refused',()=>assert.equal(report({url:url.replace('20250713','20250714')}).verified,false));
test('secondary mentions separate from primary',()=>{const p=report({paragraphs:['3コーナーで、1番リアアーテシアンの進路が狭くなる事象がありました。(その他5番および9番の進路に影響あり)']});assert.deepEqual(p.events.map(e=>[e.horse_no,e.kind]),[[5,'ADDITIONAL_PATH_IMPACT'],[9,'ADDITIONAL_PATH_IMPACT'],[1,'RESTRICTED_PATH']]);});
test('historical join by id not by current number',()=>{const x=join([report()]);assert.equal(x.runners[0].history[0].events[0].horse_no,1);assert.equal(x.runners[0].horse_no,7);assert.equal(x.rank_effect,'NONE');});
test('missing historical id blocks join',()=>{const p=report({runners:roster.map(h=>({...h,horseRef:null}))});assert.equal(join([p]).runners[0].history[0].status,'INCIDENT_SOURCE_OR_HORSE_ID_UNVERIFIED');});
test('missing live id blocks all-field result',()=>assert.equal(join([report()],[{...live[0],horse_ref:null}]).status,'LIVE_IDENTITY_MISMATCH'));
test('only five past runs, no target outcome',()=>{const x=join([report()],[{...live[0],past_runs:Array(6).fill(live[0].past_runs[0])}]);assert.equal(x.runners[0].history.length,5);assert.equal(x.target_result_used,false);});
test('same incident from multiple source types not two bonuses',()=>{const a=report(),b=resultParse({targetRace,priorRace,clock,source:{...source,url:resultUrl,sectionStatus:'PRESENT',sectionRows:['リアアーテシアン号は、発進不良〔出遅れ〕。']}});assert.equal(b.verified,true);const x=join([a,b]);assert.equal(x.runners[0].history[0].events.length,2);assert.equal(x.runners[0].history[0].same_incident_double_count_prohibited,true);assert.equal(x.rank_effect,'NONE');});
test('duplicate source ambiguous',()=>assert.equal(join([report(),report()]).runners[0].history[0].status,'DUPLICATE_SOURCE_REVIEW_REQUIRED'));

// Archived official report search text, source: https://www.jra.go.jp/JRADB/accessS.html?CNAME=pw2fsrp1003202502060120250713%2F4A.
// Explicit number/name and secondary list reflected in fixtures, not a verified raw HTML fetch.
test('separate paragraph additional affected horses using archived roster',()=>{const p=report({paragraphs:['3コーナーで、1番リアアーテシアンの進路が狭くなる事象がありました。','(その他5番および9番の進路に影響あり)','なお、この件についての制裁はありません。']});assert.deepEqual(p.events.map(e=>[e.horse_id,e.kind]),[['2023103702','RESTRICTED_PATH'],['2023102598','ADDITIONAL_PATH_IMPACT'],['2023105996','ADDITIONAL_PATH_IMPACT']]);});
test('secondary unknown number retained as unresolved',()=>{const p=report({paragraphs:['(その他5番および18番の進路に影響あり)']});assert.equal(p.events.length,0);assert.equal(p.status,'PARTIAL_REPORT');});
test('secondary repeated mention deduplicated',()=>{const p=report({paragraphs:['(その他5番および9番の進路に影響あり)','(その他5番の進路に影響あり)']});assert.equal(p.events.length,2);});


test('own evasion is explicitly self-caused, not external victim or score credit',()=>{
 const p=report({paragraphs:['最後の直線コースで、2番エレクトロンの騎手が追いづらくなる状況がありましたが、これは同馬が内側に逃避しようとしたことによるものでした。']});
 assert.equal(p.events.length,1);assert.equal(p.events[0].horse_id,'2023106608');
 assert.equal(p.events[0].kind,'SELF_EVASION');assert.equal(p.events[0].role,'SELF');
 assert.equal(p.events[0].rank_effect,'NONE');assert.equal(p.events[0].time_loss_seconds,null);
});
test('self-evasion wrong horse identity or ambiguous external cause never credited',()=>{
 const p=report({paragraphs:['最後の直線コースで、1番エレクトロンの騎手が追いづらくなる状況がありましたが、これは同馬が内側に逃避しようとしたことによるものでした。']});
 assert.equal(p.events.length,0);assert.equal(p.status,'PARTIAL_REPORT');
 const q=report({paragraphs:['2番エレクトロンが接触した。']});
 assert.equal(q.events.length,0);assert.equal(q.status,'PARTIAL_REPORT');
});

test('coverage: same prior race is not counted repeatedly',()=>{
 const x=join([report()],[{...live[0],past_runs:Array(5).fill(live[0].past_runs[0])}]);
 assert.equal(x.coverage.supplied_runs,5);
 assert.equal(x.coverage.verified_source_runs,1);
 assert.equal(x.coverage.unverified_runs,4);
 assert.equal(x.runners[0].history[1].status,'DUPLICATE_HISTORY_RACE');
 assert.equal(x.coverage.all_supplied_runs_have_a_source,false);
});
test('coverage: a partial official result remains partial when the report parses',()=>{
 const a=report(),b=resultParse({targetRace,priorRace,clock,source:{...source,url:resultUrl,sectionStatus:'PRESENT',sectionRows:['照合できない記載']}});
 assert.equal(b.status,'PARTIAL_OFFICIAL_INCIDENTS');
 const x=join([a,b]);
 assert.equal(x.coverage.verified_source_runs,1);
 assert.equal(x.coverage.result_source_runs,1);
 assert.equal(x.coverage.report_source_runs,1);
 assert.equal(x.coverage.partial_runs,1);
 assert.equal(x.runners[0].history[0].sources.length,2);
 assert.equal(x.rank_effect,'NONE');
});
test('coverage: horses with no supplied history are not reported as complete',()=>{
 const other={horse_no:8,horse_name:names[1],horse_ref:roster[1].horseRef,status:'ACTIVE'};
 const x=join([report()],[live[0],{...other,past_runs:[]}],[current[0],other]);
 assert.equal(x.coverage.active_runners,2);
 assert.equal(x.coverage.reviewed_runners,2);
 assert.equal(x.coverage.supplied_runs,1);
 assert.equal(x.coverage.not_supplied_slots,9);
 assert.equal(x.coverage.all_supplied_runs_have_a_source,false);
 assert.equal(x.runners[1].coverage.verified_source_runs,0);
});
test('coverage: no recorded event is not an assertion of an incident-free run',()=>{
 const other={horse_no:8,horse_name:names[1],horse_ref:roster[1].horseRef,status:'ACTIVE'};
 const x=join([report()],[{...other,past_runs:live[0].past_runs}],[other]);
 assert.equal(x.coverage.verified_source_runs,1);
 assert.equal(x.coverage.recorded_event_runs,0);
 assert.equal(x.runners[0].history[0].absence_is_not_no_incident,true);
});

test('actual JRA current card dud00 and historical dud10 resolve the same stable horse ID',()=>{
 const card='/JRADB/accessU.html?CNAME=pw01dud002024104323/B6';
 assert.equal(officialHorseId(card),'2024104323');
 assert.equal(officialHorseId(card.replace('dud00','dud10')),'2024104323');
 assert.equal(officialHorseId(card.replace('dud00','dud99')),null);
 const linked=join([report()],[{...live[0],horse_ref:live[0].horse_ref.replace('dud10','dud00')}],[{...current[0],horse_ref:current[0].horse_ref.replace('dud10','dud00')}]);
 assert.equal(linked.coverage.verified_source_runs,1);
});
import assert from 'node:assert/strict';
import {digest,narCardGap} from './audit.mjs';
const seenAt='2026-11-28T20:20:12+09:00';
const fact=(key,value,unit,source,scope,extra={})=>({key,value,unit,source,scope,observedAt:seenAt,tier:'OFFICIAL_SEARCH_VIEW_FACT_NOT_ORIGINAL',...extra});
const timeSeconds=s=>{const m=/^(\d+):(\d{2})\.(\d)$/.exec(s);if(!m||+m[2]>=60)throw Error('CLOCK');return +m[1]*60+Number(m[2])+Number(m[3])/10};
export function actualFacts(){
 const J='https://www.jra.go.jp/',N='https://www.keiba.go.jp/',jc='JRA-20261129-TOKYO-12',ko='NAR-20261128-KOCHI-12',past='NAR-31-20261115-05';
 const pastResult=N+'KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=31&k_raceDate=2026%2F11%2F15&k_raceNo=5';
 const a=timeSeconds('1:25.4'),b=timeSeconds('1:25.6');
 return [
 fact('margin_semantics',narCardGap(8,Math.round((a-timeSeconds('1:23.5'))*10)/10),'s',N+'Howtoread/theracecard.html',ko,{pastEvent:past,derivedFromDisplayedClocks:true,notOfficialExactGap:true}),
 fact('adjacent_display_clock_difference',Math.round((b-a)*10)/10,'s',pastResult,ko,{pastEvent:past,subjectPastNo:8,followingPastNo:10,officialMarginLiteral:'1',identity:'ROW_NUMBER_ONLY',notExactPhysicalGap:true}),
 fact('direct_pair_candidate',{currentNumbers:[1,2],pastNumbers:[8,1],finishes:[8,12]},'ordinal',pastResult,ko,{pastEvent:past,identity:'NAME_AND_PROFILE_CANDIDATES_NOT_DIRECT_LINK'}),
 fact('prior_result_visible_row_count',12,'rows',pastResult,ko,{pastEvent:past,fullNativeField:false}),
 fact('course_geometry_partial',{circuit:1100,straightToFinish:200,corners:4},'m except corner count',N+'dirtgraderace/2025/0325_kurofunesho/introduction.html',ko,{firstCornerDistance:null}),
 fact('course_geometry_partial',{firstCornerApprox:350,straight:525.9},'m',J+'keiba/thisweek/2026/0425_1/race.html',jc,{railVersionBound:false}),
 fact('official_rating',114,'rating',J+'datafile/ranking/g1/2026/jc.html',jc,{no:1,publishedDate:'2026-11-23',identity:'NUMBER_NAME_CANDIDATE',annualMaximum:true}),
 fact('official_rating',null,'rating',J+'datafile/ranking/g1/2026/jc.html',jc,{no:13,publishedDate:'2026-11-23',reason:'NO_QUALIFYING_VALUE_NOT_ZERO'}),
 fact('official_travel',{arrivalDate:'2026-11-19',destination:'東京競馬場'},'date',J+'news/202611/112003.html',jc,{foreignHorseCount:6,publishedDate:'2026-11-20',identity:'NAMED_GROUP_CANDIDATE'}),
 fact('official_training',{gait:'canter',laps:1.25},'laps',J+'news/202611/112804.html',jc,{no:18,publishedDate:'2026-11-28',identity:'NUMBER_NAME_CANDIDATE'}),
 fact('official_pedigree',{sire:'ルーラーシップ',damSire:'ステイゴールド'},'names',J+'JRADB/accessU.html?CNAME=pw01dud002021105521%2F7D',jc,{no:1,profileId:'2021105521',identity:'PROFILE_NOT_CARD_LINK'}),
 fact('official_incident_route',null,'none',J+'news/202610/100403.html',jc,{pastDate:'2026-10-04',reason:'DAY_NOTICE_SEEN_NO_SUBJECT_INCIDENT_BOUND'})
 ];
}
const facts=actualFacts();
assert.equal(facts.length,12);
assert.equal(facts[0].value.reference,'WINNER');
assert.equal(facts[0].value.seconds,1.9);
assert.equal(facts[1].value,0.2);
assert.equal(facts[2].value.finishes[1],12);
assert.equal(facts[3].fullNativeField,false);
assert.equal(facts[4].firstCornerDistance,null);
assert.equal(facts[5].railVersionBound,false);
assert.equal(facts[7].value,null);
assert.equal(facts[9].value.laps,1.25);
assert.equal(facts[11].value,null);
assert(facts.every(f=>f.tier==='OFFICIAL_SEARCH_VIEW_FACT_NOT_ORIGINAL'));
const packet={schema:'WORK19_LIMITED_FACT_OBSERVATIONS_1',facts,formalAdmission:false,publicationAllowed:false};
console.log(JSON.stringify({node:process.version,checks:12,observations:facts.length,digest:digest(packet),formalAdmission:false},null,2));

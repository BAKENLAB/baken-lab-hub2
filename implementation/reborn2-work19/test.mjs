import assert from 'node:assert/strict';
import {auditAll,legacyViews,narCardGap,digest} from './audit.mjs';
import {readFileSync} from 'node:fs';
const inventory=JSON.parse(readFileSync(process.argv[2],'utf8')).map(x=>({id:x.id,inputs:x.inputs,direct:x.direct===true||x.work16Status==='DIRECT_NOT_PUBLISHED'}));
const J='https://www.jra.go.jp/',N='https://www.keiba.go.jp/';
const observation='2026-11-28T20:17:32+09:00'; // clock reading after source observations.
const runs=[];
for(const [scope,n,post] of [['JRA-20261129-TOKYO-12',18,'2026-11-29T15:40:00+09:00'],['NAR-20261128-KOCHI-12',12,'2026-11-28T20:50:00+09:00']]){
 const j=scope.startsWith('JRA'),card=j?J+'JRADB/accessD.html?CNAME=pw01dde0105202605081220261129%2F3D':'https://sp.keiba.go.jp/KeibaWebSP/TodayRaceInfo/S_DebaTable?k_babaCode=31&k_raceDate=2026%2F11%2F28&k_raceNo=12';
 const roster=Array.from({length:n},(_,i)=>({no:i+1,identityStatus:'NUMBERED_CARD_ONLY'}));
 const evidence=[];const add=(no,key,source,status='CANDIDATE_OBSERVED',event='CURRENT',tier='REPORTED_OFFICIAL_SEARCH_VIEW')=>evidence.push({no,key,source,status,event,tier,contextOnly:event==='CURRENT'});
 for(const h of roster){for(const k of ['current_date','current_distance','current_class'])add(h.no,k,card);add(h.no,'course_geometry',j?J+'keiba/thisweek/2026/0425_1/race.html':N+'dirtgraderace/2025/0325_kurofunesho/introduction.html','PARTIAL_GEOMETRY_VERSION_OR_FIRST_CORNER_HELD');}
 if(j){roster[0].identityStatus='PROFILE_ID_CANDIDATE_NOT_CARD_LINK';const profile=J+'JRADB/accessU.html?CNAME=pw01dud002021105521%2F7D';add(1,'official_pedigree',profile);for(const k of ['finish','date','distance','surface','going','clock','weight','bodyWeight'])add(1,k,card,'CANDIDATE_OBSERVED','JRA-KYOTO-20261004-PAST','REPORTED_CARD_HISTORY');const rating=J+'datafile/ranking/g1/2026/jc.html';for(const h of roster){add(h.no,'official_rating',rating,[13,15].includes(h.no)?'PUBLISHED_TABLE_NO_QUALIFYING_VALUE':'CANDIDATE_OBSERVED');add(h.no,'published_time',rating,'CANDIDATE_OBSERVED','CURRENT','PUBLISHED_DATE_ONLY');}for(const no of [8,9,10,12,17,18])add(no,'official_travel',J+'news/202611/112003.html');for(const no of [8,18])add(no,'official_training',J+'news/202611/112804.html');}
 else{const prior=N+'KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=31&k_raceDate=2026%2F11%2F15&k_raceNo=5';const p1='https://sp.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=30005406376',p2='https://sp.keiba.go.jp/KeibaWeb/DataRoom/RaceHorseInfo?k_activeCode=1&k_lineageLoginCode=30028404096';roster[0].identityStatus='PROFILE_ID_CANDIDATE_NOT_CARD_LINK';roster[1].identityStatus='PROFILE_ID_CANDIDATE_NOT_CARD_LINK';add(2,'official_pedigree',p2);for(const h of roster)add(h.no,'margin_semantics',N+'Howtoread/theracecard.html','CANDIDATE_OBSERVED','CURRENT','CARD_TIME_GAP_ONLY');for(const no of [1,2]){for(const k of ['finish','date','distance','surface','going','clock','weight','bodyWeight','final600','ordinalUnlabeled'])add(no,k,prior,'CANDIDATE_OBSERVED','NAR-31-20261115-05','REPORTED_RESULT_ROW_NOT_NATIVE_LINK');add(no,'full_prior_result',prior,'SOURCE_ROWS_SEEN_NATIVE_LINK_HELD','NAR-31-20261115-05');}add(1,'field_identity',p1,'PROFILE_ID_CANDIDATE_NOT_CARD_LINK');add(2,'field_identity',p2,'PROFILE_ID_CANDIDATE_NOT_CARD_LINK');}
 const x=auditAll({inventory,roster,expectedCount:n,scope,views:[{scope,pin:'WORK19_OFFICIAL_SEARCH_OBSERVATION_V1',evidence}],observedAt:observation,post});
 assert.equal(new Set(x.rows.map(r=>r.no+":"+r.item)).size,n*115);assert.equal(new Set(x.rows.map(r=>r.no)).size,n);assert(x.rows.every(r=>r.judgment==='NOT_CERTIFIED'));assert(!x.formalAdmission&&!x.publicationAllowed);assert.equal(x.digest,digest(Object.fromEntries(Object.entries(x).filter(([k])=>k!=='digest'))));
 assert.throws(()=>auditAll({inventory,roster:roster.slice(1),expectedCount:n,scope,views:[],observedAt:observation,post}),/FULL_DENOMINATOR/);
 assert.throws(()=>auditAll({inventory,roster,expectedCount:n,scope,views:[{scope:'WRONG',pin:'x',evidence:[]}],observedAt:observation,post}),/VIEW_SCOPE/);
 assert.throws(()=>auditAll({inventory,roster,expectedCount:n,scope,views:[],observedAt:post,post}),/PREPOST/);
 runs.push({scope,summary:x.summary,digest:x.digest});
}
// Real Work18 recorded denominator, not synthetic horse or race. Two absent subjects retained.
const scope='LOCAL-20261128-SAGA-5';const roster=Array.from({length:7},(_,i)=>({no:i+1}));
const views=legacyViews({scope,originalPin:'981fe72df9067cfb5f47542d6595f8cfdd74328f',supplementPin:'c6e13aaf141c4d96a31780cb7ee3bc70f6f8a9a7',originalIndex:[],supplementDetails:[1,2,3,5,6].map(no=>({no,events:[{event:'WORK18_REPORTED_CORNER_SCOPE',keys:['positions','labels']}]}))});
const old=auditAll({inventory,roster,expectedCount:7,scope,views,observedAt:'2026-11-28T14:55:00+09:00',post:'2026-11-28T17:00:00+09:00'});
assert.deepEqual(old.summary[1].zeroCandidateSubjects,[4,7]);assert.equal(old.summary[0].zeroCandidateSubjects.length,7);assert.equal(old.rows.length,7*115*2);assert.equal(narCardGap(1,0.2).reference,'SECOND');assert.equal(narCardGap(8,1.9).reference,'WINNER');
console.log(JSON.stringify({node:process.version,inventoryDigest:digest(inventory),runs,legacyDenominator:old.summary,checks:21,formalAdmission:false},null,2));

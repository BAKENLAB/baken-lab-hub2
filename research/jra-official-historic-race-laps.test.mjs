import test from 'node:test';
import assert from 'node:assert/strict';
import {parseJraOfficialHistoricLaps} from '../automation/jra-official-historic-race-laps.mjs';
const clock=()=>Date.parse('2026-11-08T10:02:00+09:00');
const c='sw01sde0108202605011220261107/84';
const srcRef='/JRADB/accessS.html?CNAME='+encodeURIComponent(c);
const url='https://app.jra.jp/JRADB/accessS.html?CNAME='+encodeURIComponent(c);
const targetRace={raceDate:'2026-11-08',postTime:'2026-11-08T11:25:00+09:00'};
const priorRace={raceDate:'2026-11-07',track:'京都',raceNo:12,
 distance:2000,surface:'芝',sourceRef:srcRef};
const body='レース結果\n2026年11月7日（土曜）京都第12競走　芝2000メートル良　出走17頭\n'+
 '競走の成績と勝馬についての説明、負担重量、騎手、枠番号、各馬の着順　'.repeat(3)+
 '\nタイム\nハロンタイム | 12.8 - 11.5 - 12.6 - 12.3 - 12.1 - 12.2 - 11.5 - 11.4 - 11.9 - 11.5\n'+
 '上り | 4F46.3 - 3F34.8\nコーナー通過順位\n';
const source={url,bodyText:body,checkedAt:'2026-11-08T09:58:00+09:00',verifiedOfficialResponse:true};
const run=(o={})=>parseJraOfficialHistoricLaps({targetRace,priorRace,source,clock,...o});
test('official JRA 2000m splits provide measured first and last 600m, not a pace label',()=>{
 const x=run();
 assert.equal(x.status,'OFFICIAL_RACE_LAPS_VERIFIED');
 assert.equal(x.verified,true);
 assert.equal(x.lap_seconds.length,10);
 assert.equal(x.first_600m_seconds,36.9);
 assert.equal(x.last_600m_seconds,34.8);
 assert.equal(x.first_recorded_split_m,200);
 assert.equal(x.initial_three_splits_cover_m,600);
 assert.equal(x.pace_classification,'UNDETERMINED_WITHOUT_COHORT_REFERENCE');
 assert.equal(x.market_used,false);assert.equal(x.rank_effect,'NONE');
});
test('JRA official 1700m first 100m must not be misreported as first 600m',()=>{
 const c1700='sw01sde0103202603010320261107/A0';
 const h='2026年11月7日 福島 第3競走 ダート1700m '+ '結果競走 '.repeat(30)+
 '\nハロンタイム | 7.2 - 11.0 - 11.7 - 12.0 - 12.8 - 12.6 - 13.2 - 12.9 - 12.3\n上り | 3F38.4';
 const x=run({
  priorRace:{raceDate:'2026-11-07',track:'福島',raceNo:3,
   surface:'ダート',distance:1700,
   sourceRef:'/JRADB/accessS.html?CNAME='+encodeURIComponent(c1700)},
  source:{...source,url:'https://sp.jra.jp/JRADB/accessS.html?CNAME='+encodeURIComponent(c1700),bodyText:h}
 });
 assert.equal(x.status,'OFFICIAL_RACE_LAPS_VERIFIED');
 assert.equal(x.lap_seconds.length,9);
 assert.equal(x.first_recorded_split_m,100);
 assert.equal(x.initial_three_splits_cover_m,500);
 assert.equal(x.first_600m_seconds,null);
 assert.equal(x.last_600m_seconds,38.4);
 assert.equal(x.caution,'INITIAL_600M_NOT_COMPUTABLE_FROM_RECORDED_BOUNDARIES');
});
test('1150m starts with 150m, so no fabricated initial 600m',()=>{
 const cname='pw01sde0103202603010120261107/A9';
 const h='2026年11月7日 福島 1R ダート1150m '+ '競走成績 '.repeat(30)+
 '\nハロンタイム 9.3 - 11.2 - 12.2 - 12.1 - 12.7 - 12.8\n上り3F37.6';
 const x=run({
  priorRace:{raceDate:'2026-11-07',track:'福島',raceNo:1,
   surface:'ダート',distance:1150,
   sourceRef:'/JRADB/accessS.html?CNAME='+encodeURIComponent(cname)},
  source:{...source,url:'https://www.jra.go.jp/JRADB/accessS.html?CNAME='+encodeURIComponent(cname),bodyText:h}
 });
 assert.equal(x.status,'OFFICIAL_RACE_LAPS_VERIFIED');
 assert.equal(x.first_recorded_split_m,150);
 assert.equal(x.initial_three_splits_cover_m,550);
 assert.equal(x.first_600m_seconds,null);
 assert.equal(x.last_600m_seconds,37.6);
});
test('wrong official identity, unverified response and forged domain all fail closed',()=>{
 assert.equal(run({source:{...source,url:url.replace(c.split('/')[0],'xx01sde0108202605011220261107')}}).verified,false);
 assert.equal(run({source:{...source,verifiedOfficialResponse:false}}).status,'UNVERIFIED_RESULT_SOURCE');
 assert.equal(run({source:{...source,url:url.replace('app.jra.jp','unofficial.example')}}).status,'UNVERIFIED_RESULT_SOURCE');
 assert.equal(run({source:{...source,bodyText:body.replace('京都第12競走','東京第12競走')}}).status,'OFFICIAL_RACE_IDENTITY_MISMATCH');
});
test('lap sequence count must match track distance exactly',()=>{
 assert.equal(run({source:{...source,bodyText:body.replace(' - 11.5\n上り','\n上り')}}).status,
  'DISTANCE_SPLIT_COUNT_MISMATCH');
});
test('no future result, no after-post new evidence and no stale source',()=>{
 assert.equal(run({priorRace:{...priorRace,raceDate:'2026-11-08'}}).status,'UNVERIFIED_AS_OF_OR_RACE');
 assert.equal(run({clock:()=>Date.parse(targetRace.postTime)}).status,'UNVERIFIED_AS_OF_OR_RACE');
 assert.equal(run({source:{...source,checkedAt:'2026-11-05T09:58:00+09:00'}}).status,'UNVERIFIED_AS_OF_OR_RACE');
});

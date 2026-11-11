import test from 'node:test';
import assert from 'node:assert/strict';
import {
 parseHyogoAbilityIndex,parseHyogoAbilityDetail,matchHyogoAbilityEvidence,
 collectHyogoAbilityBeforeRace,HYOGO_ABILITY_SOURCE
} from '../automation/hyogo-official-ability-evidence.mjs';
const detail='https://www.sonoda-himeji.jp/data/ability/detail/135';
const label='<tr><th>馬名</th><th>齢</th><th>距離</th><th>タイム</th><th>体重</th><th>きゅう舎</th><th>合否</th></tr>';
const row=(n,age,d,t,w,tr,p='合格')=>'<tr><td>'+n+'</td><td>'+age+'</td><td>'+d+'</td><td>'+t+'</td><td>'+w+'</td><td>'+tr+'</td><td>'+p+'</td></tr>';
const html='<html><body><h1>能力検査 結果</h1><p>2026/10/27</p>'+
 '<p>西脇トレーニングセンター</p><p>天候：晴 馬場状態：不良</p>'+
 '<h2>ゲート検査</h2><table>'+label+row('エディットフォース',3,1200,'1,15.0',532,'柏原 誠路')+'</table>'+
 '<h2>能力検査</h2><table>'+label+
 row('チッタマッローネ',2,1200,'1,18.2',530,'石橋 満')+
 row('リリーパーク',4,1200,'1,18.1',430,'平松 徳彦')+
 row('エディットフォース',3,1200,'1,18.0',532,'柏原 誠路')+'</table>'+
 '<h2>自主参加</h2><table>'+label+row('他馬',3,1200,'1,17.0',500,'仮厩舎')+'</table></body></html>';
const race={race_date:'2026-11-11',track:'園田',post_time:'2026-11-11T10:40:00+09:00',
 observation_at:'2026-11-11T10:15:00+09:00'};
const runners=[{horse_no:2,horse_name:'エディットフォース',sex_age:'牡3',trainer:'柏原誠路'},
 {horse_no:10,horse_name:'ハギノメルヴェイユ',sex_age:'牝3',trainer:'飯田良弘'}];
test('official index resolves only official Hyogo detail URLs',()=>{
 const list='<a href="/data/ability/detail/135">2026/10/27</a>'+
 '<a href="https://evil.example/data/ability/detail/136">not official</a>'+
 '<a href="/data/ability/detail/135">duplicate</a>'+
 '<a href="/data/ability/detail/136?foo=1">query rejected</a>';
 assert.deepEqual(parseHyogoAbilityIndex(list),[detail]);
});
test('extracts official ability TEST separately from gate test and voluntary runs',()=>{
 const x=parseHyogoAbilityDetail(html,detail);
 assert.equal(x.status,'PARSED');assert.equal(x.event_date,'2026-10-27');
 assert.equal(x.venue,'西脇トレーニングセンター');
 assert.equal(x.going,'不良');
 const edit=x.entries.filter(e=>e.horse_name==='エディットフォース');
 assert.equal(edit.length,2);assert.deepEqual(edit.map(e=>e.section),['ゲート検査','能力検査']);
 assert.equal(edit[1].time_seconds,78);
 assert.equal(edit[1].body_weight,532);
});
test('2026-11-11 debut runner receives matched ability with official as-of source and peer context',()=>{
 const out=matchHyogoAbilityEvidence({race,runners,details:[parseHyogoAbilityDetail(html,detail)]});
 assert.equal(out.status,'READY_RESEARCH_ONLY');
 assert.equal(out.evidence.length,1);
 const e=out.evidence[0];
 assert.equal(e.horse_no,2);assert.equal(e.source,HYOGO_ABILITY_SOURCE);
 assert.equal(e.category,'能力検査');assert.equal(e.time_seconds,78.0);
 assert.equal(e.same_session_distance_peer_count,3);
 assert.equal(e.same_session_faster_or_equal_count,1);
 assert.equal(e.as_of,race.observation_at);
 assert.equal(e.official_race_result,false);
 assert.equal(out.market_used,false);assert.equal(out.production_rank_effect,false);
});
test('name only, wrong trainer and target-day ability test are NOT accepted',()=>{
 const pages=[parseHyogoAbilityDetail(html,detail)];
 const changed=[{horse_no:2,horse_name:'エディットフォース',sex_age:'牡3',trainer:'別の厩舎'}];
 assert.equal(matchHyogoAbilityEvidence({race,runners:changed,details:pages}).evidence.length,0);
 const sameDay={...race,race_date:'2026-10-27',observation_at:'2026-10-27T08:00:00+09:00',
  post_time:'2026-10-27T11:00:00+09:00'};
 assert.equal(matchHyogoAbilityEvidence({race:sameDay,runners,details:pages}).evidence.length,0);
 const post={...race,observation_at:race.post_time};
 assert.equal(matchHyogoAbilityEvidence({race:post,runners,details:pages}).status,'UNVERIFIED_RACE_OR_FIELD');
});
test('bounded real-source reader uses index and detail, without writes/claim or odds',async()=>{
 const urls=[],getPage=async url=>{urls.push(url);
  if(url.includes('/detail/135'))return html;
  return '<a href="/data/ability/detail/135">2026/10/27</a>';};
 const out=await collectHyogoAbilityBeforeRace({race,runners,getPage,indexPages:1,maxDetailPages:3});
 assert.deepEqual(urls,['https://www.sonoda-himeji.jp/data/ability',detail]);
 assert.equal(out.evidence[0].horse_no,2);
 assert.equal(out.claim_started,false);assert.equal(out.prediction_saved,false);
 assert.equal(out.incomplete_index,false);
});
test('official source failure fails closed; missing source is not recorded as a test failure',async()=>{
 const out=await collectHyogoAbilityBeforeRace({race,runners,indexPages:1,
  getPage:async()=>{throw Error('source offline');}});
 assert.equal(out.evidence.length,0);
 assert.equal(out.incomplete_index,true);
 assert.equal(out.prediction_saved,false);
});

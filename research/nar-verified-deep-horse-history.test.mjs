import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNarHorseHistory} from '../automation/nar-history-rescue.mjs';
const source='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678';
const target={race_date:'2026-11-09',track:'高知',race_no:12,circuit:'LOCAL',
 post_time:'2026-11-09T20:50:00+09:00'};
const current={horse_no:7,horse_name:'ユイノナナフシギ',identity_refs:[source],
 horse_link_evidence:{horse_no:7,horse_ref:source}};
const header=['年月日','競馬場','R','競走名','格組','距離','天候・馬場','頭数','枠','馬番','人気','着順','タイム','差','上3F','体重','騎手(所属)','重量','調教師','収得賞金','1着馬または(2着馬)'];
const dates=['2026/10/25','2026/10/11','2026/09/12','2026/08/02','2026/07/05','2026/06/21','2026/05/24'];
function fixture(){
 const rows=[{cells:header}];
 dates.forEach((date,i)=>{
  const c=Array(23).fill('');
  c[0]=date;c[1]='高知';c[2]=String(i%10+1);c[3]='３歳－５';
  c[5]='1300';c[7]='良';c[11]='7';c[13]=i>=5?String(2+i-5):'10';
  c[14]='1:26.1';c[15]='0.2';c[16]='40.0';c[17]='440';
  c[18]='騎手';c[19]='57';c[20]='調教師';rows.push({cells:c});
 });
 return {ok:true,diagnostic_only:true,url:source,truncated:false,
  rows,body:'ユイノナナフシギ 牝3 現役 年月日',fetched_at:'2026-11-09T08:00:00+09:00'};
}
test('existing 5-run live read stays byte-for-byte bounded while optional deep sees older 6th/7th',()=>{
 const f=fixture(),five=parseNarHorseHistory(f,current,target);
 const deep=parseNarHorseHistory(f,current,target,{maxRuns:12});
 assert.equal(five.length,5);assert.equal(deep.length,7);
 assert.equal(five.some(h=>h.race_date==='2026-06-21'),false);
 assert.equal(deep[5].race_date,'2026-06-21');
 assert.equal(deep[5].finish,2);
 assert.equal(deep[6].race_date,'2026-05-24');
 assert.equal(deep[6].finish,3);
 assert.equal(deep[5].horse_ref,source);
});
test('deep official parse rejects swapped horse identity, bad dimensions and future history',()=>{
 const f=fixture(),wrong={...current,horse_name:'別馬'};
 assert.throws(()=>parseNarHorseHistory(f,wrong,target,{maxRuns:12}),/HORSE_HISTORY_UNVERIFIED/);
 assert.throws(()=>parseNarHorseHistory(f,current,target,{maxRuns:13}),/HISTORY_DEPTH_INVALID/);
 const next=fixture();const c=Array(23).fill('');
 c[0]='2026/11/10';c[1]='高知';c[2]='9';c[5]='1300';c[11]='7';c[13]='1';
 next.rows.push({cells:c});
 const r=parseNarHorseHistory(next,current,target,{maxRuns:12});
 assert.equal(r.length,7);
});

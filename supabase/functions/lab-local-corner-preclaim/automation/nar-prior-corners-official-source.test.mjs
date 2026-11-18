import {load} from 'npm:cheerio@1.0.0';
import {extractOfficialRaceLapFields} from './nar-prior-corners-official-source.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message)};
const row=['13.7','12.5','14.3','14.2','13.4','14.1','13.4'];
const html=({clock='1:35.6',lapRows=1,distance=1400}={})=>\`<!doctype html>
<body><h1>2026年10月30日 園田 第2競走 競走成績</h1>
<p>ダ右\${distance}m サラブレッド系 一般</p>
<table><tr><th>着順</th><th>枠番</th><th>馬番</th><th>馬名</th><th>タイム</th></tr>
<tr><td>1</td><td>1</td><td>5</td><td>架空テスト馬</td><td>\${clock}</td></tr></table>
\${Array.from({length:lapRows},()=>'<table><tr><th>ハロンタイム</th>'+row.map(x=>'<td>'+x+'</td>').join('')+'</tr></table>').join('')}
</body>\`;
Deno.test('extract official race distance, first place time and literal 200m sections',()=>{
 const p=extractOfficialRaceLapFields(load(html()));
 assert(p?.distance===1400,'distance');
 assert(p?.winnerTime==='1:35.6','winner time');
 assert(JSON.stringify(p?.halonTimes)===JSON.stringify(row),'lap values');
});
Deno.test('duplicate / missing lap table fails closed',()=>{
 assert(extractOfficialRaceLapFields(load(html({lapRows:2})))===null,'duplicate');
 assert(extractOfficialRaceLapFields(load(html({lapRows:0})))===null,'missing');
});
Deno.test('winner missing or ambiguous is not an official clock',()=>{
 assert(extractOfficialRaceLapFields(load(html({clock:''})))===null,'empty clock');
});

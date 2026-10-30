import test from 'node:test';
import assert from 'node:assert/strict';
import {captureOwnedDebaPriorColumns} from './nar-deba-dom-columns.mjs';
import {extractOwnedDebaPastCorners} from './nar-deba-past-corners.mjs';
import {buildDebaRunningStyleShadow} from './nar-deba-style-shadow.mjs';
const url='https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11',identity='https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678901';
const race={"race_date":"2026-08-14","track":"笠松","race_no":11,"circuit":"LOCAL"};
const diagnosedRunners=[{"horse_no":6,"row_index":20},{"horse_no":5,"row_index":25}];
const rows=[{"row_index":20,"cells":[{"text":"6"},{"text":"ウィステリアベル"}]},{"row_index":21,"cells":[{"text":"備考"},{"text":"6 26.07.09 良 10頭 笠松 右1400 10番"},{"text":"1 26.06.26 不良 10頭 笠松 右1580 6番"},{"text":"1 26.06.10 良 12頭 笠松 右1400 6番"}]},{"row_index":22,"cells":[{"text":"別欄"},{"text":"1:31.6 2-2-1-2 41.1"},{"text":"1:45.6 1-1-1-1 40.7"},{"text":"1:33.8 1-1-1-1 41.3"}]},{"row_index":25,"cells":[{"text":"5"},{"text":"カーシュジアン"}]}];
const runner={"horse_no":6,"horse_name":"ウィステリアベル","status":"ACTIVE","row_index":20,"identity_refs":["https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678901"],"current_source_ref":"https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11","running_style_reference":["?"],"rank":4,"grade":"B","recent_runs":[]};
const context={"race":{"race_date":"2026-08-14","track":"笠松","race_no":11,"circuit":"LOCAL"},"runners":[{"horse_no":6,"horse_name":"ウィステリアベル","status":"ACTIVE","row_index":20,"identity_refs":["https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=12345678901"],"current_source_ref":"https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11","running_style_reference":["?"],"rank":4,"grade":"B","recent_runs":[]},{"horse_no":5,"horse_name":"カーシュジアン","status":"ACTIVE","rank":1,"grade":"A","row_index":25,"identity_refs":["https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=44444444444"],"current_source_ref":"https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?k_babaCode=23&k_raceDate=2026%2F08%2F14&k_raceNo=11","running_style_reference":["?"],"recent_runs":[]}]};
function run(inputRows=rows){
 const columns=captureOwnedDebaPriorColumns({rows:inputRows,diagnosedRunners,horseNo:6,debaSourceRef:url});
 const evidence=extractOwnedDebaPastCorners({race,cardSourceRef:url,cardHeader:'2026年8月14日（金） 笠 松 第11競走 16:05発走',runner,columns});
 return {columns,evidence,shadow:buildDebaRunningStyleShadow({context,priorEvidence:evidence})};
}
test('research-only full DOM->prior->shadow chain, nothing ranked differently',()=>{
 const out=run();assert.equal(out.columns.length,3);assert.equal(out.evidence.length,3);
 assert.deepEqual(out.shadow.runners[0].shadow_style,['逃']);assert.equal(out.shadow.runners[1].verified_passage_count,0);
 assert.equal(context.runners[0].rank,4);assert.equal(out.shadow.ranking_changed,false);
});
test('a misaligned horse history column never reaches shadow',()=>{
 const modified=structuredClone(rows);modified[2].cells[2].text='bad';
 const out=run(modified);assert.equal(out.evidence.length,0);assert.deepEqual(out.shadow.runners[0].shadow_style,['?']);
});
test('exclude information from the current race day',()=>{
 const modified=structuredClone(rows);modified[1].cells[1].text='6 26.08.14 良 10頭 笠松 右1400 10番';
 const out=run(modified);assert.equal(out.evidence.length,2);
 assert.ok(out.evidence.every(x=>x.race_date<race.race_date));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../supabase/functions/lab-directory-preview/index.ts',import.meta.url),'utf8');
const collapse=vm.runInNewContext(code.slice(code.indexOf('function collapse('),code.indexOf('async function trusted('))+'\ncollapse');
const rows=[{"horse_ref":"1","horse_name":"テスト","trainer":"旧","sex_age":"牡3","source_checked_at":"2026-10-01","jra_live_races":{"race_date":"2026-10-01","track":"東京"}},{"horse_ref":"1","horse_name":"テスト","trainer":"新","sex_age":"牡3","source_checked_at":"2026-11-01","jra_live_races":{"race_date":"2026-11-01","track":"京都"}},{"horse_ref":"2","horse_name":"テスト","trainer":"別","sex_age":"牝2","jra_live_races":{"race_date":"2026-11-01","track":"京都"}},{"horse_ref":"3","horse_name":"不一致","trainer":"A","jra_live_races":{"race_date":"2026-11-01","track":"京都"}},{"horse_ref":"3","horse_name":"不一致","trainer":"B","jra_live_races":{"race_date":"2026-11-01","track":"京都"}}];
test('latest date wins, same names stay separate, conflicts are omitted',()=>{const data=collapse(rows);assert.equal(data.length,2);assert.equal(data.find(x=>x.id==='1').trainer,'新');assert.ok(!data.some(x=>x.id==='3'));});
test('empty and invalid rows do not create fake identity',()=>{assert.equal(collapse([{}, {horse_name:'馬'}]).length,0);});

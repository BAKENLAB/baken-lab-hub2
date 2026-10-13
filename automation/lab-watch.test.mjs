import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const source=readFileSync(new URL('../lab-watch.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../today.html',import.meta.url),'utf8');
const browser={window:{},URL};
runInNewContext(source,browser);
const w=browser.window.LabWatch;
const info={date:'2026-10-13',track:'名古屋',raceNo:1};
function runner(n=9,name='ドウリファー'){return {
horse_no:n,horse_name:name,sex_age:'牡4',jockey:'細川智',weight_carried:57,
evaluation_status:'UNRATED_NO_VERIFIED_HISTORY',rank:null,grade:null,status:'ACTIVE'
};}
test('known Nagoya 1R unknown horse gets independent sourced background',()=>{
 const payload={runners:[{horse_no:3,rank:1,grade:'A',status:'ACTIVE'},runner()]};
 const content=w.watchSectionHtml(payload,info);
 assert.match(content,/LAB 🔍 WATCH/);
 assert.match(content,/ドウリファー/);
 assert.match(content,/Wootton Bassett/);
 assert.match(content,/Galileo/);
 assert.match(content,/角田輝也/);
 assert.match(content,/Coolmore/);
 assert.match(content,/www\.jbis\.or\.jp/);
 assert.match(content,/順位・評価なし/);
 assert.doesNotMatch(content,/3番.*ドウリファー/);
 assert.equal(w.watchRunners(payload).length,1);
 assert.equal(payload.runners[1].rank,null);
 assert.equal(payload.runners[1].grade,null);
});
test('other no-history horse is visible, but unknown positive factors are not fabricated',()=>{
 const output=w.watchSectionHtml({runners:[runner(8,'架空の馬')]},info);
 assert.match(output,/架空の馬/);
 assert.match(output,/確認済みプラス材料は、まだ登録されていません/);
 assert.doesNotMatch(output,/Wootton Bassett/);
});
test('different date or horse identity cannot inherit pedigree details',()=>{
 assert.equal(w.profileFor({...info,date:'2026-10-14'},runner()),null);
 assert.equal(w.profileFor(info,runner(9,'別の馬')),null);
 assert.equal(w.profileFor({...info,raceNo:2},runner()),null);
});
test('fully evaluated races have no special card and unchanged top five',()=>{
 const payload={runners:[{horse_no:1,rank:1,grade:'A',status:'ACTIVE'},
 {horse_no:2,rank:2,grade:'B',status:'ACTIVE'}]};
 assert.equal(w.watchSectionHtml(payload,info),'');
 assert.equal(w.watchRunners(payload).length,0);
});
test('a runner with a made-up last rank/F cannot qualify for WATCH',()=>{
 const r=runner();r.rank=11;r.grade='F';
 assert.equal(w.watchSectionHtml({runners:[r]},info),'');
});
test('HTML escapes any untrusted name and skips disallowed URL schemes',()=>{
 const output=w.watchSectionHtml({runners:[runner(8,'<img src=x onerror=alert(1)>')]},info);
 assert.doesNotMatch(output,/<img src=x/);
 assert.match(output,/&lt;img src=x/);
});
test('TODAY uses a separate section and removes only truly unranked from ability list',()=>{
 assert.match(html,/<script src="\.\/lab-watch\.js"><\/script>/);
 assert.match(html,/window\.LabWatch\?\.watchSectionHtml\(payload/);
 assert.match(html,/\.filter\(r=>!\(r\.evaluation_status==='UNRATED_NO_VERIFIED_HISTORY'&&r\.rank==null&&r\.grade==null\)\)/);
 assert.match(html,/LAB 🧪 EYE/);
 assert.match(html,/LAB RANK \/ 評価できた馬/);
 const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
 assert.ok(scripts.length>=1);
 for(const m of scripts){new Script(m[1]);}
});

const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').resolve(__dirname,'../../today.html'),'utf8');
const code=source.slice(source.indexOf('function unpublishedReason('),source.indexOf('function compactBets('));
const r={race_date:'2026-10-12',circuit:'JRA',track:'京都',race_no:8,race_name:'3歳以上1勝クラス',prediction_status:'PENDING',post_time:'2099-01-01T00:00:00Z',market_status:'READY',key:'K8'};
let count=0;function test(name,fn){fn();count++;console.log('PASS',name)}
function render(rows,circuit='JRA'){const area={innerHTML:''},ctx={visibleRaces:()=>rows,$:()=>area,state:{circuit,venue:'盛岡'},esc:s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;'),fmtTime:()=>'',Date};vm.createContext(ctx);vm.runInContext(code,ctx);const before=JSON.stringify(rows);ctx.renderRaceArea();assert.equal(JSON.stringify(rows),before);return area.innerHTML;}
test('specific verified Kyoto8 reason',()=>assert.match(render([r]),/⑥カドーダムールの公式出走歴0件/));
test('specific reason never leaks to other date/track/R',()=>{for(const override of [{race_date:'2026-10-13'},{track:'東京'},{race_no:9}])assert.doesNotMatch(render([{...r,...override}]),/カドーダムール/)});
test('FROZEN has no reason, keeps detail key/status/odds',()=>{const out=render([{...r,prediction_status:'FROZEN',prediction:{eye:null}}]);assert.doesNotMatch(out,/class="r-reason"/);assert.match(out,/予想公開中/);assert.match(out,/data-race-key="K8"/);assert.match(out,/ODDS ●/)});
test('maiden and hurdle explicit labels',()=>{assert.match(render([{...r,race_name:'2歳新馬'}]),/新馬戦は現在の評価対象外/);assert.match(render([{...r,race_name:'障害未勝利'}]),/障害戦は現在の評価対象外/)});
test('unknown future reason not inferred from pending',()=>assert.match(render([{...r,race_no:7}]),/予想未公開（理由確認中）/));
test('past missing prediction has explicit observable reason',()=>assert.match(render([{...r,race_no:7,post_time:'2026-10-12T00:00:00Z'}]),/予想なし（発走済み・正式予想未公開）/));
test('LOCAL is not classified as JRA unsupported',()=>{const out=render([{...r,circuit:'LOCAL',track:'盛岡',race_name:'新馬'}],'LOCAL');assert.doesNotMatch(out,/新馬戦は現在/);assert.match(out,/理由確認中/)});
test('reason directly below race title, HTML escaped',()=>{const out=render([{...r,race_no:7,race_name:'<script>alert(1)</script>'}]);assert.match(out,/&lt;script&gt;/);assert.doesNotMatch(out,/<script>/);assert.match(out,/class="r-title"[\s\S]*?<\/div><div class="r-reason"/)});
test('no invented race, preserved input order',()=>{assert.doesNotMatch(render([]),/race-row/);const out=render([{...r,race_no:7,race_name:'first'},{...r,race_no:8,race_name:'second'}]);assert.ok(out.indexOf('first')<out.indexOf('second'));assert.equal((out.match(/class="race-row"/g)||[]).length,2)});
test('small wrapping style available for 320/375/390px (static only)',()=>{assert.match(source,/\.r-title-wrap\{min-width:0\}/);assert.match(source,/\.r-reason\{[^}]*font-size:11px[^}]*white-space:normal[^}]*overflow-wrap:anywhere/)});
console.log(count+' PASS / 0 FAIL; real mobile browser not exercised');

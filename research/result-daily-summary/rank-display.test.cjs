const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
for(const file of ['today.html','result.html']){
 const html=fs.readFileSync(__dirname+'/../../'+file,'utf8'),lines=html.split('\n');
 const code=lines.filter(l=>l.includes('function savedRankText(')||l.includes('function renderDetail(')).join('\n');
 const target={innerHTML:'',scrollIntoView(){}};
 const c=vm.createContext({$:()=>target,esc:v=>String(v??'').replace(/[<>&"']/g,'_'),fmtTime:()=>'',detailUpdateMeta:()=>'',compactBets:x=>x,gradeClass:g=>'grade-'+g,runnerMetaText:()=>'',runningStyleBadges:()=>'',marketText:()=>'',horseHelmetClass:()=>'',reason:r=>r.comment||r.reason||''});vm.runInContext(code,c);
 const payload={runners:[{horse_no:3,horse_name:'第三馬',rank:3,grade:'C',comment:'第三根拠'},{horse_no:1,horse_name:'第一馬',rank:1,grade:'B',comment:'第一根拠'},{horse_no:2,horse_name:'第二馬',rank:2,grade:'B',comment:'第二根拠'}],eye:{horse_no:3,horse_name:'第三馬',reason:'EYE根拠'},bets:[]};const before=JSON.stringify(payload);c.race={prediction:{payload,track:'東京',circuit:'JRA',race_no:7}};vm.runInContext('renderDetail(race,false)',c);
 assert.equal(JSON.stringify(payload),before);const out=target.innerHTML;assert.ok(out.indexOf('1位')<out.indexOf('2位')&&out.indexOf('2位')<out.indexOf('3位'));
 assert.equal((out.match(/rank-grade grade-B/g)||[]).length,2);for(const text of ['第一馬','第二馬','第三馬','第一根拠','第二根拠','第三根拠','LAB 🧪 EYE','詳細を見る'])assert.ok(out.includes(text));
 for(const invalid of [null,undefined,'',true,0,-1,1.5,'<script>']){c.input=invalid;assert.equal(vm.runInContext('savedRankText(input)',c),'順位未記録');}c.input='12';assert.equal(vm.runInContext('savedRankText(input)',c),'12位');
 console.log('PASS '+file+': saved rank, equal grades, copy-sort, fields/EYE preserved, missing rank');
}
console.log('2 PASS / 0 FAIL');

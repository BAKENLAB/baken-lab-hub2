import assert from 'node:assert/strict';
import { supplyNarMonthly } from './nar-monthly-materials.mjs';
const header=n=>Array.from({length:n},(_,i)=>'fixture_'+i);
const headers={races:header(66),horses:header(36)};
headers.horses[9]='毛色';headers.horses[13]='母父馬名';
const bytes=(h,rows)=>new TextEncoder().encode('\uFEFF'+[h,...rows].map(r=>r.map(cell=>'"'+cell.replaceAll('"','""')+'"').join(',')).join('\r\n'));
const row=(n,values)=>Object.assign(Array(n).fill(''),values);
const race=row(66,{0:'浦和',1:'20261125',2:'11',21:'ダート',23:'1000',25:'良',26:'2',35:'12',36:'12',37:'12',38:'12',39:'12',50:'1角',58:'1,2'});
const first=row(36,{0:'浦和',1:'20261125',2:'11',5:'1',6:'試験馬',9:'栗毛',10:'20200101',11:'父',12:'母',13:'母父',31:'1',32:'1000',34:'36'});
const second=row(36,{...first,5:'2',6:'別馬',31:'2',32:'1003'});
const future=row(36,{...first,1:'20261129'});
const witness={currentNo:1,horseId:'123',track:'浦和',date:'2026-11-25',raceNo:11,priorNo:1,
  horseName:'試験馬',birthDate:'2020-01-01',sire:'父',dam:'母',coat:'栗毛',damsire:'母父',finish:1,
  resultHorseRef:'https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=123',
  profileRef:'https://www.keiba.go.jp/KeibaWeb/DataRoom/RaceHorseInfo?k_lineageLoginCode=123',
  basis:'OFFICIAL_RESULT_ROW_AND_PROFILE',checkedAt:'2026-11-26T01:00:00Z',
  officialResultRef:'https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=18&k_raceDate=2026%2F11%2F25&k_raceNo=11'};
const input={headers,raceBytes:bytes(headers.races,[race]),horseBytes:bytes(headers.horses,[first,second,future]),
  source:{acquiredAt:'2026-11-26T00:00:00Z',ref:'fixture'},targetDate:'2026-11-27',
  cutoff:'2026-11-27T01:00:00Z',postTime:'2026-11-27T02:00:00Z',
  roster:[{horseNo:1,horseId:'123'},{horseNo:2,horseId:'456'}],witnesses:[witness]};
const run=x=>supplyNarMonthly({...input,...x});
const out=run();
const material=x=>x.runners[0].materials[0];
assert.equal(out.excluded_same_or_future_horse_rows,1);
assert.equal(material(out).gap_winner,0);
assert.equal(material(out).gap_next,0.3);
assert.equal(material(out).race_laps.length,5);
assert.equal(out.runners[1].items['05'],'MISSING');
assert.equal(out.runners[0].items['07'],'PROXY_CANDIDATE_ONLY');
assert.equal(out.scoring_authorized,false);
assert.equal(run({witnesses:[{...witness,horseId:'456'}]}).rejected.length,1);
assert.equal(run({witnesses:[{...witness,sire:'別'}]}).rejected.length,1);
assert.equal(material(run({horseBytes:bytes(headers.horses,[first])})).gap_winner,null);
assert.equal(material(run({horseBytes:bytes(headers.horses,[first,row(36,{...second,31:'1'})])})).race_laps,null);
assert.equal(material(run({raceBytes:bytes(headers.races,[row(66,{...race,35:'13'})])})).race_laps,null);
assert.throws(()=>run({horseBytes:input.horseBytes.slice(3)}),/BOM/);
assert.throws(()=>run({horseBytes:bytes(headers.horses,[first.slice(1)])}),/SCHEMA/);
assert.throws(()=>run({source:{...input.source,acquiredAt:input.postTime}}),/ASOF/);
console.log('PASS NAR monthly CSV integration');

assert.deepEqual(material(out).corners,[1]);
const grouped=run({raceBytes:bytes(headers.races,[row(66,{...race,58:'(1,2)'})])});
assert.equal(material(grouped).corners,null);
assert.deepEqual(material(grouped).corner_position_ranges,[{label:'1角',from:1,to:2}]);
assert.throws(()=>run({witnesses:[witness,witness]}),/DUPLICATE/);
assert.throws(()=>run({horseBytes:bytes(headers.horses,[first,first])}),/DUPLICATE/);
for (const patch of [{horseName:'改名'},{coat:''},{damsire:'別'},{resultHorseRef:witness.resultHorseRef.replace('123','456')}])
 assert.equal(run({witnesses:[{...witness,...patch}]}).rejected.length,1);
const incident={date:witness.date,track:witness.track,raceNo:11,priorNo:1,horseId:'123',
 kind:'REPORTED_LATE_START',quote:'試験用の出遅れ記録',
 reportRef:'https://ppr.keiba.go.jp/index.php/show/show/20261125/18/11/report.html',
 publishedAt:witness.checkedAt,checkedAt:witness.checkedAt};
assert.equal(run({incidents:[incident]}).runners[0].items['09'],'REPORTED_INCIDENT_CANDIDATE');
assert.equal(material(run({incidents:[{...incident,checkedAt:'2026-11-28T00:00:00Z'}]})).incident,null);
console.log('PASS official witness, corner groups and incident regressions');

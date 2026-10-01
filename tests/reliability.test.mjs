import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import * as contract from '../prediction-contract.mjs';

const saved=JSON.parse(readFileSync(new URL('./fixtures/saved-prediction.json',import.meta.url),'utf8'));
const clone=x=>structuredClone(x);
const certified=()=>({...clone(saved),integrity:{version:1,prediction_id:saved.id,saved:contract.predictionSnapshot(saved.payload)}});
const race=p=>({...p,key:contract.raceKey(p),prediction:p,prediction_status:'FROZEN'});
const response=p=>({ok:true,date:saved.race_date,predictions:[p],races:[race(p)]});

function frontend(fetcher=async()=>{throw new Error('network unavailable')}) {
  const elements=new Map();
  const el=selector=>{
    if(!elements.has(selector))elements.set(selector,{innerHTML:'',value:saved.race_date,addEventListener(){},scrollIntoView(){},classList:{add(){},remove(){},toggle(){}}});
    return elements.get(selector);
  };
  const context=vm.createContext({...contract,structuredClone,URL,AbortSignal,fetch:fetcher,document:{querySelector:el,querySelectorAll:()=>[]},navigator:{},window:{}});
  let script=readFileSync(new URL('../index.html',import.meta.url),'utf8').split('<script type="module">')[1].split('</script>')[0];
  script=script.replace(/import .* from .*;\n/,'');
  script=script.replace(/;loadToday\(\);/, ';');
  vm.runInContext(script,context);
  return {context,el,run:code=>vm.runInContext(code,context)};
}

async function backend(tables={},errors={}) {
  let handler;
  const db={from(name){
    const query={select(){return this},eq(){return this},order(){return this},maybeSingle(){this.single=true;return this},
      then(resolve,reject){return Promise.resolve({data:errors[name]?null:(this.single?(tables[name]||[])[0]??null:tables[name]||[]),error:errors[name]?{message:'simulated read failure'}:null}).then(resolve,reject)}};
    return query;
  }};
  const source=readFileSync(new URL('../supabase/functions/hub2-api/index.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  const context=vm.createContext({...contract,structuredClone,Response,URL,createClient:()=>db,Deno:{env:{get:()=> 'test-placeholder'},serve:fn=>handler=fn}});
  vm.runInContext(stripTypeScriptTypes(source),context);
  return {context,call:async action=>{const r=await handler({method:'GET',url:'https://test.invalid/?action='+action+'&date='+saved.race_date+'&track='+encodeURIComponent(saved.track)+'&race_no=1'});return {status:r.status,body:await r.json()}}};
}

test('saved fixture -> actual API mapper preserves EYE rank 7, array order and TOP5',async()=>{
  const b=await backend({official_predictions:[saved]});
  for(const action of ['list','prediction']){
    const r=await b.call(action);assert.equal(r.status,200);
    const p=action==='list'?r.body.predictions[0]:r.body.prediction;
    assert.deepEqual(contract.predictionSnapshot(p.payload),contract.predictionSnapshot(saved.payload));
    contract.validatePrediction(p);
  }
});

test('actual RESULT API also carries exactly the saved prediction',async()=>{
  const b=await backend({official_predictions:[saved],official_results:[{...saved,result:{finishers:[]}}]});
  const r=await b.call('results');
  assert.equal(r.status,200);
  const row=r.body.results[0];
  assert.equal(row.prediction_state,'FOUND');
  assert.deepEqual(contract.predictionSnapshot(row.prediction.payload),contract.predictionSnapshot(saved.payload));
  contract.validatePrediction(row.prediction);
});

test('mutable field/market enrichment does not change protected saved values',async()=>{
  const b=await backend({
    official_predictions:[saved],
    official_races:[{...saved,field_payload:{runners:[{horse_no:7,jockey:'更新騎手',weight_carried:55}]}}],
    official_market:[{...saved,runners:[{horse_no:7,win_odds:10,popularity:8}]}]
  });
  const r=await b.call('list');
  assert.equal(r.status,200);
  assert.deepEqual(contract.predictionSnapshot(r.body.predictions[0].payload),contract.predictionSnapshot(saved.payload));
});

test('actual HUB renders saved order/ranks and EYE-specific reason',()=>{
  const p=certified(),f=frontend();
  f.context.p=p;f.run('renderDetail({prediction:p})');
  const html=f.el('#detailArea').innerHTML;
  assert.ok(html.includes('<div class="eye-reason">'+saved.payload.eye.reason+'</div>'));
  assert.ok(!html.includes('<div class="eye-reason">'+saved.payload.runners[0].comment+'</div>'));
  const rows=[...html.matchAll(/data-horse-no="(\d+)" data-lab-rank="(\d+)"/g)].map(m=>({horse_no:Number(m[1]),rank:Number(m[2])}));
  assert.deepEqual(rows,saved.payload.runners.map(r=>({horse_no:r.horse_no,rank:r.rank})));
});

test('actual RESULT detail preserves saved TOP5 order',()=>{
  const f=frontend();f.context.row={...saved,prediction:certified(),result:{finishers:[]}};
  f.run('renderResultDetail(row)');
  const html=f.el('#resultDetailArea').innerHTML;
  let last=-1;for(const r of saved.payload.top5){const pos=html.indexOf('<strong>'+r.horse_name+'</strong>',last+1);assert.ok(pos>last);last=pos;assert.ok(html.includes('事前LAB '+r.rank+'位'));}
});

test('partial races/predictions: HUB includes all saved predictions without recalculation',async()=>{
  const p=certified(),q=clone(p);q.id='second';q.race_no=2;q.integrity.prediction_id=q.id;
  const data={ok:true,date:saved.race_date,races:[{...race(p),prediction:null,prediction_status:'PENDING'}],predictions:[p,q]};
  const f=frontend(async()=>({ok:true,json:async()=>data}));
  await f.run('loadToday()');
  const rows=JSON.parse(f.run('JSON.stringify(state.races)'));
  assert.equal(rows.length,2);
  for(const r of rows)assert.deepEqual(contract.predictionSnapshot(r.prediction.payload),contract.predictionSnapshot(saved.payload));
});

test('prediction retrieval failure in RESULT API is SYSTEM ERROR, never NOT_FOUND',async()=>{
  const b=await backend({official_results:[{...saved,result:{finishers:[]}}]},{official_predictions:true});
  const r=await b.call('results');assert.equal(r.status,500);assert.match(r.body.error,/SYSTEM ERROR/);assert.equal(r.body.results,undefined);
});

test('HUB HTTP failure clears old state and shows SYSTEM ERROR',async()=>{
  const f=frontend(async()=>({ok:false,status:500}));f.context.old=race(certified());f.run('state.races=[old]');
  await f.run('loadToday()');assert.match(f.el('#raceArea').innerHTML,/SYSTEM ERROR/);assert.equal(f.run('state.races.length'),0);
});

test('invalid runners/top5/eye: API returns DATA ERROR without rebuilding',async()=>{
  for(const key of ['runners','top5','eye']){
    const p=clone(saved);p.payload[key]=key==='eye'?[]:{};
    const b=await backend({official_predictions:[p]});const r=await b.call('list');
    assert.equal(r.status,200);assert.match(r.body.predictions[0].data_error,/DATA ERROR/);assert.equal(r.body.predictions[0].payload,null);
  }
});

test('invalid response arrays/empty JSON are DATA ERROR, never unregistered',async()=>{
  for(const data of [{ok:true,date:saved.race_date,races:{},predictions:[]},{ok:true,date:saved.race_date,results:{}},null]){
    const f=frontend(async()=>({ok:true,json:async()=>data}));
    await f.run(data?.results!==undefined?'loadResults()':'loadToday()');
    const html=f.el(data?.results!==undefined?'#resultArea':'#raceArea').innerHTML;
    assert.match(html,/(DATA ERROR|SYSTEM ERROR)/);assert.ok(!html.includes('まだ登録'));
  }
});

test('older TODAY response arrives last and cannot replace current selection',async()=>{
  const pending=[];
  const f=frontend(()=>new Promise(resolve=>pending.push(resolve)));
  f.el('#dateInput').value=saved.race_date;const first=f.run('loadToday()');
  const nextDate='2026-10-01';f.el('#dateInput').value=nextDate;const second=f.run('loadToday()');
  const p=certified();p.race_date=nextDate;
  pending[1]({ok:true,json:async()=>({...response(p),date:nextDate})});await second;
  pending[0]({ok:true,json:async()=>response(certified())});await first;
  assert.equal(f.run('state.races[0].race_date'),nextDate);
});

test('older RESULT failure cannot erase newer successful result',async()=>{
  const pending=[],f=frontend(()=>new Promise(resolve=>pending.push(resolve)));
  const first=f.run('loadResults()'),second=f.run('loadResults()');
  const row={...saved,result:{finishers:[]},prediction:certified(),prediction_state:'FOUND'};
  pending[1]({ok:true,json:async()=>({ok:true,date:saved.race_date,results:[row]})});await second;
  pending[0]({ok:false,status:500});await first;
  assert.equal(f.run('state.resultRows.length'),1);assert.ok(!f.el('#resultArea').innerHTML.includes('ERROR'));
});

test('integrity detects changed rank/grade/name/TOP5/EYE/reason and order',()=>{
  const mutations=[
    p=>p.runners[0].rank=6,p=>p.runners[0].horse_no=8,p=>p.runners[0].horse_name='changed',p=>p.runners[0].grade='F',
    p=>p.runners.reverse(),p=>p.top5.reverse(),p=>p.eye.horse_no=6,p=>p.eye.reason='changed'
  ];
  for(const mutate of mutations){const p=certified();mutate(p.payload);assert.throws(()=>contract.validatePrediction(p),/DATA ERROR/);}
});

test('missing EYE reason is DATA ERROR instead of runner comment or unregistered',()=>{
  const p=certified();delete p.payload.eye.reason;const f=frontend();f.context.p=p;f.run('renderDetail({prediction:p})');
  assert.match(f.el('#detailArea').innerHTML,/DATA ERROR/);assert.ok(!f.el('#detailArea').innerHTML.includes('未登録'));
});

test('missing or empty TOP5 is DATA ERROR, never reconstructed from runners',async()=>{
  for(const remove of [p=>delete p.top5,p=>p.top5=[]]){
    const p=clone(saved);remove(p.payload);
    const b=await backend({official_predictions:[p]});
    const r=await b.call('list');assert.equal(r.status,200);assert.match(r.body.predictions[0].data_error,/DATA ERROR/);
    const f=frontend();f.context.p=p;
    assert.throws(()=>f.run('buildXCopy({prediction:p})'),/DATA ERROR/);
  }
});

test('only explicit NOT_FOUND allows a genuine missing prediction in RESULT',()=>{
  const row={...saved,result:{},prediction:null};
  assert.match(contract.validateResults({date:saved.race_date,results:[row]},saved.race_date)[0].data_error,/DATA ERROR/);
  row.prediction_state='NOT_FOUND';assert.equal(contract.validateResults({date:saved.race_date,results:[row]},saved.race_date).length,1);
});

function oldSaved() {
  const p=clone(saved);p.protocol_version='CHAT_PRE_RACE_LEGACY';
  delete p.payload.eye.reason;
  p.payload.eye.comment='保存された旧EYE専用文章';
  return p;
}

test('old protocol preserves eye.comment verbatim without adding reason',async()=>{
  const original=oldSaved(),b=await backend({official_predictions:[original]});
  const r=await b.call('list');assert.equal(r.status,200);
  const p=r.body.predictions[0];contract.validatePrediction(p);
  assert.deepEqual(p.payload.eye,original.payload.eye);
  assert.equal(Object.hasOwn(p.payload.eye,'reason'),false);
  const f=frontend();f.context.p=p;f.run('renderDetail({prediction:p})');
  const html=f.el('#detailArea').innerHTML;
  assert.ok(html.includes('<div class="eye-reason">'+original.payload.eye.comment+'</div>'));
  assert.ok(!html.includes('<div class="eye-reason">'+original.payload.runners[0].comment+'</div>'));
});

test('both eye.reason and eye.comment: reason has priority, no runner fallback',async()=>{
  const original=oldSaved();original.payload.eye.reason='保存されたreasonが優先';
  const b=await backend({official_predictions:[original]});const r=await b.call('list');
  const f=frontend();f.context.p=r.body.predictions[0];f.run('renderDetail({prediction:p})');
  assert.ok(f.el('#detailArea').innerHTML.includes('<div class="eye-reason">'+original.payload.eye.reason+'</div>'));
  assert.deepEqual(r.body.predictions[0].payload.eye,original.payload.eye);
});

test('reason-only protocol cannot silently fall back to eye.comment',async()=>{
  const original=oldSaved();original.protocol_version='CHAPPY_LOCAL_1.2_EYE_GUARD_20260929';
  const b=await backend({official_predictions:[original]});const r=await b.call('list');
  assert.equal(r.status,200);assert.match(r.body.predictions[0].data_error,/EYE-specific reason missing/);
});

test('eye=null is valid and does not interrupt TODAY or RESULT peers',async()=>{
  const without=clone(saved);without.id='no-eye';without.race_no=2;without.payload.eye=null;
  const tables={official_predictions:[saved,without],official_results:[{...saved,result:{}},{...without,result:{}}]};
  const b=await backend(tables);
  for(const action of ['list','results']){
    const r=await b.call(action),f=frontend(async()=>({ok:true,json:async()=>r.body}));
    await f.run(action==='list'?'loadToday()':'loadResults()');
    assert.equal(f.run(action==='list'?'state.races.length':'state.resultRows.length'),2);
    assert.ok(!f.el(action==='list'?'#raceArea':'#resultArea').innerHTML.includes('DATA ERROR'));
  }
});

test('one malformed prediction is isolated in API and actual TODAY/RESULT rendering',async()=>{
  const bad=clone(saved);bad.id='bad';bad.race_no=2;bad.payload.runners={};
  const b=await backend({official_predictions:[saved,bad],official_results:[{...saved,result:{}},{...bad,result:{}}]});
  for(const action of ['list','results']){
    const r=await b.call(action);assert.equal(r.status,200);
    const rows=action==='list'?r.body.races:r.body.results;
    assert.equal(rows.length,2);assert.ok(rows[1].data_error);
    const normal=action==='list'?rows[0].prediction:rows[0].prediction;
    assert.deepEqual(contract.predictionSnapshot(normal.payload),contract.predictionSnapshot(saved.payload));
    const f=frontend(async()=>({ok:true,json:async()=>r.body}));
    await f.run(action==='list'?'loadToday()':'loadResults()');
    const html=f.el(action==='list'?'#raceArea':'#resultArea').innerHTML;
    assert.ok(html.includes('DATA ERROR'));
    assert.ok(html.includes(action==='list'?'予想公開中':'見る ›'));
    assert.equal(f.run(action==='list'?'state.races.length':'state.resultRows.length'),2);
  }
});

test('malformed raw API prediction is isolated by HUB even without API guard',async()=>{
  const p=certified(),bad=clone(p);bad.id='bad';bad.race_no=2;bad.payload.top5={};
  const data={ok:true,date:saved.race_date,predictions:[p,bad],races:[race(p),race(bad)]};
  const f=frontend(async()=>({ok:true,json:async()=>data}));await f.run('loadToday()');
  assert.ok(f.el('#raceArea').innerHTML.includes('DATA ERROR'));
  assert.ok(f.el('#raceArea').innerHTML.includes('予想公開中'));
});

test('unknown protocol with old-looking data is not converted',async()=>{
  const unknown=oldSaved();unknown.protocol_version='UNKNOWN_PROTOCOL_42';
  unknown.payload.ranking=[7,2,1];unknown.payload.lab_eye={horse_no:6,reason:'never use this'};
  const b=await backend({official_predictions:[unknown]});const r=await b.call('list');
  assert.equal(r.status,200);
  assert.match(r.body.predictions[0].data_error,/unsupported protocol_version/);
  assert.equal(r.body.predictions[0].payload,null);
  assert.equal(unknown.payload.eye.horse_no,saved.payload.eye.horse_no);
});

test('test predictions are excluded and cannot fall back to a legacy normal shape',async()=>{
  const testRow=clone(saved);testRow.id='test-only';testRow.race_no=2;testRow.protocol_version='CHAPPY_DIRECT_1_TEST';
  const b=await backend({official_predictions:[saved,testRow]});const r=await b.call('list');
  assert.equal(r.body.predictions.length,1);assert.equal(r.body.races.length,1);
  assert.deepEqual(contract.predictionSnapshot(r.body.predictions[0].payload),contract.predictionSnapshot(saved.payload));
  const direct=await backend({official_predictions:[testRow]});
  const detail=await direct.call('prediction');
  assert.equal(detail.body.prediction.payload,null);
  assert.match(detail.body.prediction.data_error,/test prediction excluded/);
});

test('old protocol without any EYE-specific text never uses runner.comment',async()=>{
  const old=oldSaved();delete old.payload.eye.comment;
  const b=await backend({official_predictions:[old]});const r=await b.call('list');
  assert.match(r.body.predictions[0].data_error,/EYE-specific reason missing/);
});

test('historical chappy_predictions adapter keeps picks and EYE comment unchanged',async()=>{
  const old=oldSaved();
  const row={...old,picks:old.payload.top5,eye:old.payload.eye,source:'CHAT_PRE_RACE'};
  const b=await backend({chappy_predictions:[row]});const r=await b.call('list');
  const p=r.body.predictions[0];
  assert.equal(p.protocol_version,'CHAT_PRE_RACE_LEGACY');
  assert.deepEqual(p.payload.top5,row.picks);
  assert.deepEqual(p.payload.eye,row.eye);
  contract.validatePrediction(p);
  assert.equal(contract.eyeReason(p.payload.eye,p.protocol_version),row.eye.comment);
});

test('test RESULT prediction is quarantined without leaking saved RANK/TOP5/EYE',async()=>{
  const p=clone(saved);p.protocol_version='CHAPPY_DIRECT_1_TEST';
  const b=await backend({official_predictions:[p],official_results:[{...saved,result:{}}]});
  const r=await b.call('results');assert.equal(r.status,200);
  assert.equal(r.body.results[0].prediction,null);
  assert.equal(r.body.results[0].prediction_state,'DATA_ERROR');
  assert.match(r.body.results[0].data_error,/test prediction excluded/);
});

test('normal rows preserve every protected value with a legacy peer present',async()=>{
  const old=oldSaved();old.id='legacy-peer';old.race_no=2;
  const b=await backend({official_predictions:[saved,old]});const r=await b.call('list');
  assert.deepEqual(contract.predictionSnapshot(r.body.predictions[0].payload),contract.predictionSnapshot(saved.payload));
  assert.deepEqual(contract.predictionSnapshot(r.body.predictions[1].payload),contract.predictionSnapshot(old.payload));
});

const productionRules = [
  ['BAKEN_LAB_STANDARD_7_KEYS','comment'],
  ['CHAPPY_DIRECT_1','reason'],
  ['CHAPPY_LOCAL_1.1_20260926','reason'],
  ['CHAPPY_LOCAL_1.2_EYE_GUARD_20260929','reason'],
  ['CHAPPY_LOCAL_1.3_EXECUTION_GUARD_20260930','reason'],
  ['CHAPPY_LOCAL_1.4_EYE_UPSIDE_20260930','reason'],
  ['JRA_REBUILD_0.3_FLAT_HISTORY','reason']
];
for (const [version,field] of productionRules) {
  test('production protocol preserves stored prediction and uses '+field+': '+version,async()=>{
    const original=clone(saved);original.protocol_version=version;
    original.payload.eye.comment='保存されたEYE comment（通常コメントとは別）';
    // Both fields are stored, with intentionally different text.
    const expected=original.payload.eye[field];
    const b=await backend({official_predictions:[original],official_results:[{...original,result:{}}]});
    for (const action of ['list','prediction','results']) {
      const r=await b.call(action);assert.equal(r.status,200);
      const p=action==='list'?r.body.predictions[0]:action==='prediction'?r.body.prediction:r.body.results[0].prediction;
      contract.validatePrediction(p);
      assert.deepEqual(contract.predictionSnapshot(p.payload),contract.predictionSnapshot(original.payload));
      assert.equal(contract.eyeReason(p.payload.eye,version),expected);
      const f=frontend();f.context.p=p;f.run('renderDetail({prediction:p})');
      assert.ok(f.el('#detailArea').innerHTML.includes('<div class="eye-reason">'+expected+'</div>'));
    }
  });
}

test('STANDARD_7_KEYS accepts only saved eye.comment, never eye.reason or runner.comment',async()=>{
  const p=clone(saved);p.protocol_version='BAKEN_LAB_STANDARD_7_KEYS';p.payload.eye.comment='旧EYE専用文章';
  const b=await backend({official_predictions:[p]});const r=await b.call('list');
  assert.equal(contract.eyeReason(r.body.predictions[0].payload.eye,p.protocol_version),p.payload.eye.comment);
  delete p.payload.eye.comment;
  const invalid=await backend({official_predictions:[p]});const failed=await invalid.call('list');
  assert.match(failed.body.predictions[0].data_error,/EYE-specific reason missing/);
});

test('CHAPPY_DIRECT_1 falls back only to its own eye.comment when reason is absent',async()=>{
  const p=clone(saved);delete p.payload.eye.reason;p.payload.eye.comment='DIRECT旧EYE文章';
  const b=await backend({official_predictions:[p]});const r=await b.call('list');
  assert.deepEqual(r.body.predictions[0].payload.eye,p.payload.eye);
  const f=frontend();f.context.p=r.body.predictions[0];f.run('renderDetail({prediction:p})');
  assert.ok(f.el('#detailArea').innerHTML.includes('<div class="eye-reason">'+p.payload.eye.comment+'</div>'));
});

test('LOCAL_1.1 null EYE is isolated in TODAY and RESULT; other races remain exact',async()=>{
  const bad=clone(saved);bad.id='null-eye-local11';bad.race_no=2;
  bad.protocol_version='CHAPPY_LOCAL_1.1_20260926';bad.payload.eye=null;
  const b=await backend({official_predictions:[saved,bad],official_results:[{...saved,result:{}},{...bad,result:{}}]});
  for(const action of ['list','results']){
    const r=await b.call(action);assert.equal(r.status,200);
    const rows=action==='list'?r.body.races:r.body.results;
    assert.match(rows[1].data_error,/EYE missing/);
    assert.deepEqual(contract.predictionSnapshot(rows[0].prediction.payload),contract.predictionSnapshot(saved.payload));
    const f=frontend(async()=>({ok:true,json:async()=>r.body}));
    await f.run(action==='list'?'loadToday()':'loadResults()');
    const html=f.el(action==='list'?'#raceArea':'#resultArea').innerHTML;
    assert.ok(html.includes('DATA ERROR'));assert.ok(html.includes(action==='list'?'予想公開中':'見る ›'));
  }
});

test('BAKEN_LAB_WORK_TEST_V3 is excluded from normal prediction lists',async()=>{
  const p=clone(saved);p.id='work-test';p.race_no=2;p.protocol_version='BAKEN_LAB_WORK_TEST_V3';
  const b=await backend({official_predictions:[saved,p]});const r=await b.call('list');
  assert.equal(r.body.predictions.length,1);
  assert.equal(r.body.excluded_predictions[0].protocol_version,p.protocol_version);
  assert.equal(r.body.races.length,1);
  const direct=await backend({official_predictions:[p]});const detail=await direct.call('prediction');
  assert.equal(detail.body.prediction.payload,null);
  assert.match(detail.body.prediction.data_error,/test prediction excluded/);
});

for (const version of ['CHAPPY_DIRECT_1','BAKEN_LAB_STANDARD_7_KEYS','JRA_REBUILD_0.3_FLAT_HISTORY']) {
  test('old TOP5 remains exactly saved through API/HUB/X: '+version,async()=>{
    const p=clone(saved);p.protocol_version=version;
    if(version==='BAKEN_LAB_STANDARD_7_KEYS')p.payload.eye.comment='saved EYE comment';
    p.payload.top5=p.payload.top5.map((r,i)=>version==='JRA_REBUILD_0.3_FLAT_HISTORY'
      ? {horse_no:r.horse_no,horse_name:r.horse_name,rank:r.rank}
      : {mark:['◎','○','▲','☆','△'][i],horse_no:r.horse_no,horse_name:r.horse_name});
    const b=await backend({official_predictions:[p],official_results:[{...p,result:{finishers:[]}}]});
    for(const action of ['list','results']){
      const result=await b.call(action);const actual=action==='list'?result.body.predictions[0]:result.body.results[0].prediction;
      assert.deepEqual(actual.payload.top5,p.payload.top5);contract.validatePrediction(actual);
      const f=frontend();f.context.p=actual;f.run('renderDetail({prediction:p})');
      f.context.row={...p,prediction:actual,result:{finishers:[]}};f.run('renderResultDetail(row)');
      const copy=f.run('buildXCopy({prediction:p})');assert.ok(!copy.includes('undefined'));assert.ok(!copy.includes('null位'));
      for(const r of p.payload.top5){assert.ok(copy.includes(r.horse_name));if(r.mark)assert.ok(copy.includes(r.mark));if(r.rank)assert.ok(copy.includes(r.rank+'位'));}
      if(version!=='JRA_REBUILD_0.3_FLAT_HISTORY')assert.ok(!copy.includes('位 '));
      assert.deepEqual(actual.payload.top5,p.payload.top5);
    }
  });
}
test('DIRECT CANCELLED runner with null rank is preserved, not removed or ranked',async()=>{
  const p=clone(saved);p.payload.runners[0].status='CANCELLED';p.payload.runners[0].rank=null;
  const b=await backend({official_predictions:[p]});const r=await b.call('list');
  assert.deepEqual(r.body.predictions[0].payload.runners,p.payload.runners);contract.validatePrediction(r.body.predictions[0]);
});
test('ordinary runner null rank remains DATA ERROR',()=>{
  const p=clone(saved);p.payload.runners[0].rank=null;assert.throws(()=>contract.validatePayload(p.payload,false,p.protocol_version),/invalid saved runner/);
});
test('five-runner LOCAL_1.1 null EYE is valid and preserved through API',async()=>{
  const p=clone(saved);p.protocol_version='CHAPPY_LOCAL_1.1_20260926';p.payload.runners=clone(p.payload.top5);p.payload.eye=null;
  const b=await backend({official_predictions:[p]});const r=await b.call('list');
  assert.deepEqual(r.body.predictions[0].payload,p.payload);contract.validatePrediction(r.body.predictions[0]);
});
test('six-plus runners requiring EYE reject both null and missing eye',()=>{
  for(const missing of [false,true]){const p=clone(saved);p.protocol_version='CHAPPY_LOCAL_1.1_20260926';p.payload.eye=null;if(missing)delete p.payload.eye;assert.throws(()=>contract.validatePayload(p.payload,false,p.protocol_version),/EYE missing|eye field missing/);}
});
test('old X copy prints exactly saved mark/number/name without inferred rank or grade',()=>{
  const p=certified();p.payload.top5=[{mark:'△',horse_no:5,horse_name:'Saved fifth'},{mark:'◎',horse_no:1,horse_name:'Saved first'}];p.integrity.saved=contract.predictionSnapshot(p.payload);
  const f=frontend();f.context.p=p;const text=f.run('buildXCopy({prediction:p})');
  assert.ok(text.includes('△ ⑤ Saved fifth\n◎ ① Saved first'));assert.ok(!text.includes('undefined'));assert.ok(!text.includes('位 '));assert.deepEqual(p.payload.top5,p.integrity.saved.top5);
});
test('audit run_mode WORK_TEST alone does not exclude a supported normal prediction',async()=>{
  const p=clone(saved);p.payload.audit={run_mode:'WORK_TEST'};assert.equal(contract.isTestPrediction(p),false);
  const b=await backend({official_predictions:[p]});const r=await b.call('list');assert.equal(r.body.predictions.length,1);contract.validatePrediction(r.body.predictions[0]);
});

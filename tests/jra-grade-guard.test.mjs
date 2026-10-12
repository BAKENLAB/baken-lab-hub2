import test from 'node:test';import assert from 'node:assert/strict';
import {assertJraGradeReady,GradeError} from '../review/jra-grade/grade-guard.mjs';
function base(){
 const runners=Array.from({length:6},(_,i)=>({horse_no:i+1,horse_name:'Fixture '+(i+1),rank:i+1,grade:'B',reason:'Individual fixture evidence '+(i+1)}));
 return {runners,top5:runners.slice(0,5).map(x=>({...x})),eye:{...runners[5],concrete_upside_reason:'Fixture only'},bets:[],summary:'fixture',bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY',audit:{}};
}
function fail(fn,code){const p=base();fn(p);assert.throws(()=>assertJraGradeReady(p,{expectedRunnerNos:[1,2,3,4,5,6]}),e=>e instanceof GradeError&&e.code===code);}
test('complete prediction passes unchanged',()=>{const p=base(),before=JSON.stringify(p);assert.deepEqual(assertJraGradeReady(p,{expectedRunnerNos:[1,2,3,4,5,6]}),{runners:6,top5:5,eye:true});assert.equal(JSON.stringify(p),before);});
test('null EYE remains null',()=>{const p=base();p.eye=null;assert.equal(assertJraGradeReady(p).eye,false);assert.equal(p.eye,null);});
test('runner grade missing',()=>fail(p=>delete p.runners[0].grade,'INVALID_RUNNER_GRADE'));
test('runner grade invalid',()=>fail(p=>p.runners[0].grade='Z','INVALID_RUNNER_GRADE'));
test('runner reason missing',()=>fail(p=>delete p.runners[0].reason,'INVALID_RUNNER_REASON'));
test('top5 grade missing',()=>fail(p=>delete p.top5[0].grade,'INVALID_TOP5_GRADE'));
test('top5 reason missing',()=>fail(p=>delete p.top5[0].reason,'INVALID_TOP5_REASON'));
test('top5 grade different',()=>fail(p=>p.top5[0].grade='A','RUNNER_TOP5_MISMATCH'));
test('top5 rank different',()=>fail(p=>p.top5[0].rank=4,'RUNNER_TOP5_MISMATCH'));
test('top5 name different',()=>fail(p=>p.top5[0].horse_name='Wrong','RUNNER_TOP5_MISMATCH'));
test('eye grade missing',()=>fail(p=>delete p.eye.grade,'INVALID_EYE_GRADE'));
test('eye reason missing',()=>fail(p=>{delete p.eye.reason;delete p.eye.concrete_upside_reason},'INVALID_EYE_REASON'));
test('eye grade inconsistent',()=>fail(p=>p.eye.grade='A','RUNNER_EYE_MISMATCH'));
test('eye name inconsistent',()=>fail(p=>p.eye.horse_name='Wrong','RUNNER_EYE_MISMATCH'));
test('eye illegally in top5',()=>fail(p=>p.eye={...p.top5[0]},'EYE_NOT_OUTSIDE_TOP5'));
test('duplicate horse',()=>fail(p=>p.runners[5].horse_no=1,'DUPLICATE_RUNNER'));
test('duplicate rank',()=>fail(p=>p.runners[5].rank=1,'DUPLICATE_RUNNER'));
test('missing context horse',()=>fail(p=>p.runners.pop(),'FIELD_MISMATCH'));
test('phantom context horse',()=>fail(p=>{p.runners[5].horse_no=9;p.eye.horse_no=9},'FIELD_MISMATCH'));
test('top5 missing member',()=>fail(p=>p.top5.pop(),'TOP5_COUNT'));
test('top5 has outside rank',()=>fail(p=>p.top5[4]={...p.runners[5]},'TOP5_MEMBERSHIP'));
test('eye is array',()=>fail(p=>p.eye=[],'INVALID_EYE_IDENTITY'));
test('extra key',()=>fail(p=>p.foo=true,'INVALID_KEYS'));

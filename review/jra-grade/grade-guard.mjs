// TEST ONLY: pure payload validation. No grade/rank synthesis, no mutation.
// A nonempty reason does not prove factual evidence.
export class GradeError extends Error { constructor(code){super(code);this.code=code;} }
const valid=new Set(['S','A','B','C','D','E','F']);
const isObj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const ensure=(ok,code)=>{if(!ok)throw new GradeError(code);};
const hasReason=x=>['reason','comment','concrete_upside_reason'].some(k=>typeof x?.[k]==='string'&&x[k].trim().length>0);
function validate(x,type){
 ensure(isObj(x)&&Number.isInteger(x.horse_no)&&x.horse_no>0&&typeof x.horse_name==='string'&&x.horse_name.trim()&&Number.isInteger(x.rank)&&x.rank>0,'INVALID_'+type+'_IDENTITY');
 ensure(valid.has(x.grade),'INVALID_'+type+'_GRADE');
 ensure(hasReason(x),'INVALID_'+type+'_REASON');
}
export function assertJraGradeReady(p,{expectedRunnerNos}={}){
 ensure(isObj(p)&&Object.keys(p).sort().join(',')===['runners','top5','eye','bets','summary','bet_strategy','audit'].sort().join(','),'INVALID_KEYS');
 ensure(Array.isArray(p.runners)&&p.runners.length>0&&Array.isArray(p.top5)&&isObj(p.audit),'INVALID_SHAPE');
 const runners=new Map(), ranks=new Set();
 for(const r of p.runners){
   validate(r,'RUNNER'); ensure(!runners.has(r.horse_no)&&!ranks.has(r.rank),'DUPLICATE_RUNNER');
   runners.set(r.horse_no,r);ranks.add(r.rank);
 }
 if(expectedRunnerNos!==undefined)ensure(Array.isArray(expectedRunnerNos)&&new Set(expectedRunnerNos).size===runners.size&&expectedRunnerNos.length===runners.size&&expectedRunnerNos.every(n=>runners.has(n)),'FIELD_MISMATCH');
 const matched=(x,type)=>{
   validate(x,type);const r=runners.get(x.horse_no);
   ensure(r&&r.horse_name===x.horse_name&&r.rank===x.rank&&r.grade===x.grade,'RUNNER_'+type+'_MISMATCH');
 };
 ensure(p.top5.length===Math.min(5,runners.size),'TOP5_COUNT');
 const top5Nos=new Set();
 for(const x of p.top5){matched(x,'TOP5');ensure(x.rank<=5&&!top5Nos.has(x.horse_no),'TOP5_MEMBERSHIP');top5Nos.add(x.horse_no);}
 ensure([...runners.values()].filter(x=>x.rank<=5).length===top5Nos.size&&[...runners.values()].filter(x=>x.rank<=5).every(x=>top5Nos.has(x.horse_no)),'TOP5_MISMATCH');
 if(p.eye!==null){matched(p.eye,'EYE');ensure(p.eye.rank>5&&!top5Nos.has(p.eye.horse_no),'EYE_NOT_OUTSIDE_TOP5');}
 return {runners:runners.size,top5:top5Nos.size,eye:p.eye!==null};
}

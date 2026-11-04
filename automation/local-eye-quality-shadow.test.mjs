import test from 'node:test';
import assert from 'node:assert/strict';
import {selectLocalQualityEyeShadow as pick} from './local-eye-quality-shadow.mjs';

const runners = [6,7,8].map((horse_no,i)=>({horse_no,rank:i+6,status:'ACTIVE'}));
const f=(n,k)=>({category:'cat'+k,reason:'fact '+n+'-'+k,event_id:'event_'+n+'_'+k,evidence_refs:['ref'+n],current_relevance:true});
const cand=(no,n)=>({horse_no:no,upside_trigger:'new conditions '+no,finish_path:'finish '+no,risk:'adverse case '+no,evidence_refs:['ref'+no],positive_factors:Array.from({length:n},(_,i)=>f(no,i))});
const pair=(a,b,w)=>({horse_nos:[a,b],preferred_horse_no:w,criterion:'CURRENT_UPSIDE_OVER_BASELINE',reason:'independent current-race upside comparison',evidence_refs:['ref'+a,'ref'+b]});
const base=[cand(6,3),cand(7,2),cand(8,2)];
function selected(comparisons,candidates=base){return pick({runners,candidates,comparisons}).selected_horse_no}
test('two strong factors beat three weak factors when pairwise evidence supports this',()=>{
 assert.equal(selected([pair(6,7,7),pair(6,8,8),pair(7,8,7)]),7);
});
test('no automatic rank6; rank8 can win',()=>{
 assert.equal(selected([pair(6,7,7),pair(6,8,8),pair(7,8,8)]),8);
});
test('rank6 can still win on evidence',()=>{
 assert.equal(selected([pair(6,7,6),pair(6,8,6),pair(7,8,7)]),6);
});
test('no clear dominant candidate means no EYE',()=>{
 assert.equal(selected([pair(6,7,6),pair(6,8,8),pair(7,8,7)]),null);
});
test('two current relevant facts are required',()=>{
 const weak=base.map(c=>c.horse_no!==7?c:{...c,positive_factors:c.positive_factors.map((fact,i)=>i===0?{...fact,current_relevance:false}:fact)});
 assert.equal(selected([pair(6,7,7),pair(6,8,8),pair(7,8,7)],weak),null);
});
test('all candidate comparisons are mandatory',()=>assert.throws(()=>selected([pair(6,7,7)]),/SHADOW_EYE_PAIR_COVERAGE/));
test('duplicate source event cannot masquerade as independent fact',()=>{
 const bad=base.map(c=>c.horse_no!==7?c:{...c,positive_factors:[c.positive_factors[0],{...c.positive_factors[1],event_id:c.positive_factors[0].event_id}]});
 assert.throws(()=>selected([pair(6,7,7),pair(6,8,8),pair(7,8,7)],bad),/SHADOW_EYE_DUPLICATE_FACT/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCircuitLoader} from '../candidate/circuit-loader.mjs';
const date='2026-10-11';
const data=(action,circuit,day=date)=>({ok:true,date:day,...(action==='list'?{races:[{race_date:day,circuit}],predictions:[]}:{results:[{race_date:day,circuit}]})});
for(const action of ['list','results']){
 test(action+' successful branch emitted before timeout',async()=>{const updates=[];const load=createCircuitLoader(({circuit})=>circuit==='JRA'?Promise.resolve(data(action,circuit)):new Promise(()=>{}),20);await load(action,date,x=>updates.push(x));assert(updates.some(x=>x.statuses.JRA.state==='READY'&&x.statuses.LOCAL.state==='LOADING'));assert.equal(updates.at(-1).statuses.LOCAL.state,'ERROR');assert.equal((updates.at(-1).data.races??updates.at(-1).data.results).length,1)});
 test(action+' refresh failure retains last good rows with stale flag',async()=>{let fail=false,last;const load=createCircuitLoader(({circuit})=>{if(fail&&circuit==='LOCAL')throw Error('no');return data(action,circuit)});await load(action,date,x=>last=x);fail=true;await load(action,date,x=>last=x);assert.equal((last.data.races??last.data.results).length,2);assert.deepEqual(last.statuses.LOCAL,{state:'ERROR',stale:true})});
 test(action+' date change does not reuse old-day rows',async()=>{let fail=false,last;const load=createCircuitLoader(({circuit,date:day})=>{if(fail)throw Error('no');return data(action,circuit,day)});await load(action,date,x=>last=x);fail=true;await load(action,'2026-10-12',x=>last=x);assert.equal((last.data.races??last.data.results).length,0);assert.equal(last.statuses.LOCAL.stale,false)});
 test(action+' wrong circuit rejected',async()=>{let last;await createCircuitLoader(()=>data(action,'LOCAL'))(action,date,x=>last=x);assert.equal(last.statuses.JRA.state,'ERROR');assert.equal(last.statuses.LOCAL.state,'READY')});
 test(action+' old response cannot overwrite newer request',async()=>{let resolveOld;const old=new Promise(resolve=>resolveOld=resolve);let calls=0,last;const load=createCircuitLoader(({circuit,date:day})=>++calls<=2?old:data(action,circuit,day));const first=load(action,date,x=>last=x);await load(action,'2026-10-12',x=>last=x);resolveOld(data(action,'JRA'));await first;assert((last.data.races??last.data.results).every(x=>x.race_date==='2026-10-12'))});
}

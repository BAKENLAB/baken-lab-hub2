import {writeFileSync,mkdirSync} from 'node:fs';
import {fixture} from './local-eye-partial.test.mjs';
const prefix='/tmp/local-partial-sql-tests';
mkdirSync(prefix,{recursive:true});
for(const [name,modify] of [
 ['valid-partial',x=>{}],
 ['valid-full',null],
 ['invalid-made-up-rank',x=>{x.runners[5].rank=6;}],
 ['invalid-fake-F',x=>{x.runners[5].grade='F';}],
 ['invalid-missing-history-proof',x=>{x.runners[5].missing_items=[];}],
 ['invalid-two-unknowns',x=>{x.runners[4].evaluation_status='UNRATED_NO_VERIFIED_HISTORY';x.runners[4].rank=null;x.runners[4].grade=null;}],
 ['invalid-eye-pool',x=>{x.audit.eye_pool_checked=[];}],
]){
 const p=fixture(name==='valid-full'?false:true).payload;
 if(modify)modify(p);
 const json=JSON.stringify(p);
 if(json.includes('$payload$'))throw Error('Invalid fixture delimiter');
 const query="INSERT INTO public.official_predictions(circuit,protocol_version,payload) VALUES ('LOCAL',"
 + "'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004',$payload$"+json+"$payload$::jsonb);\n";
 writeFileSync(prefix+'/'+name+'.sql',query);
}

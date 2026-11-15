// Read-only, single prior day audit. No target-day result fetch or production access.
import {load} from 'cheerio';
import {readProgramDay} from './jra-jump-program-reader.mjs';
import {makeJraResultCollector} from './jra-jump-official-history.mjs';
const from='2026-11-14',to='2026-11-15';
let previous=0,requestCount=0;
const pacedFetch=async(url,init)=>{
 if(++requestCount>100)throw Error('JUMP_DAY_AUDIT_REQUEST_BUDGET');
 const wait=550-(Date.now()-previous);if(wait>0)await new Promise(r=>setTimeout(r,wait));
 previous=Date.now();
 return fetch(url,init);
};
const expected=await readProgramDay({load,date:from,asOf:to,fetcher:pacedFetch});
const collector=makeJraResultCollector({load,fetcher:pacedFetch,maxRequests:99,expectedMeetingsReader:async(a,b)=>{
 if(a!==from||b!==to)throw Error('JUMP_DAY_SCOPE');
 // Witness only the exact scheduled day; the independent result index must
 // subsequently agree with every race. Planned-only is not a result receipt.
 return {verified:true,from:a,to:b,source_ref:expected.source_ref,meetings:expected.meetings};
}});
const cal=await collector.calendar(from,to);
if(cal.rows.length!==36)throw Error('JUMP_DAY_EXPECTED_36');
console.log('PASS independent program/result index 36/36');
let jump=0,flat=0;
for(const x of cal.rows){
 const r=await collector.result(x.cname,to);
 if(r.jump){jump++;console.log('JUMP verified: '+r.track+' '+r.race_no+'R / '+r.rows.length+' starters')}
 else flat++;
}
if(jump+flat!==36||jump<1)throw Error('JUMP_DAY_COVERAGE');
console.log('PASS full prior-day result coverage: 36/36; hurdle '+jump+'; flat '+flat+'; HTTP '+requestCount);

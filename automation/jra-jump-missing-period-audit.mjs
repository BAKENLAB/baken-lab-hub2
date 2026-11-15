// Research-only bounded historical official result acquisition; never read target-day results.
import {load} from 'cheerio';
import {mkdir,writeFile,rename} from 'node:fs/promises';
import {readProgramDay} from './jra-jump-program-reader.mjs';
import {makeJraResultCollector} from './jra-jump-official-history.mjs';
import {makeVerifiedResultReader} from './jra-jump-verified-cache.mjs';
import {seeds} from './missing-history-seeds-20261115.mjs';
const asOf='2026-11-15',from='2026-09-14',dir='jump-history-evidence';
const need=(ok,msg)=>{if(!ok)throw Error(msg)};
need(seeds.length===20&&new Set(seeds.map(x=>x[0])).size===20&&seeds.every(x=>x[0]>=from&&x[0]<asOf),'SEED_SCOPE');
await mkdir(dir,{recursive:true});
const index={scope:'research-only',from,to_exclusive:asOf,expected_days:seeds.map(x=>x[0]),days:[],failures:[],complete:false};
async function atomic(path,data){const t=path+'.tmp';await writeFile(t,JSON.stringify(data,null,2));await rename(t,path)}
async function indexSave(){index.complete=index.days.length===index.expected_days.length&&index.failures.length===0;await atomic(dir+'/coverage-index.json',index);}
let last=0,total=0;
const pacedFetch=async(url,init)=>{
 need(++total<=820,'PERIOD_REQUEST_BUDGET');
 const parsed=new URL(url);need(parsed.protocol==='https:'&&parsed.hostname==='www.jra.go.jp','SOURCE_HOST');
 const wait=850-(Date.now()-last);if(wait>0)await new Promise(r=>setTimeout(r,wait));last=Date.now();
 return fetch(url,init);
};
const ordered=[...seeds].sort((a,b)=>(a[0]==='2026-09-22'?-1:b[0]==='2026-09-22'?1:a[0].localeCompare(b[0])));
await indexSave();
for(const [date,seed] of ordered){
 try{
  const program=await readProgramDay({load,date,asOf,fetcher:pacedFetch});
  need(/^[a-f0-9]{64}$/.test(program.html_sha256??''),'PROGRAM_PROOF');
  const source=makeJraResultCollector({load,fetcher:pacedFetch,maxRequests:50,expectedMeetingsReader:async()=>{throw Error('DAY_PROGRAM_SCOPE_ONLY')}});
  const result=await source.dayFromSeed({date,asOf,seed,meetings:program.meetings});
  const expected=program.meetings.reduce((s,m)=>s+m.race_nos.length,0);
  need(result.rows.length===expected,'DAY_COVERAGE');
  const records=[],store={get:async k=>records.find(x=>x.key===k)??null,append:async r=>records.push(structuredClone(r))};
  const cache=makeVerifiedResultReader({store,maxFetch:48});
  for(const r of result.rows){need(r.race_date===date,'RESULT_DATE');await cache.read({ref:r.source_ref,asOf,readOfficial:async()=>r});}
  const offline=makeVerifiedResultReader({store,maxFetch:1});
  for(const r of result.rows)await offline.read({ref:r.source_ref,asOf,readOfficial:async()=>{throw Error('OFFLINE_REUSE_FAILED')}});
  need(records.length===expected&&offline.stats().hits===expected,'EVIDENCE_REPLAY');
  const jump=records.filter(x=>x.result.jump),runners=jump.reduce((s,x)=>s+x.result.rows.length,0);
  const day={date,expected,verified:records.length,jump:jump.length,runners,file:date+'.json'};
  await atomic(dir+'/'+day.file,{scope:'research-only',asOf,program,day,records});
  index.days.push(day);await indexSave();console.log('PASS_DAY '+JSON.stringify(day));
 }catch(e){const error=String(e?.message??e).slice(0,180);index.failures.push({date,error});await indexSave();console.log('FAIL_DAY '+JSON.stringify({date,error}));}
}
await indexSave();
console.log('PERIOD_SUMMARY '+JSON.stringify({expected_days:index.expected_days.length,complete_days:index.days.length,failed_days:index.failures.length,races:index.days.reduce((s,d)=>s+d.verified,0),jump:index.days.reduce((s,d)=>s+d.jump,0),runners:index.days.reduce((s,d)=>s+d.runners,0),http:total}));
if(!index.complete)throw Error('PERIOD_INCOMPLETE');

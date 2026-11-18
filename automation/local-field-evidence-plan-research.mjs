/** LOCAL research only, no fetch implementation or production connection.
 * Inputs: trusted pre-freeze snapshot witnesses; missing slots are NOT asserted missing races.
 * Resolver uses an injected authorized reader with an externally enforced timeout.
 * Do not publish real snapshots in this public repository.
 * Retrospective evidence is never treated as observed before cutoff.
 */
export function planLocalFieldEvidence({target,roster,evidence,maxRuns=5,maxPages=40}={}){
 const codes={"盛岡":"10","水沢":"11","浦和":"18","船橋":"19","大井":"20","川崎":"21","金沢":"22","笠松":"23","名古屋":"24","園田":"27","姫路":"28","高知":"31","佐賀":"32","門別":"36"};
 const date=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+"T00:00:00Z"))&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
 const norm=x=>String(x??"").normalize("NFKC").replace(/\s+/g,"");
 const boundary=[target?.captured,target?.cutoff,target?.post].map(Date.parse);
 if(!date(target?.date)||!codes[target.track]||!Number.isInteger(target.race)||target.race<1||target.race>14||!boundary.every(Number.isFinite)||!(boundary[0]<boundary[1]&&boundary[1]<boundary[2])||!Array.isArray(roster)||roster.length<2||roster.length>20||!Array.isArray(evidence)||!Number.isInteger(maxRuns)||maxRuns<1||maxRuns>5||!Number.isInteger(maxPages)||maxPages<1||maxPages>100)throw Error("INVALID_PLAN_INPUT");
 const heads=new Map();for(const h of roster){if(!Number.isInteger(h.no)||h.no<1||h.no>24||!norm(h.name)||heads.has(h.no))throw Error("INVALID_ROSTER");heads.set(h.no,{no:h.no,name:h.name,ids:new Set(),runs:[]});}
 let rejected=0,duplicates=0;const keys=new Set();
 for(const e of evidence){const h=heads.get(e.no),p=e.past,ct=Date.parse(e.checked);
 const id=String(e.ref??"").match(/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=(\d{1,30})(?:&k_activeCode=\d+)?$/)?.[1];
 if(!h||norm(h.name)!==norm(e.name)||!id||e.identity_kind!=="OFFICIAL_HORSE_REF"||!date(p?.raceDate)||p.raceDate>=target.date||!codes[p.track]||!Number.isInteger(p.raceNo)||p.raceNo<1||p.raceNo>14||!Number.isInteger(e.past_no)||e.past_no<1||e.past_no>24||!Number.isFinite(ct)||ct>boundary[0]||ct<Date.parse(p.raceDate+"T00:00:00+09:00")){rejected++;continue;}
 const url=`https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=${codes[p.track]}&k_raceDate=${p.raceDate.replaceAll("-","%2F")}&k_raceNo=${p.raceNo}`;
 if(e.source!==url){rejected++;continue;}
 h.ids.add(id);const key=JSON.stringify([h.no,p.track,p.raceDate,p.raceNo,e.past_no,id]);if(keys.has(key)){duplicates++;continue;}keys.add(key);
 h.runs.push({past:{raceDate:p.raceDate,track:p.track,raceNo:p.raceNo},past_no:e.past_no,id,url,checked:e.checked});
 }
 const idOwners=new Map();for(const h of heads.values())for(const id of h.ids){const owners=idOwners.get(id)??[];owners.push(h.no);idOwners.set(id,owners);}
 const jobs=new Map(),coverage=[];
 for(const h of heads.values()){
 const id=h.ids.size===1?[...h.ids][0]:null;
 const conflict=h.ids.size>1||!!(id&&idOwners.get(id).length!==1);
 const raceKeys=new Set(),raceDates=new Set();for(const x of h.runs){if(raceKeys.has(x.url)||raceDates.has(x.past.raceDate))h.conflict=true;raceKeys.add(x.url);raceDates.add(x.past.raceDate);}
 const safe=!!id&&!conflict&&!h.conflict;
 const runs=safe?h.runs.sort((a,b)=>b.past.raceDate.localeCompare(a.past.raceDate)||b.past.raceNo-a.past.raceNo).slice(0,maxRuns):[];
 coverage.push({horse_no:h.no,horse_name:h.name,identity_status:safe?"OFFICIAL_WITNESS_PRESENT":(conflict||h.conflict?"CONFLICT":"MISSING"),history_witnesses:runs.length,unfilled_slots:maxRuns-runs.length});
 for(const r of runs){if(!jobs.has(r.url))jobs.set(r.url,{url:r.url,priorRace:r.past,links:[]});jobs.get(r.url).links.push({horse_no:h.no,horse_name:h.name,official_horse_id:r.id,past_horse_no:r.past_no,checked:r.checked});}
 }
 const remaining=[...jobs.values()].sort((a,b)=>b.priorRace.raceDate.localeCompare(a.priorRace.raceDate)||a.url.localeCompare(b.url)),selected=[],per=new Map();
 while(remaining.length&&selected.length<maxPages){let idx=0,best=-Infinity;for(let i=0;i<remaining.length;i++){const score=remaining[i].links.reduce((n,x)=>n+1/(1+(per.get(x.horse_no)??0)),0);if(score>best){best=score;idx=i;}}
 const [j]=remaining.splice(idx,1);selected.push(j);for(const l of j.links)per.set(l.horse_no,(per.get(l.horse_no)??0)+1);}
 return {schema:"LOCAL_RESEARCH_FIELD_PLAN_V1",target:{...target},coverage:coverage.map(h=>({...h,planned_runs:per.get(h.horse_no)??0})),jobs:selected,unique_pages:jobs.size,unplanned_pages:remaining.length,witnesses:coverage.reduce((n,h)=>n+h.history_witnesses,0),rejected,duplicates,rank_authorized:false,market_used:false};
}

export async function resolveLocalFieldEvidence({plan,readNormalizedResult,signal,deadlineMs,clock=()=>Date.now()}={}){
 if(plan?.schema!=="LOCAL_RESEARCH_FIELD_PLAN_V1"||plan.rank_authorized!==false||!Array.isArray(plan.jobs)||!Array.isArray(plan.coverage)||typeof readNormalizedResult!=="function"||!Number.isFinite(deadlineMs))throw Error("INVALID_RESEARCH_RESOLVER");
 const reports=[],links=[];
 for(const j of plan.jobs){
 if(signal?.aborted||clock()>=deadlineMs){reports.push({url:j.url,status:"SKIPPED_BUDGET"});continue;}
 let p;try{p=await readNormalizedResult(j,{signal,deadlineMs});}catch{reports.push({url:j.url,status:"SOURCE_UNAVAILABLE"});continue;}
 if(signal?.aborted||clock()>=deadlineMs){reports.push({url:j.url,status:"SKIPPED_BUDGET"});continue;}
 if(p?.schema!=="LOCAL_FULL_PAST_RESULT_RESEARCH_V1"||p.rank_authorized!==false||p.market_used!==false||p.sourceUrl!==j.url||p.priorRace?.raceDate!==j.priorRace.raceDate||p.priorRace?.track!==j.priorRace.track||p.priorRace?.raceNo!==j.priorRace.raceNo||p.targetDate!==plan.target.date||Date.parse(p.cutoff)!==Date.parse(plan.target.cutoff)||!Array.isArray(p.records)||!["OBSERVED_BEFORE_CUTOFF","RECONSTRUCTED_NOT_ASOF"].includes(p.source_timing)||!Number.isFinite(Date.parse(p.observedAt))||(p.source_timing==="OBSERVED_BEFORE_CUTOFF"&&Date.parse(p.observedAt)>=Date.parse(plan.target.cutoff))){reports.push({url:j.url,status:"PACKET_MISMATCH"});continue;}
 let matched=0;
 for(const l of j.links){const found=p.records.filter(r=>r.horse_no===l.past_horse_no&&r.official_horse_id===l.official_horse_id&&String(r.horse_name??"").normalize("NFKC").replace(/\s+/g,"")===String(l.horse_name).normalize("NFKC").replace(/\s+/g,""));
 if(found.length!==1||found[0].status!=="FINISHED")continue;
 const r=found[0];matched++;links.push({horse_no:l.horse_no,priorRace:j.priorRace,source_url:j.url,source_timing:p.source_timing,roster_status:p.roster_status,finish:r.finish,winner_gap_seconds:r.winner_gap_seconds,final3f:r.final3f,corner_positions:r.corner_positions,rank_authorized:false});
 }
 reports.push({url:j.url,status:matched===j.links.length?"ALL_LINKS_MATCHED":"PARTIAL_LINKS",matched,expected:j.links.length});
 }
 const coverage=plan.coverage.map(h=>{const a=links.filter(x=>x.horse_no===h.horse_no);return {...h,matched_runs:a.length,asof_runs:a.filter(x=>x.source_timing==="OBSERVED_BEFORE_CUTOFF").length,with_finish:a.filter(x=>Number.isInteger(x.finish)).length,with_gap:a.filter(x=>Number.isFinite(x.winner_gap_seconds)).length,with_final3f:a.filter(x=>Number.isFinite(x.final3f)).length,with_corners:a.filter(x=>Array.isArray(x.corner_positions)&&x.corner_positions.length>0).length};});
 return {coverage,reports,links,rank_authorized:false,market_used:false,all_heads_five_asof:coverage.every(h=>h.asof_runs===5),peer_history_status:"NOT_IMPLEMENTED_IN_RESOLVER"};
}

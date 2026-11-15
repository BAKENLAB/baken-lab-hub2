/** Research-only. No production writes / scoring. Source and full-roster verification must be supplied by the trusted acquisition layer. */
export function officialHorseId(ref){
 if(typeof ref!=="string")return null;
 const m=ref.match(/^(?:https:\/\/(?:www\.jra\.go\.jp|jra\.jp|own\.jra\.jp|app\.jra\.jp|sp\.jra\.jp))?\/JRADB\/accessU\.html\?CNAME=[ps]w01dud(?:00|10)(\d{10})(?:\/|%2[fF])[A-Fa-f0-9]{2}$/);
 return m?.[1]??null;
}

export function officialRaceCore(ref,kind){
 if(typeof ref!=="string")return null;
 const m=ref.match(/^(?:https:\/\/(?:www\.jra\.go\.jp|jra\.jp|own\.jra\.jp|app\.jra\.jp|sp\.jra\.jp))?\/JRADB\/accessS\.html\?CNAME=([ps]w01sde|pw2fsrp)(\d{22})(?:\/|%2[fF])[a-fA-F0-9]{2}$/);
 if(!m|| (kind==="report"?m[1]!=="pw2fsrp":!/[ps]w01sde/.test(m[1])))return null;
 return m[2];
}

export function parseJraStewardsReport({targetRace,priorRace,source,clock=()=>Date.now()}={}){
 const fail=status=>({status,verified:false,events:[],unresolved:[],rank_effect:"NONE"});
 const now=clock(),post=Date.parse(targetRace?.postTime??""),checked=Date.parse(source?.checkedAt??"");
 const date=priorRace?.raceDate,core=officialRaceCore(priorRace?.sourceRef,"result"),report=officialRaceCore(source?.url,"report");
 if(!core||core!==report||!source.url.startsWith("https://")||!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||core.slice(-8)!==date.replace(/-/g,"")||Number(core.slice(-10,-8))!==priorRace.raceNo||!(date<targetRace?.raceDate)||!Number.isFinite(now)||!(checked<=now&&now<post&&checked<post&&checked>=Date.parse(date+"T00:00:00+09:00"))||source?.verifiedOfficialResponse!==true||source.fullFieldVerified!==true||source.raceKey!==priorRace.raceKey||source.track!==priorRace.track||source.raceNo!==priorRace.raceNo||source.raceDate!==date)return fail("REPORT_IDENTITY_OR_ASOF_UNVERIFIED");
 if(!Array.isArray(source.runners)||source.runners.length!==source.expectedRunnerCount||source.runners.length<1||source.runners.length>24||!Array.isArray(source.paragraphs)||!source.paragraphs.length||source.paragraphs.length>100||source.paragraphs.some(x=>typeof x!=="string"||x.length>2000))return fail("REPORT_ROSTER_OR_TEXT_MISSING");
 const norm=x=>String(x??"").normalize("NFKC").replace(/\s+/g," ").trim(),roster=new Map();
 for(const h of source.runners){if(!Number.isInteger(h.horseNo)||h.horseNo<1||h.horseNo>24||roster.has(h.horseNo)||!norm(h.horseName))return fail("AMBIGUOUS_ROSTER");roster.set(h.horseNo,{horse_no:h.horseNo,horse_name:norm(h.horseName),horse_id:officialHorseId(h.horseRef)});}
 const events=[],unresolved=[],dedup=new Set();
 for(let i=0;i<source.paragraphs.length;i++){
  const t=norm(source.paragraphs[i]),bad=reason=>unresolved.push({row:i+1,reason});
  if(/^(?:なお|この件について|裁決委員|審議において|※|[〖【]降着の判断基準)/.test(t))continue;
  // The report may list additional affected horses in a separate paragraph.
  // Only explicit numeric lists within the verified historical roster qualify.
  // "Affected" is not interchangeable with primary interference or severity.
  const secondary=t.match(/\(\s*その他\s*(.+?)の進路に影響あり\s*\)/);
  if(secondary){
   const list=secondary[1].trim();
   if(!/^\d{1,2}番(?:[、,・\s]*(?:および|及び|並びに|ならびに)?[、,・\s]*\d{1,2}番)*$/.test(list)){
    bad("SECONDARY_VICTIMS_REQUIRE_REVIEW");
   }else{
    const nums=[...new Set([...list.matchAll(/(\d{1,2})番/g)].map(x=>Number(x[1])))];
    if(nums.some(n=>!roster.has(n)))bad("SECONDARY_VICTIM_ROSTER_MISMATCH");
    else for(const n of nums){
     const h=roster.get(n),key=[n,"ADDITIONAL_PATH_IMPACT"].join("|");
     if(dedup.has(key))continue;dedup.add(key);
     events.push({...h,kind:"ADDITIONAL_PATH_IMPACT",role:"VICTIM",race_key:priorRace.raceKey,race_date:date,source_ref:source.url,source_checked_at:source.checkedAt,section_row:i+1,certainty:"OFFICIAL_RECORDED_FACT",time_loss_seconds:null,rank_effect:"NONE"});
    }
   }
  }else if(/その他.*進路に影響/.test(t))bad("SECONDARY_VICTIMS_REQUIRE_REVIEW");
  // Distinguish a rider's difficulty caused by that horse's own evasion
  // from interference by another horse. Never credit the former as a victim.
  if(/追いづらくな/.test(t)&&/逃避/.test(t)){
   const self=t.match(/(?:^|直線コースで|コーナーで|発走後)[、,\s]*(\d{1,2})番(.+?)の騎手.+?追いづらくなる.+?同馬が(?:内側|外側)(?:に|へ)逃避しようとしたことによる/);
   const h=self?roster.get(Number(self[1])):null;
   if(!h||norm(self[2])!==h.horse_name||/他馬の影響|他の馬の影響|被害馬/.test(t)){
    bad("SELF_EVASION_IDENTITY_OR_CAUSE_UNVERIFIED");
   }else{
    const key=[h.horse_no,"SELF_EVASION"].join("|");
    if(!dedup.has(key)){dedup.add(key);events.push({...h,kind:"SELF_EVASION",role:"SELF",race_key:priorRace.raceKey,race_date:date,source_ref:source.url,source_checked_at:source.checkedAt,section_row:i+1,certainty:"OFFICIAL_RECORDED_FACT",time_loss_seconds:null,rank_effect:"NONE"});}
   }
   continue;
  }
  if(!/進路が狭くな/.test(t)){
   if(!secondary&&/妨害|追いづら|逃避|不利|斜行|接触|つまず/.test(t)&&!/^(?:これは|この件は)/.test(t))bad("OTHER_INCIDENT_REVIEW_REQUIRED");
   continue;
  }
  if(/^(?:これは|この件は)/.test(t))continue;
  // Only literal affected subjects before the first "の進路が狭くな..." clause;
  // secondary clauses and relationships are not guessed.
  const sentence=t.split("。")[0];
  if(/その後|影響で|また.*斜行|控えた|進路が狭くな.*進路が狭くな/.test(sentence)){bad("COMPLEX_MULTI_EVENT_REVIEW_REQUIRED");continue;}
  const m=sentence.match(/^(.+?)の進路が狭くな(?:りました|る事象がありました|った)/);
  if(!m){bad("VICTIM_CLAUSE_UNSUPPORTED");continue;}
  let clause=m[1].split(/(?:斜行したため|動きにより|先行馬を追い抜いたため)[、,\s]*/).at(-1);
  clause=clause.replace(/^.*?(?:コーナー(?:手前)?で|直線コースで|決勝線手前で|発走後(?:まもなく)?)[、,\s]*/,"").trim();
  const mentions=[...clause.matchAll(/(\d{1,2})番/g)];
  if(!mentions.length){bad("VICTIM_NUMBER_MISSING");continue;}
  const found=[];
  for(let j=0;j<mentions.length;j++){
   const n=Number(mentions[j][1]),h=roster.get(n),start=mentions[j].index+mentions[j][0].length,end=j+1<mentions.length?mentions[j+1].index:clause.length;
   const name=clause.slice(start,end).replace(/(?:[、,]\s*|および|及び|ならびに|並びに)+\s*$/,"").trim();
   if(!h||name!==h.horse_name){found.length=0;break;}found.push(h);
  }
  if(found.length!==mentions.length){bad("VICTIM_NUMBER_NAME_MISMATCH");continue;}
  for(const h of found){
   const key=[h.horse_no,"RESTRICTED_PATH",i].join("|");if(dedup.has(key))continue;dedup.add(key);
   events.push({...h,kind:"RESTRICTED_PATH",role:"VICTIM",race_key:priorRace.raceKey,race_date:date,source_ref:source.url,source_checked_at:source.checkedAt,section_row:i+1,certainty:"OFFICIAL_RECORDED_FACT",time_loss_seconds:null,rank_effect:"NONE"});
  }

 }
 return {status:unresolved.length?"PARTIAL_REPORT":"OFFICIAL_REPORT_PARSED",verified:true,race_key:priorRace.raceKey,race_date:date,source_kind:"REPORT",roster_ids:[...roster.values()].map(h=>h.horse_id).filter(Boolean),source_ref:source.url,source_checked_at:source.checkedAt,events,unresolved,absence_is_not_no_incident:true,rank_effect:"NONE"};
}

export function attachJraPriorIncidentEvidence({targetRace,officialRunners,liveRunners,packets,clock=()=>Date.now()}={}){
 const fail=status=>({status,runners:[],rank_effect:"NONE",prediction_saved:false});
 const now=clock(),post=Date.parse(targetRace?.postTime??"");
 if(!Number.isFinite(now)||!(now<post)||!Array.isArray(officialRunners)||!Array.isArray(liveRunners)||officialRunners.length!==liveRunners.length||!Array.isArray(packets))return fail("UNVERIFIED_CURRENT_FIELD");
 const byNo=new Map(),ids=new Set();
 for(const h of officialRunners){
  const id=officialHorseId(h.horse_ref);if(h.status!=="ACTIVE"||!Number.isInteger(h.horse_no)||!id||byNo.has(h.horse_no)||ids.has(id))return fail("UNVERIFIED_CURRENT_HORSE_ID");
  byNo.set(h.horse_no,{id,name:h.horse_name});ids.add(id);
 }
 if(new Set(liveRunners.map(h=>h.horse_no)).size!==liveRunners.length)return fail("DUPLICATE_LIVE_HORSE");
 const runners=[];
 for(const h of liveRunners){
  const o=byNo.get(h.horse_no);if(!o||o.id!==officialHorseId(h.horse_ref)||o.name!==h.horse_name||!Array.isArray(h.past_runs))return fail("LIVE_IDENTITY_MISMATCH");
  const seenPrior=new Set();
  const history=h.past_runs.slice(0,5).map((run,i)=>{
   const missing=status=>({run_index:i,race_date:run?.race_date??null,status,events:[],sources:[],absence_is_not_no_incident:true});
   const core=officialRaceCore(run.source_ref,"result");
   if(!core||core.slice(-8)!==String(run.race_date).replace(/-/g,"")||!(run.race_date<targetRace.raceDate))return missing("PAST_RACE_UNVERIFIED");
   if(seenPrior.has(core))return missing("DUPLICATE_HISTORY_RACE");
   seenPrior.add(core);
   const matches=packets.filter(p=>p?.verified===true&&["RESULT","REPORT"].includes(p.source_kind)&&["OFFICIAL_INCIDENT_SECTION_PARSED","EXPLICIT_NO_RECORDED_INCIDENTS","PARTIAL_OFFICIAL_INCIDENTS","OFFICIAL_REPORT_PARSED","PARTIAL_REPORT"].includes(p.status)&&p.race_date===run.race_date&&officialRaceCore(p.source_ref,p.source_kind==="REPORT"?"report":"result")===core&&Number.isFinite(Date.parse(p.source_checked_at??""))&&Date.parse(p.source_checked_at)<=now&&Date.parse(p.source_checked_at)<post&&Array.isArray(p.events)&&Array.isArray(p.roster_ids)&&p.roster_ids.filter(x=>x===o.id).length===1);
   if(!matches.length)return missing("INCIDENT_SOURCE_OR_HORSE_ID_UNVERIFIED");
   if(new Set(matches.map(p=>p.source_kind)).size!==matches.length)return missing("DUPLICATE_SOURCE_REVIEW_REQUIRED");
   const events=matches.flatMap(p=>p.events.filter(e=>e.certainty==="OFFICIAL_RECORDED_FACT"&&e.horse_id===o.id&&e.race_date===run.race_date&&e.race_key===p.race_key&&e.source_ref===p.source_ref&&e.source_checked_at===p.source_checked_at));
   return {run_index:i,race_date:run.race_date,race_core:core,status:"VERIFIED_SOURCE_REVIEW",
    partial:matches.some(p=>p.status.startsWith("PARTIAL")),
    sources:matches.map(p=>({kind:p.source_kind,status:p.status,source_ref:p.source_ref,source_checked_at:p.source_checked_at})),
    same_incident_double_count_prohibited:true,events,absence_is_not_no_incident:true};
  });
  const coverage={supplied_runs:history.length,not_supplied_slots:5-history.length,
   verified_source_runs:history.filter(x=>x.status==="VERIFIED_SOURCE_REVIEW").length,
   result_source_runs:history.filter(x=>x.sources.some(p=>p.kind==="RESULT")).length,
   report_source_runs:history.filter(x=>x.sources.some(p=>p.kind==="REPORT")).length,
   partial_runs:history.filter(x=>x.partial===true).length,
   unverified_runs:history.filter(x=>x.status!=="VERIFIED_SOURCE_REVIEW").length,
   recorded_event_runs:history.filter(x=>x.events.length>0).length};
  runners.push({horse_no:h.horse_no,horse_id:o.id,history,coverage,status:"REVIEW_ONLY"});
 }
 const coverage={active_runners:runners.length,reviewed_runners:runners.length,supplied_runs:0,not_supplied_slots:0,verified_source_runs:0,result_source_runs:0,report_source_runs:0,partial_runs:0,unverified_runs:0,recorded_event_runs:0,all_supplied_runs_have_a_source:false};
 for(const key of ["supplied_runs","not_supplied_slots","verified_source_runs","result_source_runs","report_source_runs","partial_runs","unverified_runs","recorded_event_runs"]){
  coverage[key]=runners.reduce((n,r)=>n+r.coverage[key],0);
 }
 coverage.all_supplied_runs_have_a_source=coverage.supplied_runs>0&&coverage.unverified_runs===0&&runners.every(r=>r.coverage.supplied_runs>0);
 return {status:"WHOLE_FIELD_INCIDENT_REVIEW",runners,coverage,rank_effect:"NONE",prediction_saved:false,market_used:false,target_result_used:false};
}

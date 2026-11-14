/** Stage 1 read-only JRA incident evidence. Caller must independently verify response, identity and full-field roster. No automatic scoring, claims, writes or target results. */
import {officialHorseId} from "./jra-official-stewards-incident-link.mjs";
export function parseJraOfficialIncidents({targetRace,priorRace,source,clock=()=>Date.now()}={}){
 const fail=status=>({status,verified:false,events:[],unresolved:[],absence_is_not_no_incident:true,rank_effect:"NONE",market_used:false,target_result_used:false});
 const norm=v=>String(v??"").normalize("NFKC").replace(/\s+/g," ").trim();
 const date=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString().slice(0,10)===v;
 const url=v=>{if(typeof v!=="string")return null;const m=v.match(/^(?:https:\/\/(?:www\.jra\.go\.jp|app\.jra\.jp|sp\.jra\.jp|own\.jra\.jp))?\/JRADB\/accessS\.html\?CNAME=(pw01sde[A-Za-z0-9]+(?:%2[fF]|\/)[A-Za-z0-9]+)$/);return m?m[1].replace(/%2[fF]/g,"/"):null;};
 const now=clock(),post=Date.parse(targetRace?.postTime??""),checked=Date.parse(source?.checkedAt??"");
 if(!date(targetRace?.raceDate)||!date(priorRace?.raceDate)||priorRace.raceDate>=targetRace.raceDate||!Number.isFinite(now)||!Number.isFinite(post)||!Number.isFinite(checked)||checked>now||now>=post||checked>=post||checked<Date.parse(priorRace.raceDate+"T00:00:00+09:00")||!Number.isInteger(priorRace.raceNo)||priorRace.raceNo<1||priorRace.raceNo>12||!priorRace.track||!priorRace.raceKey)return fail("UNVERIFIED_AS_OF_OR_RACE");
 const a=url(priorRace.sourceRef),b=url(source?.url);
 if(!a||a!==b||!source.url.startsWith("https://")||source.verifiedOfficialResponse!==true||source.fullFieldVerified!==true||source.raceKey!==priorRace.raceKey||source.raceDate!==priorRace.raceDate||source.track!==priorRace.track||source.raceNo!==priorRace.raceNo)return fail("UNVERIFIED_SOURCE_IDENTITY");
 const roster=source.runners;
 if(!Array.isArray(roster)||roster.length<1||roster.length>24||roster.length!==source.expectedRunnerCount)return fail("FULL_FIELD_REQUIRED");
 const byNo=new Map(),byName=new Map();
 for(const h of roster){const n=h.horseNo,name=norm(h.horseName);if(!Number.isInteger(n)||n<1||n>24||!name||byNo.has(n)||byName.has(name))return fail("AMBIGUOUS_RUNNER_IDENTITY");const v={horse_no:n,horse_name:name,horse_id:officialHorseId(h.horseRef)};byNo.set(n,v);byName.set(name,v);}
 if(!["PRESENT","EXPLICIT_NONE"].includes(source.sectionStatus))return fail("INCIDENT_SECTION_UNAVAILABLE");
 const rows=source.sectionRows,none=/^(?:なし|該当なし|特になし|特記事項なし)[。.]?$/;
 if(!Array.isArray(rows)||!rows.length||rows.length>100||rows.some(x=>typeof x!=="string"||x.length>1500))return fail("INCIDENT_SECTION_INVALID");
 if(source.sectionStatus==="EXPLICIT_NONE"&&!rows.every(s=>none.test(norm(s))))return fail("INCIDENT_SECTION_INVALID");
 const events=[],unresolved=[],nonPerformance=[],dedup=new Set();
 const add=(horse,kind,role,raw,index,related=[])=>{const key=[horse.horse_no,kind,role,norm(raw)].join("|");if(dedup.has(key))return;dedup.add(key);events.push({...horse,kind,role,race_key:priorRace.raceKey,race_date:priorRace.raceDate,source_ref:source.url,source_checked_at:source.checkedAt,section_row:index+1,official_text:raw,related_horse_nos:related,certainty:"OFFICIAL_RECORDED_FACT",time_loss_seconds:null,rank_effect:"NONE"});};
 for(let i=0;i<rows.length;i++){
  const raw=rows[i],t=norm(raw).replace(/^[・●•]\s*/,""),unknown=reason=>unresolved.push({row:i+1,reason,official_text:raw});
  if(!t||none.test(t)){if(source.sectionStatus==="PRESENT")unknown("UNEXPECTED_EMPTY_ROW");continue;}
  const subjects=[...byName.entries()].filter(([name])=>["号は","号の","号が"].some(s=>t.startsWith(name+s))).map(([,h])=>h),subject=subjects.length===1?subjects[0]:null;
  const victim=t.match(/\(\s*被害馬\s*:\s*([^)]+)\)/);
  if(victim){
   const part=victim[1].trim();if(!/^\d{1,2}番(?:\s*[・、,]\s*\d{1,2}番)*$/.test(part)){unknown("VICTIM_LIST_UNPARSED");continue;}
   const nums=[...new Set([...part.matchAll(/(\d{1,2})番/g)].map(m=>Number(m[1])))];
   if(!subject||nums.some(n=>!byNo.has(n)||n===subject.horse_no)){unknown("VICTIM_OR_ACTOR_IDENTITY_UNVERIFIED");continue;}
   add(subject,"INTERFERENCE_ACTOR","ACTOR",raw,i,nums);for(const n of nums)add(byNo.get(n),"INTERFERENCE_VICTIM","VICTIM",raw,i,[subject.horse_no]);continue;
  }
  if(/被害馬/.test(t)){unknown("VICTIM_LIST_UNPARSED");continue;}
  if(subject&&t.startsWith(subject.horse_name+"号は")){
   if(/発進不良\s*[\[〔【(]\s*出遅れ\s*[\]〕】)]/.test(t)){add(subject,"SLOW_START","SELF",raw,i);continue;}
   if(/発進不良/.test(t)){add(subject,"OTHER_START_PROBLEM","SELF",raw,i);continue;}
   if(/(?:他の馬|他馬)の影響を受けた|進路が狭くなった|走行を妨害された/.test(t)){add(subject,"OTHER_HORSE_IMPACT","VICTIM",raw,i);continue;}
   if(/競走中止|競走を中止/.test(t)){add(subject,"RACE_STOPPED","SELF",raw,i);continue;}
   if(/異常歩様|疾病|故障|鼻出血/.test(t)&&!/再審査|出走停止/.test(t)){add(subject,"HEALTH_INCIDENT","SELF",raw,i);continue;}
  }
  if(/登録服色|負担重量.*(?:超過|変更)|騎手変更|出走制限|出走停止|調教再審査|騎乗停止/.test(t)&&!/斜行|妨害|影響を受け|発進不良|競走中止/.test(t)){nonPerformance.push({row:i+1,official_text:raw,classification:"ADMINISTRATIVE_OR_RESTRICTION_NO_ABILITY_CREDIT"});continue;}
  unknown("UNCLASSIFIED_OR_UNVERIFIED_SUBJECT");
 }
 return {status:unresolved.length?"PARTIAL_OFFICIAL_INCIDENTS":source.sectionStatus==="EXPLICIT_NONE"?"EXPLICIT_NO_RECORDED_INCIDENTS":"OFFICIAL_INCIDENT_SECTION_PARSED",verified:true,race_key:priorRace.raceKey,race_date:priorRace.raceDate,source_kind:"RESULT",roster_ids:[...byNo.values()].map(h=>h.horse_id).filter(Boolean),source_ref:source.url,source_checked_at:source.checkedAt,events,unresolved,non_performance:nonPerformance,recorded_event_count:events.length,absence_is_not_no_incident:true,rank_effect:"NONE",market_used:false,target_result_used:false};
}

export function extractJraIncidentSection(document){
 const norm=x=>String(x??"").normalize("NFKC").replace(/\s+/g," ").trim(),none=/^(?:なし|該当なし|特になし|特記事項なし)[。.]?$/;
 if(!document||typeof document.querySelectorAll!=="function")return {sectionStatus:"MISSING",sectionRows:[]};
 const headings=[...document.querySelectorAll("h2,h3,h4,h5,h6,dt")].filter(e=>norm(e.textContent)==="競走中の出来事等");
 if(headings.length!==1)return {sectionStatus:"MISSING",sectionRows:[]};
 const h=headings[0],found=[];
 for(const el of new Set([h.nextElementSibling,h.parentElement?.nextElementSibling].filter(Boolean))){
  if(el.matches?.("h2,h3,h4,h5,h6,dt")||el.querySelector?.("h2,h3,h4,h5,h6,dt"))continue;
  const lists=el.matches?.("ul,ol")?[el]:[...el.querySelectorAll("ul,ol")];
  if(lists.length===1){const li=[...lists[0].children].filter(x=>x.tagName.toUpperCase()==="LI");if(li.length!==lists[0].children.length||!li.length||li.some(x=>x.querySelector?.("ul,ol")))continue;const rows=li.map(x=>norm(x.textContent));if(rows.every(Boolean))found.push(rows);}
  else if(lists.length===0&&none.test(norm(el.textContent)))found.push([norm(el.textContent)]);
 }
 const unique=[...new Map(found.map(x=>[JSON.stringify(x),x])).values()];
 if(unique.length!==1)return {sectionStatus:"MISSING",sectionRows:[]};
 return {sectionStatus:unique[0].every(x=>none.test(x))?"EXPLICIT_NONE":"PRESENT",sectionRows:unique[0]};
}

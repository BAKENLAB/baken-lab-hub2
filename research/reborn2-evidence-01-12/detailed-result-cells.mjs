// Offline parser for normalized cell arrays; not a network client, not a production adapter. Real HTML header/colspan, exact race, identity and source timestamp validation must precede invocation. Incident names matched only within verified source roster. Test fixture is synthetic except named official incident phrase.
export function parseDetailedResultTable({headers,rows,expectedHorseNos,circuit}) {
 const clean=x=>String(x??"").normalize("NFKC").replace(/\s+/g," ").trim();
 if(!["JRA","LOCAL"].includes(circuit)||!Array.isArray(headers)||!Array.isArray(rows)||!Array.isArray(expectedHorseNos)||expectedHorseNos.length<1||expectedHorseNos.length>24||new Set(expectedHorseNos).size!==expectedHorseNos.length||expectedHorseNos.some(n=>!Number.isInteger(n)||n<1||n>24))throw Error("INVALID_TABLE");
 const head=headers.map(clean);
 const pick=(aliases,required=true)=>{const x=head.map((h,i)=>aliases.includes(h)?i:-1).filter(i=>i>=0);if(x.length>1||required&&x.length!==1)throw Error("HEADER_AMBIGUOUS_OR_MISSING");return x[0]??-1};
 const cols={no:pick(["馬番"]),name:pick(["馬名"]),finish:pick(["着順"]),time:pick(["タイム","走破タイム"]),margin:pick(["着差"]),f3:pick(["上り3F","上がり3F","上3F","推定上り","推定上がり"]),corners:pick(["コーナー通過順","通過順位","通過順"],false)};
 const seen=new Set();
 const result=rows.map(row=>{
  if(!Array.isArray(row)||row.length!==head.length)throw Error("ROW_WIDTH");
  const get=k=>cols[k]<0?"":clean(row[cols[k]]);
  const n=Number(get("no"));if(!/^\d{1,2}$/.test(get("no"))||!expectedHorseNos.includes(n)||seen.has(n)||!get("name"))throw Error("HORSE_NO_OR_NAME");
  seen.add(n);const rawFinish=get("finish");let finish=null,status=null;
  if(/^\d{1,2}$/.test(rawFinish)&&Number(rawFinish)>=1&&Number(rawFinish)<=expectedHorseNos.length){finish=Number(rawFinish);status="FINISHED"}
  else if(["中止","競走中止","取消","出走取消","除外","競走除外","失格"].includes(rawFinish)){status=rawFinish}
  else throw Error("FINISH_UNKNOWN");
  const rawTime=get("time"),rawF3=get("f3"),rawMargin=get("margin");
  let clock=null; if(finish!==null&&/^\d+:[0-5]\d\.\d$/.test(rawTime)){const [m,s]=rawTime.split(":");clock=Number(m)*60+Number(s)}
  const final3f=finish!==null&&/^\d{2}\.\d$/.test(rawF3)&&Number(rawF3)>0?Number(rawF3):null;
  const margin=finish!==null&&finish!==1&&/^(?:ハナ|アタマ|クビ|同着|大差|\d+(?:[ .]\d+\/\d+)?|\d+\/\d+)$/.test(rawMargin)?rawMargin:null;
  const cp=get("corners");const corners=/^\d{1,2}(?:[- ]\d{1,2}){0,7}$/.test(cp)?cp.split(/[- ]/).map(Number):null;
  return {horse_no:n,horse_name:get("name"),finish,status,elapsed_seconds:clock,final3f,final3f_kind:final3f===null?null:head[cols.f3].startsWith("推定")?"OFFICIAL_ESTIMATE":"OFFICIAL_REPORTED",margin_literal:margin,margin_basis:margin===null?null:"OFFICIAL_LITERAL_NOT_SECONDS",corner_positions:corners&&corners.every(x=>x>=1&&x<=expectedHorseNos.length)?corners:null}
 });
 if(seen.size!==expectedHorseNos.length)throw Error("INCOMPLETE_FIELD");
 const classified=result.filter(h=>h.finish!==null),winners=classified.filter(h=>h.finish===1);
 const usable=classified.length>0&&winners.length>=1&&classified.every(h=>h.elapsed_seconds!==null)&&winners.every(h=>h.elapsed_seconds===winners[0].elapsed_seconds)&&classified.every(h=>h.elapsed_seconds>=winners[0].elapsed_seconds);
 for(const h of result){h.rounded_clock_gap_to_winner_s=usable&&h.finish!==null?Math.round((h.elapsed_seconds-winners[0].elapsed_seconds)*10)/10:null;
 const nextRank=h.finish===null?null:Math.min(...classified.filter(x=>x.finish>h.finish).map(x=>x.finish));const next=classified.filter(x=>x.finish===nextRank);
 h.rounded_clock_gap_to_next_finisher_s=usable&&next.length>0&&next.every(x=>x.elapsed_seconds===next[0].elapsed_seconds)&&next[0].elapsed_seconds>=h.elapsed_seconds?Math.round((next[0].elapsed_seconds-h.elapsed_seconds)*10)/10:null}
 return {circuit,runners:result,status:"CANDIDATE_ONLY",limitations:["OFFICIAL_SOURCE_AND_IDENTITY_REQUIRED","CLOCK_DIFFERENCES_ROUNDED_NOT_MARGIN","NO_TARGET_RESULTS_OR_MARKET"]};
}
export function extractGateIncidentCandidates({lines,roster}) {
 if(!Array.isArray(lines)||!Array.isArray(roster)||roster.some(h=>typeof h.horse_name!=="string"||!h.horse_name||!Number.isInteger(h.horse_no))||new Set(roster.map(h=>h.horse_no)).size!==roster.length)throw Error("INCIDENT_INPUT");
 const clean=x=>String(x??"").normalize("NFKC").replace(/^[\s・*]+/,"").trim();
 const hits=[];
 for(const line of lines.map(clean)){const names=roster.filter(h=>line.startsWith(h.horse_name+"号は"));if(names.length!==1)continue;
 if(/号は[、,]?\s*発進不良\s*[〔【\[]出遅れ[〕】\]]/.test(line))hits.push({horse_no:names[0].horse_no,type:"REPORTED_LATE_START",status:"CANDIDATE_ONLY"});
 }
 return {events:hits,unreported_status:"UNKNOWN_NOT_NORMAL_START"};
}

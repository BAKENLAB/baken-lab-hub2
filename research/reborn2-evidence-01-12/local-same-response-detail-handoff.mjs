// Isolated same-response detail handoff. Caller must supply authenticated existing source reader, verified corner packet, and normalized table from SAME response; no fetching/writing here. Strict schema; unsupported DOM layouts remain unavailable.
export function attachDetailedCandidates({targetRace,priorRace,raw,cornerPacket,links,table,parseTable}){
 const iso=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 const norm=s=>String(s??"").normalize("NFKC").replace(/\s+/g," ").trim();
 const time=s=>typeof s==="string"&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
 const codes={"盛岡":"10","水沢":"11","浦和":"18","船橋":"19","大井":"20","川崎":"21","金沢":"22","笠松":"23","名古屋":"24","園田":"27","姫路":"28","高知":"31","佐賀":"32","門別":"36"};
 const parseRef=s=>{const m=/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=(\d{1,30})$/.exec(s??"");return m?.[1]??null};
 const sameRace=(a,b)=>a?.raceDate===b?.raceDate&&a?.track===b?.track&&a?.raceNo===b?.raceNo;
 if(!iso(targetRace?.raceDate)||!iso(priorRace?.raceDate)||priorRace.raceDate>=targetRace.raceDate||!Object.hasOwn(codes,priorRace.track)||!Number.isInteger(priorRace.raceNo)||priorRace.raceNo<1||priorRace.raceNo>12||typeof parseTable!=="function"||!Array.isArray(links)||!Array.isArray(targetRace.activeHorseNos)||new Set(targetRace.activeHorseNos).size!==targetRace.activeHorseNos.length||targetRace.activeHorseNos.some(n=>!Number.isInteger(n)||n<1||n>24))throw Error("INVALID_CONTEXT");
 const cutoff=time(targetRace.asOf),post=time(targetRace.postTime),checked=time(raw?.sourceCheckedAt);
 if(cutoff===null||post===null||checked===null||cutoff>=post||checked>cutoff||checked>=post)throw Error("ASOF_VIOLATION");
 const expectedUrl="https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode="+codes[priorRace.track]+"&k_raceDate="+priorRace.raceDate.replaceAll("-","%2F")+"&k_raceNo="+priorRace.raceNo;
 if(raw.sourceUrl!==expectedUrl||cornerPacket?.source_ref!==expectedUrl||cornerPacket?.source_checked_at!==raw.sourceCheckedAt||!sameRace({raceDate:cornerPacket.prior_race?.race_date,track:cornerPacket.prior_race?.track,raceNo:cornerPacket.prior_race?.race_no},priorRace)||cornerPacket.source!=="NAR_OFFICIAL_PAST_RACE_RESULT"||cornerPacket.future_result_included!==false||cornerPacket.market_used!==false)throw Error("SOURCE_BINDING");
 if(!Array.isArray(table?.expectedHorseNos)||!Array.isArray(raw.knownHorseNos)||table.expectedHorseNos.length!==raw.knownHorseNos.length||new Set(table.expectedHorseNos).size!==table.expectedHorseNos.length||table.expectedHorseNos.some(n=>!raw.knownHorseNos.includes(n))||!Array.isArray(table?.horseLinks)||table.horseLinks.length!==table.expectedHorseNos.length||new Set(table.horseLinks.map(x=>x.horseNo)).size!==table.expectedHorseNos.length||table.horseLinks.some(x=>!table.expectedHorseNos.includes(x.horseNo)))throw Error("FIELD_MISMATCH");
 const parsed=parseTable({headers:table.headers,rows:table.rows,expectedHorseNos:table.expectedHorseNos,circuit:"LOCAL"});
 if(parsed?.status!=="CANDIDATE_ONLY"||!Array.isArray(parsed.runners)||parsed.runners.length!==table.expectedHorseNos.length)throw Error("DETAIL_PARSER_CONTRACT");
 // Accept only race-level laps from the same response, with exact source/time/race keys,
 // explicit original distance grid and a matching winner clock from the detailed table.
 const lap=raw.officialRaceLaps;
 let raceLaps=null,lapDistance=null;
 if(lap?.status==="VERIFIED_RACE_LEVEL_LAPS"&&lap.sourceRef===expectedUrl&&lap.sourceCheckedAt===raw.sourceCheckedAt&&sameRace(lap.pastRace,priorRace)&&lap.finish_time_reconciled===true&&lap.individual_horse_sectionals===false&&lap.market_used===false&&lap.target_result_used===false&&Number.isInteger(lap.distance_m)&&lap.distance_m>=600&&lap.distance_m<=4000&&Array.isArray(lap.segments)&&lap.segments.length===Math.ceil(lap.distance_m/200)){
  const tick=v=>typeof v==="number"&&Number.isFinite(v)&&v>0&&Math.abs(v*10-Math.round(v*10))<1e-7?Math.round(v*10):null;
  const winners=parsed.runners.filter(x=>x.finish===1);
  const win=tick(lap.winner_time_seconds);
  let cumulative=0,at=0,ok=win!==null&&winners.length>0&&winners.every(x=>tick(x.elapsed_seconds)===win);
  for(const [i,s] of lap.segments.entries()){
   const d=i===0?lap.distance_m-200*(lap.segments.length-1):200;
   const t=tick(s.seconds);
   if(t===null||s.from_m!==at||s.distance_m!==d||s.to_m!==at+d){ok=false;break;}
   at+=d;cumulative+=t;
   if(tick(s.cumulative_seconds)!==cumulative){ok=false;break;}
  }
  if(ok&&at===lap.distance_m&&cumulative===win){raceLaps=lap.segments.map(s=>s.seconds);lapDistance=lap.distance_m;}
 }
 const ids=table.horseLinks.map(x=>parseRef(x.horseRef));
 if(ids.some(x=>!x)||new Set(ids).size!==ids.length)throw Error("RESULT_HORSE_LINKS");
 const byNo=new Map(parsed.runners.map(x=>[x.horse_no,x]));if(byNo.size!==table.expectedHorseNos.length||table.expectedHorseNos.some(n=>!byNo.has(n)))throw Error("DETAIL_FIELD_MISMATCH");
 const validNumber=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0?x:null;
 const out=[],rejections=[],seen=new Set();
 for(const link of links){
  if(!targetRace.activeHorseNos.includes(link.horseNo)||seen.has(link.horseNo))throw Error("CURRENT_ROSTER_MISMATCH");
  seen.add(link.horseNo);
  const detail=byNo.get(link.pastHorseNo),w=table.horseLinks.find(x=>x.horseNo===link.pastHorseNo),corner=cornerPacket.runners?.find(x=>x.prior_horse_no===link.pastHorseNo);
  const official=raw.officialFinishers?.find(x=>x.horseNo===link.pastHorseNo);
  if(link.identityVerifiedBy!=="OFFICIAL_HORSE_REF"||!detail||!w||!parseRef(link.horseRef)||parseRef(link.horseRef)!==parseRef(w.horseRef)||norm(link.horseName)!==norm(detail.horse_name)||norm(raw.officialHorseNames?.[String(link.pastHorseNo)])!==norm(detail.horse_name)||!official||official.officialHorseId!==parseRef(link.horseRef)||norm(official.horseName)!==norm(detail.horse_name)||official.finish!==detail.finish||corner?.evidence_status!=="OFFICIAL_CORNER_POSITIONS_VERIFIED"){
    rejections.push({current_no:link.horseNo,reason:"IDENTITY_OR_CORNER_UNCONFIRMED"});continue;
  }
  const corners=corner.corner_positions;
  if(!Array.isArray(corners)||!corners.length||corners.some(x=>!Number.isInteger(x.position)||x.position<1||x.position>24)||new Set(corners.map(x=>x.corner)).size!==corners.length){rejections.push({current_no:link.horseNo,reason:"CORNER_INCOMPLETE"});continue;}
  const elapsed=validNumber(detail.elapsed_seconds),final3f=validNumber(detail.final3f);
  out.push({current_no:link.horseNo,horse_ref:link.horseRef,prior_no:link.pastHorseNo,race_date:priorRace.raceDate,track:priorRace.track,race_no:priorRace.raceNo,finish:detail.finish,elapsed_seconds:elapsed>0?elapsed:null,final3f:final3f>0&&elapsed>final3f?final3f:null,final3f_kind:detail.final3f_kind??null,gap_winner:validNumber(detail.rounded_clock_gap_to_winner_s),gap_next:validNumber(detail.rounded_clock_gap_to_next_finisher_s),margin_literal:detail.margin_literal??null,corners:corners.slice().sort((a,b)=>a.corner-b.corner).map(x=>x.position),race_laps:raceLaps===null?null:raceLaps.slice(),distance:lapDistance,lap_scope:raceLaps===null?null:"RACE_LEVEL_ONLY",source_ref:expectedUrl,source_checked_at:raw.sourceCheckedAt,as_of:targetRace.asOf,status:"RESEARCH_CANDIDATE_ONLY"});
 }
 return {status:"RESEARCH_ONLY",records:out,rejections,source_ref:expectedUrl,scoring_authorized:false,individual_sectionals:false};
}
export function extractDetailTableFromDom($,expectedHorseNos){
 const clean=x=>String(x??"").normalize("NFKC").replace(/\s+/g," ").trim();
 if(typeof $!=="function"||!Array.isArray(expectedHorseNos)||expectedHorseNos.length<1||expectedHorseNos.length>24||new Set(expectedHorseNos).size!==expectedHorseNos.length)throw Error("INVALID_DOM");
 const matches=[];
 $("table").each((_,table)=>{
  const trs=$(table).find("tr").toArray();
  const candidates=trs.map((tr,i)=>({i,cells:$(tr).children("th,td").toArray()})).filter(x=>{const h=x.cells.map(c=>clean($(c).text()));return h.includes("着順")&&h.includes("馬番")&&h.includes("馬名")&&h.some(v=>["タイム","走破タイム"].includes(v));});
  if(candidates.length===0)return;
  if(candidates.length!==1)throw Error("AMBIGUOUS_RESULT_HEADER");
  const hd=candidates[0];const badSpan=c=>["rowspan","colspan"].some(k=>{const v=$(c).attr(k);return v!==undefined&&v!=="1";});
  if(hd.cells.some(badSpan))throw Error("UNSUPPORTED_HEADER_SPAN");
  const headers=hd.cells.map(c=>clean($(c).text()));
  const ni=headers.indexOf("馬番"),hi=headers.indexOf("馬名"),fi=headers.indexOf("着順");
  const rows=[],horseLinks=[];
  for(const tr of trs.slice(hd.i+1)){
   const cells=$(tr).children("th,td").toArray();
   if(!cells.length)continue;
   if(cells.length!==headers.length||cells.some(badSpan))throw Error("UNSUPPORTED_RESULT_ROW");
   const row=cells.map(c=>clean($(c).text()));
   if(!/^\d{1,2}$/.test(row[ni])||!row[fi])throw Error("UNRECOGNIZED_RESULT_ROW");
   const no=Number(row[ni]);if(!expectedHorseNos.includes(no))throw Error("UNKNOWN_HORSE");
   const refs=$(cells[hi]).find("a[href]").toArray().map(a=>$(a).attr("href")).map(h=>typeof h==="string"&&h.startsWith("/KeibaWeb/")?"https://www.keiba.go.jp"+h:h).filter(h=>/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=\d{1,30}$/.test(h??""));
   if(refs.length!==1)throw Error("HORSE_CELL_LINK_UNVERIFIED");
   rows.push(row);horseLinks.push({horseNo:no,horseRef:refs[0]});
  }
  matches.push({headers,rows,horseLinks,expectedHorseNos:expectedHorseNos.slice()});
 });
 if(matches.length!==1)throw Error("DETAIL_TABLE_UNAVAILABLE");
 return matches[0];
}

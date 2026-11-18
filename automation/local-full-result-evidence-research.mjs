/** LOCAL research only. No network, database, market data, prediction or production integration.
 * The HTML reader accepts an injected Cheerio-compatible load function. The normalizer
 * was tested against manually transcribed public official table cells, not live HTML.
 * PROSPECTIVE observes before cutoff; RECONSTRUCTED is never as-of evidence.
 * Official result links are evidence candidates, not independent identity verification.
 */
export function normalizeNarPastResult(input) {
 const fail=code=>{throw Error(code)};
 const clean=x=>String(x??"").normalize("NFKC").replace(/\s+/g,"").trim();
 const label=x=>clean(x).replace(/\s+/g,"");
 const date=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+"T00:00:00Z"))&&new Date(x+"T00:00:00Z").toISOString().slice(0,10)===x;
 const stamp=x=>typeof x==="string"&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
 const codes={"盛岡":"10","水沢":"11","浦和":"18","船橋":"19","大井":"20","川崎":"21","金沢":"22","笠松":"23","名古屋":"24","園田":"27","姫路":"28","高知":"31","佐賀":"32","門別":"36"};
 const {priorRace:r,targetDate,cutoff,observedAt,sourceUrl,heading,headers,rows,expectedRosterCount=null,mode="PROSPECTIVE"}=input??{};
 if(!r||!date(r.raceDate)||!date(targetDate)||r.raceDate>=targetDate||!codes[r.track]||!Number.isInteger(r.raceNo)||r.raceNo<1||r.raceNo>14)fail("INVALID_PAST_RACE");
 const ob=stamp(observedAt),cu=stamp(cutoff);
 if(ob===null||cu===null||!["PROSPECTIVE","RECONSTRUCTED"].includes(mode))fail("INVALID_OBSERVATION_BOUNDARY");
 if(mode==="PROSPECTIVE"&&ob>=cu)fail("AFTER_CUTOFF");
 if(ob<Date.parse(r.raceDate+"T00:00:00+09:00")||cu<Date.parse(targetDate+"T00:00:00+09:00")||cu>=Date.parse(targetDate+"T00:00:00+09:00")+86400000)fail("INVALID_DATE_BOUNDARY");
 const u=String(sourceUrl??"").match(/^https:\/\/(?:www|sp)\.keiba\.go\.jp\/KeibaWeb\/TodayRaceInfo\/RaceMarkTable\?([^#]+)$/);
 if(!u)fail("INVALID_SOURCE");
 let params={};try{for(const p of u[1].split("&")){let a=p.split("=");if(a.length!==2||!["k_babaCode","k_raceDate","k_raceNo"].includes(a[0])||Object.hasOwn(params,a[0]))fail("INVALID_SOURCE");params[a[0]]=decodeURIComponent(a[1])}}catch{fail("INVALID_SOURCE")}
 if(Object.keys(params).length!==3||params.k_babaCode!==codes[r.track]||params.k_raceDate!==r.raceDate.replaceAll("-","/")||params.k_raceNo!==String(r.raceNo))fail("SOURCE_RACE_MISMATCH");
 const h=label(heading),ymd=r.raceDate.split("-").map(Number);
 if(!h.includes(`${ymd[0]}年${ymd[1]}月${ymd[2]}日`)||!h.includes(r.track)||!h.includes(`第${r.raceNo}競走`)||!h.includes("競走成績"))fail("HEADER_RACE_MISMATCH");
 if(!Array.isArray(headers)||!Array.isArray(rows)||rows.length<2||rows.length>24)fail("INVALID_TABLE");
 const labels=headers.map(label);
 const find=(names,required=true)=>{const hits=labels.flatMap((s,i)=>names.includes(s)?[i]:[]);if(hits.length>1||(required&&hits.length!==1))fail("AMBIGUOUS_HEADER");return hits[0]??-1;};
 const i={finish:find(["着順"]),no:find(["馬番"]),name:find(["馬名"]),time:find(["タイム","走破タイム"]),margin:find(["着差"],false),f3:find(["上がり3F","上り3F"],false),pos:find(["コーナー通過順","通過順"],false)};
 const num=x=>/^\d+$/.test(clean(x))?Number(clean(x)):null;
 const tenth=x=>{const m=clean(x).match(/^(\d+):([0-5]\d)\.(\d)$/);return m?+m[1]*600+ +m[2]*10+ +m[3]:null};
 const idOf=x=>String(x??"").match(/^(?:https:\/\/www\.keiba\.go\.jp)?\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=(\d{1,30})(?:&k_activeCode=\d+)?$/)?.[1]??null;
 const seenNo=new Set(),seenIds=new Set();
 const records=rows.map(x=>{if(!Array.isArray(x?.cells)||x.cells.length!==headers.length)fail("ROW_WIDTH_MISMATCH");const v=k=>i[k]<0?"":clean(x.cells[i[k]]);const no=num(v("no")),name=v("name"),finish=num(v("finish"));if(no===null||no<1||no>24||!name||seenNo.has(no))fail("INVALID_OR_DUPLICATE_HORSE");seenNo.add(no);
 const state=finish!==null&&finish>0&&finish<=24?"FINISHED":({"取消":"CANCELLED","除外":"EXCLUDED","中止":"DNF","失格":"DQ"}[v("finish")]??null);if(!state)fail("UNKNOWN_FINISH_STATUS");
 const officialId=idOf(x.horseRef);if(officialId&&seenIds.has(officialId))fail("DUPLICATE_OFFICIAL_ID");if(officialId)seenIds.add(officialId);
 const time=state==="FINISHED"?tenth(v("time")):null;
 const f3=state==="FINISHED"&&/^\d{2}\.\d$/.test(v("f3"))&&+v("f3")>=25&&+v("f3")<=80?+v("f3"):null;
 const p=v("pos");const corners=state==="FINISHED"&&/^\d{1,2}(?:-\d{1,2}){0,3}$/.test(p)&&p.split("-").every(s=>+s>=1&&+s<=24)?p.split("-").map(Number):null;
 return {horse_no:no,horse_name:name,official_horse_id:officialId,identity_status:officialId?"OFFICIAL_RESULT_LINK_PRESENT":"ID_UNAVAILABLE",status:state,finish:state==="FINISHED"?finish:null,time_tenths:time,margin_text:state==="FINISHED"?v("margin")||null:null,final3f:f3,corner_positions:corners};});
 const starters=records.filter(x=>!["CANCELLED","EXCLUDED"].includes(x.status)).length;
 for(const x of records){if(x.finish!==null&&x.finish>starters)fail("FINISH_OUT_OF_RANGE");if(x.corner_positions?.some(p=>p>starters))x.corner_positions=null;}
 const winners=records.filter(x=>x.finish===1);if(!winners.length)fail("WINNER_MISSING");
 const winnerTime=winners.every(x=>x.time_tenths!==null&&x.time_tenths===winners[0].time_tenths)?winners[0].time_tenths:null;
 for(const x of records){x.winner_gap_seconds=x.time_tenths!==null&&winnerTime!==null&&x.time_tenths>=winnerTime?(x.time_tenths-winnerTime)/10:null;x.early_pos=x.corner_positions?.[0]??null;x.final_turn_pos=x.corner_positions?.at(-1)??null;}
 if(expectedRosterCount!==null&&(!Number.isInteger(expectedRosterCount)||expectedRosterCount<2||expectedRosterCount>24))fail("INVALID_EXPECTED_ROSTER");
 const complete=expectedRosterCount!==null&&records.length===expectedRosterCount;
 return {schema:"LOCAL_FULL_PAST_RESULT_RESEARCH_V1",priorRace:{raceDate:r.raceDate,track:r.track,raceNo:r.raceNo},targetDate,cutoff,observedAt,sourceUrl,source_timing:mode==="PROSPECTIVE"?"OBSERVED_BEFORE_CUTOFF":"RECONSTRUCTED_NOT_ASOF",roster_status:complete?"COUNT_MATCHED":"UNVERIFIED_OR_PARTIAL",rank_authorized:false,market_used:false,coverage:{rows:records.length,finishers:records.filter(x=>x.status==="FINISHED").length,ids:records.filter(x=>x.official_horse_id).length,times:records.filter(x=>x.time_tenths!==null).length,gaps:records.filter(x=>x.winner_gap_seconds!==null).length,final3f:records.filter(x=>x.final3f!==null).length,corners:records.filter(x=>x.corner_positions!==null).length},records};
}

export function extractNarResultTable(html,load){
 if(typeof html!=="string"||html.length<60||html.length>524288||typeof load!=="function")throw Error("INVALID_HTML_INPUT");
 const $=load(html),clean=x=>String(x??"").normalize("NFKC").replace(/\s+/g,"").trim();
 const body=clean($("body").text());
 const h=body.match(/\d{4}年\s*\d{1,2}月\s*\d{1,2}日[\s\S]{0,180}?第\s*\d+\s*競走[\s\S]{0,80}?競走成績/);
 if(!h)throw Error("RESULT_HEADER_MISSING");
 const matches=[];
 $("table").each((_,table)=>{
  const r=$(table).children("thead,tbody,tfoot").children("tr").add($(table).children("tr")).toArray();
  const heads=r.map(el=>$(el).children("th").map((_,e)=>clean($(e).text())).get());
  const candidates=heads.flatMap((a,j)=>["着順","馬番","馬名"].every(k=>a.includes(k))?[j]:[]);
  if(candidates.length!==1)return;
  const at=candidates[0],headers=heads[at],nameAt=headers.indexOf("馬名"),noAt=headers.indexOf("馬番"),finishAt=headers.indexOf("着順");
  const rows=[];
  for(const el of r.slice(at+1)){
   const cells=$(el).children("td").toArray();
   if(!cells.length)continue;
   const values=cells.map(c=>clean($(c).text()));
   if(!/^\d{1,2}$/.test(values[noAt]??"")&&!/取消|除外|中止|失格/.test(values[finishAt]??""))continue;
   const links=$(cells[nameAt]).find("a[href]").map((_,a)=>$(a).attr("href")).get().filter(v=>/\/KeibaWeb\/DataRoom\/HorseMarkInfo\?/.test(v));
   rows.push({cells:values,horseRef:links.length===1?links[0]:null});
  }
  matches.push({headers,rows});
 });
 if(matches.length!==1)throw Error("RESULT_TABLE_AMBIGUOUS");
 return {heading:h[0],...matches[0]};
}

export function summarizeOpponentFollowup({packet,currentHorseId,historyRows,expectedPeerIds=null}){
 if(packet?.schema!=="LOCAL_FULL_PAST_RESULT_RESEARCH_V1"||!Array.isArray(packet.records)||packet.source_timing!=="OBSERVED_BEFORE_CUTOFF"||packet.roster_status!=="COUNT_MATCHED"||!/^\d{1,30}$/.test(currentHorseId??"")||!Array.isArray(historyRows))throw Error("UNVERIFIED_PAST_PACKET");
 const own=packet.records.filter(r=>r.official_horse_id===currentHorseId&&r.status==="FINISHED");
 if(own.length!==1)throw Error("CURRENT_ID_NOT_IN_PAST_RACE");
 const peers=packet.records.filter(r=>r.finish!==null&&r.finish<=3&&r.official_horse_id!==currentHorseId);
 const evidence=[],seen=new Set(),covered=new Set();
 for(const p of peers){if(!p.official_horse_id)continue;
 for(const h of historyRows){if(h?.official_horse_id!==p.official_horse_id||h.source!=="NAR_OFFICIAL_HORSE_HISTORY"||!Number.isInteger(h.finish)||h.finish<1||h.finish>24||!Number.isInteger(h.race_no)||h.race_no<1||h.race_no>14||typeof h.track!=="string"||!h.track||!/^\d{4}-\d{2}-\d{2}$/.test(h.race_date??"")||h.race_date<=packet.priorRace.raceDate||h.race_date>=packet.targetDate||!Number.isFinite(Date.parse(h.observed_at))||Date.parse(h.observed_at)>=Date.parse(packet.cutoff)||Date.parse(h.observed_at)<Date.parse(h.race_date+"T00:00:00+09:00"))continue;
 const expected=`https://www.keiba.go.jp/KeibaWeb/DataRoom/HorseMarkInfo?k_lineageLoginCode=${p.official_horse_id}`;
 if(h.source_ref!==expected)continue;
 const key=JSON.stringify([p.official_horse_id,h.race_date,h.track,h.race_no]);if(seen.has(key))continue;seen.add(key);covered.add(p.official_horse_id);
 evidence.push({official_horse_id:p.official_horse_id,prior_finish:p.finish,followup_race_date:h.race_date,track:h.track,race_no:h.race_no,finish:h.finish,source_ref:h.source_ref,observed_at:h.observed_at});
 }}
 return {status:peers.length&&covered.size===peers.length?"ALL_PEERS_HAVE_OBSERVATION":"PARTIAL_OR_MISSING",peer_count:peers.length,peer_id_count:peers.filter(p=>p.official_horse_id).length,observed_peer_count:covered.size,winning_peer_count:new Set(evidence.filter(e=>e.finish===1).map(e=>e.official_horse_id)).size,evidence,rank_authorized:false};
}

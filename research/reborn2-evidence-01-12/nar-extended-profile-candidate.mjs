// Isolated offline variant of existing NAR HorseMarkInfo normalized-row reader. No acquisition, no network, no live readiness. Retains every eligible row in a bounded, verified input (max 500 total rows); never silently caps at five or asserts lifetime completeness. Profile gap is not literal result-table margin.
export function parseExtendedNarProfile({profile,current,targetDate,asOf}) {
 const clean=v=>String(v??"").normalize("NFKC").replace(/\s+/g," ").trim();
 const header=["年月日","競馬場","R","競走名","格組","距離","天候・馬場","頭数","枠","馬番","人気","着順","タイム","差","上3F","体重","騎手(所属)","重量","調教師","収得賞金","1着馬または(2着馬)"];
 const iso=x=>typeof x==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
 const ref=current?.horse_link_evidence?.horse_ref;
 if(!iso(targetDate)||!Number.isFinite(Date.parse(asOf))||!ref||!/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=\d{1,30}$/.test(ref)||current.horse_link_evidence.horse_no!==current.horse_no||!current.identity_refs?.includes(ref)||profile?.url!==ref||profile?.ok!==true||profile?.diagnostic_only!==true||profile?.truncated!==false||!Array.isArray(profile.rows)||profile.rows.length>500||!Number.isFinite(Date.parse(profile.fetched_at))||Date.parse(profile.fetched_at)>Date.parse(asOf))throw Error("PROFILE_UNVERIFIED");
 const lead=clean(profile.body).split("年月日")[0];if(!lead.includes(clean(current.horse_name)+" ")||!/(?:牡|牝|セ|セン|騸)\d+\s+(?:現役|抹消)/.test(lead))throw Error("PROFILE_IDENTITY");
 const headers=profile.rows.map((r,i)=>Array.isArray(r.cells)&&r.cells.map(clean).join("|")===header.join("|")?i:-1).filter(x=>x>=0);if(headers.length!==1)throw Error("PROFILE_HEADER");
 const local=new Set(["門別","盛岡","水沢","浦和","船橋","大井","川崎","金沢","笠松","名古屋","園田","姫路","高知","佐賀"]);
 const central=new Set(["札幌","函館","福島","新潟","東京","中山","中京","京都","阪神","小倉"]);
 const runs=[],keys=new Set();let futureExcluded=0,unsupported=0;
 const dec=v=>/^\d+(?:\.\d+)?$/.test(v)?Number(v):null;
 for(const row of profile.rows.slice(headers[0]+1)){
  if(!Array.isArray(row.cells))throw Error("PROFILE_ROW");const c=row.cells.map(clean);
  if(!/^\d{4}\/\d{2}\/\d{2}$/.test(c[0]??""))continue;
  if(c.length!==23)throw Error("PROFILE_ROW_WIDTH");
  const date=c[0].replaceAll("/","-");if(!iso(date))throw Error("PROFILE_DATE");if(date>=targetDate){futureExcluded++;continue}
  const jra=c[1].startsWith("J"),track=jra?c[1].slice(1):c[1];if(!(jra?central:local).has(track)){unsupported++;continue}
  const raceNo=Number(c[2]),horseNo=Number(c[11]);if(!/^\d+$/.test(c[2])||!Number.isInteger(raceNo)||raceNo<1||raceNo>12||!/^\d+$/.test(c[11])||!Number.isInteger(horseNo)||horseNo<1||horseNo>24)throw Error("PROFILE_RACE_KEY");
  const key=JSON.stringify([date,track,raceNo]);if(keys.has(key))throw Error("PROFILE_DUPLICATE");keys.add(key);
  const finish=/^\d+$/.test(c[13])&&Number(c[13])>=1&&Number(c[13])<=24?Number(c[13]):null;
  const dist=/^(?:芝)?(\d{3,4})$/.exec(c[5]);const gap=finish===null?null:dec(c[15]);
  runs.push({race_date:date,track,race_no:raceNo,horse_no:horseNo,horse_name:current.horse_name,horse_ref:ref,race_name:c[3],class_raw:c[4]||null,distance:dist?Number(dist[1]):null,surface:c[5].startsWith("芝")?"芝":null,going:c[7]||null,finish,finish_literal:c[13]||null,time_raw:finish===null?null:c[14]||null,profile_gap_seconds:gap,profile_gap_basis:gap===null?null:finish===1?"WINNER_TO_SECOND":"HORSE_TO_WINNER",final3f:finish===null?null:dec(c[16]),source_ref:ref,fetched_at:profile.fetched_at,status:"PROFILE_CANDIDATE_ONLY"});
 }
 runs.sort((a,b)=>b.race_date.localeCompare(a.race_date)||a.track.localeCompare(b.track)||b.race_no-a.race_no);
 return {status:"RESEARCH_ONLY",runs,returned_rows:runs.length,futureExcluded,unsupported,history_complete:false,scoring_authorized:false};
}

// Research only. NAR manual 2026-05-21 pages 3–5. Input decoded CSV data rows, no header guessing, no networking, no writes. Synthetic tests only. Source/identity and published-at proof required before use.
export function parseCsv(text) {
  if(typeof text!=="string" || text.length>25000000) throw Error("CSV_SIZE");
  const out=[];let row=[],cell="",quoted=false,closed=false;
  const push=()=>{row.push(cell);cell="";closed=false};
  const line=()=>{push();if(row.some(v=>v!==""))out.push(row);row=[]};
  for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true}}else cell+=c;continue}
  if(c===',' ){push();continue}if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;line();continue}
  if(c==='"'&&!cell&&!closed){quoted=true;continue}if(closed||c==='"')throw Error("CSV_QUOTE");if(i===0&&c==='\uFEFF')continue;cell+=c}
  if(quoted)throw Error("CSV_UNCLOSED");if(row.length||cell||closed)line();return out;
}
export function normalizeNarRows(race,horse,targetDate) {
 const clean=v=>String(v??"").normalize("NFKC").trim();
 const iso=v=>{if(!/^\d{8}$/.test(v))throw Error("DATE");let d=v.slice(0,4)+"-"+v.slice(4,6)+"-"+v.slice(6);if(!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error("DATE");return d};
 const integer=(v,min,max)=>{if(!/^\d+$/.test(v)||Number(v)<min||Number(v)>max)throw Error("INTEGER");return Number(v)};
 const decimal=v=>v===""?null:/^\d+(?:\.\d+)?$/.test(v)&&Number(v)>0?Number(v):null;
 if(!Array.isArray(race)||race.length!==66||!Array.isArray(horse)||horse.length!==36)throw Error("SCHEMA_LENGTH");
 const r=race.map(clean),h=horse.map(clean);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)||iso(targetDate.replaceAll("-",""))!==targetDate)throw Error("TARGET_DATE");
 const date=iso(r[1]);if(date>=targetDate)throw Error("ASOF_DATE");
 if(r[0]!==h[0]||r[1]!==h[1]||r[2]!==h[2]||!r[0]||r[0]==="帯広ば"||!["芝","ダート"].includes(r[21]))throw Error("RACE_ID");
 const horseNo=integer(h[5],1,24),distance=integer(r[23],600,4000),fieldSize=integer(r[26],1,24);if(!h[6]||!h[10]||!h[11]||!h[12])throw Error("IDENTITY_MISSING");
 const birth=iso(h[10]);if(birth>=date)throw Error("BIRTH_DATE");
 const finish=/^\d+$/.test(h[31])?integer(h[31],1,fieldSize):null;
 const t=h[32];let elapsed=null;
 if(finish!==null&&/^\d{1,2}[0-5]\d\d$/.test(t))elapsed=Number(t.slice(0,-3))*60+Number(t.slice(-3))/10;
 const f3=finish===null?null:decimal(h[34]);
 const rawLaps=r.slice(35,50),filled=rawLaps.filter(Boolean);
 const lapValues=filled.map(decimal);const laps=filled.length===Math.ceil(distance/200)&&rawLaps.slice(0,filled.length).every(Boolean)&&lapValues.every(v=>v!==null)?lapValues:null;
 const corners=[];for(let i=0;i<8;i++){let label=r[50+i],order=r[58+i];if(Boolean(label)!==Boolean(order))throw Error("CORNER_PAIR");if(label)corners.push({label,raw_order:order})}
 return {race:{track:r[0],date,race_no:integer(r[2],1,14),surface:r[21],distance,going:r[25]||null,class_name:r[4]||null,field_size:fieldSize,race_laps_candidate:laps,corner_orders_candidate:corners},horse:{horse_no:horseNo,horse_name:h[6],birth_date:birth,sire:h[11],dam:h[12],finish,elapsed_seconds:elapsed,margin_literal:finish===null||finish===1?null:h[33]||null,final3f:f3},status:"CANDIDATE_ONLY",limitations:["SOURCE_FILE_AND_ASOF_NOT_VERIFIED","OFFICIAL_HORSE_IDENTITY_NOT_VERIFIED","RACE_LAP_WINNER_CLOCK_NOT_RECONCILED","CORNER_GROUPS_NOT_PARSED"]};
}

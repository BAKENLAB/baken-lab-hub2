// Development-only server reader, extracted from production v28 verified field parser.
// Reuse deployed draw/cancellation helpers via explicit dependencies. No writes.
export function createOfficialJumpReader({load,readOfficialDraw,cancellationReader,fetcher=fetch,subtle=crypto.subtle}){
 if([load,readOfficialDraw,cancellationReader,fetcher].some(x=>typeof x!=='function')||!subtle)throw Error("JUMP_OFFICIAL_DEPENDENCIES");
 return async function officialReader({race_date,track,race_no,cname}){
 if(!/^pw01dde\d+\/[A-F0-9]{2}$/i.test(cname??""))throw Error("JUMP_OFFICIAL_CNAME");
      const response=await fetcher("https://www.jra.go.jp/JRADB/accessD.html?CNAME="+encodeURIComponent(cname),{
       headers:{"User-Agent":"Mozilla/5.0 (Linux; Android 16; Mobile) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36",
         "Accept-Language":"ja-JP,ja;q=0.9","Cache-Control":"no-cache"},redirect:"error"
     });
     if(!response.ok)throw Error("JRA_OFFICIAL_HTTP_"+response.status);
     const bytes=new Uint8Array(await response.arrayBuffer());
     const html=new TextDecoder("shift_jis").decode(bytes);
     const $=load(html);
     const clean=(value)=>String(value??"").normalize("NFKC").replace(/\s+/g," ").trim();
     const dateText=clean($(".race_header .date_line .cell.date").first().text());
     const dateParts=dateText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
     const cardDate=dateParts
       ? [dateParts[1],dateParts[2].padStart(2,"0"),dateParts[3].padStart(2,"0")].join("-")
       : null;
     const mainRaceNumber=$(".race_title .race_number img").first().attr("src")??"";
     if(cardDate!==race_date||!mainRaceNumber.endsWith("/race_num_"+race_no+".png")){
       throw Error("JRA_CARD_DATE_OR_RACE_NO_MISMATCH");
     }
     const table=$("#syutsuba table.basic.narrow-xy").first();
     const tableRows=table.find("tbody tr").toArray();
     if(!table.length||!tableRows.length)throw Error("JRA_OFFICIAL_FIELD_NOT_PRESENT");
     const title=clean(table.find(".race_title .race_name").first().text());
     const course=clean(table.find(".race_title .cell.course").first().text());
     const time=clean(table.find(".race_header .cell.time strong").first().text());
     const timeMatch=time.match(/(\d{1,2})時(\d{2})分/);
     const distanceMatch=course.replace(/,/g,"").match(/(\d{3,4})メートル/);
     const header=clean(table.find(".race_title").first().text());
     const surface=/(障害|J[・.･]?G[ⅠⅡⅢI123])/i.test(header+" "+title+" "+course)?"障害":null;
     // No inference from distance or live race type. Ambiguous official header fails closed.
     if(!timeMatch||!distanceMatch||surface!=="障害"||!title){
       throw Error("JRA_CARD_HEADER_INCOMPLETE_OR_OBSTACLE");
     }
     const hh=Number(timeMatch[1]),mm=Number(timeMatch[2]);
     if(hh<8||hh>19||mm>59)throw Error("JRA_INVALID_POST_TIME");
     const postTime=race_date+"T"+String(hh).padStart(2,"0")+":"+String(mm).padStart(2,"0")+":00+09:00";
     const runners=[];
     let waiting=0;
     const frameState={frame:null,remaining:0};
     for(const row of tableRows){
       const rowObj=$(row);
       let horseNoStr=clean(rowObj.find("td.num").first().text());
       const horseName=clean(rowObj.find("td.horse .name_line .name a[href*='accessU']").first().text());
       if(horseNoStr==="取消"&&horseName){
         horseNoStr=String(await cancellationReader(load,{date:race_date,track,raceNo:race_no,horseName}));
       }
       if(!horseNoStr && horseName){waiting++;continue;}
       if(!/^\d{1,2}$/.test(horseNoStr)||!horseName){throw Error("JRA_CARD_PARTIAL_NUMBER_OR_NAME");}
       const horseNo=Number(horseNoStr);
       const frameCell=rowObj.children("td.waku").first();
       const draw=readOfficialDraw(frameCell.length?{text:clean(frameCell.text()),src:frameCell.find("img").first().attr("src"),rowspan:frameCell.attr("rowspan")}:null,frameState,horseNo);
       const statusCells=clean(rowObj.find("td.num,td.horse .name_line,td.jockey").text());
       const flags=[/取消/.test(statusCells),/除外/.test(statusCells)];
       if(flags[0]&&flags[1])throw Error("JRA_AMBIGUOUS_STATUS_"+horseNo);
       const status=flags[0]?"CANCELLED":flags[1]?"EXCLUDED":"ACTIVE";
       const rowClass=clean(rowObj.attr("class"));
       if(/cancel|scratched|except|withdraw/i.test(rowClass) && status==="ACTIVE"){
         throw Error("JRA_UNRECOGNIZED_STATUS_CLASS_"+horseNo);
       }
       const jockey=clean(rowObj.find("td.jockey p.jockey").first().text());
       const weightText=clean(rowObj.find("td.jockey p.weight").first().text());
       const weightMatch=weightText.match(/(\d{2}(?:\.\d)?)\s*kg/i);
       const weight=weightMatch?Number(weightMatch[1]):null;
       if(status==="ACTIVE"&&(!jockey||weight===null||weight<45||weight>70)){
         throw Error("JRA_ACTIVE_ENTRY_DETAIL_INCOMPLETE_"+horseNo);
       }
       runners.push({horse_no:horseNo,horse_name:horseName,draw,
         status,jockey:jockey||null,weight_carried:weight});
     }
     if(waiting>0){
       throw Error("JUMP_WAIT_OFFICIAL_HORSE_NUMBERS");
     }
     if(frameState.remaining!==0)throw Error("JRA_DRAW_ROWSPAN_INCOMPLETE");
     if(runners.length!==tableRows.length||runners.length<5||new Set(runners.map(x=>x.horse_no)).size!==runners.length){
       throw Error("JRA_FIELD_COUNT_OR_UNIQUE_NUMBERS_INVALID");
     }
     const digest=new Uint8Array(await subtle.digest("SHA-256",bytes));
     const hash=Array.from(digest,x=>x.toString(16).padStart(2,"0")).join("");
     const proof={
       race_date,track,race_no,cname,race_name:title,post_time:postTime,
       checked_at:new Date().toISOString(),html_sha256:hash,html_bytes:bytes.length,
       verification_basis:"JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1",all_rows_reviewed:true,
       race:{race_type:"障害",surface,distance:Number(distanceMatch[1])},runners
     };

     if(runners.filter(x=>x.status==="ACTIVE").length<5)throw Error("JUMP_ACTIVE_COUNT");
     return proof;
 };
}

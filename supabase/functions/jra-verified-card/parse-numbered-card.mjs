/**
 * Staging-only strict parser for a FRESH current JRA numbered race card.
 * Uses the same Cheerio structure as deployed jra-live v26, but does NOT
 * synthesize draw from horse number and NEVER substitutes guessed ACTIVE status.
 * Fail closed on missing numbered fields, ambiguous marks, or mismatched rows.
 * IMPORTANT: Must be integrated with current-source fetch + full-proof guard;
 * this file alone must not be deployed or be used to publish official_races.
 */
export function parseNumberedJraCard({html,load,expectedRace}) {
  if(typeof html!=="string"||!html||typeof load!=="function"||!expectedRace)throw Error("JRA_CARD_MISSING");
  const $=load(html);
  const clean=x=>String(x??"").normalize("NFKC").replace(/\s+/g," ").trim();
  const fullText=clean($("body").text());
  const date=String(expectedRace.race_date);
  const [year,month,day]=date.split("-");
  if(!new RegExp(year+"年"+Number(month)+"月"+Number(day)+"日").test(fullText))throw Error("JRA_OFFICIAL_CARD_DATE_UNVERIFIED");
  const track=clean(expectedRace.track);
  const titleArea=clean($(".race_header").first().text()+" "+$(".race_title").first().text());
  if(!titleArea.includes(track))throw Error("JRA_OFFICIAL_CARD_TRACK_UNVERIFIED");
  const heading=clean($(".race_name").first().text());
  if(!heading||heading!==clean(expectedRace.race_name))throw Error("JRA_OFFICIAL_RACE_NAME_MISMATCH");
  const course=clean($(".race_title .cell.course").first().text());
  if(!course)throw Error("JRA_OFFICIAL_COURSE_NOT_FOUND");
  const surface=course.includes("ダート")?"ダート":course.includes("芝")?"芝":null;
  const distance=Number(course.replaceAll(",","").match(/(\d{3,4})\s*メートル/)?.[1]);
  if(!["芝","ダート"].includes(surface)||!distance||
    surface!==expectedRace.surface||distance!==Number(expectedRace.distance)||
    heading.includes("障害")||course.includes("障害"))throw Error("JRA_OFFICIAL_COURSE_MISMATCH_OR_OBSTACLE");
  const postMatch=fullText.match(/発走時刻[:：]?\s*(\d{1,2})時(\d{2})分/);
  if(!postMatch)throw Error("JRA_OFFICIAL_POST_TIME_UNVERIFIED");
  const hr=Number(postMatch[1]),mi=Number(postMatch[2]);
  if(hr>23||mi>59)throw Error("JRA_OFFICIAL_POST_TIME_INVALID");
  const post_time=date+"T"+String(hr).padStart(2,"0")+":"+String(mi).padStart(2,"0")+":00+09:00";
  if(postMatch[0]!==undefined && clean(expectedRace.post_time)!==clean(hr+"時"+String(mi).padStart(2,"0")+"分"))throw Error("JRA_OFFICIAL_POST_TIME_MISMATCH");
  const rows=[];
  const table=$("table.basic.narrow-xy").first();
  if(!table.length)throw Error("JRA_NUMBERED_FIELD_TABLE_NOT_FOUND");
  let activeFrame=null,frameRowsRemaining=0;
  table.find("tbody tr").each((_i,row)=>{
    const current=$(row);
    const horseCell=current.children("td.horse").first();
    const horseLink=horseCell.find("a[href*='accessU']").first();
    if(!horseLink.length)return;
    const horse_name=clean(horseLink.text());
    if(!horse_name)throw Error("JRA_OFFICIAL_HORSE_NAME_MISSING");
    // Horse number must be explicitly printed in the CURRENT row.
    const n=clean(current.children("td.num").first().text());
    if(!/^\d{1,2}$/.test(n))throw Error("JRA_CURRENT_HORSE_NUMBER_NOT_PUBLISHED");
    const horse_no=Number(n);
    // Read draw ONLY from the current official numbered table, supporting
    // HTML rowspan for shared frames. No mathematical horse-no fallback.
    const frameCell=current.children("td.waku").first();
    let frame;
    if(frameCell.length){
      const f=clean(frameCell.text());
      if(!/^[1-8]$/.test(f))throw Error("JRA_CURRENT_DRAW_NOT_PUBLISHED");
      frame=Number(f);
      const span=Number(frameCell.attr("rowspan")||"1");
      if(!Number.isInteger(span)||span<1||span>4)throw Error("JRA_FRAME_ROWSPAN_INVALID");
      activeFrame=frame; frameRowsRemaining=span-1;
    } else if(frameRowsRemaining>0&&Number.isInteger(activeFrame)){
      frame=activeFrame; frameRowsRemaining--;
    } else {
      throw Error("JRA_CURRENT_DRAW_NOT_PUBLISHED");
    }
    const jockeyText=clean(current.children("td.jockey").first().text());
    // Strip only past-running-history TDs: "取消"/"除外" in the past
    // cannot be used to mark the current row as cancelled/excluded.
    const currentRow=current.clone();
    currentRow.find("td.past").remove();
    const currentText=clean(currentRow.text());
    const currentClasses=String(current.attr("class")??"");
    const isOut=/競走除外|除外/.test(currentText)||/\bexcluded\b/i.test(currentClasses);
    const isCancel=/出走取消|取消/.test(currentText)||/\bcancell?ed\b/i.test(currentClasses);
    if(isOut&&isCancel)throw Error("JRA_CURRENT_STATUS_CONFLICT");
    const status=isOut?"EXCLUDED":isCancel?"CANCELLED":"ACTIVE";
    const jockeyMatch=jockeyText.match(/([0-9]+(?:\.[0-9]+)?)kg\s+(.+)$/);
    const weight_carried=jockeyMatch?Number(jockeyMatch[1]):null;
    const jockey=jockeyMatch?clean(jockeyMatch[2]):null;
    if(status==="ACTIVE"&&(!jockey||weight_carried===null))throw Error("JRA_CURRENT_JOCKEY_WEIGHT_NOT_PUBLISHED");
    rows.push({horse_no,horse_name,draw:frame,status,jockey,weight_carried,
      horse_no_source:"EXPLICIT_CURRENT_CARD",draw_source:"EXPLICIT_CURRENT_CARD",
      current_status_source:"CURRENT_NUMBERED_CARD_ROW"});
  });
  if(rows.length!==Number(expectedRace.field_size))throw Error("JRA_FULL_NUMBERED_FIELD_MISMATCH");
  const nos=rows.map(x=>x.horse_no);
  if(new Set(nos).size!==rows.length)throw Error("JRA_NUMBER_DUPLICATE");
  return {rows,post_time,surface,distance,race_name:heading};
}

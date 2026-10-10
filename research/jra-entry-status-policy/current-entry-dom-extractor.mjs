// SHADOW ONLY. Cheerio-compatible DOM adapter for current entry row metadata.
// This is NOT official ACTIVE proof and never writes to Supabase.
import {classifyCurrentRow} from './current-row-signals.mjs';
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
export function extractCurrentEntryRows($){
 const out=[],issues=[];
 let rowCount=0;
 $('table.basic.narrow-xy tbody tr').each((_,tr)=>{
  rowCount++;
  const row=$(tr),num=Number(clean(row.find('td.num').first().text()));
  const cell=row.find('td.horse').first(),link=cell.find("a[href*='accessU']").first();
  const name=clean(link.text());
  if(!Number.isInteger(num)||num<1||!name){issues.push({rowIndex:rowCount,reason:'INVALID_RUNNER_IDENTITY'});return;}
  // Never include td.past or full row images/classes: historical cancellations are not current status.
  const classes=[row.attr('class')??'',cell.attr('class')??''];
  const images=cell.find('img').map((__,img)=>$(img).attr('alt')??$(img).attr('title')??'').get();
  const extracted={horseNo:num,horseName:name,rowText:clean(row.text()),horseCellText:clean(cell.text()),classes,images};
  if(out.some(x=>x.horseNo===num))issues.push({rowIndex:rowCount,reason:'DUPLICATE_HORSE_NO'});
  out.push({...extracted,classification:classifyCurrentRow(extracted)});
 });
 if(rowCount===0)issues.push({reason:'NO_ENTRY_ROWS'});
 return {rows:out,issues,rowCount,extractionState:issues.length?'HOLD_INVALID_ROWS':'HOLD_ACTIVE_NOT_PROVEN',eligibleForOfficialPublish:false,requiresOfficialDomAudit:true};
}

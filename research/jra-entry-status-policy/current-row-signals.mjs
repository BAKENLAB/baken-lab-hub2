// SHADOW ONLY. Parse row-level explicit cancellation signals; never infer ACTIVE.
// This function accepts extracted row attributes/text from the official JRA HTML.
// Only current-entry horse cell and row metadata are inspected; past-run cells may contain historical 取消/除外.
// Unknown or contradictory signals always HOLD. No DB writes.
const bad=reason=>({state:'HOLD',reason});
export function classifyCurrentRow({horseNo,horseName,rowText,horseCellText,classes=[],images=[]}={}){
 if(!Number.isInteger(horseNo)||horseNo<1||!horseName||typeof rowText!=='string'||typeof horseCellText!=='string')return bad('ROW_MISSING');
 const normalized=[horseCellText,...classes,...images].map(x=>String(x).normalize('NFKC'));
 const text=normalized.join(' ');
 const cancelled=/(?:出走取消|出走取り消し|競走取消|取消)/.test(text);
 const excluded=/(?:競走除外|出走除外|除外)/.test(text);
 if(cancelled&&excluded)return bad('CONFLICTING_STATUS');
 if(cancelled)return {state:'EXPLICIT_NONSTART',status:'CANCELLED',horseNo,horseName,signal:'取消',eligibleForOfficialPublish:false};
 if(excluded)return {state:'EXPLICIT_NONSTART',status:'EXCLUDED',horseNo,horseName,signal:'除外',eligibleForOfficialPublish:false};
 return bad('ACTIVE_NOT_PROVEN');
}
export function inspectCurrentRows(rows){
 if(!Array.isArray(rows)||!rows.length)return bad('NO_ROWS');
 const seen=new Set(),out=[];
 for(const row of rows){
  const n=row?.horseNo;
  if(seen.has(n))return bad('DUPLICATE_HORSE');
  seen.add(n);
  const v=classifyCurrentRow(row);
  out.push(v);
 }
 return {state:out.every(x=>x.state==='EXPLICIT_NONSTART')?'ALL_EXPLICIT_NONSTART':'HOLD',rows:out,eligibleForOfficialPublish:false};
}

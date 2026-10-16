/** Stage-only strict verifier for current official numbered JRA fields.
 * Use ONLY on rows actually parsed from fresh JRA official card HTML; the parser must
 * provide provenance flags from the current numbered row, never inferred draw/status.
 * This module does not fetch HTML, create source hashes, or save predictions.
 */
export function normJra(v){return String(v??"").normalize("NFKC").replace(/\s+/g,"").trim();}
export function validateCurrentJraField({race,officialRows,liveRows,checkedAt,nowMs=Date.now()}){
 const error=(code)=>{throw Error(code);};
 if(!race||!["芝","ダート"].includes(race.surface)||race.race_type==="障害"||!Number.isInteger(race.field_size)||race.field_size<5||race.field_size>24)error("UNSUPPORTED_OR_UNVERIFIED_RACE");
 if(!Array.isArray(officialRows)||!Array.isArray(liveRows)||officialRows.length!==race.field_size||liveRows.length!==race.field_size)error("FULL_FIELD_MISMATCH");
 const verifiedTime=Date.parse(checkedAt);
 if(!Number.isFinite(verifiedTime)||verifiedTime<nowMs-120000||verifiedTime>nowMs+15000)error("STALE_OR_FUTURE_JRA_PROOF");
 const liveByNo=new Map(liveRows.map(r=>[Number(r.horse_no),r]));
 if(liveByNo.size!==race.field_size)error("CAPTURED_FIELD_DUPLICATE");
 const seen=new Set(), result=[];
 for(const r of officialRows){
  const no=Number(r.horse_no),draw=Number(r.draw);
  if(!Number.isInteger(no)||no<1||no>24||seen.has(no))error("VERIFIED_NUMBER_MISSING_OR_DUPLICATE");
  seen.add(no);
  if(r.horse_no_source!=="EXPLICIT_CURRENT_CARD"||r.draw_source!=="EXPLICIT_CURRENT_CARD"||!Number.isInteger(draw)||draw<1||draw>8)error("INFERRED_DRAW_OR_NUMBER_FORBIDDEN");
  if(r.current_status_source!=="CURRENT_NUMBERED_CARD_ROW"||!["ACTIVE","CANCELLED","EXCLUDED"].includes(r.status))error("CURRENT_STATUS_UNVERIFIED");
  const prev=liveByNo.get(no);
  if(!prev||normJra(r.horse_name)!==normJra(prev.horse_name)||draw!==Number(prev.draw))error("JRA_CURRENT_IDENTITY_MISMATCH");
  if(r.status==="ACTIVE"){
   const w=Number(r.weight_carried);
   if(!Number.isFinite(w)||w<45||w>70||!normJra(r.jockey)||normJra(r.jockey)!==normJra(prev.jockey)||w!==Number(prev.weight_carried))error("JRA_CURRENT_ACTIVE_DETAILS_MISMATCH");
  }
  result.push({horse_no:no,horse_name:String(r.horse_name),draw,status:r.status,jockey:r.status==="ACTIVE"?String(r.jockey):String(r.jockey??""),weight_carried:r.status==="ACTIVE"?Number(r.weight_carried):null});
 }
 result.sort((a,b)=>a.horse_no-b.horse_no);
 return result;
}

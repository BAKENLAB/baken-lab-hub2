/** Pure as-of inventory of historical JRA JUMP runner rows.
 * Each row is an archive observation, never proof of complete career/meeting
 * or rider 365-day coverage. No odds or today’s results.
 */
const id=x=>String(x??"").match(/pw01dud[0-9]{2}([0-9]{10})/)?.[1]??null;
export function inventoryJumpArchive({race,liveRunners=[],rows=[]}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(race?.race_date??"")||!Array.isArray(rows)||rows.length>1000)
  throw Error("JUMP_ARCHIVE_SCOPE_UNVERIFIED");
 const day=race.race_date;
 const results=[];
 for(const horse of liveRunners){
  const horseId=id(horse.horse_ref);
  const related=rows.filter(a=>a?.horse_name===horse.horse_name);
  const exact=[],unanchored=[],rejected=[];
  const seen=new Set();
  for(const record of related){
   const rr=record.jra_lab_races;
   const sourceOK=rr&&rr.surface==="障害"&&rr.race_date<day&&rr.race_date>="2018-01-01"&&rr.full_field===true&&
     record.record_role==="full_runner"&&record.source_kind==="jra_public_reference"&&
     typeof record.source_ref==="string"&&record.source_ref.startsWith("pw01sde")&&
     record.source_ref===rr.source_ref;
   const key=rr?.race_date+"|"+rr?.track+"|"+rr?.race_no+"|"+horse.horse_no;
   if(!sourceOK||seen.has(key)){rejected.push(key);continue}
   seen.add(key);
   if(horseId&&id(record.horse_ref)===horseId){
    exact.push({date:rr.race_date,track:rr.track,no:rr.race_no,ref:record.source_ref,finish:record.finish});
   }else if(record.horse_ref==null){
    unanchored.push({date:rr.race_date,ref:record.source_ref});
   }else rejected.push(key);
  }
  exact.sort((a,b)=>b.date.localeCompare(a.date)||a.ref.localeCompare(b.ref));
  results.push({
   horse_no:horse.horse_no,horse_name:horse.horse_name,
   exact_id_anchored_jumps:exact.length,
   recent_exact_jumps:exact.slice(0,5),
   name_only_ref_missing_jumps:unanchored.length,
   rejected_or_duplicate_rows:rejected.length,
   full_history_verified:false,
   note:"A race-row archive is not a complete horse/jockey calendar certificate."
  });
 }
 return {
   archive_race_rows_examined:rows.length,
   exact_id_anchored_jumps:results.reduce((s,x)=>s+x.exact_id_anchored_jumps,0),
   name_only_ref_missing_jumps:results.reduce((s,x)=>s+x.name_only_ref_missing_jumps,0),
   full_history_verified:false,as_of_date:day,
   recent_archive_last_date:"2026-09-13",
   runners:results
 };
}

/**
 * LOCAL race evidence classification, research-only.
 *
 * A named race includes sponsor/title text, whereas the ability comparison
 * needs its official CLASS. A market-term-shaped string may appear in an
 * unrelated sponsor's legal name (e.g., オッズパーク賞C1).
 *
 * This extracts only an explicitly printed racing class (C1/C2/...);
 * the original verified run and exact COMPACT evidence reference remain
 * unchanged in the underlying source. Never supply a made-up class, never
 * strip words from actual evidence or weakening the production save guard.
 * This module is NOT a writer and does not retry a rejected MCP save.
 */
const classPattern=/(?:^|[^A-Z0-9])((?:3歳[ABC][1-3])|(?:[ABC][1-3])|(?:オープン)|(?:Jpn(?:I{1,3}|[ⅠⅡⅢ])))(?=$|[^A-Z0-9])/iu;
export function classifyLocalOfficialRaceLabel({
 race_name,evidence_ref
}={}){
 if(typeof race_name!=='string'||!race_name.trim()||
 typeof evidence_ref!=='string'||!/^COMPACT_V1\.runners\[horse_no=\d+\]\.recent_runs\[\d+\]$/.test(evidence_ref))
  return {status:'UNVERIFIED_SOURCE',class_label:null,source_ref:null};
 const match=race_name.match(classPattern);
 if(!match)
  return {status:'CLASS_NOT_EXPLICIT',class_label:null,source_ref:evidence_ref};
 return {status:'OFFICIAL_CLASS_LITERAL',class_label:match[1],source_ref:evidence_ref};
}

/** Research-only source table normalizer. Inputs must have separate provenance checks.
 * No fetching, scoring, database writes, prediction or production integration.
 * Grouped official corner orders retain ranges; a range is not an exact position.
 */
export function normalizeNarRaceTiming({distance,winnerTime,sectionEnds=[],sectionTimes=[],cumulativeTimes=[],closing4f=null,closing3f=null}={}){
 const sec10=v=>typeof v==="number"&&Number.isFinite(v)&&v>0&&v<10000&&Math.abs(v*10-Math.round(v*10))<1e-6?Math.round(v*10):null;
 const w=String(winnerTime??"").match(/^(\d+):([0-5]\d)\.(\d)$/);const win=w?+w[1]*600+ +w[2]*10+ +w[3]:null;
 if(!Number.isInteger(distance)||distance<600||distance>4000)throw Error("INVALID_DISTANCE");
 const a=sec10(closing4f),b=sec10(closing3f);
 const out={distance,winner_time_tenths:win,race_closing4f:a===null?null:a/10,race_closing3f:b===null?null:b/10,full_laps_status:"NOT_AVAILABLE",segments:[],rank_authorized:false};
 if(![sectionEnds,sectionTimes,cumulativeTimes].every(Array.isArray))throw Error("INVALID_TIMING_ARRAYS");
 if(!sectionEnds.length&&!sectionTimes.length&&!cumulativeTimes.length)return out;
 const n=sectionEnds.length, first=distance%200||200,expected=Array.from({length:Math.ceil(distance/200)},(_,i)=>first+i*200);
 if(n!==expected.length||sectionTimes.length!==n||cumulativeTimes.length!==n||sectionEnds.some((d,i)=>d!==expected[i]))return {...out,full_laps_status:"SECTION_GRID_MISMATCH"};
 let total=0;const segments=[];
 for(let i=0;i<n;i++){
  const t=sec10(sectionTimes[i]),c=sec10(cumulativeTimes[i]),from=i?sectionEnds[i-1]:0;
  if(t===null||c===null||t<2*(sectionEnds[i]-from)/100*10||t>15*(sectionEnds[i]-from)/100*10)return {...out,full_laps_status:"INVALID_SECTION_TIME"};
  total+=t;if(Math.abs(total-c)>1)return {...out,full_laps_status:"CUMULATIVE_MISMATCH"};
  segments.push({from_m:from,to_m:sectionEnds[i],distance_m:sectionEnds[i]-from,seconds:t/10,cumulative_seconds:c/10});
 }
 if(win===null||Math.abs(total-win)>1)return {...out,full_laps_status:"WINNER_TIME_UNVERIFIED"};
 return {...out,full_laps_status:"FULL_SECTIONALS_CONSISTENT",segments};
}

export function recoverNarCornerRanges({expectedHorseNos,cornerRows}={}){
 if(!Array.isArray(expectedHorseNos)||expectedHorseNos.length<2||expectedHorseNos.length>24||expectedHorseNos.some(n=>!Number.isInteger(n)||n<1||n>24)||new Set(expectedHorseNos).size!==expectedHorseNos.length||!Array.isArray(cornerRows))throw Error("INVALID_CORNER_ROSTER");
 const expected=new Set(expectedHorseNos),labels=new Set(),rows=[];
 const clean=x=>String(x??"").normalize("NFKC").replace(/\s+/g,"");
 for(const raw of cornerRows){
  const label=clean(raw?.label),s=clean(raw?.order);
  if(!/^(向正面|(?:第)?[1-4](?:角|コーナー))$/.test(label)||labels.has(label)||!s){rows.push({label,status:"INVALID_OR_DUPLICATE_LABEL",positions:[]});continue;}
  labels.add(label);const groups=[];let i=0,valid=true;
  const num=()=>{const m=s.slice(i).match(/^\d{1,2}/);if(!m)return null;i+=m[0].length;return Number(m[0]);};
  while(i<s.length&&valid){
   let group=[];
   if(s[i]==="("){i++;while(true){if(s[i]==="*")i++;const n=num();if(n===null){valid=false;break;}group.push(n);if(s[i]===")"){i++;break;}if(s[i]!==","){valid=false;break;}i++;}if(group.length<2)valid=false;}
   else {const n=num();if(n===null){valid=false;break;}group=[n];}
   groups.push(group);if(i===s.length)break;
   if(!/^[,=-]$/.test(s[i])){valid=false;break;}i++;
   if(i===s.length)valid=false;
  }
  const flat=groups.flat();if(!valid||flat.length!==expected.size||new Set(flat).size!==expected.size||flat.some(n=>!expected.has(n))){rows.push({label,status:"ROSTER_OR_SYNTAX_MISMATCH",positions:[]});continue;}
  let offset=0;const positions=[];
  for(const group of groups){for(const no of group)positions.push({horse_no:no,position_min:offset+1,position_max:offset+group.length,position_exact:group.length===1?offset+1:null});offset+=group.length;}
  rows.push({label,status:"ALL_ROSTER_MATCHED",positions});
 }
 return {roster_size:expected.size,verified_corner_rows:rows.filter(r=>r.status==="ALL_ROSTER_MATCHED").length,rows,rank_authorized:false};
}

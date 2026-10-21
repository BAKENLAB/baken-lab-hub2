// BAKEN LAB independent research helper, NOT connected to live prediction / save.
// Caller MUST supply profile runs verified against the current horse's official lineage URL
// and race-result rows isolated to their exact horse-number and race source.
// Never merge by horse name alone, never use same-day or future results.
const NAR_CODES = Object.freeze({"門別":"36","帯広":"03","盛岡":"10","水沢":"11","浦和":"18","船橋":"19","大井":"20","川崎":"21","金沢":"22","笠松":"23","名古屋":"24","園田":"27","姫路":"28","高知":"31","佐賀":"32"});
function normalizedHorseName(s) {return String(s??'').normalize('NFKC').replace(/\s+/g,' ').trim()}
function parseOfficialResultUrl(input) {
 if(typeof input!=='string'||!/^https:\/\/(?:www|sp)\.keiba\.go\.jp\/KeibaWeb\/TodayRaceInfo\/RaceMarkTable\?/.test(input))return null;
 const q=input.slice(input.indexOf('?')+1).split('&'), fields={};
 if(q.length!==3)return null;
 for(const pair of q){const at=pair.indexOf('=');if(at<1)return null;const key=pair.slice(0,at);if(!['k_babaCode','k_raceDate','k_raceNo'].includes(key)||Object.prototype.hasOwnProperty.call(fields,key))return null;try{fields[key]=decodeURIComponent(pair.slice(at+1).replace(/\+/g,' '))}catch{return null}}
 return fields;
}
export function enrichVerifiedCornerHistory({runner,currentRace,profileRuns,resultRows}){
 const same=(a,b)=>normalizedHorseName(a)===normalizedHorseName(b);
 const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
 if(!runner||!currentRace||!Array.isArray(runner.identity_refs)||runner.identity_refs.length!==1||!Array.isArray(profileRuns)||!Array.isArray(resultRows)||!validDate(currentRace.race_date))throw Error('INVALID_INPUT');
 const ref=runner.identity_refs[0];
 if(typeof ref!=='string'||!/^https:\/\/www\.keiba\.go\.jp\/KeibaWeb\/DataRoom\/HorseMarkInfo\?k_lineageLoginCode=\d{5,30}$/.test(ref))return {runs:profileRuns,accepted:0,rejected:resultRows.length};
 const result=new Map();let accepted=0,rejected=0;
 for(const x of resultRows){
   const p=parseOfficialResultUrl(x?.source_ref),d=x?.race_date;
   const matchingRun=profileRuns.find(h=>h&&h.race_date===d&&h.track===x.track&&h.race_no===x.race_no&&h.horse_no===x.horse_no&&h.horse_ref===ref&&same(h.horse_name,runner.horse_name)&&h.source==='NAR_OFFICIAL_RESCUE');
   const vals=typeof x?.corner_order==='string'?x.corner_order.trim().split('-').map(Number):[];
   const good=!!p&&!!matchingRun&&validDate(d)&&d<currentRace.race_date&&p.k_babaCode===NAR_CODES[x.track]&&p.k_raceDate===d.replaceAll('-','/')&&p.k_raceNo===String(x.race_no)&&x.circuit==='LOCAL'&&same(x.horse_name,runner.horse_name)&&x.horse_no>=1&&x.horse_no<=20&&x.source==='NAR_OFFICIAL_RESULT'&&(!Number.isInteger(x.finish)||!Number.isInteger(matchingRun.finish)||x.finish===matchingRun.finish)&&vals.length>=2&&vals.length<=5&&vals.every(n=>Number.isInteger(n)&&n>=1&&n<=20);
   if(!good){rejected++;continue}
   const key=[d,x.track,x.race_no,x.horse_no].join('|');if(result.has(key)){result.delete(key);rejected+=2;accepted--;continue}
   result.set(key,{early_pos:vals[0],final_turn_pos:vals[vals.length-1],source_ref:x.source_ref,identity_source_ref:ref,identity_verified_by:'OFFICIAL_HORSE_REF'});accepted++;
 }
 const runs=profileRuns.map(h=>{const key=[h.race_date,h.track,h.race_no,h.horse_no].join('|');const m=result.get(key);if(!m)return h;if(h.early_pos!=null && Number(h.early_pos)!==m.early_pos)return h;return {...h,early_pos:m.early_pos,final_turn_pos:m.final_turn_pos,corner_evidence_ref:m.source_ref};});
 return {runs,accepted,rejected};
}

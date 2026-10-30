// BAKEN LAB LOCAL independent research parser: extract official NAR result-table corner rows.
// Input: cells owned by a single verified RaceMarkTable document, including blank cells.
// Before enriching model context, every output requires official lineage+horse-number corroboration
// through nar-verified-corner-evidence.mjs. Not connected to production worker.
export function parseNarCornerRows({race,source_ref,header_text,rows}){
 const clean=s=>String(s??'').normalize('NFKC').replace(/\s+/g,'');
 if(!race||!Number.isInteger(race.race_no)||!Number.isInteger(Number(race.race_date?.slice(0,4)))||!Array.isArray(rows)||typeof source_ref!=='string')throw Error('INVALID_INPUT');
 const d=race.race_date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if(!d||!clean(header_text).includes(`${d[1]}年${Number(d[2])}月${Number(d[3])}日`)||!clean(header_text).includes(clean(race.track))||!clean(header_text).includes(`第${race.race_no}競走`))return [];
 const normalized=rows.map(r=>Array.isArray(r?.cells)?r.cells.map(clean):[]);
 const idx=normalized.findIndex(c=>c.includes('着順')&&c.includes('馬番')&&c.includes('馬名')&&c.some(x=>x.includes('コーナー通過順')));
 if(idx<0)return [];
 const h=normalized[idx],ix={finish:h.indexOf('着順'),horse_no:h.indexOf('馬番'),horse_name:h.indexOf('馬名'),corner:h.findIndex(x=>x.includes('コーナー通過順'))};
 if(Object.values(ix).some(n=>n<0)||new Set(Object.values(ix)).size!==4)return [];
 const seen=new Set(),out=[];let started=false;
 for(const c of normalized.slice(idx+1)){
   if(c.length!==h.length){if(started)break;continue}
   const no=Number(c[ix.horse_no]),finish=Number(c[ix.finish]),name=c[ix.horse_name],pass=c[ix.corner];
   if(!Number.isInteger(no)||no<1||no>20||!Number.isInteger(finish)||finish<1||finish>20||!name){if(started)break;continue}
   started=true;
   if(seen.has(no))return [];seen.add(no);
   if(!/^(?:[1-9]|1[0-9]|20)(?:-(?:[1-9]|1[0-9]|20)){1,4}$/.test(pass))continue;
   out.push({race_date:race.race_date,track:race.track,race_no:race.race_no,circuit:'LOCAL',horse_no:no,horse_name:name,finish,corner_order:pass,source:'NAR_OFFICIAL_RESULT',source_ref});
 }
 return out;
}

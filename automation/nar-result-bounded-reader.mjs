// BAKEN LAB experimental LOCAL result retrieval budget.
// No production integration: caller supplies a verified, read-only page reader.
// The URL, past-date boundary, request count and per-race cache are enforced here.
// Official race results must still be parsed and matched by lineage+past horse no.
const TRACK_CODES=Object.freeze({'門別':'36','帯広':'03','盛岡':'10','水沢':'11','浦和':'18','船橋':'19','大井':'20','川崎':'21','金沢':'22','笠松':'23','名古屋':'24','園田':'27','姫路':'28','高知':'31','佐賀':'32'});
const validDate=d=>typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
export function createBoundedNarResultReader({readPage,maxRequests=2}={}){
 if(typeof readPage!=='function'||maxRequests!==2)throw Error('INVALID_READER_OPTIONS');
 let requests=0;
 const cache=new Map();
 return {
  async read(currentRace,pastRace) {
   if(!currentRace||!pastRace||currentRace.circuit!=='LOCAL'||pastRace.circuit!=='LOCAL'||
      !validDate(currentRace.race_date)||!validDate(pastRace.race_date)||
      pastRace.race_date>=currentRace.race_date||
      !Object.hasOwn(TRACK_CODES,pastRace.track)||
      !Number.isInteger(pastRace.race_no)||pastRace.race_no<1||pastRace.race_no>12)
     throw Error('NAR_RESULT_REQUEST_NOT_HISTORICAL');
   const key=pastRace.race_date+'|'+pastRace.track+'|'+pastRace.race_no;
   if(cache.has(key))return cache.get(key);
   if(requests>=maxRequests)throw Error('NAR_RESULT_REQUEST_BUDGET_EXCEEDED');
   const url='https://sp.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode='+
      TRACK_CODES[pastRace.track]+'&k_raceDate='+encodeURIComponent(pastRace.race_date.replaceAll('-','/'))+
      '&k_raceNo='+pastRace.race_no;
   requests++;
   const result=await readPage(url,{method:'GET',redirect:'error',cache:'no-store'});
   if(!result || result.verified!==true || result.url!==url)
     throw Error('NAR_RESULT_SOURCE_UNVERIFIED');
   const out=Object.freeze({source_ref:url,document:result.document});
   cache.set(key,out);
   return out;
  },
  statistics(){return Object.freeze({requests,cached:cache.size,remaining:maxRequests-requests});}
 };
}

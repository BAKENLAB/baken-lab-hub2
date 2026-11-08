/**
 * Derive a missing JRA historical race number ONLY from the exact verified
 * official archived result page. Some live runner history snapshots retain
 * source_ref/date/track/distance but omit race_no. Never guess the number
 * from today's race number or infer it from an undocumented CNAME offset.
 *
 * This helper reads one already independently fetched official result text.
 * No network, bets, market data, CLAIM, score or FROZEN side effects.
 */
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s);
const timestamp=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))?Date.parse(s):null;
const officialRef=s=>{
 try{
  const u=new URL(s,'https://www.jra.go.jp');
  const c=u.searchParams.get('CNAME');
  if(u.protocol!=='https:'||u.hostname!=='www.jra.go.jp'||
     u.pathname!=='/JRADB/accessS.html'||u.searchParams.size!==1||
     !/^[sp]w[A-Za-z0-9/]{12,100}$/.test(c??'')||
     u.username||u.password||u.hash)return null;
  return u.href;
 }catch{return null;}
};
function numberMarks(text,number){
 const pattern=new RegExp(
  '(?:^|[^0-9])0?'+number+'\\s*(?:R|レース)(?=[^0-9]|$)|第\\s*0?'+number+'競走','i');
 return pattern.test(text);
}
export function deriveVerifiedJraPriorRaceNo({
 targetRaceDate,targetPostTime,priorRaceDate,track,surface,sourceRef,
 officialUrl,bodyText,sourceCheckedAt,verifiedOfficialResponse,
 clock=()=>Date.now()
}={}){
 const fail=status=>({status,verified:false,race_no:null,
  market_used:false,rank_effect:'NONE',save_gate_effect:'NONE'});
 const now=clock(),post=timestamp(targetPostTime),checked=timestamp(sourceCheckedAt);
 if(!validDate(targetRaceDate)||!validDate(priorRaceDate)||
    priorRaceDate>=targetRaceDate||!track||
    !['芝','ダート'].includes(surface)||
    !Number.isFinite(now)||post===null||now>=post||
    checked===null||checked>now||checked>=post||now-checked>86400000)
  return fail('UNVERIFIED_PRE_RACE_TIME');
 const expected=officialRef(sourceRef),actual=officialRef(officialUrl);
 if(!expected||actual!==expected||verifiedOfficialResponse!==true||
    typeof bodyText!=='string'||bodyText.length<100||bodyText.length>200000)
  return fail('OFFICIAL_SOURCE_NOT_VERIFIED');
 const body=bodyText.normalize('NFKC');
 const [year,month,day]=priorRaceDate.split('-').map(Number);
 const date=new RegExp(String(year)+'年\\s*0?'+month+'月\\s*0?'+day+'日');
 if(!date.test(body)||!body.includes(track)||!body.includes(surface)||
    !body.includes('ハロンタイム'))
  return fail('OFFICIAL_RACE_HEADER_MISSING');
 const matches=[...Array(12)].map((_,i)=>i+1).filter(n=>numberMarks(body,n));
 if(matches.length!==1)return fail('OFFICIAL_RACE_NUMBER_NOT_UNIQUE');
 return {status:'OFFICIAL_RACE_NUMBER_FROM_RESULT',verified:true,
  race_no:matches[0],source_ref:expected,source_checked_at:sourceCheckedAt,
  race_date:priorRaceDate,track,surface,
  market_used:false,rank_effect:'NONE',save_gate_effect:'NONE'};
}

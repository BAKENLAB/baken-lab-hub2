/** Research-only bounded reader, compatible with the existing NAR official result GET path.
 * No automatic invocation, credential, store, claim, result refresh, production connection or rank authority.
 * The caller MUST supply an authorized fetch implementation, HTML parser and normalizer.
 * Tests use injected mock responses; live HTML and full roster identities remain unverified.
 */
export function createLocalResearchOfficialResultReader({target,parseTable,normalizeResult,fetchImpl,clock=()=>Date.now(),controllerFactory=()=>new AbortController(),decoderFactory=()=>new TextDecoder("utf-8",{fatal:true}),perPageMs=2000,byteLimit=262144,reserveMs=300000}={}){
 const cut=Date.parse(target?.cutoff),post=Date.parse(target?.post);
 if(!Number.isFinite(cut)||!Number.isFinite(post)||cut>=post||!/^\d{4}-\d{2}-\d{2}$/.test(target?.date??"")||typeof parseTable!=="function"||typeof normalizeResult!=="function"||typeof fetchImpl!=="function"||!Number.isInteger(perPageMs)||perPageMs<10||perPageMs>10000||!Number.isInteger(byteLimit)||byteLimit<128||byteLimit>524288||!Number.isInteger(reserveMs)||reserveMs<180000||reserveMs>900000)throw Error("INVALID_RESEARCH_READER");
 const codes={"盛岡":"10","水沢":"11","浦和":"18","船橋":"19","大井":"20","川崎":"21","金沢":"22","笠松":"23","名古屋":"24","園田":"27","姫路":"28","高知":"31","佐賀":"32","門別":"36"};
 return async function readNormalizedResult(job,{signal,deadlineMs}={}){
 const p=job?.priorRace;
 if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(p.raceDate??"")||p.raceDate>=target.date||!codes[p.track]||!Number.isInteger(p.raceNo)||p.raceNo<1||p.raceNo>14)throw Error("NOT_VERIFIED_PAST_RACE");
 const url=`https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=${codes[p.track]}&k_raceDate=${p.raceDate.replaceAll("-","%2F")}&k_raceNo=${p.raceNo}`;
 if(job.url!==url)throw Error("SOURCE_RACE_MISMATCH");
 if(!Number.isFinite(deadlineMs)||signal?.aborted)throw Error("DEADLINE_REQUIRED");
 const stop=Math.min(cut,post-reserveMs,deadlineMs,clock()+perPageMs);
 if(!Number.isFinite(stop)||clock()>=stop)throw Error("SOURCE_DEADLINE");
 const ctrl=controllerFactory();let timer,stream,aborted=false;
 const onCancel=()=>{aborted=true;ctrl.abort();};
 signal?.addEventListener?.("abort",onCancel,{once:true});
 const work=async()=>{
 const response=await fetchImpl(url,{method:"GET",redirect:"error",cache:"no-store",signal:ctrl.signal,headers:{Accept:"text/html,application/xhtml+xml","Accept-Language":"ja-JP,ja;q=0.9"}});
 if(!response?.ok||!response.body||aborted||ctrl.signal.aborted)throw Error("OFFICIAL_RESULT_UNAVAILABLE");
 if(response.redirected===true||response.url!==url)throw Error("UNEXPECTED_SOURCE_URL");
 const type=String(response.headers?.get?.("content-type")??"");
 if(!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(type))throw Error("NOT_HTML");
 const len=Number(response.headers?.get?.("content-length")??0);
 if(Number.isFinite(len)&&len>byteLimit)throw Error("RESULT_TOO_LARGE");
 const decoder=decoderFactory();stream=response.body.getReader();let html="",size=0;
 while(true){
 if(clock()>=stop||aborted||ctrl.signal.aborted)throw Error("SOURCE_DEADLINE");
 const {done,value}=await stream.read();if(done)break;
 if(!(value instanceof Uint8Array))throw Error("INVALID_STREAM_CHUNK");
 size+=value.byteLength;if(size>byteLimit)throw Error("RESULT_TOO_LARGE");
 html+=decoder.decode(value,{stream:true});
 }
 html+=decoder.decode();
 const observedAt=new Date(clock()).toISOString();
 if(clock()>=stop||aborted||ctrl.signal.aborted)throw Error("SOURCE_DEADLINE");
 const parsed=parseTable(html);
 const packet=normalizeResult({...parsed,priorRace:p,targetDate:target.date,cutoff:target.cutoff,observedAt,sourceUrl:url,mode:"PROSPECTIVE",expectedRosterCount:null});
 if(clock()>=stop||aborted||ctrl.signal.aborted)throw Error("SOURCE_DEADLINE");
 return packet;
 };
 try{return await Promise.race([work(),new Promise((_,reject)=>{timer=setTimeout(()=>{onCancel();reject(Error("SOURCE_TIMEOUT"));},Math.max(1,stop-clock()));})]);}
 finally{clearTimeout(timer);signal?.removeEventListener?.("abort",onCancel);if(stream)try{Promise.resolve(stream.cancel()).catch(()=>{});}catch{}ctrl.abort();}
 };
}

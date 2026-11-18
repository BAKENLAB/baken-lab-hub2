/** Isolated research handoff. verifyReceipt must be supplied by a trusted evidence store; mock verifier is NOT acceptable in production. No fetch, scoring, rank, save or adoption. */
export function buildLocal16ExtendedResearchReview({context,handoff,cutoff,packets,identityWitnesses,verifyReceipt,normalizeTiming,summarizeFollowup}={}){
 const stop=Date.parse(cutoff),post=Date.parse(context?.race?.post_time);
 const day=context?.race?.race_date;
 const pos=n=>Number.isInteger(n)&&n>0&&n<=24;
 const stamp=x=>typeof x==="string"?Date.parse(x):NaN;
 const norm=x=>String(x??"").normalize("NFKC").replace(/\s+/g,"");
 const id=x=>typeof x==="string"&&/^\d{1,30}$/.test(x);
 const raceKey=r=>JSON.stringify([r?.raceDate,r?.track,r?.raceNo]);
 const priorKey=r=>JSON.stringify([r?.race_date,r?.track,r?.race_no]);
 if(context?.context_format!=="COMPACT_V1"||context.protocol_version!=="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013"||context.field_integrity_checked!==true||context.race?.circuit!=="LOCAL"||!Number.isFinite(stop)||!Number.isFinite(post)||stop>=post||!/^\d{4}-\d{2}-\d{2}$/.test(day??"")||handoff?.schema!=="LOCAL_16_CRITERION_HANDOFF_RESEARCH_V1"||handoff.score_authorized!==false||handoff.market_used!==false||handoff.target_result_used!==false||!Array.isArray(context.runners)||!Array.isArray(handoff.rows)||handoff.rows.length!==context.runners.length||!Array.isArray(packets)||!Array.isArray(identityWitnesses)||typeof verifyReceipt!=="function"||typeof normalizeTiming!=="function"||typeof summarizeFollowup!=="function")throw Error("INVALID_EXTENDED_REVIEW");
 const codes={"盛岡":"10","水沢":"11","浦和":"18","船橋":"19","大井":"20","川崎":"21","金沢":"22","笠松":"23","名古屋":"24","園田":"27","姫路":"28","高知":"31","佐賀":"32","門別":"36"};
 const read=(type,payload,receipt)=>{try{return !!receipt&&verifyReceipt({type,payload,receipt})===true}catch{return false}};
 const asof=x=>Number.isFinite(stamp(x))&&stamp(x)<stop;
 const identity=new Map();
 for(const w of identityWitnesses){
  const h=context.runners.find(r=>r.horse_no===w.horse_no);
  if(!h||norm(h.horse_name)!==norm(w.horse_name)||!id(w.official_horse_id)||!asof(w.observed_at)||!read("CURRENT_IDENTITY",w,w.receipt))continue;
  if(identity.has(h.horse_no)||[...identity.values()].some(x=>x===w.official_horse_id))throw Error("IDENTITY_CONFLICT");
  identity.set(h.horse_no,w.official_horse_id);
 }
 const accepted=new Map(),rejected=[];
 for(const v of packets){
  const p=v?.result,k=raceKey(p?.priorRace),r=p?.priorRace;
  if(!r||!codes[r.track]||!Number.isInteger(r.raceNo)||r.raceNo<1||r.raceNo>14||!/^\d{4}-\d{2}-\d{2}$/.test(r.raceDate??"")||r.raceDate>=day||p.schema!=="LOCAL_FULL_PAST_RESULT_RESEARCH_V1"||p.source_timing!=="OBSERVED_BEFORE_CUTOFF"||p.targetDate!==day||stamp(p.cutoff)!==stop||!asof(p.observedAt)||p.rank_authorized!==false||p.market_used!==false||p.roster_status!=="COUNT_MATCHED"||!Array.isArray(p.records)||!read("RESULT",p,v.result_receipt)){rejected.push({key:k,reason:"RESULT_NOT_AUTHENTICATED_ASOF"});continue}
  const canonical=`https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/RaceMarkTable?k_babaCode=${codes[r.track]}&k_raceDate=${r.raceDate.replaceAll("-","%2F")}&k_raceNo=${r.raceNo}`;
  if(p.sourceUrl!==canonical){rejected.push({key:k,reason:"RESULT_SOURCE_MISMATCH"});continue;}
  const roster=v.past_roster;
  if(!Array.isArray(roster)||roster.length!==p.records.length||!read("PAST_ROSTER",{priorRace:r,roster},v.roster_receipt)||new Set(roster.map(x=>x.horse_no)).size!==roster.length||new Set(roster.map(x=>x.official_horse_id)).size!==roster.length||roster.some(x=>!pos(x.horse_no)||!id(x.official_horse_id))||p.records.some(x=>!roster.some(y=>y.horse_no===x.horse_no&&y.official_horse_id===x.official_horse_id&&norm(y.horse_name)===norm(x.horse_name)))){rejected.push({key:k,reason:"FULL_ROSTER_IDENTITY_UNVERIFIED"});continue}
  if(accepted.has(k))throw Error("DUPLICATE_RESULT_PACKET");
  let timing=null;
  if(v.timing&&asof(v.timing_observed_at)&&read("TIMING",{priorRace:r,timing:v.timing,observed_at:v.timing_observed_at},v.timing_receipt)){
   const winners=p.records.filter(x=>x.finish===1);
   try{const t=normalizeTiming(v.timing);if(winners.length&&winners.every(w=>w.time_tenths===t.winner_time_tenths)&&t.full_laps_status==="FULL_SECTIONALS_CONSISTENT")timing=t;}catch{}
  }
  const history=[];
  for(const x of Array.isArray(v.peer_history)?v.peer_history:[]){
   if(x?.row&&asof(x.row.observed_at)&&read("PEER_HISTORY",x.row,x.receipt))history.push(x.row);
  }
  accepted.set(k,{result:p,timing,history});
 }
 const rows=handoff.rows.map(row=>{
  const h=context.runners.find(x=>x.horse_no===row.horse_no&&norm(x.horse_name)===norm(row.horse_name));
  if(!h||!Array.isArray(h.recent_runs)||!Array.isArray(row.criteria)||row.criteria.length!==13)throw Error("FIELD_MISMATCH");
  const ownId=identity.get(h.horse_no),details=[];
  for(let i=0;i<h.recent_runs.length;i++){
   const run=h.recent_runs[i],k=priorKey(run),v=accepted.get(k);
   if(!ownId||!v)continue;
   const hits=v.result.records.filter(x=>x.official_horse_id===ownId&&norm(x.horse_name)===norm(h.horse_name)&&x.status==="FINISHED");
   if(hits.length!==1||run.race_date>=day||(run.finish!==null&&run.finish!==undefined&&run.finish!==""&&Number(run.finish)!==hits[0].finish))continue;
   const own=hits[0],ref=`COMPACT_V1.runners[horse_no=${h.horse_no}].recent_runs[${i}]`;
   let peer=null;try{peer=summarizeFollowup({packet:v.result,currentHorseId:ownId,historyRows:v.history});}catch{}
   // A repeat opponent, a win, or a pace observation is not an automatic bonus.
   // Full lap data is a race-level fact, not a horse-specific sectional time.
   details.push({ref,source_url:v.result.sourceUrl,observed_at:v.result.observedAt,finish:own.finish,winner_gap_seconds:own.winner_gap_seconds,final3f:own.final3f,lap_status:v.timing&&Number(run.distance)===v.timing.distance?"AUTHENTICATED_RESEARCH_FACT":"NOT_VERIFIED",race_sectionals:v.timing&&Number(run.distance)===v.timing.distance?v.timing.segments:[],opponent_followup:peer?{status:peer.status,peer_count:peer.peer_count,observed_peer_count:peer.observed_peer_count,winning_peer_count:peer.winning_peer_count,evidence:peer.evidence}:null,criterion_indices:[0,1,6,12],automatic_points:0});
  }
  return {...row,extended_research_facts:details,lap_status:details.some(d=>d.lap_status==="AUTHENTICATED_RESEARCH_FACT")?"RESEARCH_REVIEW_AVAILABLE":"NOT_VERIFIED",opponent_followup_status:details.some(d=>d.opponent_followup?.observed_peer_count>0)?"RESEARCH_REVIEW_AVAILABLE":"NOT_VERIFIED",assessment_required:true};
 });
 return {schema:"LOCAL_16_EXTENDED_RESEARCH_REVIEW_V1",rows,accepted_packets:accepted.size,rejected_packets:rejected,identity_count:identity.size,lap_runs:rows.reduce((n,r)=>n+r.extended_research_facts.filter(d=>d.lap_status==="AUTHENTICATED_RESEARCH_FACT").length,0),followup_runs:rows.reduce((n,r)=>n+r.extended_research_facts.filter(d=>d.opponent_followup?.observed_peer_count>0).length,0),score_authorized:false,score_computed:false,rank_authorized:false,market_used:false,target_result_used:false,production_connected:false};
}

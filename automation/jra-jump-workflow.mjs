// Server-only orchestration. No direct table writes; authenticated RPC ports only.
// Production is disabled until the official evidence provider and isolated DB tests pass.
import {VERSION,prepareJump,finalizeJump} from './jra-jump-k2-adapter.mjs';
const need=(v,c)=>{if(!v)throw Error('JUMP_'+c)};
const dateRE=/^\d{4}-\d{2}-\d{2}$/;
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':record(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
const refId=s=>typeof s==='string'?(s.match(/pw01dud\d{2}(\d{10})/)?.[1]??null):null;
const cleanJ=s=>String(s??'').normalize('NFKC').replace(/[\s▲△◇☆]/g,'');
const activeVersion=VERSION;
function parseTime(s){const m=typeof s==='string'&&s.match(/^(\d+):(\d{2}\.\d+)$/);return m?Number(m[1])*60+Number(m[2]):null}
export function buildJumpContext(raw, evidence){
 const {job,worker,race,live,live_runners,existing_prediction}=raw??{};
 need(job?.job_status==='CLAIMED'&&job.claimed_by==='JRA_JUMP_QUEUE'&&worker?.id===job.worker_run_id&&worker?.status==='RUNNING'&&worker.worker_id===job.claimed_by&&typeof job.claim_token==='string'&&job.claim_token,'CLAIM_SOURCE');
 need(race?.circuit==='JRA'&&race.race_date===job.race_date&&race.track===job.track&&race.race_no===job.race_no&&existing_prediction===false,'RACE_SOURCE');
 const fp=race.field_payload,rc=fp?.race,proof=fp?.official_status_verification;
 const key=race.race_date.replaceAll('-','')+'_'+race.track+'_'+race.race_no+'R';
 need(rc?.race_type==='障害'&&rc.surface==='障害'&&live?.race_type==='障害'&&live.surface==='障害'&&live.race_date===race.race_date&&live.track===race.track&&live.race_no===race.race_no&&live.distance===rc.distance&&live.cname===rc.cname,'RACE_TYPE');
 need(proof?.verified===true&&proof.basis==='JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1'&&raw.official_html?.official_status_verified===true&&raw.official_html.race_key===key&&raw.official_html.cname===rc.cname&&raw.official_html.html_sha256===proof.html_sha256,'OFFICIAL_RECEIPT');
 const entries=fp.runners;
 need(Array.isArray(entries)&&Array.isArray(live_runners)&&entries.length===live.field_size&&live_runners.length===entries.length&&entries.length===proof.runner_count&&raw.official_html.runner_count===entries.length&&new Set(entries.map(e=>e.horse_no)).size===entries.length,'FIELD_COUNT');
 const active=entries.filter(e=>e.status==='ACTIVE');
 need(active.length===proof.active_count,'ACTIVE_COUNT');
 need(entries.every(e=>{const a=live_runners.find(x=>x.horse_no===e.horse_no);return a&&a.horse_name===e.horse_name&&a.horse_ref===e.horse_ref&&a.draw===e.draw&&(e.status!=='ACTIVE'||(a.jockey===e.jockey&&Number(a.weight_carried)===Number(e.weight_carried)&&refId(e.horse_ref))) }), 'FIELD_IDENTITY');
 need(evidence?.race_key===key&&evidence.as_of_date===race.race_date&&Array.isArray(evidence.horses)&&evidence.horses.length===active.length&&new Set(evidence.horses.map(h=>h.horse_no)).size===active.length,'EVIDENCE_SCOPE');
 const history=active.map(e=>{
   const h=evidence.horses.find(x=>x.horse_no===e.horse_no);
   need(h?.horse_name===e.horse_name&&h.horse_id===refId(e.horse_ref)&&h.profile_verified===true&&h.profile_complete===true&&h.as_of_date===race.race_date&&typeof h.profile_source==='string'&&h.profile_source&&Array.isArray(h.runs)&&h.runs.length===h.jump_start_count,'PROFILE_COVERAGE');
   need(h.runs.every(r=>r.horse_id===h.horse_id&&r.race_date<race.race_date&&dateRE.test(r.race_date)&&r.verified===true&&r.race_type==='障害'&&r.source_ref&&['FINISHED','DNF','DISQUALIFIED'].includes(r.result_status)&&(r.result_status==='FINISHED'?Number.isInteger(r.finish):r.finish===null)),'RUN_PROOF');
   const lr=live_runners.find(a=>a.horse_no===e.horse_no);
   need(Array.isArray(lr.past_runs),'CARD_HISTORY');
   const cardJump=lr.past_runs.filter(r=>String(r.race_class??'').startsWith('障害'));
   need(cardJump.every(r=>h.runs.some(x=>x.race_date===r.race_date&&x.track===r.track&&x.finish===r.finish)), 'CARD_HISTORY_MISMATCH');
   const j=h.jockey;
   need(j?.verified===true&&j.complete_365day_schedule===true&&cleanJ(j.name)===cleanJ(e.jockey)&&j.as_of_date===race.race_date&&typeof j.source_ref==='string'&&j.source_ref&&Array.isArray(j.starts),'JOCKEY_COVERAGE');
   const prior=new Date(Date.parse(race.race_date)-365*86400000).toISOString().slice(0,10);
   need(j.starts.every(r=>r.verified===true&&dateRE.test(r.race_date)&&r.race_date>=prior&&r.race_date<race.race_date&&r.race_type==='障害'&&typeof r.source_ref==='string'&&typeof r.horse_id==='string'&&cleanJ(r.jockey)===cleanJ(e.jockey)&&['FINISHED','DNF','DISQUALIFIED'].includes(r.result_status)&&(r.result_status==='FINISHED'?Number.isInteger(r.finish)&&r.finish>0:r.finish===null)),'JOCKEY_ASOF');
   need(new Set(j.starts.map(r=>r.source_ref+'|'+r.horse_id)).size===j.starts.length,'JOCKEY_DUPLICATE');
   const fin=j.starts.filter(r=>r.result_status==='FINISHED'),own=fin.filter(r=>r.horse_id===h.horse_id),top3=a=>a.filter(r=>r.finish<=3).length;
   return {horse_no:e.horse_no,horse_name:e.horse_name,coverage_verified:true,history_source:h.profile_source,
   runs:h.runs.map(r=>({verified:true,source_ref:r.source_ref,race_date:r.race_date,race_type:'障害',class_name:r.class_name,track:r.track,distance:r.distance,field_size:r.field_size,finish:r.finish,final_turn_pos:r.final_turn_pos,gap_seconds:r.gap_seconds})),
   jockey_stats:{verified:true,jockey:e.jockey,as_of_date:race.race_date,source_ref:j.source_ref,n:fin.length,top3:top3(fin),own_n:own.length,own_top3:top3(own)}};
 });
 return {race:{...rc,circuit:'JRA',race_key:key,race_date:race.race_date,track:race.track,post_time:race.post_time,field_status:race.field_status,prediction_status:race.prediction_status},claim:{status:'CLAIMED',worker_id:job.claimed_by,job_id:job.id,race_key:key,lease_until:job.lease_until},official:{...proof,race_key:key,checked_at:proof.verified_at},entries,history,existing_prediction:false};
}
export function createJumpWorkflow(ports){
 for(const k of ['authorize','protocolActive','fetchOfficialProof','publishVerified','claimNext','readClaimBundle','getVerifiedHistory','saveClaimed','readReceipt','clock'])need(typeof ports[k]==='function','PORT_'+k);
 const gate=async()=>{await ports.authorize();need(await ports.protocolActive(activeVersion)===true,'PROTOCOL_INACTIVE')};
 const clock=()=>ports.clock();
 async function load(job_id){
  const raw=await ports.readClaimBundle(job_id);
  need(raw?.job?.id===job_id,'CLAIM_ID');
  const evidence=await ports.getVerifiedHistory(raw);
  const ctx=buildJumpContext(raw,evidence);
  const plan=prepareJump(ctx,clock());
  // Bind to server-owned evidence and claim generation; do not expose claim_token.
  const snapshot=canonical({race:ctx.race,official:ctx.official,history:ctx.history,rows:plan.rows,claimed_at:raw.job.claimed_at,worker_run_id:raw.job.worker_run_id});
  return {raw,ctx,plan,snapshot};
 }
 return {
  async publish({race_date,track,race_no}){
   await gate();need(dateRE.test(race_date)&&['東京','京都','新潟','中山','阪神','中京','小倉','福島','札幌','函館'].includes(track)&&Number.isInteger(race_no)&&race_no>=1&&race_no<=12,'RACE_REQUEST');
   const proof=await ports.fetchOfficialProof({race_date,track,race_no});
   need(proof?.race_date===race_date&&proof.track===track&&proof.race_no===race_no&&proof.race?.race_type==='障害'&&proof.race.surface==='障害'&&proof.all_rows_reviewed===true&&proof.verification_basis==='JRA_OFFICIAL_CARD_FULL_NUMBERED_FIELD_V1'&&/^[a-f0-9]{64}$/.test(proof.html_sha256??'')&&Date.parse(proof.post_time)-Date.parse(clock())>180000&&Math.abs(Date.parse(proof.checked_at)-Date.parse(clock()))<=120000,'PUBLISH_PROOF');
   return ports.publishVerified(proof);
  },
  async claim(){await gate();return ports.claimNext()},
  async preview({job_id}){await gate();const x=await load(job_id);return {...x.plan,review_binding:x.snapshot}},
  async save({job_id,review_binding,review}){
   await gate();const x=await load(job_id);
   need(review_binding===x.snapshot,'REVIEW_STALE');
   const payload=finalizeJump(x.ctx,clock(),review);
   // SQL lock checks expected token and cutoff again; no client-supplied payload accepted.
   const id=await ports.saveClaimed({job_id,expected_claim_token:x.raw.job.claim_token,protocol_version:VERSION,payload});
   const confirmation=await ports.readReceipt(id);
   need(confirmation?.id===id&&confirmation.status==='FROZEN'&&confirmation.job_status==='DONE'&&confirmation.protocol_version===VERSION&&confirmation.race_key===x.ctx.race.race_key&&Date.parse(confirmation.frozen_at)<Date.parse(x.ctx.race.post_time)&&canonical(confirmation.payload)===canonical(payload),'RECEIPT_UNCONFIRMED');
   return {id,confirmed:true,race_key:confirmation.race_key,frozen_at:confirmation.frozen_at};
  }
 };
}

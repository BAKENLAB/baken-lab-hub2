// SELECT-only Data API client. No claim/renew RPC, mutation, race search or enumeration.
export const REST_BASE = 'https://qjlvsndiqjfsfjinilig.supabase.co/rest/v1/';
export const JOB_COLUMNS = 'id,race_date,track,race_no,circuit,job_status,worker_run_id,claim_token,claimed_by,lease_until,attempts,max_attempts';
export const RUN_COLUMNS = 'id,worker_id,status,region';
const AUTHORIZED_WORKER = 'LOCAL_QUEUE_RESCUE';
const AUTHORIZED_REGION = 'RESCUE';
const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export class ClaimError extends Error {
  constructor(code = 'CLAIM_UNAVAILABLE') { super(code); this.code = code; }
}
export function createClaimResolver({serviceKey, workerId, fetchImpl, readJson, now = Date.now}) {
  // The confirmed LOCAL rescue policy cannot be widened through env or tool input.
  if (workerId !== AUTHORIZED_WORKER)
    throw new Error('LOCAL_MCP_CONFIGURATION_INVALID');
  async function one(table, select, filters, signal) {
    if (signal.aborted) throw new ClaimError();
    const url = new URL(table, REST_BASE);
    url.searchParams.set('select', select); url.searchParams.set('limit', '2');
    for (const [key,value] of Object.entries(filters)) url.searchParams.set(key, `eq.${value}`);
    try {
      const res = await fetchImpl(url.href, {method:'GET', redirect:'error', cache:'no-store',
        headers:{accept:'application/json', authorization:`Bearer ${serviceKey}`, apikey:serviceKey}, signal});
      if (res.status !== 200) { res.body?.cancel().catch(() => {}); throw new ClaimError(); }
      const rows = await readJson(res, 16384, signal);
      if (!Array.isArray(rows) || rows.length !== 1 || !rows[0] || typeof rows[0] !== 'object') throw new ClaimError();
      return rows[0];
    } catch { throw new ClaimError(); }
  }
  return {
    async resolve(jobId, signal) {
      if (!uuid(jobId)) throw new ClaimError();
      const job = await one('lab_prediction_jobs', JOB_COLUMNS,
        {id:jobId, circuit:'LOCAL', job_status:'CLAIMED', claimed_by:workerId}, signal);
      // Validate again: filters are not accepted as proof of authorization.
      if (job.id !== jobId || job.circuit !== 'LOCAL' || job.job_status !== 'CLAIMED'
        || job.claimed_by !== workerId || !uuid(job.worker_run_id) || !uuid(job.claim_token)
        || !Number.isInteger(job.attempts) || !Number.isInteger(job.max_attempts)
        || job.attempts < 0 || job.max_attempts < 1 || job.attempts > job.max_attempts
        || !Number.isFinite(Date.parse(job.lease_until)) || Date.parse(job.lease_until) <= now()
        || typeof job.race_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(job.race_date)
        || typeof job.track !== 'string' || !job.track || !Number.isInteger(job.race_no)) throw new ClaimError();
      const run = await one('lab_worker_runs', RUN_COLUMNS,
        {id:job.worker_run_id, worker_id:AUTHORIZED_WORKER, status:'RUNNING', region:AUTHORIZED_REGION}, signal);
      if (run.id !== job.worker_run_id || run.worker_id !== AUTHORIZED_WORKER || run.status !== 'RUNNING'
        || run.region !== AUTHORIZED_REGION || job.claimed_by !== run.worker_id
        || Date.parse(job.lease_until) <= now() || signal.aborted) throw new ClaimError();
      return Object.freeze({run_id:run.id,job_id:job.id,claim_token:job.claim_token,
        lease_until:job.lease_until,race_date:job.race_date,track:job.track,race_no:job.race_no,circuit:'LOCAL'});
    },
  };
}
export function sameClaim(a,b) {
  // Lease extension alone is allowed; expiry is validated on every read.
  return ['run_id','job_id','claim_token','race_date','track','race_no','circuit'].every(k => a[k] === b[k]);
}

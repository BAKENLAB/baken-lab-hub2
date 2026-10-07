export const FORMAT = 'LOCAL_INPUT_ARCHIVE_V1'
export const BUDGET_MS = 500
export const MIN_MARGIN_MS = 185000
const secretKey = /claim.?token|api.?key|worker.?token|service.?role|authorization|password|secret/i
function guard(value) {
  if (value && typeof value === 'object') for (const [k,v] of Object.entries(value)) {
    if (secretKey.test(k)) throw Error('SECRET_FIELD')
    guard(v)
  }
}
export function canonical(value) {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']'
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}'
  return JSON.stringify(value)
}
export async function hash(text) {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))
  return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')
}
const log = (logger, event) => { try { logger(event) } catch {} }
async function bounded(task, ms) {
  const controller = new AbortController()
  let timer
  try {
    return await Promise.race([
      Promise.resolve().then(()=>task(controller.signal)),
      new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('ARCHIVE_TIMEOUT'))},ms)}),
    ])
  } finally { clearTimeout(timer) }
}
export async function capture(client, job, context, protocolContent, options = {}) {
  const now = options.now ?? Date.now
  const logger = options.logger ?? (event=>console.log(JSON.stringify(event)))
  let traceId = null
  try {
    const started = now()
    traceId = crypto.randomUUID()
    if (job.circuit !== 'LOCAL' || context.race?.circuit !== 'LOCAL') throw Error('LOCAL_ONLY')
    const post = Date.parse(context.race?.post_time)
    const lease = Date.parse(job.lease_until)
    if (!Number.isFinite(post) || !Number.isFinite(lease) ||
        post-started <= MIN_MARGIN_MS || lease-started <= 5000) {
      log(logger,{event:'INPUT_ARCHIVE_SKIPPED',trace_id:traceId})
      return null
    }
    // Includes hashing and the atomic snapshot/event RPC in one wall-clock budget.
    return await bounded(async signal=>{
      guard(context); guard(protocolContent)
      for (const k of ['race_date','track','race_no','circuit'])
        if (context.race[k] !== job[k]) throw Error('RACE_MISMATCH')
      const prompt = JSON.stringify(context)
      const canon = canonical(context)
      if (prompt.length > 500000 || canon.length > 500000) throw Error('INPUT_TOO_LARGE')
      const protocol = JSON.stringify(protocolContent)
      const [contextHash,promptHash,protocolHash] = await Promise.all([
        (options.hash ?? hash)(canon),(options.hash ?? hash)(prompt),(options.hash ?? hash)(protocol),
      ])
      if (signal.aborted) throw Error('ARCHIVE_TIMEOUT')
      const args = {p_input:{
        archive_format_version:FORMAT,context_version:context.context_version ?? null,
        race_date:job.race_date,track:job.track,race_no:job.race_no,circuit:job.circuit,
        job_id:job.id,worker_run_id:job.worker_run_id,trace_id:traceId,
        captured_at:new Date(started).toISOString(),post_time:context.race.post_time,
        protocol_version:context.protocol_version,context_json:context,
        canonical_context_json:canon,prompt_context_json:prompt,
        context_hash:contextHash,prompt_context_hash:promptHash,
        protocol_content_json:protocol,protocol_hash:protocolHash,
      }}
      const {data,error} = await client.rpc('local_shadow_capture_v1',args).abortSignal(signal)
      if (error || !data?.ok) throw Error('ARCHIVE_REJECTED')
      return {...data,trace_id:traceId}
    },BUDGET_MS)
  } catch {
    log(logger,{event:'INPUT_ARCHIVE_FAILED',trace_id:traceId})
    return null
  }
}
export async function link(client, archive, saved, options = {}) {
  try {
    if (!archive || saved?.already_saved === true) return
    await bounded(async signal=>{
      const {data,error} = await client.rpc('local_shadow_link_v1',{
        p_prediction_id:saved.prediction_id,p_archive_event_id:archive.archive_event_id,
      }).abortSignal(signal)
      if (error || !data?.ok) throw Error('LINK_REJECTED')
    },BUDGET_MS)
  } catch { log(options.logger ?? (e=>console.log(JSON.stringify(e))),{event:'INPUT_ARCHIVE_LINK_FAILED',trace_id:archive?.trace_id ?? null}) }
}

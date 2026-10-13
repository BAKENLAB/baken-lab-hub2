import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'gpt-5.6-sol'
const PROTOCOL = 'CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013'
const USER_ID = '00000000-0000-0000-0000-000000000001'
const WORKERS = new Set([
  'LOCAL_QUEUE_WEST',
  'LOCAL_QUEUE_KANTO',
  'LOCAL_QUEUE_CHUBU',
  'LOCAL_QUEUE_HOKKAIDO_TOHOKU',
  'LOCAL_QUEUE_RESCUE',
])
const CHECKS = [
  'distance_change','track_change','going_change','class_change','promotion_demotion',
  'weight_change','jockey_change','draw','running_style','pace_peers','margins',
  'passing_order','final_section','trouble','layoff_preparation','current_suitability',
  'same_condition_history',
]

const stringSchema = { type: 'string', minLength: 1 }
const stringArray = { type: 'array', items: { type: 'string' } }
const checkSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['status','finding','evidence_refs'],
  properties: {
    status: { type: 'string', enum: ['CHECKED','MISSING'] },
    finding: stringSchema,
    evidence_refs: stringArray,
  },
}
const reviewChecksProps = Object.fromEntries(CHECKS.map(k => [k, checkSchema]))
const runnerSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'horse_no','horse_name','rank','grade','reason','running_style_reference',
    'recent_runs_checked','evidence_summary','missing_items',
  ],
  properties: {
    horse_no: { type: 'integer', minimum: 1 },
    horse_name: stringSchema,
    rank: { type: 'integer', minimum: 1 },
    grade: { type: 'string', enum: ['S','A','B','C','D','E','F'] },
    reason: stringSchema,
    running_style_reference: {
      type: 'array', minItems: 1, maxItems: 4,
      items: { type: 'string', enum: ['逃','先','差','追','?'] },
    },
    recent_runs_checked: { type: 'integer', minimum: 0, maximum: 5 },
    evidence_summary: stringSchema,
    missing_items: stringArray,
  },
}
const positiveFactorSchema = {type:'object',additionalProperties:false,
 required:['category','reason','evidence_refs','current_relevance'],
 properties:{category:{type:'string',enum:CHECKS},reason:stringSchema,evidence_refs:stringArray,current_relevance:{type:'boolean'}}}
const factorAuditSchema={type:'object',additionalProperties:false,
 required:['horse_no','positive_factors'],properties:{horse_no:{type:'integer',minimum:1},
 positive_factors:{type:'array',maxItems:17,items:positiveFactorSchema}}}
const tieBreakSchema={anyOf:[{type:'null'},{type:'object',additionalProperties:false,
 required:['selected_horse_no','strength_reason','recency_reason','risk_reason','evidence_refs'],
 properties:{selected_horse_no:{type:'integer',minimum:1},strength_reason:stringSchema,
 recency_reason:stringSchema,risk_reason:stringSchema,evidence_refs:stringArray}}]}
const candidateSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'horse_no','rank','upside_trigger','hidden_evidence','finish_path','risk',
    'eye_case','evidence_refs','review_checks',
  ],
  properties: {
    horse_no: { type: 'integer', minimum: 1 },
    rank: { type: 'integer', minimum: 1 },
    upside_trigger: stringSchema,
    hidden_evidence: stringSchema,
    finish_path: stringSchema,
    risk: stringSchema,
    eye_case: { type: 'boolean' },
    evidence_refs: stringArray,
    review_checks: {
      type: 'object',
      additionalProperties: false,
      required: CHECKS,
      properties: reviewChecksProps,
    },
  },
}
const pairSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['horse_nos','preferred_horse_no','criterion','reason','evidence_refs'],
  properties: {
    horse_nos: {
      type: 'array', minItems: 2, maxItems: 2,
      items: { type: 'integer', minimum: 1 },
    },
    preferred_horse_no: { type: ['integer','null'], minimum: 1 },
    criterion: { type: 'string', enum: ['CURRENT_UPSIDE_OVER_BASELINE'] },
    reason: stringSchema,
    evidence_refs: stringArray,
  },
}
const evidenceAuditSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['horse_no','recent_runs_checked','evidence_summary','missing_items'],
  properties: {
    horse_no: { type: 'integer', minimum: 1 },
    recent_runs_checked: { type: 'integer', minimum: 0, maximum: 5 },
    evidence_summary: stringSchema,
    missing_items: stringArray,
  },
}
const eyeSchema = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      required: ['horse_no','horse_name','rank','reason'],
      properties: {
        horse_no: { type: 'integer', minimum: 1 },
        horse_name: stringSchema,
        rank: { type: 'integer', minimum: 1 },
        reason: stringSchema,
      },
    },
  ],
}
const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['runners','top5','eye','bets','summary','bet_strategy','audit'],
  properties: {
    runners: { type: 'array', minItems: 1, maxItems: 20, items: runnerSchema },
    top5: { type: 'array', minItems: 1, maxItems: 5, items: runnerSchema },
    eye: eyeSchema,
    bets: { type: 'array', maxItems: 0, items: { type: 'string' } },
    summary: stringSchema,
    bet_strategy: { type: 'string', enum: ['SUSPENDED_FOR_ABILITY_STABILITY'] },
    audit: {
      type: 'object',
      additionalProperties: false,
      required: [
        'eye_pool_checked','protocol_version','active_runner_nos','execution_profile',
        'eye_reaudit_guard','eye_selected_rank','eye_abstention_reason',
        'all_runners_checked','eye_candidate_audit','market_used_for_eye',
        'rank6_auto_selected','eye_selection_method','runner_evidence_audit',
        'outside_top5_reaudited','eye_pairwise_comparison','eye_positive_factor_audit','eye_tie_break','field_integrity_checked',
        'market_used_for_ranking','eye_audit_specificity_guard',
      ],
      properties: {
        eye_pool_checked: { type: 'array', items: { type: 'integer', minimum: 1 } },
        protocol_version: { type: 'string', enum: [PROTOCOL] },
        active_runner_nos: { type: 'array', minItems: 1, items: { type: 'integer', minimum: 1 } },
        execution_profile: { type: 'string', enum: ['UNIFIED_LOCAL_ABILITY_V1'] },
        eye_reaudit_guard: { type: 'string', enum: ['EYE_REAUDIT_GUARD_20260929'] },
        eye_selected_rank: { type: ['integer','null'], minimum: 1 },
        eye_abstention_reason: stringSchema,
        all_runners_checked: { type: 'boolean', enum: [true] },
        eye_candidate_audit: { type: 'array', items: candidateSchema },
        market_used_for_eye: { type: 'boolean', enum: [false] },
        rank6_auto_selected: { type: 'boolean', enum: [false] },
        eye_selection_method: { type: 'string', enum: ['LOCAL_EYE_FACTOR_COUNT_V1'] },
        runner_evidence_audit: { type: 'array', minItems: 1, items: evidenceAuditSchema },
        outside_top5_reaudited: { type: 'boolean', enum: [true] },
        eye_pairwise_comparison: { type: 'array', maxItems:0, items: pairSchema },
        eye_positive_factor_audit: { type:'array', items: factorAuditSchema },
        eye_tie_break: tieBreakSchema,
        field_integrity_checked: { type: 'boolean', enum: [true] },
        market_used_for_ranking: { type: 'boolean', enum: [false] },
        eye_audit_specificity_guard: { type: 'boolean', enum: [true] },
      },
    },
  },
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
function errText(e: unknown) {
  if (e instanceof Error) return e.message.slice(0, 1000)
  return String(e).slice(0, 1000)
}
function extractOutputText(data: any) {
  for (const item of data?.output ?? []) {
    for (const c of item?.content ?? []) {
      if (c?.type === 'output_text' && typeof c.text === 'string') return c.text
    }
  }
  throw new Error('OPENAI_OUTPUT_TEXT_MISSING')
}
async function secret(client: any, name: string) {
  const { data, error } = await client.rpc('lab_worker_secret_v1', { p_name: name })
  if (error || typeof data !== 'string' || !data) throw new Error('WORKER_SECRET_UNAVAILABLE')
  return data
}
async function releaseClaim(client: any, job: any, message: string, postTime?: string) {
  if (!job?.worker_run_id || !job?.id || !job?.claim_token) return
  const deadline = postTime ? Date.parse(postTime) : NaN
  const dead = Number.isFinite(deadline) && deadline <= Date.now() + 3 * 60 * 1000
  await client.rpc('lab_finish_prediction_job', {
    p_run_id: job.worker_run_id,
    p_job_id: job.id,
    p_claim_token: job.claim_token,
    p_outcome: dead ? 'DEAD' : 'RETRY',
    p_error: message.slice(0, 900),
    p_retry_seconds: 90,
    p_max_attempts: message.includes('timed out') ? 2 : null,
  })
  try {
    await client.rpc('lab_finish_worker_run', {
      p_run_id: job.worker_run_id,
      p_status: dead ? 'FAILED' : 'ABANDONED',
      p_error: message.slice(0, 900),
    })
  } catch (_) {}
}

const compactText = (maxLength = 160) => ({ type: 'string', minLength: 1, maxLength })
const compactRefs = {
  type: 'array', maxItems: 4,
  items: { type: 'string', minLength: 1, maxLength: 1024 },
}
const compactCheckSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 72,
}
const modelRunnerSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['horse_no','rank','grade','reason','evidence_summary'],
  properties: {
    horse_no: { type: 'integer', minimum: 1 },
    rank: { type: 'integer', minimum: 1 },
    grade: { type: 'string', enum: ['S','A','B','C','D','E','F'] },
    reason: compactText(140),
    evidence_summary: compactText(140),
  },
}
const modelPositiveFactorSchema={type:'object',additionalProperties:false,
 required:['category','reason','evidence_refs','current_relevance'],
 properties:{category:{type:'string',enum:CHECKS},reason:compactText(110),
 evidence_refs:compactRefs,current_relevance:{type:'boolean'}}}
const modelTieBreakSchema={anyOf:[{type:'null'},{type:'object',additionalProperties:false,
 required:['selected_horse_no','strength_reason','recency_reason','risk_reason','evidence_refs'],
 properties:{selected_horse_no:{type:'integer',minimum:1},strength_reason:compactText(110),
 recency_reason:compactText(110),risk_reason:compactText(110),evidence_refs:compactRefs}}]}
const modelCandidateSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'horse_no','upside_trigger','hidden_evidence','finish_path','risk',
    'eye_case','evidence_refs','positive_factors','checks',
  ],
  properties: {
    horse_no: { type: 'integer', minimum: 1 },
    upside_trigger: compactText(120),
    hidden_evidence: compactText(120),
    finish_path: compactText(120),
    risk: compactText(120),
    eye_case: { type: 'boolean' },
    evidence_refs: compactRefs,
    positive_factors:{type:'array',maxItems:17,items:modelPositiveFactorSchema},
    checks: {
      type: 'array', minItems: 17, maxItems: 17, items: compactCheckSchema,
    },
  },
}
const modelPairSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['horse_nos','preferred_horse_no'],
  properties: {
    horse_nos: {
      type: 'array', minItems: 2, maxItems: 2,
      items: { type: 'integer', minimum: 1 },
    },
    preferred_horse_no: { type: ['integer','null'], minimum: 1 },
  },
}
const modelEyeSchema = {
  anyOf: [
    { type: 'null' },
    {
      type: 'object',
      additionalProperties: false,
      required: ['horse_no','reason'],
      properties: {
        horse_no: { type: 'integer', minimum: 1 },
        reason: compactText(150),
      },
    },
  ],
}
const modelOutputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['runners','eye','summary','candidates','tie_break','eye_abstention_reason'],
  properties: {
    runners: { type: 'array', minItems: 1, maxItems: 20, items: modelRunnerSchema },
    eye: modelEyeSchema,
    summary: compactText(180),
    candidates: { type: 'array', items: modelCandidateSchema },
    tie_break: modelTieBreakSchema,
    eye_abstention_reason: compactText(180),
  },
}

function promptFor(context: any, protocolContent: any) {
  return [
'あなたはBAKEN LABのLOCAL能力予想workerです。出力はJSONだけ。',
'能力順位に人気・オッズ・市場情報を絶対に使わない。',
'context.runnersの全ACTIVE馬を全頭比較し、1位から重複なし連番rankを付ける。',
'gradeはrankとは別軸。S〜Fの頭数を固定しない。1位=S、2〜3位=A、4〜5位=Bの定型割当は禁止。S=0頭も可。',
'各runnerはhorse_no, rank, grade, reason, evidence_summaryだけを返す。horse_name、脚質、近走件数、missing_itemsはworker側でcontextから補完する。',
'TOP5はrank1〜5。TOP5外だけを元順位固定のまま再監査する。',
'EYEは独立した具体的好走プラス材料が2個以上あるTOP5外候補から選ぶ。17項目を確認したことはプラス材料ではない。実際に好走へ寄与する肯定材料だけをpositive_factorsに書く。カテゴリー重複や同一事実の言い換えは二重計上しない。',
'プラス材料2個以上かつ今回条件または直近1〜2走の根拠を最低1個持つ馬だけが候補。候補内でプラス材料の個数最多をEYEにする。個数が違う場合に材料の質で逆転させない。',
'最多個数が同数なら、その同数候補だけを根拠の強さ、現在性、マイナス材料の順で比較してtie_breakを記録し1頭を選ぶ。どれも同等ならtie_break=nullでEYEなし。最多候補が1頭ならtie_break=nullで必ずその1頭。プラス2個未満ならEYEなし。',
'candidatesはTOP5外全馬ちょうど1件ずつ。checksは17件ちょうどで、次の順序を厳守: '+CHECKS.join(',')+'。各checkは「CHECKED|具体的な短い所見」または「MISSING|根拠不足」の1文字列で返す。',
'各checkのCHECKEDはcontextに根拠がある場合のみ。根拠不足はMISSING。check個別の参照はworker側でcandidateのevidence_refsから補完する。',
'evidence_refsは各馬のcontext.history_source_refsを優先し、無ければcontext.race.current_source_refのみ。URLや参照を捏造しない。',
'positive_factorsは各候補の{category,reason,evidence_refs,current_relevance}。categoryは17項目から1項目1回のみ。CHECKED済みの事実とその出典がある場合に限る。0件も可。tie_breakは同数最多の決着時だけ選出馬番と強さ・現在性・リスク各理由と出典を付ける。',
'eyeは選ぶ場合horse_noとreasonだけ。horse_nameとrankはworker側で補完する。見送る場合はeye=nullでeye_abstention_reasonを具体的に書く。',
'文章は極めて短く具体的に。check findingは短い句、pair reasonも1文以内。重複説明を避ける。',
'市場・人気・オッズは順位にもEYEにも使わない。contextにない事実を推測しない。',
'ACTIVE PROTOCOL CONTENT:\n'+JSON.stringify(protocolContent),
'OFFICIAL COMPACT CONTEXT:\n'+JSON.stringify(context),
  ].join('\n\n')
}

function expandPayload(model: any, context: any) {
  const ctxMap = new Map((context.runners ?? []).map((r: any) => [r.horse_no, r]))
  const seen = new Set<number>()
  const runners = (model.runners ?? []).map((m: any) => {
    const c: any = ctxMap.get(m.horse_no)
    if (!c || seen.has(m.horse_no)) throw new Error('MODEL_RUNNER_MISMATCH')
    seen.add(m.horse_no)
    return {
      horse_no: m.horse_no,
      horse_name: c.horse_name,
      rank: m.rank,
      grade: m.grade,
      reason: m.reason,
      running_style_reference: c.running_style_reference,
      recent_runs_checked: Array.isArray(c.recent_runs) ? c.recent_runs.length : 0,
      evidence_summary: m.evidence_summary,
      missing_items: Array.isArray(c.missing_items) ? c.missing_items : [],
    }
  }).sort((a: any,b: any) => a.rank-b.rank)
  if (runners.length !== (context.runners ?? []).length || seen.size !== runners.length) {
    throw new Error('MODEL_RUNNER_COUNT_MISMATCH')
  }

  const rankMap = new Map(runners.map((r: any) => [r.horse_no, r]))
  const top5 = runners.filter((r: any) => r.rank <= 5)
  const outside = runners.filter((r: any) => r.rank > 5)
  const outsideSet = new Set(outside.map((r: any) => r.horse_no))

  const candidates = (model.candidates ?? []).map((c: any) => {
    const r: any = rankMap.get(c.horse_no)
    if (!r || !outsideSet.has(c.horse_no) || !Array.isArray(c.checks) || c.checks.length !== CHECKS.length) {
      throw new Error('MODEL_CANDIDATE_MISMATCH')
    }
    const refs = Array.isArray(c.evidence_refs) ? c.evidence_refs : []
    const reviewChecks = Object.fromEntries(CHECKS.map((k,i) => {
      const raw = String(c.checks[i] ?? '')
      const cut = raw.indexOf('|')
      const status = raw.slice(0, cut) === 'CHECKED' ? 'CHECKED' : 'MISSING'
      const finding = (cut >= 0 ? raw.slice(cut + 1) : '').trim() || (status === 'CHECKED' ? '確認済み' : '根拠不足')
      return [k, {
        status,
        finding,
        evidence_refs: status === 'CHECKED' ? refs.slice(0,2) : [],
      }]
    }))
    return {
      horse_no: c.horse_no,
      rank: r.rank,
      upside_trigger: c.upside_trigger,
      hidden_evidence: c.hidden_evidence,
      finish_path: c.finish_path,
      risk: c.risk,
      eye_case: c.eye_case,
      evidence_refs: refs,
      review_checks: reviewChecks,
    }
  })

  const pairs: any[] = []
  const factors = (model.candidates??[]).map((c:any)=>({horse_no:c.horse_no,positive_factors:c.positive_factors}))
  const verified = factors.map((r:any)=>{
    const c:any=candidates.find((x:any)=>x.horse_no===r.horse_no)
    const distinct = new Set((r.positive_factors??[]).map((x:any)=>x.category))
    if(!c||distinct.size!==r.positive_factors.length||r.positive_factors.some((x:any)=>c.review_checks[x.category]?.status!=='CHECKED'||!x.evidence_refs?.length||!x.evidence_refs.every((ref:string)=>c.evidence_refs.includes(ref))))throw new Error('MODEL_POSITIVE_FACTOR_UNVERIFIED')
    return {horse_no:r.horse_no,count:r.positive_factors.length,current:r.positive_factors.some((x:any)=>x.current_relevance===true)}
  }).filter((r:any)=>r.count>=2&&r.current)
  const most=verified.length?Math.max(...verified.map((r:any)=>r.count)):0
  const leaders=verified.filter((r:any)=>r.count===most).map((r:any)=>r.horse_no)
  const pick=model.eye?.horse_no??null
  const tie=model.tie_break
  if(leaders.length===0 && (pick!==null||tie!==null))throw new Error('MODEL_EYE_BELOW_MINIMUM')
  if(leaders.length===1 && (pick!==leaders[0]||tie!==null))throw new Error('MODEL_EYE_NOT_MAX_COUNT')
  if(leaders.length>1 && (pick!==null && (!leaders.includes(pick)||!tie||tie.selected_horse_no!==pick)||pick===null && tie!==null))throw new Error('MODEL_EYE_TIE_INVALID')
  if(leaders.length<=1&&tie!==null)throw new Error('MODEL_EYE_TIE_UNEXPECTED')
  if(candidates.some((c:any)=>c.eye_case!==(c.horse_no===pick&&pick!==null)))throw new Error('MODEL_EYE_FLAG_INCONSISTENT')

  let eye: any = null
  if (model.eye) {
    const r: any = rankMap.get(model.eye.horse_no)
    if (!r || !outsideSet.has(model.eye.horse_no)) throw new Error('MODEL_EYE_MISMATCH')
    eye = {
      horse_no: r.horse_no,
      horse_name: r.horse_name,
      rank: r.rank,
      reason: model.eye.reason,
    }
  }

  return {
    runners,
    top5,
    eye,
    bets: [],
    summary: model.summary,
    bet_strategy: 'SUSPENDED_FOR_ABILITY_STABILITY',
    audit: {
      eye_pool_checked: outside.map((r: any) => r.horse_no),
      protocol_version: PROTOCOL,
      active_runner_nos: (context.runners ?? []).map((r: any) => r.horse_no),
      execution_profile: 'UNIFIED_LOCAL_ABILITY_V1',
      eye_reaudit_guard: 'EYE_REAUDIT_GUARD_20260929',
      eye_selected_rank: eye ? eye.rank : null,
      eye_abstention_reason: eye ? 'NOT_APPLICABLE_SELECTED' : model.eye_abstention_reason,
      all_runners_checked: true,
      eye_candidate_audit: candidates,
      market_used_for_eye: false,
      rank6_auto_selected: false,
      eye_selection_method: 'LOCAL_EYE_FACTOR_COUNT_V1',
      runner_evidence_audit: runners.map((r: any) => ({
        horse_no: r.horse_no,
        recent_runs_checked: r.recent_runs_checked,
        evidence_summary: r.evidence_summary,
        missing_items: r.missing_items,
      })),
      outside_top5_reaudited: true,
      eye_pairwise_comparison: pairs,
      eye_positive_factor_audit: factors,
      eye_tie_break: model.tie_break,
      field_integrity_checked: true,
      market_used_for_ranking: false,
      eye_audit_specificity_guard: true,
    },
  }
}

async function callModel(openaiKey: string, context: any, protocolContent: any) {
  const body = {
    model: MODEL,
    store: false,
    reasoning: { effort: 'low' },
    max_output_tokens: 10000,
    input: [
      { role: 'user', content: [{ type: 'input_text', text: promptFor(context, protocolContent) }] },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'local_prediction_compact',
        strict: true,
        schema: modelOutputSchema,
      },
    },
  }
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: 'Bearer '+openaiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(110000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error('OPENAI_'+res.status+':'+JSON.stringify(data).slice(0,800))
  const text = extractOutputText(data)
  let model
  try { model = JSON.parse(text) } catch { throw new Error('OPENAI_INVALID_JSON') }
  return expandPayload(model, context)
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return jsonResponse(405, { ok: false, error: 'POST_REQUIRED' })
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return jsonResponse(503, { ok: false, error: 'SUPABASE_ENV_MISSING' })

  const client = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let job: any = null
  let postTime: string | undefined
  try {
    const expectedToken = await secret(client, 'BAKEN_LOCAL_WORKER_TOKEN')
    if (req.headers.get('x-baken-worker-token') !== expectedToken) {
      return jsonResponse(401, { ok: false, error: 'UNAUTHORIZED' })
    }

    const input = await req.json().catch(() => null)
    const workerId = input?.worker_id
    if (typeof workerId !== 'string' || !WORKERS.has(workerId)) {
      return jsonResponse(400, { ok: false, error: 'WORKER_NOT_ALLOWED' })
    }

    const { data: claim, error: claimError } = await client.rpc('lab_queue_claim_next_v2', {
      p_worker_id: workerId,
    })
    if (claimError) throw new Error('CLAIM:'+claimError.message)
    if (!claim?.claimed) return jsonResponse(200, { ok: true, claimed: false, worker_id: workerId })

    const { data: jobRow, error: jobError } = await client
      .from('lab_prediction_jobs')
      .select('id,race_date,track,race_no,circuit,worker_run_id,claim_token,claimed_by,lease_until,job_status')
      .eq('id', claim.job_id)
      .single()
    if (jobError || !jobRow) throw new Error('JOB_READ:'+(jobError?.message ?? 'missing'))
    job = jobRow

    const contextRes = await fetch(supabaseUrl+'/functions/v1/lab-claimed-context', {
      method: 'POST',
      headers: { authorization: 'Bearer '+serviceKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        run_id: job.worker_run_id,
        job_id: job.id,
        claim_token: job.claim_token,
      }),
      signal: AbortSignal.timeout(45000),
    })
    const contextBody = await contextRes.json().catch(() => ({}))
    if (!contextRes.ok || !contextBody?.ok || !contextBody?.context) {
      throw new Error('CONTEXT_'+contextRes.status+':'+JSON.stringify(contextBody).slice(0,700))
    }
    const context = contextBody.context
    postTime = context?.race?.post_time
    if (context.context_format !== 'COMPACT_V1' ||
        context.field_integrity_checked !== true ||
        context.protocol_version !== PROTOCOL) {
      throw new Error('CONTEXT_CONTRACT_MISMATCH')
    }

    const { data: protocolRow, error: protocolError } = await client
      .from('lab_prediction_protocols')
      .select('version,content')
      .eq('protocol_key','LOCAL_MAIN')
      .eq('is_active',true)
      .single()
    if (protocolError || !protocolRow || protocolRow.version !== PROTOCOL) {
      throw new Error('ACTIVE_PROTOCOL_MISMATCH')
    }

    const openaiKey = await secret(client, 'BAKEN_LOCAL_OPENAI_API_KEY')
    const payload = await callModel(openaiKey, context, protocolRow.content)

    const { data: saved, error: saveError } = await client.rpc('lab_queue_save_prediction_v1', {
      p_job_id: job.id,
      p_user_id: USER_ID,
      p_protocol_version: PROTOCOL,
      p_payload: payload,
      p_original_payload: payload,
    })
    if (saveError || !saved?.ok) {
      throw new Error('SAVE:'+(saveError?.message ?? JSON.stringify(saved)))
    }

    try {
      await client.rpc('lab_finish_worker_run', {
        p_run_id: job.worker_run_id,
        p_status: 'SUCCEEDED',
        p_error: null,
      })
    } catch (_) {}

    console.log(JSON.stringify({
      event: 'LOCAL_AI_WORKER_SAVED',
      worker_id: workerId,
      job_id: job.id,
      race: job.track+job.race_no+'R',
      prediction_id: saved.prediction_id,
      model: MODEL,
    }))
    return jsonResponse(200, {
      ok: true,
      claimed: true,
      saved: true,
      worker_id: workerId,
      job_id: job.id,
      track: job.track,
      race_no: job.race_no,
      prediction_id: saved.prediction_id,
      model: MODEL,
    })
  } catch (e) {
    const message = errText(e)
    console.error(JSON.stringify({ event: 'LOCAL_AI_WORKER_ERROR', job_id: job?.id ?? null, error: message }))
    if (job) {
      try { await releaseClaim(client, job, 'LOCAL_AI_WORKER:'+message, postTime) } catch (_) {}
    }
    return jsonResponse(500, { ok: false, error: message, job_id: job?.id ?? null })
  }
})
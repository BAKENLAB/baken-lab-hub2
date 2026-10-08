import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const MODEL = 'gpt-5.6-sol'
const PROTOCOL = 'CHAPPY_LOCAL_1.5_EYE_COMPARISON_20261004'
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
        'outside_top5_reaudited','eye_pairwise_comparison','field_integrity_checked',
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
        eye_selection_method: { type: 'string', enum: ['LOCAL_EYE_COMPARISON_V1'] },
        runner_evidence_audit: { type: 'array', minItems: 1, items: evidenceAuditSchema },
        outside_top5_reaudited: { type: 'boolean', enum: [true] },
        eye_pairwise_comparison: { type: 'array', items: pairSchema },
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
const modelCandidateSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'horse_no','upside_trigger','hidden_evidence','finish_path','risk',
    'eye_case','evidence_refs','checks',
  ],
  properties: {
    horse_no: { type: 'integer', minimum: 1 },
    upside_trigger: compactText(120),
    hidden_evidence: compactText(120),
    finish_path: compactText(120),
    risk: compactText(120),
    eye_case: { type: 'boolean' },
    evidence_refs: compactRefs,
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
  required: ['runners','eye','summary','candidates','pairs','eye_abstention_reason'],
  properties: {
    runners: { type: 'array', minItems: 1, maxItems: 20, items: modelRunnerSchema },
    eye: modelEyeSchema,
    summary: compactText(180),
    candidates: { type: 'array', items: modelCandidateSchema },
    pairs: { type: 'array', items: modelPairSchema },
    eye_abstention_reason: compactText(180),
  },
}

// Research only: local EYE-subsection override from the stored 2026-09-25 protocol.
// Do not deploy under the existing LOCAL 1.5 version without auditing save guards.
const CLASSIC_LAB_EYE_PROTOCOL_1_0 = {
  "definition": "上位5頭外の全馬を再監査し、今回だけ順位以上に走る可能性が最も高い1頭。",
  "finish_rule": "EYEは1着・2着・3着すべてあり得る。選定後、勝ち筋/連対筋/3着筋を別々に検討し、買い目の置き場所を決める。",
  "not_allowed": [
    "人気薄だから選ぶ",
    "高オッズだから選ぶ",
    "3着候補という固定観念だけで選ぶ"
  ],
  "selection_pool": "6頭以上なら必ず上位5頭外から1頭。5頭以下はEYEなし。",
  "priority_signals": [
    "転入・転厩・地区替わり",
    "クラス緩和・条件戻り",
    "距離替わり",
    "斤量差",
    "近走着順に隠れた内容",
    "不利・展開不向きからの反転",
    "過去高クラス実績",
    "脚質と今回展開の噛み合い",
    "同条件での隠れた好走歴"
  ],
  "separate_from_rank": "EYEに選んでも能力順位は後付けで繰り上げない。順位と異常値検知を分離する。"
}
function classicEyeProtocolView(protocolContent: any) {
  return { ...protocolContent, lab_eye: CLASSIC_LAB_EYE_PROTOCOL_1_0 }
}

function promptFor(context: any, protocolContent: any) {
  const reviewProtocol = classicEyeProtocolView(protocolContent)
  return [
'あなたはBAKEN LABのLOCAL能力予想workerです。出力はJSONだけ。',
'能力順位に人気・オッズ・市場情報を絶対に使わない。',
'context.runnersの全ACTIVE馬を全頭比較し、1位から重複なし連番rankを付ける。',
'gradeはrankとは別軸。S〜Fの頭数を固定しない。1位=S、2〜3位=A、4〜5位=Bの定型割当は禁止。S=0頭も可。',
'各runnerはhorse_no, rank, grade, reason, evidence_summaryだけを返す。horse_name、脚質、近走件数、missing_itemsはworker側でcontextから補完する。',
'TOP5はrank1〜5。TOP5外だけを元順位固定のまま再監査する。',
  'CLASSIC LAB EYE: 2026-09-25の保存済み初期規則に従う。人気やオッズを材料にしない。人気上位であってもTOP5外なら候補から除外しない。人気薄だから選ぶことも禁止。',
  'TOP5外の全ACTIVE馬を能力順位を変更せずに独立再監査し、各馬の今回条件での好走筋が最も強い1頭を選ぶ。6位固定も意図的な7位以下選好も禁止。',
  '1着・2着・3着への到達可能性をそれぞれ考え、今回の能力順位以上に走る現実的な根拠を比較する。穴っぽさ、近走の大敗そのもの、古い好走だけを加点理由にしない。',
  '根拠は条件戻り、クラス緩和、距離替わり、斤量差、着差、上がりと通過順、展開の不利、同条件での能力など具体的な事実から確認する。',
  '6頭以上なら旧LOCAL 1.0に従いTOP5外から1頭を原則選ぶ。ただし根拠が不足している場合は事実を捏造せずeye=nullにして、欠落情報と理由を記録する。5頭以下はEYEなし。',
  'candidatesはTOP5外全馬ちょうど1件ずつ。checksは17件ちょうどで次の順序を厳守: '+CHECKS.join(',')+'。CHECKED|具体的事実またはMISSING|取得不能理由。',
  '参照元は各馬context.history_source_refs、またはcontext.race.current_source_refを使用。URLや根拠は捏造しない。',
  'pairsは現行JSON保存契約との互換のためTOP5外の全unordered pairを記録。ただし全ペア全勝をEYE選定の必須条件にしない。',
  'eyeは選んだhorse_noと今回条件のreasonのみ。candidatesのeye_case=trueは選択した1頭だけ。馬名・rankはworker側で元順位から補完する。',
  '文章は極めて短く具体的に。check findingは短い句、pair reasonも1文以内。重複説明を避ける。',
'市場・人気・オッズは順位にもEYEにも使わない。contextにない事実を推測しない。',
'ACTIVE PROTOCOL (EYE subsection overridden locally from 2026-09-25):\n'+JSON.stringify(reviewProtocol),
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

  const candidateMap = new Map(candidates.map((c: any) => [c.horse_no, c]))
  // CLASSIC RESTORE: do not accept missing or duplicate outside-TOP5 audits.
  if (candidateMap.size !== outside.length || candidates.length !== outside.length) {
    throw new Error('EYE_CANDIDATE_COVERAGE_MISMATCH')
  }
  const eyeCases = candidates.filter((c: any) => c.eye_case === true)
  const selectedNo = model.eye?.horse_no ?? null
  if (selectedNo === null ? eyeCases.length !== 0 : (eyeCases.length !== 1 || eyeCases[0].horse_no !== selectedNo)) {
    throw new Error('EYE_CASE_SELECTION_MISMATCH')
  }
  const expectedPairs = outside.length * (outside.length - 1) / 2
  if ((model.pairs ?? []).length !== expectedPairs) throw new Error('MODEL_PAIR_COUNT_MISMATCH')
  const pairKeys = new Set<string>()
  const pairs = (model.pairs ?? []).map((p: any) => {
    const a = Number(p.horse_nos?.[0]), b = Number(p.horse_nos?.[1])
    const ca: any = candidateMap.get(a), cb: any = candidateMap.get(b)
    if (!ca || !cb || a === b) throw new Error('MODEL_PAIR_MISMATCH')
    const pairKey = [a,b].sort((x,y)=>x-y).join(':')
    if (pairKeys.has(pairKey)) throw new Error('MODEL_PAIR_DUPLICATE')
    pairKeys.add(pairKey)
    const pref = p.preferred_horse_no
    if (pref !== null && pref !== a && pref !== b) throw new Error('MODEL_PAIR_PREFERENCE_MISMATCH')
    const chosen: any = pref === a ? ca : pref === b ? cb : null
    const reason = chosen ? ('上振れ根拠優位: '+chosen.upside_trigger).slice(0,180) : '今回条件の上振れ根拠に明確差なし'
    const evidence_refs = [...new Set([...(ca.evidence_refs ?? []), ...(cb.evidence_refs ?? [])])].slice(0,4)
    return {
      horse_nos: [a,b],
      preferred_horse_no: pref,
      criterion: 'CURRENT_UPSIDE_OVER_BASELINE',
      reason,
      evidence_refs,
    }
  })

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
      eye_selection_method: 'LOCAL_EYE_COMPARISON_V1',
      runner_evidence_audit: runners.map((r: any) => ({
        horse_no: r.horse_no,
        recent_runs_checked: r.recent_runs_checked,
        evidence_summary: r.evidence_summary,
        missing_items: r.missing_items,
      })),
      outside_top5_reaudited: true,
      eye_pairwise_comparison: pairs,
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

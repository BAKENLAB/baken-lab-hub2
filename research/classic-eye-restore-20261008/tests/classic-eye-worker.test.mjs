import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { stripTypeScriptTypes } from 'node:module'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../candidate/local-ai-worker/index.ts', import.meta.url), 'utf8')
const sandbox = { Deno: { serve() {} }, Request, Response, AbortSignal, console }
vm.runInNewContext(
  stripTypeScriptTypes(src.replace(/^import .*\n/gm, '') +
    '\nglobalThis.__prompt = promptFor; globalThis.__expand = expandPayload; globalThis.__checks = CHECKS;'),
  sandbox,
)
const expand = sandbox.__expand
const prompt = sandbox.__prompt
const checkN = sandbox.__checks.length

function fixture(count = 7, eyeNumber = 7) {
  const context = {
    runners: Array.from({ length: count }, (_, i) => ({
      horse_no: i+1, horse_name: 'HORSE'+(i+1),
      running_style_reference: ['先'], recent_runs: [], missing_items: [],
    })),
  }
  const runners = context.runners.map(c => ({
    horse_no: c.horse_no, rank: c.horse_no, grade: 'B',
    reason: 'fixture evidence', evidence_summary: 'fixture evidence',
  }))
  const outsiders = runners.filter(x => x.rank > 5)
  const candidates = outsiders.map(c => ({
    horse_no: c.horse_no,
    upside_trigger: 'verified condition return',
    hidden_evidence: 'verified losing margin',
    finish_path: 'pace and course fit',
    risk: 'class rise',
    eye_case: c.horse_no === eyeNumber,
    evidence_refs: ['fixture-ref'],
    checks: Array.from({length: checkN}, () => 'CHECKED|fixture evidence'),
  }))
  const pairs = []
  for (let a=0;a<outsiders.length;a++) for(let b=a+1;b<outsiders.length;b++)
    pairs.push({horse_nos:[outsiders[a].horse_no,outsiders[b].horse_no],
                preferred_horse_no:outsiders[a].horse_no})
  const model = {
    runners, candidates, pairs,
    eye: eyeNumber === null ? null : {horse_no:eyeNumber,reason:'current condition upside'},
    summary:'fixture', eye_abstention_reason: eyeNumber === null ? 'missing evidence' : 'selected',
  }
  return {model,context}
}

test('restored EYE instructions remove unanimous-pair gate but preserve rank and odds separation',()=>{
  const text = prompt({runners:[]},{})
  assert.match(text,/全候補へのペア全勝は必須にしない/)
  assert.match(text,/6位だから選ぶ/)
  assert.match(text,/人気・オッズ/)
  assert.match(text,/TOP5外/)
})
test('rank7 can be EYE although a pair prefers rank6',()=>{
  const {model,context}=fixture(7,7)
  assert.equal(model.pairs[0].preferred_horse_no,6)
  const p=expand(model,context)
  assert.equal(p.eye.horse_no,7)
  assert.equal(p.top5.length,5)
  assert.deepEqual(Array.from(p.runners.map(x=>x.rank)),[1,2,3,4,5,6,7])
})
test('candidate coverage/duplicates must match outside TOP5',()=>{
  const {model,context}=fixture(7,7)
  model.candidates.pop()
  assert.throws(()=>expand(model,context),/EYE_CANDIDATE_COVERAGE_MISMATCH/)
})
test('EYE flag must refer to selected EYE exactly',()=>{
  const {model,context}=fixture(7,7)
  model.candidates[0].eye_case=true
  assert.throws(()=>expand(model,context),/EYE_CASE_SELECTION_MISMATCH/)
})
test('pair duplicates are rejected',()=>{
  const {model,context}=fixture(8,7)
  model.pairs[1]=model.pairs[0]
  assert.throws(()=>expand(model,context),/MODEL_PAIR_DUPLICATE/)
})
test('rank assignments are not recalculated by the EYE restoration layer',()=>{
  const {model,context}=fixture(7,7)
  const before = model.runners.map(r=>({horse_no:r.horse_no,rank:r.rank,grade:r.grade}))
  const payload = expand(model,context)
  assert.deepEqual(Array.from(payload.runners.map(r=>({horse_no:r.horse_no,rank:r.rank,grade:r.grade}))),before)
})
test('insufficient evidence may return null rather than invented EYE',()=>{
  const {model,context}=fixture(7,null)
  const p=expand(model,context)
  assert.equal(p.eye,null)
})

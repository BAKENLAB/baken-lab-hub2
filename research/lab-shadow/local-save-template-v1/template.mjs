import {CHECKS, VERSION, assertLocalSaveDuringTransition} from './baseline/mcp-v9/local-eye.mjs';
const clone = x => structuredClone(x);
const nonempty = x => typeof x === 'string' && x.trim().length > 0;
const fail = msg => { throw new Error(msg); };
export {CHECKS, VERSION};

// A worksheet, deliberately NOT a save-ready payload. No scoring or ranking.
export function createWorksheet(context) {
  if (context?.context_format !== 'COMPACT_V1' || context?.protocol_version !== VERSION)
    fail('CONTEXT_PROTOCOL');
  if (!Array.isArray(context.runners) || !context.runners.length) fail('CONTEXT_RUNNERS');
  const runners = context.runners.map(r => ({horse_no:r.horse_no, horse_name:r.horse_name,
    rank:null, grade:null, reason:null, running_style_reference:clone(r.running_style_reference)}));
  return {runners, top5:[], eye:null, bets:[], summary:null,
    bet_strategy:'SUSPENDED_FOR_ABILITY_STABILITY', audit:{
      protocol_version:VERSION, execution_profile:'UNIFIED_LOCAL_ABILITY_V1',
      all_runners_checked:false, field_integrity_checked:false,
      market_used_for_ranking:false, market_used_for_eye:false,
      active_runner_nos:context.runners.map(r=>r.horse_no),
      runner_evidence_audit:context.runners.map(r=>({horse_no:r.horse_no,
        recent_runs_checked:false, evidence_summary:null, evidence_facts:[],
        missing_items:clone(r.missing_items ?? [])})),
      outside_top5_reaudited:false, eye_reaudit_guard:'EYE_REAUDIT_GUARD_20260929',
      rank6_auto_selected:false, eye_audit_specificity_guard:false,
      eye_selection_method:'LOCAL_EYE_COMPARISON_V1', eye_pool_checked:[],
      eye_candidate_audit:[], eye_pairwise_comparison:[],
      eye_selected_rank:null, eye_abstention_reason:null}};
}

// Call only AFTER the evaluator has frozen ranks/TOP5. Creates unreviewed slots.
export function createOutsideAuditSlots(payload) {
  const top = new Set(payload.top5.map(r=>r.horse_no));
  const outside = payload.runners.filter(r=>!top.has(r.horse_no));
  const candidates = outside.map(r=>({horse_no:r.horse_no,rank:r.rank,
    upside_trigger:null,hidden_evidence:null,finish_path:null,risk:null,
    eye_case:false,evidence_refs:[],review_checks:Object.fromEntries(CHECKS.map(k=>
      [k,{status:'UNREVIEWED',finding:null,evidence_refs:[]}]))}));
  const pairs=[];
  for(let i=0;i<outside.length;i++) for(let j=i+1;j<outside.length;j++)
    pairs.push({horse_nos:[outside[i].horse_no,outside[j].horse_no],
      preferred_horse_no:null,criterion:'CURRENT_UPSIDE_OVER_BASELINE',reason:null,evidence_refs:[]});
  return {eye_pool_checked:outside.map(r=>r.horse_no),eye_candidate_audit:candidates,
    eye_pairwise_comparison:pairs};
}

// Same normalization as deployed index.ts: evidence references only.
export function normalizeForMcp(payload) {
  const p=clone(payload), a=p.audit;
  const candidates=Array.isArray(a?.eye_candidate_audit)?a.eye_candidate_audit:[];
  const byNo=new Map(candidates.map(c=>[c.horse_no,c]));
  for(const pair of a?.eye_pairwise_comparison ?? []) {
    const refs=[...new Set(pair.horse_nos.flatMap(n=>byNo.get(n)?.evidence_refs ?? [])
      .filter(x=>typeof x==='string' && x.trim().length>0))];
    if(refs.length>0 && refs.length<=64) pair.evidence_refs=refs;
  }
  return p;
}

// Offline structural checks only. Cannot establish truth, identity, freshness,
// current authorization, live claim, deadline, or DB transaction acceptance.
export function validateCompleted(payload, context) {
  if(context?.context_format!=='COMPACT_V1' || context?.protocol_version!==VERSION) fail('CONTEXT_PROTOCOL');
  const before=JSON.stringify(payload);
  const p=normalizeForMcp(payload), a=p.audit;
  assertLocalSaveDuringTransition({circuit:'LOCAL',protocol_version:VERSION,payload:p});
  const expected=context.runners.map(r=>r.horse_no).sort((a,b)=>a-b);
  const actual=p.runners.map(r=>r.horse_no).sort((a,b)=>a-b);
  if(JSON.stringify(expected)!==JSON.stringify(actual)) fail('ACTIVE_SET');
  const ranks=p.runners.map(r=>r.rank).sort((a,b)=>a-b);
  if(ranks.some((n,i)=>n!==i+1)) fail('RANK_SEQUENCE');
  if(p.top5.length!==Math.min(5,p.runners.length)) fail('TOP5_COUNT');
  for(const r of p.runners) {
    if(!['S','A','B','C','D','E','F'].includes(r.grade) || !nonempty(r.reason)) fail('RUNNER_REASON_GRADE');
    if(r.comment!==undefined && r.comment!==r.reason) fail('DISPLAY_REASON_OVERRIDE');
    const original=context.runners.find(x=>x.horse_no===r.horse_no);
    if(r.horse_name!==original.horse_name || JSON.stringify(r.running_style_reference)!==JSON.stringify(original.running_style_reference)) fail('RUNNER_CONTEXT_MISMATCH');
  }
  for(const top of p.top5) {
    const r=p.runners.find(x=>x.horse_no===top.horse_no);
    if(top.rank!==r.rank || top.grade!==r.grade || top.horse_name!==r.horse_name || top.reason!==r.reason) fail('TOP5_CONTENT_MISMATCH');
  }
  for(const key of ['all_runners_checked','field_integrity_checked']) if(a[key]!==true) fail('INCOMPLETE_'+key);
  if(context.field_integrity_checked!==true) fail('CONTEXT_FIELD_UNVERIFIED');
  if(a.protocol_version!==VERSION || a.execution_profile!=='UNIFIED_LOCAL_ABILITY_V1' || a.market_used_for_ranking!==false) fail('DB_AUDIT_FLAGS');
  if(p.runners.length>=6 && (a.outside_top5_reaudited!==true || a.eye_audit_specificity_guard!==true)) fail('INCOMPLETE_OUTSIDE_AUDIT');
  if(JSON.stringify([...a.active_runner_nos].sort((a,b)=>a-b))!==JSON.stringify(expected)) fail('AUDIT_ACTIVE_SET');
  if(!Array.isArray(a.runner_evidence_audit) || a.runner_evidence_audit.length!==expected.length || new Set(a.runner_evidence_audit.map(r=>r.horse_no)).size!==expected.length) fail('RUNNER_AUDIT_SET');
  for(const n of expected) {
    const e=a.runner_evidence_audit.find(r=>r.horse_no===n);
    if(!e || e.recent_runs_checked!==true || !nonempty(e.evidence_summary) || !Array.isArray(e.missing_items)
      || !Array.isArray(e.evidence_facts) || e.evidence_facts.filter(nonempty).length<2
      || new Set(e.evidence_facts).size<2) fail('INCOMPLETE_RUNNER_EVIDENCE');
  }
  if(!nonempty(p.summary)) fail('SUMMARY_MISSING');
  if(JSON.stringify(payload)!==before) fail('INPUT_MUTATED');
  return {format_valid:true,production_save_verified:false,normalized_payload:p};
}

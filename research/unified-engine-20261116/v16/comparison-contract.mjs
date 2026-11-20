// Local observation alignment only. Trusted prestart proof is deliberately absent.
import {checkRecordedChain} from './capture.mjs';
const inputs=new Set(['initial_raw','initial_scoped','initial_response','eval_materials','preview_raw','preview_scoped','save_raw','save_scoped','shadow_raw']);
const required=['initial_raw','initial_scoped','initial_response','eval_materials','save_raw','save_scoped'];
export function compareObservedInputs(legacyTexts,unifiedTexts){
  checkRecordedChain(legacyTexts);checkRecordedChain(unifiedTexts);
  const project=texts=>texts.map(t=>JSON.parse(t)).filter(x=>inputs.has(x.stage)).map(x=>({stage:x.stage,sha256:x.value_sha256,protocol:x.gate.protocol_version,job:x.gate.job_id,run:x.gate.worker_run_id,trace:x.gate.trace_id,active:x.gate.active_roster_sha256}));
  const legacy=project(legacyTexts),unified=project(unifiedTexts);
  const complete=required.every(s=>legacy.some(x=>x.stage===s)&&unified.some(x=>x.stage===s));
  const same=JSON.stringify(legacy)===JSON.stringify(unified);
  return {schema:'V16_OBSERVED_INPUT_ALIGNMENT_V1',input_alignment:!complete?'INCOMPLETE':same?'MATCHED_OBSERVATIONS_ONLY':'MISMATCH',legacy,unified,formal_comparison_allowed:false,unresolved:['AUTHORIZED_EXACT_SOURCE_READER','TRUSTED_PRESTART_WITNESS','LEGACY_INPUT_USE_AND_JUDGEMENT_BINDING','BLINDED_UNIFIED_PRESTART_LOCK'],real_comparisons:0,production_allowed:false};
}

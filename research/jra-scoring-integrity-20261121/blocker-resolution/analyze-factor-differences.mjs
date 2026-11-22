// Diagnostic comparison only. No outcome reads, coefficient fitting, new ranks or saves.
import fs from 'node:fs';
import {collectDeclaredLedger} from '../../../automation/jra-score-ledger/declared-ledger.mjs';
import {checkDeclaredLedger} from '../../../automation/jra-score-ledger/independent-check.mjs';
const weights={recent_score:.30,exact_score:.17,distance_score:.12,track_score:.08,going_score:.07,transition_score:.12,jockey_score:.07};
export function analyzeFactorDifferences(records,legacyRows){
 const current=new Map();const aggregates={};
 for(const race of records){const ledger=collectDeclaredLedger({payload:race.payload});if(!checkDeclaredLedger({ledger,payload:race.payload}).ok)throw Error('CURRENT_DECLARED_LEDGER_INVALID');
  for(const h of ledger.runners){const key=[race.race_date,race.track,race.race_no,h.horse_no].join('/');if(current.has(key))throw Error('DUPLICATE_CURRENT');current.set(key,h);}
 }
 const rows=[],seen=new Set();
 for(const old of legacyRows.filter(x=>x.mode==='cohorts')){
  const key=[old.race_date,old.track,old.race_no,old.horse_no].join('/'),h=current.get(key);if(!h||seen.has(key))throw Error('COMPARISON_COVERAGE');seen.add(key);
  if(h.horse_name!==old.horse_name||h.final_score!==old.frozen_score||h.rank!==old.frozen_rank)throw Error('FROZEN_SOURCE_DRIFT');
  let denominator=0;for(const [k,w] of Object.entries(weights))if(old.components[k]!==null)denominator+=w;
  if(!denominator)throw Error('LEGACY_NOT_SCORABLE');
  const legacy=Object.entries(weights).map(([kind,w])=>({kind,observed_value:old.components[kind],weight:w,present:old.components[kind]!==null,normalized_points:old.components[kind]===null?null:old.components[kind]*w/denominator}));
  const before=legacy.reduce((n,x)=>n+(x.normalized_points??0),0);if(Math.abs(Math.max(0,Math.min(100,before))-old.reconstruction_score)>.005001)throw Error('LEGACY_ARITHMETIC');
  const byKind={},refKinds=new Map();for(const c of h.components){const x=byKind[c.kind]??={points:0,effects:0,source_refs:[]};x.points+=c.points;x.effects++;if(!x.source_refs.includes(c.source_ref))x.source_refs.push(c.source_ref);refKinds.set(c.source_ref,new Set([...(refKinds.get(c.source_ref)??[]),c.kind]));
   const a=aggregates[c.kind]??={points_sum:0,effects:0,horses:new Set()};a.points_sum+=c.points;a.effects++;a.horses.add(key);
  }
  rows.push({race_date:old.race_date,track:old.track,race_no:old.race_no,horse_no:old.horse_no,horse_name:old.horse_name,
   frozen_rank:h.rank,frozen_score:h.final_score,grade:h.grade,
   current_declared:{base:h.base,factors:byKind,review_score:h.review_score,bridge_applied:h.bridge?.applied_delta??null,bridge_recorded:!!h.bridge,final:h.final_score,source_authenticity_verified:false},
   legacy_reconstruction:{score:old.reconstruction_score,research_rank:old.research_rank,data_status:old.data_status,present_weight:denominator,factors:legacy},
   score_gap:h.final_score-old.reconstruction_score,rank_gap:old.research_rank-h.rank,
   current_shared_reference_kinds:[...refKinds].filter(([,k])=>k.size>1).map(([source_ref,k])=>({source_ref,kinds:[...k].sort()})),
   diagnostic_flags:['NO_IDENTICAL_ORIGINAL_CONTEXT','CURRENT_POINTS_SUBMITTED_NOT_GENERATED_BY_RECOVERED_FORMULA','FACTOR_AXES_NOT_EQUIVALENT',...(legacy.some(x=>!x.present)?['LEGACY_MISSING_COMPONENT_RENORMALIZATION']:[])],
   causal_factor_difference_identified:false,official_input_verified:false,production_allowed:false});
 }
 if(seen.size!==current.size)throw Error('COMPARISON_COVERAGE');
 return {scope:'FACTOR_LEDGER_DIAGNOSTIC_NOT_CAUSAL_ATTRIBUTION',races:records.length,horses:rows.length,current_factor_totals:Object.fromEntries(Object.entries(aggregates).map(([k,v])=>[k,{points_sum:v.points_sum,effects:v.effects,horses:v.horses.size}])),same_original_input_verified:0,formal_formula_identified:false,production_allowed:false,rows};
}
export function storedAnalysis(){return analyzeFactorDifferences(JSON.parse(fs.readFileSync(new URL('../observations/nov21-afternoon-extract.json',import.meta.url))),JSON.parse(fs.readFileSync(new URL('../final-connection/actions-replay-comparison.json',import.meta.url))).rows);}
if(process.argv[1]&&new URL(import.meta.url).pathname===process.argv[1]){const r=storedAnalysis();const output=process.argv[2];if(!output)throw Error('OUTPUT_REQUIRED');fs.writeFileSync(output,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify({races:r.races,horses:r.horses,formal_formula_identified:r.formal_formula_identified,same_original_input_verified:r.same_original_input_verified}));}

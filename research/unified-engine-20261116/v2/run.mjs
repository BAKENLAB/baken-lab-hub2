// Full V2 engine entrypoint for already-certified strict inputs (max5R).
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {resolve} from 'node:path';
import {evaluateRaceV2} from './engine.mjs';import {compareCohort,unavailableReport} from '../compare.mjs';import {assertFresh} from './checkpoint.mjs';
export function runStrictFile({inputs,results=null,output}){
 const dir=resolve(output);mkdirSync(dir,{recursive:true});assertFresh([dir+'/selection-lock.json',dir+'/comparison.json']);
 const dataset=JSON.parse(readFileSync(inputs,'utf8'));if(!Array.isArray(dataset.races)||dataset.races.length<1||dataset.races.length>5)throw Error('V2_ONE_TO_FIVE_RACES_ONLY');
 const decisions=dataset.races.map(evaluateRaceV2),events=['INPUT_READ'];
 writeFileSync(dir+'/selection-lock.json',JSON.stringify({mode:'V2_STRICT_CERTIFIED_INPUT_PATH',decisions},null,2)+'\n',{flag:'wx'});events.push('SELECTION_LOCK_WRITTEN');
 let report=unavailableReport('RESULTS_NOT_REQUESTED');
 if(results){const labels=JSON.parse(readFileSync(results,'utf8'));events.push('RESULTS_READ');const records=decisions.map((d,i)=>({...d,baseline:dataset.races[i].baseline,status:d.status==='RANK_READY_RESEARCH_ONLY'?'EVALUATED_RESEARCH_ONLY':d.status,completion:{all_scores_complete:d.status==='RANK_READY_RESEARCH_ONLY',all_eye_audits_complete:d.eye.formal_audit_complete===true}}));report=compareCohort(records,labels.races??[],{captureDefinition:dataset.capture_definition,referenceRaceIds:dataset.reference_race_ids});}
 writeFileSync(dir+'/comparison.json',JSON.stringify({events,report},null,2)+'\n',{flag:'wx'});return {decisions,events,report};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const a=process.argv.slice(2),get=k=>a.includes(k)?a[a.indexOf(k)+1]:null;if(!get('--inputs')||!get('--output'))throw Error('Use --inputs certified.json --output NEW_DIRECTORY [--results official-results.json]');const r=runStrictFile({inputs:get('--inputs'),results:get('--results'),output:get('--output')});console.log(JSON.stringify({races:r.decisions.length,status:r.decisions.map(x=>x.status),events:r.events}));}

import {createLocalResearchOfficialResultReader} from './local-official-result-reader-research.mjs';
import {extractNarResultTable,normalizeNarPastResult} from './local-full-result-evidence-research.mjs';
import {planLocalFieldEvidence,resolveLocalFieldEvidence} from './local-field-evidence-plan-research.mjs';

/** Explicit research invocation only. Inputs must come from an authenticated
 * official pre-freeze witness source. No writes, no rank authority.
 * Existing authorized worker supplies the fetch implementation and Cheerio load.
 * This function is not registered with the production worker or any scheduler.
 */
export async function runLocalFullResultResearch({target,roster,evidence,fetchImpl,load,signal,clock=()=>Date.now(),operationMs=30000,maxPages=40}={}){
 if(typeof fetchImpl!=='function'||typeof load!=='function'||!Number.isInteger(operationMs)||operationMs<100||operationMs>60000)throw Error('INVALID_RESEARCH_INVOCATION');
 const plan=planLocalFieldEvidence({target,roster,evidence,maxPages});
 const deadlineMs=Math.min(clock()+operationMs,Date.parse(target.cutoff),Date.parse(target.post)-300000);
 const reader=createLocalResearchOfficialResultReader({target,parseTable:html=>extractNarResultTable(html,load),normalizeResult:normalizeNarPastResult,fetchImpl,clock});
 const resolved=await resolveLocalFieldEvidence({plan,readNormalizedResult:reader,signal,deadlineMs,clock});
 return {schema:'LOCAL_FULL_RESULT_RESEARCH_RUN_V1',plan: {unique_pages:plan.unique_pages,witnesses:plan.witnesses,planned_pages:plan.jobs.length},...resolved,production_connected:false,rank_authorized:false,market_used:false};
}

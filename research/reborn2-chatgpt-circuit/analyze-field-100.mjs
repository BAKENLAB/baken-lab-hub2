import {readFileSync} from 'node:fs';
import {analyzeField57} from './analyze-field-57.mjs';
import {analyzePace58to77} from './pace-58-77.mjs';
import {analyzeState78to92} from './state-78-92.mjs';
import {analyzeChanges93to100} from './changes-93-100.mjs';
import {auditAll100} from './audit-all-100.mjs';
import {common} from './common-evidence.mjs';
const load=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const canonical=load('../reborn2-canonical/chapter1-100-items.json').groups.flatMap(g=>g.items);
const sourceIndex=load('./source-index-a959571.json');
export function analyzeField100({baseArgs,oppositionArgs,conditionMaterials={},evidence=[],paceMaterials={},stateMaterials={},changeMaterials={}}){
 const {target,roster}=oppositionArgs;
 const ctx={target,roster,evidence};
 const c=common(target,roster,evidence);
 const previous=analyzeField57({baseArgs,oppositionArgs,conditionMaterials});
 const pace=analyzePace58to77({...paceMaterials,...ctx});
 const state=analyzeState78to92({...stateMaterials,...ctx});
 const sections=[{lo:1,hi:32,result:previous.base01to32},{lo:33,hi:42,result:previous.opposition},{lo:43,hi:57,result:previous.conditions},{lo:58,hi:77,result:pace},{lo:78,hi:92,result:state}];
 const priorAudit=auditAll100({...ctx,sections,canonical,sourceIndex});
 const upstream=priorAudit.runners.flatMap(h=>h.items.filter(i=>Number(i.item_id)<=92&&i.analysis_status==='OUTPUT_CANDIDATE'&&i.contract_matched_evidence_ids.length>0).map(i=>({horse_id:h.horse_id,item_id:i.item_id,source_cutoff:target.cutoff,evidence_ids:i.contract_matched_evidence_ids,analysis_status:i.analysis_status})));
 // All evidence used here remains research candidate, including validated-looking upstream flags.
 const changes=analyzeChanges93to100({...changeMaterials,...ctx,upstream});
 sections.push({lo:93,hi:100,result:changes});
 const audit=auditAll100({...ctx,sections,canonical,sourceIndex});
 return {previous,pace,state,changes,audit,release_eligible:false,rank_candidate:null,eye_candidate:null,scoring_authorized:false};
}

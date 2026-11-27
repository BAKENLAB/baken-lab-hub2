import { analyzeField42 } from './analyze-field-42.mjs';
import { analyzeConditions43to57 } from './conditions-43-57.mjs';

// Same target and roster object: no separate unbound condition target or roster.
export function analyzeField57({baseArgs,oppositionArgs,conditionMaterials={}}) {
  const previous=analyzeField42({baseArgs,oppositionArgs});
  const conditions=analyzeConditions43to57({...conditionMaterials,target:oppositionArgs.target,roster:oppositionArgs.roster});
  for(const h of previous.opposition.runners){
    const m=conditions.runners.find(r=>r.horse_no===h.horse_no);
    if(!m||m.horse_id!==h.horse_id)throw Error('IDENTITY_BINDING_MISMATCH');
  }
  return {...previous,conditions,coverage:{...previous.coverage,...conditions.coverage},scoring_authorized:false,final_grade:null};
}

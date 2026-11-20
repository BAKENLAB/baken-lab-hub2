import {selectResearchEye} from '../v2/eye.mjs';
// V2 approval gate is untouched. No research reconstruction is promoted to a
// contemporaneously fixed input merely because archive timestamps precede post.
export function connectFormalEye({ranked,strict_input_attested=false,...args}){
 if(!strict_input_attested)return {status:'BLOCKED_IMMUTABLE_ASOF_INPUT_NOT_ATTESTED',horse_id:null,formal_audit_complete:false};
 if(ranked.some(r=>!Number.isInteger(r.rank))||new Set(ranked.map(r=>r.rank)).size!==ranked.length)return {status:'BLOCKED_INDETERMINATE_INDEPENDENT_RANK',horse_id:null,formal_audit_complete:false};
 return selectResearchEye({...args,ranked});
}

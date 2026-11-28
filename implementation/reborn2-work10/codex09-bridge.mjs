// Isolated integration: same issued capability is the only input to both
// supply inspection and Codex09 computation. No untrusted packet input.
import assert from 'node:assert/strict';
import {prepareNormalSupply} from './normal-supply.mjs';
import {runNormalReview} from '../reborn2-pilot/native-graph-issuance.mjs';
export function reviewNormalWithSupply(capability){
 const supply=prepareNormalSupply(capability); // rejects fixture & unissued graph
 const analysis=runNormalReview(capability);
 assert.equal(analysis.scope,'APPROVED_NATIVE_NORMAL_CANDIDATE_ONLY');
 assert.equal(analysis.sourceGraphDigest,supply.sourceGraphDigest);
 assert.equal(analysis.formal,false);assert.equal(analysis.persistenceAllowed,false);
 assert.deepEqual(analysis.runners.map(h=>h.horse).sort(),supply.field.map(h=>h.horseId).sort());
 for(const h of analysis.runners)assert.equal(h.formalGrade,null);
 return {scope:'LOCAL_NORMAL_CANDIDATE_AND_MATERIAL_REVIEW',supply,analysis,formal:false,persistenceAllowed:false};
}

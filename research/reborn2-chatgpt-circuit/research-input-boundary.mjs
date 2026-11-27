// This guard is intentionally local to research. It is not a production gate deployment.
export function assertFormalInputDisabled(packet){
 if(packet?.research_bridge_only===true||packet?.admission_scope==='ISOLATED_RESEARCH_ONLY'||packet?.formal_admission!==true)throw Error('RESEARCH_INPUT_NOT_FORMALLY_ADMITTED');
 throw Error('FORMAL_CONSUMER_NOT_IMPLEMENTED');
}
export function typedBridgeCoverage(intake,bridge){
 return intake.inspected.map(r=>({evidence_id:r.evidence_id,kind:r.kind,stage:r.stage,bridge_input:bridge.bridge_inputs.some(x=>x.evidence_ids.includes(r.evidence_id)),formal_admission:false,production_eligible:false}));
}

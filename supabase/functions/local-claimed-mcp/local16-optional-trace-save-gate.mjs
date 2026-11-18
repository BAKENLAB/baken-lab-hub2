/** Pre-save validation for *optional* LOCAL1.6 criterion trace.
 * No auto score, no EYE selection, no database writes.
 * Without a trace, the existing official save workflow is unchanged.
 * With a trace, reject if official CLAIM context or trace evidence cannot be verified.
 */
export function verifyOptionalLocal16TraceForSave({protocolVersion,payload,officialContext,auditTrace}={}){
 const trace=payload?.audit?.local16_scoring_trace;
 const absent=trace===undefined||trace===null;
 if(absent)return {status:"NOT_PROVIDED",validated:false};
 if(protocolVersion!=="CHAPPY_LOCAL_1.6_EYE_FACTOR_COUNT_20261013")
  throw Error("LOCAL_16_TRACE_PROTOCOL_MISMATCH");
 if(typeof auditTrace!=="function"||!officialContext||
  officialContext.field_integrity_checked!==true||
  officialContext.protocol_version!==protocolVersion||
  officialContext.local16_scoring_criteria?.status!=="READY_FOR_INDEPENDENT_100_POINT_SCORING")
  throw Error("LOCAL_16_TRACE_CONTEXT_UNAVAILABLE");
 // An explicit ceiling guards against an unbounded optional provenance field.
 let bytes;
 try{bytes=JSON.stringify(trace).length;}catch{throw Error("LOCAL_16_TRACE_INVALID")}
 if(!Number.isFinite(bytes)||bytes<50||bytes>196608)
  throw Error("LOCAL_16_TRACE_INVALID");
 let result;
 try{result=auditTrace({context:officialContext,draft:payload});}
 catch{throw Error("LOCAL_16_TRACE_INVALID")}
 if(result?.ok!==true||result.status!=="STRUCTURALLY_TRACEABLE"||
  result.score_certified!==false||result.point_effect_proven!==false||
  result.rank_changed!==false||result.eye_changed!==false)
  throw Error("LOCAL_16_TRACE_INVALID");
 return {status:"PRESENT_SOURCE_VALIDATED",validated:true,
  documented_horses:result.counts?.horses??null,
  documented_judgments:result.counts?.judgments??null,
  score_certified:false,point_effect_proven:false};
}

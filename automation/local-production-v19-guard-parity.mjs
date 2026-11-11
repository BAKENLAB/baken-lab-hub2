/**
 * LOCAL1.6 pre-save parity check against a pinned deployed v19 validator.
 * This is NOT authorization to bypass save rejection. Only the official
 * local-claimed-mcp can save, with a real CLAIM lease + DB receipt.
 *
 * Call it before starting a fresh MCP save input. Never retry a rejected
 * input, edit prior FROZEN, or silently rewrite banned evidence words.
 */
import {assertLocalSaveDuringTransition} from '../research/local-claimed-prod-guard-v19.mjs';
export function testLocalPayloadBeforeOfficialMcp({
 protocolVersion,payload,currentDeployedMcpVersion=19
}={}){
 if(currentDeployedMcpVersion!==19)
  return {ok:false,code:'DEPLOYED_VALIDATOR_VERSION_CHANGED'};
 if(!payload||!Array.isArray(payload.runners))
  return {ok:false,code:'UNVERIFIED_LOCAL_PAYLOAD'};
 try{
  assertLocalSaveDuringTransition({
   circuit:'LOCAL',protocol_version:protocolVersion,payload
  });
  return {ok:true,code:'PINNED_V19_VALIDATOR_ACCEPTS_STRUCTURE'};
 }catch(e){
  const text=String(e instanceof Error?e.message:e);
  return {ok:false,code:/^LOCAL_EYE_[A-Z_]+$/.test(text)?text:'LOCAL_PREFLIGHT_REJECTED'};
 }
}

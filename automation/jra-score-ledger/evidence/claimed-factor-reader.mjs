// Binds the V16 single authorized read to factor-specific V11 proof verification.
// OFF/unconnected without an explicitly supplied authorized provider; never SQL fallback.
import {readOfficialEvidence} from './reader.mjs';
import {resolveFactorEvidence} from './factor-resolver.mjs';
export async function readClaimedFactorEvidence(args,{authorizedRead,trust,now=()=>Date.now(),timeoutMs=150,components=[]}={}){
 let packet=null;
 const proof=await readOfficialEvidence(args,{trust,now,timeoutMs,
  authorizedRead:typeof authorizedRead==='function'?async(request,options)=>{
   packet=await authorizedRead(request,options);return packet;
  }:undefined});
 if(!packet||!proof.accepted?.length)return {status:'UNRESOLVED',code:proof.code??proof.status,bindings:[],real_verified_histories:0,production_allowed:false};
 return resolveFactorEvidence(packet,{trust:{...trust,now:()=>new Date(now()).toISOString()},components});
}

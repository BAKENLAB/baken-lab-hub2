/**
 * Adapter for the staged LOCAL v14 optional pre-CLAIM lookup callback.
 * Receives the verified runner list *after* normal CLAIM validation, but never
 * acquires historical pages or starts a new CLAIM.
 * A trusted private store implementation is injected by the server owner.
 */
import {lookupLocalCornerSnapshot} from './local-corner-snapshot-handoff.mjs';

export function makeLocalClaimedCornerLookup({store}){
 if(typeof store?.findLatest!=='function')throw new TypeError('PRIVATE_STORE_REQUIRED');
 return async ({race,verifiedRunners},at)=>{
  if(!race||!Array.isArray(verifiedRunners)||!Number.isFinite(at))return null;
  return lookupLocalCornerSnapshot({
   race,officialRunners:verifiedRunners,store,clock:()=>at
  });
 };
}

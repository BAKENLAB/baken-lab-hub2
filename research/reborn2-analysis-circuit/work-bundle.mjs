import { createHash } from 'node:crypto';

// An upstream verifier owns permission and validation of the official document itself.
export async function admitWorkBundle({bytes,manifest,target,verifyOfficial}){
  if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>25_000_000||
      typeof verifyOfficial!=='function'||!manifest?.source_ref||
      createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)
    throw Error('WORK_DOCUMENT_HASH_OR_SOURCE');
  const {circuit,track,raceNo,targetDate,cutoff,postTime}=target;
  if(manifest.circuit!==circuit||manifest.track!==track||manifest.raceNo!==raceNo||manifest.targetDate!==targetDate||
      !(Date.parse(manifest.acquiredAt)<=Date.parse(cutoff)&&Date.parse(cutoff)<Date.parse(postTime)))
    throw Error('WORK_TARGET_OR_TIME');
  const verified=await verifyOfficial(Buffer.from(bytes),structuredClone(manifest),structuredClone(target));
  if(verified?.verified!==true||verified.sha256!==manifest.sha256)throw Error('WORK_EVIDENCE_UNVERIFIED');
  return verified.inputs;
}

export async function analyzeWithWorkBundle({input,bundle,verifyOfficial}){
  const {analyzeField}=await import('./analyze.mjs');
  const {verifiedRoster,verifiedContexts,ratings,localBenchmarkByHorse,opponentsByHorse}=
    await admitWorkBundle({...bundle,verifyOfficial});
  const target=bundle.target;
  if(target.circuit!==input.circuit||target.targetDate!==input.targetDate||target.cutoff!==input.cutoff||
      target.track!==input.track||target.raceNo!==input.raceNo)throw Error('WORK_ANALYSIS_TARGET_MISMATCH');
  return analyzeField({input,verifiedRoster,verifiedContexts,ratings,localBenchmarkByHorse,opponentsByHorse});
}

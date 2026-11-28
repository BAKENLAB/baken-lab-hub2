// Native admission planning only. Exact independently audited Work05 handoff.
// Never send these candidates to a synthetic V48 entry.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ENGINE,sha} from './adapter.mjs';
export const WORK05='720b8de61098c78d9c31e0e422d89f45ce14687f';
export const WORK05_AUDIT='d30cb1123a3f8d2c48f139b9ace4f1ea6011324b';
export const WORK05_BLOB='2dc7d544b915f3ecd2f8648121b87cb3646dfcf9';
const raw=readFileSync(new URL('./work05-native-join-handoff.json',import.meta.url));
const gitBlob=createHash('sha1').update('blob '+raw.length+'\0').update(raw).digest('hex');
assert.equal(gitBlob,WORK05_BLOB,'WORK05_FIXED_BLOB');
const freeze=x=>{if(x&&typeof x==='object'){for(const v of Object.values(x))freeze(v);Object.freeze(x);}return x;};
export const handoff=freeze(JSON.parse(raw));
assert.equal(handoff.schema,'WORK05_NATIVE_JOIN_HANDOFF_1');
assert.equal(handoff.engineCommit,ENGINE);
assert.equal(handoff.scope,'METADATA_ONLY');
assert.equal(handoff.admitted,0);
assert.equal(handoff.codex03.realAdmission,false);
assert.equal(handoff.codex03.engineInput,null);
export const WORK05_DIGEST=sha(raw.toString('utf8'));
export const nativeContract=freeze({
 scope:'DESIGN_ONLY_NO_REAL_ROWS_ACCEPTED',
 target:{required:['issuer','canonicalNativeRaceId','officialAliases','aliasWitnessRefs','venueNativeId','dateJst','raceNo','completeRoster','rosterDigest','cutoff','officialPost','startLower'],rule:'All aliases resolve through independently verified official witnesses; target and all aliases excluded from historical evidence.'},
 horse:{required:['issuer','nativeHorseId','canonicalNativeRaceId','pastHorseNo','rowPointer','nativeRowWitnessRefs'],rule:'No names or null key fallback. Current-card and prior-row identity evidence separate.'},
 aliasWitness:{required:['issuer','canonicalNativeRaceId','originalNativeRef','officialEventRef','officialRowPointer','officialSourceDocumentId','sourceVersion','sourceDigest','proofRefs'],rule:'Candidate tuple is not alias authority. Preserve original prefix, suffix, URL and version.'},
 fieldEvidence:{required:['issuer','canonicalNativeRaceId','nativeHorseId','pastHorseNo','field','typedValue','originalLiteral','sourceDocumentId','version','rowPointer','rootRefs','dependencyRefs','publishedAt','updatedAt','capturedAt','uncertaintyMs','permissionRef'],rule:'Strict field and literal type allowlist to be approved; no unfiltered text or market/target result fields.'},
 correctionWitness:{required:['previousVersionRef','replacementVersionRef','officialCorrectionRef','effectiveAt','proofRefs'],rule:'No later version accepted solely by timestamp or larger version number. All chain members and proof must precede cutoff.'},
 snapshotCustody:{required:['sourceCheckedAt','as_of','captured_at','official_post_time','payloadDigest','rosterDigest','serializerPin','verifiedRosterRef','permissionRef'],rule:'Recompute both digests with exact approved serializer and independently verified roster, not caller-attested booleans.'},
 fieldStates:['HELD_UNVERIFIED_ALIAS','HELD_UNVERIFIED_HORSE','HELD_UNVERIFIED_ARCHIVE_ROW','HELD_CUSTODY','HELD_RIGHTS','MISSING','HELD_AMBIGUOUS','HELD_CONFLICT','HELD_VERSION_LINEAGE','REJECTED_TARGET_ALIAS','REJECTED_AFTER_CUTOFF','VERIFIED_PARTIAL_OBSERVATION'],
 dedup:{
  factKey:[...handoff.dedup.key,'field'],
  versionKey:[...handoff.dedup.versionKey],
  rules:handoff.dedup.rules,
  processingOrder:['verify permission and source custody','verify canonical target and aliases; reject target history','verify event crosswalk and native horse row','verify pre-cutoff source and version lineage','group same canonical event+horse+field only','retain every root and literal; coalesce equal typed values without extra votes','hold conflicting values unless independently verified supersession','retain missing and unmatched original facts as separate partial observations'],
  result:'PLAN_ONLY_NO_FACTS_GROUPED'
 },
 boundaries:{input:'DATA_ONLY_NATIVE_NOT_TEST',full:'BLOCKED',partial:'BLOCKED',realAdmission:false,engineInput:null,projectionAllowed:false,persistenceAllowed:false}
});
export function planWork05(circuit){
 assert.ok(['JRA','LOCAL'].includes(circuit),'WORK05_CIRCUIT');
 const c=circuit==='JRA'?handoff.jra:handoff.local;
 return {schema:'WORK05_NATIVE_JOIN_PLAN_1',work05Commit:WORK05,mainAudit:WORK05_AUDIT,blob:WORK05_BLOB,digest:WORK05_DIGEST,scope:'METADATA_ONLY',circuit,candidateCounts:c.counts,candidateRules:c.require,
 referenceSyntax:circuit==='JRA'?{resultRefPattern:c.resultRefPattern,livePrefix:c.livePrefix,candidateTuple:c.candidateTuple,horseKeyPattern:c.horseKeyPattern,interpretation:'SYNTAX_AND_TUPLE_CANDIDATES_ONLY'}:{nativeHorse:c.nativeHorse,nativeRace:c.nativeRace,source:c.source,interpretation:'RECORDED_ID_AND_ARCHIVE_CANDIDATES_ONLY'},
 nativeContract,blockers:['INDEPENDENT_OFFICIAL_EVENT_ALIAS_WITNESS','OFFICIAL_NATIVE_HORSE_ROW_WITNESS','ORIGINAL_SOURCE_AND_CORRECTION_CUSTODY','APPROVED_SOURCE_RIGHTS','APPROVED_NATIVE_ADMISSION_LAYER','VERIFIED_PROSPECTIVE_ROSTER_AND_TIME',...(circuit==='LOCAL'?['PINNED_PAYLOAD_AND_ROSTER_DIGEST_RECOMPUTATION','INDEPENDENT_ARCHIVE_ROW_BINDING']:[])],admitted:0,joined:0,realAdmission:false,engineInput:null,projectionAllowed:false,persistenceAllowed:false};
}

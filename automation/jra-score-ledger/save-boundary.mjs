// Candidate integration, NOT enabled in production. Calls no DB itself.
import {collectDeclaredLedger,sha} from './declared-ledger.mjs';
import {checkDeclaredLedger} from './independent-check.mjs';
export class IntegrityRefusal extends Error{constructor(code){super('JRA_SCORE_LEDGER_'+code);this.code=code;}}
export async function guardedLedgerSave({payload,context,now,leaseUntil,registry,existingSave}){
 const inputHash=sha({payload,context});
 const clock=()=>Date.parse(typeof now==='function'?now():now);
 const time=clock(),post=Date.parse(context?.race?.post_time),lease=Date.parse(leaseUntil);
 if(!Number.isFinite(time)||!Number.isFinite(post)||!Number.isFinite(lease)||time>=lease||time>=post-180000)throw new IntegrityRefusal('DEADLINE');
 const card=context?.race?.field_payload?.runners;
 if(!Array.isArray(card)||card.some(x=>!['ACTIVE','CANCELLED','EXCLUDED'].includes(x.status)))throw new IntegrityRefusal('ENTRY_STATUS_UNVERIFIED');
 const active=card.filter(x=>x.status==='ACTIVE');
 const ledger=collectDeclaredLedger({payload});const check=checkDeclaredLedger({ledger,payload,officialActive:active});
 if(!check.ok)throw new IntegrityRefusal('ARITHMETIC_OR_FIELD');
 // Registry is deployment-owned, never selected by audit.score_method/engine_id.
 // No fixed coefficient generator or authoritative resolver has been recovered.
 // Default registry is intentionally UNCONNECTED, so do not deploy this boundary.
 if(!registry||registry.state!=='APPROVED'||typeof registry.recompute!=='function'||typeof registry.resolveEvidence!=='function')throw new IntegrityRefusal('APPROVED_GENERATOR_UNCONNECTED');
 if(registry.scope!=='PRODUCTION')throw new IntegrityRefusal('NON_PRODUCTION_REGISTRY');
 if(payload.audit?.score_engine_id!==registry.id||payload.audit?.score_engine_sha256!==registry.sourceSha256)throw new IntegrityRefusal('ENGINE_IDENTITY');
 const proof=await registry.resolveEvidence({context,ledger});
 if(!proof||proof.status!=='VERIFIED'||proof.context_sha256!==sha(context)||!Array.isArray(proof.runner_nos)||proof.runner_nos.length!==active.length||new Set(proof.runner_nos).size!==active.length||active.some(h=>!proof.runner_nos.includes(h.horse_no)))throw new IntegrityRefusal('EVIDENCE_UNVERIFIED');
 const expected=await registry.recompute({context,evidence:proof});
 if(!expected||expected.status!=='VERIFIED'||sha(expected.ledger)!==sha(ledger))throw new IntegrityRefusal('INDEPENDENT_ENGINE_MISMATCH');
 // No field, score, rank, grade, comment, EYE or audit is rewritten by the gate.
 if(clock()>=lease||clock()>=post-180000)throw new IntegrityRefusal('DEADLINE');
 if(sha({payload,context})!==inputHash)throw new IntegrityRefusal('INPUT_CHANGED_DURING_VERIFICATION');
 return existingSave(payload);
}

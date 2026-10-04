# LOCAL 1.4 → 1.5 safe transition — review only

No production write, deployment, migration application, activation or main merge performed.

## Changes

1. candidate/local-protocol.json stays inactive. Its frozen payload contract is now bets=[] and bet_strategy=SUSPENDED_FOR_ABILITY_STABILITY, exactly matching the current save RPC. Existing separate-market-layer documentation does not enable betting or any bet-plan writes.
2. review/local-save-rpc-transition-candidate.sql prepares both explicit supported versions, while preserving the existing single active LOCAL_MAIN version lookup/lock and exact payload version equality. It is the captured production RPC plus a supported-version check only. Existing claim, LOCAL, seven-key, empty-bets, bet-strategy, deadline, immutable-save and completion logic is unchanged. The RPC already followed whichever unique version was active; support is not a bypass of active-version checks.
3. review/db-insert-guard-candidate.sql applies only when circuit=LOCAL AND protocol_version=1.5. Its body has the same early exclusions. It no longer blocks 1.4 during preparation. For 1.5 direct INSERTs, it additionally checks the seven-key payload and suspended-bet contract. Existing 1.4 and JRA guards remain untouched.
4. The LOCAL MCP uses assertLocalSaveDuringTransition: common seven-key/suspended-bet validation for 1.4 and 1.5; independent EYE validation only for 1.5. No context/auth/claim code or normal ranks/TOP5 are changed. Unsupported versions fail closed. Active-version enforcement remains in the transactional RPC.

## Proposed production order (after separate approval only)

1. Register the exact 1.5 candidate as LOCAL_MAIN with is_active=false. Confirm existing unique 1.4 remains active and no copied flags change it. Do not activate by deploying MCP.
2. Install the RPC transition candidate, retaining its active-version equality and all current claim/save protections. Confirm 1.4 remains active.
3. Install the 1.5-only INSERT guard. Confirm 1.4 is excluded at both trigger WHEN and function early return. Existing predictions are not rewritten/scanned for migration.
4. Deploy the LOCAL MCP transition candidate and matching local-eye.mjs. Confirm current 1.4 context/save compatibility. Do not save fabricated test races on production.
5. Complete isolated real PostgreSQL execution, SQL/JS parity, valid 1.4/1.5 live-claim fixtures, null, malformed JSON, direct INSERT, seven-key/bet contracts, frozen rewrite rejection and JRA controls. Present results for final approval. Current local test evidence is not a substitute.
6. Activate 1.5 LAST, atomically deactivate only the identified 1.4 LOCAL_MAIN record and activate only the identified inactive 1.5 record under the existing protocol locking convention. Assert exactly one active LOCAL_MAIN version inside the transaction. Never activate another circuit or mutate prediction rows. No activation SQL was executed or included as an automatic step.
7. Old 1.4 contexts submitted after activation must fail SAVE_PROTOCOL_MISMATCH; reacquire fresh context using existing authorized workflow, never translate or relabel an old payload. After separate approval, verify one future LOCAL unfrozen race, rank/TOP5 identity, complete audit, EYE/null, empty bets and read-back equality.

## Failure handling

Before activation, leave 1.4 active if any preparation step fails; new EYE enforcement cannot block its saves. Keep 1.5 inactive. After activation, stop the LOCAL save entrance before rollback and preserve all FROZEN rows. Restoring the former protocol also restores the invalid mandatory-EYE wording, so do not silently resume it as a compliant final solution. No Scheduled Task changes are part of these files.

## Tests and limits

73 candidate tests PASS / 0 SKIP / 0 FAIL; existing LOCAL MCP tests 138 PASS / 0 SKIP / 0 FAIL, total 211. Active-version transition tests execute the actual patched MCP callback with a stub RPC enforcing version equality; the SQL delta test proves the equality check and original RPC body are preserved. PostgreSQL and Deno execution remain unperformed because the attached environment lacks them and package networking is unavailable. No deployment readiness is claimed.

The INSERT guard intentionally covers 1.5 only; direct legacy 1.4 writers retain existing behavior. This does not create a new active-version check for direct INSERT bypasses. The reviewed normal MCP save path uses the active-version-enforcing RPC. Review all direct-writer permissions before production rollout.

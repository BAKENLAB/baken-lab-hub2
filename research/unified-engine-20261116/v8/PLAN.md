# V8: compare selection designs, not tune scores

Base ba44061a383be64dd8d3fd4b27446fde1d5f49ec. Research/Draft only. No new100-point function, coefficient, missing6-point imputation, allocation change, saved prediction or production operation.

## Comparability limits fixed before V8 measurement

Legacy92 uses saved FROZEN base score/rank + a fixed5-point early bonus and retention/simple early-eligibility EYE. V7 uses an independent reconstructed evidence-score vector and frozen independent-positive EYE audit. Source histories, cutoffs, verification/missingness and normalizations differ. The original legacy base model input/prompt/evaluator is unavailable. A common horse list does not establish identical model input. Strict same-input causal attribution is NOT identifiable.

All623 remain the physical ACTIVE field for old relative-early features: unsupported is not cancelled. The common ranking candidate pool is the577 V7-supported horses. Never assign V7 ranks to the other46. Original legacy eligibility/dense_rank uses the full physical field and is frozen, not recomputed after exclusion.

## Fixed six outputs

L_FULL: exact immutable legacy replay, expected92.
L_MASK_NO_REFILL: original selected set intersect common pool; selection-censoring only, not a valid replenished forecast.
C_LL: common pool, legacy order, legacy EYE policy/evidence.
C_VL: common pool, V7 order, legacy EYE policy/evidence.
C_LV: common pool, legacy order, V7 frozen EYE policy/evidence.
C_VV: common pool, V7 order, V7 frozen EYE; must exactly reproduce83.

Common-pool order means restrict existing order and take up to5; scores never recalculated or transferred across scales. Refill is reported separately from direct exclusions. A nonnull legacy original EYE that enters TOP5/disappears does not authorize a new legacy pick. Reuse the original legacy exact rational comparator. Reuse V4 selectEye with V6 frozen reviews and supported candidates for the V7 policy; verify baseline identity.

R/E4-cell contrasts are conditional fixed-output substitutions. R includes all prior feature/scoring differences encoded in the rank vector. E includes policy AND frozen evidence differences; it is not a pure audit-threshold effect. Report both path orders and interaction; do not force a unique causal split.

Path1:92 -> censor46 -> common legacy refill -> replace rank with legacy EYE fixed -> replace EYE under V7 rank ->83.
Path2: same common legacy endpoint -> replace EYE first -> replace rank ->83.
Count TOP5 and EYE-exclusive hits separately, union deduplicated. Missing result identity/finish remains unverified, not an observed failure.

## Per-horse/source audit

All30 lost and21 new: exact selections in every cell, common/full ranks, candidate eligibility, changed ahead-of-horse competitors, within-V7 cutoff15-axis gaps and requested/atom-shared/root-credited accounting, unknown budget, adopted histories and frozen EYE reasons. No subtraction of legacy score from V7 support score as an ability delta. A lost horse need not be low ability; a gain via EYE need not have improved rank.

Quantify raw/verified history overlap, additional archive inputs, source-before-post vs before-original-FROZEN clocks, all-field-supported21R subset and original input uncertainty. No target outcomes enter case generation. Existing46R are known development data, not holdout.

## Delivery

Freeze case code and tests, commit. Run max5R×10, lock case selections before reading labels, commit every group. Aggregate exact stage/interaction changes and horse tables. Priorities follow comparability/data/contract dependencies, not whichever cell scores highest. Prepare paired future-input contract; current incomplete rubric and trusted input receipt block formal ranking. No Supabase/official fetch needed for this offline task. No main/DB/FROZEN/Cron/deploy/paid API changes.

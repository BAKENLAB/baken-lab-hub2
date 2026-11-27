# Independent test V35 initial audit — 2026-11-28 JST
Target 1c765f3918905445fd90e7bfb9e6f985bde26627; Main42 bc85ea427654eee3c5c001e3d1aeffbb63632179. Read implementation 4e6f18ab25c44a92c8ea741a04b9ea51cfcabb1a and test diff 5c074e00686b0a690fa8799558fc482b3ccfeac3. Existing receipt is not independent execution. 440 configured, 115/118/826 unchanged.
## Static findings
- A gate past.max <= placeThreshold is mandatory even when C supports the current conditional route. H3 LEVEL receipt shows this exact veto. Replace historical placing gate with measured ability/context/opposition evidence and retain scoped counter.
- D gate rejects UNKNOWN only; ROUTE_COUNTER and MIXED are not distinguished by gate. Require matched decisive vs local counter tests, not universal veto.
- EYE filter subject/checkpoint only, not response event. F35-06 asserts scenario equality under toggle, not positive upstream recomputation; also does not assert candidate flip. Test positive admission, withdrawal, counter and negative-only controls with common DAG traces and root deduplication.
- Candidate reduction any A else any B; no S/C path, formal null and overall WIN/PLACE unresolved. No supported current pace or alternative coverage.
- F35-04 implication for A can pass when no A exists; require nonvacuous witness. 
## Independent probes
probe-v35.mjs saved at 6ad69a83851fb66c7dcd1bd84c55e86d2b6ec26c. Run from checkout of this branch: node research/reborn2-independent-tests/probe-v35.mjs. Six diagnostics; IT35-03 is observation only, not completion assertion. Expected IT35-02 failure from source and receipt, not an executed result. No native run yet. No independent PASS count.
## Completion gate
1 current ability: matched same historical response/different current burden and same start/different response with evidence-supported whole-field alternatives.
2 routes: favorable vs adverse winner; nonwinner recovery vs mere closing; lower-rated or unknown leader changes rivals' feasible routes; retain all possible runners.
3 EYE: verified positive root admitted, withdrawn and restored; trace actual common 100-item DAG values, field, routes, axes and candidate; same root duplicate must not add support; negative-only control.
4 five axes: matched causal perturbations and local vs decisive counter; trace roots across axes without independent-vote duplication.
5 SABC: justified multiple S, no S, positive C vs insufficient evidence, no fixed quota; no formal adoption.
All five partial, none independently complete.
## Prospective validation preparation
Before outcome access freeze race IDs, roster, source versions and content hashes, retrieval and publication timestamps, race cutoff in JST, engine commit, rules, route/grade output, exclusions. Require both source availability and version validity before cutoff; unknown timestamps excluded, no retrospective reconstruction counted as prospective. Outcome collector separate, append only after official confirmation. Compare grade-wise win/top3 rates with denominators and uncertainty; race-level capture, S absent/multiple frequency, unknown coverage, missingness, route falsification; report JRA/LOCAL and distance/class strata, no tuning on holdout. Record corrections separately. No betting/odds inputs. No production, DB, FROZEN, deploy, merge, payment or formal adoption. No workflow changes.

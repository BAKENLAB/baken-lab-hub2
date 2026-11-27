#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node --version
for f in *.mjs; do node --check "$f"; done
node work34-v37-completion.mjs
node test-work34-v36-current.mjs
node test-opposition-33-42.mjs
node test-conditions-43-57.mjs
node test-pace-58-77.mjs
node test-state-78-92.mjs
node test-person-identity.mjs
node test-changes-93-100.mjs
node test-all-100.mjs
node test-positive-all-100.mjs
node test-strengthening.mjs
node test-independent-audit-02.mjs
node test-winning-race-structure.mjs
node test-typed-v2.mjs
node test-review-v3.mjs
node test-staged-v4.mjs
node test-derived-v5.mjs
node ../reborn2-analysis-circuit/test.mjs
node ../reborn2-evidence-01-12/test-nar-monthly-materials.mjs
node ../reborn2-evidence-01-12/test-archive-materials.mjs
node ../reborn2-evidence-01-12/test-same-response-handoff.mjs

node run-gemini-seven-first.mjs
node test-gemini-seven-review.mjs
node test-gemini-v2-shared.mjs

node test-v12-shared-stage.mjs

node test-v13-corrected-stage.mjs

node test-four-partial-research.mjs

node test-v15-research.mjs

node test-v16-research.mjs

node test-v17-prototype.mjs

node test-v18-circular.mjs

node test-v19-field.mjs

node test-v20-expression.mjs

node test-v21-expression.mjs

node test-v22-expression.mjs

node test-v22-continuation.mjs

node test-capability-depth-v22.mjs

node test-work22-v23-bridge.mjs

node test-opponent-context-v23.mjs

node test-work23-v24-bridge.mjs

node test-work23-v25-current.mjs

node test-work23-v26-integrated.mjs

node test-work26-v27-integrated.mjs

node test-work27-v28-contrast.mjs

node test-work30-v31-integrated.mjs

node test-work31-v32-integrated.mjs

node test-work32-v33-current.mjs

node test-work33-v33-controlled.mjs

node test-work33-v34-synthesis.mjs


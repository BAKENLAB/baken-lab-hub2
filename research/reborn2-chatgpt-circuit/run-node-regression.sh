#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
node --version
for f in *.mjs; do node --check "$f"; done
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
node ../reborn2-analysis-circuit/test.mjs
node ../reborn2-evidence-01-12/test-nar-monthly-materials.mjs
node ../reborn2-evidence-01-12/test-archive-materials.mjs
node ../reborn2-evidence-01-12/test-same-response-handoff.mjs

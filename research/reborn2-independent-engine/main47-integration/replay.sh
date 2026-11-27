#!/usr/bin/env bash
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
base=65b9fc6da549d537780e5074aaa01b4e2a8dcda1
git -C "$repo" cat-file -e "$base^{commit}"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
git clone --quiet --shared --no-checkout "$repo" "$scratch/source"
cd "$scratch/source"
git switch --quiet --detach "$base"
git apply --check "$here/v42-research.patch"
git apply "$here/v42-research.patch"
export PYTHONDONTWRITEBYTECODE=1
if [[ ${1:-} == --full ]]; then
  bash research/reborn2-chatgpt-circuit/run-node-regression.sh
else
  node research/reborn2-chatgpt-circuit/work36-v42-propagation.mjs
fi
node research/reborn2-chatgpt-circuit/test-v42-eye-intervention.mjs

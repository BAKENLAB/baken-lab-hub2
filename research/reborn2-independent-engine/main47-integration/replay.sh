#!/usr/bin/env bash
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(git -C "$here" rev-parse --show-toplevel)
mode=${1:-}
base=65b9fc6da549d537780e5074aaa01b4e2a8dcda1
if [[ $mode == --work39 ]]; then
  base=9c8401e9735f102a3d25c49aef524681a29d7b2d
fi
git -C "$repo" cat-file -e "$base^{commit}"
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
git clone --quiet --shared --no-checkout "$repo" "$scratch/source"
cd "$scratch/source"
git switch --quiet --detach "$base"
if [[ $mode == --work39 ]]; then
  only=--include=research/reborn2-chatgpt-circuit/work35-v38-completion.mjs
  git apply --check "$only" "$here/v42-research.patch"
  git apply "$only" "$here/v42-research.patch"
  export WORK38_RECEIPT="$scratch/work38.json"
  node research/reborn2-work38/native-replay.mjs
  node research/reborn2-work39/native-replay.mjs
  exit
fi
git apply --check "$here/v42-research.patch"
git apply "$here/v42-research.patch"
export PYTHONDONTWRITEBYTECODE=1
if [[ $mode == --full ]]; then
  bash research/reborn2-chatgpt-circuit/run-node-regression.sh
else
  node research/reborn2-chatgpt-circuit/work36-v42-propagation.mjs
fi
node research/reborn2-chatgpt-circuit/test-v42-eye-intervention.mjs

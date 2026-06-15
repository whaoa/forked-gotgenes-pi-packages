#!/usr/bin/env bash
# Publish packages that were released by release-please.
#
# Expects RELEASES env var containing the JSON output from
# googleapis/release-please-action (all step outputs as JSON).
#
# Usage:
#   RELEASES='{"packages/pi-foo--release_created":"true",...}' ./scripts/publish-released.sh

set -euo pipefail

if [ -z "${RELEASES:-}" ]; then
  echo "Error: RELEASES env var is required" >&2
  exit 1
fi

packages=(
  "packages/pi-autoformat:@gotgenes/pi-autoformat"
  "packages/pi-colgrep:@gotgenes/pi-colgrep"
  "packages/pi-github-tools:@gotgenes/pi-github-tools"
  "packages/pi-nocd:@gotgenes/pi-nocd"
  "packages/pi-permission-system:@gotgenes/pi-permission-system"
  "packages/pi-session-tools:@gotgenes/pi-session-tools"
  "packages/pi-subagents:@gotgenes/pi-subagents"
  "packages/pi-subagents-worktrees:@gotgenes/pi-subagents-worktrees"
)

for entry in "${packages[@]}"; do
  path="${entry%%:*}"
  filter="${entry##*:}"

  released=$(echo "$RELEASES" | jq -r ".\"${path}--release_created\" // \"false\"")
  if [ "$released" = "true" ]; then
    echo "::group::Publishing $filter"
    pnpm --filter "$filter" publish --access public --no-git-checks --provenance
    echo "::endgroup::"
  fi
done

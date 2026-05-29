#!/usr/bin/env bash
# Verify the public surface is type-consumable from the *packaged* tarball,
# exactly as an external developer would consume it — no workspace privileges,
# no publish round-trip.
#
#   1. pnpm pack       — triggers prepack -> build:types -> dist/public.d.ts
#   2. self-containment guard — the emitted .d.ts carries no #src/* aliases
#   3. install the tarball into a throwaway consumer and run tsc against it
set -euo pipefail

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# --- 1. Pack the real tarball (prepack regenerates the declaration) --------
pnpm --dir "$PKG_DIR" pack --pack-destination "$WORK" >/dev/null
TARBALL="$(ls "$WORK"/*.tgz | head -n1)"
echo "Packed: $(basename "$TARBALL")"

# --- 2. Self-containment guard on the emitted declaration ------------------
DTS="$PKG_DIR/dist/public.d.ts"
if grep -q '#src' "$DTS"; then
  echo "FAIL: dist/public.d.ts still references #src/* (not self-contained)" >&2
  grep -n '#src' "$DTS" >&2
  exit 1
fi
for sym in getSubagentsService WorkspaceProvider SubagentsService LifetimeUsage; do
  grep -q "$sym" "$DTS" || { echo "FAIL: '$sym' missing from dist/public.d.ts" >&2; exit 1; }
done
echo "OK: dist/public.d.ts is self-contained and exports the public surface"

# --- 3. Build a throwaway consumer and type-check it against the tarball ----
CONSUMER="$WORK/consumer"
mkdir -p "$CONSUMER"

cat > "$CONSUMER/package.json" <<'JSON'
{ "name": "consumer", "version": "0.0.0", "private": true, "type": "module" }
JSON

cat > "$CONSUMER/tsconfig.json" <<'JSON'
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["probe.ts"]
}
JSON

cat > "$CONSUMER/probe.ts" <<'TS'
import { getSubagentsService, type WorkspaceProvider } from "@gotgenes/pi-subagents";

// Exercise both a value export and a type-only export from the public surface.
const provider: WorkspaceProvider = {
  async prepare() {
    return undefined;
  },
};

void provider;
void getSubagentsService;
TS

# Install the packaged tarball plus the peer deps a real consumer would have.
# --ignore-scripts: a type-check needs no dependency build scripts, and it
# avoids ERR_PNPM_IGNORED_BUILDS in the isolated (--ignore-workspace) consumer,
# which does not inherit the workspace allowBuilds approvals.
pnpm --dir "$CONSUMER" --ignore-workspace --ignore-scripts add \
  "$TARBALL" \
  "@earendil-works/pi-ai@>=0.75.0" \
  "@earendil-works/pi-coding-agent@>=0.75.0" \
  "@earendil-works/pi-tui@>=0.75.0" \
  >/dev/null

# Use the workspace TypeScript against the consumer project; module resolution
# starts from probe.ts, so the tarball and peers resolve from the consumer's
# own node_modules via the package's exports "types" condition.
pnpm --dir "$PKG_DIR" exec tsc -p "$CONSUMER/tsconfig.json"
echo "OK: external consumer type-checks against the packaged @gotgenes/pi-subagents"

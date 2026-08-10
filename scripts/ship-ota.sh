#!/bin/bash
# ship-ota.sh: the one command for shipping app changes over the air.
#
#   ./scripts/ship-ota.sh staging    "fix inbox crash on empty thread"
#   ./scripts/ship-ota.sh production "fix inbox crash on empty thread"
#
# What it does, in order:
#   1. Refuses to ship uncommitted code (commit or stash first).
#   2. Typechecks (blocking) and lints (report-only, the repo has known
#      pre-existing warnings).
#   3. Verifies the update's runtime fingerprint MATCHES the installed build
#      for that channel, so the update cannot silently strand (the eas.json
#      trap that has bitten this team twice).
#   4. Bumps the OTA stamp in src/lib/buildInfo.ts and commits it.
#   5. Publishes to the channel with the correct backend URL and RevenueCat
#      key baked in.
#
# Rules (see TEAM-SHIPPING.md): staging first, check it on a phone, then
# production. If step 3 fails, a native-affecting file changed and the fix
# ships in the next App Store build instead, never by force.
set -euo pipefail
cd "$(dirname "$0")/.."

CHANNEL="${1:-}"
MESSAGE="${2:-}"
if [[ "$CHANNEL" != "staging" && "$CHANNEL" != "production" ]] || [[ -z "$MESSAGE" ]]; then
  echo "usage: ./scripts/ship-ota.sh staging|production \"what changed\""
  exit 1
fi

# Channel wiring. The staging TestFlight build predates the current eas.json,
# so staging publishes temporarily restore the eas.json it was built with
# (commit 79ecd82); production matches the current file. When a NEW TestFlight
# staging build ships, update STAGING_RUNTIME and drop the swap.
PROD_RUNTIME="cfefa2bd8410a6ae275442a30e30a7b9724cc78c"     # builds 15 and 16
STAGING_RUNTIME="8aaf00e0b6e6bcaec0fe1e1e4274417cd0e3db27"  # staging TF build
STAGING_EASJSON_COMMIT="79ecd82"

if [[ "$CHANNEL" == "production" ]]; then
  BRANCH="production"
  EXPECT_RUNTIME="$PROD_RUNTIME"
  ENV_VARS=(
    "EXPO_PUBLIC_API_BASE_URL=https://offerloop-mobile-prod.onrender.com"
    "EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_CzmrakvRLfwKKrtvxvjICLvIjbk"
    "EXPO_PUBLIC_REVIEWER_EMAILS=applereview@offerloop.ai"
  )
else
  BRANCH="preview"
  EXPECT_RUNTIME="$STAGING_RUNTIME"
  ENV_VARS=(
    "APP_VARIANT=preview"
    "EXPO_PUBLIC_API_BASE_URL=https://offerloop-staging.onrender.com"
    "EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_AbwRUeFzOscwAUNHMCiJtxUsKBg"
  )
fi

# CI mode (GitHub Actions): no prompts, no stamp-bump commit; identity comes
# from the EXPO_TOKEN secret and the stamp is the commit hash.
IS_CI="${GITHUB_ACTIONS:-}"

# 1. Clean tree only.
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ABORT: uncommitted changes. Commit (or stash) before shipping."
  git status --short
  exit 1
fi

# Production shipments should have been seen on a phone first.
if [[ "$CHANNEL" == "production" && -z "$IS_CI" ]]; then
  read -r -p "Has this exact code been checked on staging on a real phone? [y/N] " ok
  [[ "$ok" == "y" || "$ok" == "Y" ]] || { echo "Ship to staging first: ./scripts/ship-ota.sh staging \"...\""; exit 1; }
fi

# 2. Typecheck (blocking), lint (report-only).
echo "== typecheck =="
npx tsc --noEmit
echo "== lint (report-only) =="
npm run lint >/dev/null 2>&1 && echo "lint clean" || echo "lint has findings (pre-existing ones are known; run npm run lint to view)"

# 3. Fingerprint gate.
restore_easjson() { git checkout HEAD -- eas.json 2>/dev/null || true; }
trap restore_easjson EXIT
if [[ "$CHANNEL" == "staging" ]]; then
  git show "${STAGING_EASJSON_COMMIT}:eas.json" > eas.json
fi
echo "== verifying runtime fingerprint matches the installed $CHANNEL build =="
if ! env "${ENV_VARS[@]}" CI=1 npx eas-cli fingerprint:compare "$EXPECT_RUNTIME" 2>&1 | grep -q "matches"; then
  restore_easjson
  echo ""
  echo "ABORT: fingerprint mismatch. A native-affecting file changed (eas.json,"
  echo "app.json, a native dependency, or the Expo SDK). This change CANNOT ship"
  echo "over the air; it needs a new App Store build. Add it to the native"
  echo "backlog in TEAM-SHIPPING.md, or revert the native-affecting change."
  exit 1
fi

# 4. Stamp. Locally: bump the OTA stamp and commit it. In CI: the commit
# hash IS the stamp (no bot commits back to main).
if [[ -z "$IS_CI" ]]; then
  python3 - "$CHANNEL" "$MESSAGE" <<'EOF'
import re, sys
channel, message = sys.argv[1], sys.argv[2]
p = 'src/lib/buildInfo.ts'
s = open(p).read()
m = re.search(r"OTA_VERSION = '[a-z]+ v(\d+)'", s)
n = int(m.group(1)) + 1
s = re.sub(r"OTA_VERSION = '[^']*'", f"OTA_VERSION = '{channel} v{n}'", s)
safe = message.replace("'", "\\'")
s = re.sub(r"OTA_NOTES = '[^']*'", f"OTA_NOTES = '{safe}'", s, flags=re.S)
open(p, 'w').write(s)
print(f"stamp: {channel} v{n}")
EOF
  STAMP=$(grep -o "OTA_VERSION = '[^']*'" src/lib/buildInfo.ts | cut -d"'" -f2)
  git add src/lib/buildInfo.ts
  git commit -q -m "chore: OTA ${STAMP}: ${MESSAGE}"
else
  STAMP="${CHANNEL} ci-$(git rev-parse --short HEAD)"
  # Make the stamp visible in Profile > Settings: patch the working copy
  # only (CI discards it; nothing is committed back to main).
  python3 - "$STAMP" "$MESSAGE" <<'EOF'
import re, sys
stamp, message = sys.argv[1], sys.argv[2]
p = 'src/lib/buildInfo.ts'
s = open(p).read()
s = re.sub(r"OTA_VERSION = '[^']*'", f"OTA_VERSION = '{stamp}'", s)
safe = message.replace("'", "\\'")
s = re.sub(r"OTA_NOTES = '[^']*'", f"OTA_NOTES = '{safe}'", s, flags=re.S)
open(p, 'w').write(s)
EOF
fi

# 5. Publish.
echo "== publishing to ${BRANCH} =="
env "${ENV_VARS[@]}" CI=1 npx eas-cli update --branch "$BRANCH" --message "${STAMP}: ${MESSAGE}"
restore_easjson
trap - EXIT

echo ""
echo "SHIPPED ${STAMP} to ${CHANNEL}."
if [[ "$CHANNEL" == "staging" ]]; then
  echo "Check it: force-quit the staging TestFlight app, open it TWICE, confirm"
  echo "Profile > Settings shows '${STAMP}'. Then ship to production."
else
  echo "Live users pick this up on their next two app launches."
fi
echo "Remember to git push."

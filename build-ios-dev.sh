#!/usr/bin/env bash
#
# Interactive iOS development-build launcher for offerloop-mobile.
# Run this in your OWN Terminal (not via Claude Code `!`) — the EAS steps
# need a real TTY for Apple 2FA prompts and the device-registration QR.
#
#   cd ~/offerloop-mobile && ./build-ios-dev.sh
#
set -euo pipefail

cd "$(dirname "$0")"

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }
red() { printf "\033[31m%s\033[0m\n" "$1"; }
ask() { # ask "Question?" -> returns 0 for yes, 1 for no (default yes)
  local reply
  read -r -p "$1 [Y/n] " reply
  [[ -z "$reply" || "$reply" =~ ^[Yy] ]]
}

bold "── Offerloop iOS dev-build launcher ───────────────────────────────"

# 0. Must be in the mobile project, must be logged in.
if [[ ! -f app.json ]] || ! grep -q '"slug": "offerloop-mobile"' app.json; then
  red "Not in ~/offerloop-mobile (no matching app.json). Aborting."
  exit 1
fi
bold "Checking EAS login…"
npx eas-cli whoami || { red "Not logged in. Run: npx eas-cli login"; exit 1; }

# 1. LAN IP sanity check (dev build talks to the local backend over Wi-Fi).
CURRENT_IP="$(ipconfig getifaddr en0 2>/dev/null || true)"
CONFIGURED_IP="$(grep apiBaseUrl app.json | sed -E 's/.*http:\/\/([0-9.]+):.*/\1/')"
echo
bold "Backend reachability"
echo "  app.json apiBaseUrl IP : ${CONFIGURED_IP:-<none>}"
echo "  this Mac's en0 IP      : ${CURRENT_IP:-<none>}"
if [[ -n "$CURRENT_IP" && "$CURRENT_IP" != "$CONFIGURED_IP" ]]; then
  yellow "  ⚠ Mismatch — the app won't reach your backend until app.json matches."
  if ask "  Update app.json apiBaseUrl to http://$CURRENT_IP:5001?"; then
    node -e "const f='app.json',j=require('./'+f);j.expo.extra.apiBaseUrl='http://$CURRENT_IP:5001';require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n');console.log('updated apiBaseUrl')"
  fi
else
  green "  ✓ IP matches (or no override needed)."
fi

# 2. Optional iOS icon fix — drop ios.icon so it falls back to Offerloop icon.png.
echo
bold "iOS app icon"
if grep -q '"icon": "./assets/expo.icon"' app.json; then
  yellow "  ios.icon points at the generic Expo placeholder."
  if ask "  Remove it so iOS uses your Offerloop icon.png?"; then
    node -e "const f='app.json',j=require('./'+f);delete j.expo.ios.icon;require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n');console.log('removed expo.ios.icon')"
    green "  ✓ Fixed — iOS now uses the top-level icon.png."
  else
    yellow "  Left as-is (app will show the Expo logo on the home screen)."
  fi
else
  green "  ✓ No placeholder icon set."
fi

# 3. Commit the working tree — EAS Build archives from git.
echo
bold "Git state (EAS builds from your committed tree)"
if [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  if ask "  Commit all of the above before building?"; then
    read -r -p "  Commit message: " MSG
    git add -A
    git commit -m "${MSG:-chore(mobile): pre-build snapshot}"
    green "  ✓ Committed."
  else
    yellow "  Building from a dirty tree — EAS will snapshot only committed files."
  fi
else
  green "  ✓ Clean tree."
fi

# 4. Register the physical device (skip if already registered).
echo
bold "Device registration"
echo "  Registered devices:"; npx eas-cli device:list 2>/dev/null || true
if ask "  Register a new device now? (needed once per iPhone)"; then
  yellow "  → Choose \"Website\", then OPEN THE PRINTED URL/QR ON YOUR IPHONE to install the profile."
  npx eas-cli device:create
fi

# 5. Build.
echo
if ask "  Start the iOS development build now?"; then
  yellow "  → First build prompts for Apple ID + 2FA, then generates cert + provisioning profile. Answer Yes to letting EAS manage credentials."
  npx eas-cli build --profile development --platform ios
  echo
  green "Build kicked off. When it finishes, install via the printed URL/QR, then run:"
  echo "    npx expo start --dev-client"
else
  yellow "Skipped build. Re-run this script when ready, or: npx eas-cli build --profile development --platform ios"
fi

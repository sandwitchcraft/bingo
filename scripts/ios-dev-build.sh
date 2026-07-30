#!/usr/bin/env bash
#
# Bingo iOS build wizard.
#
# Builds and installs the app on a physical iPhone or an Xcode simulator, the
# way `npx expo run:ios` normally would — except this project's Expo SDK
# version is newer than what Expo Go supports, so Expo Go can't be used and
# this manual build path is required instead. Walks through every step verbosely
# and gives targeted next-steps for the specific failures that tend to show up
# the first time you do this on a machine: missing CocoaPods, low disk space,
# Developer Mode disabled, an unconfigured signing profile, and — the one that
# bites everyone on a first install — iOS refusing to launch a freshly-signed
# app until you manually trust it in Settings.
#
# Two independent choices, both picked interactively at startup or forced with
# a flag.
#
# Where it runs:
#
#   device       A physical iPhone/iPad over USB or wireless debugging. The only
#                target with a real camera, so the only one where the Scan tab
#                actually works — see the simulator note below.
#
#   simulator    An Xcode simulator (defaults to an iPhone 17). No device to
#                plug in, no signing, no Developer Mode, no trust prompt, and a
#                much faster edit loop. But the simulator has no camera, so
#                `useCameraDevice("back")` never resolves and the Scan tab sits
#                on "Loading camera…" forever — History, Settings and the region
#                picker are what's testable there.
#
# How the JS gets in:
#
#   development  JS is served live from Metro on this machine, so the app needs
#                the computer running and reachable on the same network. Gives
#                fast refresh and the dev menu.
#
#   release      The JS bundle is compiled into the .app by Xcode, so the app
#                runs with the computer off or unplugged. Slower to build, no
#                fast refresh, no dev menu — and the only way to judge real
#                performance, since dev builds run JS unoptimized and with
#                debugging hooks attached.
#
# Usage: ./scripts/ios-dev-build.sh [--dev|--release] [--device|--simulator [name]]
#        Run with no flags to be asked which of each you want.

set -uo pipefail

# ---- output helpers -------------------------------------------------------

if [ -t 1 ]; then
  BOLD=$(tput bold); DIM=$(tput dim); RESET=$(tput sgr0)
  RED=$(tput setaf 1); GREEN=$(tput setaf 2); YELLOW=$(tput setaf 3)
  BLUE=$(tput setaf 4); CYAN=$(tput setaf 6)
else
  BOLD=""; DIM=""; RESET=""; RED=""; GREEN=""; YELLOW=""; BLUE=""; CYAN=""
fi

step()    { echo; echo "${BOLD}${BLUE}▶ $*${RESET}"; }
info()    { echo "${DIM}    $*${RESET}"; }
ok()      { echo "${GREEN}  ✔ $*${RESET}"; }
warn()    { echo "${YELLOW}  ⚠ $*${RESET}"; }
fail()    { echo "${RED}  ✘ $*${RESET}"; }
pause()   { echo; read -rp "${CYAN}  Press Enter once that's done (or Ctrl+C to stop)...${RESET}" _; }

die() { fail "$*"; exit 1; }

# ---- arguments ---------------------------------------------------------------

usage() {
  cat <<EOF
Usage: ./scripts/ios-dev-build.sh [--dev|--release] [--device|--simulator [name]]

  (no flags)       Ask which kind of build to make, and where to run it.

  --dev            Development build — JS served live from Metro on this machine.
                   Requires the computer to stay running and reachable.

  -r, --release    Standalone build — JS bundle embedded in the app so it runs
                   with the computer off. No fast refresh; use this for realistic
                   performance testing.

  -d, --device     Run on a connected physical iPhone/iPad.

  -s, --simulator [name]
                   Run on an Xcode simulator instead. Optionally name one
                   ("iPhone 17", "iPad Air 11-inch (M4)", a UDID); defaults to
                   $DEFAULT_SIM_NAME, and asks if that isn't installed.
                   Note: simulators have no camera, so the Scan tab won't work.

  -h, --help       Show this message.
EOF
}

# The simulator the wizard reaches for unless told otherwise. Any installed
# simulator works — this is just the one that doesn't need to be asked about.
DEFAULT_SIM_NAME="iPhone 17"

# Both left empty when no flag is passed, which is the signal to ask further
# down — after the banner, so the questions don't appear before the script says
# what it is. The flags stay available for unattended runs.
BUILD_MODE=""
TARGET=""
SIM_NAME=""
while [ $# -gt 0 ]; do
  case "$1" in
    -r|--release)   BUILD_MODE="release" ;;
    --dev)          BUILD_MODE="dev" ;;
    -d|--device)    TARGET="device" ;;
    -s|--simulator)
      TARGET="simulator"
      # Optional value: consume the next argument only if it's a name rather
      # than the next flag, so `--simulator --release` still parses.
      if [ $# -gt 1 ] && case "$2" in -*) false ;; *) true ;; esac; then
        SIM_NAME="$2"
        shift
      fi
      ;;
    -h|--help)      usage; exit 0 ;;
    *)              fail "Unknown option: $1"; echo; usage; exit 1 ;;
  esac
  shift
done

if [ -n "$SIM_NAME" ] && [ "$TARGET" = "device" ]; then
  die "--simulator and --device are mutually exclusive — pick one."
fi

# ---- setup ------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# Homebrew lives outside the default PATH on a lot of setups (Apple Silicon
# especially) — make sure we can see it and anything it installed.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

BUILD_LOG="$(mktemp -t bingo-ios-build).log"
METRO_LOG="$(mktemp -t bingo-metro).log"
METRO_PID=""

cleanup() {
  if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
    kill "$METRO_PID" 2>/dev/null
  fi
}
trap cleanup EXIT INT TERM

echo "${BOLD}Bingo iOS build wizard${RESET}"

# ---- pick a target -------------------------------------------------------------

# Asked before the build mode because it's the bigger fork: it decides whether
# there's a device to plug in and trust at all. Same TTY rule as below — a
# prompt with nothing to read from would hang, so fall back to the everyday
# case, which is the physical device (the simulator can't run the Scan tab).
if [ -z "$TARGET" ]; then
  if [ -t 0 ]; then
    echo
    echo "  ${BOLD}Where should it run?${RESET}"
    echo
    echo "    1) Physical device ${DIM}— real camera, so the Scan tab works. Needs signing + trust.${RESET}"
    echo "    2) Simulator       ${DIM}— no cable, no signing. No camera: Scan sits on \"Loading camera…\".${RESET}"
    echo
    read -rp "${CYAN}  Which one? [1-2, default 1]: ${RESET}" TARGET_CHOICE
    case "${TARGET_CHOICE:-1}" in
      1) TARGET="device" ;;
      2) TARGET="simulator" ;;
      *) die "\"$TARGET_CHOICE\" isn't one of the options — re-run and pick 1 or 2 (or pass --simulator)." ;;
    esac
  else
    TARGET="device"
  fi
fi

# ---- pick a build mode --------------------------------------------------------

# A flag wins if one was passed. Otherwise ask — but only if there's a terminal
# to ask on, since a prompt with no TTY (piped, CI, background) would just hang
# forever. Development is the safe default there: it's the everyday case.
if [ -z "$BUILD_MODE" ]; then
  if [ -t 0 ]; then
    echo
    echo "  ${BOLD}What kind of build?${RESET}"
    echo
    echo "    1) Development ${DIM}— fast refresh, but only runs while Metro is up on this machine${RESET}"
    echo "    2) Release     ${DIM}— standalone: unplug and go. No fast refresh, slower to build.${RESET}"
    echo
    read -rp "${CYAN}  Which one? [1-2, default 1]: ${RESET}" MODE_CHOICE
    case "${MODE_CHOICE:-1}" in
      1) BUILD_MODE="dev" ;;
      2) BUILD_MODE="release" ;;
      *) die "\"$MODE_CHOICE\" isn't one of the options — re-run and pick 1 or 2 (or pass --release)." ;;
    esac
  else
    BUILD_MODE="dev"
  fi
fi

if [ "$BUILD_MODE" = "release" ]; then
  echo "${GREEN}  Release build — standalone, no Metro needed.${RESET}"
else
  echo "${CYAN}  Development build — Metro will run on this machine.${RESET}"
fi
if [ "$TARGET" = "simulator" ]; then
  echo "${CYAN}  Target: simulator.${RESET}"
  warn "Simulators have no camera. The Scan tab will stay on \"Loading camera…\""
  warn "because useCameraDevice(\"back\") never resolves — that's expected here,"
  warn "not a bug. Use a physical device to test scanning."
else
  echo "${CYAN}  Target: physical device.${RESET}"
fi
echo "${DIM}Project: $PROJECT_DIR${RESET}"
echo "${DIM}Build log: $BUILD_LOG${RESET}"
if [ "$BUILD_MODE" = "dev" ]; then
  echo "${DIM}Metro log: $METRO_LOG${RESET}"
fi

# ---- step 1: disk space ------------------------------------------------------

step "Checking disk space"
AVAIL_KB=$(df -k / | tail -1 | awk '{print $4}')
AVAIL_GB=$((AVAIL_KB / 1024 / 1024))
if [ "$AVAIL_GB" -lt 5 ]; then
  fail "Only ~${AVAIL_GB}GB free on your main disk."
  info "Xcode builds (CocoaPods + DerivedData) need real headroom — under 5GB free"
  info "is where things start failing with ENOSPC mid-build."
  info "Free some space (Apple menu → About This Mac → Storage) then re-run this script."
  exit 1
fi
ok "${AVAIL_GB}GB free — plenty."

# ---- step 2: Xcode -----------------------------------------------------------

step "Checking for Xcode"
if ! xcode-select -p >/dev/null 2>&1; then
  die "Xcode not found. Install it from the App Store, then run: sudo xcode-select --switch /Applications/Xcode.app"
fi
XCODE_VERSION="$(xcodebuild -version 2>/dev/null | head -1)"
ok "Found $XCODE_VERSION"

# ---- step 3: CocoaPods --------------------------------------------------------

step "Checking for CocoaPods"
if command -v pod >/dev/null 2>&1; then
  ok "CocoaPods $(pod --version) already installed"
else
  warn "CocoaPods not found."
  if command -v brew >/dev/null 2>&1; then
    info "Installing via Homebrew — this pulls in Ruby too and can take a couple minutes..."
    if brew install cocoapods; then
      ok "CocoaPods $(pod --version) installed"
    else
      die "Homebrew install failed. Try running 'brew install cocoapods' yourself to see the full error."
    fi
  else
    die "Homebrew isn't installed either. Get it from https://brew.sh, or install CocoaPods manually with: sudo gem install cocoapods"
  fi
fi

# ---- step 4: find a device (or boot a simulator) --------------------------------

list_simulators() {
  local json
  json="$(mktemp -t bingo-sims).json"
  xcrun simctl list devices available --json > "$json" 2>/dev/null
  python3 - "$json" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
# Keys look like "com.apple.CoreSimulator.SimRuntime.iOS-26-5"; anything that
# isn't an iOS runtime (watchOS, tvOS, visionOS) can't run this app.
for runtime, devices in (data.get("devices") or {}).items():
    if "SimRuntime.iOS" not in runtime:
        continue
    version = runtime.rsplit(".", 1)[-1].replace("iOS-", "").replace("-", ".")
    for d in devices:
        if not d.get("isAvailable", False):
            continue
        print("\t".join([
            d.get("udid", ""),
            d.get("name", "Unknown simulator"),
            version,
            d.get("state", "Unknown"),
        ]))
PY
  rm -f "$json"
}

if [ "$TARGET" = "simulator" ]; then

step "Looking for an iOS simulator"

SIMS_TSV="$(list_simulators)"
if [ -z "$SIMS_TSV" ]; then
  fail "No iOS simulators are installed."
  info "Open Xcode → Settings → Components and install an iOS simulator runtime,"
  info "then re-run this script."
  exit 1
fi

SIM_UDIDS=(); SIM_NAMES=(); SIM_RUNTIMES=(); SIM_STATES=()
while IFS=$'\t' read -r udid name runtime state; do
  [ -z "$udid" ] && continue
  SIM_UDIDS+=("$udid")
  SIM_NAMES+=("$name")
  SIM_RUNTIMES+=("$runtime")
  SIM_STATES+=("$state")
done <<< "$SIMS_TSV"

ok "Found ${#SIM_UDIDS[@]} available simulator(s)"

# Match order: an explicitly requested name (or UDID) first, then the default
# iPhone. A requested name that doesn't exist is an error rather than a silent
# fallback — quietly building for a different device than the one asked for is
# the kind of thing you don't notice until you're debugging the wrong screen size.
SIM_INDEX=-1
WANTED="${SIM_NAME:-$DEFAULT_SIM_NAME}"
for i in "${!SIM_UDIDS[@]}"; do
  if [ "${SIM_NAMES[$i]}" = "$WANTED" ] || [ "${SIM_UDIDS[$i]}" = "$WANTED" ]; then
    SIM_INDEX=$i
    break
  fi
done

if [ "$SIM_INDEX" -lt 0 ]; then
  if [ -n "$SIM_NAME" ]; then
    fail "No installed simulator named \"$SIM_NAME\"."
  else
    warn "The default simulator (\"$DEFAULT_SIM_NAME\") isn't installed here."
  fi
  if [ ! -t 0 ]; then
    info "Installed simulators:"
    for i in "${!SIM_UDIDS[@]}"; do
      info "  ${SIM_NAMES[$i]}  (iOS ${SIM_RUNTIMES[$i]})"
    done
    die "Re-run with --simulator \"<one of the names above>\"."
  fi
  echo
  echo "  Installed simulators:"
  for i in "${!SIM_UDIDS[@]}"; do
    echo "    $((i+1))) ${SIM_NAMES[$i]}  ${DIM}(iOS ${SIM_RUNTIMES[$i]}, ${SIM_STATES[$i]})${RESET}"
  done
  echo
  read -rp "${CYAN}  Which one? [1-${#SIM_UDIDS[@]}]: ${RESET}" SIM_CHOICE
  SIM_INDEX=$((SIM_CHOICE - 1))
  if [ "$SIM_INDEX" -lt 0 ] || [ "$SIM_INDEX" -ge "${#SIM_UDIDS[@]}" ]; then
    die "\"$SIM_CHOICE\" isn't one of the options — re-run and pick a number from the list."
  fi
fi

DEVICE_UDID="${SIM_UDIDS[$SIM_INDEX]}"
DEVICE_NAME="${SIM_NAMES[$SIM_INDEX]}"
ok "Using: $DEVICE_NAME (iOS ${SIM_RUNTIMES[$SIM_INDEX]}, $DEVICE_UDID)"

# Booting up front rather than leaving it to `expo run:ios` keeps a boot failure
# (a stale runtime, a simulator wedged from a previous session) from surfacing
# ten minutes later as an install error at the end of a long compile.
if [ "${SIM_STATES[$SIM_INDEX]}" = "Booted" ]; then
  ok "Already booted."
else
  info "Booting it..."
  BOOT_OUT="$(xcrun simctl boot "$DEVICE_UDID" 2>&1)"
  BOOT_EXIT=$?
  # "Unable to boot device in current state: Booted" is a race with something
  # else having booted it, not a failure — everything else is.
  if [ "$BOOT_EXIT" -ne 0 ] && ! echo "$BOOT_OUT" | grep -qi "current state: Booted"; then
    fail "simctl couldn't boot the simulator:"
    echo "${DIM}$BOOT_OUT${RESET}"
    info "A wedged simulator usually clears with: xcrun simctl shutdown all"
    info "(or Simulator → Device → Erase All Content and Settings)."
    exit 1
  fi
  # -b waits for the boot to actually finish; installing into a half-booted
  # simulator fails in ways that read like a build problem.
  xcrun simctl bootstatus "$DEVICE_UDID" -b >/dev/null 2>&1 || true
  ok "Booted."
fi

# The window isn't opened by booting — without this the app installs and runs
# with nothing visible on screen.
info "Bringing the Simulator app to the front..."
open -a Simulator --args -CurrentDeviceUDID "$DEVICE_UDID" 2>/dev/null || open -a Simulator

else

step "Looking for a connected iPhone/iPad"
info "Plug your device in (or have it on the same Wi-Fi with wireless debugging"
info "already trusted from a previous Xcode pairing), and make sure it's unlocked."

list_ios_devices() {
  local json
  json="$(mktemp -t bingo-devices).json"
  xcrun devicectl list devices --json-output "$json" >/dev/null 2>&1
  python3 - "$json" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
for d in data.get("result", {}).get("devices", []):
    hw = d.get("hardwareProperties", {}) or {}
    dp = d.get("deviceProperties", {}) or {}
    cp = d.get("connectionProperties", {}) or {}
    if hw.get("platform") != "iOS" or hw.get("reality") != "physical":
        continue
    print("\t".join([
        hw.get("udid", ""),
        dp.get("name", "Unknown device"),
        dp.get("developerModeStatus", "unknown"),
        cp.get("pairingState", "unknown"),
        cp.get("tunnelState", "unknown"),
    ]))
PY
  rm -f "$json"
}

DEVICES_TSV=""
ATTEMPTS=0
MAX_ATTEMPTS=30   # ~60s of polling before giving up
while [ -z "$DEVICES_TSV" ] && [ "$ATTEMPTS" -lt "$MAX_ATTEMPTS" ]; do
  DEVICES_TSV="$(list_ios_devices)"
  if [ -z "$DEVICES_TSV" ]; then
    ATTEMPTS=$((ATTEMPTS + 1))
    sleep 2
  fi
done

if [ -z "$DEVICES_TSV" ]; then
  die "No iOS devices found after waiting a minute. Plug in / unlock your device and re-run this script."
fi

# Parse into arrays (bash 3.2-safe — no readarray/mapfile, this is what ships on macOS)
UDIDS=(); NAMES=(); DEVMODES=()
while IFS=$'\t' read -r udid name devmode pairing tunnel; do
  [ -z "$udid" ] && continue
  UDIDS+=("$udid")
  NAMES+=("$name")
  DEVMODES+=("$devmode")
done <<< "$DEVICES_TSV"

ok "Found ${#UDIDS[@]} device(s)"

SELECTED_INDEX=0
if [ "${#UDIDS[@]}" -gt 1 ]; then
  echo
  echo "  Multiple devices found:"
  for i in "${!UDIDS[@]}"; do
    echo "    $((i+1))) ${NAMES[$i]}  (${DEVMODES[$i]} dev mode)"
  done
  echo
  read -rp "  Which one? [1-${#UDIDS[@]}]: " CHOICE
  SELECTED_INDEX=$((CHOICE - 1))
fi

DEVICE_UDID="${UDIDS[$SELECTED_INDEX]}"
DEVICE_NAME="${NAMES[$SELECTED_INDEX]}"
DEVICE_DEVMODE="${DEVMODES[$SELECTED_INDEX]}"

ok "Using: $DEVICE_NAME ($DEVICE_UDID)"

if [ "$DEVICE_DEVMODE" != "enabled" ]; then
  warn "Developer Mode is not enabled on this device — the build will succeed but"
  warn "iOS will refuse to launch the app until it's on."
  info "On the device: Settings → Privacy & Security → Developer Mode → toggle on"
  info "→ Restart → after unlocking, confirm \"Turn On\" when prompted."
  pause
fi

fi  # end target split

# Launching by hand is only needed on the recovery paths below, but which tool
# does it differs by target, so both callers go through this.
relaunch_app() {
  if [ "$TARGET" = "simulator" ]; then
    xcrun simctl terminate "$DEVICE_UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
    xcrun simctl launch "$DEVICE_UDID" "$BUNDLE_ID"
  else
    xcrun devicectl device process launch --terminate-existing --device "$DEVICE_UDID" "$BUNDLE_ID"
  fi
}

# ---- step 5: bundle identifier ------------------------------------------------

step "Reading bundle identifier from app.json"
BUNDLE_ID="$(python3 -c "
import json
try:
    print(json.load(open('app.json'))['expo']['ios']['bundleIdentifier'])
except Exception:
    pass
")"
if [ -z "$BUNDLE_ID" ]; then
  die "Couldn't find expo.ios.bundleIdentifier in app.json. Run 'npx expo run:ios' once by hand first — it sets this automatically."
fi
ok "Bundle identifier: $BUNDLE_ID"

# ---- step 6: start Metro independently ----------------------------------------

# Release builds embed the bundle at compile time via Xcode's "Bundle React
# Native code and images" phase, so there's no dev server to run — the whole
# point of the mode is that the app doesn't need this machine afterwards.
if [ "$BUILD_MODE" = "dev" ]; then

# Starting this *before* the build, as its own background process, means it
# keeps running even if `expo run:ios` below exits early (e.g. because launch
# got blocked by an untrusted profile) — that mismatch is exactly what caused
# a "No script URL provided" error the first time this was done by hand.
step "Starting the Metro bundler in the background"

METRO_PORT=8081
EXISTING_PID="$(lsof -ti ":$METRO_PORT" 2>/dev/null || true)"
if [ -n "$EXISTING_PID" ]; then
  warn "Something is already listening on port $METRO_PORT (PID $EXISTING_PID) —"
  warn "almost certainly a Metro instance left running from an earlier session."
  info "Stopping it so this run gets a clean bundler on the port the app expects."
  kill $EXISTING_PID 2>/dev/null || true
  sleep 1
  if lsof -ti ":$METRO_PORT" >/dev/null 2>&1; then
    kill -9 $EXISTING_PID 2>/dev/null || true
    sleep 1
  fi
fi

npx expo start --dev-client > "$METRO_LOG" 2>&1 &
METRO_PID=$!

METRO_ATTEMPTS=0
while ! grep -qi "Waiting on http" "$METRO_LOG" 2>/dev/null; do
  if ! kill -0 "$METRO_PID" 2>/dev/null; then
    fail "Metro exited unexpectedly. Last output:"
    tail -20 "$METRO_LOG"
    die "See $METRO_LOG for the full log."
  fi
  METRO_ATTEMPTS=$((METRO_ATTEMPTS + 1))
  if [ "$METRO_ATTEMPTS" -gt 30 ]; then
    die "Metro didn't come up after 30s. Check $METRO_LOG."
  fi
  sleep 1
done
ok "Metro is up (PID $METRO_PID, log: $METRO_LOG)"

else
  step "Skipping Metro — release builds embed the JS bundle at compile time"
  info "Xcode will run the bundler once during the build and bake the result"
  info "into the .app, so nothing needs to be served at runtime."
fi

# ---- step 7: build + install + launch (with targeted retry per failure) ------

step "Building and installing (this is the slow part — several minutes on a first build while CocoaPods and Xcode compile everything from scratch)"
info "Streaming full output below and also saving it to:"
info "$BUILD_LOG"

# --no-bundler only stops the Expo CLI from starting a *dev server*; Xcode's own
# bundling build phase still runs under Release, which is what embeds the JS.
RUN_ARGS=(--device "$DEVICE_UDID" --no-bundler)
if [ "$BUILD_MODE" = "release" ]; then
  RUN_ARGS+=(--configuration Release)
  info "Release configuration — expect this to take noticeably longer than a dev"
  info "build: the JS is minified and bundled, and native code is optimized."
fi
echo

MAX_BUILD_ATTEMPTS=5
attempt=1
BUILD_EXIT=1
while [ "$attempt" -le "$MAX_BUILD_ATTEMPTS" ]; do
  : > "$BUILD_LOG"
  set +e
  npx expo run:ios "${RUN_ARGS[@]}" 2>&1 | tee "$BUILD_LOG"
  BUILD_EXIT=${PIPESTATUS[0]}
  set -e -o pipefail
  set +e

  if [ "$BUILD_EXIT" -eq 0 ]; then
    ok "Build, install, and launch all succeeded."
    break
  fi

  echo
  fail "Build/install/launch failed (exit $BUILD_EXIT). Checking what went wrong..."

  if [ "$TARGET" = "simulator" ] && grep -qi "building for iOS Simulator, but linking in object file built for iOS\|does not contain .*arm64.*simulator\|Undefined symbols for architecture" "$BUILD_LOG"; then
    # A prebuilt framework without an arm64-simulator slice. This project has
    # two candidates for it — TensorFlowLiteC (react-native-fast-tflite) and
    # Vision Camera's Nitro frameworks — and no amount of retrying fixes it, so
    # stop rather than burn four more attempts.
    fail "A native dependency has no arm64 simulator slice, so it can't link for"
    fail "the simulator on Apple Silicon."
    info "Usually TensorFlowLiteC (react-native-fast-tflite) or a Vision Camera"
    info "framework. Options, cheapest first:"
    info "  • Build for a physical device instead: ./scripts/ios-dev-build.sh --device"
    info "  • Reinstall pods fresh: rm -rf ios/Pods ios/build && npx pod-install"
    info "  • Check the package's release notes for simulator (arm64) support."
    die "Full log: $BUILD_LOG"

  elif [ "$TARGET" = "simulator" ] && grep -qi "Unable to boot\|Failed to install the requested application\|device is not booted\|Invalid device state" "$BUILD_LOG"; then
    fail "The simulator wasn't in a state that could take the install."
    info "Resetting it and retrying — this is usually a simulator left wedged by"
    info "an earlier session."
    xcrun simctl shutdown "$DEVICE_UDID" >/dev/null 2>&1 || true
    sleep 2
    xcrun simctl boot "$DEVICE_UDID" >/dev/null 2>&1 || true
    xcrun simctl bootstatus "$DEVICE_UDID" -b >/dev/null 2>&1 || true
    ok "Simulator rebooted."

  elif [ "$TARGET" = "device" ] && grep -qi "not been explicitly trusted\|invalid code signature\|FBSOpenApplicationServiceErrorDomain" "$BUILD_LOG"; then
    # The app is already built and installed at this point — only the automatic
    # launch attempt was blocked. No need to rebuild; just get it trusted and
    # then launch it directly.
    ok "Build + install succeeded — the app is on the device."
    fail "iOS is refusing to launch it because this signing certificate hasn't been"
    fail "manually trusted on this device yet (normal on the first install)."
    info "On the device: Settings → General → VPN & Device Management → under"
    info "\"Developer App\", tap your Apple ID → Trust \"<your Apple ID>\" → Trust"
    info "again in the confirmation popup."
    pause

    info "Attempting to launch the app now..."
    LAUNCH_OK=1
    for launch_try in 1 2 3 4 5; do
      relaunch_app 2>&1 | tee -a "$BUILD_LOG"
      LAUNCH_EXIT=${PIPESTATUS[0]}
      if [ "$LAUNCH_EXIT" -eq 0 ]; then
        LAUNCH_OK=0
        break
      fi
      warn "Still blocked (attempt $launch_try/5)."
      info "Double-check you tapped Trust in Settings → General → VPN & Device Management,"
      info "including the confirmation popup — it's easy to miss the second tap."
      pause
    done

    if [ "$LAUNCH_OK" -eq 0 ]; then
      ok "App launched."
      BUILD_EXIT=0
      break
    else
      die "Still couldn't launch after several tries. Re-check the trust setting, then re-run this script (the build itself won't need to redo — it'll reuse what's already compiled)."
    fi

  elif grep -qi "no space left on device" "$BUILD_LOG"; then
    fail "Ran out of disk space mid-build."
    info "Free up space, then this script will retry automatically."
    pause

  elif [ "$TARGET" = "device" ] && grep -qi "developer mode disabled\|Developer Mode is not enabled" "$BUILD_LOG"; then
    fail "Developer Mode isn't enabled on the device."
    info "Settings → Privacy & Security → Developer Mode → on → Restart → confirm Turn On."
    pause

  elif grep -qi "No profiles for .* were found\|requires a provisioning profile\|Automatic signing is disabled" "$BUILD_LOG"; then
    fail "No signing/provisioning profile could be generated automatically."
    info "Opening the Xcode workspace so you can fix signing..."
    open "$PROJECT_DIR/ios/"*.xcworkspace 2>/dev/null
    info "In Xcode: select the project in the sidebar → the app target →"
    info "\"Signing & Capabilities\" tab → make sure \"Automatically manage signing\""
    info "is on and a Team is selected (a free \"Personal Team\" is fine). If a red"
    info "error appears, click Xcode's own \"Try Again\" button next to it."
    pause

  elif grep -qi "No device UDID or name matching" "$BUILD_LOG"; then
    if [ "$TARGET" = "simulator" ]; then
      fail "Expo couldn't find the simulator — it may have been shut down mid-build."
      info "Rebooting it and retrying."
      xcrun simctl boot "$DEVICE_UDID" >/dev/null 2>&1 || true
      xcrun simctl bootstatus "$DEVICE_UDID" -b >/dev/null 2>&1 || true
    else
      fail "Expo couldn't find the device (it may have gone to sleep or disconnected)."
      info "Unlock the device and make sure it's still connected."
      pause
    fi

  else
    fail "Unrecognized failure — showing the last 30 lines of the build log:"
    echo "${DIM}"
    tail -30 "$BUILD_LOG"
    echo "${RESET}"
    info "Full log: $BUILD_LOG"
    info "You can also open ios/*.xcworkspace and build directly from Xcode to"
    info "see richer error output."
    die "Stopping — re-run this script once you've addressed the error above."
  fi

  attempt=$((attempt + 1))
done

set -e -o pipefail

if [ "$BUILD_EXIT" -ne 0 ]; then
  die "Gave up after $MAX_BUILD_ATTEMPTS attempts. See $BUILD_LOG for details."
fi

# ---- step 8: confirm the app actually loaded its JS bundle -------------------

# Release builds carry their JS inside the .app, so there's no bundle fetch to
# observe and no local-network prompt to get stuck on — a successful launch is
# all the confirmation available. Everything below is dev-mode only.
if [ "$BUILD_MODE" = "release" ]; then
  step "Done — this build is standalone"
  ok "The JS bundle is embedded in the app on $DEVICE_NAME."
  if [ "$TARGET" = "simulator" ]; then
    info "It stays installed on this simulator until the simulator is erased, and"
    info "needs neither Metro nor this script to run — reopen it from the"
    info "simulator's Home Screen any time."
    echo
    warn "No fast refresh or dev menu. Code changes need a full re-run of this"
    warn "script to reach the simulator."
    warn "And the Scan tab still can't work here: no camera on a simulator."
  else
    info "You can quit this script, unplug the phone, and even shut the computer"
    info "down — the app runs on its own now."
    echo
    warn "Two things to know about a standalone build:"
    info "  • No fast refresh or dev menu. Code changes need a full re-run of this"
    info "    script with --release to reach the device."
    info "  • If it was signed with a free personal Apple ID team, iOS stops"
    info "    launching it after 7 days and you'll need to rebuild. A paid Apple"
    info "    Developer account extends that to a year."
  fi
  echo
  info "Build log: $BUILD_LOG"
  exit 0
fi

# The launch succeeding above only means iOS agreed to *start the process* —
# it says nothing about whether the app then got as far as fetching its JS.
# The very first launch also triggers a "Allow local network access?" iOS
# prompt; if that's missed or denied, the app fails with a red "No script URL
# provided" screen despite the process having launched fine. So: watch Metro's
# own log for proof a bundle request actually came in, and if it doesn't show
# up in time, treat it exactly like the trust step — pause, explain, relaunch.
step "Confirming the app actually loaded its JavaScript"
if [ "$TARGET" = "simulator" ]; then
  # A simulator reaches Metro over localhost on the host itself, so there's no
  # local-network permission in play at all. Failing here means something else —
  # Metro on an unexpected port, or a crash before the bundle request.
  info "The simulator talks to Metro over localhost, so there's no local-network"
  info "prompt to catch here — it should connect on its own."
else
  info "Watch your phone now. On the very first launch, iOS shows an \"Allow"
  info "Bingo to find and connect to devices on your local network?\" prompt —"
  info "tap Allow as soon as it appears. Missing it (or tapping Don't Allow)"
  info "is what causes a red \"No script URL provided\" crash screen instead."
fi
echo

BUNDLE_LOADED=1
for confirm_try in 1 2 3; do
  WAIT_ATTEMPTS=0
  while [ "$WAIT_ATTEMPTS" -lt 20 ]; do
    if grep -qiE "iOS Bundled|Android Bundled" "$METRO_LOG"; then
      BUNDLE_LOADED=0
      break 2
    fi
    WAIT_ATTEMPTS=$((WAIT_ATTEMPTS + 1))
    sleep 1
  done

  warn "Haven't seen the app request its bundle yet (waited 20s)."
  if [ "$confirm_try" -lt 3 ]; then
    if [ "$TARGET" = "simulator" ]; then
      info "Relaunching it — on a simulator this is usually just a slow first"
      info "launch, or the app having been closed before it asked for the bundle."
    else
      info "Most likely it's stuck on the local network permission prompt, or you"
      info "denied it. If you see the prompt, tap Allow now. If you already denied"
      info "it: Settings → Bingo → turn on Local Network, then I'll relaunch it."
      pause
      info "Relaunching..."
    fi
    relaunch_app >> "$BUILD_LOG" 2>&1 || true
  fi
done

if [ "$BUNDLE_LOADED" -eq 0 ]; then
  ok "Confirmed — the app loaded its JavaScript bundle."
elif [ "$TARGET" = "simulator" ]; then
  warn "Still couldn't confirm after a few tries. Open the app by hand from the"
  warn "simulator's Home Screen — Metro is running regardless, so it'll connect"
  warn "as soon as it starts."
  info "If it red-screens instead, the error is in the Metro log below."
else
  warn "Still couldn't confirm after a few tries. The app may still be crash-"
  warn "looping on the permission prompt. Check Settings → Bingo → Local Network"
  warn "is on, then reopen the app by hand from the Home Screen / App Library."
  info "Metro is running regardless, so once it opens successfully it'll connect."
fi

# ---- step 9: hand off to Metro, live ------------------------------------------

step "All set — attaching to the Metro log (Ctrl+C to stop everything)"
echo

tail -f "$METRO_LOG" &
TAIL_PID=$!
trap 'kill "$TAIL_PID" 2>/dev/null; cleanup' EXIT INT TERM
wait "$METRO_PID"

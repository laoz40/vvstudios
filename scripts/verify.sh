#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

deploy_convex=false
e2e_scripts=()
headed_e2e=false

while (( $# > 0 )); do
  case "$1" in
    --convex) deploy_convex=true ;;
    --e2e)
      headed_e2e=false
      case "${2:-}" in
        smoke) e2e_scripts=(test:e2e) ;;
        session-reschedule) e2e_scripts=(test:e2e:session-reschedule); headed_e2e=true ;;
        package-schedule|package) e2e_scripts=(test:e2e:package-schedule); headed_e2e=true ;;
        all) e2e_scripts=(test:e2e:session-reschedule test:e2e:package-schedule); headed_e2e=true ;;
        *) echo "--e2e requires smoke, session-reschedule, package-schedule, or all" >&2; exit 2 ;;
      esac
      shift
      ;;
    --help|-h)
      echo "Usage: bun run verify [--convex] [--e2e smoke|session-reschedule|package-schedule|all]"
      echo "Installs dependencies, runs local checks, optionally deploys Convex, then runs E2E."
      echo "--convex uses the configured dev deployment; no build is run."
      echo "E2E is opt-in for pre-PR verification. all runs complete flows sequentially without duplicate payment tests."
      echo "Payment flows require headed Chromium; display/browser availability is checked before local checks."
      exit 0
      ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

if "$headed_e2e"; then
  if [[ "$(uname -s)" == "Linux" && -z "${DISPLAY:-}" ]]; then
    echo "Payment E2E requires a usable display for headed Chromium. Run pre-PR E2E on a machine with a display." >&2
    exit 1
  fi
  bun -e '
    try {
      const { chromium } = await import("@playwright/test");
      const browser = await chromium.launch({ headless: false, timeout: 10_000 });
      await browser.close();
    } catch {
      console.error("Headed Chromium is unavailable. Check your display, dependencies, and Playwright browser installation before running payment E2E.");
      process.exit(1);
    }
  '
fi

bun install --frozen-lockfile

for check in format lint test typecheck dead-code dupes; do
  bun run "$check"
done

if "$deploy_convex"; then
  bun -e 'if (process.env.CONVEX_DEPLOY_KEY) { console.error("Unset CONVEX_DEPLOY_KEY before deploying the configured dev deployment."); process.exit(1); }'
  if pgrep -f '[/]convex/.* dev( |$)' >/dev/null; then
    echo "Convex dev is already running; omit --convex and let it finish syncing first." >&2
    exit 1
  fi
  bunx convex dev --once
fi

if (( ${#e2e_scripts[@]} > 0 )); then
  bun .agents/skills/verify-vvstudios/doctor.ts
  for e2e_script in "${e2e_scripts[@]}"; do
    if "$headed_e2e"; then
      bun run "$e2e_script" --headed
    else
      bun run "$e2e_script"
    fi
  done
fi

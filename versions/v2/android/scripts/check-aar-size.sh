#!/usr/bin/env bash
# Builds the four SDK release AARs and fails if any exceeds its budget in size-budget.properties.
#
# Uses bundleReleaseAar — the task that produces the exact AAR publishToMavenLocal ships.
# (assembleRelease additionally runs :farmerchat-android-views:verifyReleaseResources, which
# currently fails on the navGraph reference in fc_journey_host.xml — a pre-existing issue that
# does not affect the published AAR.)
#
# Usage: scripts/check-aar-size.sh [--no-build]
set -euo pipefail
cd "$(dirname "$0")/.."

BUDGET_FILE="size-budget.properties"
MODULES=(farmerchat-core farmerchat-android-compose farmerchat-android-views farmerchat-analytics-posthog)

if [[ "${1:-}" != "--no-build" ]]; then
  tasks=()
  for m in "${MODULES[@]}"; do tasks+=(":$m:bundleReleaseAar"); done
  ./gradlew --quiet "${tasks[@]}"
fi

budget_for() {
  # Last "key=value" line wins; comments and blanks ignored.
  grep -E "^[[:space:]]*$1[[:space:]]*=" "$BUDGET_FILE" | tail -n1 | cut -d= -f2 | tr -d '[:space:]'
}

fail=0
printf '%-30s %12s %12s %8s  %s\n' "module" "size(B)" "budget(B)" "used" "status"
printf '%-30s %12s %12s %8s  %s\n' "------" "-------" "---------" "----" "------"
for m in "${MODULES[@]}"; do
  aar="$m/build/outputs/aar/$m-release.aar"
  budget="$(budget_for "$m")"
  if [[ -z "$budget" ]]; then
    printf '%-30s %12s %12s %8s  %s\n' "$m" "-" "-" "-" "NO BUDGET"; fail=1; continue
  fi
  if [[ ! -f "$aar" ]]; then
    printf '%-30s %12s %12s %8s  %s\n' "$m" "-" "$budget" "-" "MISSING AAR"; fail=1; continue
  fi
  size=$(wc -c < "$aar" | tr -d '[:space:]')
  pct=$(( size * 100 / budget ))
  status="ok"
  if (( size > budget )); then status="OVER BUDGET"; fail=1; fi
  printf '%-30s %12s %12s %7s%%  %s\n' "$m" "$size" "$budget" "$pct" "$status"
done

if (( fail )); then
  echo "AAR size check FAILED (budgets: $BUDGET_FILE)" >&2
  exit 1
fi
echo "AAR size check passed."

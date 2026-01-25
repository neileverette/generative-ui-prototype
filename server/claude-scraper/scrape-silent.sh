#!/bin/bash
# Silent scraper - doesn't interrupt the user
# Opens tab in background without activating Chrome window

DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT="$DIR/usage-data.json"

PAGE_TEXT=$(osascript -e '
tell application "Google Chrome"
    # Save currently active app
    set activeApp to (path to frontmost application as text)

    # Create tab without activating window
    set newTab to make new tab at end of tabs of window 1 with properties {URL:"https://claude.ai/settings/usage"}
    delay 5
    set pageText to execute newTab javascript "document.body.innerText"
    close newTab

    # Restore focus to original app (prevent Chrome from stealing focus)
    tell application activeApp to activate

    return pageText
end tell
' 2>/dev/null)

if [ -z "$PAGE_TEXT" ]; then
  echo "[Silent Scraper] Failed to get page text"
  exit 1
fi

# Parse values (same as before)
SESSION_RESET=$(echo "$PAGE_TEXT" | grep -oE "Resets in [0-9]+ (hr [0-9]+ min|min)" | head -1 | sed 's/Resets in //')
SESSION_PCT=$(echo "$PAGE_TEXT" | grep -A5 "Current session" | grep -oE "[0-9]+%" | head -1 | grep -oE "[0-9]+")

ALL_MODELS_RESET=$(echo "$PAGE_TEXT" | grep -A5 "All models" | grep -oE "Resets [A-Za-z]+ [0-9]+:[0-9]+ [AP]M" | head -1 | sed 's/Resets //')
ALL_MODELS_PCT=$(echo "$PAGE_TEXT" | grep -A5 "All models" | grep -oE "[0-9]+%" | head -1 | grep -oE "[0-9]+")

SONNET_RESET=$(echo "$PAGE_TEXT" | grep -A5 "Sonnet only" | grep -oE "Resets [A-Za-z]+ [0-9]+:[0-9]+ [AP]M" | head -1 | sed 's/Resets //')
SONNET_PCT=$(echo "$PAGE_TEXT" | grep -A5 "Sonnet only" | grep -oE "[0-9]+%" | head -1 | grep -oE "[0-9]+")

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$OUTPUT" << EOF
{
  "currentSession": {
    "resetsIn": "${SESSION_RESET:-unknown}",
    "percentageUsed": ${SESSION_PCT:-0}
  },
  "weeklyLimits": {
    "allModels": {
      "resetsIn": "${ALL_MODELS_RESET:-unknown}",
      "percentageUsed": ${ALL_MODELS_PCT:-0}
    },
    "sonnetOnly": {
      "resetsIn": "${SONNET_RESET:-unknown}",
      "percentageUsed": ${SONNET_PCT:-0}
    }
  },
  "lastUpdated": "$NOW"
}
EOF

echo "[Silent Scraper] ✓ Session: ${SESSION_PCT:-0}% | All: ${ALL_MODELS_PCT:-0}% | Sonnet: ${SONNET_PCT:-0}%"

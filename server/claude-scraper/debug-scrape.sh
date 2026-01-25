#!/bin/bash
# Debug version - shows raw page text
DIR="$(cd "$(dirname "$0")" && pwd)"

PAGE_TEXT=$(osascript -e '
tell application "Google Chrome"
    set newTab to make new tab at end of tabs of window 1 with properties {URL:"https://claude.ai/settings/usage"}
    delay 5
    set pageText to execute newTab javascript "document.body.innerText"
    close newTab
    return pageText
end tell
' 2>/dev/null)

echo "=== RAW PAGE TEXT ==="
echo "$PAGE_TEXT"
echo ""
echo "=== SEARCHING FOR PATTERNS ==="
echo ""
echo "Current session lines:"
echo "$PAGE_TEXT" | grep -i "current session" -A 5
echo ""
echo "All models lines:"
echo "$PAGE_TEXT" | grep -i "all models" -A 5
echo ""
echo "Sonnet only lines:"
echo "$PAGE_TEXT" | grep -i "sonnet only" -A 5
echo ""
echo "Any percentage patterns:"
echo "$PAGE_TEXT" | grep -oE "[0-9]+%"

#!/usr/bin/env bash
# Looks over every picture of a camera tour with Claude, one picture at a time, and writes what
# it finds to tour/shots/<tour>/<mode>.jsonl, one line per picture.
#
#   tour/review.sh village defects            # what is wrong (tour/review-defects.md)
#   tour/review.sh village details            # what would make it richer (tour/review-details.md)
#   tour/review.sh village defects port-      # only the pictures whose name holds "port-"
#   MODEL=claude-fable-5-1 tour/review.sh village details
#
# Take the pictures first: open http://localhost:8742/?tour=village with the dev server running
# (see src/tour.js). Needs the Claude Code CLI (`claude`) on the PATH.
set -euo pipefail
cd "$(dirname "$0")/.."

tour=${1:?usage: tour/review.sh <tour> <defects|details> [filter]}
mode=${2:?usage: tour/review.sh <tour> <defects|details> [filter]}
filter=${3:-}
model=${MODEL:-claude-opus-5-5}
dir="tour/shots/$tour"
prompt="tour/review-$mode.md"
out="$dir/$mode.jsonl"

[[ -f "$dir/manifest.json" ]] || { echo "no tour in $dir: take it first (?tour=$tour)" >&2; exit 1; }
[[ -f "$prompt" ]] || { echo "no prompt $prompt" >&2; exit 1; }
command -v claude >/dev/null || { echo "the claude CLI is not on the PATH" >&2; exit 1; }
: > "$out"

bun -e "
const shots = JSON.parse(require('fs').readFileSync('$dir/manifest.json', 'utf8'));
for (const s of shots) if ('$filter' === '' || s.file.includes('$filter')) console.log(JSON.stringify(s));
" | while IFS= read -r shot; do
  file=$(bun -e "console.log(JSON.parse(process.argv[1]).file)" "$shot")
  echo "→ $file" >&2
  answer=$(claude -p "$(cat "$prompt")

Manifest entry: $shot

The picture: $dir/$file (read it with the Read tool)." \
    --model "$model" --allowedTools Read --output-format text < /dev/null || echo '[]')
  # Keep the JSON array, whatever the model wrote round it.
  bun -e "
const text = process.argv[1];
const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1) || '[]';
let findings = [];
try { findings = JSON.parse(json); } catch { findings = [{ unparsed: text }]; }
console.log(JSON.stringify({ shot: $shot, findings }));
" "$answer" >> "$out"
done
echo "written $out" >&2

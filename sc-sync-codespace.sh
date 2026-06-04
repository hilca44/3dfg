#!/usr/bin/env bash
set -euo pipefail

COMMIT_MSG="${1:-update from codespace}"
REMOTE_NAME="${REMOTE_NAME:-origin}"
REMOTE_HOST="${REMOTE_HOST:-ch@3dfg.de}"
REMOTE_DIR="${REMOTE_DIR:-/home/ch/3dfg}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BRANCH="$(git branch --show-current)"
if [ -z "$BRANCH" ]; then
  echo "Kein aktiver Git-Branch gefunden." >&2
  exit 1
fi

echo "== Codespace -> GitHub -> Server =="
echo "Branch: $BRANCH"

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  git add -A
  git commit -m "$COMMIT_MSG"
else
  echo "Keine lokalen Aenderungen fuer Git."
fi

git pull --rebase "$REMOTE_NAME" "$BRANCH"
git push "$REMOTE_NAME" "$BRANCH"

ssh "$REMOTE_HOST" "
set -e
cd '$REMOTE_DIR'
git pull --rebase --autostash '$REMOTE_NAME' '$BRANCH'
pm2 restart all
"

echo "Sync fertig."

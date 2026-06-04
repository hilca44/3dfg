#!/bin/bash
set -e

COMMIT_MSG="${1:-update from codespace}"
REMOTE_HOST="ch@3dfg.de"
REMOTE_DIR="/home/ch/3dfg"

echo "== Codespace -> GitHub -> Server =="

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  git add .
  git commit -m "$COMMIT_MSG"
else
  echo "Keine lokalen Aenderungen fuer Git."
fi

git push

ssh "$REMOTE_HOST" "
set -e
cd '$REMOTE_DIR'
git pull
pm2 restart all
"

echo "Sync fertig."

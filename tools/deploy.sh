#!/usr/bin/env bash
# dist/ 를 gh-pages 브랜치로 배포 (원본 커밋 해시를 메시지에 남김)
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
SRC=$(git rev-parse --short HEAD)
TMP=$(mktemp -d)
cp -r dist/. "$TMP"/
touch "$TMP/.nojekyll"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="cancellawerra-bot" -c user.email="cancellawerra-bot@users.noreply.github.com" commit -qm "deploy: build of main@$SRC"
git push -q -f "$(cd - >/dev/null; git remote get-url origin)" gh-pages
echo "deployed main@$SRC → $(git rev-parse --short HEAD)"

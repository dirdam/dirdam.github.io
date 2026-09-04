#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Building site..."
python3 build.py

echo "Deploying site to server..."
# --exclude 'view-counts.json' is load-bearing: that file is generated
# server-side by view-counts/update_view_counts.py from nginx's access log
# and never exists in local dist/ — without the exclude, --delete would
# erase it on every deploy.
rsync -avz --delete \
  --exclude 'view-counts.json' \
  dist/ root@46.225.104.62:/var/www/dirdam.squadro.app/
echo "✓ Site deployed!"

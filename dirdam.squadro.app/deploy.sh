#!/bin/bash

echo "Deploying landing page to server..."
scp index.html root@46.225.104.62:/var/www/dirdam.squadro.app/index.html
scp favicon.ico root@46.225.104.62:/var/www/dirdam.squadro.app/favicon.ico
echo "✓ Landing page deployed!"

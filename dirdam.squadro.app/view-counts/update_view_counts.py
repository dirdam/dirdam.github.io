#!/usr/bin/env python3
"""
Increments per-app page-view counts by tailing nginx's shared access log
(/var/log/nginx/access.log — shared across every vhost on this server, so
apps are told apart by their request path, not the log) for lines appended
since the last run, and writes the running totals to a static JSON file the
landing page fetches directly.

Deployment (one-time, not handled by dirdam.squadro.app/deploy.sh):
    mkdir -p /opt/dirdam/view-counts
    scp update_view_counts.py root@46.225.104.62:/opt/dirdam/view-counts/
    ssh root@46.225.104.62 "crontab -l 2>/dev/null | { cat; echo '*/10 * * * * /usr/bin/python3 /opt/dirdam/view-counts/update_view_counts.py'; } | crontab -"
Re-run the scp line whenever this script itself changes.

Each run only processes lines appended since the last run, tracked via a
(inode, byte-offset) bookmark in state.json that also detects log rotation.
If the log rotated between runs, whatever was appended to the old file after
our last read is lost — acceptable for an approximate view counter, not
worth the complexity of also chasing rotated/compressed log files for it.
"""
import json
import os
import re
from datetime import datetime, timezone

ACCESS_LOG = '/var/log/nginx/access.log'
STATE_FILE = '/opt/dirdam/view-counts/state.json'
OUTPUT_FILE = '/var/www/dirdam.squadro.app/view-counts.json'

# One regex per app: matches only that app's own root page load, not a
# sub-resource or API request under the same path — e.g. flags/assets/*.svg
# or squadro-stats/_stcore/* traffic must not be counted as a view.
APP_PATTERNS = {
    'stocks': re.compile(r'^/stocks/?(?:\?.*)?$'),
    'solis': re.compile(r'^/solis/?(?:\?.*)?$'),
    'timezones': re.compile(r'^/timezones/?(?:\?.*)?$'),
    'squadro-stats': re.compile(r'^/squadro-stats/?(?:\?.*)?$'),
    # /flags, /surnames, /phyllotaxis, and /predator-prey 301-redirect the
    # bare path to add the trailing slash (see their nginx location blocks)
    # — only count the slashed form so a single visit isn't counted twice
    # across the redirect hop.
    'flags': re.compile(r'^/flags/(?:\?.*)?$'),
    'surnames': re.compile(r'^/surnames/(?:\?.*)?$'),
    'phyllotaxis': re.compile(r'^/phyllotaxis/(?:\?.*)?$'),
    'predator-prey': re.compile(r'^/predator-prey/(?:\?.*)?$'),
}

BOT_UA_RE = re.compile(r'bot|spider|crawl|curl|wget|python-requests|python-httpx|scrapy', re.IGNORECASE)

# nginx's built-in "combined" format (this server never overrides it):
# $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent "$http_referer" "$http_user_agent"
LOG_RE = re.compile(
    r'^(?P<addr>\S+) \S+ \S+ \[[^\]]+\] '
    r'"(?P<method>[A-Z]+) (?P<path>\S+) [^"]*" '
    r'(?P<status>\d{3}) \d+ "[^"]*" "(?P<ua>[^"]*)"'
)


def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {'inode': None, 'offset': 0, 'counts': {}}


def save_state(state):
    os.makedirs(os.path.dirname(STATE_FILE), exist_ok=True)
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f)


def main():
    state = load_state()
    for app in APP_PATTERNS:
        state['counts'].setdefault(app, 0)

    st = os.stat(ACCESS_LOG)
    offset = state['offset']
    if state['inode'] != st.st_ino or st.st_size < offset:
        offset = 0  # rotated (or truncated) since our last read

    with open(ACCESS_LOG, 'r', errors='replace') as f:
        f.seek(offset)
        while True:
            line = f.readline()
            if not line:
                break
            m = LOG_RE.match(line)
            if not m or m.group('method') != 'GET' or m.group('status') not in ('200', '304'):
                continue
            if BOT_UA_RE.search(m.group('ua')):
                continue
            path = m.group('path')
            for app, pattern in APP_PATTERNS.items():
                if pattern.match(path):
                    state['counts'][app] += 1
                    break
        offset = f.tell()

    state['inode'] = st.st_ino
    state['offset'] = offset
    save_state(state)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump({
            'updated': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
            'views': state['counts'],
        }, f)


if __name__ == '__main__':
    main()

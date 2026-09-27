#!/bin/bash
# Page tests (Playwright). They need http:// because the page fetches data/<site>.json, so this starts the
# gzip test server, runs each suite, and stops it.   ./test_pages.sh            # every suite
#                                                    ./test_pages.sh test_try.js   # one
cd "$(dirname "$0")"
node tools/test_server.js > /tmp/bw_test_server.log 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for i in $(seq 1 50); do curl -s -o /dev/null http://127.0.0.1:8765/index.html && break; sleep 0.1; done
SUITES=${@:-$(ls test_*.js)}
fail=0
for t in $SUITES; do
  node "$t" > "/tmp/bw_$t.log" 2>&1; code=$?
  n=$(grep -c '^ok' "/tmp/bw_$t.log")
  if [ $code -ne 0 ] || grep -q '^FAIL' "/tmp/bw_$t.log"; then echo "FAIL $t ($n ok)"; grep '^FAIL' "/tmp/bw_$t.log" | head -5; fail=1; else echo "ok   $t ($n checks)"; fi
done
exit $fail

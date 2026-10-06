#!/usr/bin/env python3
"""Static dev server with caching disabled, so edited modules show up on a plain reload."""
import http.server
import sys

BENCH_LOG = "/tmp/virt-bench.jsonl"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # `?bench` (see src/bench.js) posts its figures here: they are appended to a log and echoed,
    # so a page opened in another browser can still be measured from the terminal.
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        with open(BENCH_LOG, "ab") as log:
            log.write(body + b"\n")
        print(body.decode(errors="replace"), flush=True)
        self.send_response(204)
        self.end_headers()


class Server(http.server.ThreadingHTTPServer):
    # A page load asks for every module at once; a short listen queue drops some of them.
    request_queue_size = 64


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8742
print(f"Serving on http://localhost:{port}")
Server(("", port), NoCacheHandler).serve_forever()

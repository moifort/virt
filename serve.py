#!/usr/bin/env python3
"""Static dev server with caching disabled, so edited modules show up on a plain reload."""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


class Server(http.server.ThreadingHTTPServer):
    # A page load asks for every module at once; a short listen queue drops some of them.
    request_queue_size = 64


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8742
print(f"Serving on http://localhost:{port}")
Server(("", port), NoCacheHandler).serve_forever()

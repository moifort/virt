#!/usr/bin/env python3
"""Static dev server with caching disabled, so edited modules show up on a plain reload."""
import http.server
import os
import sys

BENCH_LOG = "/tmp/virt-bench.jsonl"
ROOT = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(ROOT, "assets", "loading")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    # `?bench` (see src/bench.js) posts its figures here: they are appended to a log and echoed,
    # so a page opened in another browser can still be measured from the terminal.
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        # `virt.shoot()` (see src/shoot.js) posts the shot of the loading screen, drawn
        # by the game itself, to /assets/loading/<name>: they are written there, from this machine only.
        # `?tour=` (see src/tour.js) posts its pictures to /tour/<tour>/<name>: written to
        # tour/shots/<tour>/, from this machine only.
        parts = self.path.strip("/").split("/")
        if len(parts) == 3 and parts[0] == "tour" and parts[2].endswith((".png", ".json")) and all(p and ".." not in p for p in parts):
            if self.client_address[0] not in ("127.0.0.1", "::1"):
                self.send_response(403)
                self.end_headers()
                return
            folder = os.path.join(ROOT, "tour", "shots", os.path.basename(parts[1]))
            os.makedirs(folder, exist_ok=True)
            with open(os.path.join(folder, os.path.basename(parts[2])), "wb") as out:
                out.write(body)
            self.send_response(204)
            self.end_headers()
            return
        name = os.path.basename(self.path)
        if self.path == f"/assets/loading/{name}" and name.endswith((".png", ".jpg", ".json")):
            if self.client_address[0] not in ("127.0.0.1", "::1"):
                self.send_response(403)
                self.end_headers()
                return
            os.makedirs(ASSETS, exist_ok=True)
            with open(os.path.join(ASSETS, name), "wb") as out:
                out.write(body)
            print(f"wrote assets/loading/{name} ({len(body)} bytes)", flush=True)
            self.send_response(204)
            self.end_headers()
            return
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

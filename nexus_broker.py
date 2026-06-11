import json
import logging
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from threading import Lock

HOST_INTERFACE = "0.0.0.0"
HOST_PORT = 8080
MESSAGE_TTL = 60

logging.basicConfig(level=logging.INFO, format='%(asctime)s [NEXUS] %(message)s')

class FastBroker:
    def __init__(self):
        self.lock = Lock()
        self.mailboxes = {}
        self.global_id = 0

    def clean_memory(self, target_id):
        now = time.time()
        if target_id in self.mailboxes:
            self.mailboxes[target_id] = [
                msg for msg in self.mailboxes[target_id] if now - msg["time"] < MESSAGE_TTL
            ]

    def push(self, target_id, sender, message, tag):
        with self.lock:
            self.global_id += 1
            if target_id not in self.mailboxes:
                self.mailboxes[target_id] = []

            self.mailboxes[target_id].append({
                "id": self.global_id,
                "sender": sender,
                "message": message,
                "tag": tag,
                "time": time.time()
            })
            self.clean_memory(target_id)

            if len(self.mailboxes[target_id]) > 50:
                self.mailboxes[target_id].pop(0)

            return self.global_id

    def poll(self, my_id, last_id):
        with self.lock:
            if my_id not in self.mailboxes:
                return [], self.global_id

            self.clean_memory(my_id)
            delta = [msg for msg in self.mailboxes[my_id] if msg["id"] > last_id]
            return delta, self.global_id

broker = FastBroker()

class Router(BaseHTTPRequestHandler):
    def log_message(self, format, *args): return

    def reply(self, code=200):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Connection", "close")
        self.end_headers()

    def do_POST(self):
        if self.path == "/push":
            try:
                length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(length).decode('utf-8'))

                target = str(data.get("target_id", "")).strip()
                sender = str(data.get("sender", "")).strip()
                msg = str(data.get("message", "")).strip()
                tag = str(data.get("tag", "SERVER")).strip()

                if not target or not msg:
                    self.reply(400)
                    return

                msg_id = broker.push(target, sender, msg, tag)
                logging.info(f"Routed [ID:{msg_id}] {tag} -> {target}")

                self.reply(200)
                self.wfile.write(json.dumps({"status": "ok"}).encode())
            except:
                self.reply(500)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/poll":
            try:
                params = parse_qs(parsed.query)
                my_id = str(params.get("my_id", [""])[0]).strip()
                last_id = int(params.get("last_id", [0])[0])

                if not my_id:
                    self.reply(400)
                    return

                msgs, latest = broker.poll(my_id, last_id)

                self.reply(200)
                self.wfile.write(json.dumps({"last_id": latest, "messages": msgs}).encode())
            except:
                self.reply(500)

if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST_INTERFACE, HOST_PORT), Router)
    logging.info(f"Nexus Core Active on Port {HOST_PORT}")
    server.serve_forever()

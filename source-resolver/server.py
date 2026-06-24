import http.server
import json
import os
import urllib.parse

PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DIR, "data.json")

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"series": [], "films": []}

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def read_file(path):
    with open(path, "rb") as f:
        return f.read()

class ResolverHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/api/data":
            data = load_data()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        if path in ("/admin", "/resolver/list", "/resolver"):
            html_map = {
                "/admin": "admin.html",
                "/resolver": "list.html",
                "/resolver/list": "list.html",
            }
            html_file = os.path.join(DIR, html_map[path])
            if os.path.exists(html_file):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(read_file(html_file))
                return
            else:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Page not found")
                return

        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/data":
            content_len = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_len)
            try:
                new_data = json.loads(body)
                save_data(new_data)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": True}).encode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"ok": False, "error": str(e)}).encode("utf-8"))
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not found")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

if __name__ == "__main__":
    os.chdir(DIR)
    server = http.server.HTTPServer(("0.0.0.0", PORT), ResolverHandler)
    print(f"Serving at http://localhost:{PORT}")
    print(f"  Admin page: http://localhost:{PORT}/admin")
    print(f"  List page:  http://localhost:{PORT}/resolver/list")
    server.serve_forever()

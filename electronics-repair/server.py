"""
RepairPro Workshop Server
Serves the React SPA and provides API endpoints for data persistence.
"""

import http.server
import json
import os
import urllib.parse

PORT = 8081
DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(DIR, "data.json")

def load_data():
    """Load repair data from JSON file."""
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"repairs": [], "customers": []}

def save_data(data):
    """Save repair data to JSON file."""
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def read_file(path):
    """Read a file as bytes."""
    with open(path, "rb") as f:
        return f.read()

def get_content_type(path):
    """Determine content type based on file extension."""
    ext = os.path.splitext(path)[1].lower()
    types = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.woff2': 'font/woff2',
        '.woff': 'font/woff',
    }
    return types.get(ext, 'application/octet-stream')

class RepairHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler for RepairPro Workshop."""

    def do_GET(self):
        """Handle GET requests."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # API endpoints
        if path == "/api/repair/data":
            data = load_data()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))
            return

        # Serve static files
        if path == "/" or path == "/index.html":
            html_file = os.path.join(DIR, "index.html")
            if os.path.exists(html_file):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.end_headers()
                self.wfile.write(read_file(html_file))
                return
        
        # Serve static assets (JS, CSS, images)
        file_path = os.path.join(DIR, path.lstrip("/"))
        if os.path.exists(file_path) and os.path.isfile(file_path):
            self.send_response(200)
            self.send_header("Content-Type", get_content_type(file_path))
            self.end_headers()
            self.wfile.write(read_file(file_path))
            return

        # For client-side routing (SPA), serve index.html for all other paths
        html_file = os.path.join(DIR, "index.html")
        if os.path.exists(html_file):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(read_file(html_file))
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not found")

    def do_POST(self):
        """Handle POST requests."""
        if self.path == "/api/repair/data":
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
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

if __name__ == "__main__":
    os.chdir(DIR)
    server = http.server.HTTPServer(("0.0.0.0", PORT), RepairHandler)
    print(f"=" * 50)
    print(f"  RepairPro Workshop Server v2.0")
    print(f"=" * 50)
    print(f"  Server: http://localhost:{PORT}")
    print(f"  Dashboard: http://localhost:{PORT}/")
    print(f"  Data File: {DATA_FILE}")
    print(f"=" * 50)
    print(f"  Press Ctrl+C to stop")
    print(f"=" * 50)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\n  Server stopped.")
        server.shutdown()

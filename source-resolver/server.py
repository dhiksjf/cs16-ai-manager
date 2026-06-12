import http.server
import os

PORT = 8080
DIR = os.path.dirname(os.path.abspath(__file__))

if __name__ == "__main__":
    os.chdir(DIR)
    server = http.server.HTTPServer(("0.0.0.0", PORT), http.server.SimpleHTTPRequestHandler)
    print(f"Serving at http://localhost:{PORT}")
    server.serve_forever()

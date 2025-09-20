#!/usr/bin/env python3
from http.server import HTTPServer, SimpleHTTPRequestHandler
import urllib.request
import urllib.parse
import json
from urllib.error import HTTPError

class CORSRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        SimpleHTTPRequestHandler.end_headers(self)
    
    def do_OPTIONS(self):
        # Handle preflight requests
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        # Handle regular files
        if not self.path.startswith('/proxy/'):
            return SimpleHTTPRequestHandler.do_GET(self)
        
        # Handle proxy requests
        try:
            # Extract the target URL from the proxy path
            target_url = self.path[7:]  # Remove '/proxy/' prefix
            target_url = urllib.parse.unquote(target_url)
            
            # Forward the request
            headers = {}
            # Some servers require a user agent
            headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            
            req = urllib.request.Request(target_url, headers=headers)
            with urllib.request.urlopen(req) as response:
                # Send response code
                self.send_response(response.status)
                
                # Forward relevant headers
                for key, value in response.headers.items():
                    if key.lower() in ['content-type', 'content-length', 'last-modified', 'etag']:
                        self.send_header(key, value)
                
                # Add CORS headers
                self.end_headers()
                
                # Stream the response body
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                
        except HTTPError as e:
            self.send_response(e.code)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(str(e).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(str(e).encode())

if __name__ == '__main__':
    server_address = ('', 8000)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print('Starting CORS proxy server on http://localhost:8000')
    httpd.serve_forever()
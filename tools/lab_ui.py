"""Login-free localhost UI for the disposable VM; internal LuCI session only."""
import http.cookiejar
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

BACKEND = 'http://127.0.0.1:18080'
PAGE = '/cgi-bin/luci/admin/services/openclash/modern'
ALLOW = ('/cgi-bin/luci/admin/services/openclash/', '/cgi-bin/luci/admin/services/router_privacy/', '/cgi-bin/luci/admin/services/router_node_health/', '/luci-static/openclash-modern/')
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
lock = threading.RLock()
slots = threading.BoundedSemaphore(4)
token = ''

def login():
    global token
    # rpcd restarts invalidate the old server session; never reuse its cookies.
    jar.clear()
    body = urllib.parse.urlencode({'luci_username': 'root', 'luci_password': ''}).encode()
    with opener.open(urllib.request.Request(BACKEND + PAGE, data=body), timeout=20) as response:
        html = response.read()
    match = re.search(rb'data-token="([^"]+)"', html)
    if not match: raise RuntimeError('Local guest session unavailable')
    token = match[1].decode()

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self): self.forward()
    def do_POST(self): self.forward()
    def forward(self):
        host = self.headers.get('Host', '')
        if host not in {'127.0.0.1:18081', 'localhost:18081'}:
            self.send_error(403); return
        origin = self.headers.get('Origin')
        if origin and origin not in {'http://127.0.0.1:18081', 'http://localhost:18081'}:
            self.send_error(403); return
        path = PAGE if self.path == '/' else self.path
        if not urllib.parse.urlsplit(path).path.startswith(ALLOW):
            self.send_error(404); return
        length = int(self.headers.get('Content-Length', 0))
        if length < 0 or length > 32 * 1024 * 1024:
            self.send_error(413); return
        with slots:
            body = self.rfile.read(length) if self.command == 'POST' else None
            try:
                with lock:
                    if not token: login()
                    content_type = self.headers.get('Content-Type', '')
                    if body is not None and content_type.startswith('application/x-www-form-urlencoded'):
                        pairs = urllib.parse.parse_qsl(body.decode(), keep_blank_values=True)
                        pairs = [(key, value) for key, value in pairs if key != 'token'] + [('token', token)]
                        body = urllib.parse.urlencode(pairs).encode()
                    headers = {'Content-Type': content_type} if body is not None else {}
                    request = urllib.request.Request(BACKEND + path, data=body, method=self.command, headers=headers)
                    request.add_header('Cookie', '; '.join(cookie.name + '=' + cookie.value for cookie in jar))
                # Only session refresh is serialized. Independent read/probe
                # requests can run together, bounded to four workers.
                client = urllib.request.build_opener()
                for attempt in range(4):
                        try:
                            response = client.open(request, timeout=120)
                            break
                        except urllib.error.HTTPError as e:
                            response = e
                            break
                        except (urllib.error.URLError, ConnectionResetError, ConnectionError):
                            if self.command != 'GET' or attempt == 3: raise
                            time.sleep(0.5)
                if response.headers.get('X-LuCI-Login-Required') or (response.code == 403 and self.command == 'GET' and urllib.parse.urlsplit(path).path == PAGE):
                    with lock:
                        response.close(); login()
                        if body is not None and content_type.startswith('application/x-www-form-urlencoded'):
                            pairs = urllib.parse.parse_qsl(body.decode(), keep_blank_values=True)
                            request.data = urllib.parse.urlencode([(key, value) for key, value in pairs if key != 'token'] + [('token', token)]).encode()
                        request.add_header('Cookie', '; '.join(cookie.name + '=' + cookie.value for cookie in jar))
                    response = client.open(request, timeout=120)
                with response:
                        data, status = response.read(), response.code
                        response_type = response.headers.get('Content-Type', 'application/octet-stream')
                        extra_headers = {key: response.headers[key] for key in ('X-CBI-State', 'Content-Disposition') if key in response.headers}
                self.send_response(status)
                self.send_header('Content-Type', response_type)
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'no-store')
                for key, value in extra_headers.items(): self.send_header(key, value)
                self.end_headers()
                self.wfile.write(data)
            except (BrokenPipeError, ConnectionResetError): pass
            except Exception:
                self.send_error(502, 'Local lab backend unavailable')

with lock: login()
print('Login-free lab UI: http://127.0.0.1:18081/', flush=True)
ThreadingHTTPServer(('127.0.0.1', 18081), Handler).serve_forever()

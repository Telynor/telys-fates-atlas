"""Local, read-only GM Assistant companion. Python 3.10+, no third-party packages."""
import argparse
import getpass
import hmac
import json
import os
import re
import secrets
import ssl
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlsplit
from urllib.request import Request, build_opener, HTTPSHandler, HTTPRedirectHandler

API_HOST = 'https://backend.gmassistant.app'
ID = r'[A-Za-z0-9_-]{1,128}'
ROUTE = re.compile(rf'^/v1/campaigns(?:/{ID}(?:/sessions(?:/{ID}(?:/(?:notes|recaps(?:/{ID})?|scenes))?)?)?)?$')
ALLOWED_QUERY = {'cursor', 'limit', 'sort', 'fields'}
MAX_BYTES = 12 * 1024 * 1024

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

class Bridge(ThreadingHTTPServer):
    daemon_threads = True
    def __init__(self, address, *, api_key, token, origin):
        super().__init__(address, Handler)
        self.api_key, self.token, self.origin = api_key, token, origin
        self.opener = build_opener(HTTPSHandler(context=ssl.create_default_context()), NoRedirect())
    def upstream(self, path):
        request = Request(API_HOST + path, headers={'Authorization': 'Bearer ' + self.api_key, 'Accept': 'application/json'})
        with self.opener.open(request, timeout=45) as response:
            payload = response.read(MAX_BYTES + 1)
            if len(payload) > MAX_BYTES:
                raise ValueError('GM Assistant response exceeds the size limit.')
            json.loads(payload)
            return payload

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never log keys, pairing tokens, campaign contents, or request headers.
    def send_json(self, status, value, retry=None):
        payload = json.dumps(value).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Vary', 'Origin')
        if self.headers.get('Origin') == self.server.origin:
            self.send_header('Access-Control-Allow-Origin', self.server.origin)
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'X-Atlas-Token')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.send_header('Access-Control-Expose-Headers', 'Retry-After')
        if retry:
            self.send_header('Retry-After', str(retry))
        self.end_headers()
        self.wfile.write(payload)
    def permitted_origin(self):
        port = self.server.server_port
        return self.headers.get('Host') in (f'127.0.0.1:{port}', f'localhost:{port}') and self.headers.get('Origin') == self.server.origin
    def do_OPTIONS(self):
        if not self.permitted_origin():
            return self.send_json(403, {'error': 'This Foundry origin is not paired.'})
        return self.send_json(200, {'ok': True})
    def do_GET(self):
        if not self.permitted_origin():
            return self.send_json(403, {'error': 'This Foundry origin is not paired.'})
        if not hmac.compare_digest(self.headers.get('X-Atlas-Token', ''), self.server.token):
            return self.send_json(401, {'error': 'Pairing token is missing or incorrect.'})
        if self.path == '/status':
            return self.send_json(200, {'ok': True, 'service': 'Fates Atlas GM Assistant', 'version': 1})
        path = urlsplit(self.path)
        if path.scheme or path.netloc or not ROUTE.fullmatch(path.path) or any(k not in ALLOWED_QUERY for k in parse_qs(path.query)):
            return self.send_json(403, {'error': 'Only campaign and session note reads are supported.'})
        try:
            payload = self.server.upstream(self.path)
            return self.send_json(200, json.loads(payload))
        except HTTPError as err:
            message = {401: 'GM Assistant rejected the API key. Reconnect with a valid key.', 403: 'This API key cannot read these notes. Use a read-scoped key.', 404: 'The GM Assistant record was not found.', 429: 'GM Assistant rate limit reached. Wait and resync again.'}.get(err.code, 'GM Assistant could not complete the request.')
            return self.send_json(err.code if err.code in (400,401,403,404,429) else 502, {'error': message}, retry=err.headers.get('Retry-After'))
        except (URLError, TimeoutError, ValueError):
            return self.send_json(502, {'error': 'Could not read notes from GM Assistant. Check connectivity and try again.'})
    def do_POST(self):
        self.send_json(405, {'error': 'This companion only reads notes.'})
    do_PUT = do_POST
    do_PATCH = do_POST
    do_DELETE = do_POST

def normalize_origin(value):
    p = urlsplit(value.strip())
    if p.scheme not in ('http', 'https') or not p.hostname or p.username or p.password or p.query or p.fragment:
        raise ValueError('Enter your Foundry browser URL, such as http://localhost:30000 or https://my-foundry.example.')
    return p.scheme + '://' + p.netloc

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=43127)
    parser.add_argument('--origin', help='Exact Foundry browser origin')
    args = parser.parse_args()
    print("Tely's Fate's Atlas — GM Assistant companion")
    print('Create a READ API key in GM Assistant > Account > Developer. No password is needed.')
    origin = normalize_origin(args.origin or input('Paste your Foundry browser URL: '))
    key = os.environ.get('GMA_API_KEY') or getpass.getpass('GM Assistant read API key (hidden): ')
    if not key.startswith('gma_') or any(c.isspace() for c in key):
        raise ValueError('Expected a gma_ API key with no spaces.')
    token = secrets.token_urlsafe(32)
    server = Bridge(('127.0.0.1', args.port), api_key=key, token=token, origin=origin)
    print(f'\nCompanion address: http://127.0.0.1:{args.port}')
    print(f'Pairing token: {token}')
    print(f'Allowed Foundry origin: {origin}')
    print('Paste the pairing token in Fate’s Atlas > Import from GM Assistant > Connect.')
    print('Keep this window open. Restarting creates a new pairing token. Ctrl+C disconnects.\n')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        server.api_key = ''

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError) as err:
        print('Could not start companion:', err)

"""Local, read-only GM Assistant companion. Python 3.10+, no third-party packages."""
import argparse
import hmac
import json
import os
import re
import secrets
import ssl
import threading
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

class SetupWindow:
    """Editable setup fields and explicit clipboard controls; no console key capture."""
    def __init__(self, root, *, port=43127, origin=''):
        import tkinter as tk
        from tkinter import ttk
        self.root, self.port, self.server = root, port, None
        self.origin = tk.StringVar(value=origin)
        self.key = tk.StringVar(value=os.environ.get('GMA_API_KEY', ''))
        self.show_key = tk.BooleanVar(value=False)
        self.address = tk.StringVar(value='')
        self.token = tk.StringVar(value='')
        self.status = tk.StringVar(value='Paste your Foundry URL and read API key, then click Start companion.')
        root.title("Tely’s Fate’s Atlas — GM Assistant Setup")
        root.geometry('770x480')
        root.minsize(650, 460)
        root.columnconfigure(0, weight=1)
        root.rowconfigure(0, weight=1)
        frame = ttk.Frame(root, padding=20)
        frame.grid(sticky='nsew')
        frame.columnconfigure(0, weight=1)
        ttk.Label(frame, text='Connect GM Assistant', font=('', 18, 'bold')).grid(row=0, column=0, columnspan=2, sticky='w', pady=(0, 8))
        ttk.Label(frame, text='Enter your key here. Both fields support Ctrl+V, right-click Paste, and the Paste buttons.', wraplength=700).grid(row=1, column=0, columnspan=2, sticky='w', pady=(0, 15))
        ttk.Label(frame, text='Foundry URL — the address you use to open Foundry as GM').grid(row=2, column=0, columnspan=2, sticky='w')
        self.origin_entry = ttk.Entry(frame, textvariable=self.origin)
        self.origin_entry.grid(row=3, column=0, sticky='ew', pady=(4, 12))
        self.paste_origin = ttk.Button(frame, text='Paste URL', command=lambda: self.paste(self.origin_entry))
        self.paste_origin.grid(row=3, column=1, padx=(8, 0), pady=(4, 12))
        ttk.Label(frame, text='GM Assistant read API key — starts with gma_').grid(row=4, column=0, columnspan=2, sticky='w')
        self.key_entry = ttk.Entry(frame, textvariable=self.key, show='*')
        self.key_entry.grid(row=5, column=0, sticky='ew', pady=(4, 6))
        self.paste_key = ttk.Button(frame, text='Paste API key', command=lambda: self.paste(self.key_entry))
        self.paste_key.grid(row=5, column=1, padx=(8, 0), pady=(4, 6))
        ttk.Checkbutton(frame, text='Show API key', variable=self.show_key, command=lambda: self.key_entry.configure(show='' if self.show_key.get() else '*')).grid(row=6, column=0, sticky='w')
        self.start_button = ttk.Button(frame, text='Start companion', command=self.start)
        self.start_button.grid(row=7, column=0, sticky='w', pady=15)
        self.stop_button = ttk.Button(frame, text='Stop companion', command=self.stop, state='disabled')
        self.stop_button.grid(row=7, column=1, sticky='e', pady=15)
        ttk.Label(frame, text='Companion address — use this in Fate’s Atlas').grid(row=8, column=0, columnspan=2, sticky='w')
        ttk.Entry(frame, textvariable=self.address, state='readonly').grid(row=9, column=0, sticky='ew', pady=(4, 10))
        ttk.Button(frame, text='Copy address', command=lambda: self.copy(self.address.get())).grid(row=9, column=1, padx=(8, 0), pady=(4, 10))
        ttk.Label(frame, text='Pairing token — paste this into the Atlas pairing-token field').grid(row=10, column=0, columnspan=2, sticky='w')
        ttk.Entry(frame, textvariable=self.token, state='readonly').grid(row=11, column=0, sticky='ew', pady=4)
        ttk.Button(frame, text='Copy pairing token', command=lambda: self.copy(self.token.get())).grid(row=11, column=1, padx=(8, 0), pady=4)
        ttk.Label(frame, textvariable=self.status, wraplength=700).grid(row=12, column=0, columnspan=2, sticky='w', pady=(12, 0))
        self.bind_paste(self.origin_entry)
        self.bind_paste(self.key_entry)
        root.protocol('WM_DELETE_WINDOW', self.close)
        self.origin_entry.focus_set()

    def bind_paste(self, entry):
        import tkinter as tk
        menu = tk.Menu(entry, tearoff=False)
        menu.add_command(label='Paste', command=lambda: self.paste(entry, replace=False))
        menu.add_command(label='Select all', command=lambda: entry.selection_range(0, 'end'))
        entry.bind('<Button-3>', lambda event: menu.tk_popup(event.x_root, event.y_root))
        entry.bind('<Control-v>', lambda event: self.paste(entry, replace=False))
        entry.bind('<Control-V>', lambda event: self.paste(entry, replace=False))

    def paste(self, entry, replace=True):
        if str(entry.cget('state')) == 'disabled':
            return 'break'
        try:
            value = self.root.clipboard_get().strip()
            if replace:
                entry.delete(0, 'end')
            elif entry.selection_present():
                entry.delete('sel.first', 'sel.last')
            entry.insert('insert', value)
            entry.focus_set()
        except Exception:
            self.status.set('The clipboard does not contain text. Copy your URL or API key first.')
        return 'break'

    def copy(self, value):
        if not value:
            self.status.set('Start the companion first to generate connection details.')
            return
        self.root.clipboard_clear()
        self.root.clipboard_append(value)
        self.root.update_idletasks()
        self.status.set('Copied. Paste it into the matching field in Fate’s Atlas. Keep this window open.')

    def start(self):
        if self.server:
            return
        try:
            origin = normalize_origin(self.origin.get())
            key = self.key.get().strip()
            if not key.startswith('gma_') or any(c.isspace() for c in key):
                raise ValueError('Paste the complete gma_ API key into the API-key field.')
            token = secrets.token_urlsafe(32)
            server = Bridge(('127.0.0.1', self.port), api_key=key, token=token, origin=origin)
        except ValueError as err:
            self.status.set(str(err))
            return
        except OSError:
            self.status.set('Could not open the companion port. Close the old companion terminal/window, then click Start again.')
            return
        self.server = server
        threading.Thread(target=server.serve_forever, daemon=True).start()
        self.key.set('')
        self.address.set(f'http://127.0.0.1:{server.server_port}')
        self.token.set(token)
        for widget in (self.origin_entry, self.key_entry, self.paste_origin, self.paste_key, self.start_button):
            widget.configure(state='disabled')
        self.stop_button.configure(state='normal')
        self.status.set('Companion running. Copy its address and pairing token into Atlas. Keep this window open.')

    def stop(self):
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.server.api_key = ''
            self.server = None
        self.address.set('')
        self.token.set('')
        for widget in (self.origin_entry, self.key_entry, self.paste_origin, self.paste_key, self.start_button):
            widget.configure(state='normal')
        self.stop_button.configure(state='disabled')
        self.status.set('Stopped. Paste your key and click Start to reconnect.')

    def close(self):
        self.stop()
        self.root.destroy()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=43127)
    parser.add_argument('--origin', help='Exact Foundry browser origin')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--gui', action='store_true', help='Open the setup window (default)')
    mode.add_argument('--console', action='store_true', help='Use visible console input instead of the window')
    args = parser.parse_args()
    if not args.console:
        try:
            import tkinter as tk
        except ImportError as err:
            raise ValueError('GUI support is unavailable. Install Python with Tcl/Tk support, or run with --console.') from err
        try:
            root = tk.Tk()
        except tk.TclError as err:
            raise ValueError('Could not open the setup window. Use a desktop session or run with --console.') from err
        SetupWindow(root, port=args.port, origin=args.origin or '')
        root.mainloop()
        return
    print("Tely's Fate's Atlas — GM Assistant companion")
    print('Console mode uses visible text input. You can also run without --console for the setup window.')
    origin = normalize_origin(args.origin or input('Paste your Foundry browser URL: '))
    key = (os.environ.get('GMA_API_KEY') or input('GM Assistant read API key (visible): ')).strip()
    if not key.startswith('gma_') or any(c.isspace() for c in key):
        raise ValueError('Expected a gma_ API key with no spaces.')
    token = secrets.token_urlsafe(32)
    server = Bridge(('127.0.0.1', args.port), api_key=key, token=token, origin=origin)
    print(f'\nCompanion address: http://127.0.0.1:{args.port}')
    print(f'Pairing token: {token}')
    print(f'Allowed Foundry origin: {origin}')
    print('Keep this window open. Ctrl+C disconnects.\n')
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

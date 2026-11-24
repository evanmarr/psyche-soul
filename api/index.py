"""Vercel serverless entry point. vercel.json rewrites every /api/* request to this function."""
import os, sys
from http.server import BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import routes, features, admin  # noqa: F401  (register the API routes)
from framework import Handler


class handler(BaseHTTPRequestHandler):          # Vercel looks for a class literally named "handler"
    server_version = Handler.server_version


for _name in ("log_message", "_send", "_json", "_static", "_dispatch", "do_GET", "do_POST", "do_PUT", "do_DELETE"):
    setattr(handler, _name, getattr(Handler, _name))

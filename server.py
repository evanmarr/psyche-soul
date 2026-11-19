#!/usr/bin/env python3
"""Psyche & Soul server. Usage: python3 server.py   (PORT, HOST, PSYCHE_DB, ESV_API_KEY, PSYCHE_SECURE are read from the environment)"""
import os, sys
import db, seed
from framework import serve
import routes  # noqa: F401  (registers routes)

if __name__ == "__main__":
    db.init()
    if not db.connect().execute("SELECT COUNT(*) FROM users").fetchone()[0]: seed.run()
    serve(int(os.environ.get("PORT", "8080")), os.environ.get("HOST", "127.0.0.1"))

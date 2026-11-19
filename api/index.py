"""Vercel serverless entry point. vercel.json rewrites every /api/* request to this function."""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import routes  # noqa: F401  (registers the API routes)
from framework import Handler

handler = Handler

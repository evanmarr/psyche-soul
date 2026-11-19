import base64, hashlib, hmac, os, secrets

ITER = 390_000   # PBKDF2-HMAC-SHA256 (hashlib.scrypt is not available in every Python build)

def hash_password(pw: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt, ITER)
    return f"pbkdf2${ITER}${base64.b64encode(salt).decode()}${base64.b64encode(dk).decode()}"

def verify_password(pw: str, stored: str) -> bool:
    try:
        _, it, s, h = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), base64.b64decode(s), int(it))
        return hmac.compare_digest(dk, base64.b64decode(h))
    except Exception:
        return False

def new_token() -> str: return secrets.token_urlsafe(32)

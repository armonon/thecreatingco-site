"""Shared fail-closed screening for company source and committed product diffs."""
from pathlib import PurePosixPath
import re

EMAIL = re.compile(rb'[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})', re.I)
TEST_DOMAINS = {b'example.com', b'example.org', b'example.net', b'example.test'}
PUBLIC_COMPANY_DOMAINS = {b'thecreatingco.com'}
PATTERNS = [
    re.compile(rb'(?:gh[pousr]_|github_pat_|sk-|xox[baprs]-)[A-Za-z0-9_-]{20,}'),
    re.compile(rb'-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----'),
    re.compile(rb'(?i)(?:verification|one.time|otp|2fa|login)\s+(?:code|pin)\s*[:=]?\s*\d{6,8}'),
    re.compile(rb'(?i)[\"\'](?:api[_-]?key|access[_-]?token|password|client[_-]?secret)[\"\']\s*:\s*[\"\'][A-Za-z0-9_./+=-]{24,}[\"\']'),
]
PRIVATE_NAMES = {'CREATOR_CRM.md','EMAIL_HISTORY.md','DO_NOT_CONTACT.md','auth-profiles.json','credentials.json','openclaw.json','receipts.jsonl'}
PRIVATE_PARTS = {'.git','.ssh','.netlify','.wrangler','node_modules','site-packages','venv','.venv','browser-profile','recovery-profile','__pycache__','backups'}

def path_reason(path):
    path=PurePosixPath(str(path))
    if path.is_absolute() or '..' in path.parts or PRIVATE_PARTS.intersection(path.parts): return 'private-or-unsafe-path'
    if path.name in PRIVATE_NAMES or path.name.startswith('.env') or '.private.' in path.name or re.search(r'(?:^|[._-])lease(?:[._-]|$)',path.name,re.I): return 'private-or-runtime-file'
    if path.suffix.lower() in {'.db','.sqlite','.sqlite3','.pem','.key','.p12','.pfx'}: return 'private-or-runtime-file'
    return None

def content_reason(data):
    if b'\x00' in data: return 'binary-content'
    try: data.decode('utf-8')
    except UnicodeDecodeError: return 'non-utf8-content'
    if any(x.search(data) for x in PATTERNS): return 'secret-like-content'
    if any(x.group(0).lower() != b'git@github.com' and x.group(1).lower() not in TEST_DOMAINS | PUBLIC_COMPANY_DOMAINS and not x.group(1).lower().endswith(b'.test') for x in EMAIL.finditer(data)):
        return 'non-fixture-email-content'
    return None

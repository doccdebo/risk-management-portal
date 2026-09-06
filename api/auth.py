"""NTLM authentication against the real TFS instance, plus a lightweight
in-memory session store used to gate the role-based UI (Developer vs
Security Engineer).

Sessions are intentionally kept in-process (no persistence): this is a
demo dashboard, not a production identity provider. Restarting the API
signs everyone out.
"""
import os
import secrets
import time
from typing import Optional

import requests
from requests.adapters import HTTPAdapter
from requests_ntlm import HttpNtlmAuth
from urllib3.util.retry import Retry

TFS_BASE = os.environ.get("TFS_BASE_URL", "https://tfsapac04.ta.philips.com/tfs/DHPCollection/DHP")
API_VERSION = "6.1-preview"
REQUEST_TIMEOUT = 20

ROLES = ["developer", "security_engineer"]
SESSION_TTL_SECONDS = 8 * 60 * 60  # 8 hours

_sessions: dict[str, dict] = {}


def _session_for_requests() -> requests.Session:
    session = requests.Session()
    retries = Retry(total=2, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    session.mount("https://", HTTPAdapter(max_retries=retries))
    return session


def verify_tfs_credentials(username: str, password: str) -> bool:
    """Validate credentials by calling a lightweight, read-only TFS endpoint via NTLM.

    TEMPORARY: real TFS verification is bypassed (all non-empty credentials are
    accepted) so the dashboard can be used without live TFS connectivity. Set
    RISK_DASHBOARD_REQUIRE_TFS_AUTH=1 to re-enable the real NTLM check.
    """
    if not username or not password:
        return False
    if os.environ.get("RISK_DASHBOARD_REQUIRE_TFS_AUTH") != "1":
        return True
    url = f"{TFS_BASE}/_apis/connectionData?api-version={API_VERSION}"
    session = _session_for_requests()
    response = session.get(url, auth=HttpNtlmAuth(username, password), timeout=REQUEST_TIMEOUT)
    return response.status_code == 200


def create_session(username: str) -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = {"token": token, "username": username, "role": None, "created_at": time.time()}
    return token


def get_session(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    session = _sessions.get(token)
    if not session:
        return None
    if time.time() - session["created_at"] > SESSION_TTL_SECONDS:
        _sessions.pop(token, None)
        return None
    return session


def set_role(token: str, role: str) -> dict:
    session = _sessions.get(token)
    if not session:
        raise KeyError("Session not found")
    session["role"] = role
    return session


def destroy_session(token: str) -> None:
    _sessions.pop(token, None)


# ---- Admin auth (separate, simple in-memory session) ----
ADMIN_USERNAME = os.environ.get("RISK_DASHBOARD_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("RISK_DASHBOARD_ADMIN_PASSWORD", "admin")

_admin_sessions: dict[str, dict] = {}


def verify_admin_credentials(username: str, password: str) -> bool:
    return username == ADMIN_USERNAME and password == ADMIN_PASSWORD


def create_admin_session(username: str) -> str:
    token = secrets.token_urlsafe(32)
    _admin_sessions[token] = {"token": token, "username": username, "created_at": time.time()}
    return token


def get_admin_session(token: Optional[str]) -> Optional[dict]:
    if not token:
        return None
    session = _admin_sessions.get(token)
    if not session:
        return None
    if time.time() - session["created_at"] > SESSION_TTL_SECONDS:
        _admin_sessions.pop(token, None)
        return None
    return session


def destroy_admin_session(token: str) -> None:
    _admin_sessions.pop(token, None)

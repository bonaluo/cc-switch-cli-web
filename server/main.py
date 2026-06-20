from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import subprocess
import json
import os
import re
import sqlite3
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


# LAB.
API_PORT = int(os.environ.get("CC_SWITCH_WEB_PORT", 8765))

app = FastAPI(title="CC Switch Web", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Provider(BaseModel):
    id: str
    name: str
    api_url: str
    active: bool = False
    notes: str = ""


class ProviderDetail(Provider):
    app_type: str = ""
    category: str = ""
    website_url: str = ""
    notes: str = ""
    icon: str = ""
    health: Optional[Dict[str, Any]] = None
    quota: Optional[Dict[str, Any]] = None
    models: Optional[List[str]] = None


class ProviderSwitchRequest(BaseModel):
    id: str


class ProviderCreate(BaseModel):
    name: str
    api_url: str
    api_key: str = ""
    model: str = "claude-sonnet-4-6"


class ModelFieldUpdate(BaseModel):
    path: List[str]
    value: str


class ProviderModelsUpdate(BaseModel):
    fields: List[ModelFieldUpdate]
    apply: bool = False


class MCPCheckRequest(BaseModel):
    provider_id: str


class SpeedtestResult(BaseModel):
    provider_id: str
    endpoint: str = ""
    latency_ms: float = 0
    status: str = ""
    raw_output: str = ""


class SessionItem(BaseModel):
    provider_id: str
    session_id: str
    title: str
    summary: str
    project_dir: str
    created_at: int
    last_active_at: int
    source_path: str
    resume_command: str


class EnvVariable(BaseModel):
    name: str
    value: str
    source_type: str
    source_location: str


EnvVarDict = Dict[str, Any]


def run_cc_switch(args: List[str], timeout: int = 30) -> tuple[str, str, int]:
    """Run cc-switch command and return stdout, stderr, returncode."""
    try:
        result = subprocess.run(
            ["cc-switch"] + args,
            capture_output=True,
            text=True,
            timeout=timeout
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", 1
    except FileNotFoundError:
        return "", "cc-switch not found in PATH", 1


def is_proxy_running() -> bool:
    """Check if the local proxy is currently running."""
    stdout, stderr, rc = run_cc_switch(["proxy", "show"])
    if rc != 0:
        return False
    for line in stdout.split('\n'):
        line = line.strip()
        if '运行中' in line or 'Running' in line:
            if '是' in line or 'yes' in line.lower():
                return True
    return False


def get_provider_notes() -> Dict[str, str]:
    """Read provider notes from the local cc-switch database."""
    try:
        with open_provider_db(readonly=True) as conn:
            rows = conn.execute("SELECT id, notes FROM providers WHERE notes IS NOT NULL AND notes != ''")
            return {row[0]: row[1] for row in rows}
    except sqlite3.Error:
        return {}


def get_db_path() -> str:
    """Return the local cc-switch database path."""
    return os.path.expanduser("~/.cc-switch/cc-switch.db")


def open_provider_db(readonly: bool = True) -> sqlite3.Connection:
    """Open the cc-switch SQLite database."""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        raise HTTPException(status_code=500, detail=f"cc-switch database not found: {db_path}")
    if readonly:
        return sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def load_provider_row(provider_id: str) -> Dict[str, Any]:
    """Load a provider row from the database."""
    with open_provider_db(readonly=True) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute(
            """
            SELECT id, app_type, name, settings_config, website_url, category, created_at,
                   sort_index, notes, icon, icon_color, meta, is_current,
                   in_failover_queue, cost_multiplier, limit_daily_usd,
                   limit_monthly_usd, provider_type
            FROM providers
            WHERE id = ?
            """,
            (provider_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"Provider {provider_id} not found")
    return dict(row)


def extract_api_url(settings_config: Dict[str, Any]) -> str:
    """Extract a display API URL from app-specific settings config."""
    env = settings_config.get("env") if isinstance(settings_config, dict) else None
    if isinstance(env, dict):
        for key in ("ANTHROPIC_BASE_URL", "OPENAI_BASE_URL", "BASE_URL", "API_BASE_URL"):
            if env.get(key):
                return str(env[key])
    for key in ("base_url", "baseUrl", "api_base", "apiBase", "url"):
        if isinstance(settings_config, dict) and settings_config.get(key):
            return str(settings_config[key])
    return ""


def extract_model_fields(settings_config: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Extract editable string fields from settings config, with category for sorting."""
    fields: List[Dict[str, Any]] = []

    # Category sort order for grouping
    CATEGORY_ORDER = {
        "base_url": 0,
        "api_key": 1,
        "api_mode": 2,
        "model": 3,
        "other": 9,
    }

    def classify(key_lower: str, joined: str) -> str:
        """Determine category of a field for grouping/sorting."""
        for kw in ("base_url", "baseurl", "base"):
            if kw in key_lower or kw in joined:
                return "base_url"
        for kw in ("api_key", "apikey", "auth_token", "token", "auth"):
            if kw in key_lower or kw in joined:
                return "api_key"
        if "model" in key_lower or "model" in joined:
            return "model"
        return "other"

    def walk(value: Any, path: List[str]):
        if isinstance(value, dict):
            for key, child in value.items():
                # Skip legacy API mode keys at any level — they are managed
                # via meta JSON (apiFormat) and exposed as a separate _api_format field.
                if key in ("api", "api_mode", "wire_api"):
                    continue
                walk(child, path + [key])
        elif isinstance(value, list):
            for index, child in enumerate(value):
                walk(child, path + [str(index)])
        elif isinstance(value, str):
            key = path[-1] if path else ""
            kl = key.lower()
            joined = ".".join(path).lower()
            # Match fields relevant to provider config: model, key, url, base, token, auth, mode
            # (api/api_mode/wire_api are filtered above)
            matched = any(kw in kl for kw in (
                "model", "key", "url", "base", "token", "auth", "mode"
            ))
            if matched:
                category = classify(kl, joined)
                fields.append({
                    "path": path,
                    "label": ".".join(path),
                    "value": value,
                    "category": category,
                })

    walk(settings_config, [])
    # Sort by category order, then by label
    fields.sort(key=lambda f: (CATEGORY_ORDER.get(f["category"], 9), f["label"].lower()))
    return fields


def set_config_value(config: Any, path: List[str], value: str) -> None:
    """Set a nested string value in a JSON-compatible config object."""
    if not path:
        raise HTTPException(status_code=400, detail="Model field path cannot be empty")
    target = config
    for part in path[:-1]:
        if isinstance(target, list):
            if not part.isdigit() or int(part) >= len(target):
                raise HTTPException(status_code=400, detail=f"Invalid model field path: {'.'.join(path)}")
            target = target[int(part)]
        elif isinstance(target, dict) and part in target:
            target = target[part]
        elif isinstance(target, dict):
            # Allow creating new nested keys
            target[part] = {}
            target = target[part]
        else:
            raise HTTPException(status_code=400, detail=f"Invalid model field path: {'.'.join(path)}")
    last = path[-1]
    if isinstance(target, list):
        if not last.isdigit() or int(last) >= len(target):
            raise HTTPException(status_code=400, detail=f"Invalid model field path: {'.'.join(path)}")
        if not isinstance(target[int(last)], str):
            raise HTTPException(status_code=400, detail=f"Model field is not editable: {'.'.join(path)}")
        target[int(last)] = value
    elif isinstance(target, dict):
        target[last] = value
    else:
        raise HTTPException(status_code=400, detail=f"Invalid model field path: {'.'.join(path)}")


def serialize_config(config: Dict[str, Any]) -> str:
    """Serialize provider settings config consistently for DB storage."""
    return json.dumps(config, ensure_ascii=False, separators=(",", ":"))


# ---------------------------------------------------------------------------
# Provider list parsing (cc-switch doesn't have --json for provider list)
# ---------------------------------------------------------------------------

def parse_provider_list(stdout: str) -> List[Provider]:
    """Parse cc-switch provider list output."""
    provider_notes = get_provider_notes()
    providers = []
    lines = stdout.strip().split('\n')
    for line in lines[2:]:
        line = line.strip()
        if not line or line.startswith('╞') or line.startswith('├') or line.startswith('└') or line.startswith('──'):
            continue
        if '┆' not in line:
            continue
        parts = [p.strip() for p in line.split('┆')]
        if len(parts) < 4:
            continue
        first = parts[0]
        active = '✓' in first or '✔' in first
        provider_id = parts[1].strip()
        name = parts[2].strip()
        api_url = parts[3].strip().rstrip('│').strip()
        if provider_id and name:
            providers.append(Provider(
                id=provider_id,
                name=name,
                api_url=api_url,
                active=active,
                notes=provider_notes.get(provider_id, "")
            ))
    return providers


# ---------------------------------------------------------------------------
# Table parser (for env commands that use unicode box tables)
# ---------------------------------------------------------------------------

def parse_table(stdout: str) -> List[Dict[str, str]]:
    """Parse a cc-switch unicode box-drawing table into list of dicts.

    Handles tables like:
    ┌──────────┬──────────────┬─────────────┬────────────────┐
    │ Variable ┆ Value        ┆ Source Type ┆ Source Location│
    ╞══════════╪══════════════╪═════════════╪════════════════╡
    │ VAR_NAME ┆ val          ┆ system      ┆ Process Env    │
    └──────────┴──────────────┴─────────────┴────────────────┘
    """
    lines = [l.rstrip() for l in stdout.strip().split('\n')]

    # Find header line (contains column names, uses ┆ as separator)
    header_line_idx = None
    header_cols = None
    data_start = None

    for i, line in enumerate(lines):
        if '┆' in line:
            # Check if this is a header (look for text that looks like column names)
            parts = [p.strip() for p in line.split('┆')]
            # Remove box-drawing chars from first/last part edges
            parts[0] = parts[0].lstrip('│').strip()
            parts[-1] = parts[-1].rstrip('│').strip()

            # Determine if header or data by position in table
            if header_line_idx is None:
                header_line_idx = i
                header_cols = parts
            elif data_start is None:
                data_start = i
            break

    if header_cols is None:
        return []

    if data_start is None:
        data_start = header_line_idx + 2  # header + separator + data

    rows = []
    for line in lines[data_start:]:
        if not line or line.startswith('└') or line.startswith('╘'):
            break
        if '┆' not in line:
            continue
        parts = [p.strip() for p in line.split('┆')]
        if len(parts) < len(header_cols):
            continue
        parts[0] = parts[0].lstrip('│├╞').strip()
        parts[-1] = parts[-1].rstrip('│┤╡').strip()

        row = {}
        for idx, col_name in enumerate(header_cols):
            if idx < len(parts):
                row[col_name] = parts[idx]
            else:
                row[col_name] = ""
        rows.append(row)

    return rows


# ===========================================================================
# Provider endpoints
# ===========================================================================

@app.get("/api/providers", response_model=List[Provider])
def get_providers():
    """List all providers."""
    stdout, stderr, rc = run_cc_switch(["provider", "list"])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to list providers: {stderr}")
    return parse_provider_list(stdout)


@app.get("/api/providers/{provider_id}")
def get_provider_detail(provider_id: str):
    """Get detailed info about a provider (health, config) from DB."""
    try:
        row = load_provider_row(provider_id)
    except HTTPException:
        # Fallback to provider list
        plist_stdout, _, _ = run_cc_switch(["provider", "list"])
        providers = parse_provider_list(plist_stdout)
        for p in providers:
            if p.id == provider_id:
                return {"provider": p.model_dump(), "health": None, "quota": None, "models": None}
        raise HTTPException(status_code=404, detail=f"Provider {provider_id} not found")

    settings = json.loads(row["settings_config"]) if row["settings_config"] else {}
    api_url = extract_api_url(settings)
    model_fields = extract_model_fields(settings)

    # API Format from meta JSON (settings_config may have stale api_mode/api keys to ignore)
    meta_json = json.loads(row["meta"]) if row["meta"] else {}
    api_format = meta_json.get("apiFormat", "")
    if not api_format:
        # Derive default from app_type
        app_type = row["app_type"]
        if app_type == "claude":
            api_format = "anthropic"
        elif app_type == "openclaw":
            api_format = "openai_chat"
        elif app_type == "hermes":
            api_format = "chat_completions"
        else:
            api_format = "unknown"
    # Insert as api_mode category so it sorts correctly
    model_fields.insert(0, {
        "path": ["_api_format"],
        "label": "API Format",
        "value": api_format,
        "category": "api_mode",
        "options": ["anthropic", "openai_chat"],
    })

    # Meta fields: name and notes are stored as provider columns, not in settings_config
    meta_fields = [
        {
            "path": ["_name"],
            "label": "Name",
            "value": row["name"] or "",
            "category": "name",
        },
        {
            "path": ["_notes"],
            "label": "Notes",
            "value": row["notes"] or "",
            "category": "notes",
        },
    ]

    # Health info from DB (if any)
    health = None
    try:
        with open_provider_db(readonly=True) as _conn:
            for h in _conn.execute(
                "SELECT is_healthy,consecutive_failures,last_error,updated_at "
                "FROM provider_health WHERE provider_id=?",
                (provider_id,)
            ).fetchall():
                health = {
                    "is_healthy": bool(h[0]),
                    "consecutive_failures": h[1],
                    "last_error": h[2],
                    "updated_at": h[3],
                }
    except sqlite3.Error:
        pass

    return {
        "provider": {
            "id": row["id"],
            "app_type": row["app_type"],
            "name": row["name"],
            "settings_config": settings,
            "api_url": api_url,
            "notes": row["notes"] or "",
            "category": row["category"] or "",
            "website_url": row["website_url"] or "",
            "icon": row["icon"] or "",
            "is_current": bool(row["is_current"]),
            "in_failover_queue": bool(row["in_failover_queue"]),
            "cost_multiplier": row["cost_multiplier"],
        },
        "health": health,
        "model_fields": model_fields,
        "meta_fields": meta_fields,
    }


@app.put("/api/providers/{provider_id}/models")
def update_provider_models(provider_id: str, payload: ProviderModelsUpdate = Body(...)):
    """Save model field changes directly to DB, optionally apply the provider."""
    row = load_provider_row(provider_id)
    try:
        settings = json.loads(row["settings_config"]) if row["settings_config"] else {}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Provider config is not valid JSON")

    meta_updates: Dict[str, str] = {}
    meta_json_updates: Dict[str, Any] = {}
    config_fields = []
    for field in payload.fields:
        path_str = field.path[0] if field.path else ""
        if path_str == "_name":
            meta_updates["name"] = field.value
        elif path_str == "_notes":
            meta_updates["notes"] = field.value
        elif path_str == "_api_format":
            meta_json_updates["apiFormat"] = field.value
        else:
            config_fields.append(field)
            set_config_value(settings, field.path, field.value)

    # Update provider row for meta fields (name, notes)
    if meta_updates:
        try:
            with open_provider_db(readonly=False) as conn:
                for col, val in meta_updates.items():
                    conn.execute(
                        f"UPDATE providers SET {col} = ? WHERE id = ?",
                        (val, provider_id)
                    )
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to update provider meta: {e}")

    # Update meta JSON for apiFormat
    if meta_json_updates:
        try:
            # Re-read meta to be safe (row was loaded earlier)
            with open_provider_db(readonly=True) as _conn:
                fresh = _conn.execute("SELECT meta FROM providers WHERE id = ?", (provider_id,)).fetchone()
                current_meta = json.loads(fresh[0]) if fresh and fresh[0] else {}
            current_meta.update(meta_json_updates)
            serialized_meta = json.dumps(current_meta, ensure_ascii=False)
            with open_provider_db(readonly=False) as conn:
                conn.execute("UPDATE providers SET meta = ? WHERE id = ?", (serialized_meta, provider_id))
        except (sqlite3.Error, json.JSONDecodeError) as e:
            raise HTTPException(status_code=500, detail=f"Failed to update provider meta JSON: {e}")

    if config_fields:
        serialized = serialize_config(settings)
        try:
            with open_provider_db(readonly=False) as conn:
                conn.execute(
                    "UPDATE providers SET settings_config = ? WHERE id = ?",
                    (serialized, provider_id)
                )
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Failed to update provider DB: {e}")

    applied = False
    if payload.apply:
        stdout, stderr, rc = run_cc_switch(["use", provider_id])
        if rc != 0:
            raise HTTPException(status_code=500, detail=f"Save succeeded but apply failed: {stderr}")
        applied = True

    return {
        "success": True,
        "saved": True,
        "applied": applied,
        "provider_id": provider_id,
        "updated_fields": len(payload.fields)
    }


@app.post("/api/providers/{provider_id}/switch")
def switch_provider(provider_id: str):
    """Switch to a provider."""
    proxy_was_running = is_proxy_running()

    stdout, stderr, rc = run_cc_switch(["use", provider_id])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to switch provider: {stderr}")

    proxy_re_enabled = False
    proxy_message = ""
    if proxy_was_running:
        _, _, prc = run_cc_switch(["proxy", "enable"])
        if prc == 0:
            proxy_re_enabled = True
            proxy_message = ". Proxy re-enabled for switch to take effect"

    return {
        "success": True,
        "message": f"Switched to provider {provider_id}{proxy_message}",
        "output": stdout,
        "proxy_re_enabled": proxy_re_enabled,
    }


@app.post("/api/providers/{provider_id}/duplicate")
def duplicate_provider(provider_id: str):
    """Duplicate a provider (works without TTY)."""
    stdout, stderr, rc = run_cc_switch(["provider", "duplicate", provider_id])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to duplicate provider: {stderr}")
    return {"success": True, "output": stdout, "message": f"Duplicated provider {provider_id}"}


@app.post("/api/providers/{provider_id}/speedtest")
def speedtest_provider(provider_id: str):
    """Run speedtest for a provider."""
    stdout, stderr, rc = run_cc_switch(
        ["provider", "speedtest", provider_id],
        timeout=60
    )
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Speedtest failed: {stderr}")
    return {"success": True, "output": stdout}


@app.post("/api/providers/{provider_id}/quota")
def quota_provider(provider_id: str):
    """Query provider quota (JSON output available)."""
    stdout, stderr, rc = run_cc_switch(
        ["provider", "quota", provider_id, "--json"],
        timeout=30
    )
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Quota query failed: {stderr}")
    try:
        data = json.loads(stdout)
        return {"success": True, "data": data}
    except json.JSONDecodeError:
        return {"success": True, "output": stdout}


@app.post("/api/providers/{provider_id}/fetch-models")
def fetch_models_provider(provider_id: str):
    """Fetch remote models for a provider."""
    stdout, stderr, rc = run_cc_switch(
        ["provider", "fetch-models", provider_id],
        timeout=30
    )
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to fetch models: {stderr}")
    return {"success": True, "output": stdout}


@app.get("/api/provider/current")
def get_current_provider():
    """Get currently active provider."""
    stdout, stderr, rc = run_cc_switch(["provider", "list"])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to get current provider: {stderr}")
    providers = parse_provider_list(stdout)
    for p in providers:
        if p.active:
            return p
    return None


# ===========================================================================
# Session endpoints (structured JSON via --json flag)
# ===========================================================================

@app.get("/api/sessions")
def get_sessions(all: bool = False, provider: str = ""):
    """List sessions with structured JSON output."""
    args = ["sessions", "list", "--json"]
    if all:
        args.append("--all")
    if provider:
        args.extend(["--provider", provider])

    stdout, stderr, rc = run_cc_switch(args)
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {stderr}")

    try:
        sessions = json.loads(stdout)
        return {"sessions": sessions}
    except json.JSONDecodeError:
        return {"sessions": [], "raw": stdout}


@app.get("/api/sessions/{session_id}")
def get_session_detail(session_id: str):
    """Show session detail with messages."""
    stdout, stderr, rc = run_cc_switch(["sessions", "show", "--json", session_id])
    if rc != 0:
        raise HTTPException(status_code=404, detail=f"Session not found: {stderr}")
    try:
        data = json.loads(stdout)
        return data
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Failed to parse session data")


@app.get("/api/sessions/{session_id}/messages")
def get_session_messages(session_id: str):
    """Get messages for a session."""
    stdout, stderr, rc = run_cc_switch(["sessions", "messages", "--json", session_id])
    if rc != 0:
        raise HTTPException(status_code=404, detail=f"Session messages not found: {stderr}")
    try:
        messages = json.loads(stdout)
        return {"messages": messages}
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Failed to parse session messages")


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    """Delete a saved session."""
    stdout, stderr, rc = run_cc_switch(["sessions", "delete", session_id])
    if rc != 0:
        # sessions delete might need TTY; try to provide guidance
        if "TTY" in stderr or "tty" in stderr.lower():
            raise HTTPException(
                status_code=400,
                detail=f"Session deletion requires TTY. Run: cc-switch sessions delete {session_id}"
            )
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {stderr}")
    return {"success": True, "message": f"Deleted session {session_id}"}


# ===========================================================================
# Environment endpoints (parsed table output)
# ===========================================================================

@app.get("/api/env/variables")
def get_env_variables(app: str = "claude"):
    """List environment variables with structured output."""
    args = ["env", "list"]
    if app:
        args.extend(["--app", app])
    stdout, stderr, rc = run_cc_switch(args)
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to list env vars: {stderr}")

    vars_list = parse_table(stdout)
    return {"variables": vars_list, "app": app}


@app.get("/api/env/check")
def check_env(app: str = "claude"):
    """Check for environment variable conflicts."""
    args = ["env", "check"]
    if app:
        args.extend(["--app", app])
    stdout, stderr, rc = run_cc_switch(args)
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to check env: {stderr}")

    conflicts = parse_table(stdout)
    return {"conflicts": conflicts, "app": app, "has_conflicts": len(conflicts) > 0}


@app.get("/api/env/tools")
def get_env_tools():
    """Check local CLI tools."""
    stdout, stderr, rc = run_cc_switch(["env", "tools"])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to check env tools: {stderr}")

    tools = parse_table(stdout)
    return {"tools": tools}


# ===========================================================================
# Proxy endpoints
# ===========================================================================

@app.get("/api/proxy/status")
def get_proxy_status():
    """Get proxy status."""
    stdout, stderr, rc = run_cc_switch(["proxy", "show"])
    return {
        "running": is_proxy_running(),
        "output": stdout,
        "stderr": stderr,
    }


@app.post("/api/proxy/enable")
def enable_proxy():
    """Enable the proxy."""
    stdout, stderr, rc = run_cc_switch(["proxy", "enable"])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to enable proxy: {stderr}")
    return {"success": True, "output": stdout}


@app.post("/api/proxy/disable")
def disable_proxy():
    """Disable the proxy."""
    stdout, stderr, rc = run_cc_switch(["proxy", "disable"])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to disable proxy: {stderr}")
    return {"success": True, "output": stdout}


# ===========================================================================
# MCP endpoints
# ===========================================================================

@app.get("/api/mcp/status")
def get_mcp_status():
    """Get MCP sync status."""
    stdout, stderr, rc = run_cc_switch(["mcp", "sync", "--dry-run"])
    return {"output": stdout, "stderr": stderr}


# ===========================================================================
# WebSocket for real-time updates
# ===========================================================================

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                disconnected.append(connection)
        for d in disconnected:
            if d in self.active_connections:
                self.active_connections.remove(d)


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                cmd = msg.get("command", "")
                if cmd == "refresh":
                    stdout, _, rc = run_cc_switch(["provider", "list"])
                    if rc == 0:
                        providers = parse_provider_list(stdout)
                        await websocket.send_json({
                            "type": "providers",
                            "data": [p.model_dump() for p in providers]
                        })
                elif cmd == "switch":
                    pid = msg.get("provider_id", "")
                    if pid:
                        proxy_was_running = is_proxy_running()
                        _, _, rc = run_cc_switch(["use", pid])
                        if rc == 0:
                            if proxy_was_running:
                                run_cc_switch(["proxy", "enable"])
                            await websocket.send_json({
                                "type": "switched",
                                "provider_id": pid
                            })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ===========================================================================
# Serve static files (frontend build)
# ===========================================================================

dist_path = os.path.join(os.path.dirname(__file__), "..", "web", "dist")
if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """Serve SPA index.html for all non-API routes."""
        file_path = os.path.join(dist_path, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))


def main():
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=API_PORT, reload=False)


if __name__ == "__main__":
    main()

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import subprocess
import json
import os
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


class ProviderSwitchRequest(BaseModel):
    id: str


class ProviderCreate(BaseModel):
    name: str
    api_url: str
    api_key: str = ""
    model: str = "claude-sonnet-4-6"


class MCPCheckRequest(BaseModel):
    provider_id: str


def run_cc_switch(args: List[str]) -> tuple[str, str, int]:
    """Run cc-switch command and return stdout, stderr, returncode."""
    try:
        result = subprocess.run(
            ["cc-switch"] + args,
            capture_output=True,
            text=True,
            timeout=30
        )
        return result.stdout, result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", 1
    except FileNotFoundError:
        return "", "cc-switch not found in PATH", 1


def parse_provider_list(stdout: str) -> List[Provider]:
    """Parse cc-switch provider list output."""
    providers = []
    lines = stdout.strip().split('\n')
    # Skip header lines (first 2 lines typically)
    for line in lines[2:]:
        line = line.strip()
        if not line or line.startswith('╞') or line.startswith('├') or line.startswith('└') or line.startswith('──'):
            continue
        # Match pattern like: │ ✓ ┆ id ┆ name ┆ url │
        # cc-switch output uses unicode box characters
        # Try to extract: active status, id, name, api_url
        if '┆' not in line:
            continue
        parts = [p.strip() for p in line.split('┆')]
        if len(parts) < 4:
            continue
        # parts[0] like "│ ✓ " or "│   "
        first = parts[0]
        active = '✓' in first or '✔' in first
        provider_id = parts[1].strip()
        name = parts[2].strip()
        api_url = parts[3].strip().rstrip('│').strip()
        if provider_id and name:
            providers.append(Provider(id=provider_id, name=name, api_url=api_url, active=active))
    return providers


@app.get("/api/providers", response_model=List[Provider])
def get_providers():
    """List all providers."""
    stdout, stderr, rc = run_cc_switch(["provider", "list"])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to list providers: {stderr}")
    providers = parse_provider_list(stdout)
    return providers


@app.post("/api/providers/{provider_id}/switch")
def switch_provider(provider_id: str):
    """Switch to a provider."""
    stdout, stderr, rc = run_cc_switch(["use", provider_id])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to switch provider: {stderr}")
    return {"success": True, "message": f"Switched to provider {provider_id}", "output": stdout}


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


@app.get("/api/sessions")
def get_sessions(all: bool = False):
    """List sessions."""
    args = ["sessions", "list"]
    if all:
        args.append("--all")
    stdout, stderr, rc = run_cc_switch(args)
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to list sessions: {stderr}")
    return {"output": stdout}


@app.get("/api/mcp/status")
def get_mcp_status():
    """Get MCP sync status."""
    stdout, stderr, rc = run_cc_switch(["mcp", "sync", "--dry-run"])
    return {"output": stdout, "stderr": stderr}


@app.get("/api/env/tools")
def get_env_tools():
    """Check environment tools."""
    stdout, stderr, rc = run_cc_switch(["env", "tools"])
    if rc != 0:
        raise HTTPException(status_code=500, detail=f"Failed to check env: {stderr}")
    return {"output": stdout}


# WebSocket for real-time updates
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
            # Echo back or handle commands
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
                        _, _, rc = run_cc_switch(["use", pid])
                        if rc == 0:
                            await websocket.send_json({
                                "type": "switched",
                                "provider_id": pid
                            })
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# Serve static files (frontend build)
dist_path = os.path.join(os.path.dirname(__file__), "..", "web", "dist")
if os.path.exists(dist_path):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """Serve SPA index.html for all non-API routes."""
        # If it's an file, serve it
        file_path = os.path.join(dist_path, path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve index.html
        return FileResponse(os.path.join(dist_path, "index.html"))


def main():
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=API_PORT, reload=False)


if __name__ == "__main__":
    main()

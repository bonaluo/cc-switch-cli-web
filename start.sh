#!/bin/bash
# CC Switch Web Starter Script
# This script starts the CC Switch Web server

set -e

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
WEB_DIR="$SCRIPT_DIR/web"

# Default port
PORT=${CC_SWITCH_WEB_PORT:-8765}

echo "=========================================="
echo "  CC Switch Web - Starting..."
echo "=========================================="
echo ""
echo "Port: $PORT"
echo "Server: $SERVER_DIR/main.py"
echo "Web UI: $WEB_DIR/dist"
echo ""

# Check if cc-switch is available
if ! command -v cc-switch &> /dev/null; then
    echo "❌ Error: cc-switch command not found!"
    echo "   Please install cc-switch-cli first:"
    echo "   curl -fsSL https://github.com/SaladDay/cc-switch-cli/releases/latest/download/install.sh | bash"
    exit 1
fi
echo "✅ cc-switch found: $(cc-switch --version)"

# Check if Python and uvicorn are available
if ! command -v uvicorn &> /dev/null; then
    echo "❌ Error: uvicorn not found!"
    echo "   Please install it: pip install fastapi uvicorn websockets"
    exit 1
fi
echo "✅ uvicorn found"

# Check if frontend build exists
if [ ! -f "$WEB_DIR/dist/index.html" ]; then
    echo "⚠️  Frontend build not found. Building..."
    cd "$WEB_DIR"
    npm install
    npm run build
fi
echo "✅ Frontend build exists"

# Kill any existing server on the port
PORT_PID=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$PORT_PID" ]; then
    echo "⚠️  Port $PORT is in use, killing process..."
    kill -9 $PORT_PID 2>/dev/null || true
    sleep 1
fi

echo ""
echo "🚀 Starting CC Switch Web on http://localhost:$PORT"
echo "   Press Ctrl+C to stop"
echo "=========================================="
echo ""

# Start the server
cd "$SERVER_DIR"
python3 main.py

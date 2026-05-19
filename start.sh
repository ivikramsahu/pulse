#!/bin/bash
# Platform Pulse — install & start
set -e

cd "$(dirname "$0")"

if [ ! -f "../config/atlassian.yaml" ]; then
  echo "ERROR: config/atlassian.yaml not found."
  echo "Copy config/atlassian.example.yaml and fill in your credentials."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║        Platform Pulse                ║"
echo "  ║  http://localhost:5173               ║"
echo "  ║  API: http://localhost:3001          ║"
echo "  ║  Login: @harness.io emails only      ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

npm run dev

#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================="
echo "  Gateway Core Desktop Build Script"
echo "  Working directory: $SCRIPT_DIR"
echo "========================================="

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed"
    exit 1
fi

# 1. Install Node.js server dependencies
echo "[1/4] Installing server dependencies..."
cd server
npm install --production
cd ..

# 2. Create icon
echo "[2/4] Creating icon..."
cd electron
node create-icon.js
cd ..

# 3. Build frontend
echo "[3/4] Building frontend UI..."
cd desktop-ui
npm install --legacy-peer-deps
npm run build
if [ $? -ne 0 ]; then
    echo "Failed to build frontend"
    exit 1
fi
cd ..

# 4. Copy frontend build to electron
echo "[4/4] Copying frontend to electron..."
rm -rf electron/src/ui
cp -r desktop-ui/build electron/src/ui

# Copy server to electron resources
mkdir -p electron/release/resources
cp -r server electron/release/resources/

echo "========================================="
echo "  Build Complete!"
echo "  Output: electron/dist/"
echo "========================================="

# Show the output files
ls -la electron/dist/

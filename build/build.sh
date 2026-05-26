#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

echo "Building frontend..."
cd frontend && npm ci && npm run build && cd ..

echo "Building exe..."
uv pip install pyinstaller
uv run pyinstaller build/sitrep-lite.spec --distpath build/out --workpath build/tmp --clean

echo "Creating zip..."
cd build/out
zip -r ../SitrepLite-v1.0.0.zip SitrepLite/
echo "Done: build/SitrepLite-v1.0.0.zip"

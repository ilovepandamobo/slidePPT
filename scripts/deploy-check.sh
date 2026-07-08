#!/bin/sh
# 本地或 CI 检查 Docker 构建与启动（与 Railway 使用同一 Dockerfile）
set -e
cd "$(dirname "$0")/.."

echo "==> docker build"
docker build -t slidecraft:local .

echo "==> docker run smoke test"
docker rm -f slidecraft-local 2>/dev/null || true
docker run -d --name slidecraft-local -p 13000:3000 \
  -e JWT_SECRET=local-test-secret \
  -e RUN_SEED=true \
  -v slidecraft-local-data:/data \
  slidecraft:local

sleep 12
echo "==> HTTP check"
curl -fsS "http://localhost:13000/" | head -c 300 || true
echo ""
echo "==> container logs"
docker logs slidecraft-local 2>&1 | tail -40

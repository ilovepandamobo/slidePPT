#!/bin/sh
set -e

export DATA_DIR="${DATA_DIR:-/data}"

# Railway volume mounts as root; fix ownership then drop to nextjs.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR/slide-images" "$DATA_DIR/style-refs"
  chown -R nextjs:nodejs "$DATA_DIR"
  exec su-exec nextjs "$0" "$@"
fi

mkdir -p "$DATA_DIR/slide-images" "$DATA_DIR/style-refs"

if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:${DATA_DIR}/slidecraft.db"
fi

echo "[slidecraft] DATA_DIR=$DATA_DIR"
echo "[slidecraft] DATABASE_URL=$DATABASE_URL"
echo "[slidecraft] running prisma migrate deploy..."
node ./node_modules/prisma/build/index.js migrate deploy

if [ "$RUN_SEED" = "true" ]; then
  echo "[slidecraft] seeding database..."
  node prisma/seed.bundle.cjs || true
fi

echo "[slidecraft] starting server on port ${PORT:-3000}..."
exec node server.js

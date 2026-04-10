#!/bin/bash
set -e

SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_KEY:-}}"

# Normalize any bundled training artifact into the runtime path first
if [ ! -f "weights/best.pt" ] && [ -f "weights/train_optimized_v2/weights/best.pt" ]; then
  echo "[startup] Using bundled train_optimized_v2 weight artifact"
  cp "weights/train_optimized_v2/weights/best.pt" "weights/best.pt"
fi

# Download weights from Supabase Storage if not present
if [ ! -f "weights/best.pt" ]; then
  if [ -n "$SUPABASE_URL" ] && [ -n "$SERVICE_KEY" ]; then
    echo "[startup] Downloading weights from Supabase Storage..."
    mkdir -p weights
    set +e
    HTTP_STATUS=$(curl -s -o weights/best.pt -w "%{http_code}" \
      -H "Authorization: Bearer ${SERVICE_KEY}" \
      "${SUPABASE_URL}/storage/v1/object/detection-weights/best.pt")
    CURL_EXIT=$?
    set -e
    if [ "$CURL_EXIT" != "0" ] || [ "$HTTP_STATUS" != "200" ]; then
      echo "[startup] WARNING: weights download failed (curl=$CURL_EXIT http=${HTTP_STATUS:-n/a}), running without custom weights"
      rm -f weights/best.pt
    else
      echo "[startup] Weights downloaded successfully"
    fi
  else
    echo "[startup] WARNING: missing Supabase env for weight download, running without custom weights"
  fi
else
  echo "[startup] Using existing weights/best.pt"
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"

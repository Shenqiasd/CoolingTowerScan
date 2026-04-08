#!/bin/bash
set -e

# Download weights from Supabase Storage if not present
if [ ! -f "weights/best.pt" ]; then
  echo "[startup] Downloading weights from Supabase Storage..."
  mkdir -p weights
  HTTP_STATUS=$(curl -s -o weights/best.pt -w "%{http_code}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
    "${SUPABASE_URL}/storage/v1/object/detection-weights/best.pt")
  if [ "$HTTP_STATUS" != "200" ]; then
    echo "[startup] WARNING: weights download failed (HTTP $HTTP_STATUS), running without custom weights"
    rm -f weights/best.pt
  else
    echo "[startup] Weights downloaded successfully"
  fi
else
  echo "[startup] Using existing weights/best.pt"
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"

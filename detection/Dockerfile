FROM python:3.11-slim
WORKDIR /app

# git is required by torch.hub to clone ultralytics/yolov5
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-cache the yolov5 repo so startup is fast (no network needed at runtime)
RUN python - <<'EOF'
import torch
torch.hub.load("ultralytics/yolov5", "yolov5s", pretrained=False, verbose=False)
EOF

COPY main.py detector.py startup.sh ./
RUN mkdir -p weights && chmod +x startup.sh
CMD ["./startup.sh"]

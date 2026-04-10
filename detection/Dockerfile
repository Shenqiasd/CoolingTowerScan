FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends curl libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py detector.py startup.sh ./
COPY weights ./weights
RUN mkdir -p weights && chmod +x startup.sh
CMD ["./startup.sh"]

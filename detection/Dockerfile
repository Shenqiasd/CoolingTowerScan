FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py detector.py startup.sh ./
RUN mkdir -p weights && chmod +x startup.sh
CMD ["./startup.sh"]

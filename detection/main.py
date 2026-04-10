"""
冷却塔识别 FastAPI 服务

启动:
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

接口:
    POST /detect          - 上传图片，返回检测结果
    GET  /health          - 健康检查
    GET  /model-info      - 当前加载的模型信息
"""
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import requests as http_requests
import detector

app = FastAPI(title="CoolingTower Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境请限制为前端域名
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    weights_path = detector.resolve_weights_path()
    return {
        "status": "ok",
        "custom_weights": weights_path.exists(),
        "weights_path": str(weights_path),
    }


@app.get("/model-info")
def model_info():
    weights_path = detector.resolve_weights_path()
    model = detector.get_model()
    return {
        "using_custom_weights": weights_path.exists(),
        "weights_path": str(weights_path),
        "classes": model.names,
    }


class DetectUrlRequest(BaseModel):
    image_url: str


@app.post("/detect/url")
async def detect_url(body: DetectUrlRequest, conf: float = 0.25):
    """服务端下载图片再识别，避免前端 CORS 问题"""
    try:
        resp = http_requests.get(body.image_url, timeout=30)
        resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"图片下载失败: {str(e)}")

    if len(resp.content) == 0:
        raise HTTPException(status_code=400, detail="图片内容为空")

    try:
        result = detector.detect(resp.content, conf_threshold=conf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"推理失败: {str(e)}")

    return result


@app.post("/detect")
async def detect(
    image: UploadFile = File(...),
    conf: float = 0.25,
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="请上传图片文件")

    image_bytes = await image.read()
    if len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="图片文件为空")

    try:
        result = detector.detect(image_bytes, conf_threshold=conf)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"推理失败: {str(e)}")

    return result

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
from pathlib import Path
import detector

app = FastAPI(title="CoolingTower Detection API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境请限制为前端域名
    allow_methods=["*"],
    allow_headers=["*"],
)

WEIGHTS_PATH = Path(__file__).parent / "weights" / "best.pt"


@app.get("/health")
def health():
    return {"status": "ok", "custom_weights": WEIGHTS_PATH.exists()}


@app.get("/model-info")
def model_info():
    model = detector.get_model()
    return {
        "using_custom_weights": WEIGHTS_PATH.exists(),
        "weights_path": str(WEIGHTS_PATH) if WEIGHTS_PATH.exists() else "yolov8n.pt (fallback)",
        "classes": model.names,
    }


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

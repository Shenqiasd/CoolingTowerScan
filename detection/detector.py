"""
冷却塔 YOLOv5 推理封装（TowerScout 权重）
- 加载 weights/best.pt（TowerScout 预训练 YOLOv5 权重）
- 通过 torch.hub 加载 YOLOv5，兼容 TowerScout best.pt 格式
"""
import io
from pathlib import Path
from typing import Optional

import torch
from PIL import Image

WEIGHTS_DIR = Path(__file__).parent / "weights"
CUSTOM_WEIGHTS = WEIGHTS_DIR / "best.pt"

_model = None


def get_model():
    global _model
    if _model is not None:
        return _model

    if not CUSTOM_WEIGHTS.exists():
        raise RuntimeError(
            f"权重文件不存在: {CUSTOM_WEIGHTS}。"
            "请将 TowerScout best.pt 上传到 Supabase Storage detection-weights/best.pt"
        )

    print(f"[detector] 加载 YOLOv5 权重: {CUSTOM_WEIGHTS}")
    # force_reload=False 避免每次重启都重新下载 yolov5 repo
    _model = torch.hub.load(
        "ultralytics/yolov5",
        "custom",
        path=str(CUSTOM_WEIGHTS),
        force_reload=False,
        verbose=False,
    )
    _model.eval()
    print("[detector] 模型加载完成")
    return _model


def detect(image_bytes: bytes, conf_threshold: float = 0.25) -> dict:
    """
    对图片字节流执行 YOLOv5 推理。

    Returns:
        {
            "has_cooling_tower": bool,
            "count": int,
            "confidence": float,
            "detections": [
                {
                    "x1", "y1", "x2", "y2",
                    "center_x", "center_y",
                    "width", "height",
                    "confidence", "class_name"
                }
            ]
        }
    """
    model = get_model()
    model.conf = conf_threshold

    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    results = model(image, size=640)

    detections = []
    max_conf = 0.0

    # results.xyxy[0] shape: (N, 6) — x1 y1 x2 y2 conf cls
    for *box, conf, cls_id in results.xyxy[0].tolist():
        x1, y1, x2, y2 = box
        conf = round(float(conf), 4)
        cls_name = model.names[int(cls_id)]

        max_conf = max(max_conf, conf)
        detections.append({
            "x1": round(x1, 2),
            "y1": round(y1, 2),
            "x2": round(x2, 2),
            "y2": round(y2, 2),
            "center_x": round((x1 + x2) / 2, 2),
            "center_y": round((y1 + y2) / 2, 2),
            "width": round(x2 - x1, 2),
            "height": round(y2 - y1, 2),
            "confidence": conf,
            "class_name": cls_name,
        })

    return {
        "has_cooling_tower": len(detections) > 0,
        "count": len(detections),
        "confidence": round(max_conf, 4),
        "detections": detections,
    }

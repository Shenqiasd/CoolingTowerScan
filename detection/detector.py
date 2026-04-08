"""
冷却塔 YOLOv8 推理封装
- 加载 weights/best.pt（ultralytics YOLOv8 格式，单类别 cooling_tower）
"""
import io
from pathlib import Path
from typing import Optional

from ultralytics import YOLO
from PIL import Image

WEIGHTS_DIR = Path(__file__).parent / "weights"
CUSTOM_WEIGHTS = WEIGHTS_DIR / "best.pt"

_model: Optional[YOLO] = None


def get_model() -> YOLO:
    global _model
    if _model is not None:
        return _model

    if not CUSTOM_WEIGHTS.exists():
        raise RuntimeError(
            f"权重文件不存在: {CUSTOM_WEIGHTS}。"
            "请将 best.pt 上传到 Supabase Storage detection-weights/best.pt"
        )

    print(f"[detector] 加载 YOLOv8 权重: {CUSTOM_WEIGHTS}")
    _model = YOLO(str(CUSTOM_WEIGHTS))
    print(f"[detector] 模型加载完成，类别: {_model.names}")
    return _model


def detect(image_bytes: bytes, conf_threshold: float = 0.25) -> dict:
    model = get_model()
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    results = model(image, conf=conf_threshold, verbose=False)

    detections = []
    max_conf = 0.0

    for result in results:
        if result.boxes is None:
            continue
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            conf = round(float(box.conf[0]), 4)
            cls_name = model.names[int(box.cls[0])]

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

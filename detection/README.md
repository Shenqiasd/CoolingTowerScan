# 冷却塔识别服务

## 目录结构

```
detection/
├── main.py          # FastAPI 服务入口
├── detector.py      # YOLO 推理封装
├── requirements.txt # Python 依赖
└── weights/
    └── best.pt      # ← 把你的 YOLO 权重文件放这里
```

## 安装与启动

```bash
cd detection

# 创建虚拟环境（推荐）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 启动服务（开发模式）
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 放入权重文件

将你的 YOLO 权重文件重命名为 `best.pt`，放到 `weights/` 目录下：

```
detection/weights/best.pt
```

服务启动时会自动检测并加载。若未找到，会使用 `yolov8n.pt` 通用模型作为占位（无法识别冷却塔）。

## API

### POST /detect

上传图片，返回检测结果。

**请求：** `multipart/form-data`
- `image`: 图片文件（PNG/JPG）
- `conf`: 置信度阈值（可选，默认 0.25）

**响应：**
```json
{
  "has_cooling_tower": true,
  "count": 3,
  "confidence": 0.87,
  "detections": [
    {
      "x1": 120.5, "y1": 80.2, "x2": 340.1, "y2": 290.8,
      "center_x": 230.3, "center_y": 185.5,
      "width": 219.6, "height": 210.6,
      "confidence": 0.87,
      "class_name": "cooling_tower"
    }
  ]
}
```

### GET /health

健康检查，返回服务状态和权重文件是否存在。

### GET /model-info

返回当前加载的模型信息和类别列表。

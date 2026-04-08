# CoolingTowerScan

冷却塔识别与 HVAC 交付全流程数字化平台。通过卫星地图截图 + YOLOv8 目标检测，自动识别冷却塔位置，辅助暖通空调行业的线索发现与项目交付。

## 架构

```
repo/          → React + TypeScript 前端（Vite）
detection/     → Python FastAPI 检测服务（YOLOv8 + ultralytics）
orchestrator/  → Python FastAPI 编排服务（AI Agent）
```

- 前端部署在 Railway，检测服务独立部署
- 数据库使用 Supabase（PostgreSQL + Storage）
- 地图使用 Mapbox GL + 高德 POI 搜索

## 本地开发

### 前端

```bash
cd repo
cp .env.example .env   # 填入 Supabase 和 Mapbox 凭据
npm install
npm run dev            # http://localhost:5173
```

### 检测服务

```bash
cd detection
pip install -r requirements.txt
# 将 best.pt 权重文件放到 detection/weights/
python main.py         # http://localhost:8000
```

### 常用命令

```bash
npm run build          # 生产构建
npm run typecheck      # TypeScript 类型检查
npm run lint           # ESLint 检查
```

## 开发流程

1. 从 `develop` 分支创建 feature 分支：`git checkout -b feat/xxx develop`
2. 开发完成后推送并创建 PR 到 `develop`
3. CI 自动运行 typecheck + lint + build
4. 代码审核通过后合并
5. `develop` 定期合并到 `main` 发布

## 部署

- 前端：Railway（自动从 GitHub main 分支部署）
- 检测服务：Railway（Docker 构建）
- 数据库：Supabase

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18, TypeScript, Tailwind CSS, Vite |
| 地图 | Mapbox GL, 高德 POI API |
| 检测 | YOLOv8 (ultralytics), FastAPI |
| 数据库 | Supabase (PostgreSQL + Storage) |
| 部署 | Railway, Docker |

#!/usr/bin/env node

/**
 * 批量上传企业卫星图片到 Supabase Storage 并更新数据库
 *
 * 用法:
 *   node scripts/batch-upload-images.mjs --original ./未识别图片 --detected ./识别图片
 *
 * 参数:
 *   --original <path>   未识别（原始）图片文件夹路径
 *   --detected <path>   识别（标注）图片和 JSON 文件夹路径
 *   --dry-run            仅预览匹配结果，不实际上传
 *   --concurrency <n>    并发上传数量，默认 5
 *
 * 文件命名规则:
 *   原始图片:   地图截图_<企业名>.png
 *   标注图片:   地图截图_<企业名>_detected.jpg
 *   检测JSON:   地图截图_<企业名>_detection.json
 *
 * 脚本会自动从文件名中提取企业名，与数据库中的 enterprise_name 模糊匹配。
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

const SUPABASE_URL = 'https://kefvjxpahhfuvciaixha.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtlZnZqeHBhaGhmdXZjaWFpeGhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMzU1MjcsImV4cCI6MjA4OTkxMTUyN30.2NlK3pqxTAmIxDKp2KeLM5CymmZvDy4_ERX-iTrkt44';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET = 'enterprise-images';

const { values: args } = parseArgs({
  options: {
    original: { type: 'string' },
    detected: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '5' },
  },
  strict: false,
});

if (!args.original && !args.detected) {
  console.error('请至少提供一个文件夹路径:');
  console.error('  --original <未识别图片文件夹>');
  console.error('  --detected <识别图片文件夹>');
  process.exit(1);
}

const CONCURRENCY = parseInt(args.concurrency || '5', 10);
const DRY_RUN = args['dry-run'] || false;

function extractEnterpriseName(filename) {
  const base = path.basename(filename);

  const detectedMatch = base.match(/^地图截图_(.+?)_detected\.\w+$/);
  if (detectedMatch) return detectedMatch[1].trim();

  const jsonMatch = base.match(/^地图截图_(.+?)_detection\.json$/);
  if (jsonMatch) return jsonMatch[1].trim();

  const originalMatch = base.match(/^地图截图_(.+?)\.\w+$/);
  if (originalMatch) return originalMatch[1].trim();

  const genericDetected = base.match(/^(.+?)_detected\.\w+$/);
  if (genericDetected) return genericDetected[1].trim();

  const genericJson = base.match(/^(.+?)_detection\.json$/);
  if (genericJson) return genericJson[1].trim();

  const generic = base.match(/^(.+?)\.\w+$/);
  if (generic) return generic[1].trim();

  return null;
}

function scanFolder(folderPath) {
  if (!folderPath || !fs.existsSync(folderPath)) return [];
  return fs.readdirSync(folderPath)
    .filter(f => !f.startsWith('.'))
    .map(f => ({
      filename: f,
      fullPath: path.join(folderPath, f),
      ext: path.extname(f).toLowerCase(),
    }));
}

function classifyFiles(originalFolder, detectedFolder) {
  const groups = new Map();

  function getOrCreate(name) {
    if (!groups.has(name)) {
      groups.set(name, { enterpriseName: name, originalFile: null, detectedFile: null, jsonFile: null });
    }
    return groups.get(name);
  }

  for (const file of scanFolder(originalFolder)) {
    const name = extractEnterpriseName(file.filename);
    if (!name) continue;
    const group = getOrCreate(name);
    if (['.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff'].includes(file.ext)) {
      group.originalFile = file;
    }
  }

  for (const file of scanFolder(detectedFolder)) {
    const name = extractEnterpriseName(file.filename);
    if (!name) continue;
    const group = getOrCreate(name);

    if (file.ext === '.json') {
      group.jsonFile = file;
    } else if (['.png', '.jpg', '.jpeg', '.webp'].includes(file.ext)) {
      group.detectedFile = file;
    }
  }

  return Array.from(groups.values());
}

async function loadAllEnterprises() {
  const all = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('enterprises')
      .select('id, enterprise_name, account_number')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('查询企业列表失败:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < limit) break;
    offset += limit;
  }

  return all;
}

function matchEnterprise(name, enterprises) {
  const exact = enterprises.find(e => e.enterprise_name === name);
  if (exact) return exact;

  const contains = enterprises.find(e =>
    e.enterprise_name.includes(name) || name.includes(e.enterprise_name)
  );
  if (contains) return contains;

  const cleaned = name.replace(/[\s()（）]/g, '');
  const fuzzy = enterprises.find(e => {
    const eCleaned = e.enterprise_name.replace(/[\s()（）]/g, '');
    return eCleaned.includes(cleaned) || cleaned.includes(eCleaned);
  });
  return fuzzy || null;
}

function getMimeType(ext) {
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.json': 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}

async function uploadFile(filePath, storagePath, contentType) {
  const fileBuffer = fs.readFileSync(filePath);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`上传失败 ${storagePath}: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}

async function processGroup(group, enterprise) {
  const safeId = enterprise.id;
  const results = { originalUrl: null, annotatedUrl: null };

  if (group.originalFile) {
    const storagePath = `originals/${safeId}${group.originalFile.ext}`;
    results.originalUrl = await uploadFile(
      group.originalFile.fullPath,
      storagePath,
      getMimeType(group.originalFile.ext)
    );
  }

  if (group.detectedFile) {
    const storagePath = `detected/${safeId}${group.detectedFile.ext}`;
    results.annotatedUrl = await uploadFile(
      group.detectedFile.fullPath,
      storagePath,
      getMimeType(group.detectedFile.ext)
    );
  }

  if (group.jsonFile) {
    const storagePath = `detection-json/${safeId}.json`;
    await uploadFile(
      group.jsonFile.fullPath,
      storagePath,
      'application/json'
    );

    try {
      const jsonContent = JSON.parse(fs.readFileSync(group.jsonFile.fullPath, 'utf-8'));
      await importDetectionJson(jsonContent, enterprise);
    } catch (e) {
      console.warn(`  [警告] 解析 JSON 失败 ${group.jsonFile.filename}: ${e.message}`);
    }
  }

  const updates = {};
  if (results.originalUrl) updates.original_image_url = results.originalUrl;
  if (results.annotatedUrl) updates.annotated_image_url = results.annotatedUrl;

  if (Object.keys(updates).length > 0) {
    updates.image_uploaded_at = new Date().toISOString();
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('enterprises')
      .update(updates)
      .eq('id', enterprise.id);

    if (error) {
      console.error(`  [错误] 更新数据库失败 ${enterprise.enterprise_name}: ${error.message}`);
    }
  }

  return results;
}

async function importDetectionJson(json, enterprise) {
  let detections = [];

  if (Array.isArray(json)) {
    detections = json;
  } else if (json.detections && Array.isArray(json.detections)) {
    detections = json.detections;
  } else if (json.results && Array.isArray(json.results)) {
    detections = json.results;
  } else if (json.bbox || json.confidence) {
    detections = [json];
  }

  if (detections.length === 0) return;

  const rows = detections.map((d, idx) => ({
    enterprise_id: enterprise.id,
    account_number: enterprise.account_number || '',
    image_path: `detection-json/${enterprise.id}.json`,
    detection_id: d.detection_id ?? idx,
    confidence: d.confidence ?? 0,
    class_name: d.class_name ?? d.class ?? d.label ?? 'cooling_tower',
    bbox_x1: d.bbox_x1 ?? d.bbox?.[0] ?? d.x1 ?? 0,
    bbox_y1: d.bbox_y1 ?? d.bbox?.[1] ?? d.y1 ?? 0,
    bbox_x2: d.bbox_x2 ?? d.bbox?.[2] ?? d.x2 ?? 0,
    bbox_y2: d.bbox_y2 ?? d.bbox?.[3] ?? d.y2 ?? 0,
    center_x: d.center_x ?? 0,
    center_y: d.center_y ?? 0,
    bbox_width: d.bbox_width ?? d.width ?? 0,
    bbox_height: d.bbox_height ?? d.height ?? 0,
    bbox_area: d.bbox_area ?? d.area ?? 0,
  }));

  const { error } = await supabase
    .from('detection_results')
    .upsert(rows, { onConflict: 'enterprise_id,detection_id', ignoreDuplicates: false });

  if (error) {
    const { error: insertError } = await supabase
      .from('detection_results')
      .insert(rows);

    if (insertError) {
      console.warn(`  [警告] 导入检测结果失败: ${insertError.message}`);
    }
  }
}

async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log('========================================');
  console.log('  企业图片批量上传工具');
  console.log('========================================\n');

  if (DRY_RUN) {
    console.log('[模式] 预览模式 (dry-run)，不会实际上传\n');
  }

  console.log('[1/4] 扫描本地文件...');
  const groups = classifyFiles(args.original, args.detected);
  console.log(`  找到 ${groups.length} 组文件\n`);

  if (groups.length === 0) {
    console.log('未找到任何匹配的图片文件，请检查文件夹路径和文件命名。');
    process.exit(0);
  }

  console.log('[2/4] 从数据库加载企业列表...');
  const enterprises = await loadAllEnterprises();
  console.log(`  数据库共 ${enterprises.length} 家企业\n`);

  console.log('[3/4] 匹配文件与企业...');
  const matched = [];
  const unmatched = [];

  for (const group of groups) {
    const enterprise = matchEnterprise(group.enterpriseName, enterprises);
    if (enterprise) {
      matched.push({ group, enterprise });
    } else {
      unmatched.push(group);
    }
  }

  console.log(`  成功匹配: ${matched.length}`);
  console.log(`  未匹配:   ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log('\n  未匹配的企业名:');
    unmatched.slice(0, 20).forEach(g => {
      const files = [g.originalFile, g.detectedFile, g.jsonFile].filter(Boolean).map(f => f.filename);
      console.log(`    - "${g.enterpriseName}" (${files.join(', ')})`);
    });
    if (unmatched.length > 20) {
      console.log(`    ... 还有 ${unmatched.length - 20} 个未匹配`);
    }
  }

  if (DRY_RUN) {
    console.log('\n[预览] 匹配结果:');
    matched.forEach(({ group, enterprise }) => {
      const parts = [];
      if (group.originalFile) parts.push(`原图: ${group.originalFile.filename}`);
      if (group.detectedFile) parts.push(`标注: ${group.detectedFile.filename}`);
      if (group.jsonFile) parts.push(`JSON: ${group.jsonFile.filename}`);
      console.log(`  "${group.enterpriseName}" -> "${enterprise.enterprise_name}" [${enterprise.id.slice(0, 8)}]`);
      parts.forEach(p => console.log(`    ${p}`));
    });
    console.log('\n预览完成。去掉 --dry-run 参数以执行实际上传。');
    process.exit(0);
  }

  console.log(`\n[4/4] 开始上传 (并发: ${CONCURRENCY})...\n`);

  let successCount = 0;
  let failCount = 0;

  const tasks = matched.map(({ group, enterprise }, idx) => async () => {
    const num = `[${idx + 1}/${matched.length}]`;
    try {
      const result = await processGroup(group, enterprise);
      successCount++;

      const parts = [];
      if (result.originalUrl) parts.push('原图');
      if (result.annotatedUrl) parts.push('标注');
      if (group.jsonFile) parts.push('JSON');
      console.log(`  ${num} ${enterprise.enterprise_name} -> ${parts.join(' + ')}`);
    } catch (err) {
      failCount++;
      console.error(`  ${num} [失败] ${enterprise.enterprise_name}: ${err.message}`);
    }
  });

  await runWithConcurrency(tasks, CONCURRENCY);

  console.log('\n========================================');
  console.log(`  上传完成!`);
  console.log(`  成功: ${successCount}`);
  console.log(`  失败: ${failCount}`);
  console.log(`  未匹配: ${unmatched.length}`);
  console.log('========================================');
}

main().catch(err => {
  console.error('脚本执行出错:', err);
  process.exit(1);
});

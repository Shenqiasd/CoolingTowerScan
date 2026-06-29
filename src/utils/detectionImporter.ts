import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { calculateHVAC } from './hvacCalculator';
import type { ImportRow } from './csvImporter';

interface DetectionImportRow extends ImportRow {
  image_path?: unknown;
  detection_id?: unknown;
  confidence?: unknown;
  class_name?: unknown;
  bbox_x1?: unknown;
  bbox_y1?: unknown;
  bbox_x2?: unknown;
  bbox_y2?: unknown;
  center_x?: unknown;
  center_y?: unknown;
  width?: unknown;
  height?: unknown;
  area?: unknown;
  '户号'?: unknown;
  '户名'?: unknown;
  '用电地址'?: unknown;
  '行业分类'?: unknown;
}

interface DetectionInsertRow {
  account_number: string;
  image_path: string;
  detection_id: number;
  confidence: number;
  class_name: string;
  bbox_x1: number;
  bbox_y1: number;
  bbox_x2: number;
  bbox_y2: number;
  center_x: number;
  center_y: number;
  bbox_width: number;
  bbox_height: number;
  bbox_area: number;
}

interface ExistingDetectionRow {
  id: string;
  account_number: string | null;
  image_path: string | null;
  detection_id: number | null;
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function cleanAccountNumber(raw: unknown): string {
  const value = cellToString(raw).trim();
  const num = parseFloat(value);
  if (!isNaN(num)) return Math.round(num).toString();
  return value;
}

function toNumber(value: unknown): number {
  return parseFloat(cellToString(value)) || 0;
}

function toDetectionInsertRow(row: DetectionImportRow): DetectionInsertRow {
  return {
    account_number: cleanAccountNumber(row['户号']),
    image_path: cellToString(row.image_path).trim(),
    detection_id: parseInt(cellToString(row.detection_id), 10) || 0,
    confidence: toNumber(row.confidence),
    class_name: cellToString(row.class_name).trim() || 'cooling_tower',
    bbox_x1: toNumber(row.bbox_x1),
    bbox_y1: toNumber(row.bbox_y1),
    bbox_x2: toNumber(row.bbox_x2),
    bbox_y2: toNumber(row.bbox_y2),
    center_x: toNumber(row.center_x),
    center_y: toNumber(row.center_y),
    bbox_width: toNumber(row.width),
    bbox_height: toNumber(row.height),
    bbox_area: toNumber(row.area),
  };
}

function buildDetectionKey(row: {
  account_number: string | null;
  image_path: string | null;
  detection_id: number | null;
}): string {
  return `${row.account_number ?? ''}\u0000${row.image_path ?? ''}\u0000${row.detection_id ?? 0}`;
}

async function loadExistingDetectionIds(
  rows: DetectionInsertRow[],
  errors: string[],
): Promise<Map<string, string> | null> {
  const existingIds = new Map<string, string>();
  const imagePaths = [...new Set(rows.map((row) => row.image_path).filter(Boolean))];
  const batchSize = 100;

  for (let i = 0; i < imagePaths.length; i += batchSize) {
    const batch = imagePaths.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('detection_results')
      .select('id, account_number, image_path, detection_id')
      .in('image_path', batch);

    if (error) {
      errors.push(`查找本次图片旧数据失败: ${error.message}`);
      return null;
    }

    for (const row of (data ?? []) as ExistingDetectionRow[]) {
      existingIds.set(buildDetectionKey(row), row.id);
    }
  }

  return existingIds;
}

async function saveDetectionRows(
  rows: DetectionInsertRow[],
  errors: string[],
  onProgress?: (stage: string, current: number, total: number) => void,
): Promise<number> {
  onProgress?.('查找本次图片旧数据...', 0, rows.length);
  const existingIds = await loadExistingDetectionIds(rows, errors);
  if (!existingIds) {
    return 0;
  }

  const batchSize = 100;
  let saved = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const insertRows: DetectionInsertRow[] = [];

    for (const row of batch) {
      const existingId = existingIds.get(buildDetectionKey(row));
      if (!existingId) {
        insertRows.push(row);
        continue;
      }

      const { error } = await supabase
        .from('detection_results')
        .update(row)
        .eq('id', existingId);

      if (error) {
        errors.push(`更新检测数据失败: ${error.message}`);
      } else {
        saved++;
      }
    }

    if (insertRows.length > 0) {
      const { error } = await supabase.from('detection_results').insert(insertRows);
      if (error) {
        errors.push(`批次 ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        saved += insertRows.length;
      }
    }

    onProgress?.('导入检测数据...', Math.min(i + batchSize, rows.length), rows.length);
  }

  return saved;
}

async function loadAccountDetectionStats(
  accounts: string[],
  fallbackRows: DetectionInsertRow[],
): Promise<Map<string, { count: number; maxConf: number }>> {
  const stats = new Map<string, { count: number; maxConf: number }>();
  const batchSize = 100;

  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('detection_results')
      .select('account_number, confidence')
      .in('account_number', batch);

    if (error) {
      for (const row of fallbackRows.filter((item) => batch.includes(item.account_number))) {
        const existing = stats.get(row.account_number);
        if (existing) {
          existing.count += 1;
          existing.maxConf = Math.max(existing.maxConf, row.confidence);
        } else {
          stats.set(row.account_number, { count: 1, maxConf: row.confidence });
        }
      }
      continue;
    }

    for (const row of data ?? []) {
      const accountNumber = cleanAccountNumber(row.account_number);
      const confidence = toNumber(row.confidence);
      const existing = stats.get(accountNumber);
      if (existing) {
        existing.count += 1;
        existing.maxConf = Math.max(existing.maxConf, confidence);
      } else {
        stats.set(accountNumber, { count: 1, maxConf: confidence });
      }
    }
  }

  return stats;
}

export async function importDetectionRows(
  inputRows: DetectionImportRow[],
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<{ imported: number; matched: number; errors: string[] }> {
  const rows = inputRows.filter(
    (row) => cellToString(row['户号']).trim() !== ''
  );
  const errors: string[] = [];
  const detectionRows = rows.map(toDetectionInsertRow);

  const imported = await saveDetectionRows(detectionRows, errors, onProgress);
  if (errors.length > 0 && imported === 0) {
    return { imported: 0, matched: 0, errors };
  }

  onProgress?.('聚合统计...', 0, 0);

  const industryByAccount = new Map<string, string>();
  for (const row of rows) {
    const accountNumber = cleanAccountNumber(row['户号']);
    if (!industryByAccount.has(accountNumber)) {
      industryByAccount.set(accountNumber, cellToString(row['行业分类']).trim());
    }
  }

  let matched = 0;
  const accounts = [...new Set(detectionRows.map((row) => row.account_number).filter(Boolean))];
  const accountStats = await loadAccountDetectionStats(accounts, detectionRows);
  const updateBatch = 50;

  for (let i = 0; i < accounts.length; i += updateBatch) {
    const batch = accounts.slice(i, i + updateBatch);

    for (const acct of batch) {
      const info = accountStats.get(acct);
      if (!info) continue;

      const { data: enterprise } = await supabase
        .from('enterprises')
        .select('id, industry_category')
        .eq('account_number', acct)
        .maybeSingle();

      if (enterprise) {
        const hvac = calculateHVAC(info.count, enterprise.industry_category || industryByAccount.get(acct) || '');

        const { error: upErr } = await supabase
          .from('enterprises')
          .update({
            has_cooling_tower: true,
            cooling_tower_count: info.count,
            detection_confidence: Math.round(info.maxConf * 100) / 100,
            detection_status: 'detected',
            ...hvac,
            updated_at: new Date().toISOString(),
          })
          .eq('id', enterprise.id);

        if (!upErr) {
          matched++;

          await supabase
            .from('detection_results')
            .update({ enterprise_id: enterprise.id })
            .eq('account_number', acct);
        }
      }
    }

    onProgress?.('更新企业数据...', Math.min(i + updateBatch, accounts.length), accounts.length);
  }

  return { imported, matched, errors };
}

export async function importDetectionCsv(
  file: File,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<{ imported: number; matched: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<DetectionImportRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        resolve(await importDetectionRows(results.data, onProgress));
      },
      error: (err) => reject(err),
    });
  });
}

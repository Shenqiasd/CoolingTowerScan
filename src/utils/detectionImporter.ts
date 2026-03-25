import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { calculateHVAC } from './hvacCalculator';

interface DetectionCsvRow {
  image_path: string;
  detection_id: string;
  confidence: string;
  class_name: string;
  bbox_x1: string;
  bbox_y1: string;
  bbox_x2: string;
  bbox_y2: string;
  center_x: string;
  center_y: string;
  width: string;
  height: string;
  area: string;
  '户号': string;
  '户名': string;
  '用电地址': string;
  '行业分类': string;
}

function cleanAccountNumber(raw: string): string {
  const num = parseFloat(raw);
  if (!isNaN(num)) return Math.round(num).toString();
  return raw.trim();
}

export async function importDetectionCsv(
  file: File,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<{ imported: number; matched: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<DetectionCsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.filter(
          (r) => r['户号'] && r['户号'].trim() !== ''
        );
        const errors: string[] = [];
        let imported = 0;

        onProgress?.('清除旧数据...', 0, rows.length);
        await supabase.from('detection_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        const batchSize = 100;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize).map((row) => ({
            account_number: cleanAccountNumber(row['户号']),
            image_path: (row.image_path || '').trim(),
            detection_id: parseInt(row.detection_id) || 0,
            confidence: parseFloat(row.confidence) || 0,
            class_name: (row.class_name || 'cooling_tower').trim(),
            bbox_x1: parseFloat(row.bbox_x1) || 0,
            bbox_y1: parseFloat(row.bbox_y1) || 0,
            bbox_x2: parseFloat(row.bbox_x2) || 0,
            bbox_y2: parseFloat(row.bbox_y2) || 0,
            center_x: parseFloat(row.center_x) || 0,
            center_y: parseFloat(row.center_y) || 0,
            bbox_width: parseFloat(row.width) || 0,
            bbox_height: parseFloat(row.height) || 0,
            bbox_area: parseFloat(row.area) || 0,
          }));

          const { error } = await supabase.from('detection_results').insert(batch);
          if (error) {
            errors.push(`批次 ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          } else {
            imported += batch.length;
          }

          onProgress?.('导入检测数据...', Math.min(i + batchSize, rows.length), rows.length);
        }

        onProgress?.('聚合统计...', 0, 0);

        const accountMap = new Map<string, { count: number; maxConf: number; industry: string }>();
        for (const row of rows) {
          const acct = cleanAccountNumber(row['户号']);
          const conf = parseFloat(row.confidence) || 0;
          const existing = accountMap.get(acct);
          if (existing) {
            existing.count += 1;
            existing.maxConf = Math.max(existing.maxConf, conf);
          } else {
            accountMap.set(acct, {
              count: 1,
              maxConf: conf,
              industry: (row['行业分类'] || '').trim(),
            });
          }
        }

        let matched = 0;
        const accounts = Array.from(accountMap.entries());
        const updateBatch = 50;

        for (let i = 0; i < accounts.length; i += updateBatch) {
          const batch = accounts.slice(i, i + updateBatch);

          for (const [acct, info] of batch) {
            const { data: enterprise } = await supabase
              .from('enterprises')
              .select('id, industry_category')
              .eq('account_number', acct)
              .maybeSingle();

            if (enterprise) {
              const hvac = calculateHVAC(info.count, enterprise.industry_category || info.industry);

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

        resolve({ imported, matched, errors });
      },
      error: (err) => reject(err),
    });
  });
}

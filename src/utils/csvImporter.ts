import Papa from 'papaparse';
import { supabase } from '../lib/supabase';

interface CsvRow {
  户号: string;
  户名: string;
  用电地址: string;
  行业分类: string;
  综合评分: string;
  概率等级: string;
  匹配维度详情: string;
}

function parseMatchDetails(raw: string): Record<string, unknown> {
  if (!raw || raw.trim() === '') return {};
  try {
    return JSON.parse(raw);
  } catch {
    const details: Record<string, string> = {};
    const parts = raw.split(/[;；,，]/);
    parts.forEach((part, i) => {
      const trimmed = part.trim();
      if (trimmed) {
        const colonIdx = trimmed.indexOf(':');
        const cnColonIdx = trimmed.indexOf('：');
        const idx = colonIdx >= 0 ? colonIdx : cnColonIdx;
        if (idx >= 0) {
          details[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
        } else {
          details[`dimension_${i + 1}`] = trimmed;
        }
      }
    });
    return details;
  }
}

export async function importCsvFile(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<{ imported: number; errors: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data.filter(
          (row) => row['户号'] && row['户名'] && row['户号'].trim() !== ''
        );
        const errors: string[] = [];
        let imported = 0;
        const batchSize = 50;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize).map((row) => ({
            account_number: (row['户号'] || '').trim(),
            enterprise_name: (row['户名'] || '').trim(),
            address: (row['用电地址'] || '').trim(),
            industry_category: (row['行业分类'] || '').trim(),
            composite_score: parseFloat(row['综合评分']) || 0,
            probability_level: (row['概率等级'] || '高').trim(),
            match_dimension_details: parseMatchDetails(row['匹配维度详情'] || ''),
            geocoding_status: 'pending',
            detection_status: 'pending',
          }));

          const { error } = await supabase.from('enterprises').insert(batch);

          if (error) {
            errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
          } else {
            imported += batch.length;
          }

          onProgress?.(Math.min(i + batchSize, rows.length), rows.length);
        }

        resolve({ imported, errors });
      },
      error: (err) => reject(err),
    });
  });
}

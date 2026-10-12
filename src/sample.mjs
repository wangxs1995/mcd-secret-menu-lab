/**
 * 离线样例数据加载（无需 Token 即可演示全部功能）
 * 数据位于 src/sample-data/，均为演示用近似数据，非官方数据。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** 加载样例菜单 → { store, items } */
export function loadSampleMenu() {
  const raw = JSON.parse(readFileSync(join(HERE, 'sample-data', 'menu.json'), 'utf8'));
  return {
    store: raw._store ?? { storeCode: 'SAMPLE-001', storeName: '示例门店（离线演示）' },
    items: Array.isArray(raw.items) ? raw.items : [],
    note: raw._note ?? '',
  };
}

/** 加载样例营养数据 → 名称→营养 映射 */
export function loadSampleNutrition() {
  const raw = JSON.parse(readFileSync(join(HERE, 'sample-data', 'nutrition.json'), 'utf8'));
  const table = raw['营养'] ?? raw;
  const clean = {};
  for (const [key, value] of Object.entries(table)) {
    if (key.startsWith('_')) continue;
    clean[key] = value;
  }
  return clean;
}

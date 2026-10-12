/**
 * 离线样例数据加载（无需 Token 即可演示全部功能）
 * 数据位于 src/sample-data/，为麦当劳 MCP 的真实返回快照（由 scripts/refresh-sample-data.mjs 生成）。
 * 价格与供应以门店实时为准。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** 加载样例菜单 → { store, items, snapshot, note } */
export function loadSampleMenu() {
  const raw = JSON.parse(readFileSync(join(HERE, 'sample-data', 'menu.json'), 'utf8'));
  const snapshot = raw._snapshot ?? raw._store ?? {};
  return {
    store: {
      storeCode: snapshot.storeCode ?? 'SAMPLE-001',
      storeName: snapshot.storeName ?? '示例门店（离线演示）',
    },
    items: Array.isArray(raw.items) ? raw.items : [],
    snapshot,
    note: raw._note ?? '',
  };
}

/** 加载样例营养数据 → 名称→营养 映射 */
export function loadSampleNutrition() {
  const raw = JSON.parse(readFileSync(join(HERE, 'sample-data', 'nutrition.json'), 'utf8'));
  const table = raw.foods ?? raw['营养'] ?? raw;
  const clean = {};
  for (const [key, value] of Object.entries(table)) {
    if (key.startsWith('_')) continue;
    clean[key] = value;
  }
  return clean;
}

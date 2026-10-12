#!/usr/bin/env node
/**
 * 用真实麦当劳 MCP 数据刷新离线样例（src/sample-data/menu.json、nutrition.json）
 *
 * 用法：
 *   node scripts/refresh-sample-data.mjs --store 1450713 [--store-name "麦当劳上海xx餐厅"] [--breakfast "2026-10-11 08:00"]
 *
 * 做了什么：
 *   1. query-meals（到店自取）拉取当前菜单
 *   2. query-meals + reservationDate 拉取次日 08:00 的早餐菜单（补齐早餐时段）
 *   3. list-nutrition-foods 拉取全部营养数据
 *   4. 合并去重后写入 src/sample-data/，并记录快照信息
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { McdMcpClient } from '../src/mcp-client.mjs';
import { loadEnvFile } from '../src/util.mjs';
import { normalizeMenuData, parseNutritionData } from '../src/mcp-parse.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = parseArgs(process.argv.slice(2));

loadEnvFile(join(ROOT, '.env'));
const token = process.env.MCD_MCP_TOKEN ?? '';
if (!token || token === 'YOUR_MCP_TOKEN_HERE') {
  console.error('缺少 MCD_MCP_TOKEN，请先配置 .env');
  process.exit(1);
}

const storeCode = args.store ?? '1450713';
const storeName = args['store-name'] ?? `门店 ${storeCode}`;
const breakfastAt = args.breakfast ?? nextMorning();
const client = new McdMcpClient({ token });
await client.initialize();

const base = { storeCode, orderType: 1, beType: 1 };
const dayMenu = normalizeMenuData(await client.callToolData('query-meals', base));
let breakfastMenu = [];
try {
  breakfastMenu = normalizeMenuData(await client.callToolData('query-meals', { ...base, reservationDate: breakfastAt }));
} catch (error) {
  console.warn(`⚠️ 早餐菜单拉取失败（${error.message}），仅保存当前菜单`);
}

const merged = new Map();
for (const item of dayMenu) merged.set(item.code, { ...item, dayparts: ['正餐'] });
for (const item of breakfastMenu) {
  const existing = merged.get(item.code);
  if (existing) {
    if (!existing.dayparts.includes('早餐')) existing.dayparts.push('早餐');
  } else {
    merged.set(item.code, { ...item, dayparts: ['早餐'] });
  }
}
// 不保存图片链接，控制文件体积
const items = [...merged.values()].map(({ image, ...rest }) => rest);

const now = new Date();
const pad2 = (n) => String(n).padStart(2, '0');
const capturedAt = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}（北京时间）`;
writeFileSync(
  join(ROOT, 'src', 'sample-data', 'menu.json'),
  `${JSON.stringify(
    {
      _note: '离线演示用真实快照：来自麦当劳 MCP query-meals（到店自取，含次日早餐时段）。价格与供应以门店实时为准。',
      _snapshot: {
        storeCode,
        storeName,
        capturedAt,
        breakfastReservationAt: breakfastAt,
        dayCount: dayMenu.length,
        breakfastCount: breakfastMenu.length,
      },
      items,
    },
    null,
    2,
  )}\n`,
);

const foods = parseNutritionData(await client.callToolData('list-nutrition-foods'));
writeFileSync(
  join(ROOT, 'src', 'sample-data', 'nutrition.json'),
  `${JSON.stringify(
    {
      _note: '离线演示用真实快照：来自麦当劳 MCP list-nutrition-foods。数值仅供参考，不构成营养或医疗建议。',
      _snapshot: { capturedAt, count: Object.keys(foods).length },
      foods,
    },
    null,
    2,
  )}\n`,
);

console.log(`✅ 菜单快照 ${items.length} 项（当前 ${dayMenu.length} / 早餐 ${breakfastMenu.length}）→ src/sample-data/menu.json`);
console.log(`✅ 营养快照 ${Object.keys(foods).length} 项 → src/sample-data/nutrition.json`);

function nextMorning() {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} 08:00`;
}

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) flags[token.slice(2)] = true;
    else {
      flags[token.slice(2)] = next;
      index += 1;
    }
  }
  return flags;
}

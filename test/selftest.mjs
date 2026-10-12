/**
 * 自测脚本（零依赖，node --test 运行）
 * 覆盖：知识库与真实快照的一致性、匹配规则、营养/价格计算、MCP 返回解析、配方卡渲染、CLI 冒烟
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { RECIPES, getRecipe, validateRecipe, filterRecipes, recipeCalories, recipePrice, findMenuItem, vibeFromHour } from '../src/recipes.mjs';
import { loadSampleMenu, loadSampleNutrition } from '../src/sample.mjs';
import { sumNutrition, mealBill } from '../src/nutrition.mjs';
import { sumPrice } from '../src/pricing.mjs';
import { renderCardHtml, printCardText } from '../src/card.mjs';
import { parseSseForId } from '../src/mcp-client.mjs';
import { extractJson, parseCompactTable, parseNutritionData, normalizeMenuData, parseCampaignCalendar } from '../src/mcp-parse.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const menu = loadSampleMenu();
const nutrition = loadSampleNutrition();
const exact = (name) => menu.items.find((item) => item.name === name);

test('样例快照覆盖所有配方的全部原料', () => {
  assert.ok(menu.items.length > 50, '样例菜单应为真实快照（>50 项）');
  for (const recipe of RECIPES) {
    const { ok, missing } = validateRecipe(recipe, menu.items);
    assert.ok(ok, `${recipe.id} 缺少原料：${missing.map((m) => m.name).join('、')}`);
  }
});

test('菜单匹配优先完全相等，其次最短包含项（不命中套餐）', () => {
  assert.equal(findMenuItem(menu.items, ['麦乐鸡']).name, '麦乐鸡');
  assert.equal(findMenuItem(menu.items, ['薯条']).name, '薯条');
  assert.equal(findMenuItem(menu.items, ['圆筒冰淇淋', '圆筒']).name, '圆筒冰淇淋');
  assert.equal(findMenuItem(menu.items, ['脆薯饼', '薯饼']).name, '脆薯饼');
  assert.equal(findMenuItem(menu.items, ['不存在的东西']), null);
});

test('价格与营养按真实快照计算（冰雪薯条 = 薯条 + 圆筒冰淇淋）', () => {
  const recipe = getRecipe('fries-float');
  const expectedPrice = exact('薯条').priceYuan + exact('圆筒冰淇淋').priceYuan;
  assert.equal(recipePrice(recipe, menu.items), expectedPrice);
  const expectedKcal = nutrition['中薯条'].kcal + nutrition['圆筒冰淇淋'].kcal;
  assert.equal(recipeCalories(recipe, nutrition), expectedKcal);
  const { resolved } = validateRecipe(recipe, menu.items);
  assert.equal(sumNutrition(resolved, nutrition).kcal, expectedKcal);
  assert.equal(sumPrice(resolved).subtotal, expectedPrice);
});

test('数量生效：1+1 魔法组合 = 随心配 ×2', () => {
  const recipe = getRecipe('yijia-yi');
  const { resolved } = validateRecipe(recipe, menu.items);
  assert.equal(resolved[0].quantity, 2);
  const unit = resolved[0].item.priceYuan;
  assert.equal(sumPrice(resolved).subtotal, unit * 2);
  assert.ok(sumPrice(resolved).lines[0].name.includes('×2'));
});

test('热量账单与时段推断', () => {
  const bill = mealBill(382);
  assert.ok(bill.walkMin > 0 && bill.jogMin > 0);
  assert.equal(mealBill(null), null);
  assert.equal(vibeFromHour(8), '早餐');
  assert.equal(vibeFromHour(12), '正餐');
  assert.equal(vibeFromHour(15), '下午茶');
  assert.equal(vibeFromHour(23), '夜宵');
});

test('预算与场景筛选', () => {
  const cheap = filterRecipes({ budget: 25 }, menu.items, nutrition);
  assert.ok(cheap.length > 0);
  for (const row of cheap) if (row.price !== null) assert.ok(row.price <= 25, `${row.recipe.id} 超预算：${row.price}`);
  const breakfast = filterRecipes({ vibe: '早餐' }, menu.items, nutrition);
  assert.ok(breakfast.length > 0);
  for (const row of breakfast) assert.ok(row.recipe.vibes.includes('早餐'));
});

test('MCP 返回解析：说明文字中抽取 JSON', () => {
  const wrapped = '# API Response\n\n## Original Response\n\n{"success":true,"code":200,"data":{"x":1}}\n## 展示规则\n|a|b|';
  assert.deepEqual(extractJson(wrapped).data, { x: 1 });
  const middle = '指引文字 {"success":false,"code":600058,"message":"城市名或者关键词不能为空"}## 后面还有文字';
  assert.equal(extractJson(middle).code, 600058);
  assert.equal(extractJson('没有 JSON'), undefined);
});

test('MCP 返回解析：紧凑文本表格与营养映射', () => {
  const table = '[2]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:\n  中薯条,null,1210,289,4,12,38,165,18\n  纯悦,能量约清水1杯,0,0,0,0,0,0,0\n';
  const { columns, rows } = parseCompactTable(table);
  assert.equal(columns.length, 9);
  assert.equal(rows.length, 2);
  const map = parseNutritionData(table);
  assert.equal(map['中薯条'].kcal, 289);
  assert.equal(map['纯悦'].description, '能量约清水1杯');
});

test('MCP 返回解析：菜单归一化与活动日历', () => {
  const data = {
    categories: [{ name: '小食甜品\n/其他', meals: [{ code: '4810', tags: ['热卖'] }, { code: '4810', tags: [] }] }],
    meals: { 4810: { name: '薯条', currentPrice: '13.5', originalPrice: '13.5' } },
  };
  const items = normalizeMenuData(data);
  assert.equal(items.length, 1);
  assert.equal(items[0].category, '小食甜品/其他');
  assert.equal(items[0].priceYuan, 13.5);

  const calendar = '### 活动列表：\n\n#### 2026年10月7日 往期回顾\n-   **活动标题**：旧活动\n\n#### 2026年10月12日 进行中\n-   **活动标题**：新活动A\n-   **活动标题**：新活动B\n';
  const blocks = parseCampaignCalendar(calendar);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].status, '进行中');
  assert.deepEqual(blocks[1].titles, ['新活动A', '新活动B']);
});

test('配方卡渲染包含关键信息', () => {
  const recipe = getRecipe('fries-float');
  const { resolved } = validateRecipe(recipe, menu.items);
  const stats = sumNutrition(resolved, nutrition);
  const data = { resolved, price: sumPrice(resolved), stats, bill: mealBill(stats.kcal), source: 'sample' };
  const html = renderCardHtml(recipe, data);
  assert.ok(html.includes('冰雪薯条'));
  assert.ok(html.includes('SECRET'));
  assert.ok(html.includes('非麦当劳官方内容'));
  const text = printCardText(recipe, data);
  assert.ok(text.includes('冰雪薯条'));
  assert.ok(text.includes(`${Math.round(stats.kcal)} 千卡`));
});

test('SSE 解析：匹配 id / 忽略其他事件', () => {
  const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"ok":true}}\n\n';
  assert.equal(parseSseForId(sse, 7).result.ok, true);
  assert.equal(parseSseForId(sse, 8), null);
});

test('CLI 冒烟：recipes --json / lab --offline --json / card --offline', () => {
  const run = (...args) => spawnSync(process.execPath, [join(ROOT, 'src', 'lab.mjs'), ...args], { encoding: 'utf8' });

  const recipes = run('recipes', '--json');
  assert.equal(recipes.status, 0, recipes.stderr);
  assert.equal(JSON.parse(recipes.stdout).length, RECIPES.length);

  const lab = run('lab', '--offline', '--json', '--budget', '30');
  assert.equal(lab.status, 0, lab.stderr);
  const report = JSON.parse(lab.stdout);
  assert.equal(report.source, 'sample');
  assert.ok(report.results.length > 0 && report.results.length <= 3);

  const outPath = join(ROOT, 'output', 'test-card.html');
  const card = run('card', '--recipe', 'fries-float', '--offline', '--out', outPath);
  assert.equal(card.status, 0, card.stderr);
  assert.ok(existsSync(outPath));
  rmSync(outPath, { force: true });
});

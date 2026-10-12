/**
 * 自测脚本（零依赖，node --test 运行）
 * 覆盖：知识库完整性、营养/价格计算、配方卡渲染、SSE 解析、CLI 冒烟
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { RECIPES, getRecipe, validateRecipe, filterRecipes, recipeCalories, recipePrice } from '../src/recipes.mjs';
import { loadSampleMenu, loadSampleNutrition } from '../src/sample.mjs';
import { sumNutrition, mealBill } from '../src/nutrition.mjs';
import { renderCardHtml, printCardText } from '../src/card.mjs';
import { parseSseForId } from '../src/mcp-client.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const menu = loadSampleMenu();
const nutrition = loadSampleNutrition();

test('样例菜单覆盖所有配方的全部原料', () => {
  for (const recipe of RECIPES) {
    const { ok, missing } = validateRecipe(recipe, menu.items);
    assert.ok(ok, `${recipe.id} 缺少原料：${missing.map((m) => m.name).join('、')}`);
  }
});

test('营养与价格计算正确（冰雪薯条 = 薯条 13.5 + 圆筒 4.0 / 340 + 150 kcal）', () => {
  const recipe = getRecipe('fries-float');
  assert.equal(recipePrice(recipe, menu.items), 17.5);
  assert.equal(recipeCalories(recipe, nutrition), 490);
  const { resolved } = validateRecipe(recipe, menu.items);
  assert.equal(sumNutrition(resolved, nutrition).kcal, 490);
});

test('热量账单计算', () => {
  const bill = mealBill(490);
  assert.ok(bill.walkMin > 0 && bill.jogMin > 0);
  assert.equal(mealBill(null), null);
});

test('预算筛选：30 元以内方案全部合规', () => {
  const rows = filterRecipes({ budget: 30 }, menu.items, nutrition);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    if (row.price !== null) assert.ok(row.price <= 30, `${row.recipe.id} 超预算：${row.price}`);
  }
});

test('场景筛选：早餐只返回早餐场景的吃法', () => {
  const rows = filterRecipes({ vibe: '早餐' }, menu.items, nutrition);
  assert.ok(rows.length > 0);
  for (const row of rows) assert.ok(row.recipe.vibes.includes('早餐'));
});

test('配方卡渲染包含关键信息', () => {
  const recipe = getRecipe('fries-float');
  const { resolved } = validateRecipe(recipe, menu.items);
  const data = {
    resolved,
    stats: sumNutrition(resolved, nutrition),
    bill: mealBill(490),
    source: 'sample',
  };
  const html = renderCardHtml(recipe, data);
  assert.ok(html.includes('冰雪薯条'));
  assert.ok(html.includes('SECRET'));
  assert.ok(html.includes('非麦当劳官方内容'));
  const text = printCardText(recipe, data);
  assert.ok(text.includes('冰雪薯条'));
  assert.ok(text.includes('490 千卡'));
});

test('SSE 解析：匹配 id / 忽略其他事件', () => {
  const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":7,"result":{"ok":true}}\n\n';
  assert.equal(parseSseForId(sse, 7).result.ok, true);
  assert.equal(parseSseForId(sse, 8), null);
  const multi = 'data: {"jsonrpc":"2.0","method":"notifications/progress"}\n\ndata: {"jsonrpc":"2.0","id":3,"result":{}}\n\n';
  assert.equal(parseSseForId(multi, 3).id, 3);
});

test('CLI 冒烟：recipes --json 与 card --offline', () => {
  const recipesRun = spawnSync(process.execPath, [join(ROOT, 'src', 'lab.mjs'), 'recipes', '--json'], {
    encoding: 'utf8',
  });
  assert.equal(recipesRun.status, 0, recipesRun.stderr);
  const list = JSON.parse(recipesRun.stdout);
  assert.equal(list.length, RECIPES.length);

  const outPath = join(ROOT, 'output', 'test-card.html');
  const cardRun = spawnSync(
    process.execPath,
    [join(ROOT, 'src', 'lab.mjs'), 'card', '--recipe', 'fries-float', '--offline', '--out', outPath],
    { encoding: 'utf8' },
  );
  assert.equal(cardRun.status, 0, cardRun.stderr);
  assert.ok(existsSync(outPath));
  rmSync(outPath, { force: true });
});

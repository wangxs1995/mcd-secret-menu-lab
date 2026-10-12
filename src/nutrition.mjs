/**
 * 营养计算与「热量账单」
 * 说明：所有数值均为近似值，仅供参考，不构成营养或医疗建议。
 */
import { findNutrition } from './recipes.mjs';

export const NUTRITION_DISCLAIMER = '热量与营养成分为近似值，仅供参考，不构成营养或医疗建议。';

/**
 * 汇总一组已匹配原料的营养（按数量累加）
 * @param {Array<{ingredient: object, item?: object, quantity?: number}>} resolved validateRecipe 的 resolved
 * @param {Record<string, {kcal: number, protein: number, fat: number, carb: number, sodium: number}>} nutrition
 */
export function sumNutrition(resolved, nutrition) {
  const total = { kcal: 0, protein: 0, fat: 0, carb: 0, sodium: 0 };
  let known = 0;
  for (const { ingredient, quantity = 1 } of resolved) {
    const entry = findNutrition(nutrition, ingredient.nutritionMatch ?? ingredient.match);
    if (!entry) continue;
    known += 1;
    for (const key of Object.keys(total)) {
      if (Number.isFinite(entry[key])) total[key] += entry[key] * quantity;
    }
  }
  if (known === 0) {
    return { kcal: null, protein: null, fat: null, carb: null, sodium: null, known, total: resolved.length };
  }
  return { ...total, known, total: resolved.length };
}

/**
 * 热量账单：这顿大概要走多久 / 跑多久
 * 估算口径：70kg 成年人，散步 ≈ 4.0 kcal/分钟，慢跑 ≈ 9.5 kcal/分钟（取整到 5 分钟）
 */
export function mealBill(kcal) {
  if (!Number.isFinite(kcal)) return null;
  const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);
  return { walkMin: round5(kcal / 4.0), jogMin: round5(kcal / 9.5) };
}

/** 热量行的紧凑文案：`382 千卡（蛋白质 6g · 脂肪 15g · 钠 201mg）` */
export function nutritionLine(stats) {
  if (!stats || stats.kcal === null) return '热量数据待补全（该餐品不在营养表中）';
  const detail = [];
  if (Number.isFinite(stats.protein)) detail.push(`蛋白质 ${Math.round(stats.protein)}g`);
  if (Number.isFinite(stats.fat)) detail.push(`脂肪 ${Math.round(stats.fat)}g`);
  if (Number.isFinite(stats.sodium)) detail.push(`钠 ${Math.round(stats.sodium)}mg`);
  let text = `${Math.round(stats.kcal)} 千卡`;
  if (detail.length > 0) text += `（${detail.join(' · ')}）`;
  if (stats.known < stats.total) text += `，${stats.total - stats.known} 项原料无营养数据`;
  return text;
}

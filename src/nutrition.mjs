/**
 * 营养计算与「热量账单」
 * 说明：所有数值均为近似值，仅供参考，不构成营养或医疗建议。
 */

export const NUTRITION_DISCLAIMER = '营养数据为近似值，仅供参考，不构成营养或医疗建议。';

/**
 * 汇总一组原料的营养
 * @param {Array<{ingredient: object, item: object}>} resolved validateRecipe 的 resolved 结果
 * @param {Record<string, {kcal: number, protein: number, fat: number, carb: number, sodium: number}>} nutrition
 * @returns {{kcal: number|null, protein: number|null, fat: number|null, carb: number|null, sodium: number|null, known: number, total: number}}
 */
export function sumNutrition(resolved, nutrition) {
  const total = { kcal: 0, protein: 0, fat: 0, carb: 0, sodium: 0 };
  let known = 0;
  for (const { ingredient } of resolved) {
    const entry = lookupNutrition(nutrition, ingredient.match);
    if (!entry) continue;
    known += 1;
    for (const key of Object.keys(total)) {
      if (Number.isFinite(entry[key])) total[key] += entry[key];
    }
  }
  if (known === 0) {
    return { kcal: null, protein: null, fat: null, carb: null, sodium: null, known, total: resolved.length };
  }
  return { ...total, known, total: resolved.length };
}

/** 按关键词查营养表（先精确后模糊） */
export function lookupNutrition(nutrition, keywords) {
  if (!nutrition) return null;
  for (const keyword of keywords) {
    if (nutrition[keyword]) return nutrition[keyword];
  }
  for (const [key, value] of Object.entries(nutrition)) {
    if (key.startsWith('_')) continue;
    if (keywords.some((keyword) => key.includes(keyword) || keyword.includes(key))) return value;
  }
  return null;
}

/**
 * 热量账单：这顿大概要走多久 / 跑多久
 * 估算口径：70kg 成年人，散步 ≈ 4.0 kcal/分钟，慢跑 ≈ 9.5 kcal/分钟（取整到 5 分钟）
 */
export function mealBill(kcal) {
  if (!Number.isFinite(kcal)) return null;
  const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);
  return {
    walkMin: round5(kcal / 4.0),
    jogMin: round5(kcal / 9.5),
  };
}

/** 营养行的紧凑文案：`490 千卡 · 蛋白质 8g · 钠 310mg` */
export function nutritionLine(stats) {
  if (!stats || stats.kcal === null) return '营养数据待补全（可在联网模式下拉取）';
  const parts = [`${Math.round(stats.kcal)} 千卡`];
  if (Number.isFinite(stats.protein)) parts.push(`蛋白质 ${Math.round(stats.protein)}g`);
  if (Number.isFinite(stats.fat)) parts.push(`脂肪 ${Math.round(stats.fat)}g`);
  if (Number.isFinite(stats.sodium)) parts.push(`钠 ${Math.round(stats.sodium)}mg`);
  return parts.join(' · ');
}

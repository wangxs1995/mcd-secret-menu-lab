/**
 * 实验室发明机 —— 用真实菜单自动组合「图鉴之外」的新吃法
 *
 * 思路：把在售单品按角色分类（汉堡 / 薯条薯饼 / 小食 / 冰淇淋 / 派 / 冷饮 / 咖啡 / 早餐），
 * 按「机制 × 角色对」的规则两两组合（蘸 / 夹 / 倒 / 冰火 / 浇），排除套餐类商品与图鉴里已有的组合，
 * 按对比度（咸甜 / 冰火 / 脆软）与价格打分，输出可直接喂给 `card --spec` 的候选。
 * 所有名字与文案来自固定模板，生成后仍会过一遍文案合规检查。
 */
import { RECIPES, validateRecipe, findNutrition } from './recipes.mjs';
import { checkText } from './compliance.mjs';

/** 排除：套餐 / 多人餐 / 周边 / 卡券等非单品 */
const EXCLUDE = /套餐|件套|组合|随心|双人|分享|多人|乐园|拼盘|小食盘|帽|周边|卡$|卡\b|麦金|早餐卡|精选$|随心选|随心配/;

/** 角色识别（按优先级匹配） */
const ROLE_RULES = [
  ['breakfastSide', /油条|豆浆|粥/],
  ['hashbrown', /薯饼/],
  ['fries', /薯条|扭扭薯/],
  ['pie', /派$/],
  ['icecream', /圆筒|新地|麦旋风|雪冰/],
  ['coffee', /咖啡|美式|拿铁|奶铁|浓缩|鲜萃|卡布/],
  ['drink', /可乐|雪碧|柠檬红茶|怡泉|果汁|橙橙|柠柠/],
  ['nugget', /麦乐鸡|鸡块|鸡翅|V翅|鸡柳|脆汁鸡|鸡排|芝士条|鸡球/],
  ['muffin', /麦满分/],
  ['burger', /堡|汉堡|卷$/],
];

/** 机制规则：[角色 A, 角色 B, 机制, 命名模板, 一句话, 标签, 场景, 对比分] */
const PAIR_RULES = [
  ['fries', 'icecream', 'dip', '冰雪{a}', '咸与甜的碰撞', ['咸甜永动机', '好拍'], ['下午茶', '夜宵'], 3],
  ['nugget', 'icecream', 'dip', '勇者{a}', '甜咸党的试炼', ['地狱试炼', '咸甜永动机'], ['下午茶', '夜宵'], 2],
  ['hashbrown', 'icecream', 'ice', '冰火{a}', '外热内冰的三明治', ['冰火两重天', '早八回魂'], ['早餐', '下午茶'], 3],
  ['pie', 'icecream', 'ice', '冰火{a}', '三分钟搭一个甜品台', ['冰火两重天', '甜品控'], ['下午茶'], 3],
  ['drink', 'icecream', 'pour', '{a}浮雪', '一杯{a}的浮雪版', ['平替魔法', '冰爽'], ['下午茶', '正餐'], 2],
  ['coffee', 'icecream', 'pour', '{a}阿芙佳朵', '自己搭的阿芙佳朵', ['高级感', '甜品控'], ['下午茶'], 2],
  ['burger', 'fries', 'stack', '{b}夹击{a}', '把{b}藏进面包里', ['碳水叠碳水', '全网经典'], ['正餐', '夜宵'], 2],
  ['burger', 'nugget', 'stack', '{b}夹击{a}', '给{a}加装弹药', ['加量流', '饱腹'], ['正餐'], 2],
  ['muffin', 'hashbrown', 'stack', '{b}夹击{a}', '早八人的加装包', ['早餐限定', '加量流'], ['早餐'], 2],
  ['burger', 'burger', 'stack', '{a}×{b} 双堡塔', '一口咬穿两个汉堡', ['硬核组合', '饱腹'], ['正餐', '夜宵'], 1],
  ['breakfastSide', 'breakfastSide', 'dip', '{b}泡{a}', '中式早点的麦记解法', ['早餐限定', '中式混搭'], ['早餐'], 2],
];

const STEPS = {
  dip: (a, b) => [`点一份${a}和一个${b}`, `${a}蘸着${b}吃，一次一点`, `趁${b}没化、${a}还热，三秒内入口`],
  stack: (a, b) => [`打开${a}的上层面包`, `把${b}平铺进去，压一压`, `合上，大口咬到底`],
  pour: (a, b) => [`先喝两口${a}腾出空间`, `把${b}倒扣进${a}里`, `用吸管戳碎搅匀`],
  ice: (a, b) => [`把热${a}掰开`, `把${b}扣在${a}上`, `等 10 秒，冰火交界处口感正好`],
};

const EMOJI = { dip: '🍟🍦', stack: '🍔🧨', pour: '🥤⛷️', ice: '🥧🔥' };

/** 短名：去掉品牌符号与规格，用于命名 */
function shortName(name) {
  return String(name)
    .replace(/麦咖啡™?/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/(中|大|小)杯/g, '')
    .replace(/\d+块/g, '')
    .replace(/冰淇淋$/, '')
    .trim() || name;
}

/** 营养表查找关键词：原名 → 短名 → 按角色用基础款近似（限定款 / 心形款等营养表里没有） */
function nutritionKeys(item) {
  const keys = [item.name, shortName(item.name)];
  if (/圆筒/.test(item.name)) keys.push('圆筒冰淇淋');
  if (/薯饼/.test(item.name)) keys.push('脆薯饼');
  else if (item.role === 'fries') keys.push('中薯条');
  if (item.role === 'pie') keys.push('菠萝派');
  if (/新地/.test(item.name)) keys.push('草莓新地');
  if (/麦旋风/.test(item.name)) keys.push('奥利奥麦旋风');
  if (/可乐/.test(item.name)) keys.push('可乐中杯');
  if (/雪碧/.test(item.name)) keys.push('雪碧中杯');
  return keys;
}

/** 给在售单品打角色标签 */
export function classifyMenu(items) {
  const out = [];
  for (const item of items) {
    if (!item?.name || EXCLUDE.test(item.name)) continue;
    const rule = ROLE_RULES.find(([, pattern]) => pattern.test(item.name));
    if (!rule) continue;
    out.push({ ...item, role: rule[0] });
  }
  return out;
}

/** 简单可复现的伪随机 */
function seeded(seed) {
  let state = (Number(seed) || 42) >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * 发明新吃法
 * @param {Array} items 菜单（真实快照或实时）
 * @param {object} nutrition 营养映射
 * @param {{budget?: number, maxCalorie?: number, vibe?: string, count?: number, seed?: number}} options
 * @returns {Array<{spec: object, price: number|null, kcal: number|null, score: number, mechanic: string}>}
 */
export function inventRecipes(items, nutrition, { budget, maxCalorie, vibe, count = 3, seed = 42 } = {}) {
  const pool = classifyMenu(items);
  const byRole = {};
  for (const item of pool) (byRole[item.role] ??= []).push(item);

  // 图鉴里已有的组合（按原料名集合）
  const known = new Set(
    RECIPES.map((recipe) => {
      const { resolved } = validateRecipe(recipe, items);
      return resolved.map((r) => r.item.name).sort().join('|');
    }),
  );

  const random = seeded(seed);
  const candidates = [];
  const seen = new Set();
  for (const [ruleIndex, rule] of PAIR_RULES.entries()) {
    const [roleA, roleB, mechanic, nameTpl, taglineTpl, tags, vibes, contrast] = rule;
    for (const a of byRole[roleA] ?? []) {
      for (const b of byRole[roleB] ?? []) {
        if (a.code === b.code) continue;
        const key = [a.name, b.name].sort().join('|');
        if (seen.has(key) || known.has(key)) continue;
        seen.add(key);
        if (vibe && !vibes.includes(vibe)) continue;

        const price = Number.isFinite(a.priceYuan) && Number.isFinite(b.priceYuan) ? a.priceYuan + b.priceYuan : null;
        if (budget && price !== null && price > budget) continue;
        const na = findNutrition(nutrition, nutritionKeys(a));
        const nb = findNutrition(nutrition, nutritionKeys(b));
        const kcal = na?.kcal != null && nb?.kcal != null ? na.kcal + nb.kcal : null;
        if (maxCalorie && kcal !== null && kcal > maxCalorie) continue;

        const sa = shortName(a.name);
        const sb = shortName(b.name);
        const name = nameTpl.replace('{a}', sa).replace('{b}', sb);
        const tagline = taglineTpl.replace('{a}', sa).replace('{b}', sb);
        const steps = STEPS[mechanic](sa, sb);
        const spec = {
          name,
          emoji: EMOJI[mechanic] ?? '🍟',
          tagline,
          mechanic,
          ingredients: [a.name, b.name],
          steps,
          tags: ['自创吃法', ...tags],
          difficulty: tags.includes('地狱试炼') ? 3 : 1,
          vibes,
          heat: 3,
          story: '由实验室按「机制 × 真实在售单品」自动组合生成，未经图鉴收录，欢迎试吃后投稿。',
          tip: '原料与价格以门店实时菜单为准；改造动作到手后自己完成。',
        };
        const text = [name, tagline, ...steps].join('\n');
        if (checkText(text).length > 0) continue; // 文案合规兜底
        const score = contrast * 10 - (price ?? 20) * 0.3 + random() * 4;
        candidates.push({ spec, price, kcal, score, mechanic, rule: ruleIndex, itemCodes: [a.code, b.code] });
      }
    }
  }
  candidates.sort((x, y) => y.score - x.score);
  // 多样性：每条机制规则先各取 1 个，再按分数补足
  const limit = Math.max(1, count);
  const picked = [];
  const usedRules = new Set();
  for (const candidate of candidates) {
    if (picked.length >= limit) break;
    if (usedRules.has(candidate.rule)) continue;
    usedRules.add(candidate.rule);
    picked.push(candidate);
  }
  for (const candidate of candidates) {
    if (picked.length >= limit) break;
    if (!picked.includes(candidate)) picked.push(candidate);
  }
  return picked;
}

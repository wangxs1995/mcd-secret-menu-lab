/**
 * 麦门隐藏菜单知识库 —— 隐藏吃法的「配方」数据与筛选逻辑
 *
 * 设计原则：
 * 1. 所有配方的原料均为麦当劳门店真实在售餐品（样例快照见 src/sample-data/，来自真实 MCP 返回）
 * 2. 配方只描述「点哪些单品 + 到手后怎么改造」，不要求门店做任何特殊处理
 * 3. 运行时通过麦当劳 MCP 的实时菜单校验可得性：
 *    - match：匹配 query-meals 菜单名（优先完全相等，其次取名称最短的包含项，避免命中「xx套餐」）
 *    - nutritionMatch：匹配 list-nutrition-foods 营养表名（菜单叫「薯条」，营养表叫「中薯条」）
 */

/** 改造机制（隐藏吃法的灵魂动作） */
export const MECHANICS = {
  dip: '蘸',
  stack: '夹',
  pour: '倒',
  shake: '摇',
  ice: '冰火',
  combo: '组合',
};

/** 难度文案 */
export const DIFFICULTY_LABEL = { 1: '新手友好', 2: '进阶玩家', 3: '地狱试炼' };

/** 场景列表 */
export const VIBES = ['早餐', '正餐', '下午茶', '夜宵'];

/**
 * @typedef {object} Ingredient
 * @property {string} name              展示名
 * @property {string[]} match           菜单名匹配关键词（按优先级）
 * @property {string[]} [nutritionMatch] 营养表名匹配关键词（缺省用 match）
 * @property {number} [quantity]        数量，默认 1
 * @property {string} role              在吃法里的角色
 *
 * @typedef {object} Recipe
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} tagline
 * @property {keyof MECHANICS} mechanic
 * @property {Ingredient[]} ingredients
 * @property {string[]} steps
 * @property {string[]} tags
 * @property {1|2|3} difficulty
 * @property {string[]} vibes
 * @property {number} heat   麦门热度 1-5
 * @property {string} story
 * @property {string} tip
 */

/** @type {Recipe[]} */
export const RECIPES = [
  {
    id: 'fries-float',
    name: '冰雪薯条',
    emoji: '🍟❄️',
    tagline: '咸与甜的第一次握手',
    mechanic: 'dip',
    ingredients: [
      { name: '薯条', match: ['薯条'], nutritionMatch: ['中薯条'], role: '主角' },
      { name: '圆筒冰淇淋', match: ['圆筒冰淇淋', '圆筒'], nutritionMatch: ['圆筒冰淇淋'], role: '灵魂' },
    ],
    steps: ['点一份现炸薯条和一个圆筒冰淇淋', '捏住薯条根部，旋转蘸取冰淇淋', '趁冰淇淋没化，三秒内入口'],
    tags: ['咸甜永动机', '全网经典', '好拍'],
    difficulty: 1,
    vibes: ['下午茶', '夜宵'],
    heat: 5,
    story: '从海外论坛火到小红书的入门级隐藏吃法，麦门信徒的第一课。',
    tip: '薯条要现炸的，冰淇淋用圆筒比新地更好蘸。',
  },
  {
    id: 'cola-float',
    name: '可乐浮雪',
    emoji: '🥤⛷️',
    tagline: '五块钱的麦乐酷平替',
    mechanic: 'pour',
    ingredients: [
      { name: '可乐', match: ['可乐'], nutritionMatch: ['可乐中杯'], role: '基底' },
      { name: '圆筒冰淇淋', match: ['圆筒冰淇淋', '圆筒'], nutritionMatch: ['圆筒冰淇淋'], role: '灵魂' },
    ],
    steps: ['先喝两口可乐腾出空间', '把整个圆筒倒扣进可乐里', '用吸管戳碎搅匀，得到一杯浮雪'],
    tags: ['平替魔法', '冰爽', '好拍'],
    difficulty: 1,
    vibes: ['下午茶', '正餐'],
    heat: 4,
    story: '麦当劳早年卖过「麦乐酷」（可乐 + 冰淇淋），如今自己动手就能复刻。',
    tip: '先喝两口再放圆筒，不然一定会溢出来。',
  },
  {
    id: 'mega-stack',
    name: '牛鸡双吉塔',
    emoji: '🍔🍗',
    tagline: '一口咬穿两个汉堡',
    mechanic: 'stack',
    ingredients: [
      { name: '双层吉士汉堡', match: ['双层吉士汉堡', '双层吉士', '双吉'], role: '牛' },
      { name: '麦香鸡', match: ['麦香鸡'], role: '鸡' },
    ],
    steps: ['把麦香鸡整个夹进双吉中间（或反过来）', '轻轻压扁一点更稳', '双手拿稳，大口咬下去'],
    tags: ['硬核组合', '蛋白质炸弹', '饱腹'],
    difficulty: 2,
    vibes: ['正餐', '夜宵'],
    heat: 4,
    story: '一个双吉不够、一个麦香鸡太单薄，合体才是完全体。',
    tip: '先吃掉四分之一再合体，不然真的会散架。',
  },
  {
    id: 'nugget-stack',
    name: '鸡块夹击堡',
    emoji: '🍔🧨',
    tagline: '给汉堡加装弹药',
    mechanic: 'stack',
    ingredients: [
      { name: '双层吉士汉堡', match: ['双层吉士汉堡', '双层吉士', '双吉'], role: '底盘' },
      { name: '麦乐鸡', match: ['麦乐鸡'], nutritionMatch: ['麦乐鸡5块'], role: '弹药' },
    ],
    steps: ['打开双吉的上层面包', '鸡块蘸好随附的甜酸酱，平铺进去', '盖上面包压一压，一口咬到底'],
    tags: ['加量流', '饱腹', '进阶'],
    difficulty: 2,
    vibes: ['正餐'],
    heat: 3,
    story: '汉堡是平台，鸡块是插件——这是麦门工程学。',
    tip: '鸡块先蘸酱再夹，防滑又入味。',
  },
  {
    id: 'fries-burger',
    name: '薯条夹击堡',
    emoji: '🍔🍟',
    tagline: '把快乐夹进面包里',
    mechanic: 'stack',
    ingredients: [
      { name: '巨无霸', match: ['巨无霸'], role: '底盘' },
      { name: '薯条', match: ['薯条'], nutritionMatch: ['中薯条'], role: '主角' },
    ],
    steps: ['打开巨无霸的顶层', '塞入一把薯条（蘸不蘸酱随你）', '盖上盖子，趁薯条还脆咬下去'],
    tags: ['全网经典', '碳水叠碳水', '新手友好'],
    difficulty: 1,
    vibes: ['正餐', '夜宵'],
    heat: 5,
    story: '「薯条夹汉堡」是刻在互联网 DNA 里的吃法，全球网友都偷偷干过。',
    tip: '别塞太多，不然面包合不上。',
  },
  {
    id: 'pie-alamode',
    name: '冰火菠萝派',
    emoji: '🥧🔥',
    tagline: '三分钟搭一个甜品台',
    mechanic: 'ice',
    ingredients: [
      { name: '派（选菠萝口味）', match: ['菠萝派', '派'], nutritionMatch: ['菠萝派'], role: '热' },
      { name: '圆筒冰淇淋', match: ['圆筒冰淇淋', '圆筒'], nutritionMatch: ['圆筒冰淇淋'], role: '冰' },
    ],
    steps: ['把热菠萝派掰成两半', '把圆筒冰淇淋扣在派上', '等 10 秒，冰火交界处口感正好'],
    tags: ['冰火两重天', '甜品控', '好拍'],
    difficulty: 1,
    vibes: ['下午茶'],
    heat: 4,
    story: '热派配冷冰淇淋是西餐甜品的经典组合，在麦当劳三分钟就能搭出来。',
    tip: '香芋派也通用，菠萝派酸甜更搭。',
  },
  {
    id: 'affogato',
    name: '鲜萃阿芙佳朵',
    emoji: '☕🍦',
    tagline: '比官方阿芙佳朵更大杯的 DIY 版',
    mechanic: 'pour',
    ingredients: [
      { name: '鲜萃咖啡', match: ['鲜萃咖啡', '鲜萃'], nutritionMatch: ['小杯鲜萃咖啡', '鲜萃咖啡'], role: '灵魂' },
      { name: '圆筒冰淇淋', match: ['圆筒冰淇淋', '圆筒'], nutritionMatch: ['圆筒冰淇淋'], role: '基底' },
    ],
    steps: ['点一杯鲜萃咖啡和一个圆筒', '把圆筒的冰淇淋刮进咖啡杯（或直接把咖啡浇上去）', '等冰淇淋边缘微微融化，勺子挖着吃'],
    tags: ['高级感', '甜品控', '麦咖啡周边'],
    difficulty: 1,
    vibes: ['下午茶'],
    heat: 4,
    story: '麦咖啡菜单上真的有「咖啡阿芙佳朵」——官方都认证了这个吃法，自己搭一杯分量更足。',
    tip: '想要更浓就换浓缩咖啡，想要更甜就换新地。',
  },
  {
    id: 'shake-fries',
    name: '酸甜摇摇薯',
    emoji: '🍟🎵',
    tagline: '不用摇摇粉也能摇',
    mechanic: 'shake',
    ingredients: [
      { name: '薯条', match: ['薯条'], nutritionMatch: ['中薯条'], role: '主角' },
      { name: '麦乐鸡', match: ['麦乐鸡'], nutritionMatch: ['麦乐鸡5块'], role: '酱料供应商' },
    ],
    steps: ['点薯条 + 麦乐鸡，多要一盒甜酸酱和番茄酱', '把薯条和酱倒进干净的纸袋（或空盒）', '摇到每根薯条都裹上酱，趁脆吃'],
    tags: ['仪式感', '重口味', '好拍'],
    difficulty: 1,
    vibes: ['下午茶', '夜宵'],
    heat: 3,
    story: '摇摇薯条是麦当劳的经典回忆杀，没有摇摇粉也能用酱复刻。',
    tip: '用纸袋摇更均匀，摇完立刻吃。',
  },
  {
    id: 'hashbrown-stack',
    name: '薯饼夹击堡',
    emoji: '🌅🍳',
    tagline: '早八人的加装包',
    mechanic: 'stack',
    ingredients: [
      { name: '猪柳蛋麦满分', match: ['猪柳蛋麦满分'], role: '底盘' },
      { name: '脆薯饼', match: ['脆薯饼', '薯饼'], role: '主角' },
    ],
    steps: ['打开麦满分', '把薯饼夹进肉饼下面', '合上，配豆浆或咖啡，早八回魂'],
    tags: ['早餐限定', '加量流', '早八回魂'],
    difficulty: 1,
    vibes: ['早餐'],
    heat: 4,
    story: '麦满分 + 薯饼是早餐时段的经典加装，脆感直接翻倍。',
    tip: '薯饼要现炸的，软了就没灵魂。',
  },
  {
    id: 'soy-youtiao',
    name: '豆浆泡油条',
    emoji: '🌅🥖',
    tagline: '中式早点的麦记解法',
    mechanic: 'dip',
    ingredients: [
      { name: '脆香油条', match: ['脆香油条', '油条'], role: '主角' },
      { name: '优品豆浆', match: ['优品豆浆', '豆浆'], nutritionMatch: ['优品豆浆小杯'], role: '灵魂' },
      { name: '麦咖啡美式', match: ['美式'], nutritionMatch: ['热美式中杯'], role: '回魂' },
    ],
    steps: ['油条掰成小段', '泡进热豆浆三秒（别泡软）', '配一杯美式，早八回魂套餐完成'],
    tags: ['早餐限定', '中式混搭', '早八回魂'],
    difficulty: 1,
    vibes: ['早餐'],
    heat: 3,
    story: '麦当劳早餐的中式单品被低估了——豆浆泡油条是中式早点的经典吃法。',
    tip: '三秒是黄金时间，久了就塌了。',
  },
  {
    id: 'brave-nugget',
    name: '勇者鸡块',
    emoji: '🍗🍧',
    tagline: '甜咸党的终极试炼',
    mechanic: 'dip',
    ingredients: [
      { name: '麦乐鸡', match: ['麦乐鸡'], nutritionMatch: ['麦乐鸡5块'], role: '主角' },
      { name: '新地（选草莓）', match: ['新地'], nutritionMatch: ['草莓新地'], role: '灵魂' },
    ],
    steps: ['点一份麦乐鸡和一杯草莓新地', '鸡块蘸新地', '吃完的算你狠，拍照发群算你赢'],
    tags: ['地狱试炼', '咸甜永动机', '挑战'],
    difficulty: 3,
    vibes: ['下午茶', '夜宵'],
    heat: 3,
    story: '在麦门江湖流传已久的神秘吃法，敢试的人不多，试过的人都说……还行？',
    tip: '推荐草莓新地，酸甜口更搭；朱古力味是更深的深渊。',
  },
  {
    id: 'yijia-yi',
    name: '1+1 魔法组合',
    emoji: '💰✨',
    tagline: '两套随心配拼出一个四件套',
    mechanic: 'combo',
    ingredients: [
      { name: '随心配 1+1', match: ['精选超值随心配', '随心配', '1+1'], quantity: 2, role: '全部' },
    ],
    steps: ['第一套随心配：主食选汉堡，小食选薯条', '第二套随心配：主食选麦乐鸡，饮品选可乐', '两套组合约等于一个四件套，钱包友好'],
    tags: ['省钱流', '学生党', '组合学'],
    difficulty: 1,
    vibes: ['正餐', '夜宵'],
    heat: 4,
    story: '随心配 1+1 是麦当劳的性价比之选，两套组合就能拼出完整的一餐。',
    tip: '可选餐品以门店随心配菜单为准，下单时在详情里挑。',
  },
];

/** 按 id 查找配方 */
export function getRecipe(id) {
  return RECIPES.find((r) => r.id === id) ?? null;
}

/** 按小时推断场景：早餐 5:00–10:30 / 正餐 10:30–14:00、17:00–21:00 / 下午茶 14:00–17:00 / 夜宵 21:00–5:00 */
export function vibeFromHour(hour, minute = 0) {
  const t = hour + minute / 60;
  if (t >= 5 && t < 10.5) return '早餐';
  if (t >= 10.5 && t < 14) return '正餐';
  if (t >= 14 && t < 17) return '下午茶';
  if (t >= 17 && t < 21) return '正餐';
  return '夜宵';
}

/**
 * 在菜单中匹配餐品：对每个关键词，优先完全相等，其次取「名称最短的包含项」
 * （避免「麦乐鸡」命中「麦乐鸡套餐」「麦乐鸡开心乐园餐」）
 */
export function findMenuItem(menuItems, keywords) {
  if (!Array.isArray(menuItems)) return null;
  for (const keyword of keywords) {
    const exact = menuItems.find((item) => item.name === keyword);
    if (exact) return exact;
    const candidates = menuItems.filter((item) => typeof item.name === 'string' && item.name.includes(keyword));
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.name.length - b.name.length);
      return candidates[0];
    }
  }
  return null;
}

/**
 * 校验配方在当前菜单下是否可做
 * @returns {{ok: boolean, resolved: Array<{ingredient: Ingredient, item: object, quantity: number}>, missing: Ingredient[]}}
 */
export function validateRecipe(recipe, menuItems) {
  const resolved = [];
  const missing = [];
  for (const ingredient of recipe.ingredients) {
    const item = findMenuItem(menuItems, ingredient.match);
    if (item) resolved.push({ ingredient, item, quantity: ingredient.quantity ?? 1 });
    else missing.push(ingredient);
  }
  return { ok: missing.length === 0, resolved, missing };
}

/** 单个原料的价格（prices：菜单数组 或 名称→价格 映射），已乘数量 */
export function priceOf(ingredient, prices) {
  const quantity = ingredient.quantity ?? 1;
  if (!prices) return null;
  if (Array.isArray(prices)) {
    const hit = findMenuItem(prices, ingredient.match);
    return hit && Number.isFinite(hit.priceYuan) ? hit.priceYuan * quantity : null;
  }
  for (const keyword of ingredient.match) {
    if (Number.isFinite(prices[keyword])) return prices[keyword] * quantity;
  }
  const keys = Object.keys(prices).filter((key) => ingredient.match.some((k) => key.includes(k)));
  keys.sort((a, b) => a.length - b.length);
  return keys.length > 0 && Number.isFinite(prices[keys[0]]) ? prices[keys[0]] * quantity : null;
}

/** 配方总价 */
export function recipePrice(recipe, prices) {
  let total = 0;
  let known = 0;
  for (const ingredient of recipe.ingredients) {
    const price = priceOf(ingredient, prices);
    if (Number.isFinite(price)) {
      total += price;
      known += 1;
    }
  }
  return known > 0 ? total : null;
}

/** 营养表查找：优先完全相等，其次最短包含项 */
export function findNutrition(nutrition, keywords) {
  if (!nutrition || !Array.isArray(keywords)) return null;
  for (const keyword of keywords) {
    if (nutrition[keyword]) return nutrition[keyword];
  }
  const names = Object.keys(nutrition).filter((name) => !name.startsWith('_'));
  for (const keyword of keywords) {
    const candidates = names.filter((name) => name.includes(keyword));
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.length - b.length);
      return nutrition[candidates[0]];
    }
  }
  return null;
}

/** 配方总热量（千卡） */
export function recipeCalories(recipe, nutrition) {
  let total = 0;
  let known = 0;
  for (const ingredient of recipe.ingredients) {
    const entry = findNutrition(nutrition, ingredient.nutritionMatch ?? ingredient.match);
    if (entry && Number.isFinite(entry.kcal)) {
      total += entry.kcal * (ingredient.quantity ?? 1);
      known += 1;
    }
  }
  return known > 0 ? total : null;
}

/**
 * 按约束筛选配方（AI 实验室的确定性内核）
 * @param {{budget?: number, maxCalorie?: number, vibe?: string, difficulty?: number, tag?: string}} options
 * @param {Array|object|null} prices 菜单数组或价格映射
 * @param {object|null} nutrition 营养映射
 * @returns {Array<{recipe: Recipe, price: number|null, kcal: number|null, score: number, available: boolean}>}
 */
export function filterRecipes({ budget, maxCalorie, vibe, difficulty, tag } = {}, prices = null, nutrition = null) {
  const scored = [];
  for (const recipe of RECIPES) {
    if (vibe && !recipe.vibes.includes(vibe)) continue;
    if (difficulty && recipe.difficulty > difficulty) continue;
    if (tag && !recipe.tags.some((t) => t.includes(tag))) continue;

    const available = Array.isArray(prices) ? validateRecipe(recipe, prices).ok : true;
    if (Array.isArray(prices) && !available) continue;

    const price = prices ? recipePrice(recipe, prices) : null;
    const kcal = nutrition ? recipeCalories(recipe, nutrition) : null;
    if (budget && price !== null && price > budget) continue;
    if (maxCalorie && kcal !== null && kcal > maxCalorie) continue;

    const score = recipe.heat * 10 - (price ?? 0) * 0.2;
    scored.push({ recipe, price, kcal, score, available });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

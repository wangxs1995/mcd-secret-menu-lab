/**
 * 麦门隐藏菜单知识库 —— 隐藏吃法的「配方」数据与筛选/生成逻辑
 *
 * 设计原则：
 * 1. 所有配方的原料均为麦当劳门店真实在售餐品（离线样例见 src/sample-data/）
 * 2. 配方只描述「点哪些单品 + 怎么改造」，不改动任何餐品本身的做法
 * 3. 运行时通过麦当劳 MCP 的实时菜单校验可得性（match 字段用于模糊匹配餐品名）
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

/**
 * 隐藏吃法图鉴
 * @typedef {object} Recipe
 * @property {string} id           唯一标识（用于 CLI --recipe）
 * @property {string} name         吃法名称
 * @property {string} emoji        展示用 emoji
 * @property {string} tagline      一句话卖点
 * @property {keyof MECHANICS} mechanic 改造机制
 * @property {Array<{name: string, match: string[], role: string}>} ingredients 原料（match 为模糊匹配关键词）
 * @property {string[]} steps      改造步骤
 * @property {string[]} tags       标签
 * @property {1|2|3} difficulty    难度
 * @property {string[]} vibes      适用场景（早餐/正餐/下午茶/夜宵）
 * @property {number} heat         麦门热度（1-5，用于展示与推荐排序）
 * @property {string} story        背景故事
 * @property {string} tip          老饕提示
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
      { name: '薯条（中）', match: ['薯条'], role: '主角' },
      { name: '圆筒冰淇淋', match: ['圆筒'], role: '灵魂' },
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
    tagline: '四块钱的麦乐酷平替',
    mechanic: 'pour',
    ingredients: [
      { name: '可乐（中）', match: ['可乐'], role: '基底' },
      { name: '圆筒冰淇淋', match: ['圆筒'], role: '灵魂' },
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
    id: 'deep-double',
    name: '深海双吉',
    emoji: '🍔🐟',
    tagline: '海陆双军的会师仪式',
    mechanic: 'stack',
    ingredients: [
      { name: '双层吉士汉堡', match: ['双层吉士', '双吉'], role: '陆地' },
      { name: '麦香鱼', match: ['麦香鱼'], role: '海洋' },
    ],
    steps: ['把麦香鱼整个夹进双吉中间（或反过来）', '轻轻压扁一点更稳', '双手拿稳，大口咬下去'],
    tags: ['硬核组合', '蛋白质炸弹', '饱腹'],
    difficulty: 2,
    vibes: ['正餐', '夜宵'],
    heat: 4,
    story: '一个双吉不够、一条麦香鱼太单薄，合体才是完全体。',
    tip: '先吃掉四分之一再加鱼堡，不然真的会散架。',
  },
  {
    id: 'nugget-stack',
    name: '鸡块夹击堡',
    emoji: '🍔🍗',
    tagline: '给汉堡加装弹药',
    mechanic: 'stack',
    ingredients: [
      { name: '双层吉士汉堡', match: ['双层吉士', '双吉'], role: '底盘' },
      { name: '麦乐鸡（5块）', match: ['麦乐鸡', '鸡块'], role: '弹药' },
      { name: '甜酸酱', match: ['甜酸酱'], role: '粘合剂' },
    ],
    steps: ['打开双吉的上层面包', '把 5 块鸡块蘸好甜酸酱平铺进去', '盖上面包压一压，一口咬到底'],
    tags: ['加量流', '饱腹', '进阶'],
    difficulty: 2,
    vibes: ['正餐'],
    heat: 3,
    story: '汉堡是平台，鸡块是插件——这是麦门工程学。',
    tip: '鸡块蘸酱再夹，防滑又入味。',
  },
  {
    id: 'fries-burger',
    name: '薯条夹击堡',
    emoji: '🍔🍟',
    tagline: '把快乐夹进面包里',
    mechanic: 'stack',
    ingredients: [
      { name: '巨无霸', match: ['巨无霸'], role: '底盘' },
      { name: '薯条（中）', match: ['薯条'], role: '主角' },
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
      { name: '菠萝派', match: ['菠萝派'], role: '热' },
      { name: '圆筒冰淇淋', match: ['圆筒'], role: '冰' },
    ],
    steps: ['把热菠萝派掰成两半', '把圆筒冰淇淋扣在派上', '等 10 秒，冰火交界处最好吃'],
    tags: ['冰火两重天', '甜品控', '好拍'],
    difficulty: 1,
    vibes: ['下午茶'],
    heat: 4,
    story: '热派配冷冰淇淋是西餐甜品的经典组合，在麦当劳三分钟就能搭出来。',
    tip: '香芋派也通用，菠萝派酸甜更搭。',
  },
  {
    id: 'affogato',
    name: '麦记阿芙佳朵',
    emoji: '☕🍨',
    tagline: '麦咖啡柜台的隐藏菜单',
    mechanic: 'pour',
    ingredients: [
      { name: '麦咖啡·浓缩咖啡', match: ['浓缩', '意式浓缩'], role: '灵魂' },
      { name: '新地（香草）', match: ['新地'], role: '基底' },
    ],
    steps: ['点一杯浓缩咖啡和一份香草新地', '把浓缩缓缓浇在新地上', '等冰淇淋边缘微微融化，勺子挖着吃'],
    tags: ['高级感', '甜品控', '麦咖啡周边'],
    difficulty: 1,
    vibes: ['下午茶'],
    heat: 4,
    story: '意大利经典甜品「阿芙佳朵」（Affogato）的麦当劳版本，两步搞定。',
    tip: '没有浓缩就点美式，浇半杯风味也不错。',
  },
  {
    id: 'shake-fries',
    name: '酸甜摇摇薯',
    emoji: '🍟🎵',
    tagline: '不用摇摇粉也能摇',
    mechanic: 'shake',
    ingredients: [
      { name: '薯条（中）', match: ['薯条'], role: '主角' },
      { name: '麦乐鸡（5块）', match: ['麦乐鸡', '鸡块'], role: '配角' },
      { name: '甜酸酱', match: ['甜酸酱'], role: '调味' },
    ],
    steps: ['点中薯 + 5 块麦乐鸡，多要一盒甜酸酱', '把薯条和酱倒进干净的纸袋（或空盒）', '摇到每根薯条都裹上酱，趁脆吃'],
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
      { name: '猪柳蛋麦满分', match: ['猪柳蛋', '麦满分'], role: '底盘' },
      { name: '薯饼', match: ['薯饼'], role: '主角' },
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
      { name: '油条', match: ['油条'], role: '主角' },
      { name: '豆浆', match: ['豆浆'], role: '灵魂' },
      { name: '麦咖啡·美式', match: ['美式'], role: '回魂' },
    ],
    steps: ['油条掰成小段', '泡进热豆浆三秒（别泡软）', '配一杯美式，早八回魂套餐完成'],
    tags: ['早餐限定', '中式混搭', '早八回魂'],
    difficulty: 1,
    vibes: ['早餐'],
    heat: 3,
    story: '麦当劳早餐的中式单品被低估了——豆浆泡油条是中式早点最经典的吃法。',
    tip: '三秒是黄金时间，久了就塌了。',
  },
  {
    id: 'brave-nugget',
    name: '勇者鸡块',
    emoji: '🍗🍦',
    tagline: '甜咸党的终极试炼',
    mechanic: 'dip',
    ingredients: [
      { name: '麦乐鸡（5块）', match: ['麦乐鸡', '鸡块'], role: '主角' },
      { name: '新地（草莓）', match: ['新地'], role: '灵魂' },
    ],
    steps: ['点一份麦乐鸡和一杯草莓新地', '鸡块蘸新地', '吃完的算你狠，拍照发群算你赢'],
    tags: ['地狱试炼', '咸甜永动机', '挑战'],
    difficulty: 3,
    vibes: ['下午茶', '夜宵'],
    heat: 3,
    story: '在麦门江湖流传已久的神秘吃法，敢试的人不多，试过的人都说……还行？',
    tip: '推荐草莓新地，酸甜口更搭；巧克力味是更深的深渊。',
  },
  {
    id: 'yijia-yi',
    name: '1+1 魔法组合',
    emoji: '💰✨',
    tagline: '12 块钱的排列组合学',
    mechanic: 'combo',
    ingredients: [
      { name: '1+1 随心配', match: ['1+1', '随心配'], role: '第一套' },
      { name: '双层吉士汉堡', match: ['双层吉士', '双吉'], role: '主食' },
      { name: '薯条（中）', match: ['薯条'], role: '小食' },
      { name: '可乐（中）', match: ['可乐'], role: '饮品' },
    ],
    steps: [
      '第一套 1+1：主食选双层吉士汉堡，小食选薯条',
      '第二套 1+1：主食选麦乐鸡，饮品选可乐',
      '两套组合约等于一个四件套，钱包友好',
    ],
    tags: ['省钱流', '学生党', '组合学'],
    difficulty: 1,
    vibes: ['正餐', '夜宵'],
    heat: 4,
    story: '1+1 随心配是麦当劳的性价比之王，两套组合就能拼出完整的一餐。',
    tip: '具体可选餐品以门店 1+1 菜单为准，先看 MCP 菜单再点。',
  },
];

/** 按 id 查找配方 */
export function getRecipe(id) {
  return RECIPES.find((r) => r.id === id) ?? null;
}

/**
 * 校验配方在当前菜单下是否可做
 * @param {Recipe} recipe
 * @param {Array<{name: string}>} menuItems 实时菜单或样例菜单
 * @returns {{ok: boolean, resolved: Array, missing: Array}}
 */
export function validateRecipe(recipe, menuItems) {
  const resolved = [];
  const missing = [];
  for (const ingredient of recipe.ingredients) {
    const hit = findMenuItem(menuItems, ingredient.match);
    if (hit) resolved.push({ ingredient, item: hit });
    else missing.push(ingredient);
  }
  return { ok: missing.length === 0, resolved, missing };
}

/** 在菜单中按关键词模糊匹配餐品 */
export function findMenuItem(menuItems, keywords) {
  for (const keyword of keywords) {
    const hit = menuItems.find((item) => item.name?.includes(keyword));
    if (hit) return hit;
  }
  return null;
}

/**
 * 按约束筛选配方（AI 实验室的确定性内核）
 * @param {object} options
 * @param {number} [options.budget]     预算上限（元）
 * @param {number} [options.maxCalorie] 热量上限（kcal）
 * @param {string} [options.vibe]       场景（早餐/正餐/下午茶/夜宵）
 * @param {number} [options.difficulty] 最高难度 1-3
 * @param {string} [options.tag]        标签过滤
 * @param {number} [options.seed]       随机种子（可复现）
 */
export function filterRecipes({ budget, maxCalorie, vibe, difficulty, tag } = {}, prices = null, calories = null) {
  const scored = [];
  for (const recipe of RECIPES) {
    if (vibe && !recipe.vibes.includes(vibe)) continue;
    if (difficulty && recipe.difficulty > difficulty) continue;
    if (tag && !recipe.tags.some((t) => t.includes(tag))) continue;

    const price = prices ? recipePrice(recipe, prices) : null;
    const kcal = calories ? recipeCalories(recipe, calories) : null;
    if (budget && price !== null && price > budget) continue;
    if (maxCalorie && kcal !== null && kcal > maxCalorie) continue;

    // 评分：热度为主，满足约束的再按价格从低到高微调
    const score = recipe.heat * 10 - (price ?? 0) * 0.2;
    scored.push({ recipe, price, kcal, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** 计算配方总价（prices: 菜单数组 或 名称→价格 映射） */
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

/** 从菜单数组或价格映射中取出单个原料的价格 */
export function priceOf(ingredient, prices) {
  if (!prices) return null;
  if (Array.isArray(prices)) {
    const hit = findMenuItem(prices, ingredient.match);
    return hit && Number.isFinite(hit.priceYuan) ? hit.priceYuan : null;
  }
  // 名称 → 价格 映射：先精确，再模糊
  for (const keyword of ingredient.match) {
    if (Number.isFinite(prices[keyword])) return prices[keyword];
  }
  for (const [key, value] of Object.entries(prices)) {
    if (!Number.isFinite(value)) continue;
    if (ingredient.match.some((keyword) => key.includes(keyword) || keyword.includes(key))) return value;
  }
  return null;
}

/** 计算配方总热量 */
export function recipeCalories(recipe, nutrition) {
  let total = 0;
  let known = 0;
  for (const ingredient of recipe.ingredients) {
    const entry = findNutrition(nutrition, ingredient.match);
    if (entry && Number.isFinite(entry.kcal)) {
      total += entry.kcal;
      known += 1;
    }
  }
  return known > 0 ? total : null;
}

function findNutrition(nutrition, keywords) {
  if (!nutrition) return null;
  for (const keyword of keywords) {
    if (nutrition[keyword]) return nutrition[keyword];
  }
  // 二级模糊：key 包含关键词
  for (const [key, value] of Object.entries(nutrition)) {
    if (key.startsWith('_')) continue;
    if (keywords.some((keyword) => key.includes(keyword) || keyword.includes(key))) return value;
  }
  return null;
}

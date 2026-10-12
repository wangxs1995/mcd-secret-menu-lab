/**
 * 文案合规自检 —— 给配方、文档与 Agent 生成的文案做措辞红线检查
 *
 * 覆盖五类：歧视 / 贬低人群、对比其他品牌、医疗功效宣称、迷信、绝对化用语，外加不健康饮食导向。
 * 用法：
 *   node src/lab.mjs lint                 # 扫描仓库文档与全部配方
 *   node src/lab.mjs lint --text "文案"   # 检查一段文案（Agent 生成后自检）
 *   node src/lab.mjs lint --file 路径
 *
 * 口径说明：轻松的自嘲式网络词（打工人、牛马、学生党）允许使用，但只能自嘲、不能给别人贴标签；
 * 任何指向阶层、地域、收入、身体或精神状态的贬低说法一律不允许。
 */

export const RULES = [
  {
    id: 'discrimination',
    label: '歧视 / 贬低人群',
    pattern:
      /贫民窟|屌丝|土鳖|乡巴佬|低端人口|下等人|傻子|智障|弱智|脑残|神经病|白痴|废物|乞丐|要饭|穷鬼|穷酸|蠢货|死肥|丑八怪|娘炮|太监|瞎子|聋子|瘸子|残废|精神病|文盲|乡下人|外地人|\bslum\b|\bghetto\b|\bretard/i,
    hint: '换成中性或友善的说法；自嘲式网络词（打工人、牛马）可以用，但不要指向任何人群',
  },
  {
    id: 'brand-compare',
    label: '对比其他品牌',
    pattern: /肯德基|KFC|汉堡王|Burger King|必胜客|德克士|华莱士|塔斯汀/i,
    hint: '活动规则禁止与其他品牌对比，只说自己',
  },
  {
    id: 'medical',
    label: '医疗 / 功效宣称',
    pattern: /治疗|治愈|疗效|药用|保健功效|降血糖|降血压|减肥神器|排毒|消炎/,
    hint: '营养信息只做估算与参考，不做任何功效宣称',
  },
  {
    id: 'superstition',
    label: '迷信',
    pattern: /算命|风水|转运|开运|改命|辟邪/,
    hint: '避免迷信类表述',
  },
  {
    id: 'absolute',
    label: '绝对化用语',
    pattern: /最经典|最好吃|最健康|最便宜|第一名|世界第一|全国第一|之王|顶级|史上最|独一无二|无与伦比/,
    hint: '广告法意义上的绝对化用语，换成「经典」「人气」「之选」等',
  },
  {
    id: 'unhealthy',
    label: '不健康饮食导向',
    pattern: /暴食|催吐|吃到吐|越多越好|浪费/,
    hint: '不宣传不健康饮食方式或浪费',
  },
];

/**
 * 检查一段文本
 * @param {string} text
 * @param {{source?: string}} [options]
 * @returns {Array<{rule: string, label: string, match: string, index: number, context: string, source: string, hint: string}>}
 */
export function checkText(text, { source = '' } = {}) {
  if (typeof text !== 'string' || !text) return [];
  const findings = [];
  for (const rule of RULES) {
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`);
    let hit;
    while ((hit = regex.exec(text)) !== null) {
      const start = Math.max(0, hit.index - 12);
      const end = Math.min(text.length, hit.index + hit[0].length + 12);
      findings.push({
        rule: rule.id,
        label: rule.label,
        match: hit[0],
        index: hit.index,
        context: text.slice(start, end).replace(/\s+/g, ' '),
        source,
        hint: rule.hint,
      });
      if (hit[0].length === 0) regex.lastIndex += 1;
    }
  }
  return findings;
}

/** 检查配方知识库中所有文案字段 */
export function checkRecipes(recipes) {
  const findings = [];
  for (const recipe of recipes) {
    const fields = {
      name: recipe.name,
      tagline: recipe.tagline,
      story: recipe.story,
      tip: recipe.tip,
      steps: (recipe.steps ?? []).join('\n'),
      tags: (recipe.tags ?? []).join(' '),
      ingredients: (recipe.ingredients ?? []).map((i) => `${i.name} ${i.role ?? ''}`).join('\n'),
    };
    for (const [field, value] of Object.entries(fields)) {
      findings.push(...checkText(value, { source: `recipes.mjs › ${recipe.id}.${field}` }));
    }
  }
  return findings;
}

#!/usr/bin/env node
/**
 * 麦门隐藏菜单研究所 · CLI 入口
 *
 * 用法：node src/lab.mjs <命令> [选项]（或 npm run menu / npm run lab）
 * 命令：recipes / menu / lab / card / price / order / stores / demo / doctor
 *
 * 设计原则：
 * - 零依赖；缺少 Token 时自动降级为离线样例数据（真实 MCP 快照），保证任何人都能跑起来
 * - 联网时所有数据来自麦当劳 MCP 实时返回；价格以 calculate-price 为准，不做心算
 * - 下单（create-order）必须显式 --yes，默认只做预演
 */
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { McdMcpClient, McpError } from './mcp-client.mjs';
import { loadEnvFile, fmtMoney } from './util.mjs';
import { RECIPES, getRecipe, filterRecipes, validateRecipe, vibeFromHour, MECHANICS, DIFFICULTY_LABEL } from './recipes.mjs';
import { loadSampleMenu, loadSampleNutrition } from './sample.mjs';
import { sumNutrition, mealBill } from './nutrition.mjs';
import { sumPrice, quoteViaMcp } from './pricing.mjs';
import { normalizeMenuData, parseNutritionData, parseCampaignCalendar } from './mcp-parse.mjs';
import { renderCardHtml, renderCardPage, renderSocialPage, printCardText, writeFileEnsured } from './card.mjs';
import { checkText, checkRecipes } from './compliance.mjs';
import { readFileSync } from 'node:fs';

/** lint 命令缺省扫描的文案文件（规则说明类文件本身含示例词，不在列） */
const DEFAULT_LINT_FILES = [
  'README.md',
  'README.en.md',
  'CHANGELOG.md',
  'references/recipes.md',
  'docs/share/README.md',
  'docs/share/xiaohongshu.md',
  'docs/share/zhihu-v2ex.md',
  'docs/share/moments.md',
  'workbuddy.md',
];

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

/** 到店自取：orderType=1 / beType=1（本项目 v1 聚焦到店场景；外送需配送地址，见 docs/DESIGN.md 路线图） */
const PICKUP = { orderType: 1, beType: 1 };

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = (text) => paint('1', text);
const dim = (text) => paint('2', text);
const red = (text) => paint('31', text);
const green = (text) => paint('32', text);
const yellow = (text) => paint('33', text);

const HELP = `
🍟 ${bold('麦门隐藏菜单研究所')} · MCD Secret Menu Lab

用法：node src/lab.mjs <命令> [选项]

命令：
  recipes   查看隐藏吃法图鉴
  menu      查看门店菜单 + 今日可做的隐藏吃法
  lab       实验室：按预算 / 热量 / 场景筛选隐藏吃法方案（联网时联动时段与活动日历）
  card      生成「机密档案」配方卡（HTML / 文本）
  price     计算某个隐藏吃法的价格（联网时为 MCP 实时算价，含优惠）
  order     下单某个隐藏吃法（默认仅预演，加 --yes 才真实下单）
  stores    查询可点餐门店（联网，--city + --keyword）
  demo      生成演示页（docs/demo.html）
  doctor    环境自检（Token / 连通性 / 工具列表）
  lint      文案合规自检（歧视 / 贬低、品牌对比、功效宣称、迷信、绝对化用语）

常用选项：
  --offline            强制使用内置样例数据（无需 Token）
  --json               以 JSON 输出（便于脚本 / Agent 调用）
  --debug              打印 MCP 请求细节
  --text <文案>        lint：检查一段文案；--file <路径> 检查文件；都不传则扫描仓库文档与全部配方
  --store <code>       门店编码（联网菜单 / 算价 / 下单需要；用 stores 命令查询）
  --recipe <id>        隐藏吃法 id（见 recipes 命令）
  --budget <元>        预算上限（lab）
  --calorie <kcal>     热量上限（lab）
  --vibe <场景>        早餐 / 正餐 / 下午茶 / 夜宵（lab，缺省按当前时段自动推断）
  --difficulty <1-3>   最高难度（lab / recipes）
  --tag <标签>         标签过滤（lab / recipes）
  --out <path>         card / demo 的输出路径
  --format text        card 命令只输出文本版
  --takeway <code>     order 命令的取餐方式（eat-in 堂食 / locker-out 外带，缺省取算价返回的第一项）
  --city / --keyword   stores 命令：城市 + 关键词（如 --city 上海市 --keyword 人民广场）

示例：
  node src/lab.mjs recipes
  node src/lab.mjs lab --budget 30 --vibe 夜宵
  node src/lab.mjs card --recipe fries-float
  node src/lab.mjs stores --city 上海市 --keyword 人民广场
  node src/lab.mjs menu --store 1450713
  node src/lab.mjs order --recipe cola-float --store 1450713 --yes
`;

async function main() {
  const { command, flags } = parseArgv(process.argv.slice(2));
  switch (command) {
    case 'recipes':
      return cmdRecipes(flags);
    case 'menu':
      return cmdMenu(flags);
    case 'lab':
      return cmdLab(flags);
    case 'card':
      return cmdCard(flags);
    case 'price':
      return cmdPrice(flags);
    case 'order':
      return cmdOrder(flags);
    case 'stores':
      return cmdStores(flags);
    case 'demo':
      return cmdDemo(flags);
    case 'doctor':
      return cmdDoctor(flags);
    case 'lint':
      return cmdLint(flags);
    case 'help':
    case undefined:
      console.log(HELP);
      return;
    default:
      console.log(HELP);
      process.exitCode = 1;
  }
}

/* ---------------- 命令实现 ---------------- */

function cmdRecipes(flags) {
  let list = RECIPES;
  if (typeof flags.vibe === 'string') list = list.filter((r) => r.vibes.includes(flags.vibe));
  if (typeof flags.tag === 'string') list = list.filter((r) => r.tags.some((t) => t.includes(flags.tag)));
  if (flags.difficulty) list = list.filter((r) => r.difficulty <= Number(flags.difficulty));

  if (flags.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }
  console.log(bold(`\n📖 隐藏吃法图鉴（${list.length} 道）\n`));
  for (const recipe of list) {
    console.log(`  ${recipe.emoji} ${bold(recipe.name)} ${dim(`(${recipe.id})`)} —— ${recipe.tagline}`);
    console.log(
      dim(
        `     ${DIFFICULTY_LABEL[recipe.difficulty]} · ${MECHANICS[recipe.mechanic]} · ${recipe.vibes.join('/')} · 热度 ${'★'.repeat(recipe.heat)} · ${recipe.tags.join('、')}`,
      ),
    );
  }
  console.log(dim('\n  生成配方卡：node src/lab.mjs card --recipe <id>\n'));
}

async function cmdMenu(flags) {
  const context = await loadContext(flags);
  const availability = RECIPES.map((recipe) => {
    const { ok, missing } = validateRecipe(recipe, context.items);
    return { id: recipe.id, name: recipe.name, ok, missing: missing.map((m) => m.name) };
  });

  if (flags.json) {
    console.log(JSON.stringify({ source: context.source, store: context.storeName, items: context.items, availability }, null, 2));
    return;
  }

  console.log(bold(`\n📋 菜单 · ${context.storeName}`) + dim(`（${context.source === 'live' ? '实时数据' : '样例快照'}，共 ${context.items.length} 项）\n`));
  const byCategory = groupBy(context.items, (item) => item.category || '其他');
  for (const [category, items] of Object.entries(byCategory)) {
    console.log(`  ${bold(`【${category}】`)}`);
    for (const item of items) {
      const discount =
        Number.isFinite(item.originalPrice) && item.originalPrice > item.priceYuan ? dim(` (原价 ${fmtMoney(item.originalPrice)})`) : '';
      console.log(`    ${item.name} ${dim(fmtMoney(item.priceYuan))}${discount} ${dim(`#${item.code}`)}`);
    }
  }
  const okCount = availability.filter((a) => a.ok).length;
  console.log(bold(`\n🧪 当前可做的隐藏吃法（${okCount}/${RECIPES.length}）：\n`));
  for (const entry of availability) {
    if (entry.ok) console.log(`  ${green('✅')} ${entry.name} ${dim(`(${entry.id})`)}`);
    else console.log(`  ${red('❌')} ${entry.name} ${dim(`缺：${entry.missing.join('、')}`)}`);
  }
  console.log('');
}

async function cmdLab(flags) {
  const context = await loadContext(flags);
  const clock = await resolveClock(context);
  const campaigns = await resolveCampaigns(context);

  const constraints = {
    budget: flags.budget ? Number(flags.budget) : undefined,
    maxCalorie: flags.calorie ? Number(flags.calorie) : undefined,
    difficulty: flags.difficulty ? Number(flags.difficulty) : undefined,
    tag: typeof flags.tag === 'string' ? flags.tag : undefined,
  };
  const userVibe = typeof flags.vibe === 'string' ? flags.vibe : null;
  let vibe = userVibe ?? clock.vibe;
  let rows = filterRecipes({ ...constraints, vibe }, context.items, context.nutrition);
  let vibeNote = userVibe ? `场景：${vibe}` : `自动场景：${vibe}（按 ${clock.text}，可用 --vibe 覆盖）`;
  if (rows.length === 0 && !userVibe) {
    rows = filterRecipes(constraints, context.items, context.nutrition);
    vibe = null;
    vibeNote = `当前时段（${clock.text}）无匹配，已放开场景限制`;
  }
  const top = rows.slice(0, 3);

  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          source: context.source,
          now: clock.text,
          vibe,
          campaigns,
          constraints: { budget: constraints.budget ?? null, calorie: constraints.maxCalorie ?? null },
          results: top.map(({ recipe, price, kcal }) => ({
            id: recipe.id,
            name: recipe.name,
            tagline: recipe.tagline,
            ingredients: recipe.ingredients.map((i) => `${i.name}${(i.quantity ?? 1) > 1 ? ` ×${i.quantity}` : ''}`),
            steps: recipe.steps,
            price,
            kcal,
            tags: recipe.tags,
            difficulty: recipe.difficulty,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const labels = [];
  if (constraints.budget) labels.push(`预算 ≤ ${fmtMoney(constraints.budget)}`);
  if (constraints.maxCalorie) labels.push(`热量 ≤ ${constraints.maxCalorie} 千卡`);
  labels.push(vibeNote);
  console.log(bold('\n🧪 实验室报告') + dim(`（${context.source === 'live' ? '实时菜单' : '样例快照'} · ${labels.join(' · ')}）`));
  if (campaigns.length > 0) {
    console.log(dim(`🎪 活动联动：${campaigns.map((c) => c.title).join('；')}`));
  }
  console.log('');
  if (top.length === 0) {
    console.log(yellow('  没有符合条件的方案。试试放宽预算 / 热量，或去掉场景限制。\n'));
    return;
  }
  top.forEach(({ recipe, price, kcal }, index) => {
    console.log(`  ${bold(`方案 ${index + 1}：${recipe.emoji} ${recipe.name}`)} —— ${recipe.tagline}`);
    console.log(`     原料：${recipe.ingredients.map((i) => `${i.name}${(i.quantity ?? 1) > 1 ? ` ×${i.quantity}` : ''}`).join(' + ')}`);
    console.log(`     估算：${fmtMoney(price ?? NaN)} · ${Number.isFinite(kcal) ? `${Math.round(kcal)} 千卡` : '热量未知'} · ${DIFFICULTY_LABEL[recipe.difficulty]}`);
    console.log(`     步骤：${recipe.steps.join(' → ')}`);
    console.log(dim(`     下单：node src/lab.mjs order --recipe ${recipe.id} --store ${context.storeCode}`));
    console.log('');
  });
  console.log(dim(`  共 ${rows.length} 个候选，展示前 3。生成配方卡：node src/lab.mjs card --recipe <id>\n`));
}

async function cmdCard(flags) {
  const recipe = requireRecipe(flags);
  const context = await loadContext(flags);
  const data = buildCardData(recipe, context);

  if (flags.format === 'text') {
    console.log(printCardText(recipe, data));
    return;
  }
  const out = typeof flags.out === 'string' ? resolve(flags.out) : resolve(process.cwd(), 'output', `card-${recipe.id}.html`);
  writeFileEnsured(out, renderCardHtml(recipe, data));
  console.log(printCardText(recipe, data));
  console.log(green(`\n✅ 配方卡已生成 → ${out}`));
  console.log(dim('   用浏览器打开后截图，即可直接发小红书 / 朋友圈。\n'));
}

async function cmdPrice(flags) {
  const recipe = requireRecipe(flags);
  const context = await loadContext(flags);
  const { resolved, missing } = validateRecipe(recipe, context.items);
  if (missing.length > 0) {
    console.log(red(`\n❌ 当前菜单缺少原料：${missing.map((m) => m.name).join('、')}，无法组成「${recipe.name}」\n`));
    process.exitCode = 1;
    return;
  }

  if (context.source === 'live') {
    const quote = await quoteViaMcp(context.client, { storeCode: context.storeCode, items: toOrderItems(resolved) });
    if (flags.json) {
      console.log(JSON.stringify({ recipe: recipe.id, source: 'mcp', ...quote, raw: undefined }, null, 2));
      return;
    }
    console.log(bold(`\n💰 ${recipe.name} · MCP 实时算价（门店 ${context.storeCode}）\n`));
    printQuote(quote);
    return;
  }

  const local = sumPrice(resolved);
  if (flags.json) {
    console.log(JSON.stringify({ recipe: recipe.id, source: 'local', ...local }, null, 2));
    return;
  }
  console.log(bold(`\n💰 ${recipe.name} · 本地估算（样例快照）\n`));
  for (const line of local.lines) console.log(`  · ${line.name}　${fmtMoney(line.price ?? NaN)}`);
  console.log(`  ${bold(`合计约 ${fmtMoney(local.subtotal)}`)}`);
  console.log(dim('  提示：配置 Token 后会调用 MCP calculate-price，得到含优惠的准确价格。\n'));
}

async function cmdOrder(flags) {
  const recipe = requireRecipe(flags);
  const context = await loadContext(flags, { requireLive: flags.yes === true });
  const { resolved, missing } = validateRecipe(recipe, context.items);

  console.log(bold(`\n🧾 下单预演 · ${recipe.emoji} ${recipe.name}\n`));
  if (missing.length > 0) {
    console.log(red(`  ❌ 当前菜单缺少原料：${missing.map((m) => m.name).join('、')}，无法组成该吃法。\n`));
    process.exitCode = 1;
    return;
  }

  const items = toOrderItems(resolved);
  let quote = null;
  if (context.source === 'live') {
    quote = await quoteViaMcp(context.client, { storeCode: context.storeCode, items });
    printQuote(quote);
  } else {
    const local = sumPrice(resolved);
    for (const line of local.lines) console.log(`  · ${line.name}　${fmtMoney(line.price ?? NaN)}`);
    console.log(`  ${bold(`合计约 ${fmtMoney(local.subtotal)}`)}${dim('（样例快照，真实下单前会用 MCP 实时算价）')}`);
  }
  console.log(`\n  ${bold('到手后的改造步骤：')}`);
  recipe.steps.forEach((step, index) => console.log(`    ${index + 1}. ${step}`));

  if (flags.yes !== true) {
    console.log(yellow('\n  这是预演（dry-run），没有真实下单。'));
    console.log(dim('  确认无误后加 --yes 执行真实下单（创建订单后仍需在麦当劳官方渠道完成支付）。\n'));
    return;
  }

  const takeWayCode = typeof flags.takeway === 'string' ? flags.takeway : (quote?.takeWayList?.[0]?.code ?? 'eat-in');
  const payload = { storeCode: context.storeCode, ...PICKUP, items, takeWayCode, needTableware: false };
  if (flags.debug) console.error('[order] payload =', JSON.stringify(payload));
  const data = await context.client.callToolData('create-order', payload);
  const orderId = deepFindString(data, ['orderId', 'orderNo', 'id']);
  const payUrl = deepFindString(data, ['payUrl', 'payLink', 'paymentUrl', 'orderUrl', 'url']);
  console.log(green(`\n  ✅ 订单已创建（取餐方式：${takeWayCode}）`));
  if (orderId) console.log(`  订单号：${orderId}`);
  if (payUrl) console.log(`  支付链接：${payUrl}`);
  if (!orderId && !payUrl) console.log(`  返回：${JSON.stringify(data).slice(0, 600)}`);
  console.log(dim('  请在麦当劳官方渠道完成支付；改造步骤（拆 / 夹 / 蘸 / 摇）需要你到手后自行完成 😉\n'));
}

async function cmdStores(flags) {
  const city = typeof flags.city === 'string' ? flags.city : null;
  const keyword = typeof flags.keyword === 'string' ? flags.keyword : typeof flags.address === 'string' ? flags.address : null;
  if (!city || !keyword) {
    throw new McpError('用法：node src/lab.mjs stores --city <城市> --keyword <地标或路名>（两者都需要）', { code: 'BAD_ARGS' });
  }
  const client = getClient(flags);
  await client.initialize();
  const stores = await client.callToolData('query-nearby-stores', { beType: 1, searchType: 2, city, keyword });
  const list = Array.isArray(stores) ? stores : [];
  if (flags.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }
  console.log(bold(`\n📍 ${city} · ${keyword} 附近可点餐门店（${list.length} 家）\n`));
  for (const store of list) {
    const status = store.businessStatus === false ? red('休息中') : green('营业中');
    console.log(`  · ${bold(store.storeName ?? '(未命名门店)')} ${dim(`#${store.storeCode}`)} ${status} ${dim(`${store.businessStartTime ?? ''}-${store.businessEndTime ?? ''}`)}`);
    console.log(dim(`    ${store.address ?? ''}${Number.isFinite(store.distance) ? ` · 约 ${store.distance}m` : ''}`));
  }
  console.log(dim('\n  用门店编码继续：node src/lab.mjs menu --store <门店编码>\n'));
}

async function cmdDemo(flags) {
  const menu = loadSampleMenu();
  const nutrition = loadSampleNutrition();
  const context = { items: menu.items, nutrition, source: 'sample', storeName: menu.store.storeName, storeCode: menu.store.storeCode };
  const dataMap = {};
  for (const recipe of RECIPES) dataMap[recipe.id] = buildCardData(recipe, context);
  const out = typeof flags.out === 'string' ? resolve(flags.out) : join(ROOT, 'docs', 'demo.html');
  writeFileEnsured(
    out,
    renderCardPage(RECIPES, dataMap, {
      note: `演示页基于麦当劳 MCP 真实快照生成（${menu.snapshot?.storeName ?? '示例门店'} · ${menu.snapshot?.capturedAt ?? ''}）；联网模式下所有数据实时来自 MCP。`,
    }),
  );
  console.log(green(`✅ 演示页已生成 → ${out}`));
  const social = join(ROOT, 'docs', 'social.html');
  writeFileEnsured(social, renderSocialPage(RECIPES, dataMap));
  console.log(green(`✅ 社交预览模板已生成 → ${social}`) + dim('（1280×640，截图后作为仓库 Social preview）'));
}

async function cmdDoctor(flags) {
  console.log(bold('\n🩺 环境自检\n'));
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  console.log(`  ${nodeMajor >= 18 ? green('✅') : red('❌')} Node.js ${process.version}（需要 >= 18）`);

  const applied = loadEnvFile();
  const hasEnvFile = Object.keys(applied).length > 0;
  console.log(`  ${hasEnvFile ? green('✅') : yellow('⚠️')} .env 文件${hasEnvFile ? '已加载' : '未找到（可复制 .env.example）'}`);

  const token = process.env.MCD_MCP_TOKEN ?? '';
  const tokenOk = token && token !== 'YOUR_MCP_TOKEN_HERE';
  console.log(`  ${tokenOk ? green('✅') : red('❌')} MCD_MCP_TOKEN ${tokenOk ? `已配置（${token.length} 字符）` : '未配置（离线模式可用，但无法调用真实 MCP）'}`);
  if (!tokenOk) {
    console.log(dim('\n  申请 Token：https://open.mcd.cn/mcp 手机号登录 → 控制台 → 激活\n'));
    process.exitCode = 1;
    return;
  }

  const client = getClient(flags);
  process.stdout.write('  … 连接 https://mcp.mcd.cn ');
  const info = await client.initialize();
  console.log(green('✅'));
  console.log(`  ✅ MCP 会话建立${info?.name ? `（${info.name} ${info.version ?? ''}）` : ''}`);
  const tools = await client.listTools();
  console.log(`  ✅ 可用工具 ${tools.length} 个`);
  console.log(dim(`     ${tools.slice(0, 10).map((t) => t.name).join('、')}${tools.length > 10 ? ' …' : ''}`));
  const time = await client.callToolData('now-time-info');
  console.log(`  ✅ 服务器时间 ${time?.formatted ?? '?'}（${time?.timezone ?? ''}）\n`);
}

/* ---------------- 数据装载 ---------------- */

function cmdLint(flags) {
  let findings = [];
  let scope = '';
  if (typeof flags.text === 'string') {
    findings = checkText(flags.text, { source: '--text' });
    scope = '一段文案';
  } else if (typeof flags.file === 'string') {
    findings = checkText(readFileSync(resolve(flags.file), 'utf8'), { source: flags.file });
    scope = flags.file;
  } else {
    findings = checkRecipes(RECIPES);
    for (const rel of DEFAULT_LINT_FILES) {
      try {
        findings.push(...checkText(readFileSync(join(ROOT, rel), 'utf8'), { source: rel }));
      } catch {
        /* 文件不存在则跳过 */
      }
    }
    scope = `${RECIPES.length} 道配方 + ${DEFAULT_LINT_FILES.length} 个文档`;
  }

  if (flags.json) {
    console.log(JSON.stringify({ scope, findings }, null, 2));
    process.exitCode = findings.length > 0 ? 1 : 0;
    return;
  }
  if (findings.length === 0) {
    console.log(green(`\n✅ 文案合规自检通过（${scope}）：未发现歧视 / 贬低、品牌对比、功效宣称、迷信、绝对化用语\n`));
    return;
  }
  console.log(red(`\n❌ 发现 ${findings.length} 处需要修改（${scope}）：\n`));
  for (const finding of findings) {
    console.log(`  [${finding.label}] ${finding.source}：…${finding.context}…`);
    console.log(dim(`     命中「${finding.match}」· ${finding.hint}`));
  }
  console.log('');
  process.exitCode = 1;
}

/**
 * 装载菜单与营养：有 Token 且未指定 --offline 时走实时 MCP，否则用样例快照
 * 联网返回 { source:'live', client, storeCode, storeName, items, nutrition }
 */
async function loadContext(flags, { requireLive = false } = {}) {
  loadEnvFile();
  const token = process.env.MCD_MCP_TOKEN ?? '';
  const tokenOk = token && token !== 'YOUR_MCP_TOKEN_HERE';
  const offline = flags.offline === true || !tokenOk;

  if (requireLive && offline) {
    throw new McpError('该命令需要真实调用麦当劳 MCP：请先在 .env 配置 MCD_MCP_TOKEN（且不要带 --offline）', { code: 'NO_TOKEN' });
  }

  if (offline) {
    const { items, store } = loadSampleMenu();
    return { source: 'sample', client: null, storeCode: store.storeCode, storeName: store.storeName, items, nutrition: loadSampleNutrition() };
  }

  const client = getClient(flags);
  await client.initialize();
  const storeCode = typeof flags.store === 'string' ? flags.store : null;
  if (!storeCode) {
    throw new McpError('联网模式需要指定门店：--store <门店编码>。可先用 node src/lab.mjs stores --city <城市> --keyword <地标> 查询', {
      code: 'NO_STORE',
    });
  }
  const menuData = await client.callToolData('query-meals', { storeCode, ...PICKUP });
  const items = normalizeMenuData(menuData);
  if (items.length === 0) {
    throw new McpError('实时菜单为空（门店编码有误或该门店当前不可点），可加 --debug 查看原始返回', { code: 'EMPTY_MENU' });
  }
  let nutrition = {};
  try {
    nutrition = parseNutritionData(await client.callToolData('list-nutrition-foods'));
  } catch (error) {
    console.error(yellow(`⚠️ 营养数据拉取失败（${error.message}），将跳过营养展示`));
  }
  return { source: 'live', client, storeCode, storeName: `门店 ${storeCode}`, items, nutrition };
}

function getClient(flags) {
  loadEnvFile();
  return new McdMcpClient({ token: process.env.MCD_MCP_TOKEN ?? '', debug: flags.debug === true });
}

/** 当前时间与推断场景：联网用 now-time-info（服务器时间），离线用本机时间 */
async function resolveClock(context) {
  if (context.source === 'live' && context.client) {
    try {
      const time = await context.client.callToolData('now-time-info');
      const formatted = String(time?.formatted ?? '');
      const hour = Number(formatted.slice(11, 13));
      const minute = Number(formatted.slice(14, 16));
      if (Number.isFinite(hour)) return { text: formatted.slice(11, 16), vibe: vibeFromHour(hour, minute) };
    } catch {
      /* 回退到本机时间 */
    }
  }
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return { text: `${pad(now.getHours())}:${pad(now.getMinutes())}`, vibe: vibeFromHour(now.getHours(), now.getMinutes()) };
}

/** 进行中 / 即将开始的活动（联网时从 campaign-calendar 读取，最多 3 条） */
async function resolveCampaigns(context) {
  if (context.source !== 'live' || !context.client) return [];
  try {
    const { text } = await context.client.callTool('campaign-calendar');
    return parseCampaignCalendar(text)
      .filter((block) => !block.status.includes('往期'))
      .flatMap((block) => block.titles.map((title) => ({ date: block.date, status: block.status, title })))
      .slice(0, 3);
  } catch {
    return [];
  }
}

/* ---------------- 通用小函数 ---------------- */

function buildCardData(recipe, context) {
  const { resolved } = validateRecipe(recipe, context.items);
  const price = sumPrice(resolved);
  const stats = sumNutrition(resolved, context.nutrition);
  return { resolved, price, stats, bill: mealBill(stats.kcal), source: context.source, storeName: context.storeName, generatedAt: new Date() };
}

function toOrderItems(resolved) {
  return resolved.map(({ item, quantity }) => ({ productCode: String(item.code), quantity: quantity ?? 1 }));
}

function printQuote(quote) {
  for (const line of quote.lines) {
    const strike = Number.isFinite(line.originalPrice) && line.originalPrice > line.price ? dim(`（原价 ${fmtMoney(line.originalPrice)}）`) : '';
    console.log(`  · ${line.name}　${fmtMoney(line.price ?? NaN)}${strike}`);
  }
  console.log(`  ${bold(`合计 ${fmtMoney(quote.subtotal)}`)}${quote.discount > 0 ? green(`　已优惠 ${fmtMoney(quote.discount)}`) : ''}`);
  if (quote.takeWayList.length > 0) {
    console.log(dim(`  取餐方式：${quote.takeWayList.map((t) => `${t.title}(${t.code})`).join(' / ')}`));
  }
}

function requireRecipe(flags) {
  const id = typeof flags.recipe === 'string' ? flags.recipe : null;
  const options = RECIPES.map((r) => r.id).join('、');
  if (!id) throw new McpError(`请用 --recipe <id> 指定隐藏吃法。可选：${options}`, { code: 'BAD_ARGS' });
  const recipe = getRecipe(id);
  if (!recipe) throw new McpError(`未找到隐藏吃法「${id}」。可选：${options}`, { code: 'BAD_ARGS' });
  return recipe;
}

function deepFindString(value, keys, depth = 3) {
  if (!value || typeof value !== 'object' || depth <= 0) return null;
  for (const key of keys) {
    const found = value[key];
    if (typeof found === 'string' && found) return found;
    if (typeof found === 'number') return String(found);
  }
  for (const nested of Object.values(value)) {
    const found = deepFindString(nested, keys, depth - 1);
    if (found) return found;
  }
  return null;
}

function groupBy(list, keyFn) {
  const groups = {};
  for (const item of list) (groups[keyFn(item)] ??= []).push(item);
  return groups;
}

function parseArgv(argv) {
  const [command = 'help', ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      index += 1;
    }
  }
  return { command, flags };
}

// 仅在直接运行（node src/lab.mjs）时执行 CLI；被 import 时不执行
const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    if (error instanceof McpError) {
      console.error(red(`\n❌ ${error.message}\n`));
      if (error.code === 'NO_TOKEN') {
        console.error(dim('   申请 Token：https://open.mcd.cn/mcp（手机号登录 → 控制台 → 激活）'));
        console.error(dim('   然后复制 .env.example 为 .env 并填入 Token；不联网也可以加 --offline 体验全部功能。\n'));
      }
      process.exitCode = 1;
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
}

export { parseArgv };

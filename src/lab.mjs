#!/usr/bin/env node
/**
 * 麦门隐藏菜单研究所 · CLI 入口
 *
 * 用法：node src/lab.mjs <命令> [选项]（或 npm run menu / npm run lab）
 * 命令：recipes / menu / lab / card / price / order / stores / demo / doctor
 *
 * 设计原则：零依赖；默认在缺少 Token 时自动降级为离线样例数据，保证任何人都能跑起来。
 */
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { McdMcpClient, McpError } from './mcp-client.mjs';
import { loadEnvFile, fmtMoney, fmtTime } from './util.mjs';
import {
  RECIPES,
  getRecipe,
  filterRecipes,
  validateRecipe,
  MECHANICS,
  DIFFICULTY_LABEL,
} from './recipes.mjs';
import { loadSampleMenu, loadSampleNutrition } from './sample.mjs';
import { sumNutrition, mealBill, nutritionLine, NUTRITION_DISCLAIMER } from './nutrition.mjs';
import { sumPrice, quoteViaMcp } from './pricing.mjs';
import { renderCardHtml, renderCardPage, printCardText, writeFileEnsured, REPO_URL } from './card.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = (text) => paint('1', text);
const dim = (text) => paint('2', text);
const red = (text) => paint('31', text);
const green = (text) => paint('32', text);
const yellow = (text) => paint('33', text);

const HELP = `
🍟 ${bold('麦门隐藏菜单研究所')} · MCD Secret Menu Lab

用法：mcd-lab <命令> [选项]

命令：
  recipes   查看隐藏吃法图鉴
  menu      查看门店菜单 + 今日可做的隐藏吃法
  lab       实验室：按预算 / 热量 / 场景筛选隐藏吃法方案
  card      生成「机密档案」配方卡（HTML / 文本）
  price     计算某个隐藏吃法的价格（联网时含优惠）
  order     下单某个隐藏吃法（默认仅预演，加 --yes 才真实下单）
  stores    按地址查询附近门店（联网）
  demo      生成演示页（docs/demo.html）
  doctor    环境自检（Token / 连通性 / 工具列表）

常用选项：
  --offline          强制使用内置样例数据（无需 Token）
  --json             以 JSON 输出（便于脚本 / Agent 调用）
  --debug            打印 MCP 请求细节
  --store <code>     指定门店编码（联网菜单 / 下单需要）
  --recipe <id>      指定隐藏吃法（见 recipes 命令）
  --budget <元>      预算上限（lab 命令）
  --calorie <kcal>   热量上限（lab 命令）
  --vibe <场景>      早餐 / 正餐 / 下午茶 / 夜宵（lab 命令）
  --difficulty <1-3> 最高难度（lab 命令）
  --tag <标签>       标签过滤（lab / recipes 命令）
  --out <path>       card / demo 命令的输出路径
  --mode <pickup|delivery>  就餐方式（price / order 命令）
  --address <地址>   stores 命令的查询地址

示例：
  node src/lab.mjs recipes
  node src/lab.mjs lab --budget 30 --vibe 夜宵
  node src/lab.mjs card --recipe fries-float
  node src/lab.mjs menu --store <门店编码>
  node src/lab.mjs order --recipe cola-float --store <门店编码> --yes
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
    const heat = '★'.repeat(recipe.heat);
    console.log(`  ${recipe.emoji} ${bold(recipe.name)} ${dim(`(${recipe.id})`)} —— ${recipe.tagline}`);
    console.log(
      dim(
        `     ${DIFFICULTY_LABEL[recipe.difficulty]} · ${MECHANICS[recipe.mechanic]} · ${recipe.vibes.join('/')} · 热度 ${heat} · 标签：${recipe.tags.join('、')}`,
      ),
    );
  }
  console.log(dim('\n  想直接生成配方卡：node src/lab.mjs card --recipe <id>\n'));
}

async function cmdMenu(flags) {
  const context = await loadContext(flags);
  const availability = RECIPES.map((recipe) => {
    const { ok, missing } = validateRecipe(recipe, context.items);
    return { id: recipe.id, name: recipe.name, ok, missing: missing.map((m) => m.name) };
  });

  if (flags.json) {
    console.log(
      JSON.stringify(
        { source: context.source, store: context.storeName, items: context.items, availability },
        null,
        2,
      ),
    );
    return;
  }

  console.log(bold(`\n📋 菜单 · ${context.storeName}`) + dim(`（${context.source === 'live' ? '实时数据' : '样例数据'}，共 ${context.items.length} 项）\n`));
  const byCategory = groupBy(context.items, (item) => item.category || '其他');
  for (const [category, items] of Object.entries(byCategory)) {
    console.log(`  ${bold(`【${category}】`)}`);
    for (const item of items) {
      console.log(`    ${item.name} ${dim(fmtMoney(item.priceYuan))}${item.code ? dim(` [${item.code}]`) : ''}`);
    }
  }
  const okCount = availability.filter((a) => a.ok).length;
  console.log(bold(`\n🧪 今日可做的隐藏吃法（${okCount}/${RECIPES.length}）：\n`));
  for (const entry of availability) {
    if (entry.ok) {
      console.log(`  ${green('✅')} ${entry.name} ${dim(`(${entry.id})`)}`);
    } else {
      console.log(`  ${red('❌')} ${entry.name} ${dim(`缺：${entry.missing.join('、')}`)}`);
    }
  }
  console.log('');
}

async function cmdLab(flags) {
  const context = await loadContext(flags);
  const rows = filterRecipes(
    {
      budget: flags.budget ? Number(flags.budget) : undefined,
      maxCalorie: flags.calorie ? Number(flags.calorie) : undefined,
      vibe: typeof flags.vibe === 'string' ? flags.vibe : undefined,
      difficulty: flags.difficulty ? Number(flags.difficulty) : undefined,
      tag: typeof flags.tag === 'string' ? flags.tag : undefined,
    },
    context.items,
    context.nutrition,
  );

  const top = rows.slice(0, 3);
  if (flags.json) {
    console.log(
      JSON.stringify(
        {
          source: context.source,
          constraints: { budget: flags.budget ?? null, calorie: flags.calorie ?? null, vibe: flags.vibe ?? null },
          results: top.map(({ recipe, price, kcal }) => ({
            id: recipe.id,
            name: recipe.name,
            tagline: recipe.tagline,
            ingredients: recipe.ingredients.map((i) => i.name),
            steps: recipe.steps,
            price,
            kcal,
            tags: recipe.tags,
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const constraints = [];
  if (flags.budget) constraints.push(`预算 ≤ ${fmtMoney(Number(flags.budget))}`);
  if (flags.calorie) constraints.push(`热量 ≤ ${flags.calorie} 千卡`);
  if (flags.vibe) constraints.push(`场景：${flags.vibe}`);
  console.log(bold('\n🧪 实验室报告') + dim(`（${constraints.length ? constraints.join(' · ') : '无约束，按麦门热度推荐'}）\n`));
  if (top.length === 0) {
    console.log(yellow('  没有符合条件的方案。试试放宽预算/热量，或去掉场景限制。\n'));
    return;
  }
  top.forEach(({ recipe, price, kcal }, index) => {
    console.log(`  ${bold(`方案 ${index + 1}：${recipe.emoji} ${recipe.name}`)} —— ${recipe.tagline}`);
    console.log(`     原料：${recipe.ingredients.map((i) => i.name).join(' + ')}`);
    console.log(`     估算：${fmtMoney(price ?? NaN)} · ${Number.isFinite(kcal) ? `${Math.round(kcal)} 千卡` : '热量未知'} · ${DIFFICULTY_LABEL[recipe.difficulty]}`);
    console.log(`     步骤：${recipe.steps.join(' → ')}`);
    console.log(dim(`     下单：node src/lab.mjs order --recipe ${recipe.id} --store <门店编码>`));
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
  const { resolved } = validateRecipe(recipe, context.items);
  const price = sumPrice(resolved, context.items);

  if (context.source === 'live' && context.client) {
    try {
      const quoted = await quoteViaMcp(context.client, {
        storeCode: context.storeCode,
        diningMode: normalizeMode(flags.mode),
        items: resolved.map(({ item }) => ({ code: item.code, quantity: 1 })),
      });
      console.log(bold(`\n💰 ${recipe.name} · 实时价格（含优惠）\n`));
      console.log('  ' + JSON.stringify(quoted).slice(0, 800));
      console.log('');
      return;
    } catch (error) {
      console.log(yellow(`\n⚠️ 实时算价失败（${error.message}），回退为本地估算：\n`));
    }
  }

  console.log(bold(`\n💰 ${recipe.name} · 本地估算（${context.source === 'live' ? '菜单为实时' : '样例数据'}）\n`));
  for (const line of price.lines) {
    console.log(`  · ${line.name}　${fmtMoney(line.price ?? NaN)}`);
  }
  console.log(`  ${bold(`合计约 ${fmtMoney(price.subtotal)}`)}`);
  console.log(dim('  提示：联网模式下会调用 MCP calculate-price，包含优惠券与配送费的准确结果。\n'));
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

  const items = resolved.map(({ item }) => ({ code: item.code, quantity: 1 }));
  const price = sumPrice(resolved, context.items);
  for (const line of price.lines) console.log(`  · ${line.name}　${fmtMoney(line.price ?? NaN)}`);
  console.log(`  ${bold(`合计约 ${fmtMoney(price.subtotal)}`)}`);
  console.log(`\n  ${bold('别忘了改造步骤：')}`);
  recipe.steps.forEach((step, index) => console.log(`    ${index + 1}. ${step}`));

  if (flags.yes !== true) {
    console.log(yellow('\n  这是预演（dry-run），没有真实下单。'));
    console.log(dim('  确认无误后加 --yes 执行真实下单（下单后仍需在麦当劳官方渠道完成支付）。\n'));
    return;
  }

  const payload = {
    storeCode: context.storeCode,
    diningMode: normalizeMode(flags.mode),
    items,
  };
  if (flags.debug) console.error('[order] payload =', JSON.stringify(payload));
  const result = await context.client.callToolJson('create-order', payload);
  const payUrl = deepFindString(result, ['payUrl', 'payLink', 'paymentUrl', 'orderUrl', 'url']);
  const orderId = deepFindString(result, ['orderId', 'orderNo', 'id']);
  console.log(green('\n  ✅ 订单已创建'));
  if (orderId) console.log(`  订单号：${orderId}`);
  if (payUrl) console.log(`  支付链接：${payUrl}`);
  console.log(dim('  请在麦当劳官方渠道完成支付；改造步骤（拆/夹/蘸/摇）需要你到手后自行完成 😉\n'));
}

async function cmdStores(flags) {
  if (typeof flags.address !== 'string') {
    throw new McpError('用法：node src/lab.mjs stores --address "你的地址"', { code: 'BAD_ARGS' });
  }
  const client = getClient(flags);
  await client.initialize();
  const raw = await client.callToolJson('query-nearby-stores', { address: flags.address });
  const stores = deepFindArray(raw, ['stores', 'list', 'items', 'data']) ?? [];
  if (flags.json) {
    console.log(JSON.stringify(stores, null, 2));
    return;
  }
  console.log(bold(`\n📍 附近门店（${flags.address}）\n`));
  for (const store of stores) {
    const name = firstString(store, ['storeName', 'name', 'title']) ?? '(未命名门店)';
    const code = firstString(store, ['storeCode', 'code', 'id']) ?? '';
    const addr = firstString(store, ['address', 'addr', 'storeAddress']) ?? '';
    console.log(`  · ${name} ${dim(code)} ${dim(addr)}`);
  }
  console.log(dim('\n  用门店编码继续：node src/lab.mjs menu --store <门店编码>\n'));
}

async function cmdDemo(flags) {
  const menu = loadSampleMenu();
  const nutrition = loadSampleNutrition();
  const dataMap = {};
  for (const recipe of RECIPES) {
    dataMap[recipe.id] = buildCardData(recipe, {
      items: menu.items,
      nutrition,
      source: 'sample',
      storeName: menu.store.storeName,
    });
  }
  const out = typeof flags.out === 'string' ? resolve(flags.out) : join(ROOT, 'docs', 'demo.html');
  writeFileEnsured(
    out,
    renderCardPage(RECIPES, dataMap, {
      note: '演示页使用内置样例数据生成（离线可用）；联网模式下所有数据来自麦当劳 MCP 实时返回。',
    }),
  );
  console.log(green(`✅ 演示页已生成 → ${out}`));
  console.log(dim('   可直接作为 GitHub Pages 首页或 README 截图素材。\n'));
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
  console.log(dim(`     ${tools.slice(0, 10).map((t) => t.name).join('、')}${tools.length > 10 ? ' …' : ''}\n`));
}

/* ---------------- 数据装载 ---------------- */

async function loadContext(flags, { requireLive = false } = {}) {
  const token = (loadEnvFile(), process.env.MCD_MCP_TOKEN ?? '');
  const tokenOk = token && token !== 'YOUR_MCP_TOKEN_HERE';
  const offline = flags.offline === true || !tokenOk;

  if (requireLive && offline) {
    throw new McpError('该命令需要真实调用麦当劳 MCP：请先在 .env 配置 MCD_MCP_TOKEN', { code: 'NO_TOKEN' });
  }

  if (offline) {
    const { items, store } = loadSampleMenu();
    return {
      source: 'sample',
      client: null,
      storeCode: store.storeCode,
      storeName: `${store.storeName}`,
      items,
      nutrition: loadSampleNutrition(),
    };
  }

  const client = getClient(flags);
  await client.initialize();
  const storeCode = typeof flags.store === 'string' ? flags.store : null;
  if (!storeCode) {
    throw new McpError(
      '联网模式需要指定门店：--store <门店编码>。可先用 node src/lab.mjs stores --address "你的地址" 查询',
      { code: 'NO_STORE' },
    );
  }
  const rawMenu = await client.callToolJson('query-meals', { storeCode });
  const items = normalizeMenuItems(rawMenu);
  if (items.length === 0) {
    throw new McpError('实时菜单为空（可能是门店编码有误或该门店当前不可点），可加 --debug 查看原始返回', { code: 'EMPTY_MENU' });
  }
  let nutrition = {};
  try {
    nutrition = normalizeNutrition(await client.callToolJson('list-nutrition-foods', {}));
  } catch (error) {
    console.error(yellow(`⚠️ 营养数据拉取失败（${error.message}），将跳过营养展示`));
  }
  return { source: 'live', client, storeCode, storeName: `门店 ${storeCode}`, items, nutrition };
}

function getClient(flags) {
  loadEnvFile();
  return new McdMcpClient({ token: process.env.MCD_MCP_TOKEN ?? '', debug: flags.debug === true });
}

/** 容错提取：从嵌套对象中找到第一个符合条件的数组 */
function deepFindArray(value, keys, depth = 3) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object' || depth <= 0) return null;
  for (const key of keys) {
    if (!(key in value)) continue;
    const found = deepFindArray(value[key], keys, depth - 1);
    if (found) return found;
  }
  for (const nested of Object.values(value)) {
    if (Array.isArray(nested) && nested.length > 0 && typeof nested[0] === 'object') return nested;
  }
  return null;
}

function deepFindString(value, keys, depth = 3) {
  if (!value || typeof value !== 'object' || depth <= 0) return null;
  for (const key of keys) {
    const found = value[key];
    if (typeof found === 'string' && found) return found;
  }
  for (const nested of Object.values(value)) {
    const found = deepFindString(nested, keys, depth - 1);
    if (found) return found;
  }
  return null;
}

function firstString(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    if (typeof value === 'string' && value) return value;
    if (typeof value === 'number') return String(value);
  }
  return null;
}

function firstNumber(object, keys) {
  for (const key of keys) {
    const value = object?.[key];
    const num = typeof value === 'string' ? Number(value) : value;
    if (Number.isFinite(num)) return num;
  }
  return null;
}

/** 容错归一化实时菜单（字段名以服务器实际返回为准，这里做多候选匹配） */
function normalizeMenuItems(raw) {
  const list = deepFindArray(raw, ['items', 'meals', 'products', 'mealList', 'productList', 'list', 'data']) ?? [];
  return list
    .map((entry) => ({
      code: firstString(entry, ['code', 'mealCode', 'productCode', 'skuCode', 'id']),
      name: firstString(entry, ['name', 'mealName', 'productName', 'skuName', 'title']),
      priceYuan: firstNumber(entry, ['priceYuan', 'price', 'salePrice', 'currentPrice', 'priceYuanCent']) ?? null,
      category: firstString(entry, ['category', 'categoryName', 'type', 'mealType']) ?? '',
    }))
    .filter((item) => item.name);
}

/** 容错归一化营养表 */
function normalizeNutrition(raw) {
  const list = deepFindArray(raw, ['foods', 'list', 'items', 'data']) ?? [];
  const map = {};
  for (const entry of list) {
    const name = firstString(entry, ['name', 'foodName', 'mealName', 'productName']);
    if (!name) continue;
    map[name] = {
      kcal: firstNumber(entry, ['kcal', 'energy', 'calorie', 'energyKcal', 'calories']),
      protein: firstNumber(entry, ['protein', 'proteinG', 'proteinGram']),
      fat: firstNumber(entry, ['fat', 'fatG', 'fatGram']),
      carb: firstNumber(entry, ['carb', 'carbohydrate', 'carbohydrateG', 'carbGram']),
      sodium: firstNumber(entry, ['sodium', 'sodiumMg', 'na']),
    };
  }
  return map;
}

/* ---------------- 通用小函数 ---------------- */

function buildCardData(recipe, context) {
  const { resolved } = validateRecipe(recipe, context.items);
  const price = sumPrice(resolved, context.items);
  const stats = sumNutrition(resolved, context.nutrition);
  return {
    resolved,
    price,
    stats,
    bill: mealBill(stats.kcal),
    source: context.source,
    storeName: context.storeName,
    generatedAt: new Date(),
  };
}

function requireRecipe(flags) {
  const id = typeof flags.recipe === 'string' ? flags.recipe : null;
  if (!id) {
    throw new McpError(`请用 --recipe <id> 指定隐藏吃法。可选：${RECIPES.map((r) => r.id).join('、')}`, {
      code: 'BAD_ARGS',
    });
  }
  const recipe = getRecipe(id);
  if (!recipe) {
    throw new McpError(`未找到隐藏吃法「${id}」。可选：${RECIPES.map((r) => r.id).join('、')}`, {
      code: 'BAD_ARGS',
    });
  }
  return recipe;
}

function normalizeMode(mode) {
  return mode === 'delivery' ? 'delivery' : 'pickup';
}

function groupBy(list, keyFn) {
  const groups = {};
  for (const item of list) {
    const key = keyFn(item);
    (groups[key] ??= []).push(item);
  }
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
        console.error(dim('   然后复制 .env.example 为 .env 并填入 Token；不联网也可以先加 --offline 体验全部功能。\n'));
      }
      process.exitCode = 1;
      return;
    }
    console.error(error);
    process.exitCode = 1;
  });
}

export { parseArgv, normalizeMenuItems, normalizeNutrition, deepFindArray };

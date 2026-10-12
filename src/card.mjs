/**
 * 配方卡渲染 —— 「实验室机密档案」风格
 * - renderCardHtml：单张卡片的独立 HTML（自包含样式，可离线打开、截图晒图）
 * - renderCardPage：多张卡片的演示页（docs/demo.html，可挂 GitHub Pages）
 * - printCardText：纯文本版（终端 / Agent 使用）
 *
 * 样式说明：所有资源内联，不引用任何外部字体/图片；不包含麦当劳商标元素。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { MECHANICS, DIFFICULTY_LABEL } from './recipes.mjs';
import { nutritionLine, NUTRITION_DISCLAIMER } from './nutrition.mjs';
import { fmtMoney } from './util.mjs';

export const REPO_URL = 'https://github.com/wangwengao/mcd-secret-menu-lab';

const DISCLAIMER =
  '本卡片由粉丝开源项目「麦门隐藏菜单研究所」生成，非麦当劳官方内容；餐品信息、价格与供应状态以麦当劳官方渠道为准。';

const CARD_CSS = `
.card{width:420px;max-width:100%;background:var(--paper);border-radius:14px;padding:22px 22px 16px;position:relative;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35);color:var(--ink);font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}
.card::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(46,74,52,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(46,74,52,.06) 1px,transparent 1px);background-size:22px 22px;pointer-events:none;}
.card__header{display:flex;justify-content:space-between;gap:8px;font-family:ui-monospace,Consolas,monospace;font-size:11px;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;border-bottom:1.5px dashed var(--line);padding-bottom:10px;}
.stamp{position:absolute;top:46px;right:-30px;transform:rotate(12deg);border:2px solid var(--red);color:var(--red);font-weight:800;letter-spacing:.3em;padding:6px 36px;opacity:.72;font-size:12px;}
.hero{margin-top:14px;display:flex;gap:12px;align-items:flex-start;}
.hero .emoji{font-size:40px;line-height:1;}
.hero h1{font-size:26px;letter-spacing:.02em;margin:0;}
.tagline{color:var(--muted);margin-top:4px;font-size:13px;}
.meta{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0 0;}
.chip{font-size:11px;border:1px solid var(--line);background:rgba(255,255,255,.5);padding:3px 8px;border-radius:999px;}
.chip--red{border-color:var(--red);color:var(--red);}
.sec{margin-top:14px;}
.sec h2{font-size:11px;letter-spacing:.18em;color:var(--green);border-left:3px solid var(--gold);padding-left:6px;margin:0 0 8px;}
.card table{width:100%;font-size:13px;border-collapse:collapse;}
.card td{padding:4px 0;border-bottom:1px dotted var(--line);}
td.num{text-align:right;font-family:ui-monospace,Consolas,monospace;white-space:nowrap;}
tr.total td{font-weight:700;border-bottom:none;}
ol.steps{margin:0;padding-left:18px;font-size:13px;line-height:1.75;}
.stats{display:flex;gap:14px;flex-wrap:wrap;font-family:ui-monospace,Consolas,monospace;font-size:12px;align-items:baseline;}
.stats b{font-size:15px;}
.bill{font-size:12px;color:var(--muted);margin-top:6px;}
.story{font-size:12.5px;color:#4a5244;line-height:1.7;margin:0;}
.tip{font-size:12.5px;background:rgba(255,255,255,.45);border:1px dashed var(--line);border-radius:8px;padding:8px 10px;margin-top:8px;}
.card__footer{margin-top:14px;border-top:1.5px dashed var(--line);padding-top:10px;font-size:10.5px;color:var(--muted);line-height:1.6;}
.card__footer a{color:var(--green);}
`;

const PAGE_CSS = `
:root{--paper:#f6efdc;--ink:#232a21;--muted:#6b7263;--red:#c8102e;--gold:#e8a800;--green:#2e4a34;--line:#d8cfb6;}
*{box-sizing:border-box;}
body{margin:0;background:#20301f;background-image:linear-gradient(rgba(246,239,220,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(246,239,220,.045) 1px,transparent 1px);background-size:26px 26px;color:var(--paper);font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}
.page{max-width:1440px;margin:0 auto;padding:40px 20px 60px;}
.page-hero{text-align:center;margin-bottom:8px;}
.kicker{font-family:ui-monospace,Consolas,monospace;letter-spacing:.4em;color:var(--gold);font-size:12px;margin:0 0 10px;}
.page-hero h1{font-size:34px;margin:0 0 10px;letter-spacing:.04em;}
.page-hero p{color:#cfd6c6;margin:4px 0;font-size:14px;}
.page-note{font-size:12px;color:#9aa892;}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:26px;justify-items:center;margin-top:32px;}
.page-footer{max-width:900px;margin:48px auto 0;text-align:center;font-size:12px;color:#9aa892;line-height:1.8;}
.page-footer a{color:var(--gold);}
@media (max-width:480px){.grid{grid-template-columns:1fr;}.card{width:100%;}}
.toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center;margin:26px auto 0;max-width:1100px;}
.chips{display:flex;gap:6px;flex-wrap:wrap;}
.tchip{border:1px solid rgba(246,239,220,.35);background:transparent;color:var(--paper);border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit;}
.tchip--on{background:var(--gold);color:#20301f;border-color:var(--gold);font-weight:700;}
.search{border:1px solid rgba(246,239,220,.35);background:rgba(0,0,0,.25);color:var(--paper);border-radius:999px;padding:7px 14px;font-size:13px;min-width:220px;outline:none;font-family:inherit;}
.search::placeholder{color:#9aa892;}
.btn{display:inline-block;border:1px solid rgba(246,239,220,.35);background:transparent;color:var(--paper);border-radius:999px;padding:7px 14px;font-size:13px;cursor:pointer;text-decoration:none;font-family:inherit;}
.btn--primary{background:var(--red);border-color:var(--red);color:#fff;font-weight:700;}
.btn--ghost{font-size:12px;padding:5px 10px;}
.count{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:#9aa892;}
.slot{display:flex;flex-direction:column;align-items:center;gap:10px;}
.slot[hidden]{display:none;}
.slot__actions{display:flex;gap:8px;}
.slot--hit .card{outline:3px solid var(--gold);animation:pulse 1.2s ease-out 1;}
@keyframes pulse{0%{transform:scale(1)}30%{transform:scale(1.03)}100%{transform:scale(1)}}
.slot__text{display:none;}
`;

/**
 * 渲染单张配方卡
 * @param {object} recipe 配方（src/recipes.mjs）
 * @param {object} data 计算数据 { resolved, price, stats, bill, source, storeName, generatedAt }
 * @param {{standalone?: boolean}} [options] standalone=true 时输出完整 HTML 文档
 */
export function renderCardHtml(recipe, data = {}, { standalone = true } = {}) {
  const fragment = renderCardFragment(recipe, data);
  if (!standalone) return fragment;
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(recipe.name)} · 麦门隐藏菜单研究所</title>
<style>:root{--paper:#f6efdc;--ink:#232a21;--muted:#6b7263;--red:#c8102e;--gold:#e8a800;--green:#2e4a34;--line:#d8cfb6;}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#20301f;background-image:linear-gradient(rgba(246,239,220,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(246,239,220,.05) 1px,transparent 1px);background-size:26px 26px;padding:24px;}
${CARD_CSS}</style>
</head>
<body>
${fragment}
</body>
</html>
`;
}

/** 渲染卡片片段（供演示页复用） */
export function renderCardFragment(recipe, data = {}) {
  const {
    resolved = [],
    price = null,
    stats = null,
    bill = null,
    source = 'sample',
    generatedAt = new Date(),
  } = data;

  const lines =
    price?.lines?.length > 0
      ? price.lines
      : resolved.map(({ ingredient, item }) => ({
          name: item?.name ?? ingredient.name,
          price: Number.isFinite(item?.priceYuan) ? item.priceYuan : null,
        }));
  const subtotal = price?.subtotal ?? lines.reduce((sum, l) => sum + (Number.isFinite(l.price) ? l.price : 0), 0);

  const ingredientRows = lines
    .map(
      (line) =>
        `<tr><td>${esc(line.name)}</td><td class="num">${Number.isFinite(line.price) ? esc(fmtMoney(line.price)) : '—'}</td></tr>`,
    )
    .join('');

  const steps = recipe.steps.map((step) => `<li>${esc(step)}</li>`).join('');
  const heat = `${'★'.repeat(recipe.heat)}${'☆'.repeat(Math.max(0, 5 - recipe.heat))}`;
  const billText = bill ? `约等于散步 ${bill.walkMin} 分钟，或慢跑 ${bill.jogMin} 分钟` : '';
  const dateText = formatDate(generatedAt);
  const sourceText = source === 'live' ? '实时菜单' : '快照（演示）';

  return `<article class="card">
  <div class="stamp">SECRET</div>
  <header class="card__header">
    <span>Secret Menu Lab · 机密档案</span>
    <span>No.SML-${recipeNo(recipe.id)}</span>
  </header>
  <div class="hero">
    <div class="emoji">${esc(recipe.emoji)}</div>
    <div>
      <h1>${esc(recipe.name)}</h1>
      <div class="tagline">${esc(recipe.tagline)}</div>
    </div>
  </div>
  <div class="meta">
    <span class="chip chip--red">${esc(DIFFICULTY_LABEL[recipe.difficulty] ?? '未知难度')}</span>
    <span class="chip">机制 · ${esc(MECHANICS[recipe.mechanic] ?? recipe.mechanic)}</span>
    <span class="chip">${esc(recipe.vibes.join(' / '))}</span>
    <span class="chip">麦门热度 ${esc(heat)}</span>
  </div>
  <section class="sec">
    <h2>原料清单</h2>
    <table>
      ${ingredientRows}
      <tr class="total"><td>合计</td><td class="num">${esc(fmtMoney(subtotal))}</td></tr>
    </table>
  </section>
  <section class="sec">
    <h2>改造步骤</h2>
    <ol class="steps">${steps}</ol>
  </section>
  <section class="sec">
    <h2>营养快照</h2>
    <div class="stats">${statsMarkup(stats)}</div>
    ${billText ? `<div class="bill">🔥 热量账单：${esc(billText)}（估算，仅供参考）</div>` : ''}
  </section>
  <section class="sec">
    <h2>麦门笔记</h2>
    <p class="story">${esc(recipe.story)}</p>
    <div class="tip">💡 ${esc(recipe.tip)}</div>
  </section>
  <footer class="card__footer">
    ${esc(DISCLAIMER)}<br>
    生成时间 ${esc(dateText)} · 数据来源：${esc(sourceText)} · <a href="${REPO_URL}">${esc(REPO_URL.replace('https://', ''))}</a>
  </footer>
</article>`;
}

/** 渲染演示页（docs/demo.html）：零安装的交互体验 —— 场景 / 难度筛选、搜索、随机抽取、一键复制文字版 */
export function renderCardPage(recipes, dataMap = {}, { title = '麦门隐藏菜单研究所', subtitle = '', note = '' } = {}) {
  const slots = recipes
    .map((recipe) => {
      const data = dataMap[recipe.id] ?? {};
      const searchText = [recipe.name, recipe.tagline, ...recipe.tags, ...recipe.ingredients.map((i) => i.name)].join(' ');
      return `<div class="slot" data-id="${esc(recipe.id)}" data-vibes="${esc(recipe.vibes.join(','))}" data-difficulty="${recipe.difficulty}" data-search="${esc(searchText)}">
${renderCardFragment(recipe, data)}
<div class="slot__actions">
  <button type="button" class="btn btn--ghost" data-copy="${esc(recipe.id)}">📋 复制文字版</button>
  <a class="btn btn--ghost" href="${REPO_URL}#快速开始" target="_blank" rel="noopener">⌘ 用 CLI 算价 / 下单</a>
</div>
<textarea class="slot__text" aria-hidden="true">${esc(printCardText(recipe, data))}</textarea>
</div>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · MCD Secret Menu Lab</title>
<meta name="description" content="用麦当劳真实在售餐品组合隐藏吃法：筛选、随机抽取、复制配方，基于麦当劳 MCP。">
<style>
:root{--paper:#f6efdc;--ink:#232a21;--muted:#6b7263;--red:#c8102e;--gold:#e8a800;--green:#2e4a34;--line:#d8cfb6;}
${PAGE_CSS}
${CARD_CSS}
</style>
</head>
<body>
<div class="page">
  <header class="page-hero">
    <p class="kicker">SECRET MENU LAB</p>
    <h1>${esc(title)}</h1>
    <p>${esc(subtitle || '用麦当劳真实在售餐品组合隐藏吃法 · 自动算营养价格 · 一键下单')}</p>
    ${note ? `<p class="page-note">${esc(note)}</p>` : ''}
  </header>
  <section class="toolbar" aria-label="筛选与抽取">
    <div class="chips" data-group="vibe">
      <button type="button" class="tchip tchip--on" data-v="">全部场景</button>
      <button type="button" class="tchip" data-v="早餐">🌅 早餐</button>
      <button type="button" class="tchip" data-v="正餐">🍔 正餐</button>
      <button type="button" class="tchip" data-v="下午茶">☕ 下午茶</button>
      <button type="button" class="tchip" data-v="夜宵">🌙 夜宵</button>
    </div>
    <div class="chips" data-group="difficulty">
      <button type="button" class="tchip tchip--on" data-d="">全部难度</button>
      <button type="button" class="tchip" data-d="1">新手友好</button>
      <button type="button" class="tchip" data-d="2">进阶玩家</button>
      <button type="button" class="tchip" data-d="3">地狱试炼</button>
    </div>
    <input class="search" type="search" placeholder="搜原料或吃法，如：圆筒 / 鸡块" aria-label="搜索">
    <button type="button" class="btn btn--primary" id="random">🎲 今天吃什么？随机来一道</button>
    <span class="count" id="count"></span>
  </section>
  <main class="grid" id="grid">
${slots}
  </main>
  <footer class="page-footer">
    ${esc(DISCLAIMER)}<br>
    开源项目 · <a href="${REPO_URL}">${esc(REPO_URL)}</a> · 基于麦当劳 MCP 构建 · 本页纯静态，不发起任何网络请求
  </footer>
</div>
<script>
(function () {
  var slots = Array.prototype.slice.call(document.querySelectorAll('.slot'));
  var state = { vibe: '', difficulty: '', q: '' };
  var count = document.getElementById('count');
  function apply() {
    var shown = 0;
    slots.forEach(function (s) {
      var okV = !state.vibe || s.getAttribute('data-vibes').split(',').indexOf(state.vibe) >= 0;
      var okD = !state.difficulty || s.getAttribute('data-difficulty') === state.difficulty;
      var okQ = !state.q || s.getAttribute('data-search').toLowerCase().indexOf(state.q) >= 0;
      var on = okV && okD && okQ;
      if (on) { s.removeAttribute('hidden'); shown += 1; } else { s.setAttribute('hidden', ''); }
    });
    count.textContent = '显示 ' + shown + ' / ' + slots.length + ' 道';
  }
  function bindChips(attr, key) {
    var chips = Array.prototype.slice.call(document.querySelectorAll('[' + attr + ']'));
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        state[key] = chip.getAttribute(attr);
        chips.forEach(function (c) { c.classList.toggle('tchip--on', c === chip); });
        apply();
      });
    });
  }
  bindChips('data-v', 'vibe');
  bindChips('data-d', 'difficulty');
  document.querySelector('.search').addEventListener('input', function (e) {
    state.q = e.target.value.trim().toLowerCase();
    apply();
  });
  document.getElementById('random').addEventListener('click', function () {
    var visible = slots.filter(function (s) { return !s.hasAttribute('hidden'); });
    if (!visible.length) return;
    slots.forEach(function (s) { s.classList.remove('slot--hit'); });
    var pick = visible[Math.floor(Math.random() * visible.length)];
    pick.classList.add('slot--hit');
    pick.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  Array.prototype.slice.call(document.querySelectorAll('[data-copy]')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var text = btn.closest('.slot').querySelector('.slot__text').value;
      var done = function (ok) {
        btn.textContent = ok ? '✅ 已复制' : '❌ 复制失败';
        setTimeout(function () { btn.textContent = '📋 复制文字版'; }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
      } else { done(false); }
    });
  });
  var hash = decodeURIComponent(location.hash.slice(1));
  if (hash === 'random') { document.getElementById('random').click(); }
  apply();
})();
</script>
</body>
</html>
`;
}

/** 纯文本版配方卡（终端 / Agent 使用） */
export function printCardText(recipe, data = {}) {
  const { resolved = [], price = null, stats = null, bill = null } = data;
  const lines =
    price?.lines?.length > 0
      ? price.lines
      : resolved.map(({ ingredient, item }) => ({
          name: item?.name ?? ingredient.name,
          price: Number.isFinite(item?.priceYuan) ? item.priceYuan : null,
        }));
  const subtotal = price?.subtotal ?? lines.reduce((sum, l) => sum + (Number.isFinite(l.price) ? l.price : 0), 0);
  const out = [];
  out.push('━'.repeat(46));
  out.push(`📁 麦门隐藏菜单研究所 · 机密档案 No.SML-${recipeNo(recipe.id)}`);
  out.push(`${recipe.emoji} ${recipe.name} —— ${recipe.tagline}`);
  out.push(`难度：${DIFFICULTY_LABEL[recipe.difficulty] ?? '?'} · 机制：${MECHANICS[recipe.mechanic] ?? recipe.mechanic} · 场景：${recipe.vibes.join('/')} · 热度：${'★'.repeat(recipe.heat)}`);
  out.push('');
  out.push('原料：');
  for (const line of lines) {
    out.push(`  · ${line.name}${Number.isFinite(line.price) ? `　${fmtMoney(line.price)}` : ''}`);
  }
  out.push(`  合计：${fmtMoney(subtotal)}`);
  out.push('');
  out.push('改造步骤：');
  recipe.steps.forEach((step, index) => out.push(`  ${index + 1}. ${step}`));
  out.push('');
  out.push(`营养：${nutritionLine(stats)}`);
  if (bill) out.push(`热量账单：散步约 ${bill.walkMin} 分钟 / 慢跑约 ${bill.jogMin} 分钟（估算）`);
  out.push(`老饕提示：${recipe.tip}`);
  out.push('━'.repeat(46));
  return out.join('\n');
}

/** 写文件（自动建目录） */
export function writeFileEnsured(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
}

function statsMarkup(stats) {
  if (!stats || stats.kcal === null) return '<span>营养数据待补全</span>';
  const cells = [
    `<span><b>${Math.round(stats.kcal)}</b> 千卡</span>`,
    Number.isFinite(stats.protein) ? `<span>蛋白质 <b>${Math.round(stats.protein)}</b>g</span>` : '',
    Number.isFinite(stats.fat) ? `<span>脂肪 <b>${Math.round(stats.fat)}</b>g</span>` : '',
    Number.isFinite(stats.sodium) ? `<span>钠 <b>${Math.round(stats.sodium)}</b>mg</span>` : '',
  ];
  return cells.filter(Boolean).join('');
}

function recipeNo(id) {
  let hash = 5381;
  for (const char of String(id)) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return String(hash % 10000).padStart(4, '0');
}

function formatDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

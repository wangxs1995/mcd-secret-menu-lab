/**
 * 麦当劳 MCP 返回解析（根据真实返回形态编写）
 *
 * 实测工具返回文本有三种形态：
 * 1. 纯 JSON 文本
 * 2. 「# API Response Information … ## Original Response {json}」—— 说明文字 + JSON
 * 3. 展示指引文字中夹着一段 JSON（前后都有文字）
 *
 * 另外，大列表类工具（如 list-nutrition-foods）的 data 字段是一个紧凑文本表格：
 *   [160]{productName,nutritionDescription,energyKj,energyKcal,protein,fat,carbohydrate,sodium,calcium}:
 *     猪柳麦满分,null,1288,308,16,16,24,781,213
 *     …
 */

/** 从任意文本中抽出第一个完整的 JSON 对象/数组（优先 {"success"…} 业务体） */
export function extractJson(text) {
  if (typeof text !== 'object' && typeof text !== 'string') return undefined;
  if (typeof text === 'object') return text;
  const trimmed = text.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const direct = tryParse(trimmed);
    if (direct !== undefined) return direct;
  }
  let start = text.indexOf('{"success"');
  if (start < 0) start = text.indexOf('{');
  while (start >= 0) {
    const end = findBalancedEnd(text, start);
    if (end > start) {
      const parsed = tryParse(text.slice(start, end + 1));
      if (parsed !== undefined) return parsed;
    }
    start = text.indexOf('{', start + 1);
  }
  return undefined;
}

/** 解析紧凑文本表格 `[N]{col1,col2,...}:\n  v1,v2,...` → { columns, rows } */
export function parseCompactTable(data) {
  if (typeof data !== 'string') return { columns: [], rows: [] };
  const header = data.match(/\{([^}]+)\}\s*:/);
  if (!header) return { columns: [], rows: [] };
  const columns = header[1].split(',').map((c) => c.trim()).filter(Boolean);
  const body = data.slice(header.index + header[0].length);
  const rows = [];
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const cells = line.split(',');
    if (cells.length < columns.length) continue;
    // 若首列（名称）里含逗号，多出来的单元格并回名称
    const extra = cells.length - columns.length;
    const name = cells.slice(0, extra + 1).join(',');
    const rest = cells.slice(extra + 1);
    const row = { [columns[0]]: name.trim() };
    columns.slice(1).forEach((col, index) => {
      const value = rest[index]?.trim();
      row[col] = value === undefined || value === 'null' || value === '' ? null : value;
    });
    rows.push(row);
  }
  return { columns, rows };
}

/** list-nutrition-foods 的 data → 名称→营养 映射（kcal / protein / fat / carb / sodium / calcium） */
export function parseNutritionData(data) {
  const { rows } = parseCompactTable(data);
  const map = {};
  for (const row of rows) {
    const name = row.productName;
    if (!name) continue;
    map[name] = {
      kcal: num(row.energyKcal),
      kj: num(row.energyKj),
      protein: num(row.protein),
      fat: num(row.fat),
      carb: num(row.carbohydrate),
      sodium: num(row.sodium),
      calcium: num(row.calcium),
      description: row.nutritionDescription ?? null,
    };
  }
  return map;
}

/** query-meals 的 data → 扁平餐品数组（按 code 去重，保留分类/标签/优惠类型） */
export function normalizeMenuData(data) {
  const out = [];
  const seen = new Set();
  for (const category of data?.categories ?? []) {
    const categoryName = String(category?.name ?? '其他').replace(/\s+/g, '');
    for (const entry of category?.meals ?? []) {
      const code = String(entry?.code ?? '');
      if (!code || seen.has(code)) continue;
      const detail = data?.meals?.[code] ?? {};
      if (!detail.name) continue;
      seen.add(code);
      out.push({
        code,
        name: detail.name,
        priceYuan: num(detail.currentPrice),
        originalPrice: num(detail.originalPrice),
        category: categoryName,
        tags: Array.isArray(entry?.tags) ? entry.tags : [],
        discountType: detail.discountType ?? null,
        image: detail.image ?? null,
      });
    }
  }
  return out;
}

/** campaign-calendar 返回的 Markdown 文本 → [{ date, status, titles }] */
export function parseCampaignCalendar(text) {
  if (typeof text !== 'string') return [];
  const blocks = text.split(/\n(?=####\s)/);
  const result = [];
  for (const block of blocks) {
    const head = block.match(/^####\s*([^\n]*)/);
    if (!head) continue;
    const headText = head[1].trim();
    const dateMatch = headText.match(/(\d{4}年\d{1,2}月\d{1,2}日)/);
    const status = headText.replace(dateMatch?.[1] ?? '', '').trim();
    const titles = [...block.matchAll(/\*\*活动标题\*\*[:：]\s*([^\n]+)/g)].map((m) => m[1].trim());
    if (titles.length === 0) continue;
    result.push({ date: dateMatch?.[1] ?? headText, status, titles });
  }
  return result;
}

/** 业务体校验：success=false 时返回错误信息，否则返回 data */
export function unwrapBusiness(body, toolName = 'MCP') {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    if ('success' in body && body.success === false) {
      const message = body.message ?? body.msg ?? `code ${body.code ?? '?'}`;
      const error = new Error(`${toolName} 业务失败：${message}`);
      error.code = 'BIZ_ERROR';
      error.detail = body;
      throw error;
    }
    if ('data' in body) return body.data;
  }
  return body;
}

function findBalancedEnd(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function num(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

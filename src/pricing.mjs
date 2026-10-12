/**
 * 价格计算
 * - 离线：按样例菜单价格求和（演示）
 * - 联网：调用麦当劳 MCP 的 calculate-price（金额单位为分，这里统一换算成元）
 */

/**
 * 本地小计（按数量累加）
 * @param {Array<{ingredient: object, item: object, quantity?: number}>} resolved
 */
export function sumPrice(resolved) {
  const lines = [];
  let subtotal = 0;
  let unknown = 0;
  for (const { ingredient, item, quantity = 1 } of resolved) {
    const unit = Number.isFinite(item?.priceYuan) ? item.priceYuan : null;
    const name = `${item?.name ?? ingredient.name}${quantity > 1 ? ` ×${quantity}` : ''}`;
    if (unit === null) {
      unknown += 1;
      lines.push({ name, price: null, quantity });
    } else {
      const price = unit * quantity;
      subtotal += price;
      lines.push({ name, price, quantity, originalPrice: Number.isFinite(item?.originalPrice) ? item.originalPrice * quantity : null });
    }
  }
  return { subtotal, lines, unknown, source: 'local' };
}

/**
 * 联网价格：MCP calculate-price（到店自取：orderType=1 / beType=1）
 * @param {import('./mcp-client.mjs').McdMcpClient} client
 * @param {{storeCode: string, items: Array<{productCode: string, quantity: number}>, orderType?: number, beType?: number, beCode?: string}} params
 * @returns {Promise<{subtotal: number, originalPrice: number, discount: number, lines: Array, takeWayList: Array, raw: object, source: 'mcp'}>}
 */
export async function quoteViaMcp(client, { storeCode, items, orderType = 1, beType = 1, beCode } = {}) {
  const args = { storeCode, orderType, beType, items };
  if (beCode) args.beCode = beCode;
  const data = await client.callToolData('calculate-price', args);
  const cents = (value) => (Number.isFinite(Number(value)) ? Number(value) / 100 : null);
  return {
    subtotal: cents(data?.price) ?? 0,
    originalPrice: cents(data?.originalPrice) ?? 0,
    discount: cents(data?.discount) ?? 0,
    lines: (data?.productList ?? []).map((line) => ({
      name: `${line.productName ?? line.productCode}${line.quantity > 1 ? ` ×${line.quantity}` : ''}`,
      price: cents(line.subtotal),
      originalPrice: cents(line.originalSubtotal),
      quantity: line.quantity ?? 1,
      productCode: line.productCode,
    })),
    takeWayList: Array.isArray(data?.takeWayList) ? data.takeWayList : [],
    raw: data,
    source: 'mcp',
  };
}

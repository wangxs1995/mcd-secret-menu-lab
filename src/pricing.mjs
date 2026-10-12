/**
 * 价格计算
 * - 离线：按样例菜单价格求和（演示）
 * - 联网：调用麦当劳 MCP 的 calculate-price 计算含优惠的真实价格
 */
import { priceOf } from './recipes.mjs';

/**
 * 离线小计
 * @param {Array<{ingredient: object, item: object}>} resolved
 * @param {Array|object} prices 菜单数组或 名称→价格 映射
 */
export function sumPrice(resolved, prices) {
  const lines = [];
  let subtotal = 0;
  let unknown = 0;
  for (const { ingredient, item } of resolved) {
    const price = Number.isFinite(item?.priceYuan) ? item.priceYuan : priceOf(ingredient, prices);
    if (Number.isFinite(price)) {
      subtotal += price;
      lines.push({ name: item?.name ?? ingredient.name, price });
    } else {
      unknown += 1;
      lines.push({ name: item?.name ?? ingredient.name, price: null });
    }
  }
  return { subtotal, lines, unknown };
}

/**
 * 联网价格：调用 MCP calculate-price（含优惠券与配送费）
 * 注：参数按麦当劳 MCP 工具约定拼装；返回结构以服务器实时返回为准。
 * @param {import('./mcp-client.mjs').McdMcpClient} client
 * @param {object} params
 * @param {string} params.storeCode
 * @param {'delivery'|'pickup'} [params.diningMode]
 * @param {Array<{code: string, quantity: number}>} params.items
 * @param {string[]} [params.couponIds]
 */
export async function quoteViaMcp(client, { storeCode, diningMode = 'pickup', items, couponIds } = {}) {
  const args = { storeCode, diningMode, items };
  if (couponIds?.length) args.couponIds = couponIds;
  return client.callToolJson('calculate-price', args);
}

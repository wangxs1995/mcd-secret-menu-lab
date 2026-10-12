/**
 * 麦当劳 MCP Server 极简客户端（Streamable HTTP 传输）
 *
 * - 零依赖：基于 Node.js >= 18 原生 fetch
 * - 协议：MCP 2025-06-18（https://modelcontextprotocol.io）
 * - 接入地址：https://mcp.mcd.cn（详见仓库 mcp-config.example.json）
 *
 * 典型用法：
 *   const client = new McdMcpClient({ token: process.env.MCD_MCP_TOKEN });
 *   await client.initialize();
 *   const tools = await client.listTools();
 *   const meals = await client.callToolJson('query-meals', { storeCode: '...' });
 */

const DEFAULT_ENDPOINT = 'https://mcp.mcd.cn';
const PROTOCOL_VERSION = '2025-06-18';
const CLIENT_INFO = { name: 'mcd-secret-menu-lab', version: '0.2.0' };

import { extractJson, unwrapBusiness } from './mcp-parse.mjs';

/** MCP 调用相关错误（含用户可读的中文提示） */
export class McpError extends Error {
  constructor(message, { code = 'MCP_ERROR', httpStatus = null, detail = null } = {}) {
    super(message);
    this.name = 'McpError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.detail = detail;
  }
}

export class McdMcpClient {
  /**
   * @param {object} options
   * @param {string} [options.endpoint] MCP 接入地址，默认 https://mcp.mcd.cn
   * @param {string} [options.token]    麦当劳 MCP Token（Bearer）
   * @param {number} [options.timeoutMs] 单次请求超时，默认 30s
   * @param {boolean} [options.debug]   打印请求/响应摘要到 stderr
   */
  constructor({ endpoint = DEFAULT_ENDPOINT, token = '', timeoutMs = 30_000, debug = false } = {}) {
    this.endpoint = endpoint;
    this.token = token;
    this.timeoutMs = timeoutMs;
    this.debug = debug;
    this.sessionId = null;
    this.serverInfo = null;
    this._nextId = 1;
    this._initialized = false;
  }

  /** 是否已配置 Token */
  get hasToken() {
    return typeof this.token === 'string' && this.token.trim().length > 0;
  }

  /** 建立会话：initialize + notifications/initialized */
  async initialize() {
    if (!this.hasToken) {
      throw new McpError(
        '缺少 MCD_MCP_TOKEN。请复制 .env.example 为 .env 并填入 Token（申请地址 https://open.mcd.cn/mcp）',
        { code: 'NO_TOKEN' },
      );
    }
    const result = await this._rpc('initialize', {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: CLIENT_INFO,
    });
    this.serverInfo = result?.serverInfo ?? null;
    await this._notify('notifications/initialized');
    this._initialized = true;
    return this.serverInfo;
  }

  /** 列出服务器提供的全部工具 */
  async listTools() {
    await this._ensureInitialized();
    const result = await this._rpc('tools/list', {});
    return result?.tools ?? [];
  }

  /** 调用工具，返回 { text, structured, raw } */
  async callTool(name, args = {}) {
    await this._ensureInitialized();
    const result = await this._rpc('tools/call', { name, arguments: args });
    const content = Array.isArray(result?.content) ? result.content : [];
    const text = content
      .filter((c) => c?.type === 'text')
      .map((c) => c.text)
      .join('\n');
    if (result?.isError) {
      throw new McpError(`工具 ${name} 调用失败：${text.slice(0, 300)}`, { code: 'TOOL_ERROR' });
    }
    return { text, structured: tryJson(text), raw: result };
  }

  /** 调用工具并解析 JSON（麦当劳 MCP 的返回常为「说明文字 + JSON」混合文本，这里做容错抽取） */
  async callToolJson(name, args = {}) {
    const { text } = await this.callTool(name, args);
    const data = extractJson(text);
    if (data === undefined) {
      throw new McpError(`工具 ${name} 的返回中找不到 JSON`, { code: 'BAD_JSON', detail: text.slice(0, 300) });
    }
    return data;
  }

  /** 调用工具并返回业务 data：自动校验 success / code，失败抛出可读错误 */
  async callToolData(name, args = {}) {
    const body = await this.callToolJson(name, args);
    try {
      return unwrapBusiness(body, name);
    } catch (error) {
      throw new McpError(error.message, { code: 'BIZ_ERROR', detail: error.detail ?? body });
    }
  }

  async _ensureInitialized() {
    if (!this._initialized) await this.initialize();
  }

  async _rpc(method, params) {
    const id = this._nextId++;
    const body = await this._post({ jsonrpc: '2.0', id, method, params }, { expectId: id });
    if (body?.error) {
      throw new McpError(`MCP 错误 ${body.error.code}：${body.error.message}`, { code: 'RPC_ERROR', detail: body.error });
    }
    return body?.result;
  }

  async _notify(method, params) {
    await this._post({ jsonrpc: '2.0', method, params }, { expectId: null });
  }

  /**
   * 发送一次 JSON-RPC 消息。返回匹配 expectId 的响应对象；
   * 通知（expectId 为 null）返回 undefined。
   */
  async _post(payload, { expectId, retries = 2 } = {}) {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };
    if (this.hasToken) headers.authorization = `Bearer ${this.token}`;
    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
      headers['mcp-protocol-version'] = PROTOCOL_VERSION;
    }
    if (this.debug) console.error('[mcp] →', JSON.stringify(payload).slice(0, 400));

    let attempt = 0;
    for (;;) {
      attempt += 1;
      let res;
      try {
        res = await fetch(this.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (err) {
        if (attempt <= retries) {
          await sleep(1000 * attempt);
          continue;
        }
        throw new McpError(`网络请求失败：${err.message}`, { code: 'NETWORK' });
      }

      // 会话 ID 由服务器在 initialize 响应头中下发，后续请求需要携带
      const sid = res.headers.get('mcp-session-id');
      if (sid) this.sessionId = sid;

      if (res.status === 401) {
        throw new McpError('MCP Token 无效或已过期（401）。请到 https://open.mcd.cn/mcp 检查或重新申请', {
          code: 'UNAUTHORIZED',
          httpStatus: 401,
        });
      }
      if (res.status === 429) {
        if (attempt <= retries) {
          const retryAfter = Number(res.headers.get('retry-after')) || 2;
          await sleep(retryAfter * 1000);
          continue;
        }
        throw new McpError('触发限流（429，单 Token 每分钟上限 600 次请求），请降低频率后重试', {
          code: 'RATE_LIMITED',
          httpStatus: 429,
        });
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new McpError(`MCP 请求失败：HTTP ${res.status} ${text.slice(0, 200)}`, {
          code: 'HTTP_ERROR',
          httpStatus: res.status,
        });
      }

      // 通知类请求服务器一般返回 202，无需解析响应体
      if (res.status === 202 || expectId === null) return undefined;

      const text = await res.text();
      if (this.debug) console.error('[mcp] ←', text.slice(0, 400));
      if (!text.trim()) throw new McpError('MCP 返回了空响应', { code: 'EMPTY' });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream')) {
        const message = parseSseForId(text, expectId);
        if (!message) {
          throw new McpError('SSE 响应中未找到匹配的 JSON-RPC 消息', { code: 'SSE_MISS' });
        }
        return message;
      }
      const parsed = tryJson(text);
      if (parsed === undefined) {
        throw new McpError('MCP 返回无法解析', { code: 'BAD_JSON', detail: text.slice(0, 200) });
      }
      return parsed;
    }
  }
}

/** 从 SSE 文本中解析出 id 匹配的 JSON-RPC 消息（导出以便单元测试） */
export function parseSseForId(text, expectId) {
  const events = text.split(/\r?\n\r?\n/);
  for (const event of events) {
    const dataLines = event
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    if (dataLines.length === 0) continue;
    const data = dataLines.join('\n');
    if (!data || data === '[DONE]') continue;
    const obj = tryJson(data);
    if (obj && obj.id === expectId) return obj;
  }
  return null;
}

function tryJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

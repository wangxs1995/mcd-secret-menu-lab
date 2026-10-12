/**
 * 通用小工具（零依赖）
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 极简 .env 读取：解析 KEY=VALUE 行并写入 process.env。
 * - 不覆盖已存在的环境变量（命令行传入优先）
 * - 文件不存在时静默返回
 * @returns {Record<string, string>} 本次实际写入的键值
 */
export function loadEnvFile(file = resolve(process.cwd(), '.env')) {
  const applied = {};
  if (!existsSync(file)) return applied;
  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) {
      process.env[key] = value;
      applied[key] = value;
    }
  }
  return applied;
}

/** 金额格式化：18.5 → ¥18.5；非法值 → — */
export function fmtMoney(value) {
  return Number.isFinite(value) ? `¥${(Math.round(value * 10) / 10).toFixed(1)}` : '—';
}

/** 数字格式化：1234 → 1,234 */
export function fmtNum(value) {
  return Number.isFinite(value) ? value.toLocaleString('zh-CN') : '—';
}

/** 本地时间 HH:mm */
export function fmtTime(date = new Date()) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

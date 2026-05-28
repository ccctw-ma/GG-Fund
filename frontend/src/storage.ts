import type { ExportedLocalData, Holding, WatchItem } from './types';

const HOLDINGS_KEY = 'gg-fund:holdings';
const WATCHLIST_KEY = 'gg-fund:watchlist';

type ParseResult = { ok: true; data: ExportedLocalData } | { ok: false; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;
const isNonNegativeNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function validateHolding(value: unknown, index: number): Holding | string {
  if (!isRecord(value)) return `第 ${index + 1} 条持仓格式不正确`;
  if (!isString(value.id)) return `第 ${index + 1} 条持仓缺少 ID`;
  if (!isString(value.fundCode)) return `第 ${index + 1} 条持仓缺少基金代码`;
  if (!isString(value.fundName)) return `第 ${index + 1} 条持仓缺少基金名称`;
  if (!isPositiveNumber(value.shares)) return `第 ${index + 1} 条持仓的份额必须大于 0`;
  if (!isNonNegativeNumber(value.costAmount)) return `第 ${index + 1} 条持仓的成本不能为负数`;
  if (!isString(value.createdAt)) return `第 ${index + 1} 条持仓缺少创建时间`;
  if (!isString(value.updatedAt)) return `第 ${index + 1} 条持仓缺少更新时间`;

  return {
    id: value.id,
    fundCode: value.fundCode,
    fundName: value.fundName,
    shares: value.shares,
    costAmount: value.costAmount,
    purchaseDate: typeof value.purchaseDate === 'string' ? value.purchaseDate : undefined,
    note: typeof value.note === 'string' ? value.note : undefined,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function validateWatchItem(value: unknown, index: number): WatchItem | string {
  if (!isRecord(value)) return `第 ${index + 1} 条自选格式不正确`;
  if (!isString(value.fundCode)) return `第 ${index + 1} 条自选缺少基金代码`;
  if (!isString(value.fundName)) return `第 ${index + 1} 条自选缺少基金名称`;
  if (!isString(value.createdAt)) return `第 ${index + 1} 条自选缺少创建时间`;

  return {
    fundCode: value.fundCode,
    fundName: value.fundName,
    createdAt: value.createdAt,
  };
}

export function parseImportedData(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: '导入文件不是有效 JSON' };
  }

  if (!isRecord(parsed)) return { ok: false, error: '导入文件格式不正确' };
  if (!Array.isArray(parsed.holdings)) return { ok: false, error: '导入文件缺少 holdings 数组' };
  if (!Array.isArray(parsed.watchlist)) return { ok: false, error: '导入文件缺少 watchlist 数组' };

  const holdings: Holding[] = [];
  for (let index = 0; index < parsed.holdings.length; index += 1) {
    const holding = validateHolding(parsed.holdings[index], index);
    if (typeof holding === 'string') return { ok: false, error: holding };
    holdings.push(holding);
  }

  const watchlist: WatchItem[] = [];
  for (let index = 0; index < parsed.watchlist.length; index += 1) {
    const item = validateWatchItem(parsed.watchlist[index], index);
    if (typeof item === 'string') return { ok: false, error: item };
    watchlist.push(item);
  }

  return { ok: true, data: { holdings, watchlist } };
}

function parseCachedArray(raw: string): unknown[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadHoldings(): Holding[] {
  const raw = localStorage.getItem(HOLDINGS_KEY);
  if (!raw) return [];
  const result = parseImportedData(JSON.stringify({ holdings: parseCachedArray(raw), watchlist: [] }));
  return result.ok ? result.data.holdings : [];
}

export function saveHoldings(holdings: Holding[]) {
  localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings));
}

export function loadWatchlist(): WatchItem[] {
  const raw = localStorage.getItem(WATCHLIST_KEY);
  if (!raw) return [];
  const result = parseImportedData(JSON.stringify({ holdings: [], watchlist: parseCachedArray(raw) }));
  return result.ok ? result.data.watchlist : [];
}

export function saveWatchlist(watchlist: WatchItem[]) {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
}

export function exportLocalData(data: ExportedLocalData): string {
  return JSON.stringify(data, null, 2);
}

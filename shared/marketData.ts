import type { FundHistoryPoint, FundQuote, IndexQuote } from './types';

type CacheEntry<T> = { expiresAt: number; value: T };

type MarketDataOptions = {
  now?: () => number;
  fetchIndices?: () => Promise<IndexQuote[]>;
  fetchText?: (url: string) => Promise<string>;
  fetchJson?: (url: string) => Promise<unknown>;
};

const EASTMONEY_SOURCE = '东方财富公开接口';
const EASTMONEY_SEARCH_SOURCE = '东方财富搜索接口';
const TIANTIAN_ESTIMATE_SOURCE = '天天基金实时估算';

const INDEX_NAMES: Record<string, string> = {
  '000001': '上证指数',
  '399001': '深证成指',
  '399006': '创业板指',
  '000300': '沪深300',
};

const fallbackFunds: FundQuote[] = [
  { code: '000001', name: '华夏成长混合', netValue: 1.35, dailyChangePercent: 0.8, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '110022', name: '易方达消费行业股票', netValue: 1.6, dailyChangePercent: -0.2, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '161725', name: '招商中证白酒指数', netValue: 0.92, dailyChangePercent: 1.1, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '003096', name: '中欧医疗健康混合', netValue: 1.12, dailyChangePercent: -0.5, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '050002', name: '博时沪深300指数', netValue: 1.48, dailyChangePercent: 0.36, quoteDate: '2026-05-28', source: '内置示例行情' },
];

const fallbackIndices: IndexQuote[] = [];

const historyByCode: Record<string, FundHistoryPoint[]> = Object.fromEntries(
  fallbackFunds.map((fund, fundIndex) => [
    fund.code,
    Array.from({ length: 12 }, (_, index) => ({
      date: `2026-05-${String(17 + index).padStart(2, '0')}`,
      netValue: Number((fund.netValue - 0.06 + index * 0.01 + fundIndex * 0.003).toFixed(4)),
    })),
  ]),
);

const normalize = (value: string) => value.trim().toLowerCase();
const toNumber = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

function unwrapJsonp(text: string): unknown {
  const start = text.indexOf('(');
  const end = text.lastIndexOf(')');
  if (start === -1 || end === -1 || end <= start) return JSON.parse(text);
  return JSON.parse(text.slice(start + 1, end));
}

function indexFromEastmoneyPush2Item(item: unknown): IndexQuote | undefined {
  if (typeof item !== 'object' || item === null) return undefined;
  const record = item as Record<string, unknown>;
  const rawCode = String(record.f12 ?? '');
  const value = toNumber(record.f2);
  const changePercent = toNumber(record.f3);
  const change = toNumber(record.f4);
  const quoteTimestamp = toNumber(record.f124);
  if (!rawCode || value === undefined || changePercent === undefined || change === undefined || !quoteTimestamp) return undefined;
  const market = rawCode.startsWith('399') ? 'SZ' : 'SH';
  const quoteTime = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(quoteTimestamp * 1000));
  return {
    code: `${rawCode}.${market}`,
    name: INDEX_NAMES[rawCode] ?? String(record.f14 ?? rawCode),
    value,
    change,
    changePercent,
    quoteTime,
  };
}

function indicesFromEastmoneyPush2(data: unknown): IndexQuote[] {
  if (typeof data !== 'object' || data === null) return [];
  const root = data as { data?: unknown };
  if (typeof root.data !== 'object' || root.data === null) return [];
  const diff = (root.data as { diff?: unknown }).diff;
  if (!Array.isArray(diff)) return [];
  return diff.map(indexFromEastmoneyPush2Item).filter((item): item is IndexQuote => Boolean(item));
}

function indexFromTencentLine(line: string): IndexQuote | undefined {
  const match = line.match(/^v_s_([a-z]{2})(\d{6})="([^"]+)";?$/);
  if (!match) return undefined;
  const [, marketPrefix, rawCode, payload] = match;
  const parts = payload.split('~');
  const name = parts[1];
  const value = toNumber(parts[3]);
  const change = toNumber(parts[4]);
  const changePercent = toNumber(parts[5]);
  if (!name || value === undefined || change === undefined || changePercent === undefined) return undefined;
  return {
    code: `${rawCode}.${marketPrefix === 'sh' ? 'SH' : 'SZ'}`,
    name: INDEX_NAMES[rawCode] ?? name,
    value,
    change,
    changePercent,
    quoteTime: new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date()),
  };
}

function indicesFromTencent(text: string): IndexQuote[] {
  return text
    .split('\n')
    .map((line) => indexFromTencentLine(line.trim()))
    .filter((item): item is IndexQuote => Boolean(item));
}

function fundFromSearchRow(row: unknown): FundQuote | undefined {
  if (!Array.isArray(row) || typeof row[0] !== 'string' || typeof row[2] !== 'string') return undefined;
  return {
    code: row[0],
    name: row[2],
    netValue: 0,
    quoteDate: '',
    quoteType: 'official',
    source: EASTMONEY_SOURCE,
  };
}

function fundFromCurrentSearchItem(item: unknown): FundQuote | undefined {
  if (typeof item !== 'object' || item === null) return undefined;
  const record = item as Record<string, unknown>;
  const base = typeof record.FundBaseInfo === 'object' && record.FundBaseInfo !== null ? (record.FundBaseInfo as Record<string, unknown>) : undefined;
  const code = String(base?.FCODE ?? record.CODE ?? record._id ?? '');
  const name = String(base?.SHORTNAME ?? record.NAME ?? '');
  const netValue = toNumber(base?.DWJZ);
  if (!code || !name || !netValue) return undefined;
  return {
    code,
    name,
    netValue,
    officialNetValue: netValue,
    quoteDate: String(base?.FSRQ ?? ''),
    quoteType: 'official',
    source: EASTMONEY_SEARCH_SOURCE,
  };
}

function quoteFromEastmoneyDetail(data: unknown, code: string): FundQuote | undefined {
  if (typeof data !== 'object' || data === null || !('Datas' in data)) return undefined;
  const datas = (data as { Datas?: unknown }).Datas;
  if (typeof datas !== 'object' || datas === null) return undefined;
  const record = datas as Record<string, unknown>;
  const netValue = toNumber(record.NAV ?? record.DWJZ);
  if (!netValue) return undefined;
  return {
    code: String(record.FCODE ?? code),
    name: String(record.SHORTNAME ?? record.NAME ?? code),
    netValue,
    officialNetValue: netValue,
    dailyChangePercent: toNumber(record.NAVCHGRT ?? record.GSZZL),
    quoteDate: String(record.PDATE ?? record.FSRQ ?? new Date().toISOString().slice(0, 10)),
    quoteType: 'official',
    source: EASTMONEY_SOURCE,
  };
}

function quoteFromTiantianEstimate(text: string, code: string): FundQuote | undefined {
  const payload = unwrapJsonp(text);
  if (typeof payload !== 'object' || payload === null) return undefined;
  const record = payload as Record<string, unknown>;
  const estimate = toNumber(record.gsz);
  const official = toNumber(record.dwjz);
  if (!estimate) return undefined;
  return {
    code: String(record.fundcode ?? code),
    name: String(record.name ?? code),
    netValue: estimate,
    officialNetValue: official,
    dailyChangePercent: toNumber(record.gszzl),
    quoteDate: String(record.jzrq ?? ''),
    estimateTime: String(record.gztime ?? ''),
    quoteType: 'estimate',
    source: TIANTIAN_ESTIMATE_SOURCE,
  };
}

function historyFromEastmoneyData(data: unknown): FundHistoryPoint[] {
  if (typeof data !== 'object' || data === null || !('Data' in data)) return [];
  const dataRecord = (data as { Data?: unknown }).Data;
  if (typeof dataRecord !== 'object' || dataRecord === null || !('LSJZList' in dataRecord)) return [];
  const list = (dataRecord as { LSJZList?: unknown }).LSJZList;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      if (typeof item !== 'object' || item === null) return undefined;
      const record = item as Record<string, unknown>;
      const netValue = toNumber(record.DWJZ ?? record.LJJZ);
      const date = record.FSRQ;
      if (!netValue || typeof date !== 'string') return undefined;
      return { date, netValue };
    })
    .filter((item): item is FundHistoryPoint => Boolean(item))
    .reverse();
}

async function defaultFetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'user-agent': 'GG-Fund/0.1' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function defaultFetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { 'user-agent': 'GG-Fund/0.1' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

export function createMarketDataService(options: MarketDataOptions = {}) {
  const now = options.now ?? (() => Date.now());
  const fetchIndices = options.fetchIndices ?? getLiveIndices;
  const fetchText = options.fetchText ?? defaultFetchText;
  const fetchJson = options.fetchJson ?? defaultFetchJson;
  const cache = new Map<string, CacheEntry<unknown>>();

  async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const entry = cache.get(key) as CacheEntry<T> | undefined;
    if (entry && entry.expiresAt > now()) return entry.value;
    const value = await loader();
    cache.set(key, { value, expiresAt: now() + ttlMs });
    return value;
  }

  async function getEastmoneyIndices(): Promise<IndexQuote[]> {
    const url = 'http://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006,1.000300&fields=f12,f14,f2,f3,f4,f124';
    return indicesFromEastmoneyPush2(JSON.parse(await fetchText(url)));
  }

  async function getTencentIndices(): Promise<IndexQuote[]> {
    const url = 'https://qt.gtimg.cn/q=s_sh000001,s_sz399001,s_sz399006,s_sh000300';
    return indicesFromTencent(await fetchText(url));
  }

  async function getLiveIndices(): Promise<IndexQuote[]> {
    try {
      const indices = await getEastmoneyIndices();
      if (indices.length > 0) return indices;
    } catch {
      // fall through to Tencent
    }
    return getTencentIndices();
  }

  async function searchEastmoneyFunds(query: string): Promise<FundQuote[]> {
    const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(query)}&_=${now()}`;
    const payload = unwrapJsonp(await fetchText(url));
    const list = Array.isArray(payload)
      ? payload.map(fundFromSearchRow)
      : typeof payload === 'object' && payload !== null && Array.isArray((payload as { Datas?: unknown }).Datas)
        ? (payload as { Datas: unknown[] }).Datas.map(fundFromCurrentSearchItem)
        : [];
    return list
      .filter((fund): fund is FundQuote => Boolean(fund))
      .filter((fund) => fund.code.includes(query) || normalize(fund.name).includes(normalize(query)));
  }

  async function getTiantianEstimate(code: string): Promise<FundQuote | undefined> {
    const url = `https://fundgz.1234567.com.cn/js/${encodeURIComponent(code)}.js?rt=${now()}`;
    return quoteFromTiantianEstimate(await fetchText(url), code);
  }

  async function getEastmoneyFund(code: string): Promise<FundQuote | undefined> {
    const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?FCODE=${encodeURIComponent(code)}&deviceid=gg-fund&plat=Web&product=EFund&version=1.0.0`;
    return quoteFromEastmoneyDetail(await fetchJson(url), code);
  }

  async function getEastmoneyHistory(code: string, pageSize = 30): Promise<FundHistoryPoint[]> {
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${encodeURIComponent(code)}&pageIndex=1&pageSize=${pageSize}`;
    return historyFromEastmoneyData(await fetchJson(url));
  }

  return {
    async getIndices(): Promise<IndexQuote[]> {
      return cached('indices', 60_000, async () => {
        try {
          return await fetchIndices();
        } catch {
          return fallbackIndices;
        }
      });
    },
    async searchFunds(query: string): Promise<FundQuote[]> {
      const keyword = normalize(query);
      if (!keyword) return fallbackFunds.slice(0, 5);
      return cached(`fund-search:${keyword}`, 300_000, async () => {
        try {
          const realFunds = await searchEastmoneyFunds(keyword);
          if (realFunds.length > 0) return realFunds;
        } catch {
          // fall through to local fallback
        }
        return fallbackFunds.filter(
          (fund) => fund.code.includes(keyword) || fund.name.toLowerCase().includes(keyword),
        );
      });
    },
    async getFund(code: string): Promise<FundQuote | undefined> {
      return cached(`fund:${code}`, 300_000, async () => {
        try {
          const estimate = await getTiantianEstimate(code);
          if (estimate) return estimate;
        } catch {
          // fall through to official net value
        }
        try {
          const quote = await getEastmoneyFund(code);
          if (quote) return quote;
        } catch {
          // fall through to local fallback
        }
        return fallbackFunds.find((fund) => fund.code === code);
      });
    },
    async getFundHistory(code: string, range = '1m'): Promise<FundHistoryPoint[]> {
      const normalizedRange = String(range).toLowerCase();
      const pageSize = normalizedRange === 'all' ? 720 : normalizedRange === '1y' ? 260 : normalizedRange === '6m' ? 130 : normalizedRange === '3m' ? 70 : 30;
      return cached(`fund-history:${code}:${pageSize}`, 86_400_000, async () => {
        try {
          const history = await getEastmoneyHistory(code, pageSize);
          if (history.length > 0) return history;
        } catch {
          // fall through to local fallback
        }
        return historyByCode[code] ?? [];
      });
    },
    async getTrendingFunds(): Promise<FundQuote[]> {
      return fallbackFunds.slice(0, 4);
    },
  };
}

export type MarketDataService = ReturnType<typeof createMarketDataService>;

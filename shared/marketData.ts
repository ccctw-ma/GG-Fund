import type { FundHistoryPoint, FundQuote, IndexQuote } from './types';

type CacheEntry<T> = { expiresAt: number; value: T };

type MarketDataOptions = {
  now?: () => number;
  fetchIndices?: () => Promise<IndexQuote[]>;
  fetchText?: (url: string, headers?: Record<string, string>) => Promise<string>;
  fetchJson?: (url: string, headers?: Record<string, string>) => Promise<unknown>;
};

const EASTMONEY_SOURCE = '东方财富公开接口';
const EASTMONEY_SEARCH_SOURCE = '东方财富搜索接口';
const EASTMONEY_STOCK_SOURCE = '东方财富 A股行情';
const TENCENT_STOCK_SOURCE = '腾讯证券行情';
const TIANTIAN_ESTIMATE_SOURCE = '天天基金实时估算';

const INDEX_NAMES: Record<string, string> = {
  '000001': '上证指数',
  '399001': '深证成指',
  '399006': '创业板指',
  '000300': '沪深300',
  '000688': '科创50',
  '899050': '北证50',
  HSI: '恒生指数',
  IXIC: '纳斯达克',
};

const fallbackFunds: FundQuote[] = [
  { code: '000001', name: '华夏成长混合', assetType: 'fund', netValue: 1.35, dailyChangePercent: 0.8, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '110022', name: '易方达消费行业股票', assetType: 'fund', netValue: 1.6, dailyChangePercent: -0.2, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '161725', name: '招商中证白酒指数', assetType: 'fund', netValue: 0.92, dailyChangePercent: 1.1, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '003096', name: '中欧医疗健康混合', assetType: 'fund', netValue: 1.12, dailyChangePercent: -0.5, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '050002', name: '博时沪深300指数', assetType: 'fund', netValue: 1.48, dailyChangePercent: 0.36, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '600519', name: '贵州茅台', assetType: 'stock', market: 'SH', netValue: 1668.88, dailyChangePercent: 0.72, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '000001', name: '平安银行', assetType: 'stock', market: 'SZ', netValue: 11.28, dailyChangePercent: -0.18, quoteDate: '2026-05-28', source: '内置示例行情' },
  { code: '300750', name: '宁德时代', assetType: 'stock', market: 'SZ', netValue: 218.36, dailyChangePercent: 1.12, quoteDate: '2026-05-28', source: '内置示例行情' },
];

const fallbackIndices: IndexQuote[] = [];

const historyByCode: Record<string, FundHistoryPoint[]> = Object.fromEntries(
  fallbackFunds.filter((fund) => fund.assetType !== 'stock').map((fund, fundIndex) => [
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
  const market = rawCode === 'HSI' ? 'HK' : rawCode === 'IXIC' ? 'US' : rawCode.startsWith('399') || rawCode.startsWith('899') ? 'SZ' : 'SH';
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
    assetType: 'fund',
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
    assetType: 'fund',
    netValue,
    officialNetValue: netValue,
    quoteDate: String(base?.FSRQ ?? ''),
    quoteType: 'official',
    source: EASTMONEY_SEARCH_SOURCE,
  };
}

function marketFromEastmoneySecid(secid: string, code: string): FundQuote['market'] {
  if (secid.startsWith('1.') || code.startsWith('6')) return 'SH';
  if (secid.startsWith('0.') || code.startsWith('0') || code.startsWith('3')) return 'SZ';
  if (secid.startsWith('2.') || code.startsWith('8') || code.startsWith('4')) return 'BJ';
  return undefined;
}

function eastmoneySecidForStock(code: string) {
  if (code.startsWith('6')) return `1.${code}`;
  if (code.startsWith('8') || code.startsWith('4')) return `2.${code}`;
  return `0.${code}`;
}

function stockFromEastmoneyItem(item: unknown): FundQuote | undefined {
  if (typeof item !== 'object' || item === null) return undefined;
  const record = item as Record<string, unknown>;
  const code = String(record.f12 ?? '');
  const name = String(record.f14 ?? '');
  const price = toNumber(record.f2);
  if (!/^\d{6}$/.test(code) || !name || price === undefined || price <= 0) return undefined;
  const timestamp = toNumber(record.f124);
  const quoteDate = timestamp
    ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp * 1000))
    : new Date().toISOString().slice(0, 10);
  return {
    code,
    name,
    assetType: 'stock',
    market: marketFromEastmoneySecid(String(record.f13 ?? ''), code),
    netValue: price,
    dailyChangePercent: toNumber(record.f3),
    change: toNumber(record.f4),
    open: toNumber(record.f17),
    previousClose: toNumber(record.f18),
    high: toNumber(record.f15),
    low: toNumber(record.f16),
    volume: toNumber(record.f5),
    turnover: toNumber(record.f6),
    quoteDate,
    estimateTime: timestamp
      ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(timestamp * 1000))
      : undefined,
    quoteType: 'official',
    source: EASTMONEY_STOCK_SOURCE,
  };
}

function stocksFromEastmoneyClist(data: unknown): FundQuote[] {
  if (typeof data !== 'object' || data === null) return [];
  const root = data as { data?: unknown };
  if (typeof root.data !== 'object' || root.data === null) return [];
  const diff = (root.data as { diff?: unknown }).diff;
  if (!Array.isArray(diff)) return [];
  return diff.map(stockFromEastmoneyItem).filter((item): item is FundQuote => Boolean(item));
}

function stockFromTencentLine(line: string): FundQuote | undefined {
  const match = line.match(/^v_([a-z]{2})(\d{6})="([^"]+)";?$/);
  if (!match) return undefined;
  const [, marketPrefix, code, payload] = match;
  const parts = payload.split('~');
  const name = parts[1];
  const price = toNumber(parts[3]);
  if (!name || price === undefined || price <= 0) return undefined;
  const date = parts[30];
  const quoteDate = date && date.length >= 8 ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` : new Date().toISOString().slice(0, 10);
  const quoteTime = date && date.length >= 14 ? `${date.slice(8, 10)}:${date.slice(10, 12)}:${date.slice(12, 14)}` : undefined;
  return {
    code,
    name,
    assetType: 'stock',
    market: marketPrefix === 'sh' ? 'SH' : 'SZ',
    netValue: price,
    dailyChangePercent: toNumber(parts[32]),
    change: toNumber(parts[31]) === undefined ? toNumber(parts[4]) : toNumber(parts[31]),
    open: toNumber(parts[5]),
    previousClose: toNumber(parts[4]),
    high: toNumber(parts[33]),
    low: toNumber(parts[34]),
    volume: toNumber(parts[36]),
    turnover: toNumber(parts[37]),
    quoteDate,
    estimateTime: quoteTime,
    quoteType: 'official',
    source: TENCENT_STOCK_SOURCE,
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
    assetType: 'fund',
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
    assetType: 'fund',
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

function historyFromEastmoneyKline(data: unknown): FundHistoryPoint[] {
  if (typeof data !== 'object' || data === null) return [];
  const root = data as { data?: unknown };
  if (typeof root.data !== 'object' || root.data === null) return [];
  const klines = (root.data as { klines?: unknown }).klines;
  if (!Array.isArray(klines)) return [];
  return klines
    .map((line) => {
      if (typeof line !== 'string') return undefined;
      const [date, close] = line.split(',');
      const netValue = toNumber(close);
      if (!date || netValue === undefined) return undefined;
      return { date, netValue };
    })
    .filter((item): item is FundHistoryPoint => Boolean(item));
}

function eastmoneySecidForIndex(code: string): string {
  const [rawCode, market] = code.split('.');
  if (market === 'SH') return `1.${rawCode}`;
  if (market === 'SZ') return `0.${rawCode}`;
  return `100.${rawCode}`;
}

async function defaultFetchText(url: string, headers?: Record<string, string>): Promise<string> {
  const response = await fetch(url, { headers: { 'user-agent': 'GG-Fund/0.1', ...headers } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

async function defaultFetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  const response = await fetch(url, { headers: { 'user-agent': 'GG-Fund/0.1', ...headers } });
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
    const url = 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=1.000001,0.399001,0.399006,1.000300,1.000688,0.899050,100.HSI,100.IXIC&fields=f12,f14,f2,f3,f4,f124';
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

  async function searchEastmoneyStocks(query: string): Promise<FundQuote[]> {
    const fields = 'f12,f13,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18,f124';
    const fs = 'm:1+t:2,m:1+t:23,m:0+t:6,m:0+t:80,m:0+t:81,m:0+t:83,m:2+t:81';
    const url = `https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=120&po=1&np=1&fltt=2&invt=2&fid=f3&fs=${encodeURIComponent(fs)}&fields=${fields}`;
    const stocks = stocksFromEastmoneyClist(await fetchJson(url));
    return stocks.filter((stock) => stock.code.includes(query) || normalize(stock.name).includes(normalize(query))).slice(0, 12);
  }

  async function getEastmoneyStock(code: string): Promise<FundQuote | undefined> {
    const fields = 'f12,f13,f14,f2,f3,f4,f5,f6,f15,f16,f17,f18,f124';
    const url = `https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&secids=${eastmoneySecidForStock(code)}&fields=${fields}`;
    return stocksFromEastmoneyClist(await fetchJson(url))[0];
  }

  async function getTencentStock(code: string): Promise<FundQuote | undefined> {
    const prefix = code.startsWith('6') ? 'sh' : 'sz';
    return stockFromTencentLine(await fetchText(`https://qt.gtimg.cn/q=${prefix}${encodeURIComponent(code)}`));
  }

  async function getTiantianEstimate(code: string): Promise<FundQuote | undefined> {
    const url = `https://fundgz.1234567.com.cn/js/${encodeURIComponent(code)}.js?rt=${now()}`;
    return quoteFromTiantianEstimate(await fetchText(url), code);
  }

  async function getEastmoneyFund(code: string): Promise<FundQuote | undefined> {
    const url = `https://fundmobapi.eastmoney.com/FundMNewApi/FundMNFInfo?FCODE=${encodeURIComponent(code)}&deviceid=gg-fund&plat=Web&product=EFund&version=1.0.0`;
    return quoteFromEastmoneyDetail(await fetchJson(url), code);
  }

  async function getEastmoneyHistory(code: string, targetCount = 30): Promise<FundHistoryPoint[]> {
    const headers = {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      referer: `https://fundf10.eastmoney.com/jjjz_${code}.html`,
    };
    // 东方财富 lsjz 单页最多返回 20 条，需翻页累积才能覆盖更长区间。
    const perPage = 20;
    const pageCount = Math.min(Math.ceil(targetCount / perPage), 50);
    const fetchPage = async (pageIndex: number) => {
      const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${encodeURIComponent(code)}&pageIndex=${pageIndex}&pageSize=${perPage}`;
      return historyFromEastmoneyData(await fetchJson(url, headers));
    };
    const pages = await Promise.all(
      Array.from({ length: pageCount }, (_, index) => fetchPage(index + 1).catch(() => [])),
    );
    const byDate = new Map<string, FundHistoryPoint>();
    for (const page of pages) {
      for (const point of page) byDate.set(point.date, point);
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  async function getEastmoneyIndexHistory(code: string, limit = 120): Promise<FundHistoryPoint[]> {
    const secid = eastmoneySecidForIndex(code);
    const headers = {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      referer: 'https://quote.eastmoney.com/',
    };
    const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f53&klt=101&fqt=1&beg=0&end=20500101&rtntype=6&lmt=${limit}`;
    return historyFromEastmoneyKline(await fetchJson(url, headers));
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
    async getIndexHistory(code: string, range = '1m'): Promise<FundHistoryPoint[]> {
      const normalizedRange = String(range).toLowerCase();
      const limit = normalizedRange === 'all' ? 1200 : normalizedRange === '1y' ? 260 : normalizedRange === '6m' ? 130 : normalizedRange === '3m' ? 70 : 30;
      return cached(`index-history:${code}:${limit}`, 86_400_000, async () => {
        try {
          const history = await getEastmoneyIndexHistory(code, limit);
          if (history.length > 0) return history;
        } catch {
          // fall through to empty history
        }
        return [];
      });
    },
    async searchFunds(query: string): Promise<FundQuote[]> {
      const keyword = normalize(query);
      if (!keyword) return fallbackFunds.slice(0, 5);
      return cached(`fund-search:${keyword}`, 300_000, async () => {
        try {
          const realFunds = await searchEastmoneyFunds(keyword);
          const realStocks = await searchEastmoneyStocks(keyword).catch(() => []);
          const merged = [...realFunds, ...realStocks]
            .filter((item, index, list) => list.findIndex((candidate) => candidate.code === item.code && candidate.assetType === item.assetType) === index)
            .slice(0, 15);
          if (merged.length > 0) return merged;
        } catch {
          // fall through to local fallback
        }
        return fallbackFunds.filter(
          (fund) => fund.code.includes(keyword) || normalize(fund.name).includes(keyword),
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
          // fall through to stock quote
        }
        try {
          const stock = await getEastmoneyStock(code);
          if (stock) return stock;
        } catch {
          // fall through to Tencent stock quote
        }
        try {
          const stock = await getTencentStock(code);
          if (stock) return stock;
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

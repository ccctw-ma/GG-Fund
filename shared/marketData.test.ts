import { describe, expect, it } from 'vitest';
import { createMarketDataService } from './marketData';

describe('market data service', () => {
  it('normalizes Eastmoney push2 index quotes into live market indices', async () => {
    const service = createMarketDataService({
      now: () => 1_779_951_200_000,
      fetchText: async () => JSON.stringify({
        rc: 0,
        data: {
          diff: [
            { f12: '000001', f14: '上证指数', f2: 4096.95, f3: 0.08, f4: 3.22, f124: 1779951051 },
            { f12: '399001', f14: '深证成指', f2: 15859.82, f3: 0.78, f4: 123.35, f124: 1779951048 },
          ],
        },
      }),
    });

    await expect(service.getIndices()).resolves.toEqual([
      { code: '000001.SH', name: '上证指数', value: 4096.95, change: 3.22, changePercent: 0.08, quoteTime: '2026-05-28 14:50:51' },
      { code: '399001.SZ', name: '深证成指', value: 15859.82, change: 123.35, changePercent: 0.78, quoteTime: '2026-05-28 14:50:48' },
    ]);
  });

  it('normalizes expanded Eastmoney index quotes for A/H/US market radar', async () => {
    const service = createMarketDataService({
      now: () => 1_779_951_200_000,
      fetchText: async () => JSON.stringify({
        rc: 0,
        data: {
          diff: [
            { f12: '000688', f14: '科创50', f2: 1288.88, f3: 1.08, f4: 13.7, f124: 1779951051 },
            { f12: 'HSI', f14: '恒生指数', f2: 26888.66, f3: -0.35, f4: -94.1, f124: 1779951051 },
            { f12: 'IXIC', f14: '纳斯达克', f2: 19888.12, f3: 0.42, f4: 83.3, f124: 1779951051 },
          ],
        },
      }),
    });

    await expect(service.getIndices()).resolves.toEqual([
      expect.objectContaining({ code: '000688.SH', name: '科创50' }),
      expect.objectContaining({ code: 'HSI.HK', name: '恒生指数' }),
      expect.objectContaining({ code: 'IXIC.US', name: '纳斯达克' }),
    ]);
  });

  it('uses canonical Chinese index names when upstream names are mojibake', async () => {
    const service = createMarketDataService({
      fetchText: async () => JSON.stringify({
        rc: 0,
        data: {
          diff: [
            { f12: '000001', f14: '���ָ֤��', f2: 4098.64, f3: 0.12, f4: 4.91, f124: 1779954667 },
            { f12: '000300', f14: '����300', f2: 4914.21, f3: 0.12, f4: 6.04, f124: 1779954667 },
          ],
        },
      }),
    });

    await expect(service.getIndices()).resolves.toEqual([
      expect.objectContaining({ code: '000001.SH', name: '上证指数' }),
      expect.objectContaining({ code: '000300.SH', name: '沪深300' }),
    ]);
  });
  it('falls back to Tencent index quotes when Eastmoney is unavailable', async () => {
    const service = createMarketDataService({
      fetchText: async (url) => {
        if (url.includes('eastmoney')) throw new Error('edge blocked');
        return [
          'v_s_sh000001="1~上证指数~000001~4095.77~2.04~0.05~599310659~131419893~~683989.95~ZS~";',
          'v_s_sz399001="51~深证成指~399001~15854.79~118.32~0.75~719719752~154893038~~496045.25~ZS~";',
        ].join('\n');
      },
    });

    await expect(service.getIndices()).resolves.toEqual([
      { code: '000001.SH', name: '上证指数', value: 4095.77, change: 2.04, changePercent: 0.05, quoteTime: expect.any(String) },
      { code: '399001.SZ', name: '深证成指', value: 15854.79, change: 118.32, changePercent: 0.75, quoteTime: expect.any(String) },
    ]);
  });
  it('normalizes current Eastmoney search JSON and includes latest official net value', async () => {
    const service = createMarketDataService({
      fetchText: async () => JSON.stringify({
        ErrCode: 0,
        Datas: [
          {
            CODE: '000001',
            NAME: '华夏成长混合',
            FundBaseInfo: {
              FCODE: '000001',
              SHORTNAME: '华夏成长混合',
              DWJZ: 1.333,
              FSRQ: '2026-05-27',
            },
          },
        ],
      }),
    });

    await expect(service.searchFunds('000001')).resolves.toEqual([
      expect.objectContaining({ code: '000001', name: '华夏成长混合', netValue: 1.333, quoteDate: '2026-05-27', source: '东方财富搜索接口' }),
    ]);
  });

  it('uses Tiantian fundgz intraday valuation as the fund quote when available', async () => {
    const service = createMarketDataService({
      fetchText: async () => 'jsonpgz({"fundcode":"000001","name":"华夏成长混合","jzrq":"2026-05-27","dwjz":"1.3330","gsz":"1.3514","gszzl":"1.38","gztime":"2026-05-28 14:08"});',
    });

    await expect(service.getFund('000001')).resolves.toEqual(
      expect.objectContaining({
        code: '000001',
        name: '华夏成长混合',
        netValue: 1.3514,
        officialNetValue: 1.333,
        dailyChangePercent: 1.38,
        quoteDate: '2026-05-27',
        estimateTime: '2026-05-28 14:08',
        quoteType: 'estimate',
        source: '天天基金实时估算',
      }),
    );
  });

  it('normalizes Eastmoney fund search jsonp into fund quotes', async () => {
    const service = createMarketDataService({
      fetchText: async () => 'jQuery123([["000001","HXCZHH","华夏成长混合","混合型","HUAXIACHENGZHANGHUNHE"],["110022","YFDXFHYGP","易方达消费行业股票","股票型","YIFANGDAXIAOFEI"]]);',
    });

    await expect(service.searchFunds('消费')).resolves.toEqual([
      expect.objectContaining({ code: '110022', name: '易方达消费行业股票', source: '东方财富公开接口' }),
    ]);
  });

  it('mixes Eastmoney stock quotes into financial asset search results', async () => {
    const service = createMarketDataService({
      fetchText: async () => 'jQuery123([]);',
      fetchJson: async () => ({
        data: {
          diff: [
            { f12: '600519', f13: '1.600519', f14: '贵州茅台', f2: 1668.88, f3: 0.72, f4: 11.94, f5: 123456, f6: 987654321, f15: 1688, f16: 1648, f17: 1650, f18: 1656.94, f124: 1779951051 },
          ],
        },
      }),
    });

    await expect(service.searchFunds('茅台')).resolves.toEqual([
      expect.objectContaining({
        code: '600519',
        name: '贵州茅台',
        assetType: 'stock',
        market: 'SH',
        netValue: 1668.88,
        source: '东方财富 A股行情',
      }),
    ]);
  });

  it('normalizes Eastmoney fund detail json into a real quote', async () => {
    const service = createMarketDataService({
      fetchText: async () => {
        throw new Error('estimate unavailable');
      },
      fetchJson: async () => ({
        Datas: {
          FCODE: '000001',
          SHORTNAME: '华夏成长混合',
          NAV: '1.2345',
          NAVCHGRT: '0.56',
          PDATE: '2026-05-28',
        },
      }),
    });

    await expect(service.getFund('000001')).resolves.toEqual(
      expect.objectContaining({ code: '000001', netValue: 1.2345, dailyChangePercent: 0.56, source: '东方财富公开接口' }),
    );
  });

  it('falls through to A-share stock quote when fund endpoints do not return a fund', async () => {
    const service = createMarketDataService({
      fetchText: async () => {
        throw new Error('fund estimate unavailable');
      },
      fetchJson: async (url) => {
        if (url.includes('FundMNewApi')) return {};
        return {
          data: {
            diff: [
              { f12: '600519', f13: '1.600519', f14: '贵州茅台', f2: 1668.88, f3: 0.72, f4: 11.94, f5: 123456, f6: 987654321, f15: 1688, f16: 1648, f17: 1650, f18: 1656.94, f124: 1779951051 },
            ],
          },
        };
      },
    });

    await expect(service.getFund('600519')).resolves.toEqual(
      expect.objectContaining({
        code: '600519',
        name: '贵州茅台',
        assetType: 'stock',
        high: 1688,
        low: 1648,
        turnover: 987654321,
      }),
    );
  });

  it('uses Tencent stock quote fallback when Eastmoney stock detail is unavailable', async () => {
    const service = createMarketDataService({
      fetchText: async (url) => {
        if (url.includes('fundgz')) throw new Error('fund estimate unavailable');
        return 'v_sh600519="1~贵州茅台~600519~1668.88~1656.94~1650.00~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20260529150000~11.94~0.72~1688.00~1648.00~1668.88~123456~987654321";';
      },
      fetchJson: async () => ({}),
    });

    await expect(service.getFund('600519')).resolves.toEqual(
      expect.objectContaining({
        code: '600519',
        name: '贵州茅台',
        assetType: 'stock',
        source: '腾讯证券行情',
        quoteDate: '2026-05-29',
        estimateTime: '15:00:00',
      }),
    );
  });

  it('searches fallback Chinese funds when upstream search fails', async () => {
    const service = createMarketDataService({
      fetchText: async () => {
        throw new Error('search unavailable');
      },
    });

    await expect(service.searchFunds('000001')).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: '000001', name: '华夏成长混合' }),
      expect.objectContaining({ code: '000001', name: '平安银行', assetType: 'stock' }),
    ]));
    await expect(service.searchFunds('消费')).resolves.toEqual([
      expect.objectContaining({ code: '110022', name: '易方达消费行业股票' }),
    ]);
  });

  it('returns quote history for a supported fund', async () => {
    const service = createMarketDataService();

    const history = await service.getFundHistory('000001', '1m');

    expect(history.length).toBeGreaterThan(3);
    expect(history[0]).toHaveProperty('date');
    expect(history[0]).toHaveProperty('netValue');
  });

  it('paginates fund history with an Eastmoney referer', async () => {
    const capturedReferers: Array<string | undefined> = [];
    const service = createMarketDataService({
      fetchJson: async (url, headers) => {
        if (url.includes('lsjz')) {
          capturedReferers.push(headers?.referer);
          const pageIndex = Number(new URL(url).searchParams.get('pageIndex'));
          return { Data: { LSJZList: [{ FSRQ: `2026-05-${String(pageIndex).padStart(2, '0')}`, DWJZ: `1.${pageIndex}` }] } };
        }
        return {};
      },
    });

    const history = await service.getFundHistory('000001', 'all');

    expect(history.length).toBeGreaterThan(1);
    expect(history[0]?.date.localeCompare(history.at(-1)?.date ?? '')).toBeLessThanOrEqual(0);
    expect(capturedReferers.length).toBeGreaterThan(1);
    expect(capturedReferers.every((referer) => referer === 'https://fundf10.eastmoney.com/jjjz_000001.html')).toBe(true);
  });

  it('caches index data within the ttl', async () => {
    let calls = 0;
    const service = createMarketDataService({
      now: () => 1_000,
      fetchIndices: async () => {
        calls += 1;
        return [
          {
            code: '000001.SH',
            name: '上证指数',
            value: 3100,
            change: 12,
            changePercent: 0.39,
            quoteTime: '2026-05-28 15:00:00',
          },
        ];
      },
    });

    await service.getIndices();
    await service.getIndices();

    expect(calls).toBe(1);
  });
});

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

  it('searches fallback Chinese funds when upstream search fails', async () => {
    const service = createMarketDataService({
      fetchText: async () => {
        throw new Error('search unavailable');
      },
    });

    await expect(service.searchFunds('000001')).resolves.toEqual([
      expect.objectContaining({ code: '000001', name: '华夏成长混合' }),
    ]);
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

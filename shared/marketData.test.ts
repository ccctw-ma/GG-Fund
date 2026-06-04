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
            f43: 166888,
            f44: 168800,
            f45: 164800,
            f46: 165000,
            f47: 123456,
            f48: 987654321,
            f57: '600519',
            f58: '贵州茅台',
            f59: 2,
            f60: 165694,
            f86: 1779951051,
            f169: 1194,
            f170: 72,
          },
        };
      },
    });

    await expect(service.getFund('600519')).resolves.toEqual(
      expect.objectContaining({
        code: '600519',
        name: '贵州茅台',
        assetType: 'stock',
        netValue: 1668.88,
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
        // 腾讯接口返回结尾带换行符，解析前需 trim，否则正则匹配失败。
        return 'v_sh600519="1~贵州茅台~600519~1668.88~1656.94~1650.00~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20260529150000~11.94~0.72~1688.00~1648.00~1668.88~123456~987654321";\n';
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
  }, 10_000);

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

  it('falls back to Tencent daily kline for A-share stock history', async () => {
    let capturedUrl = '';
    const service = createMarketDataService({
      fetchJson: async () => ({}),
      fetchText: async (url) => {
        capturedUrl = url;
        return JSON.stringify({
          code: 0,
          data: {
            sh600522: {
              qfqday: [
                ['2026-05-29', '44.00', '44.50', '45.10', '43.80', '123456'],
                ['2026-05-30', '44.60', '44.98', '46.98', '43.40', '234567'],
              ],
            },
          },
        });
      },
    });

    const history = await service.getFundHistory('600522', '1m');

    expect(capturedUrl).toContain('sh600522');
    expect(history).toEqual([
      { date: '2026-05-29', netValue: 44.5 },
      { date: '2026-05-30', netValue: 44.98 },
    ]);
  });

  it('parses Eastmoney intraday trend points for tradable symbols', async () => {
    let capturedUrl = '';
    const service = createMarketDataService({
      fetchText: async () => {
        throw new Error('not used');
      },
      fetchJson: async (url) => {
        capturedUrl = url;
        return {
          data: {
            trends: [
              '2026-06-04 09:30,1.230,1.229,1000',
              '2026-06-04 10:00,1.250,1.235,1500',
            ],
          },
        };
      },
    });

    const points = await service.getFundIntraday('510300');

    expect(capturedUrl).toContain('trends2/get');
    expect(capturedUrl).toContain('secid=1.510300');
    expect(points).toEqual([
      { time: '09:30', price: 1.23, average: 1.229, volume: 1000 },
      { time: '10:00', price: 1.25, average: 1.235, volume: 1500 },
    ]);
  });

  it('falls back to Tencent minute points when Eastmoney intraday is empty', async () => {
    let tencentUrl = '';
    const service = createMarketDataService({
      fetchJson: async () => ({ data: { trends: [] } }),
      fetchText: async (url) => {
        tencentUrl = url;
        return JSON.stringify({
          code: 0,
          data: {
            sh510300: {
              data: {
                data: [
                  '0930 4.919 56913 27995505.00',
                  '0931 4.924 202677 99811906.00',
                ],
              },
            },
          },
        });
      },
    });

    const points = await service.getFundIntraday('510300');

    expect(tencentUrl).toContain('minute/query?code=sh510300');
    expect(points).toEqual([
      { time: '09:30', price: 4.919, volume: 56913 },
      { time: '09:31', price: 4.924, volume: 202677 },
    ]);
  });

  it('does not show same-code stock minute points for OTC fund codes', async () => {
    let stockIntradayCalled = false;
    const service = createMarketDataService({
      fetchText: async (url) => {
        if (url.includes('fundgz')) {
          return 'jsonpgz({"fundcode":"000001","name":"华夏成长混合","jzrq":"2026-06-03","dwjz":"1.318","gsz":"1.332","gszzl":"1.07","gztime":"2026-06-04 15:00"});';
        }
        stockIntradayCalled = true;
        return JSON.stringify({
          code: 0,
          data: {
            sz000001: {
              data: { data: ['0930 10.91 1000 1000.00'] },
            },
          },
        });
      },
      fetchJson: async () => {
        stockIntradayCalled = true;
        return { data: { trends: ['2026-06-04 09:30,10.91,10.91,1000'] } };
      },
    });

    await expect(service.getFundIntraday('000001')).resolves.toEqual([]);
    expect(stockIntradayCalled).toBe(false);
  });

  it('prefers Eastmoney F10 full disclosed stock holdings over the mobile top-10 endpoint', async () => {
    let capturedUrl = '';
    const service = createMarketDataService({
      fetchText: async (url) => {
        capturedUrl = url;
        return `var apidata={ content:"<h4 class='t'><label class='right'>截止至：<font class='px12'>2026-03-31</font></label></h4><table><tbody>
          <tr><td>1</td><td><a>600519</a></td><td class='tol'><a>贵州茅台</a></td><td></td><td></td><td></td><td>18.33%</td><td>508.34</td><td>737,086.62</td></tr>
          <tr><td>11</td><td><a>000568</a></td><td class='tol'><a>泸州老窖</a></td><td></td><td></td><td></td><td>1.80%</td><td>320.00</td><td>72,000.00</td></tr>
        </tbody></table>"}`;
      },
      fetchJson: async () => {
        throw new Error('mobile endpoint should not be used');
      },
    });

    const holdings = await service.getFundHoldings('161725');

    expect(capturedUrl).toContain('FundArchivesDatas.aspx');
    expect(holdings).toEqual({
      reportDate: '2026-03-31',
      source: '东方财富 F10 持仓明细',
      stocks: [
        { code: '600519', name: '贵州茅台', weight: 18.33, rank: 1, isTopTen: true, shares: 508.34, marketValue: 737086.62 },
        { code: '000568', name: '泸州老窖', weight: 1.8, rank: 11, isTopTen: false, shares: 320, marketValue: 72000 },
      ],
    });
  });

  it('falls back to mobile fund holdings with weight, industry, and report date', async () => {
    let capturedUrl = '';
    const service = createMarketDataService({
      fetchText: async () => {
        throw new Error('f10 unavailable');
      },
      fetchJson: async (url) => {
        capturedUrl = url;
        return {
          Datas: {
            fundStocks: [
              { GPDM: '600519', GPJC: '贵州茅台', JZBL: '18.33', PCTNVCHGTYPE: '增持', INDEXNAME: '食品饮料' },
              { GPDM: '000858', GPJC: '五粮液', JZBL: '16.14', PCTNVCHGTYPE: '增持', INDEXNAME: '食品饮料' },
            ],
          },
          Expansion: '2026-03-31',
        };
      },
    });

    const holdings = await service.getFundHoldings('161725');

    expect(capturedUrl).toContain('FundMNInverstPosition');
    expect(holdings.reportDate).toBe('2026-03-31');
    expect(holdings.source).toBe('东方财富公开接口');
    expect(holdings.stocks).toEqual([
      { code: '600519', name: '贵州茅台', weight: 18.33, rank: 1, isTopTen: true, changeType: '增持', industry: '食品饮料' },
      { code: '000858', name: '五粮液', weight: 16.14, rank: 2, isTopTen: true, changeType: '增持', industry: '食品饮料' },
    ]);
  });

  it('returns empty fund holdings when the upstream request fails', async () => {
    const service = createMarketDataService({
      fetchText: async () => {
        throw new Error('network');
      },
      fetchJson: async () => {
        throw new Error('network');
      },
    });

    await expect(service.getFundHoldings('161725')).resolves.toEqual({ stocks: [] });
  });

  it('parses index kline history and maps the secid by market', async () => {
    let capturedUrl = '';
    const service = createMarketDataService({
      fetchJson: async (url) => {
        capturedUrl = url;
        return { data: { klines: ['2026-05-27,3100.10', '2026-05-28,3128.42'] } };
      },
    });

    const history = await service.getIndexHistory('000001.SH', 'all');

    expect(capturedUrl).toContain('secid=1.000001');
    expect(history).toEqual([
      { date: '2026-05-27', netValue: 3100.1 },
      { date: '2026-05-28', netValue: 3128.42 },
    ]);
  });

  it('falls back to the Tencent kline source when Eastmoney returns nothing', async () => {
    let tencentUrl = '';
    const service = createMarketDataService({
      fetchJson: async () => ({ data: { klines: [] } }),
      fetchText: async (url) => {
        tencentUrl = url;
        return `kline_dayqfq=${JSON.stringify({
          data: { sh000001: { qfqday: [['2026-05-27', '3090.00', '3100.10', '3110.00', '3080.00']] } },
        })};`;
      },
    });

    const history = await service.getIndexHistory('000001.SH', 'all');

    expect(tencentUrl).toContain('param=sh000001,day');
    expect(history).toEqual([{ date: '2026-05-27', netValue: 3100.1 }]);
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

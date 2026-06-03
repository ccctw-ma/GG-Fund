import { describe, expect, it, vi } from 'vitest';
import type { FundQuote, Holding } from './types';
import { backfillHoldingCodes, hasValidFundCode } from './holdingCodes';

const baseHolding: Holding = {
  id: 'h-1',
  fundCode: 'ALIPAY001',
  fundName: '华夏成长混合',
  recordedMarketValue: 1200,
  costAmount: 1000,
  createdAt: '2026-05-28T00:00:00.000Z',
  updatedAt: '2026-05-28T00:00:00.000Z',
};

const quote = (code: string, name: string, assetType: FundQuote['assetType'] = 'fund'): FundQuote => ({
  code,
  name,
  assetType,
  netValue: 1.35,
  quoteDate: '2026-05-29',
  source: 'test',
});

describe('hasValidFundCode', () => {
  it('only accepts 6-digit numeric codes', () => {
    expect(hasValidFundCode('000001')).toBe(true);
    expect(hasValidFundCode('ALIPAY001')).toBe(false);
  });
});

describe('backfillHoldingCodes', () => {
  it('backfills the real code by matching the fund name', async () => {
    const search = vi.fn(async () => [quote('000001', '华夏成长混合')]);
    const [resolved] = await backfillHoldingCodes([baseHolding], search, () => '2026-06-02T00:00:00.000Z');
    expect(search).toHaveBeenCalledWith('华夏成长混合');
    expect(resolved.fundCode).toBe('000001');
    expect(resolved.codeSource).toBe('auto');
    expect(resolved.updatedAt).toBe('2026-06-02T00:00:00.000Z');
  });

  it('keeps holdings that already have a valid code untouched', async () => {
    const search = vi.fn(async () => []);
    const holding = { ...baseHolding, fundCode: '110022' };
    const [resolved] = await backfillHoldingCodes([holding], search);
    expect(search).not.toHaveBeenCalled();
    expect(resolved).toBe(holding);
  });

  it('ignores stock matches and unrelated names', async () => {
    const search = vi.fn(async () => [quote('600519', '贵州茅台', 'stock'), quote('161725', '招商中证白酒')]);
    const [resolved] = await backfillHoldingCodes([baseHolding], search);
    expect(resolved.fundCode).toBe('ALIPAY001');
  });

  it('falls back to the original holding when search fails', async () => {
    const search = vi.fn(async () => {
      throw new Error('network');
    });
    const [resolved] = await backfillHoldingCodes([baseHolding], search);
    expect(resolved.fundCode).toBe('ALIPAY001');
  });
});

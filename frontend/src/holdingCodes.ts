import type { FundQuote, Holding } from './types';

const VALID_CODE = /^\d{6}$/;

const normalizeName = (name: string) =>
  name
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s·•。、,，A-Za-z]/g, '')
    .replace(/(定投|持有)$/, '')
    .trim();

export function hasValidFundCode(code: string) {
  return VALID_CODE.test(code);
}

function pickBestMatch(name: string, candidates: FundQuote[]): FundQuote | undefined {
  const funds = candidates.filter((fund) => VALID_CODE.test(fund.code) && fund.assetType !== 'stock');
  if (funds.length === 0) return undefined;
  const target = normalizeName(name);
  return (
    funds.find((fund) => normalizeName(fund.name) === target) ??
    funds.find((fund) => normalizeName(fund.name).includes(target) && target.length >= 3) ??
    undefined
  );
}

// 截图导入的持仓没有真实基金代码（如 ALIPAY001），用基金名称搜索后回填 6 位代码，
// 让持仓明细能展示净值走势图并拉取实时净值。
export async function backfillHoldingCodes(
  holdings: Holding[],
  search: (query: string) => Promise<FundQuote[]>,
  now: () => string = () => new Date().toISOString(),
): Promise<Holding[]> {
  return Promise.all(
    holdings.map(async (holding) => {
      if (VALID_CODE.test(holding.fundCode) || !holding.fundName.trim()) return holding;
      try {
        const match = pickBestMatch(holding.fundName, await search(holding.fundName));
        if (!match) return holding;
        return { ...holding, fundCode: match.code, fundName: match.name, codeSource: 'auto', updatedAt: now() };
      } catch {
        return holding;
      }
    }),
  );
}

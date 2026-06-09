import { HttpError } from '../../lib/http';

export type RecognizeHoldingsRequest = {
  imageDataUrl: string;
};

export type RecognizedHolding = {
  fundName: string;
  fundCode?: string;
  marketValue?: number;
  profit?: number;
  dailyProfit?: number;
  accountName?: string;
};

export type RecognizeHoldingsResponse = {
  model: string;
  holdings: RecognizedHolding[];
};

export type RecognizeHoldingsDependencies = {
  deepSeekApiKey?: string;
  deepSeekFetch?: typeof fetch;
};

const DEEPSEEK_VISION_MODEL = 'deepseek-v4-flash';
const DATA_URL_PATTERN = /^data:image\/(png|jpe?g|webp|bmp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

const SYSTEM_PROMPT =
  '你是严谨的基金持仓识别助手。只根据图片中真实可见的文字识别持仓，不允许编造、补全或推测任何不存在的基金。必须输出结构化 JSON。';

const USER_PROMPT = [
  '这是一张基金 App（如支付宝/理财通/天天基金/雪球）的持仓截图。请逐行识别我的持有基金，并输出 JSON。',
  '输出格式严格为：{"holdings":[{"fundName":"基金全名","fundCode":"6位代码或留空","marketValue":持有金额数字,"profit":持有收益数字,"dailyProfit":当日收益数字或省略}]}。',
  '规则：',
  '1. fundName 为基金完整名称，去掉括号内的 QDII/LOF 等标注与多余空格；如名称跨行请拼接完整。',
  '2. marketValue 是“持有金额/持有市值”，为正数；profit 是“持有收益”，亏损为负数；dailyProfit 是“当日收益”，没有则省略。',
  '3. 金额去掉千分位逗号，仅保留数字（可带负号和小数）。',
  '4. 截图里通常没有基金代码，没有就让 fundCode 留空字符串，不要编造代码。',
  '5. 只输出能在图片中看到的持仓，看不清的不要输出。只返回 JSON，不要任何额外说明文字。',
].join('\n');

export function normalizeRecognizeHoldingsRequest(body: unknown): RecognizeHoldingsRequest {
  const imageDataUrl =
    typeof body === 'object' && body !== null ? String((body as { imageDataUrl?: unknown }).imageDataUrl ?? '') : '';
  if (!DATA_URL_PATTERN.test(imageDataUrl)) {
    throw new HttpError(400, 'IMAGE_DATA_INVALID', '图片数据格式不正确，请上传 PNG/JPG/WebP/BMP 截图');
  }
  return { imageDataUrl };
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[,，\s+＋]/g, ''));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function cleanFundName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

function extractJsonObject(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

export function normalizeRecognizedHoldings(content: string): RecognizedHolding[] {
  const parsed = extractJsonObject(content);
  const rawList = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { holdings?: unknown })?.holdings)
      ? (parsed as { holdings: unknown[] }).holdings
      : [];

  return rawList
    .map((item) => {
      if (!item || typeof item !== 'object') return undefined;
      const record = item as Record<string, unknown>;
      const fundName = cleanFundName(record.fundName ?? record.name);
      if (!fundName || fundName.length < 2) return undefined;
      const codeRaw = typeof record.fundCode === 'string' ? record.fundCode.trim() : '';
      const fundCode = /^\d{6}$/.test(codeRaw) ? codeRaw : undefined;
      const marketValue = toFiniteNumber(record.marketValue ?? record.amount ?? record.value);
      const profit = toFiniteNumber(record.profit);
      const dailyProfit = toFiniteNumber(record.dailyProfit);
      const accountName = typeof record.accountName === 'string' && record.accountName.trim() ? record.accountName.trim() : undefined;
      const holding: RecognizedHolding = { fundName };
      if (fundCode) holding.fundCode = fundCode;
      if (marketValue !== undefined) holding.marketValue = Number(marketValue.toFixed(2));
      if (profit !== undefined) holding.profit = Number(profit.toFixed(2));
      if (dailyProfit !== undefined) holding.dailyProfit = Number(dailyProfit.toFixed(2));
      if (accountName) holding.accountName = accountName;
      return holding;
    })
    .filter((holding): holding is RecognizedHolding => Boolean(holding));
}

export async function recognizeHoldingsFromImage(
  request: RecognizeHoldingsRequest,
  dependencies: RecognizeHoldingsDependencies,
): Promise<RecognizeHoldingsResponse> {
  if (!dependencies.deepSeekApiKey) {
    throw new HttpError(503, 'DEEPSEEK_KEY_MISSING', '未配置 DeepSeek API Key，无法进行图片智能识别');
  }

  const deepSeekFetch = dependencies.deepSeekFetch ?? fetch;
  const response = await deepSeekFetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${dependencies.deepSeekApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: DEEPSEEK_VISION_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: USER_PROMPT },
            { type: 'image_url', image_url: { url: request.imageDataUrl } },
          ],
        },
      ],
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new HttpError(502, 'DEEPSEEK_UPSTREAM_ERROR', 'DeepSeek 图片识别服务暂不可用');
  }

  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content ?? '';
  const holdings = normalizeRecognizedHoldings(content);

  if (holdings.length === 0) {
    throw new HttpError(422, 'HOLDINGS_NOT_RECOGNIZED', '未能从图片中识别出持仓，请换更清晰的持仓截图');
  }

  return { model: DEEPSEEK_VISION_MODEL, holdings };
}

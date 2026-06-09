'use client';

import { ScanText } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, type RecognizedHolding } from '../api';
import { isImageFile, recognizeImageText, type OcrProgress } from '../ocr';
import { ImportConfirmModal } from './ImportConfirmModal';
import { Card } from './ui/card';

const platformHints = [
  ['支付宝', 'alipay'],
  ['理财通', 'wechat'],
  ['微信', 'wechat'],
  ['天天', 'tiantian'],
  ['雪球', 'xueqiu'],
] as const;

function detectPlatform(line: string) {
  return platformHints.find(([keyword]) => line.includes(keyword))?.[1] ?? 'manual';
}

function normalizeAlipayText(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/([0-9]),([0-9]{3})(?=\D|$)/g, '$1$2')
    .replace(/[，、|]/g, ' ');
}

function detectAccountName(line: string) {
  if (line.includes('家庭')) return '家庭账本';
  if (line.includes('养老')) return '养老账本';
  if (line.includes('定投')) return '长期定投';
  return '默认账本';
}

const FUND_SUFFIX = /(指数|混合|股票|债券|ETF|联接|增强|主题|QDII|LOF|FOF|货币|纳斯达克|沪深|中证|创业板|科创|养殖|有色|电力|银行|白酒|消费|医药|金属|矿业|制造|科技|智能|公用事业)/;
const NOISE_LINE = /(我的持有|持有收益|偏股|偏债|更多产品|基金销售|投资锦囊|产品提醒|历史长牛|去市场|市场机会|排序|名称|当日|涨跌|蚂蚁|杭州)/;

function cleanFundName(raw: string) {
  return raw
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .replace(/定投$/, '')
    .replace(/^[·•。、,，]+|[·•。、,，]+$/g, '')
    .trim();
}

function parseAmount(token: string) {
  const value = Number(token.replace(/[+＋]/g, '').replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

// 仅把带千分位或小数点的数字视为金额（支付宝持有金额/收益恒为两位小数），
// 避免把基金名里的 100/300/500 等编号误当成金额。
const MONEY_TOKEN = /[+＋-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?%?|[+＋-]?\d+\.\d+%?/g;

// 支付宝「我的持有」截图没有基金代码，结构为：名称 + 持有金额 + 持有收益（+ 续行的当日收益 / 收益率）。
function parseAlipayHoldingScreenshot(text: string, preferredPlatform: string) {
  const now = new Date().toISOString();
  const holdings: Array<Record<string, unknown>> = [];
  const lines = text.replace(/\r/g, '\n').split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let pendingName = '';
  let counter = 0;

  lines.forEach((rawLine) => {
    // OCR 会在每个汉字之间插入空格，先压缩空白再做关键词/金额匹配。
    const line = rawLine.replace(/\s+/g, '');
    const amounts = (line.match(MONEY_TOKEN) ?? []);
    if (NOISE_LINE.test(line) && amounts.length === 0) {
      pendingName = '';
      return;
    }
    const textPart = cleanFundName(line.replace(MONEY_TOKEN, ' ').replace(/\d+/g, ''));

    // 纯名称行（无金额）：作为下一行的基金名称前缀。
    const firstAmount = amounts[0];
    if (!firstAmount) {
      if (FUND_SUFFIX.test(line) || line.length >= 4) pendingName = cleanFundName(`${pendingName}${line}`);
      return;
    }

    // 续行（当日收益/收益率行）：持有金额列永远是无符号正数，带 +/- 或 % 开头的首列说明这是上一只基金的涨跌续行。
    if (/^[+＋-]/.test(firstAmount) || firstAmount.includes('%')) {
      const latest = holdings.at(-1);
      const dailyProfit = parseAmount(firstAmount.replace('%', ''));
      if (latest && !firstAmount.includes('%') && dailyProfit !== undefined) {
        latest.recordedDailyProfit = Number(dailyProfit.toFixed(2));
        latest.updatedAt = now;
      }
      return;
    }

    const marketValue = parseAmount(firstAmount);
    const secondAmount = amounts[1];
    const profit = secondAmount ? parseAmount(secondAmount.replace('%', '')) : undefined;
    const name = cleanFundName(`${pendingName}${textPart}`);
    pendingName = '';

    if (marketValue === undefined || marketValue <= 0 || !name || name.length < 3) return;
    counter += 1;
    const recordedMarketValue = Number(marketValue.toFixed(2));
    const recordedProfit = profit !== undefined && secondAmount && !secondAmount.includes('%') ? Number(profit.toFixed(2)) : 0;
    holdings.push({
      id: `alipay-shot-${counter}`,
      fundCode: `ALIPAY${String(counter).padStart(3, '0')}`,
      fundName: name,
      recordedMarketValue,
      costAmount: Number((recordedMarketValue - recordedProfit).toFixed(2)),
      accountName: '默认账本',
      platform: preferredPlatform === 'manual' ? 'alipay' : preferredPlatform,
      createdAt: now,
      updatedAt: now,
    });
  });

  return holdings;
}

function readMaybeJsonHoldings(text: string) {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return undefined;
    if (Array.isArray((parsed as { holdings?: unknown }).holdings)) return JSON.stringify(parsed, null, 2);
    if (Array.isArray(parsed)) return JSON.stringify({ holdings: parsed, watchlist: [] }, null, 2);
    return undefined;
  } catch {
    return undefined;
  }
}

export function buildRecognizedImport(text: string, preferredPlatform = 'manual') {
  const normalizedText = normalizeAlipayText(text);
  const json = readMaybeJsonHoldings(normalizedText);
  if (json) return json;

  const now = new Date().toISOString();
  const holdings: Array<Record<string, unknown>> = [];
  const watchlist: Array<Record<string, unknown>> = [];

  normalizedText.split(/\n+/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    const code = line.match(/\b\d{6}\b/)?.[0];
    if (!code) return;
    const numbers = Array.from(line.matchAll(/(?:^|[^\d.])(\d+(?:\.\d+)?)(?=$|[^\d.])/g))
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value) && value !== Number(code));
    const name = line
      .replace(code, '')
      .replace(/支付宝|蚂蚁基金|理财通|微信|天天基金|天天|雪球|手动|默认账本|家庭账本|长期定投|养老账本/g, '')
      .replace(/基金代码|基金名称|持有份额|持仓份额|份额|持有金额|持仓金额|成本金额|成本|市值|收益|盈亏/g, '')
      .replace(/\d+(?:\.\d+)?/g, '')
      .replace(/[,\s，|/]+/g, ' ')
      .trim() || `基金 ${code}`;

    if (numbers.length >= 2) {
      holdings.push({
        id: `recognized-${code}-${index + 1}`,
        fundCode: code,
        fundName: name,
        shares: numbers[0],
        costAmount: numbers[1],
        accountName: detectAccountName(line),
        platform: detectPlatform(line) === 'manual' ? preferredPlatform : detectPlatform(line),
        createdAt: now,
        updatedAt: now,
      });
      return;
    }

    watchlist.push({ fundCode: code, fundName: name, createdAt: now });
  });

  // 代码式文本没识别到任何持仓时，回退到支付宝「我的持有」截图格式（无基金代码）。
  if (holdings.length === 0) {
    const screenshotHoldings = parseAlipayHoldingScreenshot(normalizedText, preferredPlatform);
    if (screenshotHoldings.length > 0) {
      return JSON.stringify({ holdings: screenshotHoldings, watchlist }, null, 2);
    }
  }

  return JSON.stringify({ holdings, watchlist }, null, 2);
}

// 把 DeepSeek 识别（并经用户确认）的持仓转换成本地账本导入契约 {holdings, watchlist}。
export function buildConfirmedImport(recognized: RecognizedHolding[], preferredPlatform = 'alipay') {
  const now = new Date().toISOString();
  const holdings = recognized
    .filter((item) => item.fundName.trim() && typeof item.marketValue === 'number' && item.marketValue > 0)
    .map((item, index) => {
      const marketValue = Number((item.marketValue as number).toFixed(2));
      const profit = typeof item.profit === 'number' ? Number(item.profit.toFixed(2)) : 0;
      const hasRealCode = item.fundCode && /^\d{6}$/.test(item.fundCode);
      return {
        id: hasRealCode ? `recognized-${item.fundCode}-${index + 1}` : `alipay-shot-${index + 1}`,
        fundCode: hasRealCode ? item.fundCode : `ALIPAY${String(index + 1).padStart(3, '0')}`,
        fundName: item.fundName.trim(),
        recordedMarketValue: marketValue,
        recordedDailyProfit: typeof item.dailyProfit === 'number' ? Number(item.dailyProfit.toFixed(2)) : undefined,
        costAmount: Number((marketValue - profit).toFixed(2)),
        accountName: item.accountName?.trim() || '默认账本',
        platform: preferredPlatform,
        createdAt: now,
        updatedAt: now,
      };
    });
  return JSON.stringify({ holdings, watchlist: [] }, null, 2);
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

export type ImageTextReader = (file: File, onProgress?: OcrProgress) => Promise<string>;
export type ImageHoldingsRecognizer = (imageText: string, imageDataUrl?: string) => Promise<{ model: string; holdings: RecognizedHolding[] }>;

export function SettingsPanel({
  importError,
  onImport,
  recognizeImage = api.recognizeHoldingsFromImage,
  ocrReader = recognizeImageText,
}: {
  importError?: string;
  onImport: (text: string) => void;
  recognizeImage?: ImageHoldingsRecognizer;
  ocrReader?: ImageTextReader;
}) {
  const alipayInputRef = useRef<HTMLInputElement>(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [alipayUploadNotice, setAlipayUploadNotice] = useState<string>();
  const [recognizePending, setRecognizePending] = useState(false);
  const [confirmModel, setConfirmModel] = useState<string>();
  const [confirmHoldings, setConfirmHoldings] = useState<RecognizedHolding[]>();
  const [confirmKey, setConfirmKey] = useState(0);

  async function handleAlipayFile(file: File) {
    setAlipayUploadNotice(undefined);
    if (isImageFile(file)) {
      setRecognizePending(true);
      setAlipayUploadNotice(`正在读取截图文字 ${file.name}……`);
      try {
        const imageDataUrl = await readFileAsDataUrl(file);
        const imageText = (await ocrReader(file, (status, progress) => {
          setAlipayUploadNotice(`正在读取截图文字 ${file.name}：${status} ${Math.round(progress * 100)}%`);
        })).trim();
        setRecognizedText(imageText);
        if (!imageText) {
          setAlipayUploadNotice('未从截图中读取到文字，请换更清晰的持仓截图。');
          return;
        }
        setAlipayUploadNotice(`正在用 DeepSeek 结构化识别 ${file.name}……`);
        const { model, holdings } = await recognizeImage(imageText, imageDataUrl);
        if (holdings.length === 0) {
          setAlipayUploadNotice('未从截图中识别到持仓，请换更清晰的持仓截图。');
          return;
        }
        setConfirmModel(model);
        setConfirmHoldings(holdings);
        setConfirmKey((current) => current + 1);
        setAlipayUploadNotice(`已识别截图 ${file.name}，请在弹窗中核对并确认导入。`);
      } catch (error) {
        setAlipayUploadNotice(error instanceof Error ? `截图识别失败：${error.message}` : '截图识别失败，请重试或改用文本/CSV 文件上传。');
      } finally {
        setRecognizePending(false);
      }
      return;
    }

    const text = await file.text();
    onImport(buildRecognizedImport(text, 'alipay'));
    setAlipayUploadNotice(`已读取 ${file.name}，并按支付宝账本导入本地持仓。`);
  }

  function confirmImport(holdings: RecognizedHolding[]) {
    onImport(buildConfirmedImport(holdings, 'alipay'));
    setConfirmHoldings(undefined);
    setConfirmModel(undefined);
    setAlipayUploadNotice(`已确认导入 ${holdings.length} 条持仓到本地账本。`);
  }

  function cancelImport() {
    setConfirmHoldings(undefined);
    setConfirmModel(undefined);
    setAlipayUploadNotice('已取消本次导入。');
  }

  return (
    <Card id="settings" className="lg:col-span-2">
      <div className="settings-data-card settings-import-assistant">
        <h3><ScanText className="h-5 w-5" />多平台导入助手</h3>
        <p>支持把支付宝、理财通、天天基金、雪球的持仓文字粘贴进来识别；也可以上传支付宝导出的文本、CSV、JSON，或直接上传持仓截图图片，由 DeepSeek 智能整理成结构化持仓，确认后导入。</p>
        <div className="settings-upload-strip">
          <label>
            <span>{recognizePending ? '截图识别中…' : '上传支付宝持仓文件或图片'}</span>
            <input
              ref={alipayInputRef}
              aria-label="上传支付宝持仓文件或图片"
              type="file"
              disabled={recognizePending}
              accept=".txt,.csv,.json,.png,.jpg,.jpeg,.webp,.bmp,text/plain,text/csv,application/json,image/png,image/jpeg,image/webp,image/bmp"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) await handleAlipayFile(file);
                if (alipayInputRef.current) alipayInputRef.current.value = '';
              }}
            />
          </label>
          <small>支持文本、CSV、JSON 与图片（PNG/JPG/JPEG/WebP/BMP）；图片先读取文字，再由 DeepSeek 结构化识别，识别后会弹出可编辑的确认弹窗，确认无误再导入。</small>
        </div>
        <textarea
          className="settings-export-area"
          aria-label="多平台持仓文本"
          placeholder="示例：支付宝 000001 华夏成长混合 1000 1235 默认账本"
          value={recognizedText}
          onChange={(event) => setRecognizedText(event.target.value)}
        />
        <button
          type="button"
          className="settings-import-button"
          onClick={() => onImport(buildRecognizedImport(recognizedText))}
          disabled={!recognizedText.trim()}
        >
          识别并导入本地账本
        </button>
        {importError && <p className="mt-3 rounded-3xl bg-red-50 p-3 text-sm font-semibold text-red-700">{importError}</p>}
        {alipayUploadNotice && <p className="settings-import-notice">{alipayUploadNotice}</p>}
      </div>
      <p className="settings-disclaimer">免责声明：本网站展示的数据仅用于学习和参考，不构成投资建议、收益承诺或交易依据。</p>
      <ImportConfirmModal
        key={confirmKey}
        open={Boolean(confirmHoldings)}
        model={confirmModel}
        holdings={confirmHoldings ?? []}
        onConfirm={confirmImport}
        onCancel={cancelImport}
      />
    </Card>
  );
}

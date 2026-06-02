'use client';

import { FileJson, ScanText, ServerCog, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { isImageFile, recognizeImageText, type OcrProgress } from '../ocr';
import { Badge } from './ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

export type ImageOcrReader = (file: File, onProgress?: OcrProgress) => Promise<string>;

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

  return JSON.stringify({ holdings, watchlist }, null, 2);
}

export function SettingsPanel({
  exportText,
  importError,
  onImport,
  ocrReader = recognizeImageText,
}: {
  exportText: string;
  importError?: string;
  onImport: (text: string) => void;
  ocrReader?: ImageOcrReader;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const alipayInputRef = useRef<HTMLInputElement>(null);
  const [recognizedText, setRecognizedText] = useState('');
  const [alipayUploadNotice, setAlipayUploadNotice] = useState<string>();
  const [ocrPending, setOcrPending] = useState(false);

  async function handleAlipayFile(file: File) {
    setAlipayUploadNotice(undefined);
    if (isImageFile(file)) {
      setOcrPending(true);
      setAlipayUploadNotice(`正在识别截图 ${file.name}……`);
      try {
        const text = await ocrReader(file, (status, progress) => {
          setAlipayUploadNotice(`正在识别截图 ${file.name}：${status} ${Math.round(progress * 100)}%`);
        });
        const recognized = text.trim();
        setRecognizedText(recognized);
        if (!recognized) {
          setAlipayUploadNotice('未从截图中识别到文字，请换更清晰的支付宝持仓截图。');
          return;
        }
        onImport(buildRecognizedImport(recognized, 'alipay'));
        setAlipayUploadNotice(`已识别截图 ${file.name} 并按支付宝账本导入，可在上方文本框核对识别结果。`);
      } catch {
        setAlipayUploadNotice('截图识别失败，请重试或改用文本/CSV 文件上传。');
      } finally {
        setOcrPending(false);
      }
      return;
    }

    const text = await file.text();
    onImport(buildRecognizedImport(text, 'alipay'));
    setAlipayUploadNotice(`已读取 ${file.name}，并按支付宝账本导入本地持仓。`);
  }

  return (
    <Card id="settings" className="lg:col-span-2">
      <CardHeader>
        <div>
          <Badge tone="blue" className="mb-2"><ServerCog className="h-3 w-3" /> Settings</Badge>
          <CardTitle>数据与部署说明</CardTitle>
          <CardDescription>浏览器本地数据、Resend 邮箱登录、Cloudflare D1 与 Worker 部署方案。</CardDescription>
        </div>
      </CardHeader>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="settings-data-card">
          <h3><FileJson className="h-5 w-5" />本地数据导出</h3>
          <textarea className="settings-export-area" aria-label="导出的本地数据" readOnly value={exportText} />
        </div>
        <div className="settings-data-card settings-data-card-muted">
          <h3><UploadCloud className="h-5 w-5" />导入 JSON 备份</h3>
          <input
            ref={inputRef}
            className="settings-file-input"
            aria-label="导入 JSON 备份"
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) onImport(await file.text());
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
          {importError && <p className="mt-3 rounded-3xl bg-red-50 p-3 text-sm font-semibold text-red-700">{importError}</p>}
          <div className="settings-help-copy">
            <p>持仓和自选默认只保存在当前浏览器，不上传服务端。</p>
            <p>线上 API 统一运行在 Cloudflare Worker / OpenNext；云端组合接口使用 D1，登录验证码由 Resend 发送，KV 行情缓存为部署路线图能力。</p>
          </div>
        </div>
      </div>
      <div className="mt-5 settings-data-card settings-import-assistant">
        <h3><ScanText className="h-5 w-5" />多平台导入助手</h3>
        <p>支持把支付宝、理财通、天天基金、雪球的持仓文字粘贴进来识别；也可以上传支付宝导出的文本、CSV、JSON，或直接上传支付宝持仓截图，由浏览器本地 OCR 识别成文字后导入。</p>
        <div className="settings-upload-strip">
          <label>
            <span>{ocrPending ? '截图识别中…' : '上传支付宝持仓文件或截图'}</span>
            <input
              ref={alipayInputRef}
              aria-label="上传支付宝持仓文件"
              type="file"
              disabled={ocrPending}
              accept=".txt,.csv,.json,text/plain,text/csv,application/json,image/png,image/jpeg,image/webp,image/bmp"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) await handleAlipayFile(file);
                if (alipayInputRef.current) alipayInputRef.current.value = '';
              }}
            />
          </label>
          <small>支持文本、CSV、JSON 与截图（PNG/JPG/WebP）；截图 OCR 在浏览器本地完成，数据不上传服务端。</small>
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
        {alipayUploadNotice && <p className="settings-import-notice">{alipayUploadNotice}</p>}
      </div>
      <p className="settings-disclaimer">免责声明：本网站展示的数据仅用于学习和参考，不构成投资建议、收益承诺或交易依据。</p>
    </Card>
  );
}

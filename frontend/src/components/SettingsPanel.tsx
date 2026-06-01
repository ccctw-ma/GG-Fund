'use client';

import { FileJson, ScanText, ServerCog, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from './ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

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

function buildRecognizedImport(text: string) {
  const now = new Date().toISOString();
  const holdings: Array<Record<string, unknown>> = [];
  const watchlist: Array<Record<string, unknown>> = [];

  text.split(/\n+/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    const code = line.match(/\b\d{6}\b/)?.[0];
    if (!code) return;
    const numbers = Array.from(line.matchAll(/(?:^|[^\d.])(\d+(?:\.\d+)?)(?=$|[^\d.])/g))
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value) && value !== Number(code));
    const name = line
      .replace(code, '')
      .replace(/支付宝|理财通|微信|天天基金|天天|雪球|手动|默认账本/g, '')
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
        accountName: line.includes('家庭') ? '家庭账本' : '默认账本',
        platform: detectPlatform(line),
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
}: {
  exportText: string;
  importError?: string;
  onImport: (text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [recognizedText, setRecognizedText] = useState('');

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
        <p>支持把支付宝、理财通、天天基金、雪球的持仓文字粘贴进来识别；截图 OCR 属于路线图能力，这里不伪造真实图片识别。</p>
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
      </div>
      <p className="settings-disclaimer">免责声明：本网站展示的数据仅用于学习和参考，不构成投资建议、收益承诺或交易依据。</p>
    </Card>
  );
}

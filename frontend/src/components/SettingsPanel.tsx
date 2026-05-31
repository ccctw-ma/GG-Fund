'use client';

import { FileJson, ServerCog, UploadCloud } from 'lucide-react';
import { useRef } from 'react';
import { Badge } from './ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/card';

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
      <p className="settings-disclaimer">免责声明：本网站展示的数据仅用于学习和参考，不构成投资建议、收益承诺或交易依据。</p>
    </Card>
  );
}

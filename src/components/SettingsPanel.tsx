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
          <CardDescription>浏览器本地数据、SQLite 服务端数据库和免费部署方案。</CardDescription>
        </div>
      </CardHeader>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950"><FileJson className="h-5 w-5" />本地数据导出</h3>
          <textarea className="min-h-52 w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs text-slate-600 outline-none" aria-label="导出的本地数据" readOnly value={exportText} />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold text-slate-950"><UploadCloud className="h-5 w-5" />导入 JSON 备份</h3>
          <input
            ref={inputRef}
            className="w-full rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600"
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) onImport(await file.text());
              if (inputRef.current) inputRef.current.value = '';
            }}
          />
          {importError && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm font-semibold text-red-700">{importError}</p>}
          <div className="mt-4 grid gap-3 text-sm text-slate-600">
            <p>持仓和自选默认只保存在当前浏览器，不上传服务端。</p>
            <p>服务端 SQLite 用于线上组合快照、行情缓存和后续账号同步扩展。</p>
          </div>
        </div>
      </div>
      <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-medium text-amber-800">免责声明：本网站展示的数据仅用于学习和参考，不构成投资建议、收益承诺或交易依据。</p>
    </Card>
  );
}

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
          <CardDescription>浏览器本地数据、Cloudflare D1/KV 和免费部署方案。</CardDescription>
        </div>
      </CardHeader>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[1.7rem] border border-[#10251f]/10 bg-[#10251f]/[0.04] p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-ink"><FileJson className="h-5 w-5" />本地数据导出</h3>
          <textarea className="min-h-52 w-full rounded-[1.35rem] border border-[#10251f]/10 bg-[#fffaf0]/80 p-4 font-mono text-xs text-ink/62 outline-none focus:border-[#047857] focus:ring-4 focus:ring-[#047857]/10" aria-label="导出的本地数据" readOnly value={exportText} />
        </div>
        <div className="rounded-[1.7rem] border border-[#10251f]/10 bg-white/64 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-ink"><UploadCloud className="h-5 w-5" />导入 JSON 备份</h3>
          <input
            ref={inputRef}
            className="w-full rounded-[1.35rem] border border-dashed border-[#10251f]/20 bg-[#fffaf0]/80 p-5 text-sm font-semibold text-ink/60"
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
          <div className="mt-4 grid gap-3 text-sm font-semibold text-ink/58">
            <p>持仓和自选默认只保存在当前浏览器，不上传服务端。</p>
            <p>线上 API 统一运行在 Cloudflare Pages Functions，D1/KV 用于组合、登录数据和行情缓存。</p>
          </div>
        </div>
      </div>
      <p className="mt-5 rounded-[1.35rem] bg-[#d4a84f]/18 p-4 text-sm font-bold text-[#7c5613]">免责声明：本网站展示的数据仅用于学习和参考，不构成投资建议、收益承诺或交易依据。</p>
    </Card>
  );
}

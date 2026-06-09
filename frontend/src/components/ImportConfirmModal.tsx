'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { RecognizedHolding } from '../api';

export type ImportConfirmModalProps = {
  open: boolean;
  model?: string;
  holdings: RecognizedHolding[];
  resolveFundCode?: (fundName: string) => Promise<{ fundCode: string; fundName: string } | undefined>;
  onConfirm: (holdings: RecognizedHolding[]) => void;
  onCancel: () => void;
};

type EditableRow = {
  fundName: string;
  fundCode: string;
  marketValue: string;
  profit: string;
};

function toRow(holding: RecognizedHolding): EditableRow {
  return {
    fundName: holding.fundName ?? '',
    fundCode: holding.fundCode ?? '',
    marketValue: holding.marketValue !== undefined ? String(holding.marketValue) : '',
    profit: holding.profit !== undefined ? String(holding.profit) : '',
  };
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(/[,，\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function ImportConfirmModal({ open, model, holdings, resolveFundCode, onConfirm, onCancel }: ImportConfirmModalProps) {
  const [rows, setRows] = useState<EditableRow[]>(() => holdings.map(toRow));
  const [resolvingIndex, setResolvingIndex] = useState<number>();

  if (!open) return null;

  function updateRow(index: number, patch: Partial<EditableRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function confirmCode(index: number) {
    const row = rows[index];
    if (!row?.fundName.trim() || !resolveFundCode) return;
    setResolvingIndex(index);
    try {
      const match = await resolveFundCode(row.fundName);
      if (match) {
        updateRow(index, { fundName: match.fundName, fundCode: match.fundCode });
      }
    } finally {
      setResolvingIndex(undefined);
    }
  }

  const normalized = rows
    .map((row) => {
      const fundName = row.fundName.trim();
      const codeRaw = row.fundCode.trim();
      const marketValue = parseNumber(row.marketValue);
      const profit = parseNumber(row.profit);
      const holding: RecognizedHolding = { fundName };
      if (/^\d{6}$/.test(codeRaw)) holding.fundCode = codeRaw;
      if (marketValue !== undefined) holding.marketValue = marketValue;
      if (profit !== undefined) holding.profit = profit;
      return holding;
    })
    .filter((holding) => holding.fundName.length >= 2 && holding.marketValue !== undefined && holding.marketValue > 0);

  return (
    <div className="import-confirm-overlay" role="dialog" aria-modal="true" aria-label="确认导入识别到的持仓">
      <div className="import-confirm-modal">
        <div className="import-confirm-head">
          <div>
            <h3>核对识别到的持仓</h3>
            <p>{model ? `由 ${model} 识别` : 'AI 识别'}，共 {rows.length} 条。可直接修改名称、代码、金额后再确认导入。</p>
          </div>
          <button type="button" className="import-confirm-close" aria-label="关闭" onClick={onCancel}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="import-confirm-table" role="table">
          <div className="import-confirm-row import-confirm-row-head" role="row">
            <span>基金名称</span>
            <span>代码</span>
            <span>持有金额</span>
            <span>持有收益</span>
            <span>确认代码</span>
            <span aria-hidden="true" />
          </div>
          {rows.length === 0 && <p className="import-confirm-empty">没有可导入的持仓，请取消后重试。</p>}
          {rows.map((row, index) => (
            <div className="import-confirm-row" role="row" key={index}>
              <input
                aria-label={`第 ${index + 1} 行基金名称`}
                value={row.fundName}
                onChange={(event) => updateRow(index, { fundName: event.target.value })}
              />
              <input
                aria-label={`第 ${index + 1} 行基金代码`}
                value={row.fundCode}
                placeholder="选填"
                onChange={(event) => updateRow(index, { fundCode: event.target.value })}
              />
              <input
                aria-label={`第 ${index + 1} 行持有金额`}
                inputMode="decimal"
                value={row.marketValue}
                onChange={(event) => updateRow(index, { marketValue: event.target.value })}
              />
              <input
                aria-label={`第 ${index + 1} 行持有收益`}
                inputMode="decimal"
                value={row.profit}
                onChange={(event) => updateRow(index, { profit: event.target.value })}
              />
              <button
                type="button"
                className="import-confirm-code"
                disabled={!resolveFundCode || resolvingIndex === index || !row.fundName.trim()}
                onClick={() => confirmCode(index)}
              >
                {resolvingIndex === index ? '查询中' : /^\d{6}$/.test(row.fundCode) ? '重新确认' : '查代码'}
              </button>
              <button type="button" className="import-confirm-remove" aria-label={`删除第 ${index + 1} 行`} onClick={() => removeRow(index)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="import-confirm-actions">
          <button type="button" className="import-confirm-cancel" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="import-confirm-submit"
            disabled={normalized.length === 0}
            onClick={() => onConfirm(normalized)}
          >
            确认导入 {normalized.length} 条
          </button>
        </div>
      </div>
    </div>
  );
}

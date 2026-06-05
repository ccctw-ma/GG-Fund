'use client';

import { Bot, Grip, LoaderCircle, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { FundAnalysisResponse } from '../types';

type AnalysisTarget = {
  code: string;
  name: string;
};

type PanelRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type InteractionMode = 'move' | 'resize-right' | 'resize-bottom' | 'resize-corner';

type Props = {
  target?: AnalysisTarget;
  analysis?: FundAnalysisResponse;
  loadingCode?: string;
  error?: string;
  onClose: () => void;
};

const MOBILE_BREAKPOINT = 720;
const VIEWPORT_PADDING = 12;
const MIN_PANEL_WIDTH = 320;
const MIN_PANEL_HEIGHT = 280;

function probabilityLabel(probability: 'low' | 'medium' | 'high') {
  if (probability === 'high') return '高概率';
  if (probability === 'low') return '低概率';
  return '中性情景';
}

function computeInitialRect() {
  const width = Math.min(420, window.innerWidth - 24);
  const height = Math.min(560, window.innerHeight - 108);
  return {
    x: Math.max(VIEWPORT_PADDING, window.innerWidth - width - 20),
    y: 82,
    width,
    height,
  };
}

function clampRect(rect: PanelRect) {
  const maxWidth = Math.max(MIN_PANEL_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
  const maxHeight = Math.max(MIN_PANEL_HEIGHT, window.innerHeight - VIEWPORT_PADDING * 2);
  const width = Math.min(maxWidth, Math.max(MIN_PANEL_WIDTH, rect.width));
  const height = Math.min(maxHeight, Math.max(MIN_PANEL_HEIGHT, rect.height));
  const x = Math.min(window.innerWidth - width - VIEWPORT_PADDING, Math.max(VIEWPORT_PADDING, rect.x));
  const y = Math.min(window.innerHeight - height - VIEWPORT_PADDING, Math.max(VIEWPORT_PADDING, rect.y));
  return { x, y, width, height };
}

export function FundAnalysisPanel({ target, analysis, loadingCode, error, onClose }: Props) {
  const [isMobile, setIsMobile] = useState(false);
  const [rect, setRect] = useState<PanelRect>();
  const interactionRef = useRef<{
    mode: InteractionMode;
    startX: number;
    startY: number;
    startRect: PanelRect;
  } | null>(null);

  useEffect(() => {
    if (!target) return;
    const syncViewportState = () => {
      const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      if (mobile) return;
      setRect((current) => clampRect(current ?? computeInitialRect()));
    };
    syncViewportState();
    window.addEventListener('resize', syncViewportState);
    return () => window.removeEventListener('resize', syncViewportState);
    }, [target]);

  useEffect(() => {
    if (!target || isMobile) return undefined;
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      if (!interaction) return;
      const deltaX = event.clientX - interaction.startX;
      const deltaY = event.clientY - interaction.startY;
      const nextRect = { ...interaction.startRect };
      if (interaction.mode === 'move') {
        nextRect.x += deltaX;
        nextRect.y += deltaY;
      }
      if (interaction.mode === 'resize-right' || interaction.mode === 'resize-corner') {
        nextRect.width += deltaX;
      }
      if (interaction.mode === 'resize-bottom' || interaction.mode === 'resize-corner') {
        nextRect.height += deltaY;
      }
      setRect(clampRect(nextRect));
    };
    const stopInteraction = () => {
      interactionRef.current = null;
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopInteraction);
    window.addEventListener('pointercancel', stopInteraction);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopInteraction);
      window.removeEventListener('pointercancel', stopInteraction);
      document.body.style.userSelect = '';
    };
  }, [isMobile, target]);

  const compactScenarios = useMemo(() => analysis?.report.scenarios.slice(0, 2) ?? [], [analysis]);

  if (!target) return null;

  function startInteraction(event: ReactPointerEvent<HTMLElement>, mode: InteractionMode) {
    if (isMobile || !rect) return;
    if (mode === 'move' && event.target instanceof Element && event.target.closest('button')) return;
    event.preventDefault();
    event.stopPropagation();
    interactionRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startRect: rect,
    };
    document.body.style.userSelect = 'none';
  }

  return (
    <aside
      className={`fund-ai-panel ${isMobile ? 'is-mobile' : 'is-floating'}`}
      aria-label={`${target.name} 智能分析面板`}
      style={!isMobile && rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : undefined}
    >
      <div className="fund-ai-panel-head" onPointerDown={(event) => startInteraction(event, 'move')}>
        <div>
          <span><Bot className="h-4 w-4" /> Deepseek Agent</span>
          <strong>{target.name} 智能分析</strong>
          <small>{target.code} · 可拖拽、可缩放的精简分析浮层</small>
        </div>
        <div className="fund-ai-panel-actions">
          {!isMobile && <Grip className="h-4 w-4 text-[rgba(226,232,240,.55)]" aria-hidden="true" />}
          <button type="button" onClick={onClose} aria-label="关闭智能分析">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {loadingCode === target.code && (
        <div className="fund-ai-loading">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          正在联网读取公开材料并生成分析…
        </div>
      )}
      {error && <p className="fund-ai-error">{error}</p>}
      {analysis && (
        <div className="fund-ai-body">
          <section className="fund-ai-summary-card">
            <h4>核心判断</h4>
            <p>{analysis.report.summary}</p>
          </section>
          <section className="fund-ai-grid">
            <div>
              <h4>驱动</h4>
              <p>{analysis.report.marketDrivers}</p>
            </div>
            <div>
              <h4>后续</h4>
              <p>{analysis.report.outlook}</p>
            </div>
          </section>
          <section className="fund-ai-grid">
            <div>
              <h4>趋势</h4>
              <p>{analysis.report.trend}</p>
            </div>
            <div>
              <h4>风险</h4>
              <p>{analysis.report.risk}</p>
            </div>
          </section>
          {analysis.report.watchPoints.length > 0 && (
            <section>
              <h4>关注点</h4>
              <div className="fund-ai-tags">
                {analysis.report.watchPoints.slice(0, 6).map((point) => <span key={point}>{point}</span>)}
              </div>
            </section>
          )}
          {compactScenarios.length > 0 && (
            <section>
              <h4>情景</h4>
              <ul className="fund-ai-scenario-list">
                {compactScenarios.map((scenario) => (
                  <li key={scenario.name}>
                    <strong>{scenario.name}</strong>
                    <em>{probabilityLabel(scenario.probability)}</em>
                    <span>{scenario.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h4>来源</h4>
            {analysis.researchSources.length > 0 ? (
              <div className="fund-ai-links">
                {analysis.researchSources.map((source) => (
                  <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                    {source.title}
                  </a>
                ))}
              </div>
            ) : (
              <p>本次未读取到可用公开网页材料，分析主要依据行情接口与历史净值。</p>
            )}
          </section>
          <p className="fund-ai-footnote">{analysis.report.disclaimer}</p>
        </div>
      )}
      {!isMobile && (
        <>
          <div className="fund-ai-resize-handle is-right" onPointerDown={(event) => startInteraction(event, 'resize-right')} />
          <div className="fund-ai-resize-handle is-bottom" onPointerDown={(event) => startInteraction(event, 'resize-bottom')} />
          <div className="fund-ai-resize-handle is-corner" onPointerDown={(event) => startInteraction(event, 'resize-corner')} />
        </>
      )}
    </aside>
  );
}

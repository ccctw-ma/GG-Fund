'use client';

import { Bot, LoaderCircle, SendHorizontal, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useMemo, useState, type FormEvent } from 'react';
import type { FundAnalysisResponse } from '../types';
import { Button } from './ui/button';

type AnalysisTarget = {
  code: string;
  name: string;
};

type Props = {
  target?: AnalysisTarget;
  analysis?: FundAnalysisResponse;
  loadingCode?: string;
  streamingStatus?: string;
  streamingDraft?: string;
  error?: string;
  followUpMessages?: Array<{ role: 'user' | 'assistant'; content: string; model?: string }>;
  followUpLoading?: boolean;
  followUpError?: string;
  onAskFollowUp?: (question: string) => Promise<void> | void;
  onClose: () => void;
};

function probabilityLabel(probability: 'low' | 'medium' | 'high') {
  if (probability === 'high') return '高概率';
  if (probability === 'low') return '低概率';
  return '中性情景';
}

export function FundAnalysisPanel({ target, analysis, loadingCode, streamingStatus, streamingDraft, error, followUpMessages = [], followUpLoading, followUpError, onAskFollowUp, onClose }: Props) {
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const suggestions = useMemo(() => [
    '现在适合加仓吗？',
    '最大风险是什么？',
    '接下来重点看哪些信号？',
  ], []);
  if (!target) return null;

  function submitFollowUp(question = followUpQuestion) {
    const normalized = question.trim();
    if (!normalized || followUpLoading) return;
    setFollowUpQuestion('');
    void onAskFollowUp?.(normalized);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitFollowUp();
  }

  const drawer = (
    <>
      <button className="fund-ai-drawer-scrim" type="button" aria-label="关闭智能分析抽屉" onClick={onClose} />
      <aside className="fund-ai-panel is-drawer" aria-label={`${target.name} 智能分析抽屉`}>
        <div className="fund-ai-panel-head">
          <div>
            <span><Bot className="h-4 w-4" /> Deepseek Agent</span>
            <strong>{target.name} 走势智能分析</strong>
            <small>{target.code} · 右侧抽屉 · 完整走势研判{analysis ? ` · ${analysis.agent.model}` : ''}</small>
          </div>
          <div className="fund-ai-panel-actions">
            <button type="button" onClick={onClose} aria-label="关闭智能分析">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {loadingCode === target.code && (
          <div className="fund-ai-loading">
            <LoaderCircle className="h-5 w-5 animate-spin" />
            {streamingStatus || '正在联网读取公开材料并生成分析…'}
          </div>
        )}
        {error && <p className="fund-ai-error">{error}</p>}
        {streamingDraft && (loadingCode === target.code || !analysis) && (
          <div className="fund-ai-stream">
            <h4>流式草稿</h4>
            <pre>{streamingDraft}</pre>
          </div>
        )}
        {analysis && (
          <div className="fund-ai-body">
            <section className="fund-ai-summary-card">
              <h4>核心判断</h4>
              <p>{analysis.report.summary}</p>
            </section>
            <section className="fund-ai-grid">
              <div>
                <h4>走势</h4>
                <p>{analysis.report.trend}</p>
              </div>
              <div>
                <h4>驱动</h4>
                <p>{analysis.report.marketDrivers}</p>
              </div>
              <div>
                <h4>后续</h4>
                <p>{analysis.report.outlook}</p>
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
                  {analysis.report.watchPoints.map((point) => <span key={point}>{point}</span>)}
                </div>
              </section>
            )}
            {analysis.report.scenarios.length > 0 && (
              <section>
                <h4>情景</h4>
                <ul className="fund-ai-scenario-list">
                  {analysis.report.scenarios.map((scenario) => (
                    <li key={scenario.name}>
                      <strong>{scenario.name}</strong>
                      <em>{probabilityLabel(scenario.probability)}</em>
                      <span>{scenario.description}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {analysis.report.sourceNotes.length > 0 && (
              <section>
                <h4>分析依据</h4>
                <ul className="fund-ai-source-note-list">
                  {analysis.report.sourceNotes.map((note) => <li key={note}>{note}</li>)}
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
            <section className="fund-ai-chat" aria-label="继续追问智能分析">
              <div className="fund-ai-chat-head">
                <div>
                  <h4>继续追问</h4>
                  <p>基于上面的分析结果继续问，DeepSeek 会结合当前行情和报告上下文回答。</p>
                </div>
                {followUpLoading && <LoaderCircle className="h-4 w-4 animate-spin" />}
              </div>
              {followUpMessages.length > 0 && (
                <div className="fund-ai-chat-log">
                  {followUpMessages.map((message, index) => (
                    <div className={`fund-ai-chat-bubble is-${message.role}`} key={`${message.role}-${index}-${message.content.slice(0, 12)}`}>
                      <strong>{message.role === 'user' ? '你' : message.model ? `DeepSeek · ${message.model}` : 'DeepSeek'}</strong>
                      <p>{message.content}</p>
                    </div>
                  ))}
                </div>
              )}
              {followUpMessages.length === 0 && (
                <div className="fund-ai-chat-suggestions" aria-label="追问建议">
                  {suggestions.map((item) => (
                    <button key={item} type="button" onClick={() => submitFollowUp(item)} disabled={followUpLoading || !onAskFollowUp}>{item}</button>
                  ))}
                </div>
              )}
              {followUpError && <p className="fund-ai-chat-error">{followUpError}</p>}
              <form className="fund-ai-chat-form" onSubmit={handleSubmit}>
                <textarea
                  aria-label="继续追问 DeepSeek"
                  value={followUpQuestion}
                  onChange={(event) => setFollowUpQuestion(event.target.value)}
                  placeholder="例如：这只基金现在适合继续持有还是先观察？"
                  maxLength={500}
                  disabled={!onAskFollowUp || followUpLoading}
                />
                <Button type="submit" size="sm" disabled={!followUpQuestion.trim() || !onAskFollowUp || followUpLoading}>
                  {followUpLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  发送
                </Button>
              </form>
            </section>
          </div>
        )}
      </aside>
    </>
  );

  return typeof document === 'undefined' ? null : createPortal(drawer, document.body);
}

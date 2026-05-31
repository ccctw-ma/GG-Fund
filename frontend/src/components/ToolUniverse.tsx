'use client';

import { ArrowUpRight } from 'lucide-react';
import { researchCatalog, statusLabels, type CatalogStatus } from '../researchCatalog';

function CatalogStatusPill({ status }: { status: CatalogStatus }) {
  return <span className={`catalog-status catalog-status-${status}`}>{statusLabels[status]}</span>;
}

export function ToolUniverse() {
  return (
    <section className="glass-section tool-universe" id="tool-universe" aria-labelledby="tool-universe-title">
      <div className="section-heading">
        <span className="section-kicker">Tool Universe</span>
        <h2 id="tool-universe-title">全景工具宇宙</h2>
        <p>把资产入口、研究工具、可信数据源和开源底座放进同一张地图里，帮助用户先理解能力边界，再进入工作台逐步使用。</p>
      </div>

      <div className="asset-rail" aria-label="资产导航矩阵">
        {researchCatalog.assetNavigation.map((item) => {
          const Icon = item.icon;
          return (
            <article className="asset-card" key={item.title}>
              <div className="asset-card-top">
                <span className="asset-card-icon"><Icon className="h-5 w-5" /></span>
                <CatalogStatusPill status={item.status} />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <small>{item.sourceHint}</small>
            </article>
          );
        })}
      </div>

      <div className="tool-matrix" aria-label="研究工具矩阵">
        {researchCatalog.toolGroups.map((group) => {
          const Icon = group.icon;
          return (
            <article className="tool-group-card" key={group.title}>
              <div className="tool-group-header">
                <span className="tool-group-icon"><Icon className="h-5 w-5" /></span>
                <div>
                  <h3>{group.title}</h3>
                  <p>{group.summary}</p>
                </div>
              </div>
              <ul className="capability-list">
                {group.capabilities.map((capability) => (
                  <li key={capability.title}>
                    <div>
                      <strong>{capability.title}</strong>
                      <p>{capability.description}</p>
                    </div>
                    <CatalogStatusPill status={capability.status} />
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <div className="source-grid" aria-label="数据与内容源">
        {researchCatalog.sourceGroups.map((group) => {
          const Icon = group.icon;
          return (
            <article className="source-card" key={group.title}>
              <div className="source-card-header">
                <span className="source-card-icon"><Icon className="h-5 w-5" /></span>
                <CatalogStatusPill status={group.status} />
              </div>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
              <div className="source-chip-row" aria-label={`${group.title} 示例`}>
                {group.examples.map((example) => (
                  <span className="source-chip" key={example}>{example}</span>
                ))}
              </div>
            </article>
          );
        })}
      </div>

      <div className="open-source-lab">
        <div className="section-heading tool-universe-heading-compact">
          <span className="section-kicker">Open Source Research Lab</span>
          <h3>开源研究底座</h3>
          <p>从数据采集、研究实验到可视化原型，优先复用成熟开源能力，把更多精力留给面向中国基金投资者的产品表达。</p>
        </div>
        <div className="open-source-grid" aria-label="开源能力栈">
          {researchCatalog.openSourceStack.map((item) => (
            <article className="open-source-card" key={item.name}>
              <div className="open-source-card-top">
                <strong>{item.name}</strong>
                <CatalogStatusPill status={item.status} />
              </div>
              <p>{item.description}</p>
              <small>适合：{item.bestFor}</small>
            </article>
          ))}
        </div>
        <a className="tool-universe-cta" href="#workspace">
          进入工作台核验接入优先级 <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}

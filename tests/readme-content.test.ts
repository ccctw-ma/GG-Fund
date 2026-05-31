import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readme = readFileSync('README.md', 'utf8');
const readmeEn = readFileSync('README.en.md', 'utf8');

describe('README content reconstruction', () => {
  it('documents the reconstructed Chinese fund tool universe', () => {
    expect(readme).toContain('全景工具宇宙');
    expect(readme).toContain('ETF / LOF');
    expect(readme).toContain('REITs');
    expect(readme).toContain('官方公告与高信任披露');
    expect(readme).toContain('AKShare / AKTools');
    expect(readme).toContain('Qlib');
    expect(readme).toContain('不构成投资建议');
  });

  it('keeps the English README aligned with user-facing capabilities', () => {
    expect(readmeEn).toContain('Tool Universe');
    expect(readmeEn).toContain('ETF / LOF');
    expect(readmeEn).toContain('REITs');
    expect(readmeEn).toContain('official disclosures');
    expect(readmeEn).toContain('AKShare / AKTools');
    expect(readmeEn).toContain('Qlib');
    expect(readmeEn).toContain('not investment advice');
  });
});

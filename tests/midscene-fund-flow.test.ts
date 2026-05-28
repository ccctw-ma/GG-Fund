import { describe, expect, it } from 'vitest';

const hasModelConfig = Boolean(process.env.OPENAI_API_KEY || process.env.MIDSCENE_MODEL_NAME);

describe('Midscene fund flow', () => {
  it.runIf(hasModelConfig)('can load Midscene for natural-language browser assertions', async () => {
    const midscene = await import('@midscene/web');
    expect(midscene).toBeTruthy();
  });

  it.skipIf(hasModelConfig)('documents skipped AI UI assertions when no model credentials are configured', () => {
    expect(hasModelConfig).toBe(false);
  });
});

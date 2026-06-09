import { describe, expect, it } from 'vitest';
import {
  normalizeRecognizeHoldingsRequest,
  normalizeRecognizedHoldings,
  recognizeHoldingsFromImage,
} from './recognizeHoldings';

const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('recognize holdings service', () => {
  it('validates the OCR text payload and optional image data url', () => {
    expect(normalizeRecognizeHoldingsRequest({ imageText: '招商中证白酒指数 5,000.00 +420.00', imageDataUrl: sampleDataUrl })).toEqual({
      imageText: '招商中证白酒指数 5,000.00 +420.00',
      imageDataUrl: sampleDataUrl,
    });
    expect(normalizeRecognizeHoldingsRequest({ imageText: '招商中证白酒指数 5,000.00 +420.00' })).toEqual({
      imageText: '招商中证白酒指数 5,000.00 +420.00',
    });
    expect(() => normalizeRecognizeHoldingsRequest({ imageText: '招商中证白酒指数', imageDataUrl: 'not-an-image' })).toThrow('图片数据格式不正确');
    expect(() => normalizeRecognizeHoldingsRequest({ imageDataUrl: sampleDataUrl })).toThrow('未从截图中读取到文字');
  });

  it('normalizes structured holdings while ignoring fabricated codes and empty names', () => {
    const content = JSON.stringify({
      holdings: [
        { fundName: '南方纳斯达克100指数（QDII）', fundCode: 'abc', marketValue: '19,710.25', profit: 1760.25, dailyProfit: 49.08 },
        { fundName: '华夏中证电网设备主题ETF联接C', fundCode: '012345', marketValue: 30289.47, profit: -776.8 },
        { fundName: '', marketValue: 1000 },
      ],
    });
    const holdings = normalizeRecognizedHoldings(content);

    expect(holdings).toHaveLength(2);
    expect(holdings[0]).toEqual({ fundName: '南方纳斯达克100指数', marketValue: 19710.25, profit: 1760.25, dailyProfit: 49.08 });
    expect(holdings[1]).toEqual({ fundName: '华夏中证电网设备主题ETF联接C', fundCode: '012345', marketValue: 30289.47, profit: -776.8 });
  });

  it('extracts JSON even when the model wraps it in extra text', () => {
    const content = '好的，识别结果如下：\n```json\n{"holdings":[{"fundName":"招商中证白酒指数","marketValue":5000}]}\n```';
    const holdings = normalizeRecognizedHoldings(content);
    expect(holdings).toEqual([{ fundName: '招商中证白酒指数', marketValue: 5000 }]);
  });

  it('throws when DeepSeek key is missing', async () => {
    await expect(recognizeHoldingsFromImage({ imageText: '招商中证白酒指数 5,000.00 +420.00' }, { deepSeekApiKey: undefined })).rejects.toThrow('未配置 DeepSeek API Key');
  });

  it('calls DeepSeek with an OCR text prompt and returns recognized holdings', async () => {
    let capturedBody: Record<string, unknown> = {};
    const deepSeekFetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body ?? '{}'));
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ holdings: [{ fundName: '招商中证白酒指数', marketValue: 5000, profit: 420 }] }) } }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const response = await recognizeHoldingsFromImage(
      { imageText: '招商中证白酒指数 5,000.00 +420.00', imageDataUrl: sampleDataUrl },
      { deepSeekApiKey: 'test-key', deepSeekFetch },
    );

    expect(response.model).toBe('deepseek-v4-flash');
    expect(response.holdings).toEqual([{ fundName: '招商中证白酒指数', marketValue: 5000, profit: 420 }]);
    const userMessage = (capturedBody.messages as Array<{ role: string; content: unknown }>).find((message) => message.role === 'user');
    expect(typeof userMessage?.content).toBe('string');
    expect(userMessage?.content).toContain('OCR 原文');
    expect(capturedBody.response_format).toEqual({ type: 'json_object' });
  });

  it('throws a friendly error when no holdings are recognized', async () => {
    const deepSeekFetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '{"holdings":[]}' } }] }), { status: 200 })) as unknown as typeof fetch;

    await expect(
      recognizeHoldingsFromImage({ imageText: '无法识别的截图文字', imageDataUrl: sampleDataUrl }, { deepSeekApiKey: 'test-key', deepSeekFetch }),
    ).rejects.toThrow('未能从图片中识别出持仓');
  });

  it('maps upstream errors to a 502 HttpError', async () => {
    const deepSeekFetch = (async () => new Response('error', { status: 500 })) as unknown as typeof fetch;

    await expect(
      recognizeHoldingsFromImage({ imageText: '招商中证白酒指数 5,000.00 +420.00', imageDataUrl: sampleDataUrl }, { deepSeekApiKey: 'test-key', deepSeekFetch }),
    ).rejects.toThrow('DeepSeek 图片识别服务暂不可用');
  });
});

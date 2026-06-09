import { describe, expect, it } from 'vitest';
import {
  extractTextFromImage,
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
    expect(normalizeRecognizeHoldingsRequest({ imageDataUrl: sampleDataUrl })).toEqual({ imageText: '', imageDataUrl: sampleDataUrl });
    expect(() => normalizeRecognizeHoldingsRequest(undefined)).toThrow('请上传图片或提供截图文字');
    expect(() => normalizeRecognizeHoldingsRequest({ imageText: 'x'.repeat(20_001) })).toThrow('截图文字过长');
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

  it('normalizes array roots, field aliases, account names, and invalid records', () => {
    const holdings = normalizeRecognizedHoldings(JSON.stringify([
      { name: '中银国有企业债债券C', amount: '43,919.06', profit: '+1,034.94', accountName: ' 家庭账本 ' },
      { fundName: 'A', value: 100 },
      null,
      { fundName: '华夏绿色电力ETF联接C', value: 'not-a-number', dailyProfit: '＋35.26' },
    ]));

    expect(holdings).toEqual([
      { fundName: '中银国有企业债债券C', marketValue: 43919.06, profit: 1034.94, accountName: '家庭账本' },
      { fundName: '华夏绿色电力ETF联接C', dailyProfit: 35.26 },
    ]);
    expect(normalizeRecognizedHoldings('no json here')).toEqual([]);
    expect(normalizeRecognizedHoldings('prefix {"holdings": [bad]} suffix')).toEqual([]);
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

  it('extracts text from images through OCR.space when only image data is provided', async () => {
    let capturedFormData: URLSearchParams | undefined;
    let capturedHeaders: HeadersInit | undefined;
    const ocrFetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedFormData = init?.body as URLSearchParams;
      capturedHeaders = init?.headers;
      return new Response(JSON.stringify({
        IsErroredOnProcessing: false,
        ParsedResults: [{ ParsedText: '招商中证白酒指数 5,000.00 +420.00' }],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const text = await extractTextFromImage(sampleDataUrl, { ocrSpaceApiKey: 'ocr-key', ocrFetch });

    expect(text).toBe('招商中证白酒指数 5,000.00 +420.00');
    expect(capturedFormData?.get('apikey')).toBe('ocr-key');
    expect(capturedFormData?.get('language')).toBe('chs');
    expect(capturedFormData?.get('base64Image')).toBe(sampleDataUrl);
    expect(capturedHeaders).toEqual({ 'content-type': 'application/x-www-form-urlencoded' });
  });

  it('maps OCR.space error and empty text branches', async () => {
    await expect(extractTextFromImage('bad-data-url')).rejects.toThrow('图片数据格式不正确');

    await expect(extractTextFromImage(sampleDataUrl, {
      ocrFetch: (async () => new Response('offline', { status: 503 })) as unknown as typeof fetch,
    })).rejects.toThrow('OCR.space 识别服务暂不可用');

    await expect(extractTextFromImage(sampleDataUrl, {
      ocrFetch: (async () => new Response(JSON.stringify({ IsErroredOnProcessing: true, ErrorMessage: ['限流', '图片过大'] }), { status: 200 })) as unknown as typeof fetch,
    })).rejects.toThrow('OCR.space 识别失败：限流；图片过大');

    await expect(extractTextFromImage(sampleDataUrl, {
      ocrFetch: (async () => new Response(JSON.stringify({ IsErroredOnProcessing: true }), { status: 200 })) as unknown as typeof fetch,
    })).rejects.toThrow('OCR.space 识别失败，请换更清晰的持仓截图');

    await expect(extractTextFromImage(sampleDataUrl, {
      ocrFetch: (async () => new Response(JSON.stringify({ ParsedResults: [{ ParsedText: '   ' }] }), { status: 200 })) as unknown as typeof fetch,
    })).rejects.toThrow('未从截图中读取到文字');

    await expect(extractTextFromImage(sampleDataUrl, {
      ocrFetch: (async () => new Response(JSON.stringify({ ParsedResults: [{ ParsedText: 'x'.repeat(20_001) }] }), { status: 200 })) as unknown as typeof fetch,
    })).rejects.toThrow('截图文字过长');
  });

  it('runs OCR.space first and then asks DeepSeek to structure the text', async () => {
    const ocrFetch = (async () =>
      new Response(JSON.stringify({
        IsErroredOnProcessing: false,
        ParsedResults: [{ ParsedText: '招商中证白酒指数 5,000.00 +420.00' }],
      }), { status: 200 })) as unknown as typeof fetch;
    let deepSeekPrompt = '';
    const deepSeekFetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as { messages: Array<{ role: string; content: string }> };
      deepSeekPrompt = body.messages.find((message) => message.role === 'user')?.content ?? '';
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({ holdings: [{ fundName: '招商中证白酒指数', marketValue: 5000, profit: 420 }] }) } }],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const response = await recognizeHoldingsFromImage(
      { imageText: '', imageDataUrl: sampleDataUrl },
      { deepSeekApiKey: 'test-key', deepSeekFetch, ocrFetch },
    );

    expect(deepSeekPrompt).toContain('招商中证白酒指数 5,000.00 +420.00');
    expect(response.holdings[0]).toMatchObject({ fundName: '招商中证白酒指数', marketValue: 5000 });
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

  it('rejects requests that still have no OCR text after normalization', async () => {
    await expect(
      recognizeHoldingsFromImage({ imageText: '' }, { deepSeekApiKey: 'test-key', deepSeekFetch: (async () => new Response('{}')) as unknown as typeof fetch }),
    ).rejects.toThrow('未从截图中读取到文字');
  });
});

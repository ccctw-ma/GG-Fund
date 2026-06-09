import { afterEach, describe, expect, it, vi } from 'vitest';

const tesseractMock = vi.hoisted(() => {
  let logger: ((message: { status: string; progress?: number }) => void) | undefined;
  const recognize = vi.fn(async () => ({ data: { text: '南方纳斯达克100' } }));
  const terminate = vi.fn(async () => undefined);
  return {
    recognize,
    terminate,
    createWorker: vi.fn(async (_langs: string, _workerPath: unknown, options?: { logger?: typeof logger }) => {
      logger = options?.logger;
      return { recognize, terminate };
    }),
    emitProgress: (message: { status: string; progress?: number }) => logger?.(message),
  };
});

vi.mock('tesseract.js', () => ({ createWorker: tesseractMock.createWorker }));

import { isImageFile, recognizeImageText, terminateOcrWorker } from './ocr';

describe('ocr helpers', () => {
  afterEach(async () => {
    await terminateOcrWorker();
    vi.clearAllMocks();
  });

  it('detects image files by mime type or extension', () => {
    expect(isImageFile(new File(['x'], 'holding.png', { type: 'image/png' }))).toBe(true);
    expect(isImageFile(new File(['x'], 'holding.WEBP', { type: '' }))).toBe(true);
    expect(isImageFile(new File(['x'], 'holding.txt', { type: 'text/plain' }))).toBe(false);
  });

  it('recognizes image text and forwards Tesseract progress', async () => {
    const progress = vi.fn();
    const file = new File(['image'], 'holding.jpg', { type: 'image/jpeg' });

    await expect(recognizeImageText(file, progress)).resolves.toBe('南方纳斯达克100');
    tesseractMock.emitProgress({ status: 'recognizing text', progress: 0.42 });

    expect(tesseractMock.createWorker).toHaveBeenCalledWith('chi_sim+eng', undefined, expect.any(Object));
    expect(tesseractMock.recognize).toHaveBeenCalledWith(file);
    expect(progress).toHaveBeenCalledWith('recognizing text', 0.42);
  });

  it('reuses and terminates the OCR worker', async () => {
    const first = new File(['1'], 'first.png', { type: 'image/png' });
    const second = new File(['2'], 'second.png', { type: 'image/png' });

    await recognizeImageText(first);
    await recognizeImageText(second);
    expect(tesseractMock.createWorker).toHaveBeenCalledTimes(1);

    await terminateOcrWorker();
    expect(tesseractMock.terminate).toHaveBeenCalledTimes(1);

    await recognizeImageText(first);
    expect(tesseractMock.createWorker).toHaveBeenCalledTimes(2);
  });
});

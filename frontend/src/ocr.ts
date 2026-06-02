export type OcrProgress = (status: string, progress: number) => void;

const OCR_LANGS = 'chi_sim+eng';

let workerPromise: Promise<import('tesseract.js').Worker> | undefined;

async function getWorker(onProgress?: OcrProgress) {
  const { createWorker } = await import('tesseract.js');
  if (!workerPromise) {
    workerPromise = createWorker(OCR_LANGS, undefined, {
      logger: (message) => {
        if (onProgress && typeof message.progress === 'number') {
          onProgress(message.status, message.progress);
        }
      },
    });
  }
  return workerPromise;
}

export function isImageFile(file: File) {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);
}

export async function recognizeImageText(file: File, onProgress?: OcrProgress): Promise<string> {
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(file);
  return data.text ?? '';
}

export async function terminateOcrWorker() {
  if (!workerPromise) return;
  const worker = await workerPromise;
  await worker.terminate();
  workerPromise = undefined;
}

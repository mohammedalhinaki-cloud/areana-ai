import { createId } from './fileUtils';
import type { PdfTaskPayload, PdfWorkerResponse } from './pdfTypes';

export function runPdfTask(payload: PdfTaskPayload, transferables: Transferable[] = []): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/pdf.worker.ts', import.meta.url), {
        type: 'module',
        name: 'study-pdf-worker',
      });
    } catch {
      reject(new Error('تعذّر تشغيل عامل معالجة PDF في هذا المتصفح.'));
      return;
    }

    const id = createId();
    const finish = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<PdfWorkerResponse>) => {
      if (event.data.id !== id) return;
      finish();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.data) resolve(new Uint8Array(event.data.data));
      else reject(new Error('لم ينتج عامل PDF ملفًا صالحًا.'));
    };
    worker.onerror = () => {
      finish();
      reject(new Error('حدث خطأ أثناء معالجة PDF. تحقق من سلامة الملف وحاول مجددًا.'));
    };

    try {
      worker.postMessage({ ...payload, id }, transferables);
    } catch (error) {
      finish();
      reject(error instanceof Error ? error : new Error('تعذّر إرسال الملف إلى عامل PDF.'));
    }
  });
}

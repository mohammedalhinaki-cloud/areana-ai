import { createId } from './fileUtils';
import type { CropRect } from './imageCore';

export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';
export type ImageTransformOptions = {
  width: number;
  height: number;
  crop?: CropRect;
  rotation: number;
  format: ImageFormat;
  quality: number;
};
export type ImageTransformResult = { blob: Blob; width: number; height: number; mime: ImageFormat };
type ImageWorkerResponse = {
  id: string;
  data?: ArrayBuffer;
  mime?: ImageFormat;
  width?: number;
  height?: number;
  error?: string;
};

export async function transformImage(file: File, options: ImageTransformOptions): Promise<ImageTransformResult> {
  const data = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/image.worker.ts', import.meta.url), {
        type: 'module',
        name: 'study-image-worker',
      });
    } catch {
      reject(new Error('تعذّر تشغيل عامل معالجة الصور في هذا المتصفح.'));
      return;
    }

    const id = createId();
    const finish = () => worker.terminate();
    worker.onmessage = (event: MessageEvent<ImageWorkerResponse>) => {
      if (event.data.id !== id) return;
      finish();
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else if (event.data.data && event.data.mime && event.data.width && event.data.height) {
        resolve({
          blob: new Blob([event.data.data], { type: event.data.mime }),
          mime: event.data.mime,
          width: event.data.width,
          height: event.data.height,
        });
      } else {
        reject(new Error('لم ينتج عامل الصور ملفًا صالحًا.'));
      }
    };
    worker.onerror = () => {
      finish();
      reject(new Error('حدث خطأ أثناء معالجة الصورة.'));
    };
    try {
      worker.postMessage({ id, data, mime: file.type, options }, [data]);
    } catch (error) {
      finish();
      reject(error instanceof Error ? error : new Error('تعذّر إرسال الصورة إلى عامل المعالجة.'));
    }
  });
}

export { clampCrop, fitDimensions, normalizeRotation } from './imageCore';
export type { CropRect } from './imageCore';

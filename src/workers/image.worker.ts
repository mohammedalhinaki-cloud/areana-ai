import { clampCrop, normalizeRotation, type CropRect } from '../services/imageCore';

type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp';
type ImageWorkerRequest = {
  id: string;
  data: ArrayBuffer;
  mime: string;
  options: {
    width: number;
    height: number;
    crop?: CropRect;
    rotation: number;
    format: ImageFormat;
    quality: number;
  };
};
type ImageWorkerResponse = {
  id: string;
  data?: ArrayBuffer;
  mime?: string;
  width?: number;
  height?: number;
  error?: string;
};
type WorkerScope = {
  onmessage: ((event: MessageEvent<ImageWorkerRequest>) => void) | null;
  postMessage: (message: ImageWorkerResponse, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = async (event) => {
  const { id, data, mime, options } = event.data;
  try {
    // LIMITATION: Canvas encoders are provided by the browser; if a requested format is unsupported, return an explicit error rather than changing the output format silently.
    if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
      throw new Error('متصفحك لا يدعم معالجة الصور داخل Web Worker (OffscreenCanvas).');
    }
    const bitmap = await createImageBitmap(new Blob([data], { type: mime }));
    const crop = clampCrop(options.crop, bitmap.width, bitmap.height);
    const targetWidth = Math.max(1, Math.min(12000, Math.round(options.width)));
    const targetHeight = Math.max(1, Math.min(12000, Math.round(options.height)));
    const rotation = normalizeRotation(options.rotation);
    const isQuarterTurn = rotation === 90 || rotation === 270;
    const canvasWidth = isQuarterTurn ? targetHeight : targetWidth;
    const canvasHeight = isQuarterTurn ? targetWidth : targetHeight;
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذّر إنشاء مساحة معالجة الصورة.');

    context.translate(canvasWidth / 2, canvasHeight / 2);
    context.rotate((rotation * Math.PI) / 180);
    context.drawImage(
      bitmap,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -targetWidth / 2,
      -targetHeight / 2,
      targetWidth,
      targetHeight,
    );
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: options.format,
      quality: Math.max(0.1, Math.min(1, options.quality)),
    });
    if (blob.type !== options.format) {
      throw new Error(`لا يدعم المتصفح إخراج ${options.format.replace('image/', '').toUpperCase()} من Canvas.`);
    }
    const output = await blob.arrayBuffer();
    workerScope.postMessage({ id, data: output, mime: blob.type, width: canvasWidth, height: canvasHeight }, [output]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذّرت معالجة الصورة.';
    workerScope.postMessage({ id, error: message });
  }
};

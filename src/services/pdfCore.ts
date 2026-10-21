import { PDFDocument } from 'pdf-lib';

export type ImagePdfOptions = {
  pageSize: 'a4' | 'original';
  orientation: 'portrait' | 'landscape';
  marginMm: number;
};

export type ImagePdfInput = {
  name: string;
  mime: string;
  data: ArrayBuffer;
  rotation: number;
};

const A4_PORTRAIT: [number, number] = [595.28, 841.89];
const MM_TO_POINTS = 72 / 25.4;

async function embedImage(
  document: PDFDocument,
  image: ImagePdfInput,
): Promise<{ embedded: Awaited<ReturnType<PDFDocument['embedPng']>>; width: number; height: number }> {
  const mime = image.mime.toLowerCase();
  const rotation = ((image.rotation % 360) + 360) % 360;
  const source = new Uint8Array(image.data);

  if (rotation === 0 && mime === 'image/png') {
    const embedded = await document.embedPng(source);
    return { embedded, width: embedded.width, height: embedded.height };
  }
  if (rotation === 0 && (mime === 'image/jpeg' || mime === 'image/jpg')) {
    const embedded = await document.embedJpg(source);
    return { embedded, width: embedded.width, height: embedded.height };
  }

  // LIMITATION: pdf-lib cannot embed WebP bytes directly. When WebP or rotation is requested, rasterize with the browser's OffscreenCanvas in this worker, then embed PNG/JPEG bytes.
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap !== 'function') {
    throw new Error('تعذّر تدوير الصورة أو تحويل WebP؛ يحتاج هذا الإجراء إلى OffscreenCanvas في المتصفح.');
  }

  const bitmap = await createImageBitmap(new Blob([image.data], { type: mime }));
  const swapDimensions = rotation === 90 || rotation === 270;
  const width = swapDimensions ? bitmap.height : bitmap.width;
  const height = swapDimensions ? bitmap.width : bitmap.height;
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذّر إنشاء مساحة رسم للصورة.');
  context.translate(width / 2, height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();

  const outputMime = mime === 'image/jpeg' || mime === 'image/jpg' ? 'image/jpeg' : 'image/png';
  const blob = await canvas.convertToBlob({ type: outputMime, quality: 0.94 });
  const data = new Uint8Array(await blob.arrayBuffer());
  const embedded = outputMime === 'image/jpeg' ? await document.embedJpg(data) : await document.embedPng(data);
  return { embedded, width: embedded.width, height: embedded.height };
}

export async function imagesToPdf(
  images: ImagePdfInput[],
  options: ImagePdfOptions,
): Promise<Uint8Array> {
  if (images.length === 0) throw new Error('أضف صورة واحدة على الأقل لإنشاء PDF.');
  const document = await PDFDocument.create();
  const margin = Math.max(0, Math.min(options.marginMm, 40)) * MM_TO_POINTS;

  for (const image of images) {
    const { embedded, width, height } = await embedImage(document, image);
    let pageWidth: number;
    let pageHeight: number;

    if (options.pageSize === 'a4') {
      [pageWidth, pageHeight] = A4_PORTRAIT;
      if (options.orientation === 'landscape') [pageWidth, pageHeight] = [pageHeight, pageWidth];
    } else if (options.orientation === 'landscape') {
      pageWidth = Math.max(width, height);
      pageHeight = Math.min(width, height);
    } else {
      pageWidth = Math.min(width, height);
      pageHeight = Math.max(width, height);
    }

    const effectiveMargin = Math.min(margin, (pageWidth - 1) / 2, (pageHeight - 1) / 2);
    const maxWidth = Math.max(1, pageWidth - effectiveMargin * 2);
    const maxHeight = Math.max(1, pageHeight - effectiveMargin * 2);
    const scale = Math.min(maxWidth / width, maxHeight / height);
    const drawWidth = width * scale;
    const drawHeight = height * scale;
    const page = document.addPage([pageWidth, pageHeight]);
    page.drawImage(embedded, {
      x: (pageWidth - drawWidth) / 2,
      y: (pageHeight - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight,
    });
  }

  return document.save();
}

export async function mergePdfDocuments(inputs: ArrayBuffer[]): Promise<Uint8Array> {
  if (inputs.length < 2) throw new Error('اختر ملفي PDF على الأقل للدمج.');
  const output = await PDFDocument.create();
  for (const input of inputs) {
    const source = await PDFDocument.load(input, { ignoreEncryption: false });
    const pages = await output.copyPages(source, source.getPageIndices());
    pages.forEach((page) => output.addPage(page));
  }
  return output.save();
}

export async function deletePdfPages(sourceBytes: ArrayBuffer, pageIndexes: number[]): Promise<Uint8Array> {
  const document = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  const pageCount = document.getPageCount();
  const validIndexes = [...new Set(pageIndexes)]
    .filter((index) => Number.isInteger(index) && index >= 0 && index < pageCount)
    .sort((left, right) => right - left);

  if (validIndexes.length === 0) throw new Error('حدّد صفحة واحدة على الأقل لحذفها.');
  if (validIndexes.length >= pageCount) throw new Error('لا يمكن حذف جميع صفحات المستند.');
  validIndexes.forEach((index) => document.removePage(index));
  return document.save();
}

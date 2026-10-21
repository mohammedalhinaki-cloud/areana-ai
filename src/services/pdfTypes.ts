import type { ImagePdfInput, ImagePdfOptions } from './pdfCore';

export type PdfTaskPayload =
  | { task: 'imagesToPdf'; images: ImagePdfInput[]; options: ImagePdfOptions }
  | { task: 'mergePdfs'; files: ArrayBuffer[] }
  | { task: 'deletePages'; data: ArrayBuffer; pageIndexes: number[] };

export type PdfWorkerRequest = PdfTaskPayload & { id: string };
export type PdfWorkerResponse = { id: string; data?: ArrayBuffer; error?: string };

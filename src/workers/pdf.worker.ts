import { deletePdfPages, imagesToPdf, mergePdfDocuments } from '../services/pdfCore';
import type { PdfWorkerRequest, PdfWorkerResponse } from '../services/pdfTypes';

type WorkerScope = {
  onmessage: ((event: MessageEvent<PdfWorkerRequest>) => void) | null;
  postMessage: (message: PdfWorkerResponse, transfer?: Transferable[]) => void;
};

const workerScope = self as unknown as WorkerScope;

workerScope.onmessage = async (event) => {
  const { id, ...request } = event.data;
  try {
    let output: Uint8Array;
    switch (request.task) {
      case 'imagesToPdf':
        output = await imagesToPdf(request.images, request.options);
        break;
      case 'mergePdfs':
        output = await mergePdfDocuments(request.files);
        break;
      case 'deletePages':
        output = await deletePdfPages(request.data, request.pageIndexes);
        break;
    }
    const outputBuffer = output.buffer as ArrayBuffer;
    workerScope.postMessage({ id, data: outputBuffer }, [outputBuffer]);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذّرت معالجة ملف PDF.';
    workerScope.postMessage({ id, error: message });
  }
};

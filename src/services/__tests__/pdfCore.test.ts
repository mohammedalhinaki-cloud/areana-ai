import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { deletePdfPages, imagesToPdf, mergePdfDocuments } from '../pdfCore';

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function makePdf(pageCount: number): Promise<ArrayBuffer> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) document.addPage([300, 400]);
  return asArrayBuffer(await document.save());
}

describe('PDF processing core', () => {
  it('merges input PDFs in order and keeps all pages', async () => {
    const merged = await mergePdfDocuments([await makePdf(1), await makePdf(2)]);
    const parsed = await PDFDocument.load(merged);
    expect(parsed.getPageCount()).toBe(3);
  });

  it('deletes selected pages but rejects deleting every page', async () => {
    const original = await makePdf(3);
    const edited = await deletePdfPages(original, [1]);
    expect((await PDFDocument.load(edited)).getPageCount()).toBe(2);
    await expect(deletePdfPages(original, [0, 1, 2])).rejects.toThrow('لا يمكن حذف جميع صفحات المستند');
  });

  it('creates a real A4 PDF page from a PNG image', async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC'), (character) => character.charCodeAt(0));
    const result = await imagesToPdf([
      { name: 'pixel.png', mime: 'image/png', data: asArrayBuffer(png), rotation: 0 },
    ], { pageSize: 'a4', orientation: 'portrait', marginMm: 10 });
    const parsed = await PDFDocument.load(result);
    expect(parsed.getPageCount()).toBe(1);
    expect(parsed.getPage(0).getSize().width).toBeCloseTo(595.28, 0);
  });
});

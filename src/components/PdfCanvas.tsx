import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

type PdfPageCanvasProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
};

export function PdfPageCanvas({ pdf, pageNumber, scale }: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [renderError, setRenderError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    setRenderError('');

    const drawPage = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
        const viewport = page.getViewport({ scale: scale * dpr });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) throw new Error('Canvas غير متاح في هذا المتصفح.');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (error) {
        if (!cancelled && !(error instanceof Error && error.name === 'RenderingCancelledException')) {
          setRenderError('تعذّر رسم هذه الصفحة.');
        }
      }
    };

    void drawPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pageNumber, pdf, scale]);

  return (
    <div className="pdf-canvas-wrap">
      <canvas ref={canvasRef} aria-label={`صفحة PDF رقم ${pageNumber}`} />
      {renderError && <p className="pdf-canvas-error" role="status">{renderError}</p>}
    </div>
  );
}

type PdfThumbnailProps = {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  onSelect: () => void;
  selected?: boolean;
  active?: boolean;
};

export function PdfThumbnail({ pdf, pageNumber, onSelect, selected = false, active = false }: PdfThumbnailProps) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '160px 0px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport) return undefined;
    let cancelled = false;
    let task: RenderTask | undefined;
    const render = async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const viewport = page.getViewport({ scale: 0.19 });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        task = page.render({ canvasContext: context, viewport });
        await task.promise;
      } catch {
        // A missing thumbnail does not block selecting or processing the page.
      }
    };
    void render();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [nearViewport, pageNumber, pdf]);

  return (
    <button
      ref={containerRef}
      type="button"
      className={`pdf-thumbnail${selected ? ' is-selected' : ''}${active ? ' is-active' : ''}`}
      aria-label={`صفحة رقم ${pageNumber}`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="pdf-thumbnail-paper"><canvas ref={canvasRef} /></span>
      <span className="pdf-thumbnail-label">{pageNumber}</span>
    </button>
  );
}

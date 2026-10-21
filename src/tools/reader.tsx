import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { get, set } from 'idb-keyval';
import { getDocument, type PDFDocumentProxy } from '../services/pdfjs';
import { BookOpen, ChevronLeft, ChevronRight, FileUp, ListTree, Maximize2, Minus, Plus, Search, X } from 'lucide-react';
import { PdfPageCanvas, PdfThumbnail } from '../components/PdfCanvas';
import { formatBytes } from '../services/fileUtils';
import { useToast } from '../providers/ToastProvider';

const LAST_PAGE_KEY_PREFIX = 'reader:last-page:v1:';

type OutlineItem = Awaited<ReturnType<PDFDocumentProxy['getOutline']>> extends (infer Item)[] ? Item : never;
type OutlineEntry = { title: string; page: number; depth: number };
type SearchHit = { page: number; snippet: string };

async function fileIdentity(file: File): Promise<string> {
  const seed = `${file.name}|${file.size}|${file.lastModified}`;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  // LIMITATION: In insecure contexts without Web Crypto, use a local non-cryptographic hash of the required metadata tuple.
  let hash = 2166136261;
  for (const char of seed) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(16);
}

async function flattenOutline(pdf: PDFDocumentProxy): Promise<OutlineEntry[]> {
  const items = await pdf.getOutline();
  if (!items?.length) return [];
  const flattened: OutlineEntry[] = [];

  const visit = async (nodes: OutlineItem[], depth: number) => {
    for (const node of nodes) {
      let page = 1;
      try {
        const destination = typeof node.dest === 'string' ? await pdf.getDestination(node.dest) : node.dest;
        if (Array.isArray(destination) && destination[0]) page = (await pdf.getPageIndex(destination[0])) + 1;
      } catch {
        // A malformed bookmark does not prevent other outline entries from being usable.
      }
      flattened.push({ title: node.title, page, depth });
      if (node.items?.length) await visit(node.items as OutlineItem[], depth + 1);
    }
  };

  await visit(items as OutlineItem[], 0);
  return flattened;
}

export default function ReaderTool() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [filename, setFilename] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [documentKey, setDocumentKey] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageAspect, setPageAspect] = useState(0.707);
  const [firstPageWidth, setFirstPageWidth] = useState(595);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(() => new Set());
  const [fitWidth, setFitWidth] = useState(true);
  const [fitScale, setFitScale] = useState(1);
  const [manualZoom, setManualZoom] = useState(1);
  const [jumpValue, setJumpValue] = useState('1');
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [panel, setPanel] = useState<'thumbnails' | 'outline'>('thumbnails');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [textAvailable, setTextAvailable] = useState<boolean | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [restorePage, setRestorePage] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const searchRequestRef = useRef(0);
  const { notify } = useToast();

  const renderScale = fitWidth ? fitScale : manualZoom;
  const pageNumbers = useMemo(() => Array.from({ length: pageCount }, (_, index) => index + 1), [pageCount]);

  useEffect(() => {
    if (!pdf || !scrollRef.current) return undefined;
    const root = scrollRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((entry) => entry.isIntersecting);
        setVisiblePages((previous) => {
          const next = new Set(previous);
          for (const entry of entries) {
            const pageNumber = Number((entry.target as HTMLElement).dataset.pageNumber);
            if (entry.isIntersecting) next.add(pageNumber);
            else next.delete(pageNumber);
          }
          return next;
        });
        if (intersecting.length > 0) {
          const mostVisible = intersecting.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
          const pageNumber = Number((mostVisible?.target as HTMLElement | undefined)?.dataset.pageNumber);
          if (pageNumber) setCurrentPage(pageNumber);
        }
      },
      { root, rootMargin: '520px 0px', threshold: [0, 0.12, 0.35, 0.65] },
    );
    root.querySelectorAll<HTMLElement>('[data-page-number]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pdf, pageCount]);

  useEffect(() => {
    if (!pdf || !scrollRef.current) return undefined;
    const root = scrollRef.current;
    const updateFit = () => {
      const availableWidth = Math.max(240, root.clientWidth - 40);
      setFitScale(Math.min(2.5, Math.max(0.25, availableWidth / firstPageWidth)));
    };
    updateFit();
    const observer = new ResizeObserver(updateFit);
    observer.observe(root);
    return () => observer.disconnect();
  }, [firstPageWidth, pdf]);

  useEffect(() => {
    if (!pdf || !documentKey || pageCount === 0) return;
    void set(`${LAST_PAGE_KEY_PREFIX}${documentKey}`, Math.max(1, Math.min(pageCount, currentPage))).catch(() => {
      // Reading is unaffected if IndexedDB is unavailable.
    });
  }, [currentPage, documentKey, pageCount, pdf]);

  useEffect(() => {
    if (!restorePage || !pdf) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(`reader-page-${restorePage}`)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      setRestorePage(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pdf, restorePage]);

  useEffect(() => () => {
    searchRequestRef.current += 1;
    void pdf?.destroy();
  }, [pdf]);

  const loadFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setLoadError('اختر ملف PDF صالحًا.');
      return;
    }
    setIsLoading(true);
    setLoadError('');
    setSearchHits([]);
    setTextAvailable(null);
    setOutline([]);
    setVisiblePages(new Set());
    setPdf(null);

    try {
      const identity = await fileIdentity(file);
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loadingTask = getDocument({ data: bytes, isEvalSupported: false });
      const loadedPdf = await loadingTask.promise;
      const firstPage = await loadedPdf.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      const savedPage = await get<number>(`${LAST_PAGE_KEY_PREFIX}${identity}`).catch(() => undefined);
      const startPage = Math.max(1, Math.min(loadedPdf.numPages, savedPage ?? 1));
      const outlineItems = await flattenOutline(loadedPdf).catch(() => []);

      setPdf(loadedPdf);
      setFilename(file.name);
      setFileSize(file.size);
      setDocumentKey(identity);
      setPageCount(loadedPdf.numPages);
      setCurrentPage(startPage);
      setJumpValue(String(startPage));
      setFirstPageWidth(viewport.width);
      setPageAspect(viewport.width / viewport.height);
      setOutline(outlineItems);
      setRestorePage(startPage);
      setFitWidth(true);
      notify('تم فتح ملف PDF بنجاح.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذّر فتح الملف.';
      setLoadError(message.includes('password') ? 'هذا الملف محمي بكلمة مرور ولا يمكن فتحه هنا.' : `تعذّر فتح الملف: ${message}`);
      notify('تعذّر فتح ملف PDF. تحقق من أن الملف غير تالف أو محمي.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void loadFile(file);
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void loadFile(file);
  };

  const jumpToPage = (page: number) => {
    if (!pageCount) return;
    const safePage = Math.max(1, Math.min(pageCount, Math.trunc(page)));
    setCurrentPage(safePage);
    setJumpValue(String(safePage));
    document.getElementById(`reader-page-${safePage}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const submitJump = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const page = Number(jumpValue);
    if (Number.isFinite(page)) jumpToPage(page);
  };

  const searchText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pdf || !searchQuery.trim()) return;
    const requestId = ++searchRequestRef.current;
    setIsSearching(true);
    setSearchHits([]);
    setTextAvailable(null);

    try {
      const query = searchQuery.trim().toLocaleLowerCase('ar');
      const hits: SearchHit[] = [];
      let hasAnyText = false;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (searchRequestRef.current !== requestId) return;
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const text = content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim();
        if (text) hasAnyText = true;
        const lowerText = text.toLocaleLowerCase('ar');
        const position = lowerText.indexOf(query);
        if (position >= 0) {
          const start = Math.max(0, position - 32);
          hits.push({ page: pageNumber, snippet: `${start > 0 ? '…' : ''}${text.slice(start, position + query.length + 52)}${position + query.length + 52 < text.length ? '…' : ''}` });
        }
      }
      if (searchRequestRef.current === requestId) {
        setTextAvailable(hasAnyText);
        setSearchHits(hits);
        if (!hasAnyText) notify('هذا المستند ممسوح ضوئيًا، البحث غير متاح.', 'info');
        else if (hits.length === 0) notify('لم يُعثر على العبارة في المستند.', 'info');
      }
    } catch {
      if (searchRequestRef.current === requestId) notify('تعذّر البحث في نص الملف.', 'error');
    } finally {
      if (searchRequestRef.current === requestId) setIsSearching(false);
    }
  };

  const changeZoom = (difference: number) => {
    setFitWidth(false);
    setManualZoom((value) => Math.max(0.4, Math.min(3, Math.round((value + difference) * 100) / 100)));
  };

  return (
    <section className="reader-tool tool-surface" aria-label="قارئ الملفات PDF">
      {!pdf && (
        <div
          className={`reader-empty-state${isDragging ? ' is-dragging' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
        >
          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={onFileChange} aria-label="اختر ملف PDF" />
          <span className="large-action-icon"><BookOpen size={30} aria-hidden="true" /></span>
          <h2>{isLoading ? 'جارٍ فتح المستند…' : 'ابدأ بقراءة ملفك'}</h2>
          <p>اسحب ملف PDF إلى هنا، أو اختره من جهازك. تتم القراءة محليًا في متصفحك.</p>
          <button className="primary-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
            <FileUp size={18} aria-hidden="true" /> اختيار ملف PDF
          </button>
          {loadError && <p className="tool-error-message" role="alert">{loadError}</p>}
          {isDragging && <span className="drop-hint">أفلت الملف لفتحه</span>}
        </div>
      )}

      {pdf && (
        <>
          <div className="reader-file-bar">
            <div className="reader-file-details">
              <span className="reader-file-icon"><BookOpen size={18} aria-hidden="true" /></span>
              <div><strong title={filename}>{filename}</strong><small>{formatBytes(fileSize)} · {pageCount} صفحة</small></div>
            </div>
            <label className="secondary-button reader-replace-label">
              <FileUp size={16} aria-hidden="true" /><span>فتح ملف آخر</span>
              <input type="file" accept="application/pdf,.pdf" onChange={onFileChange} aria-label="فتح ملف PDF آخر" />
            </label>
          </div>

          <div className="reader-toolbar" aria-label="أدوات قارئ PDF">
            <div className="reader-toolbar-group">
              <button type="button" className="square-control" onClick={() => changeZoom(-0.15)} disabled={!pdf} aria-label="تصغير" title="تصغير"><Minus size={17} /></button>
              <span className="zoom-value">{Math.round(renderScale * 100)}%</span>
              <button type="button" className="square-control" onClick={() => changeZoom(0.15)} disabled={!pdf} aria-label="تكبير" title="تكبير"><Plus size={17} /></button>
              <button type="button" className={`square-control fit-control${fitWidth ? ' is-selected' : ''}`} onClick={() => setFitWidth((value) => !value)} aria-label="ملاءمة العرض" aria-pressed={fitWidth} title="ملاءمة العرض"><Maximize2 size={17} /></button>
            </div>
            <form className="page-jump-form" onSubmit={submitJump} aria-label="الانتقال إلى صفحة">
              <label htmlFor="reader-page-number">صفحة</label>
              <input id="reader-page-number" type="number" min={1} max={pageCount} value={jumpValue} onChange={(event) => setJumpValue(event.target.value)} />
              <span>/ {pageCount}</span>
              <button type="submit" className="square-control" aria-label="انتقل إلى الصفحة"><ChevronLeft size={17} /></button>
            </form>
          </div>

          <div className="reader-body">
            <aside className="reader-side-panel" aria-label="مصغرات وفهرس المستند">
              <div className="reader-panel-tabs" role="tablist" aria-label="لوحة المستند">
                <button type="button" role="tab" aria-selected={panel === 'thumbnails'} className={panel === 'thumbnails' ? 'is-active' : ''} onClick={() => setPanel('thumbnails')}><span>الصفحات</span></button>
                <button type="button" role="tab" aria-selected={panel === 'outline'} className={panel === 'outline' ? 'is-active' : ''} onClick={() => setPanel('outline')}><span>الفهرس</span></button>
              </div>
              {panel === 'thumbnails' ? (
                <div className="reader-thumbnails" ref={thumbnailsRef} role="tabpanel" aria-label="مصغرات الصفحات">
                  {pageNumbers.map((pageNumber) => (
                    <PdfThumbnail key={pageNumber} pdf={pdf} pageNumber={pageNumber} active={currentPage === pageNumber} onSelect={() => jumpToPage(pageNumber)} />
                  ))}
                </div>
              ) : (
                <div className="reader-outline" role="tabpanel" aria-label="فهرس المستند">
                  {outline.length > 0 ? outline.map((item, index) => (
                    <button key={`${item.title}-${index}`} type="button" className="outline-link" style={{ paddingInlineStart: `${10 + item.depth * 15}px` }} onClick={() => jumpToPage(item.page)}>
                      <ListTree size={14} aria-hidden="true" /><span>{item.title}</span><small>{item.page}</small>
                    </button>
                  )) : <p className="muted-empty">لا يحتوي هذا الملف على فهرس.</p>}
                </div>
              )}
            </aside>

            <div className="reader-document-column">
              <form className="reader-search-form" onSubmit={searchText} role="search">
                <Search size={17} aria-hidden="true" />
                <label className="visually-hidden" htmlFor="reader-search">ابحث في نص المستند</label>
                <input id="reader-search" type="search" placeholder="ابحث في نص المستند" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} />
                {searchQuery && <button className="reader-search-clear" type="button" onClick={() => { setSearchQuery(''); setSearchHits([]); setTextAvailable(null); }} aria-label="مسح البحث"><X size={15} /></button>}
                <button type="submit" className="reader-search-submit" disabled={isSearching || !searchQuery.trim()}>{isSearching ? 'بحث…' : 'بحث'}</button>
              </form>
              {textAvailable === false && <p className="scanned-document-note" role="status">هذا المستند ممسوح ضوئيًا، البحث غير متاح. لا تتضمن الأداة تقنية OCR.</p>}
              {searchHits.length > 0 && <div className="search-hit-list" role="status">{searchHits.length} نتيجة
                {searchHits.slice(0, 12).map((hit) => <button type="button" key={hit.page} onClick={() => jumpToPage(hit.page)}><span>صفحة {hit.page}</span><small>{hit.snippet}</small></button>)}
              </div>}
              <div className="reader-stage" ref={scrollRef} aria-label="صفحات المستند">
                {pageNumbers.map((pageNumber) => (
                  <section
                    className={`reader-page-shell${currentPage === pageNumber ? ' is-current' : ''}`}
                    id={`reader-page-${pageNumber}`}
                    key={pageNumber}
                    data-page-number={pageNumber}
                    aria-label={`صفحة ${pageNumber}`}
                    style={{ aspectRatio: String(pageAspect) }}
                  >
                    {visiblePages.has(pageNumber)
                      ? <PdfPageCanvas pdf={pdf} pageNumber={pageNumber} scale={renderScale} />
                      : <div className="pdf-page-placeholder" aria-hidden="true" />}
                  </section>
                ))}
              </div>
            </div>
          </div>
          <div className="reader-mobile-page-control">
            <button type="button" className="square-control" onClick={() => jumpToPage(currentPage - 1)} disabled={currentPage <= 1} aria-label="الصفحة السابقة"><ChevronRight size={18} /></button>
            <span>صفحة {currentPage} من {pageCount}</span>
            <button type="button" className="square-control" onClick={() => jumpToPage(currentPage + 1)} disabled={currentPage >= pageCount} aria-label="الصفحة التالية"><ChevronLeft size={18} /></button>
          </div>
        </>
      )}
    </section>
  );
}

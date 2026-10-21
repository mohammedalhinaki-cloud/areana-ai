import { useEffect, useRef, useState } from 'react';
import { FileUp, RotateCcw, Scissors, Trash2, Undo2 } from 'lucide-react';
import type { PDFDocumentProxy } from '../services/pdfjs';
import { getDocument } from '../services/pdfjs';
import { PdfThumbnail } from '../components/PdfCanvas';
import { useToast } from '../providers/ToastProvider';
import { downloadBlob, formatBytes } from '../services/fileUtils';
import { runPdfTask } from '../services/pdfService';
import { parsePageRanges } from '../services/pageRanges';

export default function PdfPagesTool() {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [filename, setFilename] = useState('');
  const [sourceBytes, setSourceBytes] = useState<ArrayBuffer | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(() => new Set());
  const [range, setRange] = useState('');
  const [undoBytes, setUndoBytes] = useState<ArrayBuffer | null>(null);
  const [result, setResult] = useState<Blob | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  useEffect(() => () => { void pdf?.destroy(); }, [pdf]);

  const loadDocument = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      notify('اختر ملف PDF صالحًا.', 'error');
      return;
    }
    setIsLoading(true);
    try {
      const bytes = await file.arrayBuffer();
      const task = getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false });
      const loaded = await task.promise;
      setPdf(loaded);
      setFilename(file.name.replace(/\.pdf$/i, '') || 'document');
      setSourceBytes(bytes);
      setPageCount(loaded.numPages);
      setSelectedPages(new Set());
      setUndoBytes(null);
      setResult(null);
      notify('تم تحميل صفحات الملف.', 'success');
    } catch {
      notify('تعذّر فتح الملف. قد يكون تالفًا أو محميًا بكلمة مرور.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void loadDocument(file);
    event.target.value = '';
  };

  const togglePage = (pageIndex: number) => {
    setSelectedPages((current) => {
      const next = new Set(current);
      if (next.has(pageIndex)) next.delete(pageIndex);
      else next.add(pageIndex);
      return next;
    });
    setResult(null);
  };

  const selectRange = () => {
    try {
      setSelectedPages(new Set(parsePageRanges(range, pageCount)));
      setResult(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'النطاق غير صالح.', 'error');
    }
  };

  const deleteSelected = async () => {
    if (!sourceBytes || !pdf || isDeleting) return;
    if (selectedPages.size === 0) {
      notify('حدّد الصفحات المراد حذفها أولًا.', 'info');
      return;
    }
    if (selectedPages.size >= pageCount) {
      notify('لا يمكن حذف جميع صفحات المستند.', 'error');
      return;
    }

    setIsDeleting(true);
    try {
      const backup = sourceBytes.slice(0);
      const transferableBytes = sourceBytes.slice(0);
      const output = await runPdfTask(
        { task: 'deletePages', data: transferableBytes, pageIndexes: [...selectedPages] },
        [transferableBytes],
      );
      const nextBytes = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
      const nextPdf = await getDocument({ data: new Uint8Array(nextBytes.slice(0)), isEvalSupported: false }).promise;
      void pdf.destroy();
      setUndoBytes(backup);
      setSourceBytes(nextBytes);
      setPdf(nextPdf);
      setPageCount(nextPdf.numPages);
      setSelectedPages(new Set());
      setRange('');
      setResult(new Blob([output], { type: 'application/pdf' }));
      notify(`تم حذف الصفحات المحددة. بقيت ${nextPdf.numPages} صفحة.`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذّر حذف الصفحات.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const undoDelete = async () => {
    if (!undoBytes) return;
    try {
      const restored = await getDocument({ data: new Uint8Array(undoBytes.slice(0)), isEvalSupported: false }).promise;
      if (pdf) void pdf.destroy();
      setPdf(restored);
      setSourceBytes(undoBytes.slice(0));
      setPageCount(restored.numPages);
      setSelectedPages(new Set());
      setUndoBytes(null);
      setResult(null);
      notify('تم التراجع عن حذف الصفحات.', 'success');
    } catch {
      notify('تعذّر استعادة نسخة ما قبل الحذف.', 'error');
    }
  };

  return (
    <section className="pdf-pages-tool tool-surface" aria-label="حذف صفحات PDF">
      {!pdf ? (
        <div className="tool-upload-panel">
          <span className="large-action-icon"><Scissors size={28} aria-hidden="true" /></span>
          <h2>اختر ملف PDF لإدارة صفحاته</h2>
          <p>ستظهر معاينات الصفحات لتحديد ما تريد حذفه. لا يمكن حذف جميع الصفحات.</p>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" onChange={onFileChange} aria-label="اختر ملف PDF" />
          <button type="button" className="primary-button" onClick={() => fileInputRef.current?.click()} disabled={isLoading}><FileUp size={18} aria-hidden="true" /> {isLoading ? 'جارٍ التحميل…' : 'اختيار ملف PDF'}</button>
        </div>
      ) : (
        <>
          <div className="pdf-page-file-header">
            <div><strong>{filename}.pdf</strong><small>{pageCount} صفحة · {sourceBytes ? formatBytes(sourceBytes.byteLength) : ''}</small></div>
            <label className="secondary-button"><FileUp size={16} aria-hidden="true" /> اختيار ملف آخر<input type="file" accept="application/pdf,.pdf" onChange={onFileChange} aria-label="اختيار ملف PDF آخر" /></label>
          </div>
          <div className="page-range-tools">
            <label htmlFor="pdf-page-range">تحديد نطاق صفحات</label>
            <input id="pdf-page-range" type="text" inputMode="numeric" placeholder="مثال: 3-8، 10" value={range} onChange={(event) => setRange(event.target.value)} />
            <button type="button" className="secondary-button" onClick={selectRange}><RotateCcw size={15} aria-hidden="true" /> تحديد النطاق</button>
            <button type="button" className="text-button" onClick={() => setSelectedPages(new Set())} disabled={selectedPages.size === 0}>مسح التحديد</button>
          </div>
          <div className="pdf-pages-selection-summary">
            <span>المحدد: <strong>{selectedPages.size}</strong></span>
            <span>انقر على مصغّر الصفحة لتغيير التحديد</span>
          </div>
          <div className="pdf-pages-grid" aria-label="صفحات PDF">
            {Array.from({ length: pageCount }, (_, pageIndex) => (
              <PdfThumbnail
                key={`${pageCount}-${pageIndex}`}
                pdf={pdf}
                pageNumber={pageIndex + 1}
                selected={selectedPages.has(pageIndex)}
                onSelect={() => togglePage(pageIndex)}
              />
            ))}
          </div>
          <div className="tool-action-row page-delete-actions">
            <button type="button" className="primary-button danger-button" onClick={() => void deleteSelected()} disabled={isDeleting || selectedPages.size === 0 || selectedPages.size >= pageCount}>
              <Trash2 size={17} aria-hidden="true" /> {isDeleting ? 'جارٍ حذف الصفحات…' : `حذف ${selectedPages.size || ''} صفحة`}
            </button>
            <button type="button" className="secondary-button" onClick={() => void undoDelete()} disabled={!undoBytes}><Undo2 size={17} aria-hidden="true" /> تراجع</button>
            {result && <button type="button" className="secondary-button" onClick={() => downloadBlob(result, `${filename}-pages-edited.pdf`)}>تنزيل PDF المعدّل</button>}
          </div>
        </>
      )}
    </section>
  );
}

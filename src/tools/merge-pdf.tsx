import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FilePlus2, FileText, Files, Trash2 } from 'lucide-react';
import { useToast } from '../providers/ToastProvider';
import { createId, downloadBlob, formatBytes } from '../services/fileUtils';
import { runPdfTask } from '../services/pdfService';

type PdfFileItem = { id: string; file: File };

export default function MergePdfTool() {
  const [files, setFiles] = useState<PdfFileItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();
  const totalSize = files.reduce((total, item) => total + item.file.size, 0);

  const addFiles = (selected: FileList | File[]) => {
    const list = Array.from(selected);
    const pdfFiles = list.filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length !== list.length) notify('تم تجاهل الملفات التي ليست PDF.', 'info');
    if (pdfFiles.length === 0) return;
    setFiles((current) => [...current, ...pdfFiles.map((file) => ({ id: createId(), file }))]);
    setResult(null);
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  };

  const moveFile = (index: number, offset: number) => {
    setFiles((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
      return reordered;
    });
    setResult(null);
  };

  const mergeFiles = async () => {
    if (files.length < 2 || isMerging) return;
    setIsMerging(true);
    setResult(null);
    try {
      const buffers = await Promise.all(files.map(({ file }) => file.arrayBuffer()));
      const mergedBytes = await runPdfTask({ task: 'mergePdfs', files: buffers }, buffers);
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });
      setResult(blob);
      notify('تم دمج ملفات PDF بنجاح.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذّر دمج الملفات.', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <section className="merge-pdf-tool tool-surface" aria-label="دمج ملفات PDF">
      <div className="tool-intro-row">
        <span className="large-action-icon"><Files size={27} aria-hidden="true" /></span>
        <div><h2>اجمع ملفاتك في مستند واحد</h2><p>أضف ملفين أو أكثر، ثم رتّب التسلسل قبل الدمج.</p></div>
      </div>
      <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" multiple onChange={onFileChange} aria-label="اختر ملفات PDF للدمج" />
      <button type="button" className="secondary-button add-files-button" onClick={() => inputRef.current?.click()}><FilePlus2 size={17} aria-hidden="true" /> إضافة ملفات PDF</button>

      {files.length > 0 && (
        <>
          <div className="merge-summary"><span>{files.length} ملفات</span><span>الحجم الكلي: {formatBytes(totalSize)}</span></div>
          <ol className="merge-file-list" aria-label="ترتيب ملفات PDF للدمج">
            {files.map((item, index) => (
              <li className="merge-file-item" key={item.id}>
                <span className="merge-order-number">{index + 1}</span>
                <span className="merge-file-icon"><FileText size={20} aria-hidden="true" /></span>
                <div className="merge-file-info"><strong title={item.file.name}>{item.file.name}</strong><small>{formatBytes(item.file.size)}</small></div>
                <div className="merge-row-actions">
                  <button type="button" className="square-control" onClick={() => moveFile(index, -1)} disabled={index === 0} aria-label={`تحريك ${item.file.name} للأعلى`}><ArrowUp size={16} /></button>
                  <button type="button" className="square-control" onClick={() => moveFile(index, 1)} disabled={index === files.length - 1} aria-label={`تحريك ${item.file.name} للأسفل`}><ArrowDown size={16} /></button>
                  <button type="button" className="square-control danger-control" onClick={() => { setFiles((current) => current.filter(({ id }) => id !== item.id)); setResult(null); }} aria-label={`حذف ${item.file.name}`}><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ol>
          <div className="tool-action-row">
            <button type="button" className="primary-button" onClick={() => void mergeFiles()} disabled={files.length < 2 || isMerging}>
              <Files size={18} aria-hidden="true" /> {isMerging ? 'جارٍ الدمج…' : 'دمج الملفات'}
            </button>
            {result && <button type="button" className="secondary-button" onClick={() => downloadBlob(result, 'merged-document.pdf')}><FileText size={17} aria-hidden="true" /> تنزيل الملف · {formatBytes(result.size)}</button>}
          </div>
        </>
      )}
      {files.length === 0 && <p className="tool-helper-text">اختر ملفات PDF من جهازك. لا يتم رفعها إلى أي خادم.</p>}
    </section>
  );
}

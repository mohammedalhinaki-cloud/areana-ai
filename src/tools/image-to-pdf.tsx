import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ArrowDown, ArrowUp, FileImage, FileOutput, FilePlus2, RotateCw, Trash2 } from 'lucide-react';
import { useToast } from '../providers/ToastProvider';
import { createId, downloadBlob, formatBytes } from '../services/fileUtils';
import { runPdfTask } from '../services/pdfService';
import type { ImagePdfInput, ImagePdfOptions } from '../services/pdfCore';

type ImageItem = { id: string; file: File; previewUrl: string; rotation: number };
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function ImageToPdfTool() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<ImagePdfOptions['pageSize']>('a4');
  const [orientation, setOrientation] = useState<ImagePdfOptions['orientation']>('portrait');
  const [marginMm, setMarginMm] = useState(10);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef(new Set<string>());
  const { notify } = useToast();

  useEffect(() => () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const addFiles = (files: FileList | File[]) => {
    const supported = Array.from(files).filter((file) => ACCEPTED_IMAGE_TYPES.has(file.type));
    if (supported.length !== files.length) notify('تم تجاهل الملفات غير المدعومة. اختر JPG أو PNG أو WebP.', 'info');
    if (supported.length === 0) return;
    const nextItems = supported.map((file) => {
      const previewUrl = URL.createObjectURL(file);
      objectUrlsRef.current.add(previewUrl);
      return { id: createId(), file, previewUrl, rotation: 0 };
    });
    setImages((current) => [...current, ...nextItems]);
    setResult(null);
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) addFiles(event.target.files);
    event.target.value = '';
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        objectUrlsRef.current.delete(removed.previewUrl);
      }
      return current.filter((item) => item.id !== id);
    });
    setResult(null);
  };

  const moveImage = (index: number, offset: number) => {
    setImages((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
      return reordered;
    });
    setResult(null);
  };

  const rotateImage = (id: string) => {
    setImages((current) => current.map((item) => item.id === id ? { ...item, rotation: (item.rotation + 90) % 360 } : item));
    setResult(null);
  };

  const createPdf = async () => {
    if (images.length === 0 || isProcessing) return;
    setIsProcessing(true);
    setResult(null);
    try {
      const imagePayload: ImagePdfInput[] = await Promise.all(images.map(async (item) => ({
        name: item.file.name,
        mime: item.file.type,
        data: await item.file.arrayBuffer(),
        rotation: item.rotation,
      })));
      const buffers = imagePayload.map((image) => image.data);
      const pdfBytes = await runPdfTask(
        { task: 'imagesToPdf', images: imagePayload, options: { pageSize, orientation, marginMm } },
        buffers,
      );
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      setResult(blob);
      notify('تم إنشاء ملف PDF من الصور بنجاح.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذّر إنشاء ملف PDF.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <section className="image-to-pdf-tool tool-surface" aria-label="تحويل الصور إلى PDF">
      <div
        className={`file-dropzone${isDragging ? ' is-dragging' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
      >
        <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFileChange} aria-label="اختر صورًا للتحويل إلى PDF" />
        <span className="large-action-icon"><FileImage size={28} aria-hidden="true" /></span>
        <div><h2>أضف صورك إلى المستند</h2><p>JPG أو PNG أو WebP — يمكنك إضافة عدة صور وترتيبها قبل التحويل.</p></div>
        <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}><FilePlus2 size={17} aria-hidden="true" /> اختيار صور</button>
      </div>

      {images.length > 0 && (
        <>
          <div className="image-queue-heading"><h3>الصور المحددة <span>{images.length}</span></h3><span>اسحب الملفات أو استخدم أسهم الترتيب</span></div>
          <div className="image-queue">
            {images.map((item, index) => (
              <article className="image-queue-item" key={item.id}>
                <div className="image-queue-preview"><img src={item.previewUrl} alt={`معاينة ${item.file.name}`} style={{ transform: `rotate(${item.rotation}deg)` }} /></div>
                <div className="image-queue-copy"><strong title={item.file.name}>{item.file.name}</strong><small>{formatBytes(item.file.size)}{item.rotation ? ` · دوران ${item.rotation}°` : ''}</small></div>
                <div className="image-queue-actions">
                  <button type="button" className="square-control" onClick={() => rotateImage(item.id)} aria-label={`تدوير ${item.file.name}`} title="تدوير"><RotateCw size={16} /></button>
                  <button type="button" className="square-control" onClick={() => moveImage(index, -1)} disabled={index === 0} aria-label={`تحريك ${item.file.name} إلى الأعلى`} title="تحريك للأعلى"><ArrowUp size={16} /></button>
                  <button type="button" className="square-control" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1} aria-label={`تحريك ${item.file.name} إلى الأسفل`} title="تحريك للأسفل"><ArrowDown size={16} /></button>
                  <button type="button" className="square-control danger-control" onClick={() => removeImage(item.id)} aria-label={`حذف ${item.file.name}`} title="حذف الصورة"><Trash2 size={16} /></button>
                </div>
              </article>
            ))}
          </div>

          <div className="tool-settings-panel">
            <h3>إعدادات صفحة PDF</h3>
            <fieldset className="choice-fieldset">
              <legend>حجم الصفحة</legend>
              <label className="choice-chip"><input type="radio" name="image-pdf-size" value="a4" checked={pageSize === 'a4'} onChange={() => setPageSize('a4')} /><span>A4</span></label>
              <label className="choice-chip"><input type="radio" name="image-pdf-size" value="original" checked={pageSize === 'original'} onChange={() => setPageSize('original')} /><span>الحجم الأصلي</span></label>
            </fieldset>
            <fieldset className="choice-fieldset">
              <legend>الاتجاه</legend>
              <label className="choice-chip"><input type="radio" name="image-pdf-orientation" value="portrait" checked={orientation === 'portrait'} onChange={() => setOrientation('portrait')} /><span>عمودي</span></label>
              <label className="choice-chip"><input type="radio" name="image-pdf-orientation" value="landscape" checked={orientation === 'landscape'} onChange={() => setOrientation('landscape')} /><span>أفقي</span></label>
            </fieldset>
            <label className="number-setting">الهامش (ملم)
              <input type="number" min={0} max={40} value={marginMm} onChange={(event) => setMarginMm(Math.max(0, Math.min(40, Number(event.target.value) || 0)))} />
            </label>
          </div>

          <div className="tool-action-row">
            <button type="button" className="primary-button" onClick={() => void createPdf()} disabled={isProcessing || images.length === 0}>
              <FileOutput size={18} aria-hidden="true" /> {isProcessing ? 'جارٍ إنشاء PDF…' : 'إنشاء ملف PDF'}
            </button>
            {result && <button type="button" className="secondary-button" onClick={() => downloadBlob(result, 'images-to-pdf.pdf')}><FileOutput size={17} aria-hidden="true" /> تنزيل PDF · {formatBytes(result.size)}</button>}
          </div>
        </>
      )}
    </section>
  );
}

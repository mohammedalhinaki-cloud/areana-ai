import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import { Crop, Download, ImageDown, RotateCw, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useToast } from '../providers/ToastProvider';
import { downloadBlob, formatBytes } from '../services/fileUtils';
import { transformImage, type ImageFormat } from '../services/imageService';
import type { CropRect } from '../services/imageCore';

const FORMAT_CHOICES: { value: ImageFormat; label: string; extension: string }[] = [
  { value: 'image/jpeg', label: 'JPG', extension: 'jpg' },
  { value: 'image/png', label: 'PNG', extension: 'png' },
  { value: 'image/webp', label: 'WebP', extension: 'webp' },
];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

export default function ImageToolsTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [result, setResult] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState('');
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [outputWidth, setOutputWidth] = useState(0);
  const [outputHeight, setOutputHeight] = useState(0);
  const [keepAspect, setKeepAspect] = useState(true);
  const [format, setFormat] = useState<ImageFormat>('image/jpeg');
  const [quality, setQuality] = useState(0.82);
  const [rotation, setRotation] = useState(0);
  const [cropEnabled, setCropEnabled] = useState(false);
  const [cropRect, setCropRect] = useState<CropRect | undefined>();
  const [isSelectingCrop, setIsSelectingCrop] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const cropStageRef = useRef<HTMLDivElement>(null);
  const cropStartRef = useRef<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  const cropStyle = useMemo(() => {
    if (!cropEnabled || !cropRect || natural.width === 0 || natural.height === 0) return undefined;
    return {
      left: `${(cropRect.x / natural.width) * 100}%`,
      top: `${(cropRect.y / natural.height) * 100}%`,
      width: `${(cropRect.width / natural.width) * 100}%`,
      height: `${(cropRect.height / natural.height) * 100}%`,
    };
  }, [cropEnabled, cropRect, natural.height, natural.width]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [previewUrl, resultUrl]);

  const selectFile = (nextFile?: File) => {
    if (!nextFile) return;
    if (!nextFile.type.startsWith('image/')) {
      notify('اختر ملف صورة صالحًا.', 'error');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setResult(null);
    setResultUrl('');
    setNatural({ width: 0, height: 0 });
    setCropRect(undefined);
    setRotation(0);
    setFormat(nextFile.type === 'image/png' ? 'image/png' : 'image/jpeg');
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const onImageLoaded = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const width = event.currentTarget.naturalWidth;
    const height = event.currentTarget.naturalHeight;
    setNatural({ width, height });
    setOutputWidth(width);
    setOutputHeight(height);
    setCropRect({ x: 0, y: 0, width, height });
  };

  const getSourcePoint = (event: PointerEvent<HTMLDivElement>) => {
    const image = imageRef.current;
    if (!image || natural.width === 0 || natural.height === 0) return { x: 0, y: 0 };
    const bounds = image.getBoundingClientRect();
    return {
      x: Math.round(clamp((event.clientX - bounds.left) / bounds.width, 0, 1) * natural.width),
      y: Math.round(clamp((event.clientY - bounds.top) / bounds.height, 0, 1) * natural.height),
    };
  };

  const onCropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!cropEnabled || !natural.width || !natural.height) return;
    event.preventDefault();
    const point = getSourcePoint(event);
    cropStartRef.current = point;
    setIsSelectingCrop(true);
    setCropRect({ x: point.x, y: point.y, width: 1, height: 1 });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCropPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = cropStartRef.current;
    if (!cropEnabled || !start) return;
    const point = getSourcePoint(event);
    const nextCrop = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.max(1, Math.abs(point.x - start.x)),
      height: Math.max(1, Math.abs(point.y - start.y)),
    };
    setCropRect(nextCrop);
    if (keepAspect) setOutputHeight(Math.max(1, Math.round(outputWidth * nextCrop.height / nextCrop.width)));
    setResult(null);
  };

  const finishCropSelection = () => {
    cropStartRef.current = null;
    setIsSelectingCrop(false);
  };

  const resetCrop = () => {
    setCropRect({ x: 0, y: 0, width: natural.width, height: natural.height });
    setResult(null);
  };

  const updateWidth = (value: number) => {
    const width = clamp(Math.round(value || 1), 1, 12000);
    setOutputWidth(width);
    if (keepAspect && cropRect) setOutputHeight(Math.max(1, Math.round(width * cropRect.height / cropRect.width)));
    setResult(null);
  };

  const updateHeight = (value: number) => {
    const height = clamp(Math.round(value || 1), 1, 12000);
    setOutputHeight(height);
    if (keepAspect && cropRect) setOutputWidth(Math.max(1, Math.round(height * cropRect.width / cropRect.height)));
    setResult(null);
  };

  const processImage = async () => {
    if (!file || !natural.width || isProcessing) return;
    setIsProcessing(true);
    try {
      const transformed = await transformImage(file, {
        width: outputWidth,
        height: outputHeight,
        crop: cropEnabled ? cropRect : undefined,
        rotation,
        format,
        quality,
      });
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      const url = URL.createObjectURL(transformed.blob);
      setResult(transformed.blob);
      setResultUrl(url);
      notify('تمت معالجة الصورة بنجاح.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذّرت معالجة الصورة.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const extension = FORMAT_CHOICES.find((choice) => choice.value === format)?.extension ?? 'jpg';

  return (
    <section className="image-tools-tool tool-surface" aria-label="أدوات الصور">
      <div className="tool-intro-row">
        <span className="large-action-icon"><SlidersHorizontal size={26} aria-hidden="true" /></span>
        <div><h2>تحكّم في أبعاد الصورة وصيغتها</h2><p>القص والتدوير والتحجيم والتحويل تتم داخل المتصفح باستخدام Canvas وWeb Worker.</p></div>
      </div>
      <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" onChange={onFileChange} aria-label="اختر صورة للتعديل" />
      {!file ? (
        <button type="button" className="image-tool-upload" onClick={() => fileInputRef.current?.click()}><ImageDown size={23} aria-hidden="true" /><span>اختيار صورة</span><small>JPG · PNG · WebP</small></button>
      ) : (
        <>
          <div className="image-editor-grid">
            <div className="image-editor-preview-column">
              <div className="image-editor-preview-top"><strong>معاينة الصورة</strong><span>{natural.width} × {natural.height} px</span></div>
              <div className={`image-preview-outer${cropEnabled ? ' crop-mode' : ''}`}>
                <div
                  className="image-preview-stage"
                  ref={cropStageRef}
                  onPointerDown={onCropPointerDown}
                  onPointerMove={onCropPointerMove}
                  onPointerUp={finishCropSelection}
                  onPointerCancel={finishCropSelection}
                  onLostPointerCapture={finishCropSelection}
                >
                  <img ref={imageRef} src={previewUrl} alt="معاينة الصورة الأصلية" onLoad={onImageLoaded} draggable={false} />
                  {cropEnabled && cropStyle && <span className={`crop-selection${isSelectingCrop ? ' is-dragging' : ''}`} style={cropStyle} aria-label="منطقة القص المحددة" />}
                </div>
              </div>
              <div className="source-size-row"><span>الحجم الأصلي</span><strong>{formatBytes(file.size)}</strong></div>
            </div>

            <div className="image-editor-controls">
              <div className="editor-control-block">
                <h3>الأبعاد</h3>
                <div className="dimension-inputs">
                  <label>العرض (px)<input type="number" min={1} max={12000} value={outputWidth} onChange={(event) => updateWidth(Number(event.target.value))} /></label>
                  <span aria-hidden="true">×</span>
                  <label>الارتفاع (px)<input type="number" min={1} max={12000} value={outputHeight} onChange={(event) => updateHeight(Number(event.target.value))} /></label>
                </div>
                <label className="toggle-setting"><input type="checkbox" checked={keepAspect} onChange={(event) => { const enabled = event.target.checked; setKeepAspect(enabled); if (enabled && cropRect) setOutputHeight(Math.max(1, Math.round(outputWidth * cropRect.height / cropRect.width))); }} /><span>الحفاظ على نسبة الأبعاد</span></label>
              </div>
              <div className="editor-control-block">
                <h3>صيغة الإخراج</h3>
                <div className="segmented-choices" role="radiogroup" aria-label="صيغة الصورة">
                  {FORMAT_CHOICES.map((choice) => <label className={format === choice.value ? 'is-selected' : ''} key={choice.value}><input type="radio" name="image-format" checked={format === choice.value} onChange={() => setFormat(choice.value)} /><span>{choice.label}</span></label>)}
                </div>
                {format !== 'image/png' && <label className="quality-setting">الجودة <strong>{Math.round(quality * 100)}%</strong><input type="range" min={10} max={100} value={Math.round(quality * 100)} onChange={(event) => setQuality(Number(event.target.value) / 100)} /></label>}
              </div>
              <div className="editor-control-block">
                <h3>القص والتدوير</h3>
                <div className="editor-tools-row">
                  <button type="button" className={`secondary-button${cropEnabled ? ' is-selected' : ''}`} onClick={() => setCropEnabled((value) => !value)} aria-pressed={cropEnabled}><Crop size={16} aria-hidden="true" /> {cropEnabled ? 'إنهاء القص' : 'تفعيل القص'}</button>
                  {cropEnabled && <button type="button" className="text-button" onClick={resetCrop}>إعادة ضبط القص</button>}
                  <button type="button" className="secondary-button" onClick={() => { setRotation((value) => (value + 90) % 360); setResult(null); }}><RotateCw size={16} aria-hidden="true" /> تدوير 90°</button>
                  {rotation !== 0 && <button type="button" className="square-control" onClick={() => setRotation(0)} aria-label="إلغاء التدوير"><RotateCcw size={16} /></button>}
                </div>
                {cropEnabled && <p className="crop-help">اسحب داخل الصورة لتحديد مساحة القص.</p>}
              </div>
            </div>
          </div>

          <div className="tool-action-row image-process-actions">
            <button type="button" className="primary-button" onClick={() => void processImage()} disabled={isProcessing || !natural.width}><SlidersHorizontal size={17} aria-hidden="true" /> {isProcessing ? 'جارٍ المعالجة…' : 'معالجة الصورة'}</button>
            <button type="button" className="text-button" onClick={() => fileInputRef.current?.click()}>اختيار صورة أخرى</button>
          </div>
          {result && resultUrl && (
            <div className="image-result-panel">
              <div className="image-result-preview"><img src={resultUrl} alt="معاينة الصورة بعد المعالجة" /></div>
              <div className="image-result-details"><p className="eyebrow">نتيجة المعالجة</p><h3>الصورة جاهزة</h3><p>{natural.width} × {natural.height} px <span>→</span> {rotation % 180 === 0 ? outputWidth : outputHeight} × {rotation % 180 === 0 ? outputHeight : outputWidth} px · {extension.toUpperCase()}</p><div className="size-comparison"><span>قبل <strong>{formatBytes(file.size)}</strong></span><span>بعد <strong>{formatBytes(result.size)}</strong></span><span>التوفير <strong>{file.size > result.size ? `${Math.round((1 - result.size / file.size) * 100)}%` : '0%'}</strong></span></div><button type="button" className="secondary-button" onClick={() => downloadBlob(result, `image-edited.${extension}`)}><Download size={16} aria-hidden="true" /> تنزيل الصورة</button></div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

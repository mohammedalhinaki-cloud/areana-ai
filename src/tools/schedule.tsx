import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { get, set } from 'idb-keyval';
import { CalendarDays, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useToast } from '../providers/ToastProvider';
import { createId, downloadBlob } from '../services/fileUtils';
import { findScheduleConflicts, type ScheduleEntry } from '../services/scheduleService';
import { runPdfTask } from '../services/pdfService';

const DAYS = [
  { id: 'sun', label: 'الأحد' }, { id: 'mon', label: 'الإثنين' }, { id: 'tue', label: 'الثلاثاء' },
  { id: 'wed', label: 'الأربعاء' }, { id: 'thu', label: 'الخميس' }, { id: 'fri', label: 'الجمعة' }, { id: 'sat', label: 'السبت' },
] as const;
type DayId = typeof DAYS[number]['id'];
type ScheduleTemplate = 'simple' | 'modern' | 'dark' | 'calm' | 'formal';
type ScheduleData = { title: string; entries: ScheduleEntry[]; template: ScheduleTemplate; accent: string; background: string };
const STORAGE_KEY = 'study-schedule:v1';
const DEFAULT_DATA: ScheduleData = { title: 'جدولي الدراسي', entries: [], template: 'modern', accent: '#3975dd', background: '#f7f9fc' };
const TEMPLATES: { id: ScheduleTemplate; label: string }[] = [
  { id: 'simple', label: 'بسيط' }, { id: 'modern', label: 'عصري' }, { id: 'dark', label: 'داكن' },
  { id: 'calm', label: 'هادئ' }, { id: 'formal', label: 'رسمي' },
];

function isValidEntry(entry: ScheduleEntry) {
  return entry.subject.trim().length > 0 && entry.days.length > 0 && entry.start < entry.end;
}

export default function ScheduleTool() {
  const [data, setData] = useState<ScheduleData>(DEFAULT_DATA);
  const [loaded, setLoaded] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [days, setDays] = useState<DayId[]>([]);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('10:00');
  const [room, setRoom] = useState('');
  const [instructor, setInstructor] = useState('');
  const [lectureColor, setLectureColor] = useState('#3975dd');
  const [isExporting, setIsExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const { notify } = useToast();

  useEffect(() => {
    let active = true;
    void get<ScheduleData>(STORAGE_KEY).then((saved) => {
      if (active && saved && Array.isArray(saved.entries)) {
        setData({ ...DEFAULT_DATA, ...saved });
        setLectureColor(saved.accent || DEFAULT_DATA.accent);
      }
    }).catch(() => notify('تعذّر تحميل الجدول المحفوظ.', 'error')).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    if (!loaded) return;
    void set(STORAGE_KEY, data).catch(() => notify('تعذّر حفظ الجدول في IndexedDB.', 'error'));
  }, [data, loaded, notify]);

  const candidate: ScheduleEntry = { id: editingId ?? 'draft-entry', subject, days, start, end, room, instructor, color: lectureColor };
  const conflicts = useMemo(() => isValidEntry(candidate) ? findScheduleConflicts(candidate, data.entries, editingId ?? undefined) : [], [candidate, data.entries, editingId]);
  const validInterval = start < end;
  const canSubmit = subject.trim().length > 0 && days.length > 0 && validInterval && conflicts.length === 0;

  const updateData = (patch: Partial<ScheduleData>) => setData((current) => ({ ...current, ...patch }));
  const toggleDay = (day: DayId) => setDays((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);

  const resetForm = () => {
    setEditingId(null); setSubject(''); setDays([]); setStart('09:00'); setEnd('10:00'); setRoom(''); setInstructor(''); setLectureColor(data.accent);
  };

  const submitEntry = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidEntry(candidate)) {
      notify('أدخل المادة، يومًا واحدًا على الأقل، ووقت نهاية بعد وقت البداية.', 'error');
      return;
    }
    const collision = findScheduleConflicts(candidate, data.entries, editingId ?? undefined);
    if (collision.length > 0) {
      notify(`يوجد تعارض زمني مع: ${collision.map((entry) => entry.subject).join('، ')}.`, 'error');
      return;
    }
    const nextEntries = editingId
      ? data.entries.map((entry) => entry.id === editingId ? { ...candidate, id: editingId } : entry)
      : [...data.entries, { ...candidate, id: createId() }];
    updateData({ entries: nextEntries });
    resetForm();
    notify('تم حفظ المحاضرة في جدولك.', 'success');
  };

  const editEntry = (entry: ScheduleEntry) => {
    setEditingId(entry.id);
    setSubject(entry.subject);
    setDays(entry.days as DayId[]);
    setStart(entry.start);
    setEnd(entry.end);
    setRoom(entry.room);
    setInstructor(entry.instructor ?? '');
    setLectureColor(entry.color);
    document.getElementById('schedule-subject')?.focus();
  };

  const removeEntry = (id: string) => {
    updateData({ entries: data.entries.filter((entry) => entry.id !== id) });
    if (editingId === id) resetForm();
    notify('تم حذف المحاضرة من الجدول.', 'success');
  };

  const exportImage = async (asPdf: boolean) => {
    const node = exportRef.current;
    if (!node || isExporting) return;
    setIsExporting(true);
    try {
      const { toBlob } = await import('html-to-image');
      const imageBlob = await toBlob(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: data.background,
        filter: (element) => !(element instanceof HTMLElement && element.hasAttribute('data-export-ignore')),
      });
      if (!imageBlob) throw new Error('تعذّر إنشاء صورة الجدول.');
      if (!asPdf) {
        downloadBlob(imageBlob, 'study-schedule.png');
      } else {
        const buffer = await imageBlob.arrayBuffer();
        const pdfBytes = await runPdfTask({
          task: 'imagesToPdf',
          images: [{ name: 'schedule.png', mime: 'image/png', data: buffer, rotation: 0 }],
          options: { pageSize: 'a4', orientation: 'landscape', marginMm: 5 },
        }, [buffer]);
        downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), 'study-schedule.pdf');
      }
      notify(asPdf ? 'تم تصدير الجدول بصيغة PDF.' : 'تم تصدير الجدول بصيغة PNG.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذّر تصدير الجدول.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const themeStyle = { '--schedule-accent': data.accent, '--schedule-bg': data.background } as CSSProperties;

  return (
    <section className="schedule-tool tool-surface" aria-label="مصمم الجدول الدراسي">
      <div className="tool-intro-row">
        <span className="large-action-icon"><CalendarDays size={27} aria-hidden="true" /></span>
        <div><h2>رتّب أسبوعك الدراسي</h2><p>أضف محاضراتك، واكتشف التعارض الزمني قبل حفظ الجدول.</p></div>
      </div>

      <section className="schedule-settings" aria-label="تخصيص مظهر الجدول">
        <label className="schedule-title-setting">عنوان الجدول<input type="text" maxLength={80} value={data.title} onChange={(event) => updateData({ title: event.target.value })} /></label>
        <div className="schedule-color-setting"><label>اللون الأساسي<input type="color" value={data.accent} onChange={(event) => updateData({ accent: event.target.value })} /></label><label>الخلفية<input type="color" value={data.background} onChange={(event) => updateData({ background: event.target.value })} /></label></div>
        <fieldset className="template-picker"><legend>قالب العرض</legend><div>{TEMPLATES.map((template) => <label key={template.id} className={data.template === template.id ? 'is-selected' : ''}><input type="radio" name="schedule-template" checked={data.template === template.id} onChange={() => updateData({ template: template.id })} /><span>{template.label}</span></label>)}</div></fieldset>
      </section>

      <form className="schedule-entry-form" onSubmit={submitEntry}>
        <div className="schedule-form-heading"><h3>{editingId ? 'تعديل محاضرة' : 'إضافة محاضرة'}</h3><span>الحقول بعلامة * مطلوبة</span></div>
        <label className="schedule-subject-label" htmlFor="schedule-subject">المادة أو المحاضرة *<input id="schedule-subject" type="text" maxLength={80} placeholder="مثال: مبادئ البرمجة" value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
        <fieldset className="schedule-days"><legend>أيام المحاضرة *</legend>{DAYS.map((day) => <label key={day.id} className={days.includes(day.id) ? 'is-selected' : ''}><input type="checkbox" checked={days.includes(day.id)} onChange={() => toggleDay(day.id)} /><span>{day.label}</span></label>)}</fieldset>
        <div className="schedule-time-row"><label>من *<input type="time" value={start} onChange={(event) => setStart(event.target.value)} /></label><span aria-hidden="true">—</span><label>إلى *<input type="time" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label>القاعة<input type="text" maxLength={50} placeholder="اختياري" value={room} onChange={(event) => setRoom(event.target.value)} /></label><label>المدرس<input type="text" maxLength={60} placeholder="اختياري" value={instructor} onChange={(event) => setInstructor(event.target.value)} /></label><label className="lecture-color-label">اللون<input type="color" value={lectureColor} onChange={(event) => setLectureColor(event.target.value)} /></label></div>
        {!validInterval && <p className="schedule-form-error" role="alert">وقت النهاية يجب أن يكون بعد وقت البداية.</p>}
        {conflicts.length > 0 && <div className="schedule-conflict-alert" role="alert"><strong>تعارض زمني مكتشف</strong><span>يتداخل هذا الوقت مع: {conflicts.map((entry) => entry.subject).join('، ')}.</span></div>}
        <div className="event-form-actions"><button type="submit" className="primary-button" disabled={!canSubmit}><Plus size={17} aria-hidden="true" /> {editingId ? 'حفظ التعديل' : 'إضافة إلى الجدول'}</button>{editingId && <button type="button" className="text-button" onClick={resetForm}>إلغاء التعديل</button>}</div>
      </form>

      <div className="schedule-board-toolbar"><p>المحاضرات: <strong>{data.entries.length}</strong></p><div><button type="button" className="secondary-button" onClick={() => void exportImage(false)} disabled={isExporting}><Download size={16} aria-hidden="true" /> {isExporting ? 'جارٍ التصدير…' : 'تصدير PNG'}</button><button type="button" className="secondary-button" onClick={() => void exportImage(true)} disabled={isExporting}><Download size={16} aria-hidden="true" /> تصدير PDF</button></div></div>

      <div className="schedule-board-scroll">
      <div ref={exportRef} className={`schedule-canvas template-${data.template}`} style={themeStyle}>
        <header className="schedule-canvas-heading"><span className="schedule-canvas-mark"><CalendarDays size={22} aria-hidden="true" /></span><div><h2>{data.title || 'جدولي الدراسي'}</h2><p>الجدول الأسبوعي</p></div></header>
        <div className="schedule-week-grid">
          {DAYS.map((day) => {
            const dayEntries = data.entries.filter((entry) => entry.days.includes(day.id)).sort((left, right) => left.start.localeCompare(right.start));
            return <section className="schedule-day-column" key={day.id} aria-label={`محاضرات يوم ${day.label}`}>
              <h3>{day.label}<span>{dayEntries.length}</span></h3>
              <div className="schedule-day-entries">
                {dayEntries.length === 0 ? <p className="schedule-day-empty">لا توجد محاضرات</p> : dayEntries.map((entry) => <article className="schedule-lecture-card" key={entry.id} style={{ '--lecture-color': entry.color } as CSSProperties}>
                  <div className="schedule-lecture-time">{entry.start}–{entry.end}</div><strong>{entry.subject}</strong>{entry.room && <span>{entry.room}</span>}{entry.instructor && <small>{entry.instructor}</small>}
                  <div className="schedule-lecture-actions" data-export-ignore><button type="button" onClick={() => editEntry(entry)} aria-label={`تعديل ${entry.subject}`}><Pencil size={13} /></button><button type="button" onClick={() => removeEntry(entry.id)} aria-label={`حذف ${entry.subject}`}><Trash2 size={13} /></button></div>
                </article>)}
              </div>
            </section>;
          })}
        </div>
        {data.entries.length === 0 && <p className="schedule-empty-board">ابدأ بإضافة محاضرة من النموذج لملء جدولك.</p>}
      </div>
      </div>
    </section>
  );
}

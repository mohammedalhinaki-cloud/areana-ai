import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { get, set } from 'idb-keyval';
import { CalendarClock, CalendarPlus, Download, Pencil, Trash2, Upload } from 'lucide-react';
import { useToast } from '../providers/ToastProvider';
import { createId, downloadBlob } from '../services/fileUtils';
import { generateIcs } from '../services/icsService';

type ExamEvent = { id: string; name: string; date: string; time: string };
const STORAGE_KEY = 'exam-countdown:events:v1';

function deadlineOf(event: ExamEvent) {
  return new Date(`${event.date}T${event.time || '00:00'}:00`).getTime();
}

function readJsonEvents(value: unknown): ExamEvent[] {
  if (!Array.isArray(value)) throw new Error('يجب أن يحتوي ملف النسخة الاحتياطية على قائمة اختبارات.');
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') throw new Error(`بيانات الاختبار رقم ${index + 1} غير صالحة.`);
    const candidate = entry as Partial<ExamEvent>;
    if (typeof candidate.name !== 'string' || !candidate.name.trim() || typeof candidate.date !== 'string' || typeof candidate.time !== 'string') {
      throw new Error(`بيانات الاختبار رقم ${index + 1} ناقصة.`);
    }
    if (Number.isNaN(deadlineOf({ id: '', name: candidate.name, date: candidate.date, time: candidate.time }))) {
      throw new Error(`تاريخ الاختبار رقم ${index + 1} غير صالح.`);
    }
    return { id: typeof candidate.id === 'string' ? candidate.id : createId(), name: candidate.name.trim(), date: candidate.date, time: candidate.time };
  });
}

function formatCountdown(target: number, now: number) {
  const difference = target - now;
  if (difference <= 0) return null;
  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export default function ExamCountdownTool() {
  const [exams, setExams] = useState<ExamEvent[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const backupInputRef = useRef<HTMLInputElement>(null);
  const { notify } = useToast();

  useEffect(() => {
    let active = true;
    void get<ExamEvent[]>(STORAGE_KEY).then((saved) => {
      if (active && Array.isArray(saved)) setExams(readJsonEvents(saved));
    }).catch(() => notify('تعذّر قراءة الاختبارات المحفوظة محليًا.', 'error'));
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const sortedExams = useMemo(() => [...exams].sort((left, right) => deadlineOf(left) - deadlineOf(right)), [exams]);

  const persist = (next: ExamEvent[]) => {
    setExams(next);
    void set(STORAGE_KEY, next).then(() => notify('تم حفظ التغييرات على هذا الجهاز.', 'success')).catch(() => notify('تعذّر حفظ البيانات في IndexedDB.', 'error'));
  };

  const resetForm = () => { setName(''); setDate(''); setTime('09:00'); setEditingId(null); };

  const submitExam = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !date || !time || Number.isNaN(deadlineOf({ id: '', name, date, time }))) {
      notify('أدخل اسم الاختبار وتاريخه ووقته بشكل صحيح.', 'error');
      return;
    }
    const next = editingId
      ? exams.map((exam) => exam.id === editingId ? { ...exam, name: name.trim(), date, time } : exam)
      : [...exams, { id: createId(), name: name.trim(), date, time }];
    persist(next);
    resetForm();
  };

  const beginEdit = (exam: ExamEvent) => {
    setEditingId(exam.id);
    setName(exam.name);
    setDate(exam.date);
    setTime(exam.time);
    document.getElementById('exam-name')?.focus();
  };

  const removeExam = (id: string) => {
    const next = exams.filter((exam) => exam.id !== id);
    persist(next);
    if (editingId === id) resetForm();
  };

  const exportCalendar = () => {
    try {
      const ics = generateIcs(exams.map((exam) => ({ id: exam.id, title: exam.name, startAt: deadlineOf(exam), description: `موعد اختبار: ${exam.name}` })));
      downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'exams-calendar.ics');
      notify('تم إنشاء ملف تقويم ICS.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذّر إنشاء ملف التقويم.', 'error');
    }
  };

  const exportBackup = () => {
    const json = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), exams }, null, 2);
    downloadBlob(new Blob([json], { type: 'application/json;charset=utf-8' }), 'study-exams-backup.json');
    notify('تم تصدير النسخة الاحتياطية.', 'success');
  };

  const importBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const payload = parsed && typeof parsed === 'object' && 'exams' in parsed ? (parsed as { exams: unknown }).exams : parsed;
      const imported = readJsonEvents(payload);
      const byId = new Map(exams.map((exam) => [exam.id, exam]));
      imported.forEach((exam) => byId.set(exam.id, exam));
      persist([...byId.values()]);
      notify(`تم استيراد ${imported.length} اختبارًا.`, 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'ملف النسخة الاحتياطية غير صالح.', 'error');
    }
  };

  return (
    <section className="exam-countdown-tool tool-surface" aria-label="عداد الاختبارات">
      <div className="tool-intro-row">
        <span className="large-action-icon"><CalendarClock size={27} aria-hidden="true" /></span>
        <div><h2>كل موعد اختبار، أمامك بوضوح</h2><p>أضف الاختبارات، رتّبها حسب الموعد، وصدّر نسخة احتياطية أو تقويمًا.</p></div>
      </div>

      <form className="event-form" onSubmit={submitExam}>
        <label htmlFor="exam-name">اسم الاختبار<input id="exam-name" type="text" maxLength={100} placeholder="مثال: اختبار الرياضيات" value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label htmlFor="exam-date">التاريخ<input id="exam-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label htmlFor="exam-time">الوقت<input id="exam-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
        <div className="event-form-actions"><button className="primary-button" type="submit"><CalendarPlus size={17} aria-hidden="true" /> {editingId ? 'حفظ التعديل' : 'إضافة اختبار'}</button>{editingId && <button type="button" className="text-button" onClick={resetForm}>إلغاء التعديل</button>}</div>
      </form>

      <div className="data-tools-row">
        <button type="button" className="secondary-button" onClick={exportCalendar} disabled={exams.length === 0}><Download size={16} aria-hidden="true" /> تصدير ICS</button>
        <button type="button" className="secondary-button" onClick={exportBackup} disabled={exams.length === 0}><Download size={16} aria-hidden="true" /> نسخة JSON</button>
        <input ref={backupInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={importBackup} aria-label="استيراد نسخة احتياطية من JSON" />
        <button type="button" className="secondary-button" onClick={() => backupInputRef.current?.click()}><Upload size={16} aria-hidden="true" /> استيراد JSON</button>
      </div>

      {sortedExams.length === 0 ? <div className="empty-events"><CalendarClock size={25} aria-hidden="true" /><p>لا توجد اختبارات محفوظة. أضف أول موعد من النموذج.</p></div> : <div className="countdown-event-list">
        {sortedExams.map((exam) => {
          const deadline = deadlineOf(exam);
          const countdown = formatCountdown(deadline, now);
          const isNear = countdown !== null && deadline - now <= 24 * 60 * 60 * 1000;
          return (
            <article className={`countdown-event-card${isNear ? ' is-near' : ''}${countdown === null ? ' is-past' : ''}`} key={exam.id}>
              <div className="event-card-heading"><span className="event-date-icon"><CalendarClock size={19} aria-hidden="true" /></span><div><h3>{exam.name}</h3><p>{new Intl.DateTimeFormat('ar-SA', { dateStyle: 'full' }).format(new Date(deadline))} · {new Intl.DateTimeFormat('ar-SA', { hour: '2-digit', minute: '2-digit' }).format(new Date(deadline))}</p></div><div className="event-card-actions"><button type="button" className="square-control" onClick={() => beginEdit(exam)} aria-label={`تعديل ${exam.name}`}><Pencil size={15} /></button><button type="button" className="square-control danger-control" onClick={() => removeExam(exam.id)} aria-label={`حذف ${exam.name}`}><Trash2 size={15} /></button></div></div>
              {countdown ? <div className="countdown-units" aria-label={`متبقي ${countdown.days} يوم و${countdown.hours} ساعة`}><div><strong>{countdown.days}</strong><span>يوم</span></div><div><strong>{String(countdown.hours).padStart(2, '0')}</strong><span>ساعة</span></div><div><strong>{String(countdown.minutes).padStart(2, '0')}</strong><span>دقيقة</span></div><div><strong>{String(countdown.seconds).padStart(2, '0')}</strong><span>ثانية</span></div>{isNear && <span className="near-badge">اقترب الموعد</span>}</div> : <p className="event-finished">انتهى موعد هذا الاختبار.</p>}
            </article>
          );
        })}
      </div>}
    </section>
  );
}

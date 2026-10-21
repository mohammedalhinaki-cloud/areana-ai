import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { get, set } from 'idb-keyval';
import { CalendarHeart, CalendarPlus, Download, Link2, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '../providers/ToastProvider';
import { copyTextToClipboard, createId, downloadBlob } from '../services/fileUtils';
import { generateIcs } from '../services/icsService';

type CountdownEvent = { id: string; name: string; date: string; time: string };
type SharedEvent = CountdownEvent;
const STORAGE_KEY = 'season-countdowns:custom:v1';
const SEASONS: CountdownEvent[] = [
  { id: 'ramadan-1448', name: 'رمضان 1448 هـ', date: '2027-02-08', time: '00:00' },
  { id: 'fitr-1448', name: 'عيد الفطر 1448 هـ', date: '2027-03-10', time: '00:00' },
  { id: 'adha-1448', name: 'عيد الأضحى 1448 هـ', date: '2027-05-17', time: '00:00' },
];

function timestampOf(event: CountdownEvent) {
  return new Date(`${event.date}T${event.time || '00:00'}:00`).getTime();
}

function countdownParts(timestamp: number, now: number) {
  const remaining = timestamp - now;
  if (remaining <= 0) return null;
  const total = Math.floor(remaining / 1000);
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

function encodeShare(event: CountdownEvent) {
  const bytes = new TextEncoder().encode(JSON.stringify({ name: event.name, date: event.date, time: event.time }));
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeShare(encoded: string): SharedEvent {
  const standard = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!parsed || typeof parsed !== 'object') throw new Error('رابط المناسبة غير صالح.');
  const item = parsed as Partial<CountdownEvent>;
  if (typeof item.name !== 'string' || !item.name.trim() || typeof item.date !== 'string' || typeof item.time !== 'string' || Number.isNaN(timestampOf({ id: '', name: item.name, date: item.date, time: item.time }))) {
    throw new Error('بيانات المناسبة داخل الرابط غير صالحة.');
  }
  return { id: createId(), name: item.name.trim(), date: item.date, time: item.time };
}

export default function CountdownsTool() {
  const [customEvents, setCustomEvents] = useState<CountdownEvent[]>([]);
  const [now, setNow] = useState(Date.now());
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('00:00');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sharedEvent, setSharedEvent] = useState<SharedEvent | null>(null);
  const [sharedAdded, setSharedAdded] = useState(false);
  const { notify } = useToast();

  useEffect(() => {
    let active = true;
    void get<CountdownEvent[]>(STORAGE_KEY).then((saved) => {
      if (active && Array.isArray(saved)) setCustomEvents(saved);
    }).catch(() => notify('تعذّر تحميل المناسبات المحفوظة.', 'error'));
    const encoded = new URLSearchParams(window.location.search).get('event');
    if (encoded) {
      try {
        setSharedEvent(decodeShare(encoded));
      } catch (error) {
        notify(error instanceof Error ? error.message : 'رابط المشاركة غير صالح.', 'error');
      }
    }
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const persist = (next: CountdownEvent[], successMessage = 'تم حفظ المناسبة على هذا الجهاز.') => {
    setCustomEvents(next);
    void set(STORAGE_KEY, next).then(() => notify(successMessage, 'success')).catch(() => notify('تعذّر حفظ المناسبة في IndexedDB.', 'error'));
  };

  const allEvents = useMemo(() => [
    ...SEASONS.map((event) => ({ ...event, kind: 'season' as const })),
    ...customEvents.map((event) => ({ ...event, kind: 'custom' as const })),
  ].sort((left, right) => timestampOf(left) - timestampOf(right)), [customEvents]);

  const resetForm = () => { setName(''); setDate(''); setTime('00:00'); setEditingId(null); };

  const submitEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!name.trim() || !date || !time || Number.isNaN(timestampOf({ id: '', name, date, time }))) {
      notify('أدخل اسم المناسبة والتاريخ والوقت بشكل صحيح.', 'error');
      return;
    }
    const next = editingId
      ? customEvents.map((item) => item.id === editingId ? { ...item, name: name.trim(), date, time } : item)
      : [...customEvents, { id: createId(), name: name.trim(), date, time }];
    persist(next);
    resetForm();
  };

  const editEvent = (event: CountdownEvent) => {
    setEditingId(event.id);
    setName(event.name);
    setDate(event.date);
    setTime(event.time);
    document.getElementById('custom-event-name')?.focus();
  };

  const addSharedEvent = () => {
    if (!sharedEvent) return;
    const added = { ...sharedEvent, id: createId() };
    persist([...customEvents, added], 'تمت إضافة المناسبة المشتركة إلى مناسباتك.');
    setSharedAdded(true);
  };

  const shareEvent = async (event: CountdownEvent) => {
    const url = new URL(window.location.href);
    url.searchParams.set('event', encodeShare(event));
    try {
      const copied = await copyTextToClipboard(url.toString());
      if (copied) notify('تم نسخ رابط المناسبة المشترك.', 'success');
      else notify('تعذّر نسخ الرابط من هذا المتصفح.', 'error');
    } catch {
      notify('تعذّر نسخ الرابط. تحقق من صلاحية الحافظة.', 'error');
    }
  };

  const exportCalendar = () => {
    try {
      const icsEvents = allEvents.map((event) => ({
        id: event.id,
        title: event.name,
        startAt: timestampOf(event),
        description: event.kind === 'season' ? 'موعد تقديري، وقد يختلف حسب رؤية الهلال.' : 'مناسبة مخصصة.',
      }));
      const ics = generateIcs(icsEvents);
      downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), 'seasons-and-events.ics');
      notify('تم إنشاء ملف التقويم للمواسم والمناسبات.', 'success');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'تعذّر تصدير التقويم.', 'error');
    }
  };

  const sortedCustom = [...customEvents].sort((left, right) => timestampOf(left) - timestampOf(right));

  return (
    <section className="countdowns-tool tool-surface" aria-label="عداد المواسم والإجازات">
      <div className="tool-intro-row">
        <span className="large-action-icon"><CalendarHeart size={27} aria-hidden="true" /></span>
        <div><h2>مواعيد تقترب، وذكريات تنتظر</h2><p>تابع المناسبات الموسمية وأضف أحداثك الخاصة.</p></div>
      </div>
      <div className="estimate-notice" role="note"><strong>تنبيه للمواعيد الموسمية:</strong> تواريخ رمضان والعيدين تقديرية وفق التقويم المتوقع، وقد تختلف حسب رؤية الهلال والإعلان الرسمي.</div>

      {sharedEvent && <article className="shared-event-banner"><div><p className="eyebrow">مناسبة من رابط مشاركة</p><h3>{sharedEvent.name}</h3><p>{sharedEvent.date} · {sharedEvent.time}</p><small>يحتوي الرابط على بيانات المناسبة بصيغة Base64 للترميز فقط، وليس للتشفير.</small></div><button type="button" className="primary-button" onClick={addSharedEvent} disabled={sharedAdded}>{sharedAdded ? 'أُضيفت إلى مناسباتك' : 'إضافة إلى مناسباتي'}</button></article>}

      <div className="season-countdown-grid">
        {allEvents.map((event) => {
          const countdown = countdownParts(timestampOf(event), now);
          const isEstimate = event.kind === 'season';
          return <article className={`season-countdown-card${isEstimate ? ' is-estimate' : ''}`} key={`${event.kind}-${event.id}`}>
            <div className="season-card-top"><span className="season-date-icon"><CalendarHeart size={19} aria-hidden="true" /></span>{isEstimate ? <span className="estimated-badge">تقديري</span> : <span className="custom-badge">مخصص</span>}</div>
            <h3>{event.name}</h3><p className="season-date">{new Intl.DateTimeFormat('ar-SA', { dateStyle: 'long' }).format(new Date(timestampOf(event)))}</p>
            {countdown ? <div className="season-counter"><strong>{countdown.days}</strong><span>يوم</span><small>{String(countdown.hours).padStart(2, '0')}:{String(countdown.minutes).padStart(2, '0')}:{String(countdown.seconds).padStart(2, '0')}</small></div> : <p className="event-finished">حلّ الموعد</p>}
            {event.kind === 'custom' && <div className="season-card-actions"><button type="button" className="square-control" onClick={() => editEvent(event)} aria-label={`تعديل ${event.name}`}><Pencil size={15} /></button><button type="button" className="square-control danger-control" onClick={() => { const next = customEvents.filter((item) => item.id !== event.id); persist(next); if (editingId === event.id) resetForm(); }} aria-label={`حذف ${event.name}`}><Trash2 size={15} /></button><button type="button" className="secondary-button share-event-button" onClick={() => void shareEvent(event)}><Link2 size={14} aria-hidden="true" /> مشاركة</button></div>}
          </article>;
        })}
      </div>

      <section className="custom-event-section" aria-labelledby="custom-event-title">
        <div className="custom-event-heading"><div><p className="eyebrow">مساحتك الخاصة</p><h3 id="custom-event-title">مناسبة مخصصة</h3></div><button type="button" className="secondary-button" onClick={exportCalendar}><Download size={16} aria-hidden="true" /> تصدير ICS</button></div>
        <form className="event-form custom-event-form" onSubmit={submitEvent}>
          <label htmlFor="custom-event-name">اسم المناسبة<input id="custom-event-name" type="text" maxLength={100} placeholder="مثال: بداية الإجازة" value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label htmlFor="custom-event-date">التاريخ<input id="custom-event-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
          <label htmlFor="custom-event-time">الوقت<input id="custom-event-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
          <div className="event-form-actions"><button type="submit" className="primary-button"><CalendarPlus size={17} aria-hidden="true" /> {editingId ? 'حفظ التعديل' : 'إضافة مناسبة'}</button>{editingId && <button type="button" className="text-button" onClick={resetForm}>إلغاء التعديل</button>}</div>
        </form>
        {sortedCustom.length === 0 && <p className="tool-helper-text">المناسبات المخصصة تُحفظ في IndexedDB على هذا الجهاز فقط.</p>}
      </section>
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import { Bell, BellOff, Pause, Play, RotateCcw, Settings2, TimerReset } from 'lucide-react';
import { useToast } from '../providers/ToastProvider';

const SESSIONS_KEY = 'pomodoro:sessions:v1';
type TimerPhase = 'focus' | 'shortBreak' | 'longBreak';
type StudySession = { id: string; subject: string; durationMinutes: number; completedAt: number };
type TimerSettings = { focus: number; shortBreak: number; longBreak: number };
const PHASE_LABELS: Record<TimerPhase, string> = { focus: 'وقت التركيز', shortBreak: 'استراحة قصيرة', longBreak: 'استراحة طويلة' };
const DEFAULT_SETTINGS: TimerSettings = { focus: 25, shortBreak: 5, longBreak: 15 };

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PomodoroTool() {
  const [settings, setSettings] = useState<TimerSettings>(DEFAULT_SETTINGS);
  const [phase, setPhase] = useState<TimerPhase>('focus');
  const [remainingSeconds, setRemainingSeconds] = useState(DEFAULT_SETTINGS.focus * 60);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [subject, setSubject] = useState('');
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [now, setNow] = useState(Date.now());
  const completionHandled = useRef(false);
  const { notify } = useToast();

  const phaseDuration = settings[phase];
  const todayKey = localDayKey(new Date(now));
  const todaySessions = useMemo(() => sessions.filter((session) => localDayKey(new Date(session.completedAt)) === todayKey), [sessions, todayKey]);
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  const weekSessions = useMemo(() => sessions.filter((session) => session.completedAt >= weekStart && session.completedAt <= now), [now, sessions, weekStart]);
  const progress = deadline === null ? 1 - remainingSeconds / Math.max(1, phaseDuration * 60) : 1 - remainingSeconds / Math.max(1, phaseDuration * 60);
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - Math.max(0, Math.min(1, progress)));

  useEffect(() => {
    let mounted = true;
    void get<StudySession[]>(SESSIONS_KEY).then((saved) => {
      if (mounted && Array.isArray(saved)) setSessions(saved);
    }).catch(() => {
      // The timer remains available even when IndexedDB is blocked.
    });
    return () => { mounted = false; };
  }, []);

  const completePhase = useCallback(async () => {
    if (completionHandled.current) return;
    completionHandled.current = true;
    setDeadline(null);
    setRemainingSeconds(0);

    if (phase === 'focus') {
      const session: StudySession = {
        id: newId(),
        subject: subject.trim() || 'جلسة مذاكرة',
        durationMinutes: phaseDuration,
        completedAt: Date.now(),
      };
      setSessions((current) => {
        const next = [...current, session];
        void set(SESSIONS_KEY, next).catch(() => {
          notify('اكتملت الجلسة، لكن تعذّر حفظ الإحصاءات في IndexedDB.', 'error');
        });
        return next;
      });
      const focusCountToday = todaySessions.length + 1;
      const nextPhase: TimerPhase = focusCountToday % 4 === 0 ? 'longBreak' : 'shortBreak';
      setPhase(nextPhase);
      setRemainingSeconds(settings[nextPhase] * 60);
      notify(`انتهت جلسة التركيز${session.subject ? `: ${session.subject}` : ''}. حان وقت ${PHASE_LABELS[nextPhase]}.`, 'success');
    } else {
      setPhase('focus');
      setRemainingSeconds(settings.focus * 60);
      notify('انتهت الاستراحة. عندما تكون مستعدًا، ابدأ جلسة تركيز جديدة.', 'success');
    }

    if (notificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('انتهت جلسة المؤقت', { body: phase === 'focus' ? 'حان وقت الاستراحة.' : 'يمكنك العودة للمذاكرة الآن.' });
      } catch {
        // Some browsers block notifications when the page is not active.
      }
    }
  }, [notificationsEnabled, notify, phase, phaseDuration, settings, subject, todaySessions.length]);

  useEffect(() => {
    if (deadline === null) return undefined;
    const tick = () => {
      const remaining = Math.ceil((deadline - Date.now()) / 1000);
      if (remaining <= 0) {
        setRemainingSeconds(0);
        void completePhase();
      } else {
        setRemainingSeconds(remaining);
      }
    };
    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [completePhase, deadline]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const startTimer = () => {
    completionHandled.current = false;
    const seconds = Math.max(1, remainingSeconds || phaseDuration * 60);
    setRemainingSeconds(seconds);
    setDeadline(Date.now() + seconds * 1000);
  };

  const pauseTimer = () => {
    if (deadline === null) return;
    setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    setDeadline(null);
  };

  const resetTimer = () => {
    setDeadline(null);
    completionHandled.current = false;
    setRemainingSeconds(settings[phase] * 60);
  };

  const choosePhase = (nextPhase: TimerPhase) => {
    if (deadline !== null) return;
    setPhase(nextPhase);
    completionHandled.current = false;
    setRemainingSeconds(settings[nextPhase] * 60);
  };

  const updateSetting = (key: keyof TimerSettings, rawValue: string) => {
    const value = Math.max(1, Math.min(180, Number(rawValue) || 1));
    setSettings((current) => ({ ...current, [key]: value }));
    if (phase === key && deadline === null) setRemainingSeconds(value * 60);
  };

  const toggleNotifications = async () => {
    if (!('Notification' in window)) {
      notify('هذا المتصفح لا يدعم إشعارات الويب.', 'info');
      return;
    }
    const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    if (permission === 'granted') {
      setNotificationsEnabled((enabled) => !enabled);
      notify(notificationsEnabled ? 'تم إيقاف إشعارات انتهاء الجلسة.' : 'تم تفعيل إشعارات انتهاء الجلسة.', 'success');
    } else {
      setNotificationsEnabled(false);
      notify('لم يسمح المتصفح بالإشعارات. يمكن تغيير ذلك من إعدادات الموقع.', 'info');
    }
  };

  const minutes = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
  const seconds = (remainingSeconds % 60).toString().padStart(2, '0');
  const todayMinutes = todaySessions.reduce((sum, session) => sum + session.durationMinutes, 0);
  const weekMinutes = weekSessions.reduce((sum, session) => sum + session.durationMinutes, 0);

  return (
    <section className={`pomodoro-tool tool-surface${phase !== 'focus' ? ' is-break' : ''}`} aria-label="مؤقت المذاكرة Pomodoro">
      <div className="pomodoro-heading">
        <div><p className="eyebrow">ركّز على خطوة واحدة</p><h2>مؤقت المذاكرة</h2><p>الوقت يُحسب من ساعة الجهاز، لذلك يبقى دقيقًا بعد قفل الشاشة أو عودة التبويب.</p></div>
        <button type="button" className={`secondary-button notification-toggle${notificationsEnabled ? ' is-selected' : ''}`} onClick={() => void toggleNotifications()} aria-pressed={notificationsEnabled}>
          {notificationsEnabled ? <Bell size={17} aria-hidden="true" /> : <BellOff size={17} aria-hidden="true" />}
          <span>{notificationsEnabled ? 'الإشعارات مفعّلة' : 'تفعيل الإشعارات'}</span>
        </button>
      </div>
      <div className="pomodoro-phase-tabs" role="tablist" aria-label="نوع الجلسة">
        {(['focus', 'shortBreak', 'longBreak'] as TimerPhase[]).map((key) => <button type="button" key={key} role="tab" aria-selected={phase === key} className={phase === key ? 'is-active' : ''} onClick={() => choosePhase(key)} disabled={deadline !== null}>{PHASE_LABELS[key]}</button>)}
      </div>

      <div className="pomodoro-main">
        <div className="pomodoro-clock" role="timer" aria-label={`${PHASE_LABELS[phase]}، ${minutes} دقيقة و${seconds} ثانية`}>
          <svg className="pomodoro-progress" viewBox="0 0 220 220" aria-hidden="true">
            <circle className="pomodoro-track" cx="110" cy="110" r={radius} />
            <circle className="pomodoro-progress-ring" cx="110" cy="110" r={radius} strokeDasharray={circumference} strokeDashoffset={strokeOffset} />
          </svg>
          <div className="pomodoro-time"><span>{minutes}:{seconds}</span><small>{PHASE_LABELS[phase]}</small></div>
        </div>
        <div className="pomodoro-controls">
          <label className="pomodoro-subject">اسم المادة أو المهمة
            <input type="text" maxLength={80} placeholder="مثال: رياضيات" value={subject} onChange={(event) => setSubject(event.target.value)} disabled={deadline !== null} />
          </label>
          <div className="pomodoro-action-buttons">
            {deadline === null
              ? <button type="button" className="primary-button pomodoro-start" onClick={startTimer}><Play size={18} fill="currentColor" aria-hidden="true" /> ابدأ التركيز</button>
              : <button type="button" className="primary-button pomodoro-start" onClick={pauseTimer}><Pause size={18} fill="currentColor" aria-hidden="true" /> إيقاف مؤقت</button>}
            <button type="button" className="secondary-button" onClick={resetTimer}><RotateCcw size={17} aria-hidden="true" /> إعادة</button>
            <button type="button" className={`square-control pomodoro-settings-button${showSettings ? ' is-selected' : ''}`} onClick={() => setShowSettings((open) => !open)} aria-expanded={showSettings} aria-label="إعدادات مدد المؤقت"><Settings2 size={18} /></button>
          </div>
          <p className="pomodoro-notice"><Bell size={14} aria-hidden="true" /> إشعارات المتصفح اختيارية وقد لا تعمل عند إغلاق المتصفح.</p>
        </div>
      </div>

      {showSettings && <div className="pomodoro-settings" aria-label="إعداد مدد المؤقت">
        {([['focus', 'التركيز'], ['shortBreak', 'الاستراحة القصيرة'], ['longBreak', 'الاستراحة الطويلة']] as const).map(([key, label]) => <label key={key}>{label} (دقيقة)<input type="number" min={1} max={180} value={settings[key]} onChange={(event) => updateSetting(key, event.target.value)} disabled={deadline !== null} /></label>)}
      </div>}

      <div className="pomodoro-stats">
        <article><span>جلسات اليوم</span><strong>{todaySessions.length}</strong><small>{todayMinutes} دقيقة تركيز</small></article>
        <article><span>جلسات آخر 7 أيام</span><strong>{weekSessions.length}</strong><small>{weekMinutes} دقيقة تركيز</small></article>
        <article className="pomodoro-session-tip"><span><TimerReset size={17} aria-hidden="true" /> طريقة العمل</span><small>بعد كل أربع جلسات تركيز، تأتي استراحة طويلة.</small></article>
      </div>
    </section>
  );
}

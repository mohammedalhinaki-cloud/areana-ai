import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useToast } from '../providers/ToastProvider';

type InstallChoice = { outcome: 'accepted' | 'dismissed'; platform?: string };
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

export function InstallPwaButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setPromptEvent(null);
      notify('تم تثبيت أدوات الدراسة.', 'success');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [notify]);

  const install = async () => {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') notify('تم قبول تثبيت التطبيق.', 'success');
      else notify('لم يتم تثبيت التطبيق.', 'info');
    } catch {
      notify('تعذّر بدء التثبيت في هذا المتصفح.', 'error');
    } finally {
      setPromptEvent(null);
    }
  };

  if (!promptEvent) return null;

  return (
    <button type="button" className="header-action install-action" onClick={install}>
      <Download size={18} aria-hidden="true" />
      <span>تثبيت التطبيق</span>
    </button>
  );
}

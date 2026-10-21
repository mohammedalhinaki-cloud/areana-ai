import { Share2 } from 'lucide-react';
import { useToast } from '../providers/ToastProvider';

type ShareButtonProps = { compact?: boolean };

async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.append(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  textArea.remove();
  return copied;
}

export function ShareButton({ compact = false }: ShareButtonProps) {
  const { notify } = useToast();

  const sharePage = async () => {
    const data = {
      title: document.title,
      text: 'أدوات الدراسة — أدوات عملية للطلاب والطالبات',
      url: window.location.href,
    };

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share(data);
        notify('تم فتح خيارات المشاركة.', 'success');
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      const copied = await copyText(data.url);
      if (copied) notify('تم نسخ رابط الصفحة.', 'success');
      else notify('تعذّر نسخ الرابط من هذا المتصفح.', 'error');
    } catch {
      notify('تعذّر نسخ الرابط. تحقق من صلاحية الحافظة في المتصفح.', 'error');
    }
  };

  return (
    <button type="button" className={`header-action share-action${compact ? ' is-compact' : ''}`} onClick={sharePage}>
      <Share2 size={18} aria-hidden="true" />
      <span>مشاركة</span>
    </button>
  );
}

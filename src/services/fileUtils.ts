export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 بايت';
  const units = ['بايت', 'ك.ب', 'م.ب', 'ج.ب'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${new Intl.NumberFormat('ar-SA', { maximumFractionDigits: index === 0 ? 0 : 2 }).format(value)} ${units[index]}`;
}

export function createId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function fileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot < 0 ? '' : filename.slice(lastDot + 1).toLowerCase();
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
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

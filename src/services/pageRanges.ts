export function parsePageRanges(value: string, pageCount: number): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('المستند لا يحتوي على صفحات.');
  const tokens = value.split(/[،,\s]+/u).map((token) => token.trim()).filter(Boolean);
  if (tokens.length === 0) throw new Error('أدخل رقم صفحة أو نطاقًا مثل 3-8.');

  const pages = new Set<number>();
  for (const token of tokens) {
    const match = token.match(/^(\d+)(?:\s*-\s*(\d+))?$/u);
    if (!match) throw new Error(`النطاق «${token}» غير صالح. استخدم أرقامًا أو صيغة مثل 3-8.`);
    const first = Number(match[1]);
    const last = match[2] ? Number(match[2]) : first;
    if (first < 1 || last < first || last > pageCount) {
      throw new Error(`الصفحات يجب أن تكون بين 1 و${pageCount}، وأن يبدأ النطاق من الرقم الأصغر.`);
    }
    for (let page = first; page <= last; page += 1) pages.add(page - 1);
  }
  return [...pages].sort((left, right) => left - right);
}

import { test, expect, type Page } from '@playwright/test';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import { CATEGORIES } from '../src/config/tools';

async function makePdf(pageCount = 2): Promise<Buffer> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([360, 480]);
    page.drawText(`Study fixture page ${index + 1}`, { x: 42, y: 420, size: 18, font, color: rgb(0.12, 0.2, 0.34) });
  }
  return Buffer.from(await document.save());
}

const pngFixture = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

async function downloadBytes(page: Page, buttonName: RegExp | string) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: buttonName }).click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error('The browser did not produce a download path.');
  return { download, bytes: await readFile(path) };
}

test.describe('all configured tool routes', () => {
  for (const category of CATEGORIES) {
    for (const tool of category.tools) {
      test(`${tool.path} loads the configured title`, async ({ page }) => {
        await page.goto(tool.path);
        await expect(page.getByRole('heading', { level: 1, name: tool.nameAr })).toBeVisible();
        await expect(page.getByRole('navigation', { name: 'مسار التنقل' })).toBeVisible();
      });
    }
  }
});

test('PDF reader opens an uploaded document and renders a page', async ({ page }) => {
  const pdf = await makePdf(3);
  await page.goto('/reader');
  await page.getByLabel('اختر ملف PDF').setInputFiles({ name: 'reader-fixture.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.locator('.reader-file-details')).toContainText('3 صفحة');
  await expect(page.locator('.reader-stage canvas').first()).toBeVisible({ timeout: 15_000 });
});

test('merge PDF uploads files, creates a merged PDF, and downloads it', async ({ page }) => {
  const pdf = await makePdf(1);
  await page.goto('/merge-pdf');
  await page.getByLabel('اختر ملفات PDF للدمج').setInputFiles([
    { name: 'one.pdf', mimeType: 'application/pdf', buffer: pdf },
    { name: 'two.pdf', mimeType: 'application/pdf', buffer: pdf },
  ]);
  await page.getByRole('button', { name: 'دمج الملفات' }).click();
  await expect(page.getByRole('button', { name: /تنزيل الملف/ })).toBeVisible({ timeout: 15_000 });
  const { download, bytes } = await downloadBytes(page, /تنزيل الملف/);
  expect(download.suggestedFilename()).toBe('merged-document.pdf');
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
});

test('PDF page deletion preserves remaining pages and downloads a real PDF', async ({ page }) => {
  const pdf = await makePdf(3);
  await page.goto('/pdf-pages');
  await page.getByLabel('اختر ملف PDF').setInputFiles({ name: 'pages-fixture.pdf', mimeType: 'application/pdf', buffer: pdf });
  await page.getByRole('button', { name: 'صفحة رقم 2' }).click();
  await page.getByRole('button', { name: 'حذف 1 صفحة' }).click();
  await expect(page.getByRole('button', { name: 'تنزيل PDF المعدّل' })).toBeVisible({ timeout: 15_000 });
  const { bytes } = await downloadBytes(page, 'تنزيل PDF المعدّل');
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
});

test('image to PDF converts a PNG into a downloadable one-page PDF', async ({ page }) => {
  await page.goto('/image-to-pdf');
  await page.getByLabel('اختر صورًا للتحويل إلى PDF').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: pngFixture });
  await page.getByRole('button', { name: 'إنشاء ملف PDF' }).click();
  await expect(page.getByRole('button', { name: /تنزيل PDF/ })).toBeVisible({ timeout: 15_000 });
  const { bytes } = await downloadBytes(page, /تنزيل PDF/);
  expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
});

test('image tools transform and download a valid PNG', async ({ page }) => {
  await page.goto('/image-tools');
  await page.getByLabel('اختر صورة للتعديل').setInputFiles({ name: 'pixel.png', mimeType: 'image/png', buffer: pngFixture });
  await page.getByRole('button', { name: 'معالجة الصورة' }).click();
  await expect(page.getByRole('button', { name: 'تنزيل الصورة' })).toBeVisible({ timeout: 15_000 });
  const { download, bytes } = await downloadBytes(page, 'تنزيل الصورة');
  expect(download.suggestedFilename()).toBe('image-edited.png');
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
});

test('calculator computes a known PEMDAS result', async ({ page }) => {
  await page.goto('/calculator');
  await page.getByLabel('العملية الحسابية').fill('2+3*4');
  await page.getByRole('button', { name: 'يساوي' }).click();
  await expect(page.locator('.calculator-result-line strong')).toHaveText('14');
});

test('schedule detects a real same-day time overlap', async ({ page }) => {
  await page.goto('/schedule');
  await page.getByLabel('المادة أو المحاضرة *').fill('رياضيات');
  await page.getByRole('checkbox', { name: 'الأحد' }).check();
  await page.getByLabel('من *').fill('09:00');
  await page.getByLabel('إلى *').fill('10:00');
  await page.getByRole('button', { name: 'إضافة إلى الجدول' }).click();
  await page.getByLabel('المادة أو المحاضرة *').fill('فيزياء');
  await page.getByRole('checkbox', { name: 'الأحد' }).check();
  await page.getByLabel('من *').fill('09:30');
  await page.getByLabel('إلى *').fill('10:30');
  await expect(page.getByRole('alert')).toContainText('تعارض زمني مكتشف');
  await expect(page.getByRole('button', { name: 'إضافة إلى الجدول' })).toBeDisabled();
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
const languages = ['en', 'bg', 'zh', 'hi', 'es', 'fr', 'ar', 'bn', 'pt', 'ru'].map((code) => ({
  code,
}));
const catalogs: Record<string, Record<string, string>> = Object.fromEntries(
  languages.map(({ code }) => [
    code,
    JSON.parse(
      readFileSync(new URL(`../../src/web/locales/${code}.json`, import.meta.url), 'utf8'),
    ),
  ]),
);
test('bundled locales preserve drafts, expiry warnings, protocol values and RTL accessibility', async ({
  page,
}) => {
  const c = catalogs.bg;
  await page.goto('/');
  await page.locator('.language-picker select').selectOption('bg');
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await page.getByRole('button', { name: c['Sign in'], exact: true }).click();
  await expect(page.getByRole('heading', { name: c['My cabinet'], exact: true })).toBeVisible();
  await expect(page.locator('.missing-alert')).toContainText('лекарство');
  await page.getByRole('button', { name: c['Review missing dates'], exact: true }).click();
  await page.getByRole('button', { name: c['Add an expiry date'], exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(c['Expiry date'], { exact: true })).toHaveValue('');
  await expect(dialog.locator('.warning-label svg')).toBeVisible();
  await dialog
    .getByRole('textbox', { name: c['Notes'], exact: true })
    .fill('Verbatim draft — Не превеждай');
  await page.locator('.language-picker select').selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    dialog.getByRole('textbox', { name: catalogs.ar['Notes'], exact: true }),
  ).toHaveValue('Verbatim draft — Не превеждай');
  await expect(
    dialog.getByRole('combobox', { name: catalogs.ar['Quantity unit'], exact: true }),
  ).toHaveValue('tablet');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await dialog.getByRole('textbox', { name: catalogs.ar['Notes'], exact: true }).fill('');
  await page.keyboard.press('Escape');
  for (const { code } of languages) {
    await page.locator('.language-picker select').selectOption(code);
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${code} at ${width}: ${JSON.stringify(
          await page.evaluate(() =>
            Array.from(document.querySelectorAll('*'))
              .filter((e) => {
                const r = e.getBoundingClientRect();
                return r.width && (r.right > innerWidth + 1 || r.left < -1);
              })
              .map((e) => ({
                tag: e.tagName,
                class: e.className,
                text: e.textContent?.slice(0, 70),
                width: e.getBoundingClientRect().width,
              }))
              .slice(0, 20),
          ),
        )}`,
      ).toBe(true);
    }
  }
  await page.locator('.language-picker select').selectOption('bg');
  await page.reload();
  await expect(page.locator('.language-picker select')).toHaveValue('bg');
  await expect(page.getByRole('heading', { name: c['My cabinet'], exact: true })).toBeVisible();
});

test.describe('browser language detection', () => {
  test.use({ locale: 'bg-BG' });
  test('detects Bulgarian before login and translates fixed server errors', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.language-picker select')).toHaveValue('bg');
    await page
      .getByRole('textbox', { name: catalogs.bg['Username'], exact: true })
      .fill('wrong-synthetic-user');
    await page.getByRole('button', { name: catalogs.bg['Sign in'], exact: true }).click();
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: catalogs.bg['Username or password is incorrect.'] }),
    ).toBeVisible();
    await page.locator('.language-picker select').selectOption('en');
    await expect(
      page.getByRole('alert').filter({ hasText: 'Username or password is incorrect.' }),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator('.language-picker select')).toHaveValue('en');
  });
});

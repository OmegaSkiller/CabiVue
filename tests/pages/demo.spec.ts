import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('static demo edits, scans and interviews stay isolated without API or provider traffic', async ({
  page,
  context,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'My cabinet', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Public demo' })).toBeVisible();
  await expect(page.locator('img.logo')).toBeVisible();
  expect(
    await page.locator('img.logo').evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Review missing dates', exact: true }).click();
  await page.getByRole('button', { name: 'Add an expiry date', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Expiry date', { exact: true }).fill('2028-03-14');
  await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('.missing-alert')).not.toBeVisible();
  const visitor = await context.newPage();
  await visitor.goto('./');
  await expect(visitor.locator('.missing-alert')).toBeVisible();
  await visitor.close();
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await page
    .getByLabel('Upload photos', { exact: true })
    .setInputFiles('tests/fixtures/synthetic-medicine.png');
  await page
    .getByRole('checkbox', { name: 'I understand this scan uses simulated results.' })
    .check();
  await page.getByRole('button', { name: 'Extract a review draft', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review your scan', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save selected packs', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Sample package · simulated', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Assistant', exact: true }).click();
  await page
    .getByLabel('Urgent or severe symptoms / possible overdose or poisoning')
    .selectOption('yes');
  await page.getByLabel('Your answer').fill('Synthetic urgent example');
  await page.getByRole('button', { name: 'Continue interview', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Get urgent medical help now.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Demo limitations', exact: true })).toBeVisible();
  await expect(page.getByLabel('OpenAI API key')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download backup', exact: true })).toHaveCount(0);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Reset demo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My cabinet', exact: true })).toBeVisible();
  await expect(page.locator('.missing-alert')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sample package · simulated', exact: true }),
  ).toHaveCount(0);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const manifest = await (await page.request.get('manifest.webmanifest')).json();
  expect(manifest.start_url).toBe('/CabiVue/');
  expect(manifest.scope).toBe('/CabiVue/');
  await page.locator('.language-picker select').selectOption('bg');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Моята аптечка', exact: true })).toBeVisible();
  await expect(page.locator('.missing-alert')).toBeVisible();
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      for (const req of await (await caches.open(name)).keys()) urls.push(req.url);
    return urls;
  });
  expect(cached.every((url) => new URL(url).pathname.startsWith('/CabiVue/'))).toBe(true);
  expect(
    requests.every(
      (url) =>
        new URL(url).origin === 'http://127.0.0.1:5176' && !new URL(url).pathname.includes('/api/'),
    ),
  ).toBe(true);
});

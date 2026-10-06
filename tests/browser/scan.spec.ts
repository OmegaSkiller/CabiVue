import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('mobile medicine scan stays a draft; receipt needs explicit line and quantity review', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My cabinet', exact: true })).toBeVisible();
  const before = (await (await page.request.get('/api/inventory')).json()).packs.map(
    (p: { id: string }) => p.id,
  );
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await page
    .getByLabel('Upload photos', { exact: true })
    .setInputFiles('tests/fixtures/synthetic-medicine.png');
  await page
    .getByRole('checkbox', { name: 'I understand this scan uses simulated results.' })
    .check();
  await page.getByRole('button', { name: 'Extract a review draft' }).click();
  await expect(page.getByRole('heading', { name: 'Review your scan' })).toBeVisible();
  expect((await (await page.request.get('/api/inventory')).json()).packs).toHaveLength(
    before.length,
  );
  await expect(page.getByLabel('Expiry date', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/scan-review-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Save selected packs' }).click();
  await expect(page.getByRole('heading', { name: 'My cabinet', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Sample package · simulated', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Scan', exact: true }).click();
  await page.getByRole('button', { name: 'Receipt scan' }).click();
  await page
    .getByLabel('Upload photos', { exact: true })
    .setInputFiles('tests/fixtures/synthetic-receipt.png');
  await page
    .getByRole('checkbox', { name: 'I understand this scan uses simulated results.' })
    .check();
  await page.getByRole('button', { name: 'Extract a review draft' }).click();
  await expect(page.getByRole('heading', { name: 'Review your scan' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save selected packs' })).toBeDisabled();
  await page.getByRole('checkbox', { name: /SAMPLE TAB/ }).check();
  await page.getByRole('checkbox', { name: 'I confirm this selected line is a medicine' }).check();
  await page.getByLabel('Purchased pack count').fill('2');
  await page.getByLabel('Quantity remaining').fill('10');
  await page.getByLabel('Quantity unit').selectOption('tablet');
  await page.getByRole('button', { name: 'Save selected packs' }).click();
  await expect(page.getByRole('heading', { name: 'My cabinet', exact: true })).toBeVisible();
  const after = (await (await page.request.get('/api/inventory')).json()).packs;
  expect(after).toHaveLength(before.length + 3);
  expect(
    after.filter((p: { product: { name: string } }) => p.product.name === 'SAMPLE SOAP'),
  ).toHaveLength(0);
  const csrf = (await (await page.request.get('/api/auth/status')).json()).csrf;
  for (const p of after.filter((p: { id: string }) => !before.includes(p.id)))
    await page.request.delete(`/api/packs/${p.id}`, {
      headers: { Origin: 'http://localhost:5174', 'x-csrf-token': csrf },
      data: { version: p.version, confirm: 'DELETE' },
    });
});

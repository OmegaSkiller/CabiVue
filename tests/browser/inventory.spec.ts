import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('missing expiry review, responsive layouts, keyboard forms and both themes', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My cabinet', exact: true })).toBeVisible();
  for (const width of [320, 360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByRole('button', { name: 'Add medicine', exact: true })).toBeVisible();
  }
  await page.setViewportSize({ width: 1440, height: 1080 });
  await expect(
    page.getByRole('alert').filter({ hasText: 'without an expiry date entered' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Review missing dates', exact: true }).click();
  await expect(page.getByLabel('Filter medicines')).toHaveValue('unknown');
  await expect(page.getByText('Expiry unknown', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add an expiry date', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Expiry date', { exact: true })).toHaveValue('');
  await expect(
    dialog.getByText('Add an expiry date to receive expiry reminders. Usability is unknown.'),
  ).toBeVisible();
  await expect(dialog.getByLabel('Expiry date', { exact: true })).toBeEditable();
  await page.screenshot({ path: 'docs/screenshots/expiry-warning-desktop.png', fullPage: true });
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByLabel('Filter medicines').selectOption('all');
  await page.screenshot({ path: 'docs/screenshots/cabinet-desktop-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Use dark theme' }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/cabinet-desktop-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/screenshots/cabinet-mobile-dark.png', fullPage: true });
  await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.screenshot({ path: 'docs/screenshots/cabinet-mobile-light.png', fullPage: true });
  await page.getByRole('button', { name: 'Add medicine', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
});

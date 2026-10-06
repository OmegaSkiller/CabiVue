import { test, expect } from '@playwright/test';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
test('production shell excludes private caches and waits for edits before updating', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My cabinet', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const contact = page.getByRole('textbox', { name: /^Emergency contact Enter/ });
  // A real, changed service-worker response gives a deterministic waiting version.
  await contact.fill('Synthetic unsaved contact');
  appendFileSync(
    join(process.env.PWA_TEST_DIR!, 'dist/web/sw.js'),
    '\n// Synthetic update fixture\n',
  );
  await page.evaluate(async () => {
    await (await navigator.serviceWorker.ready).update();
  });
  const update = page.getByRole('button', { name: 'Update & reload', exact: true });
  await expect(update).toBeVisible();
  await expect(update).toBeDisabled();
  await expect(contact).toHaveValue('Synthetic unsaved contact');
  await contact.fill('');
  await expect(update).toBeEnabled();
  await update.click();
  await expect(page.getByRole('heading', { name: 'My cabinet', exact: true })).toBeVisible();
  const cached = await page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
    return urls;
  });
  expect(cached.some((url) => new URL(url).pathname === '/index.html')).toBe(true);
  expect(cached.every((url) => !new URL(url).pathname.startsWith('/api'))).toBe(true);
  expect(cached.every((url) => new URL(url).origin === 'http://localhost:5175')).toBe(true);
  await context.setOffline(true);
  await expect(page.getByRole('alert').filter({ hasText: 'You’re offline' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add medicine', exact: true })).toBeDisabled();
  expect(
    await page.evaluate(async () => {
      try {
        await fetch('/api/inventory');
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Urgent help', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Sample tablets · synthetic', exact: true }),
  ).not.toBeVisible();
  await page.locator('.language-picker select').selectOption('bg');
  await expect(page.locator('html')).toHaveAttribute('lang', 'bg');
  await page.reload();
  await expect(page.locator('.language-picker select')).toHaveValue('bg');
  await expect(page.getByRole('button', { name: 'Спешна помощ', exact: true })).toBeVisible();
  await page.locator('.language-picker select').selectOption('en');
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'My cabinet', exact: true })).toBeVisible();
});

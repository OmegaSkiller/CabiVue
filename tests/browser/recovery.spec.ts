import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('shared identity edits preserve pack drafts and a downloaded backup restores through settings', async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup', exact: true }).click();
  const backup = await downloadEvent;
  const path = await backup.path();
  expect(path).toBeTruthy();
  await page.getByRole('button', { name: 'My cabinet', exact: true }).click();
  await page.getByRole('button', { name: 'Add an expiry date', exact: true }).click();
  const packDialog = page.getByRole('dialog', { name: 'Sample tablets · synthetic', exact: true });
  await packDialog.getByRole('textbox', { name: 'Notes', exact: true }).fill('Unsaved pack notes');
  await packDialog.getByRole('button', { name: 'Edit shared product' }).click();
  const productDialog = page.getByRole('dialog', { name: 'Edit shared product', exact: true });
  await productDialog
    .getByLabel('Medicine name', { exact: true })
    .fill('Corrected synthetic tablets');
  await productDialog.getByRole('button', { name: 'Save shared product' }).click();
  await expect(productDialog).not.toBeVisible();
  const updatedDialog = page.getByRole('dialog', {
    name: 'Corrected synthetic tablets',
    exact: true,
  });
  await expect(updatedDialog.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue(
    'Unsaved pack notes',
  );
  await page.keyboard.press('Escape');
  await expect(updatedDialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Choose a backup to restore').setInputFiles(path!);
  await expect(page.getByRole('status').filter({ hasText: 'Backup from' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Replace cabinet & sign out' })).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByLabel('Type RESTORE to confirm replacement').fill('RESTORE');
  await page.getByRole('button', { name: 'Replace cabinet & sign out' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Cabinet restored' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Sample tablets · synthetic', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'List recovery points' }).click();
  await expect(page.getByRole('button', { name: /^Download \d/ })).toBeVisible();
});

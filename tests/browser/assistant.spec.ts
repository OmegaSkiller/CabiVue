import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('urgent help is available before sign in; interview stays transient and editable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Urgent help', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Get urgent medical help now.' })).toBeVisible();
  await expect(page.getByText(/No local emergency number has been configured/)).toBeVisible();
  await page.getByRole('button', { name: 'Return to Cabivue' }).click();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Assistant', exact: true }).click();
  await page
    .getByLabel('Urgent or severe symptoms / possible overdose or poisoning')
    .selectOption('no');
  await page.getByLabel('Your answer').fill('No urgent symptoms reported');
  await page.getByRole('button', { name: 'Continue interview' }).click();
  await expect(page.getByText('History group 2 of 5')).toBeVisible();
  await page.getByLabel('Your answer').fill('Synthetic symptom history, onset unknown');
  await page.getByRole('button', { name: 'Continue interview' }).click();
  await expect(page.getByText('History group 3 of 5')).toBeVisible();
  await page.getByLabel('This interview is for an adult').selectOption('yes');
  await page.getByLabel('Pregnancy or breastfeeding').selectOption('no');
  await page.getByLabel('Immune suppression or a complex medical condition').selectOption('no');
  await page.getByLabel('Your answer').fill('Synthetic adult, age 30, other information unknown');
  await page.getByRole('button', { name: 'Continue interview' }).click();
  await page.getByLabel('Your answer').fill('No medicines taken. Cabinet ownership is separate.');
  await page.getByRole('button', { name: 'Continue interview' }).click();
  await page
    .getByLabel('Intoxication, withdrawal, or another concerning substance exposure')
    .selectOption('no');
  await page.getByLabel('Your answer').fill('No new substances reported');
  await page.getByRole('button', { name: 'Continue interview' }).click();
  await expect(page.getByRole('heading', { name: 'Review your reported history' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm my summary' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'History confirmed' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: 'docs/screenshots/interview-mobile.png', fullPage: true });
  const status = await (await page.request.get('/api/auth/status')).json();
  await page.request.delete('/api/assistant', {
    headers: { Origin: 'http://localhost:5174', 'x-csrf-token': status.csrf },
    data: {},
  });
});

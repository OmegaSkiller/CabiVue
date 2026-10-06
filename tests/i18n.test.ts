import { afterEach, expect, test } from 'vitest';
import i18n, {
  catalogs,
  languages,
  supportedLanguage,
  t,
  quantity,
  date,
  number,
} from '../src/web/i18n';
import { QUESTIONS, PROFESSIONAL_REMINDER } from '../src/domain/intake';
const placeholders = (s: string) => [...s.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1]).sort();
afterEach(async () => {
  await i18n.changeLanguage('en');
});
test('all bundled catalogs cover source keys, interpolation and native plural categories', () => {
  expect(languages).toHaveLength(10);
  for (const { code } of languages) {
    const catalog = catalogs[code];
    for (const [key, source] of Object.entries(catalogs.en)) {
      expect(catalog[key], `${code}: ${key}`).toBeTruthy();
      expect(placeholders(catalog[key]), `${code}: ${key}`).toEqual(placeholders(source));
    }
    for (const key of Object.keys(catalogs.en).filter((k) => k.endsWith('_other'))) {
      for (const category of new Intl.PluralRules(code).resolvedOptions().pluralCategories)
        expect(catalog[key.replace(/_other$/, `_${category}`)]).toBeTruthy();
    }
    for (const key of [...QUESTIONS, PROFESSIONAL_REMINDER]) expect(catalog[key]).toBeTruthy();
    expect(catalog['Type RESTORE to confirm replacement']).toContain('RESTORE');
  }
});
test('regional locale normalization and unsupported fallback are deterministic', () => {
  expect(supportedLanguage('bg-BG')).toBe('bg');
  expect(supportedLanguage('zh-Hans-CN')).toBe('zh');
  expect(supportedLanguage('pt_BR')).toBe('pt');
  expect(supportedLanguage('de')).toBeNull();
});
test('counts use Bulgarian and Russian grammar and every Arabic plural category', async () => {
  await i18n.changeLanguage('bg');
  expect(quantity(1, 'tablet')).toBe('1 таблетка');
  expect(quantity(2, 'tablet')).toBe('2 таблетки');
  expect(t('missingExpiryBody', { count: 2, amount: number(2) })).toContain('2 лекарства');
  await i18n.changeLanguage('ru');
  for (const [count, noun] of [
    [1, 'таблетка'],
    [2, 'таблетки'],
    [5, 'таблеток'],
    [21, 'таблетка'],
  ] as const)
    expect(quantity(count, 'tablet')).toBe(`${count} ${noun}`);
  await i18n.changeLanguage('ar');
  for (const count of [0, 1, 2, 3, 11, 100]) {
    const category = new Intl.PluralRules('ar').select(count);
    expect(quantity(count, 'tablet')).toBe(
      catalogs.ar[`unit.tablet_${category}`].replace('{{amount}}', number(count)),
    );
    expect(t('missingExpiryBody', { count, amount: number(count) })).not.toContain('missingExpiry');
  }
});
test('dates preserve month precision and source values stay out of translation', async () => {
  await i18n.changeLanguage('bg');
  expect(date('2027-10', 'month')).toBe(
    new Intl.DateTimeFormat('bg', { timeZone: 'UTC', year: 'numeric', month: 'short' }).format(
      new Date('2027-10-01T12:00:00Z'),
    ),
  );
  expect(date(null)).toBe('');
  expect(t('Delete {{name}}', { name: 'Synthetic Brand XYZ' })).toContain('Synthetic Brand XYZ');
});

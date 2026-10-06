import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import bg from './locales/bg.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import bn from './locales/bn.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';

export const languages = [
  { code: 'en', name: 'English' },
  { code: 'bg', name: 'Български' },
  { code: 'zh', name: '中文（简体）' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'ar', name: 'العربية' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'pt', name: 'Português' },
  { code: 'ru', name: 'Русский' },
] as const;
export type Language = (typeof languages)[number]['code'];
export const catalogs: Record<Language, Record<string, string>> = {
  en,
  bg,
  zh,
  hi,
  es,
  fr,
  ar,
  bn,
  pt,
  ru,
};
export function supportedLanguage(value: string | null | undefined): Language | null {
  const base = value?.toLowerCase().split(/[-_]/)[0];
  return languages.find((l) => l.code === base)?.code ?? null;
}
export function initialLanguage(): Language {
  try {
    const saved = supportedLanguage(localStorage.getItem('cabivue-language'));
    if (saved) return saved;
  } catch {
    /* Storage can be disabled; localization still works. */
  }
  if (typeof navigator !== 'undefined')
    for (const candidate of navigator.languages) {
      const supported = supportedLanguage(candidate);
      if (supported) return supported;
    }
  return 'en';
}
function applyLanguage(value: string) {
  const language = supportedLanguage(value) || 'en';
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language === 'zh' ? 'zh-Hans' : language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }
  try {
    localStorage.setItem('cabivue-language', language);
  } catch {
    /* Preference is optional. */
  }
}
void i18next.use(initReactI18next).init({
  resources: Object.fromEntries(
    languages.map(({ code }) => [code, { translation: catalogs[code] }]),
  ),
  lng: initialLanguage(),
  supportedLngs: languages.map((l) => l.code),
  fallbackLng: 'en',
  keySeparator: false,
  nsSeparator: false,
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});
i18next.on('languageChanged', applyLanguage);
applyLanguage(i18next.language);
export const t = (key: string, values?: Record<string, string | number>) => i18next.t(key, values);
export const number = (value: number) => new Intl.NumberFormat(i18next.language).format(value);
export function date(value: string | null, precision: 'day' | 'month' = 'day') {
  if (!value) return '';
  return new Intl.DateTimeFormat(i18next.language, {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    ...(precision === 'day' ? { day: 'numeric' } : {}),
  }).format(new Date(`${value}${precision === 'month' ? '-01' : ''}T12:00:00Z`));
}
export const quantity = (count: number, unit: string) =>
  catalogs.en[`unit.${unit}_other`]
    ? t(`unit.${unit}`, { count, amount: number(count) })
    : `${number(count)} ${unit}`;
export default i18next;

import { useTranslation } from 'react-i18next';
import { languages } from '../i18n';
export function LanguagePicker() {
  const { t, i18n } = useTranslation();
  return (
    <label className="language-picker">
      <span className="sr-only">{t('Language')}</span>
      <select
        className="select select-sm"
        value={i18n.resolvedLanguage}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
      >
        {languages.map(({ code, name }) => (
          <option key={code} value={code} lang={code} dir="auto">
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

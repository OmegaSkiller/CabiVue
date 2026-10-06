import { t } from '../i18n';
import { useState, useEffect, type FormEvent, type ReactNode } from 'react';
import type { Settings, Location } from '../../contracts/inventory';
import { api, send } from '../api';
import { Field, ErrorMessage } from './common';
export function SettingsScreen({
  settings,
  locations,
  onSaved,
  children,
  onDirty,
}: {
  settings: Settings;
  locations: Location[];
  onSaved: () => void;
  children?: ReactNode;
  onDirty: (dirty: boolean) => void;
}) {
  const [values, setValues] = useState(settings);
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(
    () => onDirty(JSON.stringify(values) !== JSON.stringify(settings) || !!location || busy),
    [values, settings, location, busy, onDirty],
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/settings', send('PUT', values));
      setMessage('Household settings saved.');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function addLocation(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/locations', send('POST', { name: location }));
      setLocation('');
      onSaved();
      setMessage('Storage location added.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="settings-grid">
      <section className="card section-card">
        <h2>{t('Your household')}</h2>
        <p className="muted">
          {t('Dates follow your household timezone. Urgent-help contacts are configured here.')}
        </p>
        <ErrorMessage error={error} />
        {message && (
          <p role="status" className="success-copy">
            {t(message)}
          </p>
        )}
        <form onSubmit={save}>
          <fieldset disabled={busy}>
            <Field label={t('Timezone')}>
              <input
                className="input"
                value={values.timezone}
                onChange={(e) => setValues({ ...values, timezone: e.target.value })}
                required
                placeholder={t('Europe/Sofia')}
              />
            </Field>
            <Field
              label={t('Emergency contact')}
              hint={t(
                'Enter a confirmed local number or instruction. Cabivue does not guess emergency numbers.',
              )}
            >
              <input
                className="input"
                value={values.emergencyContact}
                onChange={(e) => setValues({ ...values, emergencyContact: e.target.value })}
              />
            </Field>
            <Field label={t('Emergency contact location')}>
              <input
                className="input"
                value={values.emergencyLocation}
                onChange={(e) => setValues({ ...values, emergencyLocation: e.target.value })}
                placeholder={t('Country or region')}
              />
            </Field>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? t('Saving…') : t('Save household settings')}
            </button>
          </fieldset>
        </form>
      </section>
      <section className="card section-card">
        <h2>{t('Storage locations')}</h2>
        <p className="muted">{t('Make it easy to find the right pack.')}</p>
        <div className="location-list">
          {locations.map((l) => (
            <span className="badge badge-outline" key={l.id}>
              {l.name}
            </span>
          ))}
          {!locations.length && <p className="small muted">{t('No locations yet.')}</p>}
        </div>
        <form onSubmit={addLocation}>
          <fieldset disabled={busy}>
            <Field label={t('New location')}>
              <input
                className="input"
                value={location}
                maxLength={300}
                onChange={(e) => setLocation(e.target.value)}
                required
                placeholder={t('e.g. Hallway cupboard')}
              />
            </Field>
            <button className="btn btn-outline">{t('Add location')}</button>
          </fieldset>
        </form>
      </section>
      {children}
    </div>
  );
}

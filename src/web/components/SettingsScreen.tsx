import { useState, type FormEvent, type ReactNode } from 'react';
import type { Settings, Location } from '../../contracts/inventory';
import { api, send } from '../api';
import { Field, ErrorMessage } from './common';
export function SettingsScreen({
  settings,
  locations,
  onSaved,
  children,
}: {
  settings: Settings;
  locations: Location[];
  onSaved: () => void;
  children?: ReactNode;
}) {
  const [values, setValues] = useState(settings);
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
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
    setError('');
    try {
      await api('/locations', send('POST', { name: location }));
      setLocation('');
      onSaved();
      setMessage('Storage location added.');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="settings-grid">
      <section className="card section-card">
        <h2>Your household</h2>
        <p className="muted">
          Dates follow your household timezone. Urgent-help contacts are configured here.
        </p>
        <ErrorMessage error={error} />
        {message && (
          <p role="status" className="success-copy">
            {message}
          </p>
        )}
        <form onSubmit={save}>
          <Field label="Timezone">
            <input
              className="input"
              value={values.timezone}
              onChange={(e) => setValues({ ...values, timezone: e.target.value })}
              required
              placeholder="Europe/Sofia"
            />
          </Field>
          <Field
            label="Emergency contact"
            hint="Enter a confirmed local number or instruction. Cabivue does not guess emergency numbers."
          >
            <input
              className="input"
              value={values.emergencyContact}
              onChange={(e) => setValues({ ...values, emergencyContact: e.target.value })}
            />
          </Field>
          <Field label="Emergency contact location">
            <input
              className="input"
              value={values.emergencyLocation}
              onChange={(e) => setValues({ ...values, emergencyLocation: e.target.value })}
              placeholder="Country or region"
            />
          </Field>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save household settings'}
          </button>
        </form>
      </section>
      <section className="card section-card">
        <h2>Storage locations</h2>
        <p className="muted">Make it easy to find the right pack.</p>
        <div className="location-list">
          {locations.map((l) => (
            <span className="badge badge-outline" key={l.id}>
              {l.name}
            </span>
          ))}
          {!locations.length && <p className="small muted">No locations yet.</p>}
        </div>
        <form onSubmit={addLocation}>
          <Field label="New location">
            <input
              className="input"
              value={location}
              maxLength={300}
              onChange={(e) => setLocation(e.target.value)}
              required
              placeholder="e.g. Hallway cupboard"
            />
          </Field>
          <button className="btn btn-outline">Add location</button>
        </form>
      </section>
      {children}
    </div>
  );
}

import { t } from '../i18n';
import { useState, useEffect, type FormEvent } from 'react';
import { api, send } from '../api';
import { Field, ErrorMessage } from './common';
export function ProviderSettings({ onDirty }: { onDirty: (dirty: boolean) => void }) {
  const [configured, setConfigured] = useState(false);
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => onDirty(!!key || busy), [key, busy, onDirty]);
  useEffect(() => {
    let active = true;
    api<{ configured: boolean }>('/provider')
      .then((v) => {
        if (active) setConfigured(v.configured);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/provider/key', send('PUT', { key }));
      setKey('');
      setConfigured(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    setBusy(true);
    setError('');
    try {
      await api('/provider/key', send('DELETE', {}));
      setKey('');
      setConfigured(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card section-card">
      <h2>{t('Optional OpenAI connection')}</h2>
      <p className="muted">
        {t(
          'Scans and optional history extraction run on OpenAI’s servers. Your provider may charge for requests. Nothing is sent until you consent for that request.',
        )}
      </p>
      <ErrorMessage error={error} />
      <p role="status" className={configured ? 'success-copy' : 'muted'}>
        {configured ? t('Key connected for this session.') : t('No provider key connected.')}
      </p>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <Field
            label={t('OpenAI API key')}
            hint={t(
              'Held in server memory for this session. Cleared on sign out, expiry, removal, or restart.',
            )}
          >
            <input
              className="input"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              minLength={20}
              maxLength={300}
              required
            />
          </Field>
          <div className="provider-actions">
            <button className="btn btn-primary" disabled={busy}>
              {configured ? t('Replace key') : t('Connect key')}
            </button>
            {configured && (
              <button
                className="btn btn-outline"
                type="button"
                disabled={busy}
                onClick={() => void remove()}
              >
                {t('Remove key')}
              </button>
            )}
          </div>
        </fieldset>
      </form>
      <p className="small muted">
        {t('Your cabinet works without a key. The connection does not make AI processing local.')}
      </p>
    </section>
  );
}

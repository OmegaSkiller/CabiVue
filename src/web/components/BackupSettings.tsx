import i18n, { t, date, number } from '../i18n';
import { useEffect, useState, type FormEvent } from 'react';
import { validateBackup, type Backup } from '../../contracts/backup';
import { api, send } from '../api';
import { ErrorMessage, Field } from './common';

function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function BackupSettings({
  onDirty,
  canRestore,
  onRestored,
}: {
  onDirty: (dirty: boolean) => void;
  canRestore: boolean;
  onRestored: (recoveryPoint: string) => void;
}) {
  const [prepared, setPrepared] = useState<{ backup: Backup; revision: string } | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => onDirty(!!prepared || busy), [prepared, busy, onDirty]);
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function prepare(file: File) {
    setPrepared(null);
    setConfirmation('');
    await run(async () => {
      if (file.size > 8 * 1024 * 1024) throw new Error('Choose a Cabivue JSON backup under 8 MB.');
      let backup: Backup;
      try {
        backup = validateBackup(JSON.parse(await file.text()));
      } catch {
        throw new Error('This file is invalid or incompatible. Your cabinet has not changed.');
      }
      const { revision } = await api<{ revision: string }>('/backups/status');
      setPrepared({ backup, revision });
    });
  }
  async function restore(e: FormEvent) {
    e.preventDefault();
    if (!prepared || !canRestore || confirmation !== 'RESTORE') return;
    await run(async () => {
      const result = await api<{ recoveryPoint: string }>(
        '/backups/restore',
        send('POST', {
          backup: prepared.backup,
          expectedRevision: prepared.revision,
          confirm: confirmation,
        }),
      );
      onRestored(result.recoveryPoint);
    });
  }
  return (
    <section className="card section-card">
      <h2>{t('Backup & recovery')}</h2>
      <p className="muted">
        {t(
          'Backups contain your cabinet and household settings in plaintext. Keep downloads private. Account credentials, provider keys, photos, and interviews are excluded.',
        )}
      </p>
      <ErrorMessage error={error} />
      <fieldset disabled={busy}>
        <button
          className="btn btn-outline"
          onClick={() =>
            void run(async () => {
              const backup = await api<Backup>('/backups/export');
              download(backup, `cabivue-${backup.exportedAt.slice(0, 10)}.json`);
            })
          }
        >
          {t('Download backup')}
        </button>
        <Field
          label={t('Choose a backup to restore')}
          hint={t(
            'Replacing the cabinet keeps your account and signs out every session. A recovery point is saved first.',
          )}
        >
          <input
            className="file-input"
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void prepare(file);
              e.target.value = '';
            }}
          />
        </Field>
        {prepared && (
          <form onSubmit={restore}>
            <p role="status">
              {t(
                'Backup from {{date}}: {{packs}} packs, {{products}} products, {{locations}} locations.',
                {
                  date: date(prepared.backup.exportedAt.slice(0, 10)),
                  packs: number(prepared.backup.packs.length),
                  products: number(prepared.backup.products.length),
                  locations: number(prepared.backup.locations.length),
                },
              )}
            </p>
            <p className="warning-copy">
              {t(
                'This replaces all current cabinet records and household settings. Save or discard other edits first.',
              )}
            </p>
            <Field label={t('Type RESTORE to confirm replacement')}>
              <input
                className="input"
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </Field>
            <div className="dialog-actions">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  setPrepared(null);
                  setConfirmation('');
                }}
              >
                {t('Cancel restore')}
              </button>
              <button
                className="btn btn-primary"
                disabled={!canRestore || confirmation !== 'RESTORE'}
              >
                {t('Replace cabinet & sign out')}
              </button>
            </div>
          </form>
        )}
        <h3>{t('Previous recovery points')}</h3>
        <p className="small muted">
          {t('These files live on your server. Download one before selecting it for a restore.')}
        </p>
        <button
          className="btn btn-outline"
          onClick={() =>
            void run(async () => {
              setFiles((await api<{ files: string[] }>('/backups/recovery')).files);
            })
          }
        >
          {t('List recovery points')}
        </button>
        {files.map((name) => (
          <div key={name}>
            <button
              className="review-link"
              onClick={() =>
                void run(async () => {
                  download(await api(`/backups/recovery/${name}`), name);
                })
              }
            >
              {t('Download {{date}}', {
                date: new Date(Number(name.split('-')[1])).toLocaleString(i18n.language),
              })}
            </button>
          </div>
        ))}
      </fieldset>
      {busy && <p role="status">{t('Working…')}</p>}
    </section>
  );
}

import { asset } from '../environment';
import { t } from '../i18n';
import type { Settings } from '../../contracts/inventory';
import { WarningIcon } from './common';
export function UrgentHelp({
  settings,
  onBack,
  dark,
}: {
  settings?: Settings;
  onBack: () => void;
  dark: boolean;
}) {
  const contact = settings?.emergencyContact || '';
  return (
    <main className="urgent-screen">
      <img
        src={asset(dark ? 'brand/cabivue-logo-reversed.svg' : 'brand/cabivue-logo.svg')}
        className="logo"
        alt="Cabivue"
      />
      <section className="card urgent-card">
        <span className="urgent-symbol">
          <WarningIcon />
        </span>
        <h1>{t('Get urgent medical help now.')}</h1>
        <p>
          {t(
            'For severe or concerning symptoms, possible poisoning, overdose, or a severe allergic reaction, contact local emergency services now.',
          )}
        </p>
        <p>
          {t(
            'Do not wait for an AI response, finish an interview, or try a cabinet medicine before seeking urgent help. If possible, ask someone nearby to help.',
          )}
        </p>
        {contact ? (
          <div className="urgent-contact">
            <h2>{settings?.emergencyLocation || t('Configured emergency contact')}</h2>
            <p>{contact}</p>
            {/^[+\d ()-]+$/.test(contact) && (
              <a className="btn btn-error" href={`tel:${contact.replace(/[^+\d]/g, '')}`}>
                {t('Call {{contact}}', { contact })}
              </a>
            )}
          </div>
        ) : (
          <div className="alert alert-warning">
            {t(
              'No local emergency number has been configured. Contact your local emergency services; Cabivue does not infer your location or invent a number.',
            )}
          </div>
        )}
        <p className="small muted">
          {t(
            'This fixed help screen works without an AI key. These examples are not exhaustive and do not rule out serious illness.',
          )}
        </p>
        <button className="btn btn-outline" onClick={onBack}>
          {t('Return to Cabivue')}
        </button>
      </section>
    </main>
  );
}

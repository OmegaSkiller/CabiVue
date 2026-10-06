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
        src={dark ? '/brand/cabivue-logo-reversed.svg' : '/brand/cabivue-logo.svg'}
        className="logo"
        alt="Cabivue"
      />
      <section className="card urgent-card">
        <span className="urgent-symbol">
          <WarningIcon />
        </span>
        <h1>Get urgent medical help now.</h1>
        <p>
          For severe or concerning symptoms, possible poisoning, overdose, or a severe allergic
          reaction, contact local emergency services now.
        </p>
        <p>
          Do not wait for an AI response, finish an interview, or try a cabinet medicine before
          seeking urgent help. If possible, ask someone nearby to help.
        </p>
        {contact ? (
          <div className="urgent-contact">
            <h2>{settings?.emergencyLocation || 'Configured emergency contact'}</h2>
            <p>{contact}</p>
            {/^[+\d ()-]+$/.test(contact) && (
              <a className="btn btn-error" href={`tel:${contact.replace(/[^+\d]/g, '')}`}>
                Call {contact}
              </a>
            )}
          </div>
        ) : (
          <div className="alert alert-warning">
            No local emergency number has been configured. Contact your local emergency services;
            Cabivue does not infer your location or invent a number.
          </div>
        )}
        <p className="small muted">
          This fixed help screen works without an AI key. These examples are not exhaustive and do
          not rule out serious illness.
        </p>
        <button className="btn btn-outline" onClick={onBack}>
          Return to Cabivue
        </button>
      </section>
    </main>
  );
}

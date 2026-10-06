import { useEffect, useState, type FormEvent } from 'react';
import { IconArrowRight, IconNotes } from '@tabler/icons-react';
import type { IntakeView, Risk, ReportedGroup } from '../../contracts/assistant';
import type { Pack } from '../../contracts/inventory';
import { reviewedSources } from '../../domain/expiry';
import { api, send } from '../api';
import { Field, ErrorMessage, WarningIcon } from './common';
const riskLabels: Record<keyof Risk, string> = {
  urgent: 'Urgent or severe symptoms / possible overdose or poisoning',
  adult: 'This interview is for an adult',
  pregnancy: 'Pregnancy or breastfeeding',
  highRisk: 'Immune suppression or a complex medical condition',
  unsafeExposure: 'Intoxication, withdrawal, or another concerning substance exposure',
};
const unknownRisk: Risk = {
  urgent: 'unknown',
  adult: 'unknown',
  pregnancy: 'unknown',
  highRisk: 'unknown',
  unsafeExposure: 'unknown',
};
export function RiskFields({
  risk,
  onChange,
  keys,
}: {
  risk: Risk;
  onChange: (r: Risk) => void;
  keys: (keyof Risk)[];
}) {
  return (
    <div className="risk-fields">
      {keys.map((k) => (
        <Field key={k} label={riskLabels[k]}>
          <select
            className="select"
            value={risk[k]}
            onChange={(e) => onChange({ ...risk, [k]: e.target.value as Risk[typeof k] })}
          >
            <option value="unknown">Unknown / not sure</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      ))}
    </div>
  );
}
export function AssistantScreen({
  packs,
  demo,
  onUrgent,
  onDirty,
  compact = false,
}: {
  packs: Pack[];
  demo: boolean;
  onUrgent: () => void;
  onDirty: (v: boolean) => void;
  compact?: boolean;
}) {
  const [view, setView] = useState<IntakeView | null>(null);
  const [message, setMessage] = useState('');
  const [risk, setRisk] = useState<Risk>(unknownRisk);
  const [groups, setGroups] = useState<ReportedGroup[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [useProvider, setUseProvider] = useState(false);
  const [consent, setConsent] = useState(false);
  const [selected, setSelected] = useState('');
  const [facts, setFacts] = useState<{ pack: Pack; blocks: string[]; reminder: string } | null>(
    null,
  );
  function apply(v: IntakeView) {
    setView(v);
    setRisk(v.risk);
    setGroups(v.groups);
  }
  useEffect(() => {
    let active = true;
    api<IntakeView>('/assistant')
      .then((v) => {
        if (active) apply(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(
    () =>
      onDirty(
        !!message || (!!view && !view.confirmed && view.groups.some((g) => g.quote !== null)),
      ),
    [message, view, onDirty],
  );
  useEffect(() => {
    let active = true;
    if (!selected) {
      setFacts(null);
      return;
    }
    api<{ pack: Pack; blocks: string[]; reminder: string }>(`/assistant/pack/${selected}`)
      .then((v) => {
        if (active) setFacts(v);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selected]);
  async function answer(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const v = await api<IntakeView>(
        '/assistant/answer',
        send('POST', { message, risk, useProvider, consent, packId: selected || null }),
      );
      apply(v);
      setMessage('');
      setConsent(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    setError('');
    setBusy(true);
    try {
      apply(
        await api<IntakeView>('/assistant/summary', send('PUT', { groups, risk, confirm: true })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (!window.confirm('Clear this transient interview and start a new one?')) return;
    setError('');
    try {
      apply(await api<IntakeView>('/assistant', send('DELETE', {})));
      setMessage('');
      setConsent(false);
      onDirty(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const next = view?.nextGroup;
  return (
    <section className={`assistant-screen ${compact ? 'assistant-compact' : ''}`}>
      <div className="assistant-intro">
        <IconNotes size={26} />
        <h2>Prepare your questions</h2>
        <p className="muted">
          Collect your symptom history and review available leaflet facts. This assistant cannot
          diagnose, choose medication, or generate doses.
        </p>
      </div>
      <button className="btn btn-outline urgent-assistant" onClick={onUrgent}>
        <WarningIcon />
        Urgent help
      </button>
      <ErrorMessage error={error} />
      {!view ? (
        <p role="status">Opening the interview…</p>
      ) : (
        <>
          {view.state === 'emergency' ? (
            <div className="alert alert-error" role="alert">
              <WarningIcon />
              <div>
                <strong>Get urgent medical help now.</strong>
                <p>
                  Contact {view.urgentContact || 'local emergency services'}
                  {view.urgentLocation ? ` (${view.urgentLocation})` : ''}. Do not wait for this
                  interview or try a cabinet medicine first.
                </p>
                <button className="btn btn-outline" onClick={onUrgent}>
                  Open urgent help
                </button>
              </div>
            </div>
          ) : (
            <>
              {view.state === 'professional_review' && (
                <div className="alert missing-alert" role="alert">
                  <WarningIcon />
                  <div>
                    <strong>Arrange professional review.</strong>
                    <p>
                      Contact a doctor promptly for an assessment. This interview cannot determine
                      the cause or suitable treatment. Severe or worsening symptoms may need urgent
                      help.
                    </p>
                  </div>
                </div>
              )}
              {next !== null && next !== undefined ? (
                <form className="interview-form" onSubmit={answer}>
                  <fieldset disabled={busy}>
                    <p className="eyebrow">History group {next + 1} of 5</p>
                    <h3>{view.question}</h3>
                    {next === 0 && <RiskFields risk={risk} onChange={setRisk} keys={['urgent']} />}
                    {next === 2 && (
                      <RiskFields
                        risk={risk}
                        onChange={setRisk}
                        keys={['adult', 'pregnancy', 'highRisk']}
                      />
                    )}
                    {next === 4 && (
                      <RiskFields risk={risk} onChange={setRisk} keys={['unsafeExposure']} />
                    )}
                    <Field
                      label="Your answer"
                      hint="Say ‘unknown’ for anything you’re unsure about. Include only what you want in this transient interview."
                    >
                      <textarea
                        className="textarea"
                        rows={5}
                        value={message}
                        maxLength={2000}
                        required
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </Field>
                    <label className="check-label">
                      <input
                        className="checkbox checkbox-sm"
                        type="checkbox"
                        checked={useProvider}
                        onChange={(e) => {
                          setUseProvider(e.target.checked);
                          setConsent(false);
                        }}
                      />
                      {demo
                        ? 'Use simulated history extraction'
                        : 'Use OpenAI to extract interview facts'}
                    </label>
                    {useProvider && (
                      <div className="consent-note">
                        <p className="small">
                          {demo
                            ? 'Demo output is simulated. No provider request is made.'
                            : 'OpenAI receives this answer, the interview group, urgency state, and the selected pack’s allowed source facts/limitations. Other cabinet records and previous answers are not sent. Provider policies and charges apply.'}
                        </p>
                        <label className="check-label">
                          <input
                            className="checkbox checkbox-sm"
                            type="checkbox"
                            checked={consent}
                            onChange={(e) => setConsent(e.target.checked)}
                          />
                          {demo
                            ? 'I understand this extraction is simulated.'
                            : 'Send this answer and selected context to OpenAI for this request.'}
                        </label>
                      </div>
                    )}
                    <button
                      className="btn btn-primary"
                      disabled={busy || (useProvider && !consent)}
                    >
                      {busy ? 'Processing…' : 'Continue interview'}
                      <IconArrowRight size={18} />
                    </button>
                  </fieldset>
                </form>
              ) : (
                <section className="interview-summary">
                  <h3>Review your reported history</h3>
                  <p className="small muted">
                    Extracted text is provisional. Check and edit it before confirming. Unknown
                    answers stay unknown.
                  </p>
                  {groups.map((g, i) => (
                    <Field key={g.groupIndex} label={`${i + 1}. ${view.questions[i]}`}>
                      <textarea
                        className="textarea"
                        rows={3}
                        maxLength={2000}
                        value={g.quote || ''}
                        onChange={(e) => {
                          setGroups((gs) =>
                            gs.map((item, n) =>
                              n === i
                                ? {
                                    ...item,
                                    quote: e.target.value || null,
                                    status: e.target.value ? 'reported' : 'unknown',
                                  }
                                : item,
                            ),
                          );
                          setView((v) => (v ? { ...v, confirmed: false } : v));
                        }}
                      />
                      <span className="small muted">
                        {g.status === 'unknown' ? 'Unknown / not supplied' : 'Reported by you'}
                      </span>
                    </Field>
                  ))}
                  <RiskFields
                    risk={risk}
                    onChange={(r) => {
                      setRisk(r);
                      setView((v) => (v ? { ...v, confirmed: false } : v));
                    }}
                    keys={['urgent', 'adult', 'pregnancy', 'highRisk', 'unsafeExposure']}
                  />
                  {view.confirmed ? (
                    <div className="alert alert-success" role="status">
                      History confirmed for this session. You can select and copy it for your
                      professional consultation.
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() => void confirm()}
                    >
                      Confirm my summary
                    </button>
                  )}
                </section>
              )}
            </>
          )}
          <p className="assistant-reminder">{view.reminder}</p>
          <button className="btn btn-ghost" onClick={() => void reset()}>
            Clear interview
          </button>
        </>
      )}
      <section className="leaflet-section">
        <h3>Leaflet information</h3>
        <Field label="Choose a pack">
          <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select an exact pack</option>
            {packs
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.product.name} · {p.expiryValue || 'expiry unknown'}
                </option>
              ))}
          </select>
        </Field>
        {facts && (
          <div className="leaflet-card">
            <strong>{facts.pack.product.name}</strong>
            {facts.blocks.length > 0 ? (
              <>
                <p className="small muted">Product-specific guidance is unavailable:</p>
                {facts.blocks.map((b, i) => (
                  <p className="warning-copy" key={i}>
                    <WarningIcon />
                    {b}
                  </p>
                ))}
              </>
            ) : (
              reviewedSources(facts.pack).map((s) => (
                <div key={s.id}>
                  <p className="small">
                    Reviewed general leaflet facts do not establish suitability for a person.
                  </p>
                  {s.facts.map((f, i) => (
                    <p key={i}>{f}</p>
                  ))}
                  <a
                    href={s.officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link"
                  >
                    Official source · {s.revision}
                  </a>
                  <p className="small muted">{s.provenance}</p>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </section>
  );
}

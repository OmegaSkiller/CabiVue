import { t } from '../i18n';
import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { IconCamera, IconReceipt, IconUpload, IconX, IconArrowRight } from '@tabler/icons-react';
import { api, send } from '../api';
import type { Draft, ImportDecision, Candidate } from '../../contracts/imports';
import type {
  Product,
  Location,
  PackFields,
  ProductInput,
  Purchase,
} from '../../contracts/inventory';
import { initialFields, initialProduct, PackFieldsForm, ProductFields } from './PackEditor';
import { ErrorMessage, Field, WarningIcon } from './common';
type Line = {
  selected: boolean;
  confirmedMedicine: boolean;
  candidateIndex: number;
  fields: PackFields;
  product: ProductInput;
  productId: string;
  packCount: string;
  purchase: Purchase | null;
};
const bytesToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(new Error('This photo could not be read.'));
    r.readAsDataURL(file);
  });
export function ScanScreen({
  products,
  locations,
  demo,
  onSaved,
  onManual,
  onDirty,
}: {
  products: Product[];
  locations: Location[];
  demo: boolean;
  onSaved: () => void;
  onManual: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [mode, setMode] = useState<'medicine' | 'receipt'>('medicine');
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [consent, setConsent] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [duplicate, setDuplicate] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const currentId = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const urls = useRef<string[]>([]);
  useEffect(() => {
    onDirty(photos.length > 0 || !!draft || busy);
  }, [photos.length, draft, busy, onDirty]);
  useEffect(
    () => () => {
      for (const url of urls.current) URL.revokeObjectURL(url);
      controller.current?.abort();
      if (currentId.current)
        void api(`/imports/${currentId.current}`, send('DELETE', {})).catch(() => {});
    },
    [],
  );
  function addPhotos(e: ChangeEvent<HTMLInputElement>) {
    setError('');
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.some((f) => !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))) {
      setError(
        'Use JPEG, PNG, or WebP. HEIC and PDF are not supported; export a photo as JPEG or use manual entry.',
      );
      return;
    }
    if (photos.length + files.length > 3) {
      setError('Use up to three photos. Remove a photo to replace it.');
      return;
    }
    if (
      files.some((f) => f.size > 6 * 1024 * 1024) ||
      [...photos.map((p) => p.file), ...files].reduce((n, f) => n + f.size, 0) > 12 * 1024 * 1024
    ) {
      setError('Use photos up to 6 MB each and 12 MB together.');
      return;
    }
    const next = files.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { file, url };
    });
    setPhotos([...photos, ...next]);
    setConsent(false);
  }
  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].url);
    urls.current = urls.current.filter((u) => u !== photos[index].url);
    setPhotos(photos.filter((_, i) => i !== index));
    setConsent(false);
  }
  function seedLine(c: Candidate, index: number, extraction: Draft['extraction']): Line {
    return {
      selected: mode === 'medicine',
      confirmedMedicine: mode === 'medicine',
      candidateIndex: index,
      fields: {
        ...initialFields,
        quantity: mode === 'medicine' ? 1 : 0,
        expiryValue: c.expiryValue.value,
        expiryPrecision: c.expiryPrecision,
        expiryText: c.expiryText.value,
        batch: c.batch.value,
      },
      product: {
        ...initialProduct,
        name: c.name.value || c.name.raw || '',
        form: c.form.value,
        ingredientText:
          [c.ingredientText.value, c.strengthText.value].filter(Boolean).join(' · ') || null,
      },
      productId: '',
      packCount: mode === 'medicine' ? '1' : '',
      purchase:
        mode === 'receipt'
          ? {
              date: extraction.purchaseDate.value,
              pharmacy: extraction.pharmacy.value,
              purchasedPacks: null,
              unitPrice: c.unitPrice.value,
              lineTotal: c.lineTotal.value,
              currency: extraction.currency.value,
            }
          : null,
    };
  }
  async function extract() {
    setBusy(true);
    setError('');
    setStage('Preparing photos…');
    controller.current = new AbortController();
    try {
      const { id } = await api<{ id: string }>('/imports', send('POST', { mode }));
      currentId.current = id;
      const images = await Promise.all(photos.map((p) => bytesToBase64(p.file)));
      setStage(demo ? 'Preparing simulated review…' : 'OpenAI is reading the selected photos…');
      const result = await api<Draft>(`/imports/${id}/extract`, {
        ...send('POST', { consent: true, images }),
        signal: controller.current.signal,
      });
      setDraft(result);
      setLines(result.extraction.candidates.map((c, i) => seedLine(c, i, result.extraction)));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      if (currentId.current)
        void api(`/imports/${currentId.current}`, send('DELETE', {})).catch(() => {});
      currentId.current = null;
    } finally {
      setBusy(false);
      setStage('');
    }
  }
  async function cancel() {
    controller.current?.abort();
    if (currentId.current)
      await api(`/imports/${currentId.current}`, send('DELETE', {})).catch((e) =>
        setError(e.message),
      );
    currentId.current = null;
    setDraft(null);
    setLines([]);
    setBusy(false);
    setStage('');
  }
  function updateLine(index: number, value: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === index ? { ...l, ...value } : l)));
  }
  async function save() {
    if (!draft) return;
    setError('');
    setBusy(true);
    try {
      const selected = lines.filter((l) => l.selected);
      if (!selected.length) throw new Error('Select at least one medicine line.');
      if (selected.some((l) => !l.confirmedMedicine))
        throw new Error('Confirm that every selected receipt line is a medicine.');
      if (
        selected.some(
          (l) => !l.packCount || !Number.isInteger(Number(l.packCount)) || Number(l.packCount) < 1,
        )
      )
        throw new Error('Enter the purchased pack count for each selected line.');
      if (mode === 'receipt' && selected.some((l) => l.fields.quantity <= 0))
        throw new Error(
          'Enter the remaining quantity per pack and its unit. Receipt quantities are not remaining doses.',
        );
      const decisions: ImportDecision[] = selected.map((l) => ({
        candidateIndex: l.candidateIndex,
        pack: {
          ...l.fields,
          expiryPrecision: l.fields.expiryValue ? l.fields.expiryPrecision : 'unknown',
          productId: l.productId || null,
          product: l.productId ? null : l.product,
        },
        packCount: Number(l.packCount),
        purchase: l.purchase ? { ...l.purchase, purchasedPacks: Number(l.packCount) } : null,
        confirmedMedicine: true,
      }));
      await api(
        `/imports/${draft.id}/confirm`,
        send('POST', { decisions, duplicateAcknowledged: duplicate }),
      );
      currentId.current = null;
      setDraft(null);
      setPhotos([]);
      for (const url of urls.current) URL.revokeObjectURL(url);
      urls.current = [];
      onDirty(false);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="scan-screen">
      <div className="scan-heading">
        <h2>{draft ? t('Review your scan') : t('A photo. A little less typing.')}</h2>
        <p className="muted">
          {draft
            ? t(
                'Check every selected value against the photos. Nothing is in your cabinet until you save.',
              )
            : t(
                'Photograph the front label and the expiry area, or select medicine lines from a pharmacy receipt.',
              )}
        </p>
      </div>
      <ErrorMessage error={error} />
      {!draft && (
        <>
          <div className="scan-modes" role="group" aria-label={t('Scan mode')}>
            <button
              className={`btn ${mode === 'medicine' ? 'btn-primary' : 'btn-outline'}`}
              disabled={busy || photos.length > 0}
              aria-pressed={mode === 'medicine'}
              onClick={() => setMode('medicine')}
            >
              <IconCamera size={21} />
              {t('Medicine photo')}
            </button>
            <button
              className={`btn ${mode === 'receipt' ? 'btn-primary' : 'btn-outline'}`}
              disabled={busy || photos.length > 0}
              aria-pressed={mode === 'receipt'}
              onClick={() => setMode('receipt')}
            >
              <IconReceipt size={21} />
              {t('Receipt scan')}
            </button>
          </div>
          <div className="upload-zone">
            <IconCamera size={40} />
            <h3>
              {mode === 'medicine'
                ? t('Capture the label and expiry')
                : t('Capture the receipt, in order')}
            </h3>
            <p className="muted">
              {t('Use clear light. Keep text in focus and avoid glare.')}
              <br />
              {t('JPEG, PNG, WebP · up to 3 photos · 6 MB each / 12 MB total')}
            </p>
            <div className="upload-actions">
              <label className="btn btn-primary">
                <IconCamera size={20} />
                {t('Take photo')}
                <input
                  aria-label={t('Take photo')}
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={addPhotos}
                  disabled={busy}
                />
              </label>
              <label className="btn btn-outline">
                <IconUpload size={20} />
                {t('Upload photos')}
                <input
                  aria-label={t('Upload photos')}
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={addPhotos}
                  disabled={busy}
                />
              </label>
            </div>
          </div>
        </>
      )}
      {photos.length > 0 && (
        <div className="photo-strip">
          {photos.map((p, i) => (
            <figure key={p.url}>
              <img
                src={p.url}
                alt={t(
                  mode === 'medicine'
                    ? 'Selected medicine photo {{index}}'
                    : 'Selected receipt photo {{index}}',
                  { index: i + 1 },
                )}
              />
              <figcaption>
                {t('Photo')}
                {i + 1}
                {!draft && (
                  <button
                    className="btn btn-ghost btn-square"
                    disabled={busy}
                    aria-label={t('Remove photo {{index}}', { index: i + 1 })}
                    onClick={() => removePhoto(i)}
                  >
                    <IconX size={18} />
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      {!draft && photos.length > 0 && (
        <section className="card consent-card">
          <h3>{demo ? t('Simulated processing') : t('Review what leaves your instance')}</h3>
          <p>
            {demo
              ? t(
                  'Demo output is simulated and does not read your photos. No provider request will be made.',
                )
              : t(
                  'Only the selected photos are sent to OpenAI after server validation and metadata removal. Visible label and receipt text leave your instance. Crop payment details and unrelated information before uploading. OpenAI’s data policies and charges apply.',
                )}
          </p>
          <label className="check-label">
            <input
              className="checkbox"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={busy}
            />
            {demo
              ? t('I understand this scan uses simulated results.')
              : t('I agree to send these selected photos to OpenAI for this scan.')}
          </label>
          <div className="scan-controls">
            <button
              className="btn btn-primary"
              disabled={!consent || busy}
              onClick={() => void extract()}
            >
              {busy ? t('Processing…') : t('Extract a review draft')}
              <IconArrowRight size={19} />
            </button>
            {busy && (
              <button className="btn btn-outline" onClick={() => void cancel()}>
                {t('Cancel processing')}
              </button>
            )}
          </div>
          {stage && (
            <p role="status" className="processing-status">
              <span className="loading loading-spinner loading-sm" />
              {t(stage)}
            </p>
          )}
        </section>
      )}
      {draft && (
        <>
          <div className="alert alert-info">
            {draft.simulated ? t('SIMULATED extraction. Not OCR accuracy evidence. ') : ''}
            {t('Review expires after 30 minutes. Unknown dates may be deliberately saved.')}
          </div>
          {draft.duplicate && (
            <div className="alert missing-alert">
              <WarningIcon />
              <div>
                <strong>{t('Possible duplicate receipt')}</strong>
                <p>
                  {t(
                    'This receipt resembles a previous import. Genuine repeat purchases can still be saved.',
                  )}
                </p>
                <label className="check-label">
                  <input
                    className="checkbox"
                    type="checkbox"
                    checked={duplicate}
                    onChange={(e) => setDuplicate(e.target.checked)}
                  />
                  {t('This is a separate purchase; save it again.')}
                </label>
              </div>
            </div>
          )}
          {draft.extraction.warnings.map((w, i) => (
            <p className="warning-copy" key={i}>
              <WarningIcon />
              {w}
            </p>
          ))}
          <div className="scan-review-lines">
            {lines.map((line, i) => {
              const c = draft.extraction.candidates[i];
              return (
                <section key={i} className="card section-card review-line">
                  <label className="check-label line-select">
                    <input
                      className="checkbox"
                      type="checkbox"
                      checked={line.selected}
                      onChange={(e) => updateLine(i, { selected: e.target.checked })}
                    />
                    <strong>
                      {c.name.value || c.name.raw || t('Unclear line {{index}}', { index: i + 1 })}
                    </strong>
                    <span className="badge badge-outline">{t(`kind.${c.kind}`)}</span>
                  </label>
                  <details className="evidence-details">
                    <summary>{t('Visible evidence & missing fields')}</summary>
                    {Object.entries(c)
                      .filter(([_, v]) => v && typeof v === 'object' && 'status' in v)
                      .map(([name, v]) => {
                        const f = v as Candidate['name'];
                        return (
                          <p key={name} className="small">
                            <strong>{t(`field.${name}`)}:</strong> {t(`evidence.${f.status}`)} ·{' '}
                            {f.evidence || f.raw || t('Not visible')}
                            {f.imageIndex !== null
                              ? ` · ${t('Photo {{index}}', { index: f.imageIndex + 1 })}`
                              : ''}
                          </p>
                        );
                      })}
                  </details>
                  {c.warnings.map((w, n) => (
                    <p className="warning-copy" key={n}>
                      <WarningIcon />
                      {w}
                    </p>
                  ))}
                  {line.selected && (
                    <>
                      {mode === 'receipt' && (
                        <>
                          <label className="check-label">
                            <input
                              className="checkbox"
                              type="checkbox"
                              checked={line.confirmedMedicine}
                              onChange={(e) =>
                                updateLine(i, { confirmedMedicine: e.target.checked })
                              }
                            />
                            {t('I confirm this selected line is a medicine')}
                          </label>
                          <Field
                            label={t('Purchased pack count')}
                            hint={t(
                              'Visible receipt quantity: {{amount}}. Confirm how many physical packs to add.',
                              { amount: c.purchasedPacks.value ?? t('Unknown / not sure') },
                            )}
                          >
                            <input
                              className="input"
                              type="number"
                              min={1}
                              max={100}
                              step={1}
                              value={line.packCount}
                              onChange={(e) => updateLine(i, { packCount: e.target.value })}
                              required
                            />
                          </Field>
                          <p className="small muted">
                            {t(
                              'Enter the remaining quantity and unit for each pack below. These are separate from the purchased pack count.',
                            )}
                          </p>
                          {line.purchase && (
                            <div className="purchase-fields">
                              <Field label={t('Purchase date')}>
                                <input
                                  className="input"
                                  type="date"
                                  value={line.purchase.date || ''}
                                  onChange={(e) =>
                                    updateLine(i, {
                                      purchase: { ...line.purchase!, date: e.target.value || null },
                                    })
                                  }
                                />
                              </Field>
                              <Field label={t('Pharmacy')}>
                                <input
                                  className="input"
                                  maxLength={300}
                                  value={line.purchase.pharmacy || ''}
                                  onChange={(e) =>
                                    updateLine(i, {
                                      purchase: {
                                        ...line.purchase!,
                                        pharmacy: e.target.value || null,
                                      },
                                    })
                                  }
                                />
                              </Field>
                              <div className="form-grid">
                                {(['unitPrice', 'lineTotal'] as const).map((k) => (
                                  <Field
                                    key={k}
                                    label={
                                      k === 'unitPrice'
                                        ? t('Price per purchased pack')
                                        : t('Receipt line total')
                                    }
                                  >
                                    <input
                                      className="input"
                                      type="number"
                                      min={0}
                                      step="0.01"
                                      value={line.purchase![k] ?? ''}
                                      onChange={(e) =>
                                        updateLine(i, {
                                          purchase: {
                                            ...line.purchase!,
                                            [k]: e.target.value ? Number(e.target.value) : null,
                                          },
                                        })
                                      }
                                    />
                                  </Field>
                                ))}
                              </div>
                              <Field label={t('Currency')}>
                                <input
                                  className="input"
                                  maxLength={3}
                                  value={line.purchase.currency || ''}
                                  onChange={(e) =>
                                    updateLine(i, {
                                      purchase: {
                                        ...line.purchase!,
                                        currency: e.target.value.toUpperCase() || null,
                                      },
                                    })
                                  }
                                />
                              </Field>
                            </div>
                          )}
                        </>
                      )}
                      <Field label={t('Match an existing product or create an unverified one')}>
                        <select
                          className="select"
                          value={line.productId}
                          onChange={(e) => updateLine(i, { productId: e.target.value })}
                        >
                          <option value="">{t('Create a product from reviewed text')}</option>
                          {products.map((p) => (
                            <option value={p.id} key={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      {!line.productId && (
                        <ProductFields
                          product={line.product}
                          onChange={(p) => updateLine(i, { product: p })}
                        />
                      )}
                      <PackFieldsForm
                        value={line.fields}
                        onChange={(v) => updateLine(i, { fields: v })}
                        locations={locations}
                      />
                    </>
                  )}
                </section>
              );
            })}
          </div>
          <div className="scan-controls">
            <button className="btn btn-outline" disabled={busy} onClick={() => void cancel()}>
              {t('Cancel review')}
            </button>
            <button
              className="btn btn-primary"
              disabled={busy || !lines.some((l) => l.selected) || (draft.duplicate && !duplicate)}
              onClick={() => void save()}
            >
              {busy ? t('Saving…') : t('Save selected packs')}
            </button>
          </div>
        </>
      )}
      <button
        className="btn btn-ghost manual-entry"
        onClick={() => {
          if (!draft || window.confirm(t('Cancel this review and enter a medicine manually?'))) {
            void cancel();
            onManual();
          }
        }}
      >
        {t('Enter medicine manually')}
        <IconArrowRight size={18} />
      </button>
    </section>
  );
}

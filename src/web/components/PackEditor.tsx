import { useState, type FormEvent } from 'react';
import { api, send } from '../api';
import type { Pack, PackFields, Location, Product } from '../../contracts/inventory';
import { ProductFields, initialProduct } from './ProductFields';
export { ProductFields, initialProduct } from './ProductFields';
import { ProductEditor } from './ProductEditor';
import { reviewedSources } from '../../domain/expiry';
import { Dialog, ErrorMessage, Field, WarningIcon } from './common';
export const initialFields: PackFields = {
  quantity: 1,
  unit: 'pack',
  locationId: null,
  expiryValue: null,
  expiryPrecision: 'unknown',
  expiryText: null,
  batch: null,
  openedDate: null,
  storageUncertain: false,
  notes: '',
};
export function PackFieldsForm({
  value,
  onChange,
  locations,
}: {
  value: PackFields;
  onChange: (value: PackFields) => void;
  locations: Location[];
}) {
  function change<K extends keyof PackFields>(key: K, v: PackFields[K]) {
    onChange({ ...value, [key]: v });
  }
  return (
    <>
      <div className="form-grid">
        <Field label="Quantity remaining">
          <input
            className="input mono"
            type="number"
            min={0}
            max={100000}
            step="any"
            value={value.quantity}
            onChange={(e) => change('quantity', Number(e.target.value))}
            required
          />
        </Field>
        <Field label="Quantity unit">
          <select
            className="select"
            value={value.unit}
            onChange={(e) => change('unit', e.target.value)}
          >
            {['pack', 'tablet', 'capsule', 'ml', 'g', 'dose', 'sachet'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Storage location">
        <select
          className="select"
          value={value.locationId || ''}
          onChange={(e) => change('locationId', e.target.value || null)}
        >
          <option value="">Not specified</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <div className="expiry-field">
        <Field
          label={
            <span className={!value.expiryValue ? 'warning-label' : ''}>
              {!value.expiryValue && <WarningIcon />}Expiry date
              {!value.expiryValue && <span className="small"> · unknown</span>}
            </span>
          }
          hint="Leave blank if the date is missing or unclear. A receipt date is not an expiry date."
        >
          <input
            aria-label="Expiry date"
            className="input mono"
            type={value.expiryPrecision === 'month' ? 'month' : 'date'}
            value={value.expiryValue || ''}
            onChange={(e) =>
              onChange({
                ...value,
                expiryValue: e.target.value || null,
                expiryPrecision: e.target.value
                  ? value.expiryPrecision === 'month'
                    ? 'month'
                    : 'day'
                  : 'unknown',
              })
            }
          />
        </Field>
        <label className="check-label">
          <input
            className="checkbox checkbox-sm"
            type="checkbox"
            checked={value.expiryPrecision === 'month'}
            onChange={(e) =>
              onChange({
                ...value,
                expiryPrecision: e.target.checked ? 'month' : value.expiryValue ? 'day' : 'unknown',
                expiryValue: null,
              })
            }
          />
          The label shows only month and year
        </label>
        {!value.expiryValue && (
          <p className="warning-copy">
            <WarningIcon />
            Add an expiry date to receive expiry reminders. Usability is unknown.
          </p>
        )}
      </div>
      <div className="form-grid">
        <Field label="Printed expiry text">
          <input
            className="input"
            maxLength={300}
            value={value.expiryText || ''}
            onChange={(e) => change('expiryText', e.target.value || null)}
            placeholder="e.g. EXP 10/2027"
          />
        </Field>
        <Field label="Batch / lot">
          <input
            className="input mono"
            maxLength={300}
            value={value.batch || ''}
            onChange={(e) => change('batch', e.target.value || null)}
          />
        </Field>
      </div>
      <Field label="Opened on">
        <input
          className="input mono"
          type="date"
          value={value.openedDate || ''}
          onChange={(e) => change('openedDate', e.target.value || null)}
        />
      </Field>
      <label className="check-label">
        <input
          className="checkbox checkbox-sm"
          type="checkbox"
          checked={value.storageUncertain}
          onChange={(e) => change('storageUncertain', e.target.checked)}
        />
        Storage conditions are uncertain
      </label>
      <Field label="Notes">
        <textarea
          className="textarea"
          maxLength={2000}
          value={value.notes}
          onChange={(e) => change('notes', e.target.value)}
          rows={3}
        />
      </Field>
    </>
  );
}
export function PackEditor({
  pack,
  products,
  locations,
  onSaved,
  onClose,
  onProductSaved,
}: {
  pack: Pack | null;
  onProductSaved: () => void;
  products: Product[];
  locations: Location[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const seed: PackFields = pack
    ? {
        quantity: pack.quantity,
        unit: pack.unit,
        locationId: pack.locationId,
        expiryValue: pack.expiryValue,
        expiryPrecision: pack.expiryPrecision,
        expiryText: pack.expiryText,
        batch: pack.batch,
        openedDate: pack.openedDate,
        storageUncertain: pack.storageUncertain,
        notes: pack.notes,
      }
    : initialFields;
  const [identity, setIdentity] = useState(pack?.product);
  const [editIdentity, setEditIdentity] = useState(false);
  const [fields, setFields] = useState(seed);
  const [product, setProduct] = useState(initialProduct);
  const [productId, setProductId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const dirty =
    JSON.stringify(fields) !== JSON.stringify(seed) || product.name !== '' || productId !== '';
  const close = () => {
    if (!busy && (!dirty || window.confirm('Discard your unsaved changes?'))) onClose();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const normalized = {
        ...fields,
        expiryPrecision: fields.expiryValue ? fields.expiryPrecision : 'unknown',
      };
      await api(
        pack ? `/packs/${pack.id}` : '/packs',
        send(
          pack ? 'PUT' : 'POST',
          pack
            ? { ...normalized, version: pack.version }
            : { ...normalized, productId: productId || null, product: productId ? null : product },
        ),
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title={identity ? identity.name : 'Add medicine'} onClose={close}>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <ErrorMessage error={error} />
          {pack ? (
            <div className="pack-identity">
              <p>
                {[identity?.form, identity?.ingredientText].filter(Boolean).join(' · ') ||
                  'Formulation not recorded'}
              </p>
              <span className="badge badge-outline">
                {identity?.identityConfirmed ? 'Identity checked by you' : 'Identity unconfirmed'}
              </span>
              <p className="small muted">
                {reviewedSources({ ...pack, product: identity || pack.product }).length > 0
                  ? 'Reviewed source information available.'
                  : 'No reviewed leaflet information.'}
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setEditIdentity(true)}
              >
                Edit shared product
              </button>
              {pack.purchase && (
                <p className="small">
                  Purchased {pack.purchase.date || 'date unknown'} ·{' '}
                  {pack.purchase.pharmacy || 'pharmacy unknown'}
                  {pack.purchase.lineTotal != null
                    ? ` · ${pack.purchase.lineTotal} ${pack.purchase.currency || ''}`
                    : ''}
                </p>
              )}
            </div>
          ) : (
            <>
              <Field label="Product">
                <select
                  className="select"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  <option value="">Enter a new product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              {!productId && <ProductFields product={product} onChange={setProduct} />}
            </>
          )}
          <PackFieldsForm value={fields} onChange={setFields} locations={locations} />
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={close}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : pack ? 'Save changes' : 'Add to cabinet'}
            </button>
          </div>
        </fieldset>
      </form>
      {editIdentity && identity && (
        <ProductEditor
          product={identity}
          onClose={() => setEditIdentity(false)}
          onSaved={(updated) => {
            setIdentity(updated);
            setEditIdentity(false);
            onProductSaved();
          }}
        />
      )}
    </Dialog>
  );
}

import { useState, type FormEvent } from 'react';
import { api, send } from '../api';
import type { Pack, PackFields, Location, Product, ProductInput } from '../../contracts/inventory';
import { Dialog, ErrorMessage, Field, WarningIcon } from './common';
export const initialProduct: ProductInput = {
  name: '',
  country: 'BG',
  form: null,
  route: null,
  ingredientText: null,
  identityConfirmed: false,
  ingredients: [],
};
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
export function ProductFields({
  product,
  onChange,
}: {
  product: ProductInput;
  onChange: (p: ProductInput) => void;
}) {
  return (
    <>
      <Field label="Medicine name">
        <input
          className="input"
          required
          maxLength={300}
          value={product.name}
          onChange={(e) => onChange({ ...product, name: e.target.value })}
          placeholder="As printed on the package"
        />
      </Field>
      <div className="form-grid">
        <Field label="Country">
          <input
            className="input"
            required
            maxLength={300}
            value={product.country}
            onChange={(e) => onChange({ ...product, country: e.target.value })}
          />
        </Field>
        <Field label="Form">
          <input
            className="input"
            maxLength={300}
            value={product.form || ''}
            onChange={(e) => onChange({ ...product, form: e.target.value || null })}
            placeholder="e.g. tablets"
          />
        </Field>
      </div>
      <Field label="Route">
        <input
          className="input"
          maxLength={300}
          value={product.route || ''}
          onChange={(e) => onChange({ ...product, route: e.target.value || null })}
          placeholder="Leave blank if unknown"
        />
      </Field>
      <Field label="Ingredient / strength text">
        <input
          className="input"
          maxLength={300}
          value={product.ingredientText || ''}
          onChange={(e) => onChange({ ...product, ingredientText: e.target.value || null })}
          placeholder="Copy visible text; don’t infer it"
        />
      </Field>
      <details className="ingredient-details">
        <summary>Record individual ingredients</summary>
        {product.ingredients.map((i, index) => (
          <div className="ingredient-row" key={index}>
            {(['name', 'strength', 'unit', 'basis'] as const).map((k) => (
              <Field key={k} label={`${k[0].toUpperCase() + k.slice(1)} ${index + 1}`}>
                <input
                  className="input"
                  required={k === 'name'}
                  maxLength={300}
                  value={i[k] || ''}
                  onChange={(e) =>
                    onChange({
                      ...product,
                      ingredients: product.ingredients.map((item, n) =>
                        n === index
                          ? { ...item, [k]: e.target.value || (k === 'name' ? '' : null) }
                          : item,
                      ),
                    })
                  }
                />
              </Field>
            ))}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                onChange({
                  ...product,
                  ingredients: product.ingredients.filter((_, n) => n !== index),
                })
              }
            >
              Remove ingredient {index + 1}
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline"
          disabled={product.ingredients.length >= 12}
          onClick={() =>
            onChange({
              ...product,
              ingredients: [
                ...product.ingredients,
                { name: '', strength: null, unit: null, basis: null },
              ],
            })
          }
        >
          Add ingredient
        </button>
      </details>
      <label className="check-label">
        <input
          className="checkbox checkbox-sm"
          type="checkbox"
          checked={product.identityConfirmed}
          onChange={(e) => onChange({ ...product, identityConfirmed: e.target.checked })}
        />
        I checked this identity against the package
      </label>
      <p className="small muted">Checking the label does not verify medical information.</p>
    </>
  );
}
export function PackEditor({
  pack,
  products,
  locations,
  onSaved,
  onClose,
}: {
  pack: Pack | null;
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
      await api(
        pack ? `/packs/${pack.id}` : '/packs',
        send(
          pack ? 'PUT' : 'POST',
          pack
            ? { ...fields, version: pack.version }
            : { ...fields, productId: productId || null, product: productId ? null : product },
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
    <Dialog title={pack ? pack.product.name : 'Add medicine'} onClose={close}>
      <form onSubmit={submit}>
        <ErrorMessage error={error} />
        {pack ? (
          <div className="pack-identity">
            <p>
              {[pack.product.form, pack.product.ingredientText].filter(Boolean).join(' · ') ||
                'Formulation not recorded'}
            </p>
            <span className="badge badge-outline">
              {pack.product.identityConfirmed ? 'Identity checked by you' : 'Identity unconfirmed'}
            </span>
            <p className="small muted">
              {pack.sourceFacts.some((s) => s.reviewStatus === 'reviewed')
                ? 'Reviewed source information available.'
                : 'No reviewed leaflet information.'}
            </p>
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
      </form>
    </Dialog>
  );
}

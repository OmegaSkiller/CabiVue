import { useState, type FormEvent } from 'react';
import type { Product, ProductInput } from '../../contracts/inventory';
import { api, send } from '../api';
import { ProductFields } from './ProductFields';
import { Dialog, ErrorMessage } from './common';
export function ProductEditor({
  product,
  onSaved,
  onClose,
}: {
  product: Product;
  onSaved: (product: Product) => void;
  onClose: () => void;
}) {
  const { id, version, prescriptionStatus, ...seed } = product;
  const [value, setValue] = useState<ProductInput>(seed);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = () => {
    if (
      !busy &&
      (JSON.stringify(value) === JSON.stringify(seed) || window.confirm('Discard product changes?'))
    )
      onClose();
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onSaved(await api<Product>(`/products/${id}`, send('PUT', { ...value, version })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog title="Edit shared product" onClose={close}>
      <p className="warning-copy">
        These details change every pack linked to this product. Existing leaflet reviews and
        prescription status need a new review afterward.
      </p>
      <ErrorMessage error={error} />
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <ProductFields product={value} onChange={setValue} />
          <div className="dialog-actions">
            <button className="btn btn-ghost" type="button" onClick={close}>
              Cancel
            </button>
            <button className="btn btn-primary">{busy ? 'Saving…' : 'Save shared product'}</button>
          </div>
        </fieldset>
      </form>
    </Dialog>
  );
}

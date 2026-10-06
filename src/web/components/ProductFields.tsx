import type { ProductInput } from '../../contracts/inventory';
import { Field } from './common';
export const initialProduct: ProductInput = {
  name: '',
  country: 'BG',
  form: null,
  route: null,
  ingredientText: null,
  identityConfirmed: false,
  ingredients: [],
};
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

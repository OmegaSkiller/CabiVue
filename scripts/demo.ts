import { Store } from '../src/server/db.js';
import { hashPassword } from '../src/server/auth.js';
import { todayIn, plusDays } from '../src/domain/expiry.js';
import { randomUUID } from 'node:crypto';
const store = new Store(process.env.DATA_DIR || './data/demo-instance');
if (!store.db.prepare('SELECT 1 FROM account').get()) {
  store.db
    .prepare('INSERT INTO account VALUES(1,?,?,?)')
    .run('demo', await hashPassword('cabivue-demo-only'), new Date().toISOString());
  const location = randomUUID();
  store.db.prepare('INSERT INTO locations VALUES(?,?)').run(location, 'Hallway cupboard');
  const today = todayIn('Europe/Sofia');
  for (const [name, expiry, precision, quantity, unit, form] of [
    ['Sample tablets · synthetic', null, 'unknown', 12, 'tablet', 'Tablets'],
    ['Sample drops · synthetic', plusDays(today, 20), 'day', 1, 'pack', 'Drops'],
    ['Sample cream · synthetic', plusDays(today, -10), 'day', 1, 'pack', 'Cream'],
    [
      'Синтетичен пример с дълго име за проверка на кирилица',
      plusDays(today, 200).slice(0, 7),
      'month',
      2,
      'pack',
      'Fictional sample',
    ],
  ] as const)
    store.createPack({
      quantity,
      unit,
      locationId: location,
      expiryValue: expiry,
      expiryPrecision: precision,
      expiryText: null,
      batch: 'DEMO',
      openedDate: null,
      storageUncertain: false,
      notes: 'Synthetic demonstration. Not real medicine information.',
      productId: null,
      product: {
        name,
        country: 'BG',
        form,
        route: null,
        ingredientText: 'Fictional sample — not a medicine',
        identityConfirmed: false,
        ingredients: [],
      },
    });
}
store.close();
console.log(
  'Synthetic demo ready. Username: demo / Password: cabivue-demo-only. Never use these credentials for real records.',
);

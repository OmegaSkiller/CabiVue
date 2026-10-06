import { asset, publicDemo } from './environment';
import { useTranslation } from 'react-i18next';
import { LanguagePicker } from './components/LanguagePicker';
import { t, number, date, quantity } from './i18n';
import { useEffect, useState, useCallback } from 'react';
import {
  IconPlus,
  IconLayoutGrid,
  IconCalendarClock,
  IconSettings,
  IconSun,
  IconMoon,
  IconLogout,
  IconArchive,
  IconTrash,
  IconMinus,
  IconSearch,
  IconArrowRight,
  IconBox,
  IconCamera,
  IconNotes,
} from '@tabler/icons-react';
import { api, send, setCsrf, ApiError } from './api';
import type { Pack, Product, Location, Settings, PackFields } from '../contracts/inventory';
import { PwaControls } from './components/PwaControls';
import { expiryState, todayIn } from '../domain/expiry';
import { AuthScreen } from './components/AuthScreen';
import { PackEditor } from './components/PackEditor';
import { UrgentHelp } from './components/UrgentHelp';
import { AssistantScreen } from './components/AssistantScreen';
import { ScanScreen } from './components/ScanScreen';
import { ProviderSettings } from './components/ProviderSettings';
import { BackupSettings } from './components/BackupSettings';
import { SettingsScreen } from './components/SettingsScreen';
import { ErrorMessage, WarningIcon, Dialog } from './components/common';
export type Inventory = {
  packs: Pack[];
  products: Product[];
  locations: Location[];
  settings: Settings;
  today: string;
};
const statusLabels = {
  unknown: 'Expiry unknown',
  expired: 'Expired',
  soon: 'Expiring soon',
  recorded: 'Expiry recorded',
  'month-current': 'Expiry month is here',
};
export default function App() {
  useTranslation();
  const [auth, setAuth] = useState<{
    configured: boolean;
    authenticated: boolean;
    demo: boolean;
  } | null>(null);
  const [data, setData] = useState<Inventory | null>(null);
  const [error, setError] = useState('');
  const [notice, storeNotice] = useState<{
    message: string;
    values?: Record<string, string | number>;
  } | null>(null);
  const setNotice = (message: string, values?: Record<string, string | number>) =>
    storeNotice({ message, values });
  const [tab, setTab] = useState('cabinet');
  const [scanDirty, setScanDirty] = useState(false);
  const [backupDirty, setBackupDirty] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [providerDirty, setProviderDirty] = useState(false);
  const [assistantDirty, setAssistantDirty] = useState(false);
  const [urgentOpen, setUrgentOpen] = useState(false);

  function navigate(next: string, nextFilter = 'all') {
    if (next === tab) {
      setFilter(nextFilter);
      return true;
    }
    if (dirty && !window.confirm(t('Discard your unsaved edits or active review?'))) return false;
    setScanDirty(false);
    setBackupDirty(false);
    setSettingsDirty(false);
    setProviderDirty(false);
    setAssistantDirty(false);
    setTab(next);
    setFilter(nextFilter);
    return true;
  }
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [location, setLocation] = useState('');
  const [editing, setEditing] = useState<Pack | null | undefined>();
  const dirty =
    editing !== undefined ||
    scanDirty ||
    settingsDirty ||
    providerDirty ||
    assistantDirty ||
    backupDirty;
  const [online, setOnline] = useState(navigator.onLine);
  const [dark, setDark] = useState(() => localStorage.getItem('cabivue-theme') === 'cabivue-dark');
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'cabivue-dark' : 'cabivue';
    localStorage.setItem('cabivue-theme', dark ? 'cabivue-dark' : 'cabivue');
  }, [dark]);
  useEffect(() => {
    const on = () => setOnline(true),
      off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  const refresh = useCallback(async () => {
    try {
      const result = await api<Inventory>('/inventory');
      setData(result);
      setError('');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setData(null);
        setAuth((a) => (a ? { ...a, authenticated: false } : a));
      }
      setError((e as Error).message);
    }
  }, []);
  const loadAuth = useCallback(async () => {
    try {
      const r = await api<{
        configured: boolean;
        authenticated: boolean;
        demo: boolean;
        csrf: string | null;
      }>('/auth/status');
      setCsrf(r.csrf);
      setAuth(r);
      if (r.authenticated) await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [refresh]);
  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);
  useEffect(() => {
    const timer = setInterval(
      () => setData((d) => (d ? { ...d, today: todayIn(d.settings.timezone) } : d)),
      60000,
    );
    const focus = () => {
      if (auth?.authenticated && navigator.onLine) void refresh();
    };
    window.addEventListener('focus', focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [auth?.authenticated, refresh]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', prevent);
    return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);
  async function logout() {
    if (dirty && !window.confirm(t('Discard your active edits and sign out?'))) return;
    try {
      await api('/auth/logout', send('POST', {}));
      setCsrf(null);
      setData(null);
      setEditing(undefined);
      setBackupDirty(false);
      setAssistantDirty(false);
      setScanDirty(false);
      setSettingsDirty(false);
      setProviderDirty(false);
      setAuth((a) => (a ? { ...a, authenticated: false } : a));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function mutate(pack: Pack, kind: 'quantity' | 'archive' | 'delete', quantity?: number) {
    setError('');
    try {
      if (kind === 'quantity') {
        const {
          quantity: _,
          unit,
          locationId,
          expiryValue,
          expiryPrecision,
          expiryText,
          batch,
          openedDate,
          storageUncertain,
          notes,
        } = pack;
        const fields: PackFields = {
          quantity: quantity!,
          unit,
          locationId,
          expiryValue,
          expiryPrecision,
          expiryText,
          batch,
          openedDate,
          storageUncertain,
          notes,
        };
        await api(`/packs/${pack.id}`, send('PUT', { ...fields, version: pack.version }));
      } else if (kind === 'archive') {
        if (
          !window.confirm(
            t(
              pack.archived
                ? 'Return this pack to your cabinet?'
                : 'Archive this pack? You can find it in Archived.',
            ),
          )
        )
          return;
        await api(
          `/packs/${pack.id}/archive`,
          send('POST', { version: pack.version, archived: !pack.archived }),
        );
      } else {
        if (
          !window.confirm(
            t('Permanently delete {{name}}? This cannot be undone.', { name: pack.product.name }),
          )
        )
          return;
        await api(
          `/packs/${pack.id}`,
          send('DELETE', { version: pack.version, confirm: 'DELETE' }),
        );
      }
      setNotice(
        kind === 'quantity'
          ? 'Quantity updated.'
          : kind === 'delete'
            ? 'Pack deleted.'
            : 'Pack archive updated.',
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const urgentOverlay = urgentOpen ? (
    <Dialog title={t('Urgent help')} onClose={() => setUrgentOpen(false)}>
      <UrgentHelp settings={data?.settings} dark={dark} onBack={() => setUrgentOpen(false)} />
    </Dialog>
  ) : null;
  if (!auth)
    return (
      <main className="loading-page">
        <img className="logo" src={asset('brand/cabivue-logo.svg')} alt="Cabivue" />
        <LanguagePicker />
        <p role="status">{t('Opening your cabinet…')}</p>
        <button className="btn btn-outline" onClick={() => setUrgentOpen(true)}>
          {t('Urgent help')}
        </button>
        {urgentOverlay}
        <ErrorMessage error={error} />
        {error && (
          <button className="btn btn-primary" onClick={() => void loadAuth()}>
            {t('Try again')}
          </button>
        )}
      </main>
    );
  if (!auth.authenticated)
    return (
      <>
        <ErrorMessage error={error} />
        {notice && (
          <p className="save-notice" role="status">
            {t(notice.message, notice.values)}
          </p>
        )}
        <AuthScreen
          configured={auth.configured}
          demo={auth.demo}
          onLogin={() => void loadAuth()}
          onUrgent={() => setUrgentOpen(true)}
          dark={dark}
        />
        {urgentOverlay}
      </>
    );
  if (!data)
    return (
      <main className="loading-page">
        <p role="status">{t('Loading your medicines…')}</p>
        <button className="btn btn-outline" onClick={() => setUrgentOpen(true)}>
          {t('Urgent help')}
        </button>
        {urgentOverlay}
        <ErrorMessage error={error} />
      </main>
    );
  const active = data.packs.filter((p) => !p.archived);
  const missing = active.filter((p) => !p.expiryValue);
  const expired = active.filter((p) => expiryState(p, data.today) === 'expired');
  const soon = active.filter((p) => ['soon', 'month-current'].includes(expiryState(p, data.today)));
  const list = data.packs
    .filter((p) => (filter === 'archived' ? p.archived : !p.archived))
    .filter(
      (p) =>
        !query ||
        `${p.product.name} ${p.product.ingredientText || ''} ${p.notes} ${p.batch || ''}`
          .toLocaleLowerCase()
          .includes(query.toLocaleLowerCase()),
    )
    .filter((p) => !location || p.locationId === location)
    .filter((p) =>
      filter === 'unknown'
        ? !p.expiryValue
        : filter === 'expired'
          ? expiryState(p, data.today) === 'expired'
          : filter === 'soon'
            ? ['soon', 'month-current'].includes(expiryState(p, data.today))
            : filter === 'exhausted'
              ? p.quantity === 0
              : filter === 'stock'
                ? p.quantity > 0
                : true,
    )
    .filter((p) => tab !== 'expiry' || expiryState(p, data.today) !== 'recorded')
    .sort((a, b) =>
      tab === 'expiry' ? (a.expiryValue || '9999').localeCompare(b.expiryValue || '9999') : 0,
    );
  function showMissing() {
    if (!navigate('cabinet', 'unknown')) return;
    setQuery('');
    setLocation('');
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t('Skip to content')}
      </a>
      <header className="topbar">
        <a href={import.meta.env.BASE_URL} className="brand-link">
          <img
            className="logo"
            src={asset(dark ? 'brand/cabivue-logo-reversed.svg' : 'brand/cabivue-logo.svg')}
            alt="Cabivue"
          />
        </a>
        <span className="tagline">{t('Know what you have.')}</span>
        <div className="header-actions">
          <LanguagePicker />
          <button className="btn btn-ghost urgent-header" onClick={() => setUrgentOpen(true)}>
            {t('Urgent help')}
          </button>
          <button
            className="btn btn-ghost btn-square"
            aria-label={dark ? t('Use light theme') : t('Use dark theme')}
            onClick={() => setDark(!dark)}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <button
            className="btn btn-ghost btn-square logout-button"
            aria-label={t('Sign out')}
            onClick={() => void logout()}
          >
            <IconLogout />
          </button>
        </div>
      </header>
      <div className="workspace">
        <nav className="navigation" aria-label={t('Main navigation')}>
          {[
            { id: 'cabinet', label: t('My cabinet'), icon: IconLayoutGrid },
            { id: 'expiry', label: t('Expiry overview'), icon: IconCalendarClock },
            { id: 'scan', label: t('Scan'), icon: IconCamera },
            { id: 'assistant', label: t('Assistant'), icon: IconNotes },
            { id: 'settings', label: t('Settings'), icon: IconSettings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`btn btn-ghost nav-item ${tab === id ? 'selected' : ''}`}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                navigate(id);
              }}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
          <div className="nav-note">
            <img src={asset('brand/cabivue-mark.svg')} alt="" width={30} />
            <p>
              {t('A little order.')} <br />
              {t('A clearer day.')}
            </p>
          </div>
        </nav>
        <main id="main" className="main-content">
          {publicDemo && (
            <div className="alert public-demo-alert" role="status">
              <div>
                <strong>{t('Public demo')}</strong>
                <p>{t('Changes stay in this tab and reset on reload. Use synthetic data only.')}</p>
              </div>
              <button
                className="btn btn-outline"
                onClick={() => {
                  if (window.confirm(t('Reset this demo and discard all changes?')))
                    window.location.reload();
                }}
              >
                {t('Reset demo')}
              </button>
            </div>
          )}
          {auth.demo && (
            <div className="alert alert-info demo-banner">
              {t('Synthetic demo. Simulated provider results; no real medicine information.')}
            </div>
          )}
          {!online && (
            <div className="alert alert-warning" role="alert">
              <WarningIcon />
              <span>
                {t(
                  'You’re offline. Reconnect to view current records and save changes. This cabinet is not cached.',
                )}
              </span>
            </div>
          )}
          <ErrorMessage error={error} />
          {notice && (
            <div className="save-notice" role="status">
              {t(notice.message, notice.values)}
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">{t('Your home medicine cabinet')}</p>
              <h1>
                {tab === 'assistant'
                  ? t('Your symptom history')
                  : tab === 'scan'
                    ? t('Scan & review')
                    : tab === 'settings'
                      ? t('Household settings')
                      : tab === 'expiry'
                        ? t('Dates that need attention')
                        : t('My cabinet')}
              </h1>
              <p className="muted">
                {tab === 'assistant'
                  ? t('Prepare a clearer conversation with a professional.')
                  : tab === 'scan'
                    ? t('Read the label. Keep the final say.')
                    : tab === 'settings'
                      ? t('A cabinet that fits your home.')
                      : tab === 'expiry'
                        ? t('A recorded date is a reminder, never a recommendation.')
                        : t('A clear place for every pack.')}
              </p>
            </div>
            {['cabinet', 'expiry'].includes(tab) && (
              <button
                className="btn btn-primary add-button"
                onClick={() => setEditing(null)}
                disabled={!online}
              >
                <IconPlus size={22} />
                {t('Add medicine')}
              </button>
            )}
          </div>
          {tab === 'assistant' ? (
            <AssistantScreen
              packs={data.packs}
              demo={auth.demo}
              onUrgent={() => setUrgentOpen(true)}
              onDirty={setAssistantDirty}
            />
          ) : tab === 'scan' ? (
            <ScanScreen
              products={data.products}
              locations={data.locations}
              demo={auth.demo}
              onDirty={setScanDirty}
              onManual={() => {
                setTab('cabinet');
                setScanDirty(false);
                setEditing(null);
              }}
              onSaved={() => {
                setScanDirty(false);
                setTab('cabinet');
                setNotice('Reviewed packs added to your cabinet.');
                void refresh();
              }}
            />
          ) : tab === 'settings' ? (
            <SettingsScreen
              key={data.settings.timezone}
              settings={data.settings}
              locations={data.locations}
              onSaved={() => void refresh()}
              onDirty={setSettingsDirty}
            >
              {!publicDemo && (
                <>
                  <BackupSettings
                    onDirty={setBackupDirty}
                    canRestore={
                      !settingsDirty &&
                      !providerDirty &&
                      !scanDirty &&
                      !assistantDirty &&
                      editing === undefined
                    }
                    onRestored={(recoveryPoint) => {
                      setCsrf(null);
                      setData(null);
                      setBackupDirty(false);
                      setSettingsDirty(false);
                      setProviderDirty(false);
                      setTab('cabinet');
                      setNotice(
                        'Cabinet restored. Sign in again. Your previous cabinet is saved as {{name}} in Settings → Backup & recovery.',
                        { name: recoveryPoint },
                      );
                      setAuth((a) => (a ? { ...a, authenticated: false } : a));
                    }}
                  />
                  <ProviderSettings onDirty={setProviderDirty} />
                </>
              )}
              {publicDemo && (
                <section className="card section-card">
                  <h2>{t('Demo limitations')}</h2>
                  <p>
                    {t(
                      'Server backups and provider keys are available in the self-hosted app. This demo only simulates scans and interviews.',
                    )}
                  </p>
                </section>
              )}
              <section className="card section-card">
                <h2>{t('Household account')}</h2>
                <p className="muted">
                  {t('Signing out clears the provider key and transient interview.')}
                </p>
                <button className="btn btn-outline" onClick={() => void logout()}>
                  {t('Sign out')}
                </button>
              </section>
            </SettingsScreen>
          ) : (
            <div className={tab === 'cabinet' ? 'cabinet-columns' : ''}>
              <div className="cabinet-main">
                <div className="cabinet-summary">
                  <button onClick={() => navigate('cabinet')}>
                    <span className="summary-number mono">{number(active.length)}</span>
                    <span>{t('Packs in cabinet')}</span>
                  </button>
                  <button onClick={() => navigate('expiry', 'soon')}>
                    <span className="summary-number mono">{number(soon.length)}</span>
                    <span>{t('Expiring soon')}</span>
                  </button>
                  <button onClick={() => navigate('expiry', 'expired')}>
                    <span className="summary-number mono">{number(expired.length)}</span>
                    <span>{t('Expired')}</span>
                  </button>
                </div>
                {missing.length > 0 && (
                  <div className="alert missing-alert" role="alert">
                    <WarningIcon />
                    <div>
                      <strong>
                        {t('missingExpiryTitle', {
                          count: missing.length,
                          amount: number(missing.length),
                        })}
                      </strong>
                      <p>
                        {t('missingExpiryBody', {
                          count: missing.length,
                          amount: number(missing.length),
                        })}
                      </p>
                      <button className="review-link" onClick={showMissing}>
                        {t('Review missing dates')}
                        <IconArrowRight size={18} />
                      </button>
                    </div>
                  </div>
                )}
                {expired.length > 0 && (
                  <p className="expiry-reminder">
                    <WarningIcon />
                    {t('expiredReminder', {
                      count: expired.length,
                      amount: number(expired.length),
                    })}
                  </p>
                )}
                <div className="inventory-toolbar">
                  <label className="search-field">
                    <IconSearch size={20} />
                    <span className="sr-only">{t('Search medicines')}</span>
                    <input
                      className="input"
                      placeholder={t('Search your cabinet')}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="sr-only">{t('Filter medicines')}</span>
                    <select
                      className="select"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option value="all">{t('All medicines')}</option>
                      <option value="stock">{t('In stock')}</option>
                      <option value="unknown">{t('Missing expiry date')}</option>
                      <option value="soon">{t('Expiring soon')}</option>
                      <option value="expired">{t('Expired')}</option>
                      <option value="exhausted">{t('Exhausted')}</option>
                      <option value="archived">{t('Archived')}</option>
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">{t('Filter storage location')}</span>
                    <select
                      className="select"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    >
                      <option value="">{t('All locations')}</option>
                      {data.locations.map((l) => (
                        <option value={l.id} key={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="results-heading">
                  <span>{quantity(list.length, 'pack')}</span>
                  {filter !== 'all' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setFilter('all')}>
                      {t('Clear filter')}
                    </button>
                  )}
                </div>
                {!list.length ? (
                  <div className="empty-state">
                    <IconBox size={44} />
                    <h2>
                      {active.length ? t('No packs match this view') : t('Your cabinet is empty')}
                    </h2>
                    <p>
                      {active.length
                        ? t('Try another search or filter.')
                        : t('Add a medicine or scan a label to get started.')}
                    </p>
                    <button
                      className="btn btn-primary"
                      onClick={() =>
                        active.length
                          ? (setFilter('all'), setQuery(''), setLocation(''), setTab('cabinet'))
                          : setEditing(null)
                      }
                    >
                      {active.length ? t('Show all medicines') : t('Add medicine')}
                    </button>
                  </div>
                ) : (
                  <div className="pack-grid">
                    {list.map((pack) => {
                      const state = expiryState(pack, data.today);
                      return (
                        <article
                          className={`card pack-card ${state === 'unknown' ? 'unknown-pack' : ''}`}
                          key={pack.id}
                        >
                          <div className="pack-topline">
                            <span className="pack-form">
                              {pack.product.form || t('Form not recorded')}
                            </span>
                            <span className="mono small">{pack.product.country}</span>
                          </div>
                          <button className="pack-title" onClick={() => setEditing(pack)}>
                            <h2>
                              <bdi>{pack.product.name}</bdi>
                            </h2>
                          </button>
                          <p className="pack-ingredient muted">
                            {pack.product.ingredientText || t('Ingredients not recorded')}
                          </p>
                          <div className={`pack-expiry expiry-${state}`}>
                            {state !== 'recorded' && <WarningIcon />}
                            <span>
                              {t(statusLabels[state])}
                              {pack.expiryValue && (
                                <span className="mono">
                                  {' '}
                                  ·{' '}
                                  <time dateTime={pack.expiryValue} title={pack.expiryValue}>
                                    {date(
                                      pack.expiryValue,
                                      pack.expiryPrecision === 'month' ? 'month' : 'day',
                                    )}
                                  </time>
                                </span>
                              )}
                            </span>
                          </div>
                          <p className="pack-location">
                            {data.locations.find((l) => l.id === pack.locationId)?.name ||
                              t('No storage location')}
                          </p>
                          <div className="pack-footer">
                            <div className="quantity-controls">
                              <button
                                className="btn btn-ghost btn-square"
                                aria-label={t('Reduce quantity of {{name}}', {
                                  name: pack.product.name,
                                })}
                                disabled={!online || pack.quantity <= 0}
                                onClick={() =>
                                  void mutate(pack, 'quantity', Math.max(0, pack.quantity - 1))
                                }
                              >
                                <IconMinus size={18} />
                              </button>
                              <span className="mono">{quantity(pack.quantity, pack.unit)}</span>
                              <button
                                className="btn btn-ghost btn-square"
                                aria-label={t('Increase quantity of {{name}}', {
                                  name: pack.product.name,
                                })}
                                disabled={!online}
                                onClick={() => void mutate(pack, 'quantity', pack.quantity + 1)}
                              >
                                <IconPlus size={18} />
                              </button>
                            </div>
                            <div className="pack-actions">
                              <button
                                className="btn btn-ghost btn-square"
                                aria-label={t(
                                  pack.archived ? 'Unarchive {{name}}' : 'Archive {{name}}',
                                  { name: pack.product.name },
                                )}
                                disabled={!online}
                                onClick={() => void mutate(pack, 'archive')}
                              >
                                <IconArchive size={19} />
                              </button>
                              <button
                                className="btn btn-ghost btn-square"
                                aria-label={t('Delete {{name}}', { name: pack.product.name })}
                                disabled={!online}
                                onClick={() => void mutate(pack, 'delete')}
                              >
                                <IconTrash size={19} />
                              </button>
                            </div>
                          </div>
                          {pack.quantity === 0 && (
                            <span className="badge badge-outline">{t('Exhausted')}</span>
                          )}
                          <button
                            className="card-edit btn btn-ghost"
                            onClick={() => setEditing(pack)}
                          >
                            {state === 'unknown' ? t('Add an expiry date') : t('View & edit pack')}
                            <IconArrowRight size={18} />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
              {tab === 'cabinet' && (
                <aside className="desktop-assistant">
                  <AssistantScreen
                    packs={data.packs}
                    demo={auth.demo}
                    compact
                    onUrgent={() => setUrgentOpen(true)}
                    onDirty={setAssistantDirty}
                  />
                </aside>
              )}
            </div>
          )}
          <PwaControls blocked={dirty} />
          <footer className="app-footer">
            {t('Inventory information does not establish whether a medicine is suitable for you.')}
          </footer>
        </main>
      </div>
      {urgentOverlay}
      {editing !== undefined && (
        <PackEditor
          pack={editing}
          onProductSaved={() => void refresh()}
          products={data.products}
          locations={data.locations}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            setNotice('Saved to your cabinet.');
            void refresh();
          }}
        />
      )}
    </div>
  );
}

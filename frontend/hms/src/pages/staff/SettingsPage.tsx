import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, History, Search, X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAuthStore } from '../../stores/authStore';
import { usePmsUIStore } from '../../stores/pmsUIStore';
import type { SettingsCategoryId } from '../../types/settings';
import { SettingsStickyFooter } from './settings/components/SettingsStickyFooter';
import { IssuesContext } from './settings/components/ui';
import { DEFAULT_CATEGORY, SETTINGS_CATEGORIES, canManageOrganization, dirtyCategoryIds, findCategory, searchSettings, sectionAnchor } from './settings/settingsNav';
import { validateSettings } from './settings/validation';

const lazyTab = <T, K extends keyof T>(load: () => Promise<T>, name: K) =>
  React.lazy(() => load().then((m) => ({ default: m[name] as unknown as React.ComponentType })));

const TABS: Record<SettingsCategoryId, React.LazyExoticComponent<React.ComponentType>> = {
  property: lazyTab(() => import('./settings/tabs/PropertyTab'), 'PropertyTab'),
  localization: lazyTab(() => import('./settings/tabs/LocalizationBrandingTabs'), 'LocalizationTab'),
  branding: lazyTab(() => import('./settings/tabs/LocalizationBrandingTabs'), 'BrandingTab'),
  stay: lazyTab(() => import('./settings/tabs/StayTab'), 'StayTab'),
  reservations: lazyTab(() => import('./settings/tabs/ReservationsTab'), 'ReservationsTab'),
  housekeeping: lazyTab(() => import('./settings/tabs/HousekeepingTab'), 'HousekeepingTab'),
  'rates-taxes': lazyTab(() => import('./settings/tabs/FinanceTabs'), 'RatesTaxesTab'),
  billing: lazyTab(() => import('./settings/tabs/FinanceTabs'), 'BillingTab'),
  payments: lazyTab(() => import('./settings/tabs/PaymentsTab'), 'PaymentsTab'),
  'night-audit': lazyTab(() => import('./settings/tabs/FinanceTabs'), 'NightAuditTab'),
  distribution: lazyTab(() => import('./settings/tabs/DistributionTab'), 'DistributionTab'),
  communications: lazyTab(() => import('./settings/tabs/CommunicationsTab'), 'CommunicationsTab'),
  security: lazyTab(() => import('./settings/tabs/SecurityTab'), 'SecurityTab'),
  integrations: lazyTab(() => import('./settings/tabs/IntegrationsTab'), 'IntegrationsTab'),
  organization: lazyTab(() => import('./settings/tabs/OrganizationTab'), 'OrganizationTab'),
};

/** Scroll to a section once its (lazy-loaded) card exists, then briefly highlight it. */
function scrollToSection(anchor: string) {
  let tries = 0;
  const tick = () => {
    const el = document.getElementById(anchor);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.setAttribute('data-flash', 'true');
      window.setTimeout(() => el.removeAttribute('data-flash'), 1600);
    } else if (tries++ < 40) {
      window.setTimeout(tick, 50);
    }
  };
  tick();
}

export const SettingsPage: React.FC = () => {
  const role = useAuthStore((s) => s.session?.role);
  const { data, initialData, isDirty, auditTrail, loadFromApi, setActiveCategory } = useSettingsStore();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const contentTop = useRef<HTMLDivElement>(null);

  const categories = useMemo(() => SETTINGS_CATEGORIES.filter((c) => !c.restricted || canManageOrganization(role)), [role]);
  const active = findCategory(params.get('tab')) ?? findCategory(DEFAULT_CATEGORY)!;
  const sectionParam = params.get('section');

  // Load saved settings, but never throw away edits the user has not saved yet (e.g. after visiting another page).
  useEffect(() => {
    if (!useSettingsStore.getState().isDirty) loadFromApi();
  }, [loadFromApi]);

  // Keep the business date in step with night audit rollovers.
  const pmsBusinessDate = usePmsUIStore((s) => s.businessDate);
  useEffect(() => {
    if (pmsBusinessDate) useSettingsStore.getState().setBusinessDate(pmsBusinessDate);
  }, [pmsBusinessDate]);

  useEffect(() => setActiveCategory(active.id), [active.id, setActiveCategory]);

  useEffect(() => {
    if (sectionParam) scrollToSection(sectionAnchor(active.id, sectionParam));
  }, [active.id, sectionParam]);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const issues = useMemo(() => validateSettings(data), [data]);
  const dirty = useMemo(() => dirtyCategoryIds(data, initialData), [data, initialData]);
  const issueCats = useMemo(() => new Set(issues.map((i) => i.category)), [issues]);
  const hits = useMemo(() => searchSettings(query, categories), [query, categories]);

  const go = (tab: SettingsCategoryId, section?: string) => {
    setParams(section ? { tab, section } : { tab });
    setQuery('');
    if (!section) contentTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const groups = [...new Set(categories.map((c) => c.group))];
  const ActiveTab = TABS[active.id];
  const ActiveIcon = active.icon;

  return (
    <IssuesContext.Provider value={issues}>
      <div className="space-y-5 text-ink">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight text-ink">Hotel settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.propertyIdentity.propertyName} · <span className="font-mono">{data.propertyIdentity.propertyCode}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-72 sm:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && hits[0]) go(hits[0].category.id, hits[0].section.id);
                  if (e.key === 'Escape') setQuery('');
                }}
                placeholder="Search settings"
                aria-label="Search settings"
                aria-controls="settings-search-results"
                aria-expanded={!!query}
                className="min-h-10 w-full rounded-lg border border-input bg-ivory pl-9 pr-3 text-sm outline-none focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25"
              />
              {query && (
                <div id="settings-search-results" className="absolute right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-border bg-ivory shadow-lg sm:left-auto sm:w-96">
                  {hits.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">No settings match “{query}”.</p>
                  ) : (
                    <ul>
                      {hits.map(({ category, section }) => (
                        <li key={`${category.id}-${section.id}`}>
                          <button
                            type="button"
                            onClick={() => go(category.id, section.id)}
                            className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-gold-soft/30 focus-visible:bg-gold-soft/30 focus-visible:outline-none"
                          >
                            <span className="text-sm font-medium text-ink">{section.title}</span>
                            <span className="text-xs text-muted-foreground">
                              {category.group} › {category.label}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-ivory px-3 text-sm font-medium text-ink hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40"
            >
              <History className="size-4 text-burgundy" aria-hidden="true" />
              <span className="hidden sm:inline">History</span>
              {auditTrail.length > 0 && <span className="rounded-full bg-gold-soft/60 px-1.5 text-xs">{auditTrail.length}</span>}
            </button>
          </div>
        </div>

        {issues.length > 0 && (
          <div role="status" className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertTriangle className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>
              {issues.length === 1 ? '1 setting needs attention' : `${issues.length} settings need attention`} before you can save.
            </span>
            <button type="button" onClick={() => go(issues[0].category)} className="font-semibold underline underline-offset-2">
              Show
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-6">
          {/* Mobile / tablet: compact picker */}
          <div className="lg:hidden">
            <label htmlFor="settings-category" className="sr-only">
              Settings category
            </label>
            <select
              id="settings-category"
              value={active.id}
              onChange={(e) => go(e.target.value as SettingsCategoryId)}
              className="min-h-11 w-full rounded-lg border border-input bg-ivory px-3 text-sm font-medium text-ink outline-none focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25"
            >
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {categories
                    .filter((c) => c.group === g)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                        {dirty.has(c.id) ? ' • unsaved' : ''}
                        {issueCats.has(c.id) ? ' • needs attention' : ''}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Desktop: grouped sidebar */}
          <nav aria-label="Settings categories" className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] space-y-4 overflow-y-auto pb-24">
              {groups.map((g) => (
                <div key={g}>
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g}</p>
                  <ul className="space-y-0.5">
                    {categories
                      .filter((c) => c.group === g)
                      .map((c) => {
                        const Icon = c.icon;
                        const on = c.id === active.id;
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => go(c.id)}
                              aria-current={on ? 'page' : undefined}
                              className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40 ${
                                on ? 'bg-burgundy font-semibold text-white' : 'text-walnut hover:bg-gold-soft/40'
                              }`}
                            >
                              <Icon className={`size-4 shrink-0 ${on ? 'text-white' : 'text-muted-foreground'}`} />
                              <span className="flex-1 truncate">{c.label}</span>
                              {issueCats.has(c.id) ? (
                                <span className="size-2 rounded-full bg-rose-500" title="Needs attention" aria-label="needs attention" />
                              ) : (
                                dirty.has(c.id) && <span className={`size-2 rounded-full ${on ? 'bg-white' : 'bg-amber-500'}`} title="Unsaved changes" aria-label="unsaved changes" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>

          {/* Content */}
          <div ref={contentTop} className="min-w-0 scroll-mt-24 space-y-5">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold-soft/50 text-burgundy">
                  <ActiveIcon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-ink">{active.label}</h2>
                  <p className="text-sm text-muted-foreground">{active.description}</p>
                </div>
              </div>
              {active.sections.length > 1 && (
                <nav aria-label={`${active.label} sections`} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                  <ul className="flex w-max gap-1.5">
                    {active.sections.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => go(active.id, s.id)}
                          className="min-h-8 whitespace-nowrap rounded-full border border-border bg-ivory px-3 text-xs font-medium text-walnut hover:border-burgundy/40 hover:text-burgundy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40"
                        >
                          {s.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}
            </div>

            <React.Suspense fallback={<div className="grid min-h-[300px] place-items-center text-sm text-muted-foreground">Loading…</div>}>
              <ActiveTab />
            </React.Suspense>
          </div>
        </div>

        <SettingsStickyFooter issues={issues} dirtyLabels={categories.filter((c) => dirty.has(c.id)).map((c) => c.label)} onShowIssue={() => issues[0] && go(issues[0].category)} />

        {showHistory && <HistoryDrawer onClose={() => setShowHistory(false)} />}
      </div>
    </IssuesContext.Provider>
  );
};

const HistoryDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const auditTrail = useSettingsStore((s) => s.auditTrail);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-xs" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-history-title"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-ivory shadow-2xl animate-in slide-in-from-right duration-200"
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-ivory p-5">
          <h3 id="settings-history-title" className="text-base font-semibold text-ink">
            Saved changes
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-ink">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 p-5">
          <p className="text-xs text-muted-foreground">Saves made in this browser session.</p>
          {auditTrail.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No changes saved yet.</p>
          ) : (
            auditTrail.map((ev) => (
              <div key={ev.id} className="space-y-1 rounded-lg border border-border p-3 text-xs">
                <span className="font-mono text-[11px] text-muted-foreground">{ev.timestamp}</span>
                <p className="font-medium text-ink">
                  {ev.changedKeys
                    ? ev.changedKeys.length
                      ? [...new Set(ev.changedKeys.map((k) => SETTINGS_CATEGORIES.find((c) => (c.dataKeys as string[]).includes(k))?.label ?? k))].join(', ')
                      : 'Saved with no changes'
                    : ev.details}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

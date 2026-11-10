import React, { createContext, useContext, useId } from 'react';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { HMSSettingsData } from '../../../../types/settings';
import type { SettingsIssue } from '../validation';
import { sectionAnchor } from '../settingsNav';

// ---------------------------------------------------------------------------
// Store binding
// ---------------------------------------------------------------------------

/** Settings keys whose value is a plain object (not a list). */
export type ObjectSectionKey = {
  [K in keyof HMSSettingsData]: HMSSettingsData[K] extends unknown[] ? never : K;
}[keyof HMSSettingsData];

/** Read one settings object and get a patch function for it. */
export function useSettingsSection<K extends ObjectSectionKey>(key: K) {
  const value = useSettingsStore((s) => s.data[key]);
  const updateCategory = useSettingsStore((s) => s.updateCategory);
  const patch = (p: Partial<HMSSettingsData[K]>) => updateCategory(key, p);
  return [value, patch] as const;
}

// ---------------------------------------------------------------------------
// Validation issues (provided once by SettingsPage)
// ---------------------------------------------------------------------------

export const IssuesContext = createContext<SettingsIssue[]>([]);
export const useIssue = (field?: string) => {
  const issues = useContext(IssuesContext);
  return field ? issues.find((i) => i.field === field)?.message : undefined;
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const SettingsSection: React.FC<{
  categoryId: string;
  id: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}> = ({ categoryId, id, title, description, actions, children }) => {
  const anchor = sectionAnchor(categoryId, id);
  return (
    <section
      id={anchor}
      aria-labelledby={`${anchor}-title`}
      className="scroll-mt-24 rounded-xl border border-border bg-ivory p-4 shadow-2xs transition-shadow sm:p-6 data-[flash=true]:ring-2 data-[flash=true]:ring-burgundy/40"
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
        <div className="min-w-0">
          <h3 id={`${anchor}-title`} className="text-base font-semibold text-ink">
            {title}
          </h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
};

const COLS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
} as const;

export const FieldGrid: React.FC<{ cols?: keyof typeof COLS; children: React.ReactNode }> = ({ cols = 3, children }) => (
  <div className={`grid gap-4 ${COLS[cols]}`}>{children}</div>
);

/** Label, control, then either the error or the hint. Pass `issue` to show the validation message for that field. */
export const Field: React.FC<{
  label: string;
  hint?: string;
  issue?: string;
  required?: boolean;
  span?: 2 | 3 | 'full';
  children: (props: { id: string; invalid: boolean; describedBy?: string }) => React.ReactNode;
}> = ({ label, hint, issue, required, span, children }) => {
  const id = useId();
  const error = useIssue(issue);
  const describedBy = error || hint ? `${id}-desc` : undefined;
  const spanCls = span === 'full' ? 'sm:col-span-full' : span === 3 ? 'sm:col-span-2 lg:col-span-3' : span === 2 ? 'sm:col-span-2' : '';
  return (
    <div className={`min-w-0 space-y-1.5 ${spanCls}`}>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {label}
        {required && <span className="text-rose-600" aria-hidden="true"> *</span>}
      </label>
      {children({ id, invalid: !!error, describedBy })}
      {error ? (
        <p id={describedBy} role="alert" className="text-[11px] font-medium text-rose-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={describedBy} className="text-[11px] text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

const control =
  'w-full min-h-10 rounded-lg border bg-ivory px-3 py-2 text-sm text-ink outline-none transition focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25 disabled:cursor-not-allowed disabled:opacity-50 read-only:bg-slate-50';
const borderFor = (invalid?: boolean) => (invalid ? 'border-rose-400' : 'border-input');

type BaseProps = { id: string; invalid: boolean; describedBy?: string };
const aria = (p: BaseProps) => ({ id: p.id, 'aria-invalid': p.invalid || undefined, 'aria-describedby': p.describedBy });

export const TextInput: React.FC<
  BaseProps & { value: string; onChange?: (v: string) => void; mono?: boolean; uppercase?: boolean } & Omit<
      React.InputHTMLAttributes<HTMLInputElement>,
      'value' | 'onChange' | 'id'
    >
> = ({ id, invalid, describedBy, value, onChange, mono, uppercase, className, ...rest }) => (
  <input
    type="text"
    {...rest}
    {...aria({ id, invalid, describedBy })}
    value={value ?? ''}
    readOnly={!onChange || rest.readOnly}
    onChange={(e) => onChange?.(uppercase ? e.target.value.toUpperCase() : e.target.value)}
    className={`${control} ${borderFor(invalid)} ${mono ? 'font-mono' : ''} ${uppercase ? 'uppercase' : ''} ${className ?? ''}`}
  />
);

export const NumberInput: React.FC<
  BaseProps & { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; unit?: string; disabled?: boolean }
> = ({ id, invalid, describedBy, value, onChange, min, max, step, unit, disabled }) => (
  <div className="flex items-center gap-2">
    <input
      type="number"
      inputMode="decimal"
      {...aria({ id, invalid, describedBy })}
      value={Number.isFinite(value) ? value : ''}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
      className={`${control} ${borderFor(invalid)} font-mono`}
    />
    {unit && <span className="shrink-0 text-xs text-muted-foreground">{unit}</span>}
  </div>
);

export interface Option {
  value: string;
  label: string;
}

export const SelectInput: React.FC<
  BaseProps & { value: string; onChange: (v: string) => void; options: Option[]; disabled?: boolean }
> = ({ id, invalid, describedBy, value, onChange, options, disabled }) => {
  // Keep an unknown stored value visible instead of silently showing the first option.
  const opts = options.some((o) => o.value === value) || !value ? options : [{ value, label: value }, ...options];
  return (
    <select
      {...aria({ id, invalid, describedBy })}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${control} ${borderFor(invalid)} pr-8`}
    >
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
};

export const TimeInput: React.FC<BaseProps & { value: string; onChange: (v: string) => void; disabled?: boolean }> = ({
  id,
  invalid,
  describedBy,
  value,
  onChange,
  disabled,
}) => (
  <input
    type="time"
    {...aria({ id, invalid, describedBy })}
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    className={`${control} ${borderFor(invalid)} font-mono`}
  />
);

export const ColorInput: React.FC<BaseProps & { value: string; onChange: (v: string) => void }> = ({ id, invalid, describedBy, value, onChange }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      aria-label="Pick colour"
      value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-1"
    />
    <input
      type="text"
      {...aria({ id, invalid, describedBy })}
      value={value}
      maxLength={7}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className={`${control} ${borderFor(invalid)} font-mono uppercase`}
    />
  </div>
);

/** Accessible on/off switch. */
export const Switch: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}> = ({ checked, onChange, disabled, ...rest }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    {...rest}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-burgundy/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
      checked ? 'bg-burgundy' : 'bg-slate-300'
    }`}
  >
    <span
      aria-hidden="true"
      className={`absolute left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`}
    />
  </button>
);

/** A labelled switch row. Clicking anywhere on the text toggles it. */
export const ToggleRow: React.FC<{
  label: string;
  description?: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}> = ({ label, description, checked, onChange, disabled, children }) => {
  const id = useId();
  return (
    <div className={`rounded-lg border border-border bg-cream/40 p-3 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div
          className={`min-w-0 flex-1 ${disabled ? '' : 'cursor-pointer'}`}
          onClick={() => !disabled && onChange(!checked)}
        >
          <span id={`${id}-l`} className="block text-sm font-medium text-ink">
            {label}
          </span>
          {description && (
            <span id={`${id}-d`} className="mt-0.5 block text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </div>
        <Switch
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          aria-labelledby={`${id}-l`}
          aria-describedby={description ? `${id}-d` : undefined}
        />
      </div>
      {children && <div className="mt-3 border-t border-border pt-3">{children}</div>}
    </div>
  );
};

export const ToggleGrid: React.FC<{ cols?: 1 | 2 | 3; children: React.ReactNode }> = ({ cols = 2, children }) => (
  <div className={`grid gap-3 ${cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
    {children}
  </div>
);

export const SubHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="pt-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</h4>
);

export const Note: React.FC<{ tone?: 'info' | 'warning'; children: React.ReactNode }> = ({ tone = 'info', children }) => (
  <div
    className={`flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed ${
      tone === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-border bg-cream/50 text-muted-foreground'
    }`}
  >
    <Info className={`mt-0.5 size-4 shrink-0 ${tone === 'warning' ? 'text-amber-700' : 'text-burgundy'}`} aria-hidden="true" />
    <div>{children}</div>
  </div>
);

export const EmptyNote: React.FC<{ title: string; children?: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-lg border border-dashed border-border bg-cream/30 p-6 text-center">
    <p className="text-sm font-medium text-ink">{title}</p>
    {children && <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{children}</p>}
  </div>
);

export const StatusPill: React.FC<{ tone: 'ok' | 'warn' | 'off' | 'error'; children: React.ReactNode }> = ({ tone, children }) => {
  const cls = {
    ok: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    warn: 'bg-amber-50 text-amber-800 border-amber-200',
    off: 'bg-slate-100 text-slate-600 border-slate-200',
    error: 'bg-rose-50 text-rose-700 border-rose-200',
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>;
};

export const buttonPrimary =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-burgundy px-3 text-xs font-semibold text-white shadow-xs transition hover:bg-burgundy-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40 disabled:opacity-50';
export const buttonSecondary =
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-ivory px-3 text-xs font-semibold text-ink transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40 disabled:opacity-50';

/** Shared table look for list-style settings (payment methods, booking sources, triggers). */
export const tableWrap = 'overflow-x-auto rounded-lg border border-border';
export const tableCls = 'w-full min-w-[640px] text-left text-xs';
export const theadCls = 'border-b border-border bg-cream/60 text-[11px] font-semibold uppercase tracking-wider text-slate-600';
export const cellInput =
  'w-full min-h-8 rounded-md border border-input bg-ivory px-2 py-1 text-xs text-ink outline-none focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25';

/** In-page link to another settings category/section (the page scrolls to it). */
export const GoTo: React.FC<{ tab: string; section?: string; children: React.ReactNode }> = ({ tab, section, children }) => (
  <Link
    to={{ search: `?tab=${tab}${section ? `&section=${section}` : ''}` }}
    className="font-semibold text-burgundy underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none"
  >
    {children}
  </Link>
);

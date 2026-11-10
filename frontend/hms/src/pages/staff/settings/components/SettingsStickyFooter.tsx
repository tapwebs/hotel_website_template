import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Loader2, RotateCcw, Save } from 'lucide-react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { SettingsIssue } from '../validation';

/** Save bar that sticks to the bottom of the settings page (above the mobile tab bar) whenever there is something to save or report. */
export const SettingsStickyFooter: React.FC<{ issues: SettingsIssue[]; dirtyLabels: string[]; onShowIssue: () => void }> = ({ issues, dirtyLabels, onShowIssue }) => {
  const { isDirty, saveStatus, lastSavedAt, errorMessage, saveChanges, revertChanges, clearNotification } = useSettingsStore();
  const blocked = issues.length > 0;
  const saving = saveStatus === 'saving';

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const st = useSettingsStore.getState();
        if (st.isDirty && !blocked && st.saveStatus !== 'saving') void st.saveChanges();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [blocked]);

  // The "saved" note clears itself.
  useEffect(() => {
    if (saveStatus !== 'saved' || isDirty) return;
    const t = window.setTimeout(clearNotification, 4000);
    return () => window.clearTimeout(t);
  }, [saveStatus, isDirty, clearNotification]);

  if (!isDirty && saveStatus === 'idle') return null;

  let message: React.ReactNode;
  if (saving) message = <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Saving…</>;
  else if (saveStatus === 'error') message = <><AlertCircle className="size-4 text-rose-400" aria-hidden="true" /> {errorMessage || 'Could not save. Please try again.'}</>;
  else if (!isDirty && saveStatus === 'saved') message = <><CheckCircle className="size-4 text-emerald-400" aria-hidden="true" /> Settings saved{lastSavedAt ? ` at ${lastSavedAt}` : ''}.</>;
  else if (blocked)
    message = (
      <>
        <AlertCircle className="size-4 text-amber-300" aria-hidden="true" />
        Fix {issues.length === 1 ? '1 issue' : `${issues.length} issues`} to save.
        <button type="button" onClick={onShowIssue} className="font-semibold text-white underline underline-offset-2">
          Show
        </button>
      </>
    );
  else
    message = (
      <>
        <span className="size-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
        <span className="truncate">Unsaved changes{dirtyLabels.length ? ` in ${dirtyLabels.join(', ')}` : ''}</span>
      </>
    );

  return (
    <aside aria-label="Save settings" className="sticky bottom-20 z-30 md:bottom-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-ink p-3 text-white shadow-2xl animate-in slide-in-from-bottom-3 duration-200 sm:p-4">
        <p role="status" aria-live="polite" className="flex min-w-0 flex-1 items-center gap-2 text-sm">
          {message}
        </p>
        {isDirty && (
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={revertChanges}
              disabled={saving}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-sm font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50"
            >
              <RotateCcw className="size-4" aria-hidden="true" /> Discard
            </button>
            <button
              type="button"
              onClick={() => void saveChanges()}
              disabled={saving || blocked}
              title={blocked ? 'Fix the highlighted settings first' : 'Save (Ctrl+S)'}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-burgundy px-4 text-sm font-semibold text-white shadow-md hover:bg-burgundy-deep disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />} Save changes
            </button>
          </div>
        )}
        {!isDirty && saveStatus !== 'saving' && (
          <button type="button" onClick={clearNotification} className="ml-auto min-h-9 rounded-lg bg-slate-800 px-3 text-sm text-slate-200 hover:bg-slate-700">
            Dismiss
          </button>
        )}
      </div>
    </aside>
  );
};

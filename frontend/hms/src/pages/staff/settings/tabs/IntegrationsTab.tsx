import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { WebhookEndpointItem } from '../../../../types/settings';
import {
  EmptyNote,
  Field,
  FieldGrid,
  Note,
  NumberInput,
  SettingsSection,
  StatusPill,
  TextInput,
  ToggleGrid,
  ToggleRow,
  buttonPrimary,
  useSettingsSection,
} from '../components/ui';

const C = 'integrations';
const EVENTS: WebhookEndpointItem['eventsSubscribed'] = ['BOOKING_CREATED', 'PAYMENT_CAPTURED', 'ROOM_STATUS_CHANGED', 'FOLIO_CLOSED', 'NIGHT_AUDIT_COMPLETED'];
const eventLabel = (e: string) => e.charAt(0) + e.slice(1).toLowerCase().replace(/_/g, ' ');

export const IntegrationsTab: React.FC = () => {
  const [api, setApi] = useSettingsSection('websiteApi');
  const [fnb, setFnb] = useSettingsSection('externalFnb');
  const webhooks = useSettingsStore((s) => s.data.webhooks);
  const { addWebhook, deleteWebhook, updateWebhook } = useSettingsStore();
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [events, setEvents] = useState<WebhookEndpointItem['eventsSubscribed']>(['BOOKING_CREATED', 'PAYMENT_CAPTURED']);
  const [originsText, setOriginsText] = useState(api.allowedOrigins.join('\n'));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || events.length === 0) return;
    addWebhook({
      targetUrl: url.trim(),
      description: desc.trim() || 'Webhook',
      eventsSubscribed: events,
      // The server issues the real signing secret; nothing secret is created in the browser.
      secretTokenMasked: '',
      signatureVerification: 'HMAC_SHA256',
      idempotencyEnforced: true,
      retryPolicyMaxRetries: 3,
      status: 'ACTIVE',
    });
    setUrl('');
    setDesc('');
  };

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="website-api" title="Website API" description="Used by your website and booking widget to read availability and create bookings.">
        <FieldGrid cols={2}>
          <Field label="Booking endpoint">
            {(p) => <TextInput {...p} value={api.publicBookingEndpoint} mono readOnly />}
          </Field>
          <Field label="Availability endpoint">
            {(p) => <TextInput {...p} value={api.rateAvailabilityEndpoint || '—'} mono readOnly />}
          </Field>
          <Field label="Request limit" hint="Per client, per minute.">
            {(p) => <NumberInput {...p} min={10} step={10} unit="requests / min" value={api.rateLimitingPerMinute} onChange={(v) => setApi({ rateLimitingPerMinute: v })} />}
          </Field>
          <Field label="Public API key">
            {(p) => <TextInput {...p} value={api.apiKeyMasked || 'Not issued'} mono readOnly />}
          </Field>
          <Field label="Allowed website addresses (CORS)" hint="One per line, e.g. https://www.yourhotel.in" span="full">
            {(p) => (
              <textarea
                id={p.id}
                aria-describedby={p.describedBy}
                rows={3}
                value={originsText}
                onChange={(e) => {
                  setOriginsText(e.target.value);
                  setApi({ allowedOrigins: e.target.value.split(/[\n,]/).map((s) => s.trim()).filter(Boolean) });
                }}
                className="w-full rounded-lg border border-input bg-ivory px-3 py-2 font-mono text-sm text-ink outline-none focus-visible:border-burgundy focus-visible:ring-2 focus-visible:ring-burgundy/25"
              />
            )}
          </Field>
        </FieldGrid>
      </SettingsSection>

      <SettingsSection
        categoryId={C}
        id="fnb"
        title="Restaurant POS"
        description="Sales and room-charge postings received from the restaurant system."
        actions={<StatusPill tone={fnb.connectionStatus === 'CONNECTED' ? 'ok' : fnb.connectionStatus === 'DEGRADED' ? 'warn' : 'off'}>{fnb.connectionStatus.toLowerCase()}</StatusPill>}
      >
        <p className="text-sm text-ink">
          {fnb.providerName}
          {fnb.endpointUrl && <span className="ml-2 font-mono text-xs text-muted-foreground">{fnb.endpointUrl}</span>}
        </p>
        <ToggleGrid cols={3}>
          <ToggleRow label="Sales figures" description="Hourly restaurant sales for reports." checked={fnb.analyticsSyncEnabled} onChange={(v) => setFnb({ analyticsSyncEnabled: v })} />
          <ToggleRow label="Covers and table turns" checked={fnb.operationalStatsSyncEnabled} onChange={(v) => setFnb({ operationalStatsSyncEnabled: v })} />
          <ToggleRow label="Nightly room-charge check" description="Match restaurant bills charged to rooms against folios." checked={fnb.nightlyFolioReconciliationEnabled} onChange={(v) => setFnb({ nightlyFolioReconciliationEnabled: v })} />
        </ToggleGrid>
        <Note>Menu, tables, kitchen and restaurant tax are set in Restaurant & kitchen → Settings.</Note>
      </SettingsSection>

      <SettingsSection categoryId={C} id="webhooks" title="Webhooks" description="Send events to other systems, such as accounting software. Each request is signed with HMAC-SHA256.">
        {webhooks.length === 0 ? (
          <EmptyNote title="No webhooks yet" />
        ) : (
          <ul className="space-y-3">
            {webhooks.map((wh) => (
              <li key={wh.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-cream/40 p-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{wh.description}</span>
                    <StatusPill tone={wh.status === 'ACTIVE' ? 'ok' : wh.status === 'FAILING' ? 'error' : 'off'}>{wh.status.toLowerCase()}</StatusPill>
                  </div>
                  <p className="break-all font-mono text-xs text-ink">{wh.targetUrl}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {wh.eventsSubscribed.map((e) => (
                      <span key={e} className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {eventLabel(e)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateWebhook(wh.id, { status: wh.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' })}
                    className="min-h-9 rounded-lg border border-border px-3 text-xs font-semibold text-ink hover:bg-slate-50"
                  >
                    {wh.status === 'PAUSED' ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    type="button"
                    onClick={() => window.confirm(`Remove the webhook to ${wh.targetUrl}?`) && deleteWebhook(wh.id)}
                    className="grid size-9 place-items-center rounded-lg text-rose-600 hover:bg-rose-50"
                    aria-label={`Remove webhook ${wh.description}`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="space-y-3 rounded-lg border border-border p-4">
          <p className="text-sm font-semibold text-ink">Add a webhook</p>
          <FieldGrid cols={2}>
            <Field label="Endpoint URL" required>
              {(p) => <TextInput {...p} type="url" required value={url} onChange={setUrl} mono placeholder="https://example.com/hms-events" />}
            </Field>
            <Field label="Name">
              {(p) => <TextInput {...p} value={desc} onChange={setDesc} placeholder="e.g. Accounting sync" />}
            </Field>
          </FieldGrid>
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-slate-700">Events to send</legend>
            <div className="flex flex-wrap gap-2">
              {EVENTS.map((e) => {
                const on = events.includes(e);
                return (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setEvents(on ? events.filter((x) => x !== e) : [...events, e])}
                    className={`min-h-8 rounded-full border px-3 text-xs font-medium transition ${on ? 'border-burgundy bg-burgundy text-white' : 'border-border text-ink hover:bg-slate-50'}`}
                  >
                    {eventLabel(e)}
                  </button>
                );
              })}
            </div>
          </fieldset>
          <div className="flex justify-end">
            <button type="submit" disabled={!url.trim() || events.length === 0} className={buttonPrimary}>
              <Plus className="size-4" aria-hidden="true" /> Add webhook
            </button>
          </div>
        </form>
      </SettingsSection>
    </div>
  );
};

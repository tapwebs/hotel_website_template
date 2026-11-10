import React, { useState } from 'react';
import { Mail, MessageSquare, Plus, Smartphone } from 'lucide-react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { EventNotificationTriggerItem, MessageTemplateItem } from '../../../../types/settings';
import { TemplateModal } from '../components/TemplateModal';
import { EmptyNote, SettingsSection, StatusPill, Switch, buttonPrimary, buttonSecondary, tableCls, tableWrap, theadCls } from '../components/ui';

const C = 'communications';
const PROVIDER_ICON = { EMAIL_SMTP: Mail, SMS_GATEWAY: Smartphone, WHATSAPP_BUSINESS: MessageSquare } as const;
const CHANNELS: { key: 'emailEnabled' | 'smsEnabled' | 'whatsappEnabled'; label: string }[] = [
  { key: 'emailEnabled', label: 'Email' },
  { key: 'smsEnabled', label: 'SMS' },
  { key: 'whatsappEnabled', label: 'WhatsApp' },
];

export const CommunicationsTab: React.FC = () => {
  const providers = useSettingsStore((s) => s.data.communicationProviders);
  const triggers = useSettingsStore((s) => s.data.eventTriggers);
  const templates = useSettingsStore((s) => s.data.messageTemplates);
  const { updateCategory, updateMessageTemplate, addMessageTemplate } = useSettingsStore();
  const [editing, setEditing] = useState<MessageTemplateItem | 'new' | null>(null);

  const setTrigger = (eventId: string, patch: Partial<EventNotificationTriggerItem>) =>
    updateCategory('eventTriggers', triggers.map((t) => (t.eventId === eventId ? { ...t, ...patch } : t)));

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="providers" title="Messaging providers" description="Services that deliver email, SMS (DLT registered) and WhatsApp messages.">
        {providers.length === 0 ? (
          <EmptyNote title="No messaging provider connected">Automatic messages below are saved, but nothing is sent until a provider is connected. Contact support to connect one.</EmptyNote>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {providers.map((p) => {
              const Icon = PROVIDER_ICON[p.providerType];
              const pct = p.dailyQuotaLimit ? Math.min(100, (p.dailySentCount / p.dailyQuotaLimit) * 100) : 0;
              return (
                <li key={p.providerType} className="space-y-3 rounded-lg border border-border bg-cream/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon className="size-4 shrink-0 text-burgundy" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{p.providerName}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{p.senderIdentifier}</p>
                      </div>
                    </div>
                    <StatusPill tone={p.status === 'CONNECTED' ? 'ok' : p.status === 'CONFIG_REQUIRED' ? 'warn' : 'off'}>{p.status.replace('_', ' ').toLowerCase()}</StatusPill>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Sent today</span>
                      <span className="font-mono text-ink">
                        {p.dailySentCount} / {p.dailyQuotaLimit}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Daily quota used">
                      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection categoryId={C} id="triggers" title="Automatic messages" description="Choose which channels send a message at each step of a stay.">
        <div className={tableWrap}>
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th scope="col" className="px-3 py-2.5">Message</th>
                {CHANNELS.map((c) => (
                  <th key={c.key} scope="col" className="w-24 px-3 py-2.5 text-center">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-ink">
              {triggers.map((t) => (
                <tr key={t.eventId}>
                  <td className="px-3 py-2.5">
                    <span className="block text-sm font-medium">{t.eventName}</span>
                    <span className="block text-[11px] text-muted-foreground">{t.eventDescription}</span>
                  </td>
                  {CHANNELS.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-center">
                      <Switch aria-label={`${t.eventName} by ${c.label}`} checked={t[c.key]} onChange={(v) => setTrigger(t.eventId, { [c.key]: v })} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <SettingsSection
        categoryId={C}
        id="templates"
        title="Message templates"
        description="Wording for each message. Merge tags like {{guest_name}} are filled in when sending."
        actions={
          <button type="button" onClick={() => setEditing('new')} className={buttonPrimary}>
            <Plus className="size-4" aria-hidden="true" /> New template
          </button>
        }
      >
        {templates.length === 0 ? (
          <EmptyNote title="No templates yet" />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((t) => (
              <li key={t.id} className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-cream/40 p-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <StatusPill tone="off">{t.channel === 'WHATSAPP' ? 'WhatsApp' : t.channel === 'SMS' ? 'SMS' : 'Email'}</StatusPill>
                    <StatusPill tone={t.isActive ? 'ok' : 'off'}>{t.isActive ? 'Active' : 'Inactive'}</StatusPill>
                  </div>
                  <p className="text-sm font-semibold text-ink">{t.name}</p>
                  <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{t.bodyContent}</p>
                </div>
                <button type="button" onClick={() => setEditing(t)} className={`${buttonSecondary} self-start`}>
                  Edit
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      {editing && (
        <TemplateModal
          key={editing === 'new' ? 'new' : editing.id}
          isOpen
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(t) => ('id' in t ? updateMessageTemplate(t.id, t) : addMessageTemplate(t))}
        />
      )}
    </div>
  );
};

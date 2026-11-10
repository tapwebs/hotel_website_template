import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import type { ChannelAdapterItem } from '../../../../types/settings';
import { ChannelDrawer } from '../components/ChannelDrawer';
import { EmptyNote, Field, FieldGrid, GoTo, NumberInput, SettingsSection, StatusPill, ToggleGrid, ToggleRow, useSettingsSection } from '../components/ui';

const C = 'distribution';

export const DistributionTab: React.FC = () => {
  const [be, setBe] = useSettingsSection('directBookingEngine');
  const channels = useSettingsStore((s) => s.data.channels);
  const updateChannel = useSettingsStore((s) => s.updateChannel);
  const [selected, setSelected] = useState<ChannelAdapterItem | null>(null);

  return (
    <div className="space-y-6">
      <SettingsSection categoryId={C} id="booking-engine" title="Direct booking engine" description="Bookings made on your own website.">
        <ToggleRow label="Accept direct bookings" description="Turn off to stop new website bookings without taking the site down." checked={be.enabled} onChange={(v) => setBe({ enabled: v })} />
        <ToggleGrid>
          <ToggleRow label="Confirm instantly" description="Bookings are confirmed as soon as payment is captured." disabled={!be.enabled} checked={be.instantConfirmation} onChange={(v) => setBe({ instantConfirmation: v })} />
          <ToggleRow label="Payment required to book" description="Guests pay online or pre-authorise a card." disabled={!be.enabled} checked={be.advancePaymentRequired} onChange={(v) => setBe({ advancePaymentRequired: v })} />
          <ToggleRow label="Guests can change dates online" disabled={!be.enabled} checked={be.allowGuestModification} onChange={(v) => setBe({ allowGuestModification: v })} />
          <ToggleRow label="Guests can cancel online" description="Follows the default cancellation policy." disabled={!be.enabled} checked={be.allowGuestCancellation} onChange={(v) => setBe({ allowGuestCancellation: v })} />
        </ToggleGrid>
        <FieldGrid>
          <Field label="Hold rooms during checkout" hint="Rooms are released if the guest does not pay in time.">
            {(p) => <NumberInput {...p} min={5} max={60} step={5} unit="minutes" disabled={!be.enabled} value={be.holdDurationMinutes} onChange={(v) => setBe({ holdDurationMinutes: v })} />}
          </Field>
        </FieldGrid>
        <p className="text-xs text-muted-foreground">
          Colours and logo come from <GoTo tab="branding">Branding</GoTo>. Stay limits come from <GoTo tab="reservations" section="restrictions">Reservations</GoTo>.
        </p>
      </SettingsSection>

      <SettingsSection categoryId={C} id="channels" title="OTA channels" description="Two-way sync of rooms, rates and bookings with online travel agencies.">
        {channels.length === 0 ? (
          <EmptyNote title="No OTA channels connected">
            Commission and default terms for each OTA are set under <GoTo tab="reservations" section="sources">Booking sources</GoTo>. Contact support to connect a channel manager.
          </EmptyNote>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {channels.map((ch) => (
              <li key={ch.id}>
                <button
                  type="button"
                  onClick={() => setSelected(ch)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-cream/40 p-4 text-left transition hover:border-burgundy/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{ch.channelName}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">Property ID: {ch.propertyId || '—'}</p>
                    <p className="text-[11px] text-muted-foreground">Last sync: {ch.lastSyncTimestamp || 'never'}</p>
                  </div>
                  <StatusPill tone={ch.connectionStatus === 'CONNECTED' ? 'ok' : ch.connectionStatus === 'PAUSED' ? 'warn' : ch.connectionStatus === 'ERROR' ? 'error' : 'off'}>
                    {ch.connectionStatus.replace('_', ' ').toLowerCase()}
                  </StatusPill>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      {/* Mounted per channel: the drawer seeds its local form state from the channel on mount. */}
      {selected && <ChannelDrawer key={selected.id} isOpen channel={selected} onClose={() => setSelected(null)} onSave={(id, patch) => updateChannel(id, patch)} />}
    </div>
  );
};

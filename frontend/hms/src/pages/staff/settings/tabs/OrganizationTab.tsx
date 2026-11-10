import React, { useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { useSettingsStore } from '../../../../stores/settingsStore';
import { useAuthStore } from '../../../../stores/authStore';
import type { ManagedPropertyItem, OrganizationDefaultsConfig } from '../../../../types/settings';
import { Modal } from '../../../../components/ui/Modal';
import { canManageOrganization } from '../settingsNav';
import { Field, FieldGrid, NumberInput, SelectInput, SettingsSection, StatusPill, TextInput, ToggleGrid, ToggleRow, buttonPrimary, buttonSecondary, useSettingsSection } from '../components/ui';

const C = 'organization';


export const OrganizationTab: React.FC = () => {
  const role = useAuthStore((s) => s.session?.role);
  const properties = useSettingsStore((s) => s.data.managedProperties);
  const updateCategory = useSettingsStore((s) => s.updateCategory);
  const [org, setOrg] = useSettingsSection('organizationDefaults');
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', code: '', city: '', rooms: 20 });

  if (!canManageOrganization(role)) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-ivory p-10 text-center">
        <Lock className="mx-auto size-6 text-burgundy" aria-hidden="true" />
        <h3 className="text-base font-semibold text-ink">Only administrators and general managers can change organization settings</h3>
      </div>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim() || !draft.code.trim()) return;
    const item: ManagedPropertyItem = {
      id: `prop-${Date.now()}`,
      code: draft.code.trim().toUpperCase(),
      name: draft.name.trim(),
      city: draft.city.trim(),
      state: '',
      roomCount: draft.rooms,
      status: 'ONBOARDING',
      isCurrentProperty: false,
    };
    updateCategory('managedProperties', [...properties, item]);
    setDraft({ name: '', code: '', city: '', rooms: 20 });
    setAdding(false);
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        categoryId={C}
        id="properties"
        title="Properties"
        description="Hotels in your group."
        actions={
          <button type="button" onClick={() => setAdding(true)} className={buttonPrimary}>
            <Plus className="size-4" aria-hidden="true" /> Add property
          </button>
        }
      >
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((p) => (
            <li key={p.id} className={`space-y-2 rounded-lg border p-4 ${p.isCurrentProperty ? 'border-burgundy bg-gold-soft/20' : 'border-border bg-cream/40'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-ink">{p.code}</span>
                <div className="flex gap-1.5">
                  {p.isCurrentProperty && <StatusPill tone="warn">This property</StatusPill>}
                  <StatusPill tone={p.status === 'ACTIVE' ? 'ok' : p.status === 'ONBOARDING' ? 'warn' : 'off'}>{p.status.toLowerCase()}</StatusPill>
                </div>
              </div>
              <p className="text-sm font-semibold text-ink">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {[p.city, p.state].filter(Boolean).join(', ') || '—'} · {p.roomCount} rooms
              </p>
            </li>
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection categoryId={C} id="org-defaults" title="Group defaults" description="Every property starts with these. Property settings can override them if allowed below.">
        <FieldGrid>
          <Field label="Organization name">
            {(p) => <TextInput {...p} value={org.organizationName} onChange={(v) => setOrg({ organizationName: v })} />}
          </Field>
          <Field label="Default currency">
            {(p) => (
              <SelectInput
                {...p}
                value={org.defaultCurrency}
                onChange={(v) => setOrg({ defaultCurrency: v as OrganizationDefaultsConfig['defaultCurrency'] })}
                options={[
                  { value: 'INR', label: 'Indian rupee (₹)' },
                  { value: 'USD', label: 'US dollar ($)' },
                ]}
              />
            )}
          </Field>
          <Field label="Default time zone">
            {(p) => <TextInput {...p} value={org.defaultTimezone} onChange={(v) => setOrg({ defaultTimezone: v })} mono />}
          </Field>
        </FieldGrid>
        <ToggleGrid>
          <ToggleRow label="Properties can override group settings" checked={org.allowPropertySpecificOverrides} onChange={(v) => setOrg({ allowPropertySpecificOverrides: v })} />
          <ToggleRow label="One security policy for all properties" description="Sign-in and password rules are set once for the group." checked={org.centralizedSecurityPolicy} onChange={(v) => setOrg({ centralizedSecurityPolicy: v })} />
          <ToggleRow label="One messaging policy for all properties" checked={org.centralizedNotificationPolicy} onChange={(v) => setOrg({ centralizedNotificationPolicy: v })} />
          <ToggleRow label="Share corporate rate plans" description="Negotiated company rates apply at every property." checked={org.sharedCorporateRatePlans} onChange={(v) => setOrg({ sharedCorporateRatePlans: v })} />
          <ToggleRow label="Group dashboard" description="Combined occupancy and revenue across properties." checked={org.multiPropertyDashboardAccess} onChange={(v) => setOrg({ multiPropertyDashboardAccess: v })} />
        </ToggleGrid>
      </SettingsSection>

      <Modal isOpen={adding} onClose={() => setAdding(false)} title="Add property">
        <form onSubmit={submit} className="space-y-4">
          <FieldGrid cols={2}>
            <Field label="Property name" required span={2}>
              {(p) => <TextInput {...p} required value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />}
            </Field>
            <Field label="Property code" required>
              {(p) => <TextInput {...p} required value={draft.code} onChange={(v) => setDraft({ ...draft, code: v })} mono uppercase placeholder="DH-RSH" />}
            </Field>
            <Field label="Rooms">
              {(p) => <NumberInput {...p} min={1} value={draft.rooms} onChange={(v) => setDraft({ ...draft, rooms: v })} />}
            </Field>
            <Field label="City" span={2}>
              {(p) => <TextInput {...p} value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} />}
            </Field>
          </FieldGrid>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className={buttonSecondary}>
              Cancel
            </button>
            <button type="submit" className={buttonPrimary}>
              Add property
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

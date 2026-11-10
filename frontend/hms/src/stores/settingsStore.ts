import { create } from 'zustand';
import type {
  HMSSettingsData,
  SettingsCategoryId,
  TaxRuleItem,
  ChannelAdapterItem,
  MessageTemplateItem,
  BookingSourceItem,
  PaymentMethodItem,
  WebhookEndpointItem,
} from '../types/settings';
import { API_BASE_URL } from '../services/apiServices';
import { INITIAL_SETTINGS_DATA } from './settings/initialSettingsData';
import { usePmsUIStore } from './pmsUIStore';
import { applyFavicon } from '../utils/favicon';

// Re-export seed data for any consumer
export { INITIAL_SETTINGS_DATA };

// ============================================================================
// AUDIT EVENT LOG ENTRY (UI REPRESENTATION)
// ============================================================================
export interface AuditLogEvent {
  id: string;
  timestamp: string;
  category: string;
  actor: string;
  action: string;
  details: string;
  /** Settings keys that differed from the last save. */
  changedKeys?: string[];
}

// ============================================================================
// SETTINGS STORE INTERFACE
// ============================================================================
export interface SettingsStoreState {
  data: HMSSettingsData;
  initialData: HMSSettingsData;
  activeCategory: SettingsCategoryId;
  isDirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: string | null;
  errorMessage: string | null;
  auditTrail: AuditLogEvent[];

  // Navigation
  setActiveCategory: (cat: SettingsCategoryId) => void;

  // Load from API (call on mount)
  loadFromApi: () => Promise<void>;

  // Sync authoritative hotel business date
  setBusinessDate: (date: string) => void;

  // Generic category update
  updateCategory: <K extends keyof HMSSettingsData>(
    category: K,
    patch: Partial<HMSSettingsData[K]>
  ) => void;

  // Granular Sub-list Updaters
  addTaxRule: (rule: Omit<TaxRuleItem, 'id'>) => void;
  updateTaxRule: (id: string, patch: Partial<TaxRuleItem>) => void;
  deleteTaxRule: (id: string) => void;
  toggleTaxRule: (id: string) => void;

  updateChannel: (id: string, patch: Partial<ChannelAdapterItem>) => void;
  updateBookingSource: (id: string, patch: Partial<BookingSourceItem>) => void;
  updatePaymentMethod: (id: string, patch: Partial<PaymentMethodItem>) => void;
  updateMessageTemplate: (id: string, patch: Partial<MessageTemplateItem>) => void;
  addMessageTemplate: (template: Omit<MessageTemplateItem, 'id'>) => void;

  addWebhook: (webhook: Omit<WebhookEndpointItem, 'id'>) => void;
  updateWebhook: (id: string, patch: Partial<WebhookEndpointItem>) => void;
  deleteWebhook: (id: string) => void;

  // Form Lifecycle
  saveChanges: () => Promise<boolean>;
  revertChanges: () => void;
  clearNotification: () => void;
}

// Helper: build API headers
function apiHeaders(): Record<string, string> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('hms_token') : null;
  const propertyId =
    (typeof window !== 'undefined' && (window as any).__HMS_PROPERTY_ID__) || 'prop-jaipur-01';
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Property-Id': propertyId,
  };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

/** Two-level merge: stored sections override defaults field by field, arrays are replaced whole. */
function mergeSettings(base: HMSSettingsData, over: Partial<HMSSettingsData>): HMSSettingsData {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    const b = (base as unknown as Record<string, unknown>)[k];
    const isObj = (x: unknown) => !!x && typeof x === 'object' && !Array.isArray(x);
    out[k] = isObj(v) && isObj(b) ? { ...(b as object), ...(v as object) } : v;
  }
  return out as unknown as HMSSettingsData;
}
function getInitialSettings(): HMSSettingsData {
  const base = structuredClone(INITIAL_SETTINGS_DATA);
  try {
    const liveDate = usePmsUIStore.getState().businessDate;
    if (liveDate) {
      base.businessDate.currentBusinessDate = liveDate;
    }
  } catch {
    // Keep initial fallback
  }
  return base;
}

export const useSettingsStore = create<SettingsStoreState>((set, get) => ({
  data: getInitialSettings(),
  initialData: getInitialSettings(),
  activeCategory: 'property',
  isDirty: false,
  saveStatus: 'idle',
  lastSavedAt: null,
  errorMessage: null,
  auditTrail: [],
  setActiveCategory: (category) => set({ activeCategory: category }),

  setBusinessDate: (date: string) => {
    if (!date) return;
    set((state) => {
      if (state.data.businessDate?.currentBusinessDate === date) return state;
      return {
        data: {
          ...state.data,
          businessDate: {
            ...state.data.businessDate,
            currentBusinessDate: date,
          },
        },
        initialData: {
          ...state.initialData,
          businessDate: {
            ...state.initialData.businessDate,
            currentBusinessDate: date,
          },
        },
      };
    });
  },

  loadFromApi: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/settings`, { headers: apiHeaders() });
      if (!res.ok) return;
      const json = await res.json();
      const persisted: Partial<HMSSettingsData> = json.settings || {};
      const merged: HMSSettingsData = mergeSettings(structuredClone(INITIAL_SETTINGS_DATA), persisted);

      const authoritativeDate =
        json.current_business_date ||
        persisted.businessDate?.currentBusinessDate ||
        usePmsUIStore.getState().businessDate;

      if (authoritativeDate) {
        merged.businessDate = {
          ...merged.businessDate,
          currentBusinessDate: authoritativeDate,
        };
      }
      set({ data: merged, initialData: structuredClone(merged), isDirty: false });
      applyFavicon(merged.branding?.faviconUrl);
    } catch {
      // Non-fatal: keep defaults
    }
  },

  updateCategory: (category, patch) => {
    set((state) => {
      const currentSection = state.data[category];
      // Lists (taxRules, eventTriggers, managedProperties…) are replaced whole; spreading an array into an object would corrupt it.
      const updatedSection = Array.isArray(patch) ? patch : { ...currentSection, ...patch };
      return {
        data: {
          ...state.data,
          [category]: updatedSection,
        },
        isDirty: true,
        saveStatus: 'idle',
      };
    });
  },

  addTaxRule: (rule) => {
    set((state) => {
      const newRule: TaxRuleItem = {
        ...rule,
        id: `tax-${Date.now()}`,
      };
      return {
        data: {
          ...state.data,
          taxRules: [...state.data.taxRules, newRule],
        },
        isDirty: true,
        saveStatus: 'idle',
      };
    });
  },

  updateTaxRule: (id, patch) => {
    set((state) => ({
      data: {
        ...state.data,
        taxRules: state.data.taxRules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  deleteTaxRule: (id) => {
    set((state) => ({
      data: {
        ...state.data,
        taxRules: state.data.taxRules.filter((r) => r.id !== id),
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  toggleTaxRule: (id) => {
    set((state) => ({
      data: {
        ...state.data,
        taxRules: state.data.taxRules.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  updateChannel: (id, patch) => {
    set((state) => ({
      data: {
        ...state.data,
        channels: state.data.channels.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  updateBookingSource: (id, patch) => {
    set((state) => ({
      data: {
        ...state.data,
        bookingSources: state.data.bookingSources.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  updatePaymentMethod: (id, patch) => {
    set((state) => ({
      data: {
        ...state.data,
        paymentMethods: state.data.paymentMethods.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  updateMessageTemplate: (id, patch) => {
    set((state) => ({
      data: {
        ...state.data,
        messageTemplates: state.data.messageTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  addMessageTemplate: (template) => {
    set((state) => ({
      data: {
        ...state.data,
        messageTemplates: [...state.data.messageTemplates, { ...template, id: `tmpl-${Date.now()}` }],
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  addWebhook: (webhook) => {
    set((state) => ({
      data: {
        ...state.data,
        webhooks: [...state.data.webhooks, { ...webhook, id: `wh-${Date.now()}` }],
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  updateWebhook: (id, patch) => {
    set((state) => ({
      data: {
        ...state.data,
        webhooks: state.data.webhooks.map((w) => (w.id === id ? { ...w, ...patch } : w)),
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  deleteWebhook: (id) => {
    set((state) => ({
      data: {
        ...state.data,
        webhooks: state.data.webhooks.filter((w) => w.id !== id),
      },
      isDirty: true,
      saveStatus: 'idle',
    }));
  },

  saveChanges: async () => {
    const { data, initialData, activeCategory } = get();
    set({ saveStatus: 'saving', errorMessage: null });

    try {
      const res = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({ settings: data }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(typeof errData.detail === 'string' ? errData.detail : `Save failed (${res.status})`);
      }

      const now = new Date().toLocaleTimeString('en-IN', { hour12: true });
      const changedKeys = (Object.keys(data) as (keyof HMSSettingsData)[]).filter(
        (k) => JSON.stringify(data[k]) !== JSON.stringify(initialData[k])
      );
      const newAudit: AuditLogEvent = {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toLocaleString('en-IN'),
        category: activeCategory,
        actor: 'Current User',
        action: 'CONFIGURATION_UPDATED',
        details: changedKeys.length ? `Changed: ${changedKeys.join(', ')}` : 'Saved with no changes',
        changedKeys,
      };

      set((state) => ({
        initialData: structuredClone(data),
        isDirty: false,
        saveStatus: 'saved',
        lastSavedAt: now,
        auditTrail: [newAudit, ...state.auditTrail.slice(0, 19)],
      }));
      applyFavicon(data.branding?.faviconUrl);

      return true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings to server.';
      set({ saveStatus: 'error', errorMessage: message });
      return false;
    }
  },

  revertChanges: () => {
    const { initialData } = get();
    set({
      data: structuredClone(initialData),
      isDirty: false,
      saveStatus: 'idle',
      errorMessage: null,
    });
  },

  clearNotification: () => {
    set({ saveStatus: 'idle', errorMessage: null });
  },
}));

// ============================================================================
// ISOLATED DOMAIN STORE HOOKS (Targeted Slices for performance & clean imports)
// ============================================================================

/** Isolated Tax & Rate slice hook */
export const useTaxStore = () => {
  return useSettingsStore((s) => ({
    taxRules: s.data.taxRules,
    rateEngine: s.data.rateEngine,
    folio: s.data.folio,
    invoice: s.data.invoice,
    isDirty: s.isDirty,
    addTaxRule: s.addTaxRule,
    updateTaxRule: s.updateTaxRule,
    deleteTaxRule: s.deleteTaxRule,
    toggleTaxRule: s.toggleTaxRule,
    updateCategory: s.updateCategory,
  }));
};

/** Isolated Channels & Distribution slice hook */
export const useChannelStore = () => {
  return useSettingsStore((s) => ({
    channels: s.data.channels,
    bookingSources: s.data.bookingSources,
    directBookingEngine: s.data.directBookingEngine,
    websiteApi: s.data.websiteApi,
    isDirty: s.isDirty,
    updateChannel: s.updateChannel,
    updateBookingSource: s.updateBookingSource,
    updateCategory: s.updateCategory,
  }));
};

/** Isolated Operations & Policies slice hook */
export const useOperationsStore = () => {
  return useSettingsStore((s) => ({
    stayTimes: s.data.stayTimes,
    businessDate: s.data.businessDate,
    stayPolicies: s.data.stayPolicies,
    inventoryRules: s.data.inventoryRules,
    overbooking: s.data.overbooking,
    isDirty: s.isDirty,
    updateCategory: s.updateCategory,
  }));
};

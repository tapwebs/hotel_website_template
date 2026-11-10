import React, { useState } from 'react';
import { X, ShieldAlert, Check } from 'lucide-react';
import type { TaxRuleItem } from '../../../../types/settings';

interface TaxRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Omit<TaxRuleItem, 'id'> | TaxRuleItem) => void;
  initialRule?: TaxRuleItem | null;
}

export const TaxRuleModal: React.FC<TaxRuleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRule,
}) => {
  const [formData, setFormData] = useState<Omit<TaxRuleItem, 'id'>>({
    taxName: initialRule?.taxName || '',
    sacHsn: initialRule?.sacHsn || '996311',
    serviceCategory: initialRule?.serviceCategory || 'ACCOMMODATION',
    taxType: initialRule?.taxType || 'GST_SLAB',
    cgstRate: initialRule?.cgstRate ?? 6,
    sgstRate: initialRule?.sgstRate ?? 6,
    igstRate: initialRule?.igstRate ?? 12,
    effectiveFrom: initialRule?.effectiveFrom || '2024-04-01',
    effectiveUntil: initialRule?.effectiveUntil || '2027-03-31',
    inclusive: initialRule?.inclusive ?? false,
    active: initialRule?.active ?? true,
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  if (!isOpen) return null;

  const validate = () => {
    const errs: { [key: string]: string } = {};
    if (!formData.taxName.trim()) errs.taxName = 'Tax rule name is required.';
    if (!formData.sacHsn.trim()) errs.sacHsn = 'SAC/HSN code is required (e.g. 996311).';
    if (formData.cgstRate < 0 || formData.sgstRate < 0) {
      errs.rates = 'Tax rates cannot be negative.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    if (initialRule) {
      onSave({ ...formData, id: initialRule.id });
    } else {
      onSave(formData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-ivory border border-border rounded-xl shadow-2xl w-full max-w-xl text-ink overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-ivory">
          <div>
            <h3 className="text-lg font-semibold text-ink">
              {initialRule ? 'Edit Tax Rule / SAC Definition' : 'Add New Tax Rule'}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Indian GST & Statutory Service Accounting Code (SAC) Rule
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Rule Display Name *</label>
            <input
              type="text"
              value={formData.taxName}
              onChange={(e) => setFormData({ ...formData, taxName: e.target.value })}
              placeholder="e.g. Room Tariff Luxury Slab (> ₹7,500)"
              className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
            />
            {errors.taxName && <p className="text-xs text-rose-600">{errors.taxName}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">SAC / HSN Code *</label>
              <input
                type="text"
                value={formData.sacHsn}
                onChange={(e) => setFormData({ ...formData, sacHsn: e.target.value })}
                placeholder="996311"
                className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
              />
              {errors.sacHsn && <p className="text-xs text-rose-600">{errors.sacHsn}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Service Category</label>
              <select
                value={formData.serviceCategory}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    serviceCategory: e.target.value as TaxRuleItem['serviceCategory'],
                  })
                }
                className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-burgundy focus:ring-1 focus:ring-burgundy"
              >
                <option value="ACCOMMODATION">Accommodation / Room Tariff</option>
                <option value="FOOD_AND_BEVERAGE">Food & Beverage (F&B)</option>
                <option value="BANQUET">Banquet / Conference Hall</option>
                <option value="SPA_WELLNESS">Spa & Ayurvedic Wellness</option>
                <option value="LAUNDRY">Laundry & Dry Cleaning</option>
                <option value="TRANSPORT">Guest Transport / Chauffeur</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 bg-ivory p-3 rounded-lg border border-border">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">CGST Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.cgstRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setFormData({
                    ...formData,
                    cgstRate: val,
                    sgstRate: val,
                    igstRate: val * 2,
                  });
                }}
                className="w-full bg-ivory border border-input rounded px-2.5 py-1.5 text-sm text-ink font-mono focus:outline-none focus:border-burgundy"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">SGST Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.sgstRate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setFormData({
                    ...formData,
                    sgstRate: val,
                    cgstRate: val,
                    igstRate: val * 2,
                  });
                }}
                className="w-full bg-ivory border border-input rounded px-2.5 py-1.5 text-sm text-ink font-mono focus:outline-none focus:border-burgundy"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">IGST Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.igstRate}
                onChange={(e) =>
                  setFormData({ ...formData, igstRate: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-ivory border border-input rounded px-2.5 py-1.5 text-sm text-ink font-mono focus:outline-none focus:border-burgundy"
              />
            </div>
          </div>
          {errors.rates && <p className="text-xs text-rose-600">{errors.rates}</p>}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Effective From</label>
              <input
                type="date"
                value={formData.effectiveFrom}
                onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-burgundy"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Effective Until</label>
              <input
                type="date"
                value={formData.effectiveUntil}
                onChange={(e) => setFormData({ ...formData, effectiveUntil: e.target.value })}
                className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-burgundy"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.inclusive}
                onChange={(e) => setFormData({ ...formData, inclusive: e.target.checked })}
                className="w-4 h-4 rounded text-burgundy accent-burgundy border-input focus:ring-burgundy"
              />
              <span className="text-xs text-slate-700 font-medium">Tax Inclusive in Rack Rate</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.active}
                onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                className="w-4 h-4 rounded text-burgundy accent-burgundy border-input focus:ring-burgundy"
              />
              <span className="text-xs text-slate-700 font-medium">Active / Enforced</span>
            </label>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 leading-relaxed">
              [STATUTORY NOTICE] Tax rates represent configurable reference rules. Any alterations
              are logged to the system audit trail with user and timestamp.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-ink bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy hover:bg-burgundy-deep rounded-lg transition shadow-md shadow-amber-950/20 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {initialRule ? 'Save Changes' : 'Create Tax Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

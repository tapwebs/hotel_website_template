import React, { useState } from 'react';
import { X, Check, Code, Mail, MessageSquare } from 'lucide-react';
import type { MessageTemplateItem } from '../../../../types/settings';

interface TemplateModalProps {
  isOpen: boolean;
  template: MessageTemplateItem | null;
  onClose: () => void;
  onSave: (template: Omit<MessageTemplateItem, 'id'> | MessageTemplateItem) => void;
}

export const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  template,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState<Omit<MessageTemplateItem, 'id'>>({
    name: template?.name || '',
    channel: template?.channel || 'EMAIL',
    eventType: template?.eventType || 'EVT_BOOKING_CONFIRMED',
    subjectTemplate: template?.subjectTemplate || '',
    bodyContent: template?.bodyContent || '',
    isActive: template?.isActive ?? true,
    supportedPlaceholders: template?.supportedPlaceholders || [
      '{{guest_name}}',
      '{{confirmation_code}}',
      '{{check_in_date}}',
      '{{check_out_date}}',
      '{{room_category}}',
      '{{hotel_name}}',
    ],
  });

  if (!isOpen) return null;

  const handleInsertTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      bodyContent: prev.bodyContent + ` ${tag} `,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.bodyContent.trim()) return;

    if (template) {
      onSave({ ...formData, id: template.id });
    } else {
      onSave(formData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-ivory border border-border rounded-xl shadow-2xl w-full max-w-2xl text-ink overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-ivory">
          <div className="flex items-center gap-2.5">
            {formData.channel === 'EMAIL' ? (
              <Mail className="w-5 h-5 text-burgundy" />
            ) : (
              <MessageSquare className="w-5 h-5 text-burgundy" />
            )}
            <div>
              <h3 className="text-lg font-semibold text-ink">
                {template ? 'Edit Notification Template' : 'Create Notification Template'}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automated guest communication content and merge tags
              </p>
            </div>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Template Title *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. VIP Pre-Arrival Concierge"
                className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-burgundy"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Delivery Channel</label>
              <select
                value={formData.channel}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    channel: e.target.value as MessageTemplateItem['channel'],
                  })
                }
                className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-burgundy"
              >
                <option value="EMAIL">Email (HTML & Plain Text)</option>
                <option value="WHATSAPP">WhatsApp Business HSM</option>
                <option value="SMS">DLT Registered SMS</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700">Trigger Event Lifecycle</label>
            <select
              value={formData.eventType}
              onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
              className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-burgundy"
            >
              <option value="EVT_BOOKING_CONFIRMED">Booking Confirmed</option>
              <option value="EVT_BOOKING_MODIFIED">Booking Modified</option>
              <option value="EVT_BOOKING_CANCELLED">Booking Cancelled</option>
              <option value="EVT_PRE_ARRIVAL">Pre-Arrival Reminder (48h prior)</option>
              <option value="EVT_PAYMENT_RECEIPT">Payment / Deposit Receipt</option>
              <option value="EVT_TAX_INVOICE">Tax Invoice PDF Delivery</option>
            </select>
          </div>

          {formData.channel === 'EMAIL' && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Email Subject Line</label>
              <input
                type="text"
                value={formData.subjectTemplate}
                onChange={(e) => setFormData({ ...formData, subjectTemplate: e.target.value })}
                placeholder="e.g. Your Stay at Jaipur Palace is Confirmed — {{confirmation_code}}"
                className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-burgundy"
              />
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700">Message Content Body *</label>
              <span className="text-[11px] text-muted-foreground">Click merge tags below to insert</span>
            </div>
            <textarea
              rows={6}
              value={formData.bodyContent}
              onChange={(e) => setFormData({ ...formData, bodyContent: e.target.value })}
              placeholder="Enter message template..."
              className="w-full bg-ivory border border-input rounded-lg p-3 text-sm text-ink font-mono focus:outline-none focus:border-burgundy leading-relaxed"
            />
          </div>

          {/* Merge Tags Quick Selector */}
          <div className="space-y-1.5 bg-ivory p-3 rounded-lg border border-border">
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
              <Code className="w-3.5 h-3.5 text-burgundy" />
              <span>Available Dynamic Placeholders:</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {formData.supportedPlaceholders.map((ph: string) => (
                <button
                  key={ph}
                  type="button"
                  onClick={() => handleInsertTag(ph)}
                  className="px-2 py-1 bg-gold-soft/30 hover:bg-gold-soft/40 border border-burgundy/30 rounded text-[11px] font-mono text-burgundy transition cursor-pointer"
                >
                  {ph}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-border">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 rounded text-burgundy accent-burgundy border-input focus:ring-burgundy"
              />
              <span className="text-xs text-slate-700 font-medium">Template Active</span>
            </label>

            <div className="flex gap-2">
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
                {template ? 'Save Template' : 'Create Template'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

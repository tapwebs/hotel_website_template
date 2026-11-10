import React from 'react';
import { FileSpreadsheet, Plus, Edit2, Trash2 } from 'lucide-react';
import type { TaxRuleItem } from '../../../../types/settings';

interface GstSlabTableProps {
  taxRules: TaxRuleItem[];
  onAdd: () => void;
  onEdit: (rule: TaxRuleItem) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

export const GstSlabTable: React.FC<GstSlabTableProps> = React.memo(
  ({ taxRules, onAdd, onEdit, onDelete, onToggle }) => {
    return (
      <div className="bg-ivory border border-border shadow-2xs rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-border flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-burgundy" />
            <div>
              <h3 className="text-base font-semibold text-ink">Statutory Tax Rules &amp; SAC Codes</h3>
              <p className="text-xs text-muted-foreground">
                Configurable Indian GST &amp; SAC rates. Edit slabs, toggle activation, or define new service rules.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-burgundy hover:bg-burgundy-deep rounded-lg transition shadow-md shadow-amber-950/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Tax Rule
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-ivory text-slate-600 font-semibold uppercase tracking-wider border-b border-border">
              <tr>
                <th className="py-3 px-4">SAC / HSN</th>
                <th className="py-3 px-4">Tax Rule Name</th>
                <th className="py-3 px-4">Service Category</th>
                <th className="py-3 px-4">CGST / SGST</th>
                <th className="py-3 px-4">IGST</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-ink">
              {taxRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-mono font-bold text-ink">{rule.sacHsn}</td>
                  <td className="py-3 px-4 font-medium text-ink">
                    <div>{rule.taxName}</div>
                    <span className="text-[10px] text-muted-foreground">
                      Effective: {rule.effectiveFrom} to {rule.effectiveUntil}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-ivory text-slate-700 border border-border">
                      {rule.serviceCategory.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {rule.cgstRate}% + {rule.sgstRate}%
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold text-slate-700">{rule.igstRate}%</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => onToggle(rule.id)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                        rule.active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {rule.active ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(rule)}
                        className="p-1 rounded text-slate-500 hover:text-ink hover:bg-slate-200/60 transition cursor-pointer"
                        title="Edit Tax Rule"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(rule.id)}
                        className="p-1 rounded text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete Tax Rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
);

GstSlabTable.displayName = 'GstSlabTable';

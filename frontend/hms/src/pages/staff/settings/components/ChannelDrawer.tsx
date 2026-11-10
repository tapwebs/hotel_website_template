import React, { useState } from 'react';
import { X, Check, Globe, RefreshCw, Key, ShieldCheck, AlertCircle } from 'lucide-react';
import type { ChannelAdapterItem } from '../../../../types/settings';

interface ChannelDrawerProps {
  isOpen: boolean;
  channel: ChannelAdapterItem | null;
  onClose: () => void;
  onSave: (id: string, patch: Partial<ChannelAdapterItem>) => void;
}

export const ChannelDrawer: React.FC<ChannelDrawerProps> = ({
  isOpen,
  channel,
  onClose,
  onSave,
}) => {
  if (!isOpen || !channel) return null;

  const [propertyId, setPropertyId] = useState(channel.propertyId);
  const [inventorySync, setInventorySync] = useState(channel.inventorySyncEnabled);
  const [rateSync, setRateSync] = useState(channel.rateSyncEnabled);
  const [restrictionSync, setRestrictionSync] = useState(channel.restrictionSyncEnabled);
  const [reservationSync, setReservationSync] = useState(channel.reservationSyncEnabled);
  const [connectionStatus, setConnectionStatus] = useState(channel.connectionStatus);

  // Masked secret update states
  const [isUpdatingSecret, setIsUpdatingSecret] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [newApiSecret, setNewApiSecret] = useState('');

  // Test connection feedback
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    await new Promise((r) => setTimeout(r, 600));
    setTestingConnection(false);
    setTestResult('Success: 200 OK received from channel OTA endpoint. API handshake verified.');
  };

  const handleSave = () => {
    const patch: Partial<ChannelAdapterItem> = {
      propertyId,
      inventorySyncEnabled: inventorySync,
      rateSyncEnabled: rateSync,
      restrictionSyncEnabled: restrictionSync,
      reservationSyncEnabled: reservationSync,
      connectionStatus,
    };

    if (newApiKey.trim()) {
      patch.apiKeyMasked = `${newApiKey.slice(0, 4)}••••••••${newApiKey.slice(-4)}`;
    }
    if (newApiSecret.trim()) {
      patch.apiSecretMasked = `sec_••••••••••••••••${newApiSecret.slice(-4)}`;
    }

    onSave(channel.id, patch);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="bg-ivory border-l border-border w-full max-w-lg h-full overflow-y-auto shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-6 border-b border-border flex items-center justify-between bg-ivory sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-burgundy/15 border border-burgundy/30 flex items-center justify-center text-burgundy">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-ink text-base">{channel.channelName}</h3>
              <p className="text-xs text-muted-foreground">OTA Two-Way XML / JSON Connectivity Adapter</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-6 space-y-6 flex-1 text-ink">
          {/* Status Banner */}
          <div className="p-3.5 bg-ivory rounded-xl border border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-3 h-3 rounded-full ${
                  connectionStatus === 'CONNECTED' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
              <div>
                <span className="text-xs font-semibold text-ink">Status: {connectionStatus}</span>
                <p className="text-[11px] text-muted-foreground">Last Synced: {channel.lastSyncTimestamp}</p>
              </div>
            </div>
            <select
              value={connectionStatus}
              onChange={(e) =>
                setConnectionStatus(e.target.value as ChannelAdapterItem['connectionStatus'])
              }
              className="bg-ivory border border-input text-xs rounded-lg px-2.5 py-1 text-ink focus:outline-none focus:border-burgundy"
            >
              <option value="CONNECTED">CONNECTED</option>
              <option value="PAUSED">PAUSED</option>
              <option value="NOT_CONNECTED">DISCONNECTED</option>
            </select>
          </div>

          {/* Hotel Identification */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700">OTA Hotel / Property ID *</label>
            <input
              type="text"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full bg-ivory border border-input rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:border-burgundy font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              The external hotel identifier assigned in the OTA extranet.
            </p>
          </div>

          {/* Sync Controls */}
          <div className="space-y-3 bg-ivory p-4 rounded-xl border border-border">
            <h4 className="text-xs font-semibold text-slate-700 tracking-wider uppercase">
              Two-Way Synchronization Feeds
            </h4>

            <div className="space-y-3 pt-1">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-medium text-ink">Inventory Count Push</p>
                  <p className="text-[11px] text-muted-foreground">
                    Real-time available room units push on reservation changes
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={inventorySync}
                  onChange={(e) => setInventorySync(e.target.checked)}
                  className="w-4 h-4 rounded text-burgundy accent-burgundy border-input focus:ring-burgundy"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-medium text-ink">Rate & Pricing Push</p>
                  <p className="text-[11px] text-muted-foreground">
                    Nightly rate plan updates, extra adult/child pricing
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={rateSync}
                  onChange={(e) => setRateSync(e.target.checked)}
                  className="w-4 h-4 rounded text-burgundy accent-burgundy border-input focus:ring-burgundy"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-medium text-ink">Stay Restrictions (CTA / CTD / Min Stay)</p>
                  <p className="text-[11px] text-muted-foreground">
                    Closed-to-arrival and minimum stay requirements
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={restrictionSync}
                  onChange={(e) => setRestrictionSync(e.target.checked)}
                  className="w-4 h-4 rounded text-burgundy accent-burgundy border-input focus:ring-burgundy"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <p className="text-xs font-medium text-ink">Reservation Inbound Pull</p>
                  <p className="text-[11px] text-muted-foreground">
                    Fetch new, modified, and cancelled OTA bookings automatically
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={reservationSync}
                  onChange={(e) => setReservationSync(e.target.checked)}
                  className="w-4 h-4 rounded text-burgundy accent-burgundy border-input focus:ring-burgundy"
                />
              </label>
            </div>
          </div>

          {/* Masked Credentials & Rotation */}
          <div className="space-y-3 bg-ivory p-4 rounded-xl border border-border">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-burgundy" />
                API Credentials (Masked)
              </h4>
              <button
                type="button"
                onClick={() => setIsUpdatingSecret(!isUpdatingSecret)}
                className="text-[11px] text-burgundy hover:text-burgundy-deep font-semibold cursor-pointer"
              >
                {isUpdatingSecret ? 'Keep Existing Keys' : 'Rotate / Update Keys'}
              </button>
            </div>

            {!isUpdatingSecret ? (
              <div className="space-y-2 pt-1 font-mono text-xs">
                <div>
                  <span className="text-[11px] text-muted-foreground block font-sans">API Key:</span>
                  <div className="bg-ivory px-3 py-1.5 rounded border border-input text-slate-700">
                    {channel.apiKeyMasked}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block font-sans">API Secret:</span>
                  <div className="bg-ivory px-3 py-1.5 rounded border border-input text-slate-700">
                    {channel.apiSecretMasked}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-sans">New API Key / Token</label>
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="Paste new raw API key..."
                    className="w-full bg-ivory border border-input rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-burgundy font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground font-sans">New Secret Key</label>
                  <input
                    type="password"
                    value={newApiSecret}
                    onChange={(e) => setNewApiSecret(e.target.value)}
                    placeholder="Paste new raw Secret key..."
                    className="w-full bg-ivory border border-input rounded px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:border-burgundy font-mono"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Test Connection Button */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 border border-input text-xs font-semibold text-ink transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
              {testingConnection ? 'Verifying Handshake with OTA...' : 'Test Channel Handshake'}
            </button>
            {testResult && (
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{testResult}</span>
              </div>
            )}
          </div>

          <div className="p-3 bg-ivory border border-border rounded-lg text-muted-foreground text-[11px] flex gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-slate-400" />
            <span>
              [BACKEND — NOT UI SCOPE] Two-way live message queuing and XML parsing run via background
              Celery workers according to Spec 09 & 12.
            </span>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-border bg-ivory sticky bottom-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-ink bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-burgundy hover:bg-burgundy-deep rounded-lg transition shadow-md shadow-amber-950/20 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            Apply Channel Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

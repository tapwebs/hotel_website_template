import { useMemo, useState } from 'react'
import { Eye, EyeOff, Plus, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Input } from '@/site/features/qrhub/components/ui/input'
import { BulkBar } from '@/site/features/qrhub/components/BulkBar'
import { PlacementForms } from '@/site/features/qrhub/components/PlacementForms'
import { QrCard } from '@/site/features/qrhub/components/QrCard'
import { Card, Empty, Notice, PageHeader } from '@/site/features/qrhub/components/common'
import { api } from '@/site/features/qrhub/lib/api'
import { HOTEL_SLUG } from '@/site/features/qrhub/lib/paths'
import { useSelection } from '@/site/features/qrhub/lib/useSelection'
import { useLoad } from '@/site/features/qrhub/lib/useLoad'
import { cn, errMsg } from '@/site/features/qrhub/lib/utils'

/** Every QR the hotel can print: the master QR plus all active placement QRs (rooms, tables, lobby…). */
export function Component() {
  const { data: ws, error, reload } = useLoad(() => api.getWorkspace(HOTEL_SLUG), [])
  const sel = useSelection()
  const [adding, setAdding] = useState(false)
  const [actionErr, setActionErr] = useState('')
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('all')
  const [showOff, setShowOff] = useState(false)

  const placements = useMemo(() => ws?.placements ?? [], [ws])
  const active = placements.filter((p) => p.status === 'active')
  const kinds = useMemo(() => ['all', ...Array.from(new Set(active.map((p) => p.kind)))], [active])
  const term = q.trim().toLowerCase()
  const shown = (showOff ? placements : active)
    .filter((p) => kind === 'all' || p.kind === kind)
    .filter((p) => !term || `${p.label} ${p.code}`.toLowerCase().includes(term))
  const bulk = async (action: 'enable' | 'disable' | 'delete') => {
    if (action === 'delete' && !window.confirm(`Delete ${sel.ids.size} QR code(s)? Printed copies will open the main hotel page instead.`)) return
    try {
      setActionErr('')
      await api.bulk('placements', sel.list, action)
      sel.clear()
      reload()
    } catch (e) {
      setActionErr(errMsg(e))
    }
  }
  const org = ws ? { slug: ws.organization.slug, name: ws.organization.name, logo: ws.organization.logo } : null
  const qrStatus = ws?.organization?.qr_status ?? (ws?.organization as unknown as { qrStatus?: string })?.qrStatus ?? 'draft'
  const hubOff = ws && qrStatus !== 'active'

  return (
    <>
      <PageHeader
        title="QR library"
        subtitle={ws ? `${active.length} active ${active.length === 1 ? 'QR' : 'QRs'} for rooms and places, plus the master QR.` : 'All QR codes.'}
        actions={
          <Button onClick={() => setAdding((v) => !v)} aria-expanded={adding}>
            {adding ? <X /> : <Plus />} {adding ? 'Close' : 'New QR'}
          </Button>
        }
      />
      {error && <Notice kind="error">{error}</Notice>}
      {hubOff && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-900">
          <span>The hotel hub is <strong>{qrStatus || 'inactive'}</strong>, so scans open the “unavailable” page until you set it to Active.</span>
          <Button
            size="sm"
            variant="gold"
            onClick={async () => {
              try {
                setActionErr('')
                await api.setQrStatus(ws.organization.slug, 'active')
                reload()
              } catch (e) {
                setActionErr(errMsg(e))
              }
            }}
          >
            Set to Active
          </Button>
        </div>
      )}
      {adding && ws && (
        <div className="mb-6">
          <PlacementForms slug={ws.organization.slug} reload={reload} />
        </div>
      )}
      {actionErr && <Notice kind="error">{actionErr}</Notice>}
      {!ws && !error && (
        <div role="status" aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <span className="sr-only">Loading QR codes…</span>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          ))}
        </div>
      )}
      {ws && org && (
        <div className="grid gap-8">
          <section aria-labelledby="master">
            <h2 id="master" className="mb-3 text-h3 text-burgundy">
              Master QR
            </h2>
            <div className="max-w-sm">
              <QrCard org={org} />
            </div>
          </section>

          <section aria-labelledby="places">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 id="places" className="text-h3 text-burgundy">
                Placement QRs <span className="text-base text-muted-foreground">({shown.length})</span>
              </h2>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search room or place" aria-label="Search QR codes" className="w-56 pl-9" />
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm text-walnut">
                  <input type="checkbox" className="size-4 accent-burgundy" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} />
                  Show disabled
                </label>
              </div>
            </div>
            {kinds.length > 2 && (
              <div role="group" aria-label="Filter by kind" className="mb-4 flex flex-wrap gap-2">
                {kinds.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kind === k}
                    onClick={() => setKind(k)}
                    className={cn(
                      'min-h-9 rounded-full border px-3 text-sm font-semibold capitalize transition-colors',
                      kind === k ? 'border-burgundy bg-burgundy text-ivory' : 'border-border bg-card text-walnut hover:border-burgundy',
                    )}
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
            {placements.length === 0 ? (
              <Empty>No placement QRs yet. Use New QR to add a room number or place name.</Empty>
            ) : shown.length === 0 ? (
              <Card className="text-center text-sm text-muted-foreground">No QR codes match.</Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {shown.map((p) => (
                  <div key={p.id} className={cn('relative', p.status !== 'active' && 'opacity-60')}>
                    <label className="absolute top-3 left-3 z-10 grid size-8 cursor-pointer place-items-center rounded-md bg-card/90 shadow-xs">
                      <input type="checkbox" className="size-5 accent-burgundy" checked={sel.has(p.id)} onChange={() => sel.toggle(p.id)} aria-label={`Select ${p.label}`} />
                    </label>
                    <QrCard org={org} placement={p} compact />
                    {p.status !== 'active' && <p className="mt-1 text-center text-xs font-semibold text-destructive">Disabled</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
      <BulkBar count={sel.ids.size} onClear={sel.clear}>
        <Button size="sm" variant="gold" onClick={() => void bulk('enable')}>
          <Eye /> Enable
        </Button>
        <Button size="sm" variant="gold" onClick={() => void bulk('disable')}>
          <EyeOff /> Disable
        </Button>
        <Button size="sm" variant="destructive" onClick={() => void bulk('delete')}>
          <Trash2 /> Delete
        </Button>
      </BulkBar>
    </>
  )
}

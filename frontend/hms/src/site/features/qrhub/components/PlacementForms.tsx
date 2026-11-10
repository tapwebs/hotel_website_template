import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Field, Select } from '@/site/features/qrhub/components/ui/field'
import { Input } from '@/site/features/qrhub/components/ui/input'
import { Card, Notice } from '@/site/features/qrhub/components/common'
import { api } from '@/site/features/qrhub/lib/api'
import { placementCode, randomSuffix } from '@/site/features/qrhub/lib/slug'
import { PLACEMENT_KINDS, type PlacementKind } from '@/site/features/qrhub/lib/types'
import { errMsg } from '@/site/features/qrhub/lib/utils'
import { MAX_RANGE, rangePreview } from '@/site/features/qrhub/lib/range'

/** Forms to create QR codes: one place by name or room number, or a whole range of rooms. Codes get a random ending. */
export function PlacementForms({ slug, reload }: { slug: string; reload: () => void }) {
  const [err, setErr] = useState('')
  const [one, setOne] = useState<{ label: string; suffix: string; kind: PlacementKind }>(() => ({ label: '', suffix: randomSuffix(), kind: 'other' }))
  const code = placementCode(one.label, one.suffix)
  const [range, setRange] = useState({ kind: 'room' as PlacementKind, prefix: 'room-', labelPrefix: 'Room', from: 101, to: 110 })
  const preview = rangePreview(range)

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr('')
      await fn()
      reload()
    } catch (e) {
      setErr(errMsg(e))
    }
  }
  const [done, setDone] = useState('')
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Card className="grid content-start gap-3">
        <h2 className="text-h3 text-burgundy">Room QRs for every hotel room</h2>
        <p className="text-sm text-muted-foreground">
          Adds one secure QR per room with a cryptographically secure token. The hub shows “You scanned: Room 101” and its Order Food button opens that room’s dining link. Rooms that already have a QR are skipped, so this is safe to repeat.
        </p>
        <Button onClick={() => run(async () => {
          const preview = await api.syncRoomPlacements(slug, true)
          const names = preview.wouldCreate ?? []
          if (!names.length) return setDone(`Nothing to add: all ${preview.existing} rooms already have a QR.`)
          if (!window.confirm(`Add ${names.length} room QR${names.length === 1 ? '' : 's'}?\n\n${names.join(', ')}`)) return
          const r = await api.syncRoomPlacements(slug)
          setDone(`Added ${r.created.length}, ${r.existing} already existed.`)
        })}>
          <Plus /> Add room QRs
        </Button>
        {done && <Notice kind="success">{done}</Notice>}
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid content-start gap-3">
          <h2 className="text-h3 text-burgundy">Add one QR (room number or place name)</h2>
          <Field label="Label" hint="Shown on the hub and the printed QR, e.g. “Restaurant Table 5”.">
            {(id) => (
              <Input
                id={id}
                value={one.label}
                onChange={(e) => setOne((o) => ({ ...o, label: e.target.value }))}
              />
            )}
          </Field>
          <Field label="Code" hint="Made from the label plus random letters, so each QR is easy to recognise but cannot be guessed. Printed QRs never change.">
            {(id) => (
              <div className="flex gap-2">
                <Input id={id} value={code} readOnly className="font-mono" />
                <Button type="button" variant="outline" size="icon" aria-label="Generate a new random code" onClick={() => setOne((o) => ({ ...o, suffix: randomSuffix() }))}>
                  <RefreshCw />
                </Button>
              </div>
            )}
          </Field>
          <Field label="Kind">
            {(id) => (
              <Select id={id} value={one.kind} onChange={(e) => setOne((o) => ({ ...o, kind: e.target.value as PlacementKind }))}>
                {PLACEMENT_KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Select>
            )}
          </Field>
          <Button
            disabled={!one.label.trim()}
            onClick={() =>
              run(async () => {
                await api.addPlacement(slug, { label: one.label.trim(), code, kind: one.kind })
                setOne({ label: '', suffix: randomSuffix(), kind: 'other' })
              })
            }
          >
            <Plus /> Add placement
          </Button>
        </Card>
        <Card className="grid content-start gap-3">
          <h2 className="text-h3 text-burgundy">Create a range of rooms</h2>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind">
              {(id) => (
                <Select id={id} value={range.kind} onChange={(e) => setRange({ ...range, kind: e.target.value as PlacementKind })}>
                  {PLACEMENT_KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Label prefix">
              {(id) => <Input id={id} value={range.labelPrefix} onChange={(e) => setRange({ ...range, labelPrefix: e.target.value })} />}
            </Field>
            <Field label="Code prefix" hint="A random suffix is added to every code.">
              {(id) => (
                <Input id={id} value={range.prefix} onChange={(e) => setRange({ ...range, prefix: e.target.value.toLowerCase() })} />
              )}
            </Field>
            <span />
            <Field label="From">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={range.from}
                  onChange={(e) => setRange({ ...range, from: Number(e.target.value) })}
                />
              )}
            </Field>
            <Field label="To">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min={0}
                  value={range.to}
                  onChange={(e) => setRange({ ...range, to: Number(e.target.value) })}
                />
              )}
            </Field>
          </div>
          <p className="text-sm text-muted-foreground">
            {preview ? `Creates ${preview.count}: ${preview.text}-••••••• (random ending)` : `Enter a valid range of at most ${MAX_RANGE}.`}
          </p>
          <Button disabled={!preview || !range.prefix} onClick={() => run(() => api.bulkPlacements(slug, { ...range, prefix: range.prefix.replace(/-+$/, ''), random: true }))}>
            <Plus /> Create {preview?.count ?? ''} placements
          </Button>
        </Card>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
    </div>
  )
}

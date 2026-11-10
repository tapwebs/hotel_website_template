import { useState } from 'react'
import { ArrowDown, ArrowUp, Clock, EyeOff, Eye, ListPlus, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Checkbox, Field, Select } from '@/site/features/qrhub/components/ui/field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/site/features/qrhub/components/ui/dialog'
import { Input } from '@/site/features/qrhub/components/ui/input'
import { Switch } from '@/site/features/qrhub/components/ui/switch'
import { Textarea } from '@/site/features/qrhub/components/ui/textarea'
import { BulkBar } from '@/site/features/qrhub/components/BulkBar'
import { Card, Empty, Notice, StatusBadge } from '@/site/features/qrhub/components/common'
import { PasteLinksDialog } from '@/site/features/qrhub/components/PasteLinksDialog'
import { api } from '@/site/features/qrhub/lib/api'
import { fmtDateTime, isoToIstInput, istInputToIso } from '@/site/features/qrhub/lib/dates'
import { checkUrl } from '@/site/features/qrhub/lib/pasteLinks'
import type { Link, LinkInput, Workspace } from '@/site/features/qrhub/lib/types'
import { useSelection } from '@/site/features/qrhub/lib/useSelection'
import { errMsg } from '@/site/features/qrhub/lib/utils'

const LINK_CATEGORIES = ['Connect', 'Explore', 'Booking', 'Social', 'Other']

interface Draft {
  id?: string
  title: string
  title_hi: string
  destination_url: string
  category: string
  icon: string
  description: string
  is_featured: boolean
  status: 'active' | 'disabled'
  show_from: string
  show_until: string
  useHours: boolean
  open: string
  close: string
}

const blank: Draft = {
  title: '',
  title_hi: '',
  destination_url: '',
  category: 'Explore',
  icon: '',
  description: '',
  is_featured: false,
  status: 'active',
  show_from: '',
  show_until: '',
  useHours: false,
  open: '07:00',
  close: '23:00',
}

const toDraft = (l: Link): Draft => ({
  id: l.id,
  title: l.title,
  title_hi: l.title_hi ?? '',
  destination_url: l.destination_url,
  category: l.category || 'Explore',
  icon: l.icon ?? '',
  description: l.description ?? '',
  is_featured: l.is_featured,
  status: l.status,
  show_from: isoToIstInput(l.show_from),
  show_until: isoToIstInput(l.show_until),
  useHours: !!l.hours,
  open: l.hours?.open ?? '07:00',
  close: l.hours?.close ?? '23:00',
})

const toInput = (d: Draft): LinkInput => ({
  title: d.title.trim(),
  title_hi: d.title_hi.trim(),
  destination_url: d.destination_url.trim(),
  category: d.category,
  icon: d.icon.trim(),
  description: d.description.trim(),
  is_featured: d.is_featured,
  status: d.status,
  show_from: istInputToIso(d.show_from),
  show_until: istInputToIso(d.show_until),
  hours: d.useHours ? { open: d.open, close: d.close } : null,
})

function LinkDialog({ slug, draft, onClose, onSaved }: { slug: string; draft: Draft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(draft ?? blank)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const save = async () => {
    const bad = !d.title.trim() ? 'Title is required.' : checkUrl(d.destination_url.trim())
    if (bad) return setErr(bad)
    if (d.show_from && d.show_until && d.show_from > d.show_until) return setErr('“Show until” must be after “show from”.')
    setBusy(true)
    try {
      if (d.id) await api.updateLink(d.id, toInput(d))
      else await api.addLink(slug, toInput(d))
      onSaved()
      onClose()
    } catch (e) {
      setErr(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{d.id ? 'Edit link' : 'Add link'}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">{(id) => <Input id={id} value={d.title} onChange={(e) => set('title', e.target.value)} />}</Field>
          <Field label="Title in Hindi (optional)">
            {(id) => <Input id={id} lang="hi" value={d.title_hi} onChange={(e) => set('title_hi', e.target.value)} />}
          </Field>
          <Field label="Destination" hint="https, http, tel: or mailto: only." className="sm:col-span-2">
            {(id) => (
              <Input id={id} value={d.destination_url} onChange={(e) => set('destination_url', e.target.value)} placeholder="https://…" />
            )}
          </Field>
          <Field label="Section">
            {(id) => (
              <Select id={id} value={d.category} onChange={(e) => set('category', e.target.value)}>
                {LINK_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Icon name (optional)" hint="A lucide icon, e.g. phone, map-pin, bed-double.">
            {(id) => <Input id={id} value={d.icon} onChange={(e) => set('icon', e.target.value)} />}
          </Field>
          <Field label="Short description (optional)" className="sm:col-span-2">
            {(id) => <Textarea id={id} rows={2} value={d.description} onChange={(e) => set('description', e.target.value)} />}
          </Field>
          <Field label="Show from (India time)" hint="Empty means always.">
            {(id) => <Input id={id} type="datetime-local" value={d.show_from} onChange={(e) => set('show_from', e.target.value)} />}
          </Field>
          <Field label="Show until (India time)">
            {(id) => <Input id={id} type="datetime-local" value={d.show_until} onChange={(e) => set('show_until', e.target.value)} />}
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="use-hours" checked={d.useHours} onCheckedChange={(c) => set('useHours', c)} />
            <label htmlFor="use-hours" className="text-sm font-semibold">
              Only open at certain hours each day
            </label>
          </div>
          {d.useHours && (
            <>
              <Field label="Opens">
                {(id) => <Input id={id} type="time" value={d.open} onChange={(e) => set('open', e.target.value)} />}
              </Field>
              <Field label="Closes" hint="Outside these hours the hub shows “Closed now, opens …”.">
                {(id) => <Input id={id} type="time" value={d.close} onChange={(e) => set('close', e.target.value)} />}
              </Field>
            </>
          )}
          <div className="flex items-center gap-3">
            <Switch id="featured" checked={d.is_featured} onCheckedChange={(c) => set('is_featured', c)} />
            <label htmlFor="featured" className="text-sm font-semibold">
              Featured
            </label>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="enabled" checked={d.status === 'active'} onCheckedChange={(c) => set('status', c ? 'active' : 'disabled')} />
            <label htmlFor="enabled" className="text-sm font-semibold">
              Enabled
            </label>
          </div>
        </div>
        {err && <Notice kind="error">{err}</Notice>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function LinksTab({ ws, reload }: { ws: Workspace; reload: () => void }) {
  const slug = ws.organization.slug
  const links = [...ws.links].sort((a, b) => a.sort_order - b.sort_order)
  const sel = useSelection()
  const [edit, setEdit] = useState<{ draft: Draft | null } | null>(null)
  const [paste, setPaste] = useState(false)
  const [err, setErr] = useState('')

  const run = async (fn: () => Promise<unknown>) => {
    try {
      setErr('')
      await fn()
      reload()
    } catch (e) {
      setErr(errMsg(e))
    }
  }
  const move = (i: number, dir: -1 | 1) => {
    const ids = links.map((l) => l.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    void run(() => api.reorderLinks(slug, ids))
  }
  const bulk = (action: 'enable' | 'disable' | 'delete') => {
    if (action === 'delete' && !window.confirm(`Delete ${sel.ids.size} link(s)?`)) return
    void run(async () => {
      await api.bulk('links', sel.list, action)
      sel.clear()
    })
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEdit({ draft: null })}>
          <Plus /> Add link
        </Button>
        <Button variant="outline" onClick={() => setPaste(true)}>
          <ListPlus /> Paste many
        </Button>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      {links.length === 0 ? (
        <Empty>No links yet. Add one, or paste many at once.</Empty>
      ) : (
        <Card className="p-0 sm:p-0">
          <div className="flex items-center gap-3 border-b px-4 py-3 text-sm">
            <Checkbox
              id="all-links"
              checked={sel.ids.size === links.length}
              onChange={(e) =>
                sel.setAll(
                  links.map((l) => l.id),
                  e.target.checked,
                )
              }
            />
            <label htmlFor="all-links" className="font-semibold">
              Select all
            </label>
          </div>
          <ul className="divide-y">
            {links.map((l, i) => (
              <li key={l.id} className="flex items-center gap-2 px-4 py-3 sm:gap-3">
                <Checkbox aria-label={`Select ${l.title}`} checked={sel.has(l.id)} onChange={() => sel.toggle(l.id)} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{l.title}</span>
                    {l.is_featured && <Star className="size-4 fill-gold text-gold" aria-label="Featured" />}
                    <StatusBadge value={l.status} />
                    {l.hours && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" aria-hidden /> {l.hours.open}–{l.hours.close}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.destination_url} · {l.category} · {l.click_count} clicks
                    {(l.show_from || l.show_until) &&
                      ` · shows ${fmtDateTime(l.show_from) || 'now'} to ${fmtDateTime(l.show_until) || 'always'}`}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <Button size="icon-lg" variant="ghost" aria-label={`Move ${l.title} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp />
                  </Button>
                  <Button
                    size="icon-lg"
                    variant="ghost"
                    aria-label={`Move ${l.title} down`}
                    disabled={i === links.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowDown />
                  </Button>
                  <Button size="icon-lg" variant="ghost" aria-label={`Edit ${l.title}`} onClick={() => setEdit({ draft: toDraft(l) })}>
                    <Pencil />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <BulkBar count={sel.ids.size} onClear={sel.clear}>
        <Button size="sm" variant="gold" onClick={() => bulk('enable')}>
          <Eye /> Enable
        </Button>
        <Button size="sm" variant="gold" onClick={() => bulk('disable')}>
          <EyeOff /> Disable
        </Button>
        <Button size="sm" variant="destructive" onClick={() => bulk('delete')}>
          <Trash2 /> Delete
        </Button>
      </BulkBar>
      {edit && <LinkDialog slug={slug} draft={edit.draft} onClose={() => setEdit(null)} onSaved={reload} />}
      <PasteLinksDialog key={String(paste)} open={paste} onOpenChange={setPaste} slug={slug} onDone={reload} />
    </div>
  )
}

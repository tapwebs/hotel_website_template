import { useState } from 'react'
import { Plus, Trash2, Sparkles } from 'lucide-react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Field } from '@/site/features/qrhub/components/ui/field'
import { Input } from '@/site/features/qrhub/components/ui/input'
import { Card, Empty, Notice } from '@/site/features/qrhub/components/common'
import { api } from '@/site/features/qrhub/lib/api'
import { fmtDateTime, istInputToIso, phase } from '@/site/features/qrhub/lib/dates'
import type { Workspace } from '@/site/features/qrhub/lib/types'
import { errMsg } from '@/site/features/qrhub/lib/utils'

const PHASE_LABEL = { scheduled: 'Scheduled', live: 'Live now', expired: 'Expired' } as const

export function OffersTab({ ws, reload }: { ws: Workspace; reload: () => void }) {
  const slug = ws.organization.slug
  const [f, setF] = useState({ text: '', text_hi: '', link_url: '', starts_at: '', ends_at: '' })
  const [err, setErr] = useState('')

  const add = async () => {
    const starts = istInputToIso(f.starts_at)
    const ends = istInputToIso(f.ends_at)
    if (!f.text.trim()) return setErr('Offer text is required.')
    if (!starts || !ends) return setErr('Choose a start and an end.')
    if (ends <= starts) return setErr('The end must be after the start.')
    if (f.link_url && !/^https?:\/\//.test(f.link_url)) return setErr('The link must start with http:// or https://')
    try {
      setErr('')
      await api.addOffer(slug, {
        text: f.text.trim(),
        text_hi: f.text_hi.trim(),
        link_url: f.link_url.trim(),
        starts_at: starts,
        ends_at: ends,
      })
      setF({ text: '', text_hi: '', link_url: '', starts_at: '', ends_at: '' })
      reload()
    } catch (e) {
      setErr(errMsg(e))
    }
  }
  const remove = async (id: string) => {
    if (!window.confirm('Delete this offer?')) return
    try {
      await api.deleteOffer(id)
      reload()
    } catch (e) {
      setErr(errMsg(e))
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <Card className="grid gap-3 sm:grid-cols-2">
        <h2 className="text-h3 text-burgundy sm:col-span-2">New offer or announcement</h2>
        <Field label="Text" className="sm:col-span-2" hint="e.g. 20% off Sunday brunch">
          {(id) => <Input id={id} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />}
        </Field>
        <Field label="Text in Hindi (optional)" className="sm:col-span-2">
          {(id) => <Input id={id} lang="hi" value={f.text_hi} onChange={(e) => setF({ ...f, text_hi: e.target.value })} />}
        </Field>
        <Field label="Link (optional)" className="sm:col-span-2">
          {(id) => <Input id={id} type="url" value={f.link_url} onChange={(e) => setF({ ...f, link_url: e.target.value })} />}
        </Field>
        <Field label="Starts (India time)">
          {(id) => <Input id={id} type="datetime-local" value={f.starts_at} onChange={(e) => setF({ ...f, starts_at: e.target.value })} />}
        </Field>
        <Field label="Ends (India time)" hint="The banner disappears by itself after this.">
          {(id) => <Input id={id} type="datetime-local" value={f.ends_at} onChange={(e) => setF({ ...f, ends_at: e.target.value })} />}
        </Field>
        <div className="sm:col-span-2" aria-live="polite">
          <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview: how guests see it</p>
          <div className="flex items-start gap-3 rounded-2xl border border-gold bg-gold-soft/45 p-4">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-burgundy text-gold-soft">
              <Sparkles className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-widest text-burgundy uppercase">Offer</p>
              <p className={`mt-0.5 font-display text-xl ${f.text.trim() ? 'text-burgundy-deep' : 'text-muted-foreground'}`}>{f.text.trim() || 'Your offer text appears here'}</p>
              {f.text_hi.trim() && (
                <p lang="hi" className="mt-1 font-display text-lg text-burgundy-deep/80">
                  {f.text_hi.trim()}
                </p>
              )}
            </div>
          </div>
        </div>
        {err && (
          <div className="sm:col-span-2">
            <Notice kind="error">{err}</Notice>
          </div>
        )}
        <div className="sm:col-span-2">
          <Button onClick={add}>
            <Plus /> Add offer
          </Button>
        </div>
      </Card>
      {ws.offers.length === 0 ? (
        <Empty>No offers. The hub shows no banner.</Empty>
      ) : (
        <Card className="p-0 sm:p-0">
          <ul className="divide-y">
            {ws.offers.map((o) => {
              const ph = phase(o.starts_at, o.ends_at)
              return (
                <li key={o.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{o.text}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateTime(o.starts_at)} to {fmtDateTime(o.ends_at)}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${ph === 'live' ? 'bg-gold-soft text-ink' : 'bg-muted text-walnut'}`}
                  >
                    {PHASE_LABEL[ph]}
                  </span>
                  <Button size="icon-lg" variant="ghost" aria-label={`Delete offer ${o.text}`} onClick={() => remove(o.id)}>
                    <Trash2 />
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

import { useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Checkbox, Label, Select } from '@/site/features/qrhub/components/ui/field'
import { Card, Loading, Notice } from '@/site/features/qrhub/components/common'
import { api } from '@/site/features/qrhub/lib/api'
import { fileSafe, saveBlob, saveText } from '@/site/features/qrhub/lib/download'
import { istDay } from '@/site/features/qrhub/lib/dates'
import { HOTEL_SLUG } from '@/site/features/qrhub/lib/paths'
import { SECTIONS, SECTION_LABEL, buildImport, hotelEntry, pickSections, qrCsv, summarize, type Mode, type Section } from '@/site/features/qrhub/lib/transfer'
import type { Workspace } from '@/site/features/qrhub/lib/types'
import { useLoad } from '@/site/features/qrhub/lib/useLoad'
import { errMsg } from '@/site/features/qrhub/lib/utils'

const MAX_BYTES = 1_000_000

/** A checkbox row for one section, with a short count on the right. */
function SectionRow({ id, section, note, checked, disabled, onChange }: { id: string; section: Section; note?: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <Checkbox id={id} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <Label htmlFor={id} className={disabled ? 'font-normal text-muted-foreground' : 'font-normal'}>
        {SECTION_LABEL[section]}
      </Label>
      {note && <span className="ml-auto text-xs text-muted-foreground">{note}</span>}
    </li>
  )
}

function ExportCard({ ws }: { ws: Workspace | undefined }) {
  const [picked, setPicked] = useState<Set<Section>>(new Set(SECTIONS))
  const [password, setPassword] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<'json' | 'csv' | null>(null)
  const toggle = (s: Section, on: boolean) =>
    setPicked((p) => {
      const n = new Set(p)
      if (on) n.add(s)
      else n.delete(s)
      return n
    })
  const counts: Record<Section, string> = {
    details: ws?.organization.name ?? '',
    wifi: ws?.organization.wifi_ssid ? ws.organization.wifi_ssid : 'not set',
    links: ws ? `${ws.links.length}` : '',
    offers: ws ? `${ws.offers.length}` : '',
    placements: ws ? `${ws.placements.length}` : '',
  }
  const fetchDoc = async () => JSON.parse(await (await api.exportJson([HOTEL_SLUG], password && picked.has('wifi'))).blob.text()) as unknown
  const run = async (kind: 'json' | 'csv') => {
    setBusy(kind)
    setErr('')
    try {
      const doc = await fetchDoc()
      if (kind === 'csv') saveText(qrCsv(doc), `qr-codes-${istDay(0)}.csv`, 'text/csv')
      else {
        const all = picked.size === SECTIONS.length
        const tag = all ? 'full' : [...picked].map(fileSafe).join('-')
        saveBlob(new Blob([JSON.stringify(pickSections(doc, picked), null, 2)], { type: 'application/json' }), `hotel-hub-${tag}-${istDay(0)}.json`)
      }
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(null)
    }
  }
  return (
    <Card className="grid content-start gap-4">
      <div>
        <h3 className="text-h3 text-burgundy">Export</h3>
        <p className="text-sm text-muted-foreground">Choose what goes into the backup file. Analytics and internal ids are never included.</p>
      </div>
      <div className="flex gap-2 text-sm">
        <button type="button" className="font-semibold text-burgundy underline underline-offset-4" onClick={() => setPicked(new Set(SECTIONS))}>
          Select all
        </button>
        <span aria-hidden="true">·</span>
        <button type="button" className="font-semibold text-burgundy underline underline-offset-4" onClick={() => setPicked(new Set())}>
          Clear
        </button>
      </div>
      <ul className="divide-y rounded-md border px-3" aria-label="Parts to export">
        {SECTIONS.map((s) => (
          <SectionRow key={s} id={`ex-${s}`} section={s} note={counts[s]} checked={picked.has(s)} onChange={(on) => toggle(s, on)} />
        ))}
      </ul>
      <div className="flex items-start gap-2">
        <Checkbox id="inc-wifi" checked={password} disabled={!picked.has('wifi')} onChange={(e) => setPassword(e.target.checked)} />
        <Label htmlFor="inc-wifi" className="font-normal">
          Include the Wi-Fi password (the file will contain it in plain text)
        </Label>
      </div>
      {err && <Notice kind="error">{err}</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy !== null || picked.size === 0} onClick={() => void run('json')}>
          <Download /> {busy === 'json' ? 'Preparing…' : 'Download .json'}
        </Button>
        <Button variant="outline" disabled={busy !== null} onClick={() => void run('csv')}>
          <FileSpreadsheet /> {busy === 'csv' ? 'Preparing…' : 'QR list (.csv)'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">The QR list has each QR’s name, code and address, handy for printers and spreadsheets.</p>
    </Card>
  )
}

function ImportCard({ ws, onDone }: { ws: Workspace | undefined; onDone: () => void }) {
  const file = useRef<HTMLInputElement>(null)
  const [doc, setDoc] = useState<unknown>(null)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<Mode>('add')
  const [picked, setPicked] = useState<Set<Section>>(new Set())
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const summary = useMemo(() => (doc && ws ? summarize(doc, ws) : null), [doc, ws])
  const entry = doc ? hotelEntry(doc) : null
  const editable = (s: Section) => Boolean(summary?.[s].present) && !(mode === 'add' && (s === 'details' || s === 'wifi'))
  const chosen = useMemo(() => new Set([...picked].filter(editable)), [picked, mode, summary]) // eslint-disable-line react-hooks/exhaustive-deps
  const payload = doc && ws ? buildImport(doc, chosen, mode, ws) : null

  const validate = async (d: unknown, sections: ReadonlySet<Section>, m: Mode) => {
    if (!ws || sections.size === 0) return setErrors([])
    setBusy(true)
    try {
      setErrors((await api.importJson(buildImport(d, sections, m, ws), 'update', true)).errors)
    } catch (e) {
      setErrors([errMsg(e)])
    } finally {
      setBusy(false)
    }
  }
  const choose = (next: Set<Section>, m: Mode = mode) => {
    setPicked(next)
    void validate(doc, new Set([...next].filter((s) => summary?.[s].present && !(m === 'add' && (s === 'details' || s === 'wifi')))), m)
  }
  const onFile = async (f: File | undefined) => {
    setDoc(null)
    setErrors([])
    setErr('')
    setDone('')
    if (!f) return
    if (f.size > MAX_BYTES) return setErr('That file is larger than 1 MB.')
    try {
      const json: unknown = JSON.parse(await f.text())
      if (!hotelEntry(json).entry) return setErr('That file has no hotel data. Use a file exported from this page.')
      const sum = ws ? summarize(json, ws) : null
      const start = new Set(SECTIONS.filter((s) => sum?.[s].present && !(mode === 'add' && (s === 'details' || s === 'wifi'))))
      setDoc(json)
      setName(f.name)
      setPicked(start)
      if (ws) await validate(json, start, mode)
    } catch {
      setErr('That file is not valid JSON.')
    }
  }
  const apply = async () => {
    if (!payload) return
    setBusy(true)
    setErr('')
    try {
      await api.importJson(payload, 'update', false)
      const parts = [...chosen].map((s) => `${SECTION_LABEL[s].toLowerCase()}`).join(', ')
      setDone(`Imported: ${parts}.`)
      setDoc(null)
      setPicked(new Set())
      if (file.current) file.current.value = ''
      onDone()
    } catch (e) {
      setErr(`${errMsg(e)} Nothing was changed.`)
    } finally {
      setBusy(false)
    }
  }
  const note = (s: Section) => {
    const x = summary?.[s]
    if (!x?.present) return 'not in file'
    if (s === 'details' || s === 'wifi') return mode === 'add' ? 'only with “update”' : 'will replace'
    return `${x.add} new · ${x.update} existing`
  }
  const blocking = errors.length > 0
  return (
    <Card className="grid content-start gap-4">
      <div>
        <h3 className="text-h3 text-burgundy">Import</h3>
        <p className="text-sm text-muted-foreground">Upload a hotel hub .json file (max 1 MB). Pick the parts you want. Nothing is saved until you confirm, and then all of it is saved or none of it.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="import-file">JSON file</Label>
        <input
          ref={file}
          id="import-file"
          type="file"
          accept="application/json,.json"
          className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-gold-soft file:px-4 file:font-semibold file:text-ink"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </div>
      {doc !== null && summary && ws && (
        <>
          <p className="text-sm">
            <span className="font-semibold">{name}</span>
            {entry && entry.others > 0 ? ` · using “${String(hotelEntry(doc).entry?.name ?? '')}”, ignoring ${entry.others} other organization(s)` : ''}
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="import-mode">If an item already exists</Label>
            <Select
              id="import-mode"
              value={mode}
              onChange={(e) => {
                const m = e.target.value as Mode
                setMode(m)
                choose(picked, m)
              }}
            >
              <option value="add">Add new items only, keep what I have</option>
              <option value="update">Add new and update existing (links by title, QR codes by code)</option>
            </Select>
          </div>
          <ul className="divide-y rounded-md border px-3" aria-label="Parts to import">
            {SECTIONS.map((s) => (
              <SectionRow
                key={s}
                id={`im-${s}`}
                section={s}
                note={note(s)}
                disabled={!editable(s)}
                checked={chosen.has(s)}
                onChange={(on) => {
                  const n = new Set(picked)
                  if (on) n.add(s)
                  else n.delete(s)
                  choose(n)
                }}
              />
            ))}
          </ul>
        </>
      )}
      {busy && <Loading label="Working…" />}
      {err && <Notice kind="error">{err}</Notice>}
      {done && <Notice kind="success">{done}</Notice>}
      {blocking && (
        <Notice kind="error">
          <p className="font-semibold">This file has problems. Fix them and upload again.</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </Notice>
      )}
      {doc !== null && (
        <Button disabled={busy || blocking || chosen.size === 0} onClick={() => void apply()}>
          <Upload /> Confirm import
        </Button>
      )}
    </Card>
  )
}

/** Backup and restore for the hotel hub, one part at a time. */
export function ImportExportPanel() {
  const { data: ws, reload } = useLoad(() => api.getWorkspace(HOTEL_SLUG), [])
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ExportCard ws={ws} />
      <ImportCard ws={ws} onDone={reload} />
    </div>
  )
}

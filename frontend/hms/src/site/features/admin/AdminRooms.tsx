import { useState } from 'react'
import { Button } from '@/site/components/ui/button'
import { Input } from '@/site/components/ui/input'
import { Field } from '@/site/components/forms/Field'
import { formatINR } from '@/site/lib/format'
import { listRooms, setRoomRate, type RoomRate } from './toolsApi'
import { useResource } from './useAdminData'

function RoomCard({ room, onSaved }: { room: RoomRate; onSaved: () => void }) {
  const [rate, setRate] = useState(String(room.rate))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const n = Number(rate)
  const valid = Number.isInteger(n) && n >= 100 && n <= 1_000_000
  const save = async () => {
    setBusy(true)
    setMsg(null)
    const r = await setRoomRate(room.id, n)
    setBusy(false)
    if (r.ok) {
      setMsg({ ok: true, text: 'Saved. New bookings use this rate.' })
      onSaved()
    } else setMsg({ ok: false, text: r.error.message })
  }
  return (
    <section className="grid content-start gap-3 rounded-2xl border border-border bg-ivory p-5" aria-labelledby={`room-${room.id}`}>
      <div>
        <h3 id={`room-${room.id}`} className="font-display text-xl text-burgundy">
          {room.name}
        </h3>
        <p className="text-xs text-muted-foreground">Sleeps up to {room.maxAdults} adults · built-in rate {formatINR(room.defaultRate)}</p>
      </div>
      <Field id={`rate-${room.id}`} label="Rate per night (₹)" error={valid ? undefined : 'Enter a whole number from 100 to 1,000,000.'}>
        {(a) => <Input {...a} inputMode="numeric" value={rate} onChange={(e) => setRate(e.target.value.replace(/\D/g, ''))} />}
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={busy || !valid || n === room.rate} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save rate'}
        </Button>
        {room.rate !== room.defaultRate && (
          <Button variant="outline" disabled={busy} onClick={() => setRate(String(room.defaultRate))}>
            Use built-in rate
          </Button>
        )}
      </div>
      {msg && (
        <p role={msg.ok ? 'status' : 'alert'} className={msg.ok ? 'text-sm font-semibold text-walnut' : 'text-sm font-semibold text-destructive'}>
          {msg.text}
        </p>
      )}
    </section>
  )
}

export function AdminRooms() {
  const res = useResource((signal) => listRooms({ signal }), 'rooms')
  return (
    <div className="grid gap-5">
      <p className="max-w-2xl text-sm text-muted-foreground">
        Nightly rates used for new bookings (guest bookings and bookings you create). Existing bookings keep the rate they were made at. The prices printed on the public Rooms
        page come from the website itself and are not changed here.
      </p>
      {res.data ? (
        <div className="grid gap-5 md:grid-cols-2">
          {res.data.items.map((r) => (
            <RoomCard key={`${r.id}:${r.rate}`} room={r} onSaved={res.reload} />
          ))}
        </div>
      ) : res.status === 'error' ? (
        <div role="alert" className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-ivory p-5 text-destructive">
          <p className="font-medium">Could not load rooms. {res.error.message}</p>
          <Button variant="outline" onClick={res.reload}>
            Retry
          </Button>
        </div>
      ) : (
        <div role="status" className="h-40 animate-pulse rounded-2xl bg-border/50" aria-busy="true" />
      )}
    </div>
  )
}

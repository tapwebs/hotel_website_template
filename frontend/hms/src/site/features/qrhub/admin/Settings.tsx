import { useState } from 'react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Field } from '@/site/features/qrhub/components/ui/field'
import { Input } from '@/site/features/qrhub/components/ui/input'
import { Card, Loading, Notice } from '@/site/features/qrhub/components/common'
import { api } from '@/site/features/qrhub/lib/api'
import { SITE_URL } from '@/site/features/qrhub/lib/qrUrl'
import { resetSettingsCache } from '@/site/features/qrhub/lib/useSettings'
import { useLoad } from '@/site/features/qrhub/lib/useLoad'
import { errMsg } from '@/site/features/qrhub/lib/utils'
import type { QrSettings } from '@/site/features/qrhub/lib/types'

function Form({ initial }: { initial: QrSettings }) {
  const [s, setS] = useState<QrSettings>(initial)
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const save = async () => {
    try {
      await api.saveSettings(s)
      resetSettingsCache()
      setMsg({ kind: 'success', text: 'Saved.' })
    } catch (e) {
      setMsg({ kind: 'error', text: errMsg(e) })
    }
  }
  return (
    <Card className="grid max-w-2xl gap-4">
      <Field
        label="QR address base"
        hint="Every QR encodes this site followed by /r/<slug>. Set at build time (VITE_SITE_URL), so already printed codes never change."
      >
        {(id) => <Input id={id} value={SITE_URL} readOnly />}
      </Field>
      <Field label="Poster call to action" hint="Printed under the QR on posters.">
        {(id) => (
          <Input
            id={id}
            value={s.poster_cta ?? ''}
            placeholder="SCAN TO CONNECT"
            onChange={(e) => setS({ ...s, poster_cta: e.target.value })}
          />
        )}
      </Field>
      <Field label="Poster supporting line">
        {(id) => (
          <Input
            id={id}
            value={s.poster_support ?? ''}
            placeholder="Book a stay • WhatsApp • Offers • Directions • Wi-Fi"
            onChange={(e) => setS({ ...s, poster_support: e.target.value })}
          />
        )}
      </Field>
      <Field label="Timezone" hint="Analytics hours and opening hours use India time.">
        {(id) => <Input id={id} value="Asia/Kolkata" readOnly />}
      </Field>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div>
        <Button onClick={save}>Save settings</Button>
      </div>
    </Card>
  )
}

/** QR code defaults (poster text, address base). */
export function QrDefaultsSection() {
  const { data, error, loading } = useLoad(() => api.getSettings(), [])
  return (
    <div className="grid gap-3">
      {error && <Notice kind="error">{error}</Notice>}
      {loading && !data && <Loading />}
      {data && <Form initial={data} />}
    </div>
  )
}

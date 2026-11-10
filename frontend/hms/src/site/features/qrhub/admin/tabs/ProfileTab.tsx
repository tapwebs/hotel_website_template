import { useState } from 'react'
import { Button } from '@/site/features/qrhub/components/ui/button'
import { Card, Notice } from '@/site/features/qrhub/components/common'
import { api } from '@/site/features/qrhub/lib/api'
import { errMsg } from '@/site/features/qrhub/lib/utils'
import type { OrgInput, Workspace } from '@/site/features/qrhub/lib/types'
import { EMPTY_ORG, validateOrg } from '@/site/features/qrhub/lib/org'
import { OrgFields } from '../OrgFields'

export function ProfileTab({ ws, reload }: { ws: Workspace; reload: () => void }) {
  const [org, setOrg] = useState<OrgInput>({ ...EMPTY_ORG, ...ws.organization })
  const [msg, setMsg] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    const bad = validateOrg(org, false)
    if (bad) return setMsg({ kind: 'error', text: bad })
    setBusy(true)
    try {
      const { slug: _slug, ...patch } = org
      await api.updateOrganization(ws.organization.slug, patch)
      setMsg({ kind: 'success', text: 'Saved.' })
      reload()
    } catch (e) {
      setMsg({ kind: 'error', text: errMsg(e) })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <OrgFields value={org} onChange={setOrg} sections={['basics', 'contact', 'wifi', 'status']} slugLocked />
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="flex flex-wrap justify-between gap-2">
        <span />
        <Button disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </Card>
  )
}

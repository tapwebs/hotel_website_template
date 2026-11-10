import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, ChevronDown, DatabaseBackup, LogOut, QrCode, ShieldCheck } from 'lucide-react'
import { Button } from '@/site/components/ui/button'
import { hotel } from '@/site/data/hotel'
import { useAuth } from '@/site/features/auth/auth-context'
import { ImportExportPanel } from '@/site/features/qrhub/admin/ImportExport'
import { QrDefaultsSection } from '@/site/features/qrhub/admin/Settings'
import { api } from '@/site/features/qrhub/lib/api'
import { HOTEL_SLUG } from '@/site/features/qrhub/lib/paths'
import { useLoad } from '@/site/features/qrhub/lib/useLoad'
import { cn } from '@/site/lib/utils'

type Id = 'hotel' | 'qr' | 'backup'

/** A settings card: icon, title, one-line summary and a button that opens the form inside the card. */
function Card({ id, open, onToggle, icon: Icon, title, summary, action, children }: { id: Id; open: Id | null; onToggle: (id: Id) => void; icon: typeof Building2; title: string; summary: string; action: string; children: React.ReactNode }) {
  const isOpen = open === id
  return (
    <section aria-labelledby={`s-${id}`} className={cn('overflow-hidden rounded-2xl border bg-ivory shadow-xs transition-colors', isOpen ? 'border-burgundy/50 md:col-span-2' : 'border-border')}>
      <div className="flex items-center gap-4 p-5">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-gold-soft/60 text-burgundy">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`s-${id}`} className="font-display text-xl text-burgundy-deep">
            {title}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{summary}</p>
        </div>
        <Button variant={isOpen ? 'default' : 'outline'} size="sm" aria-expanded={isOpen} aria-controls={`p-${id}`} onClick={() => onToggle(id)}>
          {isOpen ? 'Close' : action}
          <ChevronDown className={cn('transition-transform', isOpen && 'rotate-180')} aria-hidden="true" />
        </Button>
      </div>
      {isOpen && (
        <div id={`p-${id}`} className="border-t border-border bg-cream/50 p-5">
          {children}
        </div>
      )}
    </section>
  )
}

export function AdminSettings() {
  const { auth, logout } = useAuth()
  const user = auth.status === 'authenticated' ? auth.user : null
  const [open, setOpen] = useState<Id | null>(null)
  const toggle = (id: Id) => setOpen((o) => (o === id ? null : id))
  const ws = useLoad(() => api.getWorkspace(HOTEL_SLUG), [])
  const org = ws.data?.organization
  const rows: [string, string][] = [
    ['Phone', org?.phone || hotel.phoneDisplay],
    ['WhatsApp', org?.whatsapp || hotel.whatsappNumber],
    ['Email', org?.email || hotel.email],
    ['Address', org?.address || `${hotel.address.street}, ${hotel.address.city}`],
    ['Check-in', hotel.checkIn],
    ['Check-out', hotel.checkOut],
  ]
  return (
    <div className="grid gap-6">
      {user && (
        <section aria-label="Your account" className="on-dark flex flex-wrap items-center gap-4 rounded-2xl bg-[linear-gradient(150deg,var(--color-burgundy-deep),var(--color-walnut))] p-5 text-cream sm:p-6">
          <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full bg-cream/15 font-display text-3xl uppercase">
            {user.name.trim().charAt(0) || '?'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-2xl">{user.name}</p>
            <p className="truncate text-sm text-cream/80">{user.email}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-cream/15 px-2.5 py-0.5 text-xs font-semibold capitalize">
              <ShieldCheck className="size-3.5" aria-hidden="true" /> {user.role}
            </p>
          </div>
          <Button variant="gold" onClick={() => void logout()}>
            <LogOut aria-hidden="true" /> Log out
          </Button>
        </section>
      )}

      <div className="grid items-start gap-4 md:grid-cols-2">
        <Card id="hotel" open={open} onToggle={toggle} icon={Building2} title="Hotel details" summary={`${org?.phone || hotel.phoneDisplay} · ${org?.email || hotel.email}`} action="View">
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{k}</dt>
                <dd className="break-words text-walnut">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link to="/app/qr/hotel-page">Edit in Hotel page</Link>
            </Button>
            <p className="text-xs text-muted-foreground">Contact details are edited under Hotel page → Profile. Check-in and check-out times come from the website itself.</p>
          </div>
        </Card>
        <Card id="qr" open={open} onToggle={toggle} icon={QrCode} title="QR codes" summary="Poster text and the QR address" action="Edit">
          <QrDefaultsSection />
        </Card>
        <Card id="backup" open={open} onToggle={toggle} icon={DatabaseBackup} title="Backup and restore" summary="Export or import the hotel hub, part by part" action="Open">
          <ImportExportPanel />
        </Card>
      </div>
    </div>
  )
}

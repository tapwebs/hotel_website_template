import { ArrowRight, BedDouble, CheckCircle, Clock, Flame, Printer, Zap } from 'lucide-react'
import React, { useState, useEffect } from 'react'

import { Badge } from '../../../../components/ui/Badge'
import { Button } from '../../../../components/ui/Button'
import type { OrderStatus } from '../../../../types/fnb'

export interface TicketItem {
  orderItemId: string
  name: string
  quantity: number
  modifiers?: { name?: string; optionName?: string }[]
  notes?: string
  prep_station?: string
  /** Added to the order after the first KOT. */
  added?: boolean
  /** Cancelled: shown struck through so the kitchen stops making it. */
  cancelled?: boolean
}

export interface KDSTicket {
  id: string
  order_id: string
  ticket_number: string
  prep_station: string
  status: 'pending' | 'in_preparation' | 'ready' | 'bumped'
  items_snapshot: TicketItem[]
  special_instructions?: string
  created_at: string
  room_number?: string
  is_rush_priority?: boolean
  estimated_prep_minutes?: number
  kot_printed_at?: string
  /** A later order for a table that already has one open: prints as "Additional KOT". */
  additional_kot?: boolean
  orders?: {
    order_number: string
    order_type: string
    tables?: { label: string }
    room_number?: string
  }
  customer_name?: string
  customer_phone?: string
  isBackendOrder?: boolean
  backendOrderStatus?: OrderStatus
}

interface KDSTicketCardProps {
  ticket: KDSTicket
  laneKey: 'pending' | 'in_preparation' | 'ready'
  onAdvance: (ticket: KDSTicket) => void
  onBump: (ticket: KDSTicket) => void
  onTogglePriority?: (ticket: KDSTicket) => void
  onPrintKOT?: (ticket: KDSTicket) => void
  /** Dream Heavens: extra buttons (e.g. cancel at the pass) shown in the toolbar. */
  extraActions?: React.ReactNode
}

export function KDSTicketCard({
  ticket,
  laneKey,
  onAdvance,
  onBump,
  onTogglePriority,
  onPrintKOT,
  extraActions,
}: KDSTicketCardProps) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000)
    return () => clearInterval(interval)
  }, [])

  const elapsedMinutes = Math.floor(
    (Date.now() - new Date(ticket.created_at).getTime()) / 60000
  )
  const targetMinutes = ticket.estimated_prep_minutes || 15
  const isOverdue = elapsedMinutes > targetMinutes && ticket.status !== 'ready'
  const isUrgent = (isOverdue || ticket.is_rush_priority) && ticket.status !== 'ready'
  const progressPercent = Math.min(100, Math.round((elapsedMinutes / targetMinutes) * 100))

  const destinationRoom = ticket.room_number || ticket.orders?.room_number

  return (
    <div
      className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden shadow-xs relative ${
        ticket.is_rush_priority
          ? 'border-amber-500/90 bg-amber-500/[0.04] ring-2 ring-amber-500/30'
          : isUrgent
          ? 'border-red-500/80 bg-red-500/5 ring-1 ring-red-500/20'
          : ticket.status === 'ready'
          ? 'border-emerald-500/50 bg-emerald-500/5'
          : 'border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)]'
      }`}
    >
      {/* Priority Ribbon */}
      {ticket.additional_kot && (
        <span className="mb-2 inline-flex rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-2xs font-bold uppercase tracking-wide text-sky-800">Additional KOT</span>
      )}
      {ticket.is_rush_priority && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white font-black text-2xs tracking-wider uppercase px-3 py-1 flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-1.5 animate-pulse">
            <Zap className="w-3.5 h-3.5" />
            RUSH PRIORITY / VIP
          </span>
          <span className="text-2xs opacity-90">EXPEDITE PREP</span>
        </div>
      )}

      {/* Ticket Header */}
      <div className="p-3 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/40 flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
          <span className="font-mono font-black text-sm break-all text-[var(--color-text-primary)]">
            #{ticket.orders?.order_number || ticket.ticket_number}
          </span>

          {destinationRoom ? (
            <Badge variant="warning" size="sm" className="font-bold text-2xs px-1.5 py-0 gap-1 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
              <BedDouble className="w-3 h-3" />
              Room {destinationRoom}
            </Badge>
          ) : ticket.orders?.tables?.label ? (
            <Badge variant="info" size="sm" className="font-bold text-2xs px-1.5 py-0">
              {ticket.orders.tables.label}
            </Badge>
          ) : null}

          <span className="text-2xs px-1.5 py-0.5 rounded bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border-subtle)]">
            {ticket.orders?.order_type || 'dine_in'}
          </span>

          {ticket.customer_name && (
            <span className="text-2xs font-medium text-[var(--color-text-primary)] font-sans truncate max-w-[7rem]" title={ticket.customer_phone ? `${ticket.customer_name} (${ticket.customer_phone})` : ticket.customer_name}>
              {ticket.customer_name}
            </span>
          )}
        </div>

        {/* SLA Timer */}
        <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
          <span
            className={`flex items-center gap-1 text-2xs font-mono font-bold ${
              isOverdue
                ? 'text-red-500 animate-pulse'
                : ticket.is_rush_priority
                ? 'text-amber-500'
                : 'text-[var(--color-text-tertiary)]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            {elapsedMinutes}m / {targetMinutes}m
          </span>
          {isOverdue && <Flame className="w-3.5 h-3.5 text-red-500 animate-bounce" />}
        </div>
      </div>

      {/* Visual SLA Progress Bar */}
      {ticket.status !== 'ready' && (
        <div className="w-full bg-[var(--color-bg-elevated)] h-1 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isOverdue
                ? 'bg-red-500 animate-pulse'
                : progressPercent > 75
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      )}

      {/* Items List */}
      <div className="p-3.5 space-y-2 flex-1 overflow-y-auto max-h-[14rem] divide-y divide-[var(--color-border-subtle)]/40">
        {ticket.items_snapshot.map((item, idx) => (
          <div key={idx} className={`pt-2 first:pt-0 flex items-start gap-2.5 ${item.cancelled ? 'opacity-60' : ''}`}>
            <span className={`size-7 rounded-md flex items-center justify-center font-mono font-bold text-sm shrink-0 text-ivory ${item.cancelled ? 'bg-slate-400' : 'bg-burgundy'}`}>
              {item.quantity}
            </span>
            <div className="min-w-0 flex-1">
              <div className={`font-bold text-base leading-snug break-words ${item.cancelled ? 'text-rose-700 line-through' : 'text-[var(--color-text-primary)]'}`}>
                {item.name}
                {item.added && <span className="ml-1.5 align-middle rounded-full bg-sky-100 px-1.5 py-0.5 text-2xs font-bold uppercase text-sky-800 no-underline">Added</span>}
                {item.cancelled && <span className="ml-1.5 align-middle rounded-full bg-rose-100 px-1.5 py-0.5 text-2xs font-bold uppercase text-rose-800">Cancelled</span>}
              </div>
              {!!item.modifiers?.length && (
                <div className="text-2xs text-[var(--color-text-secondary)] mt-0.5 break-words">
                  {item.modifiers.map((m) => m.optionName || m.name).filter(Boolean).join(' · ')}
                </div>
              )}
              {item.notes && (
                <div className="text-2xs text-amber-500 font-medium italic mt-0.5 break-words">
                  &ldquo;{item.notes}&rdquo;
                </div>
              )}
            </div>
          </div>
        ))}

        {ticket.special_instructions && (
          <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-1.5">
            <span className="font-bold shrink-0">Note:</span>
            <span className="font-medium break-words">{ticket.special_instructions}</span>
          </div>
        )}
      </div>

      {/* Actions Toolbar */}
      <div className="px-3 py-1.5 border-t border-[var(--color-border-subtle)]/60 bg-[var(--color-bg-elevated)]/10 flex flex-wrap items-center justify-between gap-1 text-2xs">
        {/* Toggle Rush Priority */}
        {onTogglePriority && (
          <button
            type="button"
            onClick={() => onTogglePriority(ticket)}
            title={ticket.is_rush_priority ? 'Remove Priority Flag' : 'Mark Rush / Priority'}
            className={`px-2 touch:px-3 py-1 touch:min-h-[44px] rounded-lg font-bold text-2xs flex items-center gap-1 transition-all ${
              ticket.is_rush_priority
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-amber-500'
            }`}
          >
            <Zap className={`w-3 h-3 ${ticket.is_rush_priority ? 'fill-current' : ''}`} />
            {ticket.is_rush_priority ? 'Rush Order' : 'Expedite'}
          </button>
        )}

        {/* Print KOT */}
        {onPrintKOT && (
          <button
            type="button"
            onClick={() => onPrintKOT(ticket)}
            title={ticket.kot_printed_at ? `Printed at ${new Date(ticket.kot_printed_at).toLocaleTimeString()}` : 'Print Thermal KOT'}
            className={`px-2 touch:px-3 py-1 touch:min-h-[44px] rounded-lg font-medium text-2xs flex items-center gap-1 transition-all ${
              ticket.kot_printed_at
                ? 'text-emerald-500 hover:bg-emerald-500/10'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]'
            }`}
          >
            <Printer className="w-3 h-3" />
            {ticket.kot_printed_at ? 'Reprint KOT' : ticket.additional_kot ? 'Print additional KOT' : 'Print KOT'}
          </button>
        )}
        {extraActions}
      </div>

      {/* Action Footer */}
      <div className="p-2.5 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/20">
        {laneKey === 'pending' && (
          <Button
            size="sm"
            onClick={() => onAdvance(ticket)}
            className="min-h-11 w-full gap-1.5 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
          >
            <span>Start Preparing</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        )}

        {laneKey === 'in_preparation' && (
          <Button
            size="sm"
            onClick={() => onAdvance(ticket)}
            className="min-h-11 w-full gap-1.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <span>Mark Ready</span>
            <CheckCircle className="w-3.5 h-3.5" />
          </Button>
        )}

        {laneKey === 'ready' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onBump(ticket)}
            className="min-h-11 w-full gap-1.5 text-sm font-bold border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10"
          >
            <span>Bump to Served</span>
            <CheckCircle className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  )
}

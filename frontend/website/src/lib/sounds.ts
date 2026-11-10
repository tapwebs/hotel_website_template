import { useEffect, useRef, useSyncExternalStore } from 'react'

/**
 * Tiny UI sounds, synthesized with the Web Audio API (no audio files).
 * Safe to import during prerender: nothing touches the browser at import time, and every
 * entry point is a silent no-op when AudioContext is missing. The context is created on the
 * first `play()`, which only ever runs from a user-triggered handler, so autoplay rules are met.
 */
export type SoundName = 'click' | 'tick' | 'success' | 'error' | 'pop' | 'close' | 'whoosh'

const MUTE_KEY = 'hdh:sounds-muted'
const MASTER_GAIN = 0.15
export const MAX_SECONDS = 0.3
const STALE_MS = 150

interface Note {
  from: number
  to?: number
  /** Seconds. */
  length: number
  /** Seconds after the sound starts. */
  at?: number
  type?: OscillatorType
  /** Relative loudness, 0 to 1. */
  level?: number
}

/** Every sound is one to three short notes and ends well under MAX_SECONDS. */
export const sounds: Record<SoundName, Note[]> = {
  click: [{ from: 520, to: 380, length: 0.07 }],
  tick: [{ from: 1200, length: 0.035, type: 'triangle', level: 0.5 }],
  pop: [{ from: 380, to: 760, length: 0.1 }],
  close: [{ from: 620, to: 300, length: 0.1, level: 0.6 }],
  whoosh: [{ from: 250, to: 900, length: 0.18, level: 0.4 }],
  success: [
    { from: 660, length: 0.11 },
    { from: 880, length: 0.16, at: 0.09 },
  ],
  error: [
    { from: 220, to: 180, length: 0.1, type: 'triangle', level: 0.7 },
    { from: 220, to: 160, length: 0.1, at: 0.1, type: 'triangle', level: 0.7 },
  ],
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted: boolean | null = null
const listeners = new Set<() => void>()

function readMuted(): boolean {
  if (muted === null) {
    try {
      muted = globalThis.localStorage?.getItem(MUTE_KEY) === '1'
    } catch {
      muted = false
    }
  }
  return muted
}

export function setMuted(value: boolean) {
  muted = value
  try {
    globalThis.localStorage?.setItem(MUTE_KEY, value ? '1' : '0')
  } catch {
    // Private mode or blocked storage: the choice just lasts for this page view.
  }
  listeners.forEach((l) => l())
}

/** Reactive mute flag. Renders unmuted on the server so hydration matches. */
export function useMuted(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange)
      return () => void listeners.delete(onChange)
    },
    readMuted,
    () => false,
  )
}

function getContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = globalThis.AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = MASTER_GAIN
    master.connect(ctx.destination)
  } catch {
    ctx = master = null
  }
  return ctx
}

function schedule(c: AudioContext, out: GainNode, notes: Note[]) {
  const start = c.currentTime
  for (const n of notes) {
    const t0 = start + (n.at ?? 0)
    const t1 = t0 + n.length
    const osc = c.createOscillator()
    const env = c.createGain()
    osc.type = n.type ?? 'sine'
    osc.frequency.setValueAtTime(n.from, t0)
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t1)
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.linearRampToValueAtTime(n.level ?? 1, t0 + Math.min(0.008, n.length / 3))
    env.gain.exponentialRampToValueAtTime(0.0001, t1)
    osc.connect(env)
    env.connect(out)
    osc.start(t0)
    osc.stop(t1 + 0.02)
  }
}

/** Plays one UI sound. Call only from user-triggered handlers. Never throws. */
export function play(name: SoundName) {
  try {
    if (readMuted() || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const c = getContext()
    if (!c || !master) return
    const out = master
    const asked = Date.now()
    // A suspended context (no user activation yet) may resume much later: drop stale sounds instead of replaying them.
    const go = () => Date.now() - asked < STALE_MS && schedule(c, out, sounds[name])
    if (c.state === 'running') go()
    else void c.resume().then(go, () => {})
  } catch {
    // Audio is a nicety: never let it break a click.
  }
}

/** For `handleSubmit(onValid, playError)`. */
export const playError = () => play('error')

/** Plays `pop` / `close` when a controlled dialog's `open` flips. Silent on first render. */
export function useOpenSound(open: boolean | undefined) {
  const prev = useRef(open)
  useEffect(() => {
    if (prev.current !== undefined && open !== undefined && prev.current !== open) play(open ? 'pop' : 'close')
    prev.current = open
  }, [open])
}

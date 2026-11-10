import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** Minimal AudioContext double that records every oscillator's stop time. */
function installAudio() {
  const stops: number[] = []
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() })
  const node = () => ({ connect: (n: unknown) => n, gain: param() })
  class FakeContext {
    state = 'running'
    currentTime = 0
    destination = {}
    created = 0
    createGain = node
    createOscillator = () => ({ ...node(), frequency: param(), type: 'sine', start: vi.fn(), stop: (t: number) => stops.push(t) })
    resume = () => Promise.resolve()
  }
  vi.stubGlobal('AudioContext', FakeContext)
  return stops
}

async function load() {
  vi.resetModules()
  return import('./sounds')
}

describe('sounds', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('is a silent no-op when AudioContext is unavailable', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const { play } = await load()
    expect(() => play('click')).not.toThrow()
  })

  it('plays every sound in well under 300ms', async () => {
    const stops = installAudio()
    const { play, sounds, MAX_SECONDS } = await load()
    for (const name of Object.keys(sounds) as (keyof typeof sounds)[]) {
      stops.length = 0
      play(name)
      expect(stops.length).toBe(sounds[name].length)
      expect(Math.max(...stops)).toBeLessThanOrEqual(MAX_SECONDS)
    }
  })

  it('respects mute and persists it', async () => {
    const stops = installAudio()
    const mod = await load()
    mod.setMuted(true)
    mod.play('click')
    expect(stops).toHaveLength(0)
    expect(localStorage.getItem('hdh:sounds-muted')).toBe('1')
    mod.setMuted(false)
    mod.play('click')
    expect(stops).toHaveLength(1)
  })

  it('respects prefers-reduced-motion', async () => {
    const stops = installAudio()
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { play } = await load()
    play('success')
    expect(stops).toHaveLength(0)
  })
})

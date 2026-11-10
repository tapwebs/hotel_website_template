/**
 * TapMenu V3 — Zero-latency Web Audio API sound synthesizer.
 * Creates physical brass kitchen counter bell, urgency alarm, and cashier chime without external assets.
 */

class SoundEffectsService {
  private audioCtx: AudioContext | null = null
  private isMuted: boolean = false

  constructor() {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tapmenu_audio_muted')
      this.isMuted = saved === 'true'
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (this.isMuted) return null

    if (!this.audioCtx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass()
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume()
    }
    return this.audioCtx
  }

  setMuted(muted: boolean): void {
    this.isMuted = muted
    if (typeof window !== 'undefined') {
      localStorage.setItem('tapmenu_audio_muted', muted ? 'true' : 'false')
    }
  }

  getMuted(): boolean {
    return this.isMuted
  }

  /**
   * Resonant brass kitchen counter bell (two resonant harmonics)
   */
  playKitchenBell(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return

      const now = ctx.currentTime
      // Primary chime (C6)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(1046.5, now)
      gain1.gain.setValueAtTime(0.3, now)
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 1.2)

      // Harmonics overtone (E6)
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1318.5, now)
      gain2.gain.setValueAtTime(0.15, now)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.0)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now)
      osc2.stop(now + 1.0)
    } catch {
      // Audio autoplay policy fallback
    }
  }

  /**
   * Urgent kitchen ticket alert (double pulsing chime)
   */
  playUrgentAlert(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return

      const now = ctx.currentTime
      ;[0, 0.15].forEach((offset) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(880, now + offset)
        gain.gain.setValueAtTime(0.15, now + offset)
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.12)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + offset)
        osc.stop(now + offset + 0.12)
      })
    } catch {
      // Autoplay fallback
    }
  }

  /**
   * Cashier / POS checkout success arpeggio
   */
  playSuccessChime(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return

      const now = ctx.currentTime
      const notes = [523.25, 659.25, 783.99, 1046.5] // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const start = now + idx * 0.07
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, start)
        gain.gain.setValueAtTime(0.2, start)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.35)
      })
    } catch {
      // Autoplay fallback
    }
  }

  success(): void {
    this.playSuccessChime()
  }

  click(): void {
    this.playKitchenBell()
  }

  playItemAdded(): void {
    this.cardFlip()
  }

  playError(): void {
    this.playUrgentAlert()
  }

  cardFlip(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.08)
    } catch {}
  }

  spinTick(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(1200, now)
      gain.gain.setValueAtTime(0.1, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.04)
    } catch {}
  }

  tap(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05)
      gain.gain.setValueAtTime(0.12, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.05)
    } catch {}
  }

  reward(): void {
    this.playSuccessChime()
  }

  jackpot(): void {
    try {
      const ctx = this.getContext()
      if (!ctx) return
      const now = ctx.currentTime
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const start = now + idx * 0.06
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, start)
        gain.gain.setValueAtTime(0.2, start)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.4)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.4)
      })
    } catch {}
  }

  fanfare(): void {
    this.jackpot()
  }
}

export const soundEffects = new SoundEffectsService()

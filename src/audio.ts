export interface Levels { bass: number; mid: number; treble: number; volume: number } // each 0..1
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024
const FFT_SIZE = 1024

const avg = (a: Uint8Array, from: number, to: number): number => {
  const s = Math.max(0, from), e = Math.min(a.length, Math.max(s + 1, to))
  let sum = 0
  for (let i = s; i < e; i++) sum += a[i]
  return sum / ((e - s) * 255)
}
/** Splits analyser frequency bins into bass / mid / treble bands and overall volume. */
export function levelsFrom(freq: Uint8Array, out: Levels = { bass: 0, mid: 0, treble: 0, volume: 0 }): Levels {
  const n = freq.length
  if (n === 0) { out.bass = out.mid = out.treble = out.volume = 0; return out }
  out.bass = avg(freq, 0, Math.round(n * 0.03))
  out.mid = avg(freq, Math.round(n * 0.03), Math.round(n * 0.25))
  out.treble = avg(freq, Math.round(n * 0.25), Math.round(n * 0.75))
  out.volume = avg(freq, 0, n)
  return out
}

/** Local-only audio input (file or microphone) feeding one AnalyserNode. Nothing is uploaded. */
export class AudioEngine {
  readonly freq = new Uint8Array(FFT_SIZE / 2)
  readonly wave = new Uint8Array(FFT_SIZE).fill(128)
  private ctx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private src: AudioNode | null = null
  private el: HTMLAudioElement | null = null
  private url: string | null = null
  private stream: MediaStream | null = null

  get active() { return this.analyser !== null }
  get playing(): boolean { return this.el !== null && !this.el.paused }

  /** Pause/resume file playback (a live microphone cannot be paused; use stop()). Returns the new playing state. */
  async togglePlay(): Promise<boolean> {
    if (!this.el || !this.ctx) return false
    if (this.el.paused) { await this.ctx.resume(); await this.el.play() } else this.el.pause()
    return !this.el.paused
  }

  private ensure(): AnalyserNode {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) throw new Error('This browser does not support the Web Audio API.')
    this.ctx = new Ctor()
    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = FFT_SIZE
    this.analyser.smoothingTimeConstant = 0.8
    return this.analyser
  }

  async useFile(file: File): Promise<void> {
    if (!file.type.startsWith('audio/')) throw new Error('Please choose an audio file (MP3, WAV, OGG, M4A...).')
    if (file.size > MAX_AUDIO_BYTES) throw new Error('That audio file is larger than 50 MB.')
    this.stop()
    const an = this.ensure(), ctx = this.ctx!
    const el = new Audio()
    el.loop = true
    this.url = URL.createObjectURL(file); el.src = this.url; this.el = el
    const node = ctx.createMediaElementSource(el)
    node.connect(an); an.connect(ctx.destination); this.src = node
    try { await ctx.resume(); await el.play() }
    catch (e) {
      this.stop()
      throw new Error(e instanceof DOMException && e.name === 'NotSupportedError'
        ? 'This browser cannot play that audio format.' : 'Playback was blocked or failed. Click the button again.')
    }
  }

  async useMic(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is not supported in this browser.')
    this.stop()
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) }
    catch (e) {
      const n = e instanceof DOMException ? e.name : ''
      throw new Error(n === 'NotAllowedError' ? 'Microphone permission was denied.'
        : n === 'NotFoundError' ? 'No microphone was found.' : 'Could not open the microphone.')
    }
    this.stream = stream
    try {
      const an = this.ensure() // mic is NOT routed to the speakers (avoids feedback)
      this.src = this.ctx!.createMediaStreamSource(stream); this.src.connect(an)
      await this.ctx!.resume()
    } catch (e) { this.stop(); throw e }
  }

  /** Copies the current analyser data into freq / wave. Call once per frame. */
  sample(): void {
    if (!this.analyser) return
    this.analyser.getByteFrequencyData(this.freq)
    this.analyser.getByteTimeDomainData(this.wave)
  }

  /** Releases everything: mic tracks, audio element, object URL, nodes, context. */
  stop(): void {
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null
    if (this.el) { this.el.pause(); this.el.removeAttribute('src'); this.el.load(); this.el = null }
    if (this.url) { URL.revokeObjectURL(this.url); this.url = null }
    this.src?.disconnect(); this.src = null
    this.analyser?.disconnect(); this.analyser = null
    void this.ctx?.close(); this.ctx = null
    this.freq.fill(0); this.wave.fill(128)
  }
}

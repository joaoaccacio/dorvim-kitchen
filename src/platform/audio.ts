import type { Settings } from '../game/types';

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
const MELODY: (number | null)[] = [69, null, 72, 76, 74, 72, 69, 67, 65, null, 69, 72, 76, 74, null, 72, 70, 69, 67, null, 69, 74, 72, 70, 67, null, 64, 67, 70, 69, 67, null];
const CHORDS = [[53, 57, 60, 64], [50, 57, 60, 64], [55, 58, 62, 65], [48, 58, 62, 69]];
const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const volume = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Original, synthesized music and kitchen sounds; no media, network, or autoplay. */
export class GameAudio {
  private settings: Settings;
  private context: AudioContext | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlocked = false;
  private destroyed = false;
  private nextNote = 0;
  private beat = 0;
  private readonly visibility = () => {
    if (!this.context || !this.unlocked) return;
    if (document.hidden) {
      this.stopTimer();
      void this.context.suspend().catch(() => {});
    } else {
      void this.context.resume().then(() => { this.nextNote = this.context!.currentTime + 0.06; this.startTimer(); }).catch(() => {});
    }
  };

  constructor(settings: Settings) {
    this.settings = { ...settings };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.visibility);
  }

  /** Call in a click/key event so browsers can allow sound. */
  unlock(): void {
    if (this.destroyed || typeof window === 'undefined') return;
    try {
      if (!this.context) {
        const Constructor = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
        if (!Constructor) return;
        this.context = new Constructor();
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 18;
        compressor.ratio.value = 3;
        compressor.attack.value = 0.005;
        compressor.release.value = 0.2;
        compressor.connect(this.context.destination);
        this.music = this.context.createGain();
        this.effects = this.context.createGain();
        this.music.connect(compressor);
        this.effects.connect(compressor);
        this.music.gain.value = volume(this.settings.music) * 0.55;
        this.effects.gain.value = volume(this.settings.effects) * 0.65;
        this.nextNote = this.context.currentTime + 0.06;
      }
      this.unlocked = true;
      if (typeof document !== 'undefined' && document.hidden) return;
      void this.context.resume().then(() => this.startTimer()).catch(() => {});
    } catch { /* Audio is optional on browsers without a usable audio device. */ }
  }

  setSettings(settings: Settings): void {
    this.settings = { ...settings };
    if (!this.context || !this.music || !this.effects) return;
    const time = this.context.currentTime;
    this.music.gain.setTargetAtTime(volume(settings.music) * 0.55, time, 0.04);
    this.effects.gain.setTargetAtTime(volume(settings.effects) * 0.65, time, 0.04);
  }

  private startTimer(): void {
    if (this.timer || this.destroyed || !this.context || this.context.state !== 'running') return;
    if (this.nextNote < this.context.currentTime) this.nextNote = this.context.currentTime + 0.05;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), 100);
  }
  private stopTimer(): void { if (this.timer) clearInterval(this.timer); this.timer = null; }
  private schedule(): void {
    const context = this.context;
    if (!context || !this.music || context.state !== 'running') return;
    // A swung 88 bpm pocket, four original jazz harmonies, and plucked melody.
    while (this.nextNote < context.currentTime + 0.28) {
      const position = this.beat % 32;
      const step = position % 8;
      const chord = CHORDS[Math.floor(position / 8)];
      if (volume(this.settings.music) > 0) {
        const note = MELODY[position];
        if (note !== null) this.tone(frequency(note), this.nextNote, 0.27, 0.09, this.music, 'triangle');
        if (step === 0 || step === 4) this.tone(frequency(chord[0] - 12), this.nextNote, 0.47, 0.16, this.music, 'sine');
        if (step === 0 || step === 3 || step === 6) chord.slice(1).forEach((pitch, index) => this.tone(frequency(pitch), this.nextNote + index * 0.009, 0.5, 0.025, this.music!, 'triangle'));
        if (step % 2 === 1) this.noise(this.nextNote, 0.055, 0.014, this.music, 6500, 'highpass');
      }
      this.nextNote += (60 / 88 / 2) * (this.beat % 2 === 0 ? 1.13 : 0.87);
      this.beat++;
    }
  }

  private tone(hz: number, time: number, duration: number, loudness: number, output: AudioNode, type: OscillatorType = 'sine', slide?: number): void {
    const context = this.context;
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(hz, time);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(slide, time + duration);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(loudness, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gain);
    gain.connect(output);
    oscillator.start(time);
    oscillator.stop(time + duration + 0.02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  private noise(time: number, duration: number, loudness: number, output: AudioNode, cutoff = 1700, type: BiquadFilterType = 'bandpass'): void {
    const context = this.context;
    if (!context) return;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index++) samples[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    source.buffer = buffer;
    filter.type = type;
    filter.frequency.value = cutoff;
    filter.Q.value = 0.7;
    gain.gain.setValueAtTime(loudness, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    source.start(time);
    source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
  }

  play(name: string): void {
    const context = this.context;
    const output = this.effects;
    if (!this.unlocked || !context || !output || context.state !== 'running' || volume(this.settings.effects) === 0 || this.destroyed) return;
    const time = context.currentTime + 0.005;
    const note = (pitch: number, offset = 0, length = 0.17, loudness = 0.17) => this.tone(frequency(pitch), time + offset, length, loudness, output, 'sine');
    switch (name) {
      case 'cut':
        this.noise(time, 0.055, 0.17, output, 1700);
        this.tone(180, time, 0.06, 0.17, output, 'triangle', 80);
        break;
      case 'water': case 'wash':
        this.noise(time, 0.7, 0.23, output, 3400, 'lowpass');
        note(87, 0.07, 0.08, 0.05); note(91, 0.2, 0.1, 0.04);
        break;
      case 'fry': case 'grill':
        this.noise(time, 0.65, 0.26, output, 2500, 'highpass');
        for (let i = 0; i < 5; i++) this.noise(time + i * 0.09, 0.025, 0.1, output, 1400 + i * 450);
        break;
      case 'utensil': case 'mix': case 'plate': case 'season':
        [76, 88, 95].forEach((pitch, index) => note(pitch, index * 0.014, 0.2, 0.11 / (index + 1)));
        break;
      case 'oven': case 'bake':
        note(76, 0, 0.55, 0.13); note(83, 0.16, 0.6, 0.11);
        break;
      case 'serve':
        [72, 76, 79].forEach((pitch, index) => note(pitch, index * 0.065, 0.28, 0.12));
        break;
      case 'money': case 'buy':
        [81, 88, 93].forEach((pitch, index) => note(pitch, index * 0.055, 0.2, 0.12));
        break;
      case 'review':
        [74, 77, 81].forEach((pitch, index) => note(pitch, index * 0.1, 0.35, 0.12));
        break;
      case 'achievement':
        [65, 69, 72, 77, 81].forEach((pitch, index) => note(pitch, index * 0.1, 0.5, 0.14));
        break;
      case 'event':
        note(67, 0, 0.3, 0.12); note(74, 0.12, 0.38, 0.11);
        break;
      default:
        this.tone(560, time, 0.045, 0.07, output, 'sine', 420);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.stopTimer();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.visibility);
    const context = this.context;
    this.context = null;
    this.music = null;
    this.effects = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}

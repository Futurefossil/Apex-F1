import { SpeedModeId } from './types';

export class F1AudioEngine {
  private ctx: AudioContext | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private masterGain: GainNode | null = null;
  private active = false;

  public start(mode: SpeedModeId): boolean {
    if (this.active) return true;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;

      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
      this.masterGain.gain.exponentialRampToValueAtTime(0.08, this.ctx.currentTime + 0.25);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'bandpass';
      this.filter.Q.value = 2.4;

      this.oscPrimary = this.ctx.createOscillator();
      this.oscPrimary.type = 'sawtooth';

      this.oscHarmonic = this.ctx.createOscillator();
      this.oscHarmonic.type = 'triangle';

      const harmGain = this.ctx.createGain();
      harmGain.gain.value = 0.55;

      this.oscPrimary.connect(this.filter);
      this.oscHarmonic.connect(harmGain);
      harmGain.connect(this.filter);
      this.filter.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.oscPrimary.start();
      this.oscHarmonic.start();
      this.active = true;
      this.setMode(mode);
      return true;
    } catch {
      return false;
    }
  }

  public setMode(mode: SpeedModeId) {
    if (!this.active || !this.ctx || !this.oscPrimary || !this.oscHarmonic || !this.filter) {
      return;
    }
    const now = this.ctx.currentTime;
    // 1.6L V6 firing frequency: (RPM / 60) * 3 cylinders per rev
    const targetFreq =
      mode === 'track' ? 310 : mode === 'pit' ? 175 : 96;
    const filterFreq =
      mode === 'track' ? 980 : mode === 'pit' ? 520 : 280;

    this.oscPrimary.frequency.setTargetAtTime(targetFreq, now, 0.22);
    this.oscHarmonic.frequency.setTargetAtTime(targetFreq * 2.0, now, 0.22);
    this.filter.frequency.setTargetAtTime(filterFreq, now, 0.22);
  }

  public stop() {
    if (!this.active || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(0.0001, now, 0.08);
      }
      const p = this.oscPrimary;
      const h = this.oscHarmonic;
      setTimeout(() => {
        try {
          p?.stop();
          h?.stop();
          p?.disconnect();
          h?.disconnect();
        } catch {
          // ignore
        }
      }, 120);
    } finally {
      this.oscPrimary = null;
      this.oscHarmonic = null;
      this.filter = null;
      this.masterGain = null;
      this.active = false;
    }
  }

  public dispose() {
    this.stop();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

import type { CarState } from "./types";
import { estimateSpeed } from "./physics";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private lastHitAt = 0;

  async init(): Promise<void> {
    if (this.ctx) return;

    const ctx = new AudioContext();
    await ctx.resume();

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";

    const gain = ctx.createGain();
    gain.gain.value = 0.02;

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();

    this.ctx = ctx;
    this.engineOsc = osc;
    this.engineGain = gain;
  }

  update(localCar: CarState | undefined): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain) return;
    if (!localCar) return;

    const speed = estimateSpeed(localCar);
    const freq = 60 + Math.min(420, speed * 18);
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
    this.engineGain.gain.setTargetAtTime(0.015 + Math.min(0.03, speed * 0.0012), this.ctx.currentTime, 0.08);

    if (localCar.lastHitAt > this.lastHitAt) {
      this.lastHitAt = localCar.lastHitAt;
      this.playHit();
    }
  }

  private playHit(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }

    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;

    const gain = ctx.createGain();
    gain.gain.value = 0.12;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
  }

  dispose(): void {
    this.engineOsc?.stop();
    this.engineOsc?.disconnect();
    this.engineGain?.disconnect();
    void this.ctx?.close();

    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
  }
}

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { createAudioEngine } from './audioEngine';

class FakeParam {
  values: number[] = [];
  setValueAtTime(value: number) { this.values.push(value); }
  exponentialRampToValueAtTime(value: number) { this.values.push(value); }
  setTargetAtTime(value: number) { this.values.push(value); }
}

class FakeNode {
  disconnectCount = 0;
  listeners: Array<() => void> = [];
  connect<T extends FakeNode>(node: T): T { return node; }
  disconnect() { this.disconnectCount += 1; }
  addEventListener(_type: string, listener: () => void) { this.listeners.push(listener); }
  start() {}
  stop() {}
}

class FakeOscillator extends FakeNode {
  type: OscillatorType = 'sine';
  frequency = new FakeParam();
}

class FakeGain extends FakeNode {
  gain = new FakeParam();
}

class FakeFilter extends FakeNode {
  type = 'bandpass';
  frequency = new FakeParam();
  Q = new FakeParam();
}

class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
}

class FakeAudioContext {
  static latest: FakeAudioContext | null = null;
  state: AudioContextState = 'suspended';
  currentTime = 0;
  sampleRate = 1000;
  destination = new FakeNode();
  oscillators: FakeOscillator[] = [];
  gains: FakeGain[] = [];
  filters: FakeFilter[] = [];
  bufferSources: FakeBufferSource[] = [];

  constructor() { FakeAudioContext.latest = this; }
  createOscillator() { const node = new FakeOscillator(); this.oscillators.push(node); return node; }
  createGain() { const node = new FakeGain(); this.gains.push(node); return node; }
  createBiquadFilter() { const node = new FakeFilter(); this.filters.push(node); return node; }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createBufferSource() { const node = new FakeBufferSource(); this.bufferSources.push(node); return node; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

class PendingResumeAudioContext extends FakeAudioContext {
  static resolveResume: (() => void) | null = null;
  resume() {
    return new Promise<void>((resolve) => {
      PendingResumeAudioContext.resolveResume = () => {
        this.state = 'running';
        resolve();
      };
    });
  }
}

const originalAudioContext = window.AudioContext;

afterEach(() => {
  Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: originalAudioContext });
  FakeAudioContext.latest = null;
});

describe('engine musical procedural', () => {
  it('agenda kick, conga e ruído de shaker no enable e limpa fontes auxiliares ao parar', async () => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: FakeAudioContext });
    const engine = createAudioEngine({ musicEnabled: true });

    expect(await engine.enable()).toBe(true);
    const context = FakeAudioContext.latest!;
    const frequencies = context.oscillators.flatMap((node) => node.frequency.values);
    expect(frequencies).toContain(118);
    expect(frequencies).toContain(205);
    expect(context.bufferSources.length).toBeGreaterThan(0);

    engine.setSuspended(true);
    expect(context.oscillators.every((node) => node.disconnectCount > 0)).toBe(true);
    expect(context.bufferSources.every((node) => node.disconnectCount > 0)).toBe(true);
    expect(context.gains.slice(2).every((node) => node.disconnectCount > 0)).toBe(true);
    expect(context.filters.every((node) => node.disconnectCount > 0)).toBe(true);
    engine.dispose();
  });

  it('faz ducking somente no barramento musical e restaura o slider', async () => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: FakeAudioContext });
    const engine = createAudioEngine({ musicEnabled: false, effectsVolume: 0.6, musicVolume: 0.8 });
    expect(await engine.enable()).toBe(true);
    const context = FakeAudioContext.latest!;

    engine.setMusicDucked(true);
    expect(context.gains[1].gain.values.at(-1)).toBeCloseTo(0.2);
    expect(context.gains[0].gain.values.at(-1)).toBeCloseTo(0.6);
    engine.setMusicDucked(false);
    expect(context.gains[1].gain.values.at(-1)).toBeCloseTo(0.8);
    engine.dispose();
  });

  it('não inicia música quando a suspensão vence um enable pendente', async () => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: PendingResumeAudioContext });
    const engine = createAudioEngine({ musicEnabled: true });
    const enabling = engine.enable();
    const context = FakeAudioContext.latest!;

    engine.setSuspended(true);
    PendingResumeAudioContext.resolveResume!();
    expect(await enabling).toBe(true);
    expect(context.state).toBe('suspended');
    expect(context.oscillators).toHaveLength(0);
    expect(context.bufferSources).toHaveLength(0);
    engine.dispose();
  });
});

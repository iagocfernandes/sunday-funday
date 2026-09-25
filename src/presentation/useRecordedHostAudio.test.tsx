// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { primeRecordedHostAudio, useRecordedHostAudio, type RecordedHostCue } from './useRecordedHostAudio';

class MockAudio {
  static instances: MockAudio[] = [];
  static nextPlayResult: Promise<void> | null = null;
  src: string;
  preload = '';
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  playCalls = 0;
  pauseCalls = 0;
  playResult: Promise<void>;

  constructor(src = '') {
    this.src = src;
    this.playResult = MockAudio.nextPlayResult ?? Promise.resolve();
    MockAudio.nextPlayResult = null;
    MockAudio.instances.push(this);
  }

  play() {
    this.playCalls += 1;
    this.paused = false;
    return this.playResult;
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }

  removeAttribute(name: string) {
    if (name === 'src') this.src = '';
  }

  load() {}
}

const cue: RecordedHostCue = { id: 'intro-1', src: '/audio/intro.mp3', durationMs: 1_000 };

function renderAudio(
  currentCue: RecordedHostCue | null = cue,
  overrides: Partial<{ enabled: boolean; paused: boolean; muted: boolean }> = {},
) {
  const onComplete = vi.fn();
  const hook = renderHook(
    ({ activeCue, enabled, paused, muted }) => useRecordedHostAudio(activeCue, {
      enabled,
      paused,
      muted,
      onComplete,
    }),
    {
      initialProps: {
        activeCue: currentCue,
        enabled: overrides.enabled ?? true,
        paused: overrides.paused ?? false,
        muted: overrides.muted ?? false,
      },
    },
  );
  return { ...hook, onComplete };
}

beforeEach(() => {
  MockAudio.instances = [];
  MockAudio.nextPlayResult = null;
  vi.stubGlobal('Audio', class TestAudio extends MockAudio {});
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useRecordedHostAudio', () => {
  it('desbloqueia Safari e reaproveita a mesma instância para o cue', async () => {
    const priming = primeRecordedHostAudio();
    expect(MockAudio.instances).toHaveLength(1);
    expect(MockAudio.instances[0].playCalls).toBe(1);
    await expect(priming).resolves.toBe(true);
    expect(MockAudio.instances[0].pauseCalls).toBe(1);

    const rendered = renderAudio({ ...cue, id: 'after-prime' });
    expect(MockAudio.instances).toHaveLength(1);
    expect(MockAudio.instances[0].playCalls).toBe(2);
    act(() => MockAudio.instances[0].onended?.());
    expect(rendered.onComplete).toHaveBeenCalledWith('after-prime');
  });

  it('não deixa o unlock pausar um cue que venceu a corrida', async () => {
    let resolvePrime!: () => void;
    MockAudio.nextPlayResult = new Promise<void>(resolve => { resolvePrime = resolve; });
    const priming = primeRecordedHostAudio();
    const rendered = renderAudio({ ...cue, id: 'race-1' });
    expect(MockAudio.instances).toHaveLength(1);

    resolvePrime();
    await act(async () => { await priming; });
    expect(MockAudio.instances[0].pauseCalls).toBe(0);
    act(() => MockAudio.instances[0].onended?.());
    expect(rendered.onComplete).toHaveBeenCalledWith('race-1');
  });

  it('restaura o gate montado após o probe do StrictMode', async () => {
    const onComplete = vi.fn();
    renderHook(
      () => useRecordedHostAudio(cue, { enabled: true, paused: false, muted: false, onComplete }),
      { wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode> },
    );
    await act(async () => {});
    expect(MockAudio.instances).toHaveLength(1);
    act(() => MockAudio.instances[0].onended?.());
    expect(onComplete).toHaveBeenCalledWith('intro-1');
  });

  it('toca uma vez por id e reconhece onended', async () => {
    const rendered = renderAudio();
    await act(async () => {});
    expect(MockAudio.instances).toHaveLength(1);
    expect(MockAudio.instances[0].playCalls).toBe(1);

    rendered.rerender({ activeCue: { ...cue }, enabled: true, paused: false, muted: false });
    await act(async () => {});
    expect(MockAudio.instances).toHaveLength(1);

    act(() => MockAudio.instances[0].onended?.());
    expect(rendered.onComplete).toHaveBeenCalledTimes(1);
    expect(rendered.onComplete).toHaveBeenCalledWith('intro-1');
    expect(rendered.result.current.speaking).toBe(false);
  });

  it('reconhece erro de áudio e rejeição de play sem travar', async () => {
    MockAudio.nextPlayResult = Promise.reject(new Error('blocked'));
    const rendered = renderAudio({ ...cue, id: 'intro-2' });
    await act(async () => {});
    expect(rendered.onComplete).toHaveBeenCalledWith('intro-2');
    expect(rendered.result.current.speaking).toBe(false);

    const errorRendered = renderAudio({ ...cue, id: 'error-1' });
    const errorAudio = MockAudio.instances.at(-1)!;
    act(() => errorAudio.onerror?.());
    expect(errorRendered.onComplete).toHaveBeenCalledWith('error-1');
  });

  it('preserva a fala durante pausa e retoma depois', async () => {
    const rendered = renderAudio(cue, { paused: true });
    const audio = MockAudio.instances[0];
    expect(audio.playCalls).toBe(0);
    expect(rendered.result.current.speaking).toBe(true);

    rendered.rerender({ activeCue: cue, enabled: true, paused: false, muted: false });
    await act(async () => {});
    expect(audio.playCalls).toBe(1);
  });

  it('reconhece imediatamente quando desabilitado, silenciado ou oculto', async () => {
    const disabled = renderAudio(cue, { enabled: false });
    await act(async () => {});
    expect(disabled.onComplete).toHaveBeenCalledWith('intro-1');
    disabled.unmount();

    const muted = renderAudio({ ...cue, id: 'muted-1' }, { muted: true });
    await act(async () => {});
    expect(muted.onComplete).toHaveBeenCalledWith('muted-1');
    muted.unmount();

    const hidden = renderAudio({ ...cue, id: 'hidden-1' });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(hidden.onComplete).toHaveBeenCalledWith('hidden-1');
  });

  it('usa timeout duration+3s limitado a 40s e não chama callback após desmontar', async () => {
    vi.useFakeTimers();
    const rendered = renderAudio({ ...cue, id: 'timeout-1', durationMs: 1_000 });
    await act(async () => {});
    act(() => vi.advanceTimersByTime(3_999));
    expect(rendered.onComplete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(rendered.onComplete).toHaveBeenCalledWith('timeout-1');

    const unmounted = renderAudio({ ...cue, id: 'unmounted-1', durationMs: 1_000 });
    const unmountedAudio = MockAudio.instances.at(-1)!;
    unmounted.unmount();
    act(() => unmountedAudio.onended?.());
    expect(unmounted.onComplete).not.toHaveBeenCalled();
  });
});

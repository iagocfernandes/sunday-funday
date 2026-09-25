// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MiguelHostReaction } from './useMiguelHost';
import { useMiguelVoice } from './useMiguelVoice';

class MockUtterance {
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {}
}

const synth = {
  speak: vi.fn<(line: MockUtterance) => void>(),
  cancel: vi.fn(),
  getVoices: vi.fn(() => [{ lang: 'pt-BR' } as SpeechSynthesisVoice]),
};

let visibility: DocumentVisibilityState;

function reaction(messageId: string, text = `Mensagem ${messageId}`): MiguelHostReaction {
  return { messageId, text, visible: true, mood: 'happy', dismiss: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  vi.stubGlobal('speechSynthesis', synth);
  vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useMiguelVoice', () => {
  it('narra cada messageId uma vez e acompanha início e fim reais', () => {
    const { result, rerender } = renderHook(
      ({ item }) => useMiguelVoice(item, { enabled: true, paused: false, muted: false }),
      { initialProps: { item: reaction('m1') } },
    );
    const first = synth.speak.mock.calls[0][0];

    expect(result.current.supported).toBe(true);
    expect(first.text).toBe('Mensagem m1');
    expect(first.lang).toBe('pt-BR');
    expect(first.voice?.lang).toBe('pt-BR');
    act(() => first.onstart?.());
    expect(result.current.speaking).toBe(true);

    rerender({ item: reaction('m1', 'Texto alterado') });
    expect(synth.speak).toHaveBeenCalledTimes(1);

    act(() => first.onend?.());
    expect(result.current.speaking).toBe(false);
    rerender({ item: reaction('m2') });
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });

  it('não reproduz a mensagem que chegou enquanto a voz estava desligada', () => {
    const { rerender } = renderHook(
      ({ item, enabled }) => useMiguelVoice(item, { enabled, paused: false, muted: false }),
      { initialProps: { item: reaction('histórico'), enabled: false } },
    );

    expect(synth.speak).not.toHaveBeenCalled();
    rerender({ item: reaction('histórico'), enabled: true });
    expect(synth.speak).not.toHaveBeenCalled();
    rerender({ item: reaction('novo'), enabled: true });
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it('cancela em pausa e mute e consome mensagens recebidas durante o bloqueio', () => {
    const { result, rerender } = renderHook(
      ({ item, paused, muted }) => useMiguelVoice(item, { enabled: true, paused, muted }),
      { initialProps: { item: reaction('m1'), paused: false, muted: false } },
    );
    const first = synth.speak.mock.calls[0][0];
    act(() => first.onstart?.());

    rerender({ item: reaction('m1'), paused: true, muted: false });
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(result.current.speaking).toBe(false);
    rerender({ item: reaction('m2'), paused: true, muted: false });
    rerender({ item: reaction('m2'), paused: false, muted: false });
    expect(synth.speak).toHaveBeenCalledTimes(1);

    rerender({ item: reaction('m3'), paused: false, muted: false });
    expect(synth.speak).toHaveBeenCalledTimes(2);
    rerender({ item: reaction('m3'), paused: false, muted: true });
    expect(synth.cancel).toHaveBeenCalledTimes(2);
    rerender({ item: reaction('m4'), paused: false, muted: true });
    rerender({ item: reaction('m4'), paused: false, muted: false });
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });

  it('cancela ao ocultar a aba e não narra o estado acumulado ao voltar', () => {
    const { rerender } = renderHook(
      ({ item }) => useMiguelVoice(item, { enabled: true, paused: false, muted: false }),
      { initialProps: { item: reaction('m1') } },
    );

    act(() => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(synth.cancel).toHaveBeenCalledTimes(1);
    rerender({ item: reaction('m2') });
    act(() => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(synth.speak).toHaveBeenCalledTimes(1);

    rerender({ item: reaction('m3') });
    expect(synth.speak).toHaveBeenCalledTimes(2);
  });

  it('remove callbacks e cancela a fala ativa ao desmontar', () => {
    const { unmount } = renderHook(() => (
      useMiguelVoice(reaction('m1'), { enabled: true, paused: false, muted: false })
    ));
    const line = synth.speak.mock.calls[0][0];

    unmount();

    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(line.onstart).toBeNull();
    expect(line.onend).toBeNull();
    expect(line.onerror).toBeNull();
  });
});

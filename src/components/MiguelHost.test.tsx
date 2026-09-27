// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MiguelHostView } from './MiguelHost';

const dismiss = vi.fn();
const reaction = (messageId = 'm1') => ({ messageId, text: 'AR2 reagiu', visible: true, mood: 'happy' as const, dismiss });

let reduced = false;
let visibility: DocumentVisibilityState = 'visible';
let play: ReturnType<typeof vi.fn>;

beforeEach(() => {
  reduced = false;
  visibility = 'visible';
  play = vi.fn(() => Promise.resolve());
  vi.spyOn(window, 'matchMedia').mockImplementation(() => ({ matches: reduced, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as unknown as MediaQueryList);
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  Object.defineProperty(HTMLMediaElement.prototype, 'play', { configurable: true, value: play });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('MiguelHostView video reactions', () => {
  it('keeps the sprite visible until the video has started', async () => {
    const { container } = render(<MiguelHostView enabled reaction={reaction()} videoSrc="/ar2.mp4" />);
    const video = container.querySelector('video')!;
    expect(video.className).toContain('loading');
    await act(async () => { fireEvent.loadedData(video); await Promise.resolve(); });
    expect(play).toHaveBeenCalledOnce();
    expect(video.className).toContain('ready');
  });

  it('plays once when both browser readiness events fire', async () => {
    const { container } = render(<MiguelHostView enabled reaction={reaction('two-events')} videoSrc="/ar2.mp4" />);
    await act(async () => {
      fireEvent.loadedData(container.querySelector('video')!);
      fireEvent.canPlay(container.querySelector('video')!);
      await Promise.resolve();
    });
    expect(play).toHaveBeenCalledOnce();
  });

  it('keeps a successfully started video after its loading timeout would have elapsed', async () => {
    vi.useFakeTimers();
    const { container } = render(<MiguelHostView enabled reaction={reaction('finished-loading')} videoSrc="/ar2.mp4" />);
    await act(async () => { fireEvent.canPlay(container.querySelector('video')!); await Promise.resolve(); });
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(container.querySelector('video')?.className).toContain('ready');
  });

  it('falls back to the sprite when video loading fails', async () => {
    const { container } = render(<MiguelHostView enabled reaction={reaction()} videoSrc="/missing.mp4" />);
    const video = container.querySelector('video')!;
    await act(async () => { fireEvent.error(video); });
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('.miguel-host__sprite')).toBeTruthy();
  });

  it('does not replay a message on a polling rerender', async () => {
    const { container, rerender } = render(<MiguelHostView enabled reaction={reaction('stable')} videoSrc="/ar2.mp4" />);
    await act(async () => { fireEvent.canPlay(container.querySelector('video')!); await Promise.resolve(); });
    rerender(<MiguelHostView enabled reaction={reaction('stable')} videoSrc="/ar2.mp4" />);
    fireEvent.canPlay(container.querySelector('video')!);
    expect(play).toHaveBeenCalledOnce();
  });

  it('plays a new message once even when it reuses the same source', async () => {
    const { container, rerender } = render(<MiguelHostView enabled reaction={reaction('first')} videoSrc="/ar2.mp4" />);
    await act(async () => { fireEvent.canPlay(container.querySelector('video')!); await Promise.resolve(); });
    rerender(<MiguelHostView enabled reaction={reaction('second')} videoSrc="/ar2.mp4" />);
    await act(async () => { fireEvent.canPlay(container.querySelector('video')!); await Promise.resolve(); });
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('ignores a stale play promise after a paused message is replaced', async () => {
    let resolveFirst!: () => void;
    const first = new Promise<void>(resolve => { resolveFirst = resolve; });
    play.mockImplementationOnce(() => first).mockImplementationOnce(() => Promise.resolve());
    const { container, rerender } = render(<MiguelHostView enabled reaction={reaction('first')} videoSrc="/ar2.mp4" />);
    fireEvent.canPlay(container.querySelector('video')!);
    rerender(<MiguelHostView enabled paused reaction={reaction('first')} videoSrc="/ar2.mp4" />);
    rerender(<MiguelHostView enabled reaction={reaction('second')} videoSrc="/ar2.mp4" />);
    await act(async () => { fireEvent.canPlay(container.querySelector('video')!); await Promise.resolve(); });
    await act(async () => { resolveFirst(); await Promise.resolve(); });
    expect(container.querySelector('video')?.className).toContain('ready');
    expect(play).toHaveBeenCalledTimes(2);
  });

  it('removes a video that never reaches a frame after the bounded timeout', async () => {
    vi.useFakeTimers();
    const { container } = render(<MiguelHostView enabled reaction={reaction('slow')} videoSrc="/slow.mp4" />);
    await act(async () => { vi.advanceTimersByTime(2500); });
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('.miguel-host__sprite')).toBeTruthy();
  });

  it('uses only the sprite while paused, hidden, or with reduced motion', () => {
    const paused = render(<MiguelHostView enabled paused reaction={reaction()} videoSrc="/ar2.mp4" />);
    expect(paused.container.querySelector('video')).toBeNull();
    paused.unmount();
    visibility = 'hidden';
    const hidden = render(<MiguelHostView enabled reaction={reaction('hidden')} videoSrc="/ar2.mp4" />);
    expect(hidden.container.querySelector('video')).toBeNull();
    hidden.unmount();
    visibility = 'visible';
    reduced = true;
    const reducedView = render(<MiguelHostView enabled reaction={reaction('reduced')} videoSrc="/ar2.mp4" />);
    expect(reducedView.container.querySelector('video')).toBeNull();
  });
});

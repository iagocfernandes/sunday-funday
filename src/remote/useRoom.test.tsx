// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteSession } from './client';
import type { RoomReply } from './types';
import { useRoom } from './useRoom';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));
vi.mock('./client', () => ({ request: requestMock }));

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(readonly url: string) { FakeWebSocket.instances.push(this); }
  send(value: string) { this.sent.push(value); }
  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED; this.onclose?.();
  }
}

const session: RemoteSession = { code: 'ABC234', token: 'a'.repeat(64) };
const reply: RoomReply = {
  room: {
    code: session.code, revision: 1, mode: 'dice', phase: 'lobby', players: [], activePlayerId: null,
    turn: 0, round: 1, rounds: 3, diceMax: 10, lastRoll: null, rolls: [], advanceAt: null,
    expiresAt: Date.now() + 60_000, board: null,
  },
  playerId: null, role: 'host', serverNow: Date.now(),
};

function Harness() { useRoom(session); return null; }
function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
}

beforeEach(() => {
  vi.useFakeTimers(); requestMock.mockReset().mockResolvedValue(reply); FakeWebSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeWebSocket); setHidden(false);
});

afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); setHidden(false);
});

describe('useRoom network activity', () => {
  it('closes and suspends websocket and HTTP polling while the tab is hidden', async () => {
    render(<Harness />);
    await act(async () => {});
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);

    await act(async () => {
      setHidden(true); document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(FakeWebSocket.instances[0].readyState).toBe(FakeWebSocket.CLOSED);
    expect(requestMock).toHaveBeenCalledTimes(1);
    expect(FakeWebSocket.instances).toHaveLength(1);

    await act(async () => {
      setHidden(false); document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it('does no initial network work when mounted in a hidden tab', async () => {
    setHidden(true); render(<Harness />);
    await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    expect(requestMock).not.toHaveBeenCalled();
    expect(FakeWebSocket.instances).toHaveLength(0);
  });
});

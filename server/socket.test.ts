import { describe, expect, it } from 'vitest';
import {
  ROOM_SOCKET_ACTIVE_POLL_MS,
  ROOM_SOCKET_IDLE_AFTER_UNCHANGED_READS,
  ROOM_SOCKET_IDLE_POLL_MS,
  roomSocketPollDelay,
} from './socket';

describe('room socket polling cadence', () => {
  it('backs off by 50% after two unchanged reads', () => {
    expect(roomSocketPollDelay(0)).toBe(ROOM_SOCKET_ACTIVE_POLL_MS);
    expect(roomSocketPollDelay(ROOM_SOCKET_IDLE_AFTER_UNCHANGED_READS - 1)).toBe(1000);
    expect(roomSocketPollDelay(ROOM_SOCKET_IDLE_AFTER_UNCHANGED_READS)).toBe(2000);
    expect(ROOM_SOCKET_IDLE_POLL_MS / ROOM_SOCKET_ACTIVE_POLL_MS).toBe(2);
  });
});

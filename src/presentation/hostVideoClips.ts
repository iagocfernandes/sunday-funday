import type { MiguelMood } from './useMiguelHost';
import type { HostAudioClip } from './hostAudioCues';

/**
 * Only register generated, reviewed local assets. Missing moments use sprites.
 */
export type HostVideoClip = 'reaction' | HostAudioClip;

export interface HostVideoClipDefinition {
  src: string;
}

/** Default mood reactions, used for ordinary speech bubbles. */
export const HOST_VIDEO_BY_MOOD: Partial<Record<MiguelMood, HostVideoClipDefinition>> = {
  neutral: { src: '/assets/host/video/ar2-welcome.mp4' },
  mischievous: { src: '/assets/host/video/ar2-mischievous.mp4' },
};

/** Named moments such as the recorded welcome/guide announcement. */
export const HOST_VIDEO_BY_CLIP: Partial<Record<HostVideoClip, HostVideoClipDefinition>> = {
  opening: { src: '/assets/host/video/ar2-welcome.mp4' },
  bananaBought: { src: '/assets/host/video/ar2-banana.mp4' },
  bananaStolen: { src: '/assets/host/video/ar2-mischievous.mp4' },
  unluck: { src: '/assets/host/video/ar2-mischievous.mp4' },
  champion: { src: '/assets/host/video/ar2-banana.mp4' },
};

export function hostVideoForMood(mood: MiguelMood, clip: HostVideoClip | string = 'reaction'): HostVideoClipDefinition | undefined {
  return clip === 'reaction' ? HOST_VIDEO_BY_MOOD[mood] : HOST_VIDEO_BY_CLIP[clip as HostVideoClip];
}

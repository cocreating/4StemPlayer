export interface MediaMetadataInit {
  title: string;
  artist: string;
  album: string;
  artwork: Array<{ src: string; sizes: string; type: string }>;
}

const APP_NAME = '4Stem Band Player';

/**
 * Builds the init object for a `MediaMetadata` so lock-screen / Bluetooth
 * controls show the current song. Kept pure (no DOM) so it is unit-testable.
 */
export function buildMediaMetadataInit(title?: string, artist?: string): MediaMetadataInit {
  return {
    title: title?.trim() || APP_NAME,
    artist: artist?.trim() || '',
    album: APP_NAME,
    artwork: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  };
}

/**
 * Clamps a position into a valid `setPositionState` range. Returns `null` when
 * the duration is not a usable, finite, positive number (Media Session throws
 * on invalid values).
 */
export function mediaPositionState(
  duration: number,
  position: number,
  playbackRate = 1
): { duration: number; position: number; playbackRate: number } | null {
  if (!Number.isFinite(duration) || duration <= 0) {
    return null;
  }
  const safePosition = Math.min(Math.max(0, Number.isFinite(position) ? position : 0), duration);
  const safeRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  return { duration, position: safePosition, playbackRate: safeRate };
}

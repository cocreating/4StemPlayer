export type ThemeMode = 'light' | 'dark';

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const THEME_STORAGE_KEY = '4stem-player:theme';
const SELECTED_SONG_STORAGE_KEY = '4stem-player:selected-song';
const LOW_MEMORY_STORAGE_KEY = '4stem-player:low-memory';

export type LowMemoryPreference = 'on' | 'off' | 'auto';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

interface LowMemoryEnvironment {
  navigator?: {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connection?: NetworkInformationLike;
  };
  matchMedia?: (query: string) => { matches: boolean };
}

export function readLowMemoryPreference(
  storage?: Pick<PreferenceStorage, 'getItem'>
): LowMemoryPreference {
  try {
    const stored = storage?.getItem(LOW_MEMORY_STORAGE_KEY);
    if (stored === 'on' || stored === 'off' || stored === 'auto') {
      return stored;
    }
  } catch {
    // Ignore unavailable storage.
  }
  return 'auto';
}

export function saveLowMemoryPreference(
  storage: Pick<PreferenceStorage, 'setItem'> | undefined,
  preference: LowMemoryPreference
) {
  try {
    storage?.setItem(LOW_MEMORY_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable in strict browser privacy modes.
  }
}

/**
 * Best-effort guess of whether this device benefits from the low-memory decode
 * profile: phones (coarse pointer + small screen), explicit data-saver, slow
 * networks, or low device memory / CPU.
 */
export function detectLowMemoryDefault(environment?: LowMemoryEnvironment): boolean {
  const env =
    environment ?? (typeof window === 'undefined' ? undefined : (window as unknown as LowMemoryEnvironment));
  if (!env) {
    return false;
  }

  const navigatorRef = env.navigator;
  const connection = navigatorRef?.connection;
  if (connection?.saveData) {
    return true;
  }
  if (connection?.effectiveType && /(^|\b)(slow-2g|2g|3g)\b/.test(connection.effectiveType)) {
    return true;
  }
  if (typeof navigatorRef?.deviceMemory === 'number' && navigatorRef.deviceMemory <= 4) {
    return true;
  }

  const coarsePointer = env.matchMedia?.('(pointer: coarse)').matches ?? false;
  const smallScreen = env.matchMedia?.('(max-width: 820px)').matches ?? false;
  return coarsePointer && smallScreen;
}

export function resolveLowMemoryActive(
  preference: LowMemoryPreference,
  environment?: LowMemoryEnvironment
): boolean {
  if (preference === 'on') {
    return true;
  }
  if (preference === 'off') {
    return false;
  }
  return detectLowMemoryDefault(environment);
}

export function readStoredTheme(storage?: Pick<PreferenceStorage, 'getItem'>): ThemeMode {
  try {
    return storage?.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveThemePreference(storage: Pick<PreferenceStorage, 'setItem'> | undefined, theme: ThemeMode) {
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable in strict browser privacy modes.
  }
}

export function saveSelectedSongId(storage: Pick<PreferenceStorage, 'setItem'> | undefined, songId: string) {
  try {
    storage?.setItem(SELECTED_SONG_STORAGE_KEY, songId);
  } catch {
    // Storage can be unavailable in strict browser privacy modes.
  }
}

export function resolveInitialSongId(
  songs: readonly Pick<{ id: string }, 'id'>[],
  storage?: Pick<PreferenceStorage, 'getItem'>
) {
  let storedSongId = '';

  try {
    storedSongId = storage?.getItem(SELECTED_SONG_STORAGE_KEY) ?? '';
  } catch {
    storedSongId = '';
  }

  if (storedSongId && songs.some((song) => song.id === storedSongId)) {
    return storedSongId;
  }

  return songs[0]?.id ?? '';
}

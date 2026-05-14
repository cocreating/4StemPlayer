export type ThemeMode = 'light' | 'dark';

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const THEME_STORAGE_KEY = '4stem-player:theme';
const SELECTED_SONG_STORAGE_KEY = '4stem-player:selected-song';

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

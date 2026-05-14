import { describe, expect, it } from 'vitest';
import {
  readStoredTheme,
  resolveInitialSongId,
  saveSelectedSongId,
  saveThemePreference
} from './preferences';

class MemoryStorage {
  private items = new Map<string, string>();

  getItem(key: string) {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.items.set(key, value);
  }
}

describe('theme preferences', () => {
  it('defaults to light mode when no valid preference is stored', () => {
    const storage = new MemoryStorage();
    storage.setItem('4stem-player:theme', 'sepia');

    expect(readStoredTheme(storage)).toBe('light');
  });

  it('reads and saves the selected theme mode', () => {
    const storage = new MemoryStorage();

    saveThemePreference(storage, 'dark');

    expect(readStoredTheme(storage)).toBe('dark');
  });
});

describe('song preferences', () => {
  const songs = [{ id: 'bambola' }, { id: 'glory-box' }, { id: 'send-hlt-me' }];

  it('uses a stored song id when it exists in the manifest', () => {
    const storage = new MemoryStorage();
    saveSelectedSongId(storage, 'glory-box');

    expect(resolveInitialSongId(songs, storage)).toBe('glory-box');
  });

  it('falls back to the first manifest song when the stored song is missing', () => {
    const storage = new MemoryStorage();
    saveSelectedSongId(storage, 'deleted-song');

    expect(resolveInitialSongId(songs, storage)).toBe('bambola');
  });
});

import { describe, expect, it } from 'vitest';
import {
  detectLowMemoryDefault,
  readLowMemoryPreference,
  readSongMixPreferences,
  readStoredTheme,
  resolveInitialSongId,
  resolveLowMemoryActive,
  saveLowMemoryPreference,
  saveSelectedSongId,
  saveSongMixPreferences,
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

describe('song mix preferences', () => {
  it('returns null when no mix preferences are saved for a song', () => {
    const storage = new MemoryStorage();
    expect(readSongMixPreferences(storage, 'bambola')).toBeNull();
    expect(readSongMixPreferences(undefined, 'bambola')).toBeNull();
    expect(readSongMixPreferences(storage, '')).toBeNull();
  });

  it('saves and reads custom stem volume, mute, and solo states per song', () => {
    const storage = new MemoryStorage();
    const customMix = {
      vocals: { volume: 0.8, muted: true },
      drums: { volume: 1, solo: true },
      bass: { volume: 0.6 }
    };

    saveSongMixPreferences(storage, 'bambola', customMix);
    expect(readSongMixPreferences(storage, 'bambola')).toEqual(customMix);
    expect(readSongMixPreferences(storage, 'glory-box')).toBeNull();
  });

  it('gracefully handles invalid JSON in storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('4stem-player:mix:bambola', 'invalid json string');
    expect(readSongMixPreferences(storage, 'bambola')).toBeNull();
  });
});

describe('low-memory preferences', () => {
  const desktopEnv = {
    navigator: { deviceMemory: 16, connection: { saveData: false, effectiveType: '4g' } },
    matchMedia: () => ({ matches: false })
  };

  it('defaults to auto when nothing valid is stored', () => {
    const storage = new MemoryStorage();
    expect(readLowMemoryPreference(storage)).toBe('auto');

    storage.setItem('4stem-player:low-memory', 'nonsense');
    expect(readLowMemoryPreference(storage)).toBe('auto');
  });

  it('round-trips an explicit on/off preference', () => {
    const storage = new MemoryStorage();
    saveLowMemoryPreference(storage, 'on');
    expect(readLowMemoryPreference(storage)).toBe('on');
    saveLowMemoryPreference(storage, 'off');
    expect(readLowMemoryPreference(storage)).toBe('off');
  });

  it('honors explicit on/off regardless of the environment', () => {
    expect(resolveLowMemoryActive('on', desktopEnv)).toBe(true);
    expect(
      resolveLowMemoryActive('off', {
        navigator: { connection: { saveData: true } },
        matchMedia: () => ({ matches: true })
      })
    ).toBe(false);
  });

  it('auto-enables on data-saver, slow networks, low memory, or phone form factors', () => {
    expect(detectLowMemoryDefault({ navigator: { connection: { saveData: true } } })).toBe(true);
    expect(detectLowMemoryDefault({ navigator: { connection: { effectiveType: '3g' } } })).toBe(true);
    expect(detectLowMemoryDefault({ navigator: { deviceMemory: 2 } })).toBe(true);
    expect(
      detectLowMemoryDefault({
        navigator: {},
        matchMedia: (query: string) =>
          ({ matches: query.includes('coarse') || query.includes('820px') })
      })
    ).toBe(true);
  });

  it('stays off on a capable desktop environment', () => {
    expect(detectLowMemoryDefault(desktopEnv)).toBe(false);
    expect(resolveLowMemoryActive('auto', desktopEnv)).toBe(false);
  });
});

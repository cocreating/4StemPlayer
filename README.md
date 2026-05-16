# 4Stem Band Player

A SvelteKit-based static web app for playing song stems.

## Songs

Song assets live in `static/songs/<SongFolder>/`.

Each song folder should include:

```text
song.json
lyrics.md
<SongFolder>_bass.mp3
<SongFolder>_drums.mp3
<SongFolder>_vocals.mp3
```

The required stems are `bass`, `drums`, and `vocals`. `other` and any additional stems are optional and are discovered automatically when they follow the same suffix pattern:

```text
<SongFolder>_other.mp3
<SongFolder>_keyboards.mp3
<SongFolder>_guitar.mp3
<SongFolder>_other2.mp3
```

Preferred stems render first in the player when present. Any future stems that are not in the preferred order still appear automatically after those stems.

To remove an optional stem from one song, delete its `.mp3` and matching `.peaks.json` file from `static/songs/<SongFolder>/`, then run `npm run songs:prepare` and `npm run build`.

After adding or replacing song files, run:

```bash
npm run songs:prepare
```

This validates song metadata, generates missing waveform peak files, and regenerates `static/songs/manifest.json`.

## Build

```bash
npm install
npm run build
```

## Browser preferences

The player remembers two local browser preferences:

- the selected light or dark theme
- the last selected song

Both preferences are stored in `localStorage` on the user's browser. If a stored song is no longer present in the manifest, the player falls back to the first available song.

## Player controls

The transport panel displays the currently selected song title above the main Play and Stop buttons.

Each stem row starts collapsed. Use the right-aligned switch in the stem controls to expand or collapse the waveform and volume controls for that stem.

Loading states use an indeterminate progress bar and skeleton placeholders while the song library, metadata, lyrics, stems, and waveforms are being prepared.

## Transpose approach

Future transpose controls should keep the current zero-cost playback path when no pitch shift is active. Global transpose should apply only to harmonic stems, not drums, and per-stem pitch correction should also be disabled for drums. When pitch shift is active, use a tempo-preserving pitch processor in the Web Audio graph rather than native `AudioBufferSourceNode.detune`, because detune changes playback rate and can desync stems.

## Vercel deployment

This project uses a static build output configured to `build/`.

- Build command: `npm run build`
- Output directory: `public`

A `vercel.json` file is included to tell Vercel to use `@vercel/static-build` and the `build` directory.

## Notes

- The application is built with SvelteKit and `@sveltejs/adapter-static`.
- Static site files are written to `public/`.
- `npm run build` copies the current `static/songs` content into `public/songs` for deployment.

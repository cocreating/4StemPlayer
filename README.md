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
<SongFolder>_other.mp3
```

The four core stems are required. Extra stems are optional and are discovered automatically when they follow the same suffix pattern:

```text
<SongFolder>_keyboards.mp3
<SongFolder>_guitar.mp3
<SongFolder>_other2.mp3
```

Core stems render first in the player, followed by extra stems in alphabetical order.

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

Each stem row starts expanded. Use the switch beside the stem title to collapse or expand the waveform and volume controls for that stem.

## Vercel deployment

This project uses a static build output configured to `build/`.

- Build command: `npm run build`
- Output directory: `public`

A `vercel.json` file is included to tell Vercel to use `@vercel/static-build` and the `build` directory.

## Notes

- The application is built with SvelteKit and `@sveltejs/adapter-static`.
- Static site files are written to `public/`.
- `npm run build` copies the current `static/songs` content into `public/songs` for deployment.

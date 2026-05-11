# Song Ingestion Workflow

Last reviewed: 2026-05-11

This document explains the CLI-only process for adding songs to 4Stem Band Player.

## Folder Layout

Create one folder per song under `static/songs/`.

Example:

```text
static/songs/MySong/
  song.json
  lyrics.md
  MySong_bass.mp3
  MySong_drums.mp3
  MySong_vocals.mp3
  MySong_other.mp3
```

Each song must provide exactly these four stems:

- `bass`
- `drums`
- `vocals`
- `other`

Stem files can use either folder-name or song-title prefixes. Folder-name prefixes are recommended because they keep URLs compact and avoid spaces:

```text
MySong_bass.mp3
MySong_drums.mp3
MySong_vocals.mp3
MySong_other.mp3
```

or:

```text
My Song_bass.mp3
My Song_drums.mp3
My Song_vocals.mp3
My Song_other.mp3
```

## Step 1: Add The Song Folder

Create a folder in `static/songs/` with a stable URL-safe folder name.

Good folder names:

```text
GloryBox
MyNewSong
BlueMonday
```

Avoid spaces in folder names. Spaces in MP3 filenames are supported, but folder names are also used as song ids.

## Step 2: Add `song.json`

Create `static/songs/<Folder>/song.json`.

Example:

```json
{
  "title": "My Song",
  "artist": "My Band",
  "key": "A minor",
  "bpm": 120,
  "timeSignature": "4/4",
  "chords": {
    "intro": {
      "progression": "Am | F | C | G"
    },
    "verse": {
      "label": "Verse 1",
      "progression": "Am | F | C | G",
      "notes": "Repeat twice."
    },
    "chorus": {
      "progression": "F | G | Am | Am"
    }
  },
  "notes": "Optional rehearsal notes.",
  "sections": [
    { "label": "Intro", "start": 0 },
    { "label": "Verse", "start": 8 },
    { "label": "Chorus", "start": 32 }
  ]
}
```

Required fields:

- `title`
- `artist`
- `key`
- `bpm`
- `timeSignature`

Optional fields:

- `chords`
- `notes`
- `lyrics`
- `sections`

Section `start` values are seconds from the beginning of the song.

The recommended `chords` format is a section object. The object keys are stable section ids, and each value describes the chord progression for that section:

```json
{
  "chords": {
    "intro": {
      "progression": "Am | F | C | G"
    },
    "verse": {
      "label": "Verse 1",
      "progression": "Am | F | C | G",
      "notes": "Repeat twice."
    },
    "chorus": {
      "progression": "F | G | Am | Am"
    }
  }
}
```

Each chord section object supports:

- `progression`: required chord text.
- `label`: optional display label. If omitted, the section key is title-cased.
- `notes`: optional note displayed after the progression.

A compact string value is also supported for a section:

```json
{
  "chords": {
    "intro": "Am | F | C | G",
    "chorus": "F | G | Am | Am"
  }
}
```

## Step 3: Add `lyrics.md`

Create `static/songs/<Folder>/lyrics.md`.

Example:

```markdown
# My Song

[Verse]
First lyric line.
Second lyric line.

[Chorus]
Chorus lyric line.
```

The file must exist. Empty lyrics are allowed, but the validation script reports a warning.

## Step 4: Add The Four MP3 Stems

Place the four required MP3 files in the song folder.

Example:

```text
static/songs/MySong/MySong_bass.mp3
static/songs/MySong/MySong_drums.mp3
static/songs/MySong/MySong_vocals.mp3
static/songs/MySong/MySong_other.mp3
```

All four files must be non-empty.

## Step 5: Prepare The Song Catalog

Run:

```bash
npm run songs:prepare
```

This command performs the normal local ingestion workflow:

1. Validates all song folders.
2. Generates missing or outdated waveform peak files.
3. Regenerates `static/songs/manifest.json`.

If validation fails, fix the reported file or metadata issue and run the command again.

## Step 6: Run Release Validation

Before committing, pushing, or deploying song changes, run:

```bash
npm run songs:release
```

This command performs the full release workflow:

1. Validates all song folders.
2. Generates missing or outdated waveform peak files.
3. Regenerates `static/songs/manifest.json`.
4. Runs `npm run check`.
5. Runs `npm test`.
6. Runs `npm run build`.

## Useful Flags

Skip peak generation:

```bash
npm run songs:prepare -- --skip-peaks
```

Force all peak files to be regenerated:

```bash
npm run songs:prepare -- --force-peaks
```

Run release validation without building:

```bash
npm run songs:release -- --skip-build
```

Use a different songs root:

```bash
npm run songs:prepare -- --songs-root path/to/songs
```

Flags can be combined:

```bash
npm run songs:release -- --force-peaks --skip-build
```

## Low-Level Commands

The workflow commands are wrappers around the lower-level scripts:

```bash
npm run songs:validate
npm run songs:peaks
npm run songs:manifest
npm run check
npm test
npm run build
```

Use the low-level commands when debugging a specific part of the process. Use `songs:prepare` and `songs:release` for normal work.

## Troubleshooting

`missing <stem> stem mp3`

The folder does not contain one of the four required stem files. Check that the filename ends with `_bass.mp3`, `_drums.mp3`, `_vocals.mp3`, or `_other.mp3`.

`song.json: missing <field>`

Add the required metadata field to `song.json`.

`bpm must be a number`

Use a JSON number, not a string:

```json
{ "bpm": 120 }
```

`Peak generation requires ffmpeg to be available on PATH.`

Install `ffmpeg`, then rerun `npm run songs:prepare`.

Waveforms do not update after replacing MP3 files.

Run:

```bash
npm run songs:prepare -- --force-peaks
```

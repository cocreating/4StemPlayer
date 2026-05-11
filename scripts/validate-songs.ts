import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  REQUIRED_STEMS,
  fileSize,
  expectedStemFileNames,
  listSongFolders,
  pathExists,
  readSongJson,
  resolveStemFile
} from './song-utils';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_SONG_FIELDS = ['title', 'artist', 'key', 'bpm', 'timeSignature'] as const;

function isMissing(value: unknown) {
  return value === undefined || value === null || value === '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateChords(folder: string, chords: unknown, errors: string[]) {
  if (chords === undefined) {
    return;
  }

  if (typeof chords === 'string') {
    return;
  }

  if (!isRecord(chords)) {
    errors.push(`${folder}/song.json: chords must be a string or section object`);
    return;
  }

  for (const [sectionKey, sectionValue] of Object.entries(chords)) {
    if (typeof sectionValue === 'string') {
      continue;
    }

    if (!isRecord(sectionValue)) {
      errors.push(`${folder}/song.json: chords.${sectionKey} must be a string or object`);
      continue;
    }

    if (typeof sectionValue.progression !== 'string' || sectionValue.progression.trim() === '') {
      errors.push(`${folder}/song.json: chords.${sectionKey}.progression must be a string`);
    }

    if (
      sectionValue.label !== undefined &&
      (typeof sectionValue.label !== 'string' || sectionValue.label.trim() === '')
    ) {
      errors.push(`${folder}/song.json: chords.${sectionKey}.label must be a string`);
    }

    if (
      sectionValue.notes !== undefined &&
      (typeof sectionValue.notes !== 'string' || sectionValue.notes.trim() === '')
    ) {
      errors.push(`${folder}/song.json: chords.${sectionKey}.notes must be a string`);
    }
  }
}

export async function validateSongs(songsRoot = resolve('static/songs')): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!(await pathExists(songsRoot))) {
    return {
      ok: false,
      errors: [`${songsRoot}: songs folder does not exist`],
      warnings
    };
  }

  const folders = await listSongFolders(songsRoot);
  if (folders.length === 0) {
    warnings.push(`${songsRoot}: no song folders found`);
  }

  for (const folder of folders) {
    const songDir = join(songsRoot, folder);
    const songJsonPath = join(songDir, 'song.json');
    const lyricsPath = join(songDir, 'lyrics.md');

    if (!(await pathExists(songJsonPath))) {
      errors.push(`${folder}/song.json: file is missing`);
    } else {
      let title = folder;
      try {
        const songJson = await readSongJson(songJsonPath);
        title = typeof songJson.title === 'string' && songJson.title ? songJson.title : folder;
        for (const field of REQUIRED_SONG_FIELDS) {
          if (isMissing(songJson[field])) {
            errors.push(`${folder}/song.json: missing ${field}`);
          }
        }
        if (typeof songJson.bpm !== 'number') {
          errors.push(`${folder}/song.json: bpm must be a number`);
        }
        if (songJson.duration !== undefined && typeof songJson.duration !== 'string') {
          errors.push(`${folder}/song.json: duration must be a string`);
        }
        if (
          songJson.durationSeconds !== undefined &&
          (typeof songJson.durationSeconds !== 'number' || !Number.isFinite(songJson.durationSeconds))
        ) {
          errors.push(`${folder}/song.json: durationSeconds must be a number`);
        }
        validateChords(folder, songJson.chords, errors);
        if (songJson.sections) {
          songJson.sections.forEach((section, index) => {
            if (isMissing(section.label)) {
              errors.push(`${folder}/song.json: sections[${index}].label is required`);
            }
            if (typeof section.start !== 'number') {
              errors.push(`${folder}/song.json: sections[${index}].start must be a number`);
            }
          });
        }
      } catch (error) {
        errors.push(
          `${folder}/song.json: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (!(await pathExists(lyricsPath))) {
        errors.push(`${folder}/lyrics.md: file is missing`);
      } else if ((await fileSize(lyricsPath)) === 0) {
        warnings.push(`${folder}/lyrics.md: file is empty`);
      }

      for (const stem of REQUIRED_STEMS) {
        const fileName = await resolveStemFile(songDir, folder, title, stem);
        if (!fileName) {
          const expected = expectedStemFileNames(folder, title, stem).join(' or ');
          errors.push(`${folder}: missing ${stem} stem mp3; expected ${expected}`);
        } else if ((await fileSize(join(songDir, fileName))) === 0) {
          errors.push(`${folder}/${fileName}: file is empty`);
        }
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

async function main() {
  const songsRoot = resolve(process.argv[2] ?? 'static/songs');
  const result = await validateSongs(songsRoot);

  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`Error: ${error}`);
    }
    process.exit(1);
  }

  console.log(`Validated songs in ${songsRoot}.`);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

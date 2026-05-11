import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSongManifest } from './generate-song-manifest';
import { generatePeaksForSongs } from './generate-peaks';
import { validateSongs } from './validate-songs';

export interface RefreshSongsOptions {
  songsRoot?: string;
  release?: boolean;
  skipPeaks?: boolean;
  forcePeaks?: boolean;
  skipBuild?: boolean;
}

export interface RefreshSongsDeps {
  validateSongs: typeof validateSongs;
  generatePeaksForSongs: typeof generatePeaksForSongs;
  createSongManifest: typeof createSongManifest;
  runCommand: (command: string, args: string[]) => Promise<void>;
  log: (message: string) => void;
  warn: (message: string) => void;
}

const defaultDeps: RefreshSongsDeps = {
  validateSongs,
  generatePeaksForSongs,
  createSongManifest,
  runCommand,
  log: console.log,
  warn: console.warn
};

export function parseRefreshSongsArgs(args: string[]): RefreshSongsOptions {
  const options: RefreshSongsOptions = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--release') {
      options.release = true;
    } else if (arg === '--skip-peaks') {
      options.skipPeaks = true;
    } else if (arg === '--force-peaks') {
      options.forcePeaks = true;
    } else if (arg === '--skip-build') {
      options.skipBuild = true;
    } else if (arg === '--songs-root') {
      const nextValue = args[index + 1];
      if (!nextValue) {
        throw new Error('--songs-root requires a path value');
      }
      options.songsRoot = nextValue;
      index += 1;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

export async function refreshSongs(
  options: RefreshSongsOptions = {},
  deps: RefreshSongsDeps = defaultDeps
) {
  const songsRoot = options.songsRoot ?? resolve('static/songs');

  deps.log(`Validating songs in ${songsRoot}...`);
  const validation = await deps.validateSongs(songsRoot);
  for (const warning of validation.warnings) {
    deps.warn(`Warning: ${warning}`);
  }
  if (!validation.ok) {
    for (const error of validation.errors) {
      deps.warn(`Error: ${error}`);
    }
    throw new Error('Song validation failed.');
  }

  if (options.skipPeaks) {
    deps.log('Skipping waveform peak generation.');
  } else {
    deps.log(options.forcePeaks ? 'Regenerating waveform peaks...' : 'Generating missing waveform peaks...');
    const written = await deps.generatePeaksForSongs(songsRoot, { force: options.forcePeaks ?? false });
    deps.log(`Wrote ${written.length} peak file(s).`);
  }

  deps.log('Regenerating song manifest...');
  const manifest = await deps.createSongManifest(songsRoot, { writeFile: true });
  deps.log(`Wrote manifest with ${manifest.songs.length} song(s).`);

  if (!options.release) {
    return;
  }

  await deps.runCommand('npm', ['run', 'check']);
  await deps.runCommand('npm', ['test']);
  if (options.skipBuild) {
    deps.log('Skipping production build.');
  } else {
    await deps.runCommand('npm', ['run', 'build']);
  }
}

async function runCommand(command: string, args: string[]) {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32'
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const options = parseRefreshSongsArgs(process.argv.slice(2));
  await refreshSongs(options);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}

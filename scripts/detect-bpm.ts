import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSongFolders, readSongJson, resolveStemFile, type SongJson } from './song-utils';

interface AudioSamples {
  samples: Float32Array;
  sampleRate: number;
}

interface DetectBpmDeps {
  readSamples?: (inputPath: string) => Promise<AudioSamples>;
  estimateBpm?: (samples: Float32Array, sampleRate: number) => number;
}

export interface DetectBpmResult {
  updated: string[];
  warnings: string[];
}

const DETECTION_SAMPLE_RATE = 11025;
const MIN_BPM = 50;
const MAX_BPM = 200;

async function readSamplesWithFfmpeg(inputPath: string): Promise<AudioSamples> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolvePromise, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-v',
      'error',
      '-i',
      inputPath,
      '-ac',
      '1',
      '-ar',
      String(DETECTION_SAMPLE_RATE),
      '-f',
      'f32le',
      'pipe:1'
    ]);
    ffmpeg.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    ffmpeg.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));
    ffmpeg.on('error', reject);
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        reject(new Error(`ffmpeg exited with code ${code} for ${inputPath}`));
      }
    });
  });

  const buffer = Buffer.concat(chunks);
  return {
    samples: new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT),
    sampleRate: DETECTION_SAMPLE_RATE
  };
}

function clampBpm(value: number) {
  return Math.min(MAX_BPM, Math.max(MIN_BPM, value));
}

function normalizeDetectedBpm(bpm: number) {
  let normalized = bpm;
  while (normalized < 80) {
    normalized *= 2;
  }
  while (normalized > 180) {
    normalized /= 2;
  }
  return normalized;
}

export function estimateBpmFromSamples(samples: Float32Array, sampleRate: number) {
  if (samples.length === 0 || sampleRate <= 0) {
    throw new Error('Cannot estimate BPM from empty audio samples.');
  }

  const frameSize = Math.max(1, Math.floor(sampleRate * 0.02));
  const hopSize = Math.max(1, Math.floor(frameSize / 2));
  const energies: number[] = [];

  for (let index = 0; index < samples.length; index += hopSize) {
    let sum = 0;
    const end = Math.min(samples.length, index + frameSize);
    for (let sampleIndex = index; sampleIndex < end; sampleIndex += 1) {
      const sample = samples[sampleIndex] ?? 0;
      sum += sample * sample;
    }
    energies.push(Math.sqrt(sum / Math.max(1, end - index)));
  }

  const flux = energies.map((energy, index) => Math.max(0, energy - (energies[index - 1] ?? 0)));
  const framesPerSecond = sampleRate / hopSize;
  let bestBpm = 0;
  let bestLag = 0;
  let bestScore = -Infinity;

  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 1) {
    const lag = Math.round((60 / bpm) * framesPerSecond);
    if (lag <= 0 || lag >= flux.length) {
      continue;
    }

    let score = 0;
    for (let index = lag; index < flux.length; index += 1) {
      score += flux[index] * flux[index - lag];
    }

    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
      bestLag = lag;
    }
  }

  if (!Number.isFinite(bestScore) || bestScore <= 0 || bestBpm <= 0) {
    throw new Error('Could not detect a reliable BPM.');
  }

  const exactBpm = bestLag > 0 ? (60 * framesPerSecond) / bestLag : bestBpm;
  return Math.round(clampBpm(normalizeDetectedBpm(exactBpm)));
}

async function writeSongJson(songJsonPath: string, songJson: SongJson) {
  await mkdir(dirname(songJsonPath), { recursive: true });
  await writeFile(songJsonPath, `${JSON.stringify(songJson, null, 2)}\n`);
}

export async function detectBpmForSongs(
  songsRoot = resolve('static/songs'),
  deps: DetectBpmDeps = {}
): Promise<DetectBpmResult> {
  const readSamples = deps.readSamples ?? readSamplesWithFfmpeg;
  const estimateBpm = deps.estimateBpm ?? estimateBpmFromSamples;
  const updated: string[] = [];
  const warnings: string[] = [];

  for (const folder of await listSongFolders(songsRoot)) {
    const songDir = join(songsRoot, folder);
    const songJsonPath = join(songDir, 'song.json');
    try {
      const songJson = await readSongJson(songJsonPath);
      const drumsFile = await resolveStemFile(songDir, folder, songJson.title, 'drums');
      if (!drumsFile) {
        warnings.push(`${folder}: skipping BPM detection because the drums stem is missing.`);
        continue;
      }

      const { samples, sampleRate } = await readSamples(join(songDir, drumsFile));
      const detectedBpm = Math.round(estimateBpm(samples, sampleRate));
      if (!Number.isFinite(detectedBpm) || detectedBpm <= 0) {
        throw new Error(`invalid detected BPM: ${detectedBpm}`);
      }

      if (songJson.bpm !== detectedBpm) {
        songJson.bpm = detectedBpm;
        await writeSongJson(songJsonPath, songJson);
        updated.push(songJsonPath);
      }
    } catch (error) {
      warnings.push(`${folder}: BPM detection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { updated, warnings };
}

async function main() {
  const songsRoot = resolve(process.argv[2] ?? 'static/songs');
  const result = await detectBpmForSongs(songsRoot);
  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }
  console.log(`Updated BPM metadata for ${result.updated.length} song(s).`);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('BPM detection requires ffmpeg to be available on PATH.');
    process.exit(1);
  });
}

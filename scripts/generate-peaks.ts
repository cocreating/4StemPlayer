import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import {
  REQUIRED_STEMS,
  listSongFolders,
  readSongJson,
  resolveStemFile,
  stemPeakFileName
} from './song-utils';

interface PeaksFile {
  sampleRate: number;
  samplesPerPixel: number;
  peaks: number[];
}

async function runFfmpegForSamples(inputPath: string): Promise<Float32Array> {
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
      '8000',
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
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
}

export function computePeaks(samples: Float32Array, samplesPerPixel = 512) {
  const peaks: number[] = [];
  for (let index = 0; index < samples.length; index += samplesPerPixel) {
    let max = 0;
    const end = Math.min(index + samplesPerPixel, samples.length);
    for (let sampleIndex = index; sampleIndex < end; sampleIndex += 1) {
      max = Math.max(max, Math.abs(samples[sampleIndex] ?? 0));
    }
    peaks.push(Number(max.toFixed(4)));
  }
  return peaks;
}

export async function generatePeaksForSongs(songsRoot = resolve('static/songs')) {
  const folders = await listSongFolders(songsRoot);
  const written: string[] = [];

  for (const folder of folders) {
    const songDir = join(songsRoot, folder);
    const songJson = await readSongJson(join(songDir, 'song.json'));
    for (const stem of REQUIRED_STEMS) {
      const stemFile = await resolveStemFile(songDir, folder, songJson.title, stem);
      if (!stemFile) {
        throw new Error(`${folder}: missing ${stem} stem`);
      }
      const stemPath = join(songDir, stemFile);
      const samples = await runFfmpegForSamples(stemPath);
      const output: PeaksFile = {
        sampleRate: 8000,
        samplesPerPixel: 512,
        peaks: computePeaks(samples)
      };
      const outputPath = join(songDir, stemPeakFileName(stemFile));
      await mkdir(songDir, { recursive: true });
      await writeFile(outputPath, `${JSON.stringify(output)}\n`);
      written.push(outputPath);
    }
  }

  return written;
}

async function main() {
  const songsRoot = resolve(process.argv[2] ?? 'static/songs');
  const written = await generatePeaksForSongs(songsRoot);
  console.log(`Wrote ${written.length} peak file(s).`);
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isCli) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    console.error('Peak generation requires ffmpeg to be available on PATH.');
    process.exit(1);
  });
}

import { readFileSync } from 'node:fs';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

// Prefer the deploy's git sha (set by Vercel) so the badge identifies the exact
// build; fall back to a local build timestamp for `npm run build` / dev.
const commitSha = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? '').slice(0, 7);
const buildStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
const appVersion = `v${pkg.version} · ${commitSha || buildStamp}`;

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']
  }
});

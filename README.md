# 4Stem Band Player

A SvelteKit-based static web app for playing song stems.

## Build

```bash
npm install
npm run build
```

## Vercel deployment

This project uses a static build output configured to `build/`.

- Build command: `npm run build`
- Output directory: `build`

A `vercel.json` file is included to tell Vercel to use `@vercel/static-build` and the `build` directory.

## Notes

- The application is built with SvelteKit and `@sveltejs/adapter-static`.
- Static site files are written to `build/`.

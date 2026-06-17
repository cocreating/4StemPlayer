declare global {
  namespace App {}

  /** Build version string injected by Vite (`define`). */
  const __APP_VERSION__: string;
}

declare module '*?url' {
  const url: string;
  export default url;
}

export {};

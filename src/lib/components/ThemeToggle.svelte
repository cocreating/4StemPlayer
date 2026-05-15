<script lang="ts">
  import type { ThemeMode } from '$lib/preferences';

  type Props = {
    theme?: ThemeMode;
    toggle?: () => void;
  };

  let { theme = 'light', toggle = () => {} }: Props = $props();

  let isDark = $derived(theme === 'dark');
  let label = $derived(`Switch to ${isDark ? 'light' : 'dark'} mode`);
</script>

<button
  type="button"
  class="theme-toggle"
  class:theme-toggle-dark={isDark}
  role="switch"
  aria-checked={isDark}
  aria-label={label}
  title={label}
  onclick={toggle}
>
  <span class="theme-toggle-icon theme-toggle-sun" aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
    </svg>
  </span>
  <span class="theme-toggle-icon theme-toggle-moon" aria-hidden="true">
    <svg viewBox="0 0 24 24" focusable="false">
      <path d="M21 14.6A8.8 8.8 0 0 1 9.4 3a7 7 0 1 0 11.6 11.6Z" />
    </svg>
  </span>
  <span class="theme-toggle-thumb" aria-hidden="true">
    {#if isDark}
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M21 14.6A8.8 8.8 0 0 1 9.4 3a7 7 0 1 0 11.6 11.6Z" />
      </svg>
    {:else}
      <svg viewBox="0 0 24 24" focusable="false">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6" />
      </svg>
    {/if}
  </span>
</button>

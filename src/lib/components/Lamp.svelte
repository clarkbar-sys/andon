<script lang="ts">
  import { LAMP_WORDS, type LampState } from '../ui';

  let { state = 'clear', label }: { state?: LampState; label?: string } = $props();
</script>

<span class="lamp {state}" role="img" aria-label={label ?? LAMP_WORDS[state]}></span>

<style>
  .lamp {
    display: block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 10px 2px var(--green);
  }

  .waiting {
    background: var(--amber);
    box-shadow: 0 0 10px 2px var(--amber);
  }

  .pulled {
    background: var(--red);
    box-shadow: 0 0 12px 3px var(--red);
    animation: blink 1s steps(2, jump-none) infinite;
  }

  @keyframes blink {
    50% {
      box-shadow: 0 0 18px 6px var(--red);
    }
  }
</style>

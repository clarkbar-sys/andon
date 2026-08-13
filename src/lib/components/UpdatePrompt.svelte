<script lang="ts">
  import { applyUpdate, serviceWorker } from '../pwa.svelte';
</script>

{#if serviceWorker.updateReady}
  <div class="prompt" role="status">
    <span>New build on the floor.</span>
    <button class="btn primary" onclick={applyUpdate}>Restart</button>
  </div>
{/if}

<style>
  .prompt {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: max(12px, env(safe-area-inset-bottom));
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--card);
    border: 1px solid var(--card-line);
    border-radius: var(--radius);
    padding: 10px 12px;
    font-family: var(--mono);
    font-size: 12px;
    box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.9);
  }

  .prompt .btn {
    width: auto;
    flex: 0 0 auto;
  }
</style>

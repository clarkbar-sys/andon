<script lang="ts">
  import Lamp from './Lamp.svelte';

  let {
    reason,
    problems = [],
    detail,
    busy = false,
    onRetry,
    onSignOut,
  }: {
    reason: string;
    /** Every fault in a bad config, so one edit can fix the whole line. */
    problems?: string[];
    detail?: import('svelte').Snippet;
    busy?: boolean;
    onRetry: () => void;
    onSignOut: () => void;
  } = $props();

  // A single problem is already the reason; a list is worth spelling out.
  const list = $derived(problems.length > 1 ? problems : []);
</script>

<div class="down" role="alert">
  <div class="head">
    <Lamp state="pulled" label="line stopped" />
    <h1>Line stopped</h1>
  </div>

  <p class="reason">{reason}</p>

  {#if list.length > 0}
    <ul class="faults">
      {#each list as problem (problem)}
        <li>{problem}</li>
      {/each}
    </ul>
  {/if}

  {#if detail}
    <div class="detail">{@render detail()}</div>
  {/if}

  <div class="acts">
    <button class="btn primary" onclick={onRetry} disabled={busy}>{busy ? 'Reading…' : 'Try again'}</button>
    <button class="btn" onclick={onSignOut}>Clock out</button>
  </div>
</div>

<style>
  .down {
    flex: 1;
    padding: max(32px, env(safe-area-inset-top)) 20px 24px;
    max-width: 460px;
    width: 100%;
    margin: 0 auto;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }

  h1 {
    font-family: var(--display);
    font-weight: 400;
    text-transform: uppercase;
    font-size: 40px;
    letter-spacing: 0.02em;
    line-height: 1;
    margin: 0;
  }

  .reason {
    color: var(--paper);
    font-size: 14.5px;
    margin: 0 0 14px;
  }

  .faults {
    margin: 0 0 16px;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.45;
    color: var(--steel);
  }

  .faults li::marker {
    color: var(--red);
  }

  .detail {
    color: var(--steel);
    font-size: 14.5px;
  }

  .acts {
    display: flex;
    gap: 8px;
  }
</style>

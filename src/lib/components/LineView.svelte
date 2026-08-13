<script lang="ts">
  import { ForgeError, parseRepoRef } from '../forge';
  import { LINE_CONFIG_PATH, loadLine, type LineLoad } from '../line';
  import { clientFor, session, signOut } from '../settings.svelte';
  import Belt from './Belt.svelte';
  import Hud from './Hud.svelte';

  let load = $state<LineLoad | null>(null);
  let error = $state<string | null>(null);
  let busy = $state(false);

  const repo = $derived(session.settings.repo);

  async function refresh() {
    const token = session.token;
    if (!token) return;
    busy = true;
    try {
      load = await loadLine(clientFor(session.settings, token), session.settings.repo);
      error = null;
    } catch (cause) {
      if (cause instanceof ForgeError && cause.kind === 'unauthorized') {
        signOut();
        return;
      }
      error = cause instanceof Error ? cause.message : 'Could not read the line.';
    } finally {
      busy = false;
    }
  }

  // First paint, and again whenever the belt is pointed at another repo.
  $effect(() => {
    void repo;
    void refresh();
  });

  const configUrl = $derived.by(() => {
    const token = session.token;
    if (!token) return null;
    try {
      return clientFor(session.settings, token).webUrl(parseRepoRef(repo), LINE_CONFIG_PATH);
    } catch {
      return null;
    }
  });

  const subtitle = $derived(load?.source === 'cache' ? `${repo} · cached` : repo);
</script>

<div class="view">
  {#if load}
    <Hud line={load.line} {subtitle} />

    {#if load.staleReason}
      <p class="notice" role="status">{load.staleReason}</p>
    {:else if error}
      <p class="notice" role="status">{error}</p>
    {/if}

    <Belt stations={load.line.stations} />

    <footer>
      <div class="who">
        <span class="eyebrow">shift</span>
        <span>{session.identity?.login ?? 'signed in'}</span>
      </div>
      <div class="acts">
        <button class="btn" onclick={refresh} disabled={busy}>{busy ? 'Reading…' : 'Refresh'}</button>
        <button class="btn" onclick={signOut}>Clock out</button>
      </div>
    </footer>
  {:else if error}
    <div class="pad">
      <h1>Line down</h1>
      <p class="lede">{error}</p>
      {#if configUrl}
        <p class="lede">
          The line is defined by <code>{LINE_CONFIG_PATH}</code> at the root of
          <a href={configUrl} target="_blank" rel="noreferrer noopener">{repo}</a>.
        </p>
      {/if}
      <div class="acts">
        <button class="btn primary" onclick={refresh} disabled={busy}>Try again</button>
        <button class="btn" onclick={signOut}>Clock out</button>
      </div>
    </div>
  {:else}
    <div class="pad">
      <p class="eyebrow">Reading the line…</p>
    </div>
  {/if}
</div>

<style>
  .view {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .pad {
    flex: 1;
    padding: max(32px, env(safe-area-inset-top)) 20px 24px;
    max-width: 460px;
    width: 100%;
    margin: 0 auto;
  }

  h1 {
    font-family: var(--display);
    font-weight: 400;
    text-transform: uppercase;
    font-size: 40px;
    letter-spacing: 0.02em;
    line-height: 1;
    margin: 0 0 10px;
  }

  .lede {
    color: var(--steel);
    font-size: 14.5px;
    margin: 0 0 16px;
  }

  code {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--paper);
  }

  .notice {
    margin: 0;
    padding: 7px 14px;
    background: var(--hud);
    border-bottom: 1px solid var(--line);
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--amber);
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    background: var(--hud);
    border-top: 1px solid var(--line);
  }

  .who {
    font-family: var(--mono);
    font-size: 12px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .who .eyebrow {
    display: block;
  }

  .acts {
    display: flex;
    gap: 8px;
    flex: 0 0 auto;
  }

  .acts .btn {
    width: auto;
  }
</style>

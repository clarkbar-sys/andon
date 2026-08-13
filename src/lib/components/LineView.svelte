<script lang="ts">
  import { ForgeError, parseRepoRef } from '../forge';
  import { LINE_CONFIG_PATH, LineConfigError, loadLine, type LineLoad } from '../line';
  import { clientFor, session, signOut } from '../settings.svelte';
  import Belt from './Belt.svelte';
  import Hud from './Hud.svelte';
  import LineDown from './LineDown.svelte';

  let load = $state<LineLoad | null>(null);
  let error = $state<string | null>(null);
  let problems = $state<string[]>([]);
  let busy = $state(false);

  const repo = $derived(session.settings.repo);

  async function refresh() {
    const token = session.token;
    if (!token) return;
    busy = true;
    try {
      load = await loadLine(clientFor(session.settings, token), session.settings.repo);
      error = null;
      problems = [];
    } catch (cause) {
      if (cause instanceof ForgeError && cause.kind === 'unauthorized') {
        signOut();
        return;
      }
      // A line we cannot read is a line we cannot run: drop the stale belt so
      // the floor never shows stations the config no longer defines.
      if (cause instanceof LineConfigError) load = null;
      problems = cause instanceof LineConfigError ? cause.problems : [];
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

  const reason = $derived(
    problems.length > 1
      ? `${LINE_CONFIG_PATH} in ${repo} does not describe a line Andon can run:`
      : (error ?? 'Could not read the line.'),
  );
</script>

<div class="view">
  {#if load}
    <Hud line={load.line} {subtitle} />

    {#if load.staleReason}
      <p class="notice" role="status">{load.staleReason}</p>
    {:else if error}
      <p class="notice" role="status">{error}</p>
    {/if}

    <!-- Cached or errored means Andon is not seeing the line right now; a belt
         that keeps rolling would be claiming otherwise. -->
    <Belt stations={load.line.stations} running={!load.staleReason && !error} />

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
    <LineDown {reason} {problems} {busy} onRetry={refresh} onSignOut={signOut}>
      {#snippet detail()}
        {#if configUrl}
          <p class="lede">
            The line is defined by <code>{LINE_CONFIG_PATH}</code> at the root of
            <a href={configUrl} target="_blank" rel="noreferrer noopener">{repo}</a>.
          </p>
        {/if}
      {/snippet}
    </LineDown>
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

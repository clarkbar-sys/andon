<script lang="ts">
  import { ForgeError, parseRepoRef, type ForgeKind } from '../forge';
  import { clientFor, saveSettings, session, signIn } from '../settings.svelte';

  let forge = $state<ForgeKind>(session.settings.forge);
  let instanceUrl = $state(session.settings.instanceUrl);
  let repo = $state(session.settings.repo);
  let token = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  const needsInstance = $derived(forge === 'forgejo');

  async function clockIn(event: SubmitEvent) {
    event.preventDefault();
    error = null;
    busy = true;
    try {
      parseRepoRef(repo);
      const settings = { forge, instanceUrl: instanceUrl.trim(), repo: repo.trim() };
      const identity = await clientFor(settings, token.trim()).getIdentity();
      saveSettings(settings);
      signIn(token.trim(), identity);
    } catch (cause) {
      error = describe(cause);
    } finally {
      busy = false;
    }
  }

  function describe(cause: unknown): string {
    if (cause instanceof ForgeError) {
      if (cause.kind === 'unauthorized') return 'The forge rejected that token.';
      if (cause.kind === 'offline') return 'Could not reach the forge — check the URL and your connection.';
      if (cause.kind === 'rate-limited') return 'Rate limited by the forge. Try again shortly.';
    }
    return cause instanceof Error ? cause.message : 'Something went wrong.';
  }
</script>

<main>
  <div class="badge">Andon</div>
  <h1>Clock in</h1>
  <p class="lede">
    Andon has no backend — your token stays on this device and talks to the forge directly. It needs
    read access to the repo whose <code>andon.toml</code> defines the line.
  </p>

  <form onsubmit={clockIn}>
    <label>
      <span class="eyebrow">Forge</span>
      <select bind:value={forge}>
        <option value="github">GitHub</option>
        <option value="forgejo">Forgejo / Gitea</option>
      </select>
    </label>

    <label>
      <span class="eyebrow">{needsInstance ? 'Instance URL' : 'Instance URL (Enterprise, optional)'}</span>
      <input
        type="url"
        inputmode="url"
        placeholder={needsInstance ? 'https://codeberg.org' : 'https://github.com'}
        required={needsInstance}
        bind:value={instanceUrl}
      />
    </label>

    <label>
      <span class="eyebrow">Repo</span>
      <input type="text" placeholder="owner/name" autocapitalize="none" autocorrect="off" required bind:value={repo} />
    </label>

    <label>
      <span class="eyebrow">Access token</span>
      <input type="password" autocomplete="current-password" required bind:value={token} />
    </label>

    {#if error}
      <p class="error" role="alert">{error}</p>
    {/if}

    <button class="btn primary" type="submit" disabled={busy}>
      {busy ? 'Checking…' : 'Start the line'}
    </button>
  </form>
</main>

<style>
  main {
    flex: 1;
    max-width: 460px;
    width: 100%;
    margin: 0 auto;
    padding: max(32px, env(safe-area-inset-top)) 20px 32px;
  }

  .badge {
    display: inline-block;
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    background: var(--amber);
    color: #201804;
    padding: 2px 8px;
    border-radius: 2px;
  }

  h1 {
    font-family: var(--display);
    font-weight: 400;
    text-transform: uppercase;
    font-size: 44px;
    letter-spacing: 0.02em;
    line-height: 1;
    margin: 14px 0 10px;
  }

  .lede {
    color: var(--steel);
    font-size: 14.5px;
    margin: 0 0 24px;
  }

  code {
    font-family: var(--mono);
    font-size: 13px;
    color: var(--paper);
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  input,
  select {
    font-family: var(--mono);
    font-size: 15px;
    color: var(--paper);
    background: var(--panel);
    border: 1px solid var(--card-line);
    border-radius: var(--radius);
    padding: 10px 11px;
    width: 100%;
  }

  input:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--amber);
    outline-offset: 1px;
  }

  .error {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--red);
    margin: 0;
  }
</style>

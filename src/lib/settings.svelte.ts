import { createForgeClient, type ForgeClient, type ForgeIdentity, type ForgeKind } from './forge';
import { clearLineCache } from './line';
import { readJson, store, writeJson } from './storage';

const SETTINGS_KEY = 'andon.settings';
const TOKEN_KEY = 'andon.token';
const IDENTITY_KEY = 'andon.identity';

export interface Settings {
  forge: ForgeKind;
  /** Required for Forgejo, optional (Enterprise) for GitHub. */
  instanceUrl: string;
  repo: string;
}

export const DEFAULT_SETTINGS: Settings = {
  forge: 'github',
  instanceUrl: '',
  repo: import.meta.env.VITE_ANDON_REPO ?? 'clarkbar-sys/andon',
};

function loadSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...(readJson<Partial<Settings>>(store, SETTINGS_KEY) ?? {}) };
}

/**
 * The token is the whole auth story in v1 (no backend, SCOPE.md #4), so it lives
 * beside the settings but under its own key — signing out is one delete.
 */
export const session = $state({
  settings: loadSettings(),
  token: store.read(TOKEN_KEY),
  identity: readJson<ForgeIdentity>(store, IDENTITY_KEY),
});

export function saveSettings(next: Settings): void {
  session.settings = { ...next };
  writeJson(store, SETTINGS_KEY, session.settings);
}

export function signIn(token: string, identity: ForgeIdentity): void {
  session.token = token;
  session.identity = identity;
  store.write(TOKEN_KEY, token);
  writeJson(store, IDENTITY_KEY, identity);
}

export function signOut(): void {
  session.token = null;
  session.identity = null;
  store.remove(TOKEN_KEY);
  store.remove(IDENTITY_KEY);
  clearLineCache(store);
}

export function clientFor(settings: Settings, token: string): ForgeClient {
  return createForgeClient({
    kind: settings.forge,
    token,
    instanceUrl: settings.instanceUrl.trim() || undefined,
  });
}

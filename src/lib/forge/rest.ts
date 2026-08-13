import { ForgeError, type ForgeClient, type ForgeIdentity, type ForgeKind, type RepoRef } from './types';

/**
 * GitHub and Forgejo expose the same REST shapes for the endpoints v1 needs
 * (`/user`, `/repos/{owner}/{repo}/contents/{path}`), so the adapters differ
 * only in these fields.
 */
export interface RestForgeSpec {
  kind: ForgeKind;
  /** Root of the REST API, no trailing slash. */
  apiUrl: string;
  /** Root of the web UI, no trailing slash. */
  webUrl: string;
  token: string;
  authHeader(token: string): string;
  accept: string;
  extraHeaders?: Record<string, string>;
}

interface ContentsResponse {
  content?: string;
  encoding?: string;
}

interface UserResponse {
  login?: string;
  username?: string;
  avatar_url?: string;
  html_url?: string;
}

export function createRestForgeClient(spec: RestForgeSpec): ForgeClient {
  const headers = {
    Accept: spec.accept,
    Authorization: spec.authHeader(spec.token),
    ...spec.extraHeaders,
  };

  async function request(path: string): Promise<Response> {
    try {
      return await fetch(`${spec.apiUrl}${path}`, { headers });
    } catch {
      throw new ForgeError('offline', `Could not reach ${spec.apiUrl}`);
    }
  }

  function fail(res: Response, what: string): ForgeError {
    if (res.status === 401) return new ForgeError('unauthorized', 'Token rejected by the forge.', 401);
    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining === '0') return new ForgeError('rate-limited', 'Forge rate limit exhausted.', 403);
      return new ForgeError('forbidden', `Token lacks access to ${what}.`, 403);
    }
    if (res.status === 404) return new ForgeError('not-found', `${what} not found.`, 404);
    return new ForgeError('unknown', `Forge returned ${res.status} for ${what}.`, res.status);
  }

  return {
    kind: spec.kind,

    async getIdentity(): Promise<ForgeIdentity> {
      const res = await request('/user');
      if (!res.ok) throw fail(res, 'the signed-in user');
      const body = (await res.json()) as UserResponse;
      const login = body.login ?? body.username;
      if (!login) throw new ForgeError('unknown', 'Forge returned a user with no login.');
      return { login, avatarUrl: body.avatar_url, profileUrl: body.html_url };
    },

    async getFileText(repo: RepoRef, path: string, ref?: string): Promise<string | null> {
      const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
      const encodedPath = path.split('/').map(encodeURIComponent).join('/');
      const res = await request(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}/contents/${encodedPath}${query}`);
      if (res.status === 404) return null;
      if (!res.ok) throw fail(res, `${repo.owner}/${repo.name}:${path}`);
      const body = (await res.json()) as ContentsResponse;
      if (typeof body.content !== 'string') {
        throw new ForgeError('unknown', `${path} is not a file.`);
      }
      if (body.encoding && body.encoding !== 'base64') {
        throw new ForgeError('unknown', `Unsupported content encoding "${body.encoding}".`);
      }
      return decodeBase64Utf8(body.content);
    },

    webUrl(repo: RepoRef, path?: string): string {
      const root = `${spec.webUrl}/${repo.owner}/${repo.name}`;
      return path ? `${root}/blob/HEAD/${path}` : root;
    },
  };
}

/** Forge contents APIs return base64 with hard line breaks; atob rejects those. */
export function decodeBase64Utf8(encoded: string): string {
  const bytes = Uint8Array.from(atob(encoded.replace(/\s/g, '')), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

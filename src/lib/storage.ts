/**
 * localStorage that never throws: Safari private mode and quota exhaustion both
 * reject writes, and none of Andon's state is worth taking the app down for.
 */
export interface Store {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export const memoryStore = (): Store => {
  const map = new Map<string, string>();
  return {
    read: (key) => map.get(key) ?? null,
    write: (key, value) => void map.set(key, value),
    remove: (key) => void map.delete(key),
  };
};

function browserStore(): Store {
  return {
    read(key) {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* full or blocked — the forge is the source of truth anyway */
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch {
        /* see write */
      }
    },
  };
}

export const store: Store = typeof localStorage === 'undefined' ? memoryStore() : browserStore();

export function readJson<T>(from: Store, key: string): T | null {
  const raw = from.read(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    from.remove(key);
    return null;
  }
}

export function writeJson(to: Store, key: string, value: unknown): void {
  to.write(key, JSON.stringify(value));
}

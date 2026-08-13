import { registerSW } from 'virtual:pwa-register';

export const serviceWorker = $state({
  /** A new build is waiting; the user decides when the line restarts. */
  updateReady: false,
  offlineReady: false,
});

let update: ((reload?: boolean) => Promise<void>) | null = null;

export function initServiceWorker(): void {
  if (import.meta.env.DEV) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh: () => (serviceWorker.updateReady = true),
    onOfflineReady: () => (serviceWorker.offlineReady = true),
  });
}

export function applyUpdate(): void {
  serviceWorker.updateReady = false;
  void update?.(true);
}

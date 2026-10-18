const WORKER_URL = '/sw.js';

export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function keyBytes(base64: string) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const raw = window.atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export async function subscribeBrowser(publicKey: string): Promise<BrowserSubscription | null> {
  if (!pushSupported() || Notification.permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.register(WORKER_URL);
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(publicKey),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

export async function unsubscribeBrowser() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration(WORKER_URL);
  const subscription = await registration?.pushManager.getSubscription();
  await subscription?.unsubscribe();
}

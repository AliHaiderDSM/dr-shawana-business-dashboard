import { useSyncExternalStore } from 'react';

let live = false;
const listeners = new Set<() => void>();

export function setStaffRealtimeLive(next: boolean) {
  if (live === next) return;
  live = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useStaffRealtimeLive() {
  return useSyncExternalStore(subscribe, () => live);
}

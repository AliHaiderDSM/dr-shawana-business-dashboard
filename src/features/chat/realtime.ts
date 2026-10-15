import { RealtimeClient } from '@supabase/realtime-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { api, unwrap } from '@/lib/api/client';

export const FALLBACK_LIST_POLL_MS = 120_000;
export const FALLBACK_THREAD_POLL_MS = 30_000;

let live = false;
const listeners = new Set<() => void>();

function setLive(next: boolean) {
  if (live === next) return;
  live = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChatPolling(fallback: number) {
  return useSyncExternalStore(subscribe, () => live) ? false : fallback;
}

export function useDoctorChatRealtime(enabled: boolean) {
  const queryClient = useQueryClient();
  const config = useQuery({
    queryKey: ['doctor-chats', 'realtime'],
    queryFn: () => unwrap(api.GET('/branch/chats/realtime')).then((r) => r.data),
    enabled,
    staleTime: Infinity,
    retry: false,
  }).data;

  useEffect(() => {
    if (!enabled || !config) return;
    const refresh = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['doctor-chats', 'list'] }),
        queryClient.invalidateQueries({ queryKey: ['doctor-chats', 'thread'] }),
        queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] }),
      ]);
    const client = new RealtimeClient(`${config.url}/realtime/v1`, {
      params: { apikey: config.key, eventsPerSecond: 5 },
    });
    const channel = client
      .channel(config.topic)
      .on('broadcast', { event: 'message' }, () => void refresh())
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') void refresh();
      });
    return () => {
      setLive(false);
      void client.removeChannel(channel);
      client.disconnect();
    };
  }, [enabled, config, queryClient]);
}

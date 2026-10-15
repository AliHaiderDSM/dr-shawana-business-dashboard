import { RealtimeClient } from '@supabase/realtime-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api, unwrap } from '@/lib/api/client';

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
        if (status === 'SUBSCRIBED') void refresh();
      });
    return () => {
      void client.removeChannel(channel);
      client.disconnect();
    };
  }, [enabled, config, queryClient]);
}

import { RealtimeClient } from '@supabase/realtime-js';
import { useEffect } from 'react';
import { baseApi } from '@redux/api/baseApi';
import { useAppDispatch } from '@redux/hooks';
import { useGetDoctorChatRealtimeConfigQuery } from './index';

export function useDoctorChatRealtime(enabled: boolean) {
  const dispatch = useAppDispatch();
  const config = useGetDoctorChatRealtimeConfigQuery(undefined, {
    skip: !enabled,
    refetchOnMountOrArgChange: false,
  }).data;

  useEffect(() => {
    if (!enabled || !config) return;
    const refresh = () =>
      dispatch(
        baseApi.util.invalidateTags([
          { type: 'doctor-chats', id: 'list' },
          { type: 'doctor-chats', id: 'thread' },
          'sidebar-badges',
        ]),
      );
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
  }, [enabled, config, dispatch]);
}

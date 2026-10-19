import { RealtimeClient } from '@supabase/realtime-js';
import { useEffect } from 'react';
import { baseApi } from '@redux/api/baseApi';
import { useAppDispatch } from '@redux/hooks';
import { STAFF_PING_TAGS, useGetStaffRealtimeConfigQuery } from './index';
import { setStaffRealtimeLive } from './live';

export function useStaffRealtime(enabled: boolean) {
  const dispatch = useAppDispatch();
  const config = useGetStaffRealtimeConfigQuery(undefined, { skip: !enabled }).data;

  useEffect(() => {
    if (!enabled || !config) return;
    const refresh = () => dispatch(baseApi.util.invalidateTags(STAFF_PING_TAGS));
    let joined = false;
    const client = new RealtimeClient(`${config.url}/realtime/v1`, {
      params: { apikey: config.key, eventsPerSecond: 5 },
    });
    const channel = client
      .channel(config.topic)
      .on('broadcast', { event: 'badges' }, refresh)
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') {
          setStaffRealtimeLive(false);
          return;
        }
        setStaffRealtimeLive(true);
        if (joined) refresh();
        joined = true;
      });
    return () => {
      setStaffRealtimeLive(false);
      void client.removeChannel(channel);
      client.disconnect();
    };
  }, [enabled, config, dispatch]);
}

import { useQuery } from '@tanstack/react-query';
import { api, unwrap } from '@/lib/api/client';

export function useSidebarBadges(enabled: boolean) {
  return useQuery({
    queryKey: ['sidebar-badges'],
    queryFn: () => unwrap(api.GET('/branch/badges')).then((r) => r.data),
    enabled,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

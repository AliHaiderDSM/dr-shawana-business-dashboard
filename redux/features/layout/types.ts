import type { paths } from '@/lib/api/schema';

export type StaffRealtime = NonNullable<
  paths['/branch/realtime/staff']['get']['responses'][200]['content']['application/json']['data']
>;

export type SidebarBadges =
  paths['/branch/badges']['get']['responses'][200]['content']['application/json']['data'];

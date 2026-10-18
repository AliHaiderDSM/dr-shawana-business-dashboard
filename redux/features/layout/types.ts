import type { paths } from '@/lib/api/schema';

export type SidebarBadges =
  paths['/branch/badges']['get']['responses'][200]['content']['application/json']['data'];

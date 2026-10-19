import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { useHasDispatch, useInDispatch, useInWarehouse } from '@/lib/auth/branches';
import { useAuth } from '@/lib/auth/auth-context';
import { visibleMenu, type MenuItem } from '@/lib/permissions/menu';
import { pushSupported, subscribeBrowser } from '@/lib/web-push';
import { useDoctorChatRealtime } from '@redux/features/chat/realtime';
import {
  useGetPushPublicKeyQuery,
  useSavePushSubscriptionMutation,
  useSidebarBadges,
} from '@redux/features/layout';
import type { SidebarBadges } from '@redux/features/layout/types';
import { useStaffRealtime } from '@redux/features/layout/realtime';

type BadgeKey = keyof SidebarBadges;

const PROMPT_KEY = 'dsm.notifications.prompted';

const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

function alreadyPrompted() {
  try {
    if (window.sessionStorage.getItem(PROMPT_KEY)) return true;
    window.sessionStorage.setItem(PROMPT_KEY, '1');
    return false;
  } catch {
    return true;
  }
}

function desktopAlert(title: string, body: string, tag: string, onClick: () => void) {
  if (
    !notificationsSupported() ||
    Notification.permission !== 'granted' ||
    document.visibilityState === 'visible'
  )
    return;
  const alert = new Notification(title, { body, tag, icon: '/favicon.svg' });
  alert.onclick = () => {
    window.focus();
    onClick();
    alert.close();
  };
}

export function StaffNotifications() {
  const { me, can, isSuperAdmin, branchId } = useAuth();
  const inWarehouse = useInWarehouse();
  const inDispatch = useInDispatch();
  const hasDispatch = useHasDispatch();
  const navigate = useNavigate();
  const signedIn = Boolean(me);
  const badges = useSidebarBadges(signedIn);
  const pushKey = useGetPushPublicKeyQuery(undefined, { skip: !signedIn }).data ?? null;
  const [savePush] = useSavePushSubscriptionMutation();
  useStaffRealtime(signedIn);
  useDoctorChatRealtime(me?.role === 'doctor');

  const role = me?.role;
  const staffId = me?.profile.id ?? '';
  const scope = `${staffId}:${branchId}`;
  const seen = useRef<{ scope: string; counts: SidebarBadges } | null>(null);
  const pushActive = useRef(false);

  const enablePush = useCallback(async () => {
    if (!pushKey || !pushSupported()) return;
    try {
      const subscription = await subscribeBrowser(pushKey);
      if (subscription) {
        await savePush(subscription).unwrap();
        pushActive.current = true;
      }
    } catch (err) {
      console.warn('Desktop alerts could not be turned on', err);
    }
  }, [pushKey, savePush]);

  useEffect(() => {
    if (!signedIn || !staffId || !pushKey || !pushSupported()) return;
    if (Notification.permission === 'granted') {
      void enablePush();
      return;
    }
    if (alreadyPrompted()) return;
    if (Notification.permission === 'denied') {
      toast.warning('Desktop alerts are blocked', {
        description: 'Click the lock icon next to the address, set Notifications to Allow, then reload.',
        duration: 15_000,
      });
      return;
    }
    toast('Get desktop alerts', {
      description: 'New requests and patient messages reach you even when the dashboard is closed.',
      duration: 30_000,
      action: {
        label: 'Turn on',
        onClick: () =>
          void Notification.requestPermission().then((permission) =>
            permission === 'granted' ? enablePush() : undefined,
          ),
      },
    });
  }, [signedIn, staffId, pushKey, enablePush]);

  useEffect(() => {
    const counts = badges.data;
    if (!counts) return;
    const before = seen.current;
    seen.current = { scope, counts };
    if (!before || before.scope !== scope || pushActive.current) return;
    const items = new Map<BadgeKey, MenuItem>();
    for (const group of visibleMenu(can, isSuperAdmin, role, inWarehouse, { inDispatch, hasDispatch })) {
      for (const item of group.items) if (item.badge) items.set(item.badge, item);
    }
    for (const [key, item] of items) {
      const now = counts[key] ?? 0;
      if (now <= (before.counts[key] ?? 0)) continue;
      const body = `${item.label}: ${now} waiting`;
      const open = () => void navigate(item.path);
      toast.info(body, { action: { label: 'Open', onClick: open } });
      if (!pushKey) desktopAlert('DSM Clinic', body, key, open);
    }
  }, [badges.data, scope, navigate, can, isSuperAdmin, role, inWarehouse, inDispatch, hasDispatch, pushKey]);

  return null;
}

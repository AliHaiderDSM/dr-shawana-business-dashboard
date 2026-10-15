import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrap, uploadForm } from '@/lib/api/client';
import type { Schemas } from '@/lib/api/types';
import { FALLBACK_LIST_POLL_MS, FALLBACK_THREAD_POLL_MS, useChatPolling } from './realtime';

export type ChatConversation = Schemas['ChatConversation'];
export type ChatMessage = Schemas['ChatMessage'];

const KEY = 'doctor-chats';

export function useConversations() {
  return useQuery({
    queryKey: [KEY, 'list'],
    queryFn: () => unwrap(api.GET('/branch/chats')).then((r) => r.data),
    refetchInterval: useChatPolling(FALLBACK_LIST_POLL_MS),
  });
}

export function useThread(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: [KEY, 'thread', conversationId],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.GET('/branch/chats/{conversationId}/messages', {
          params: {
            path: { conversationId: conversationId! },
            query: pageParam ? { before: pageParam } : {},
          },
        }),
      ).then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? last.items[0]?.createdAt : undefined),
    enabled: Boolean(conversationId),
    refetchInterval: useChatPolling(FALLBACK_THREAD_POLL_MS),
  });
}

export function useSendReply(conversationId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ body, file }: { body: string; file: File | null }) => {
      const form = new FormData();
      if (body.trim()) form.append('body', body.trim());
      if (file) form.append('file', file);
      return uploadForm<ChatMessage>(`/branch/chats/${conversationId}/messages`, form);
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: [KEY] }),
        queryClient.invalidateQueries({ queryKey: ['sidebar-badges'] }),
      ]),
  });
}

export async function chatFileUrl(conversationId: string, messageId: string) {
  const result = await unwrap(
    api.GET('/branch/chats/{conversationId}/messages/{messageId}/file', {
      params: { path: { conversationId, messageId } },
    }),
  );
  return result.data;
}

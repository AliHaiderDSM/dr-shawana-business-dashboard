import { baseApi, fromApi, toApi } from '@redux/api/baseApi';
import { store } from '@redux/store';
import { api, unwrap, uploadForm } from '@/lib/api/client';
import type {
  ChatMessage,
  DoctorChatFileArg,
  DoctorChatFileUrl,
  DoctorChatRealtimeConfig,
  DoctorChatThreadPage,
  DoctorConversations,
  SendDoctorChatReplyArg,
} from './types';

export * from './types';

export const chatApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getDoctorConversations: build.query<DoctorConversations, void>({
      queryFn: () => fromApi<DoctorConversations>(() => unwrap(api.GET('/branch/chats')).then((r) => r.data)),
      providesTags: ['doctor-chats', { type: 'doctor-chats', id: 'list' }],
    }),
    getDoctorChatThread: build.infiniteQuery<DoctorChatThreadPage, string, string | undefined>({
      infiniteQueryOptions: {
        initialPageParam: undefined,
        getNextPageParam: (last) => (last.hasMore ? last.items[0]?.createdAt : undefined),
      },
      queryFn: ({ queryArg: conversationId, pageParam }) =>
        fromApi<DoctorChatThreadPage>(() =>
          unwrap(
            api.GET('/branch/chats/{conversationId}/messages', {
              params: {
                path: { conversationId },
                query: pageParam ? { before: pageParam } : {},
              },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['doctor-chats', { type: 'doctor-chats', id: 'thread' }],
    }),
    sendDoctorChatReply: build.mutation<ChatMessage, SendDoctorChatReplyArg>({
      queryFn: ({ conversationId, body, file, replyToId, durationMs }) =>
        toApi<ChatMessage>(() => {
          const form = new FormData();
          if (body.trim()) form.append('body', body.trim());
          if (file) form.append('file', file);
          if (replyToId) form.append('replyToId', replyToId);
          if (durationMs) form.append('durationMs', String(Math.round(durationMs)));
          return uploadForm<ChatMessage>(`/branch/chats/${conversationId}/messages`, form);
        }),
      invalidatesTags: (_r, error) => (error ? [] : ['doctor-chats', 'sidebar-badges']),
    }),
    getDoctorChatFileUrl: build.query<DoctorChatFileUrl, DoctorChatFileArg>({
      queryFn: ({ conversationId, messageId }) =>
        toApi<DoctorChatFileUrl>(() =>
          unwrap(
            api.GET('/branch/chats/{conversationId}/messages/{messageId}/file', {
              params: { path: { conversationId, messageId } },
            }),
          ).then((r) => r.data),
        ),
      providesTags: ['doctor-chats'],
    }),
    getDoctorChatRealtimeConfig: build.query<DoctorChatRealtimeConfig, void>({
      queryFn: () =>
        toApi<DoctorChatRealtimeConfig>(() => unwrap(api.GET('/branch/chats/realtime')).then((r) => r.data)),
      providesTags: ['doctor-chats', { type: 'doctor-chats', id: 'realtime' }],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetDoctorConversationsQuery,
  useGetDoctorChatThreadInfiniteQuery,
  useSendDoctorChatReplyMutation,
  useGetDoctorChatRealtimeConfigQuery,
} = chatApi;

export function useConversations() {
  return useGetDoctorConversationsQuery();
}

export function useThread(conversationId: string | null) {
  return useGetDoctorChatThreadInfiniteQuery(conversationId ?? '', { skip: !conversationId });
}

export async function chatFileUrl(
  conversationId: string,
  messageId: string,
): Promise<(typeof chatApi.endpoints.getDoctorChatFileUrl)['Types']['ResultType']> {
  return store
    .dispatch(
      chatApi.endpoints.getDoctorChatFileUrl.initiate(
        { conversationId, messageId },
        { subscribe: false, forceRefetch: true },
      ),
    )
    .unwrap();
}

import type { Schemas } from '@/lib/api/types';
import type { ClinicGetResponse } from '@redux/features/patients/types';

export type ChatConversation = Schemas['ChatConversation'];
export type ChatMessage = Schemas['ChatMessage'];

export type DoctorConversations = ClinicGetResponse<'/branch/chats'>['data'];
export type DoctorChatThreadPage = ClinicGetResponse<'/branch/chats/{conversationId}/messages'>['data'];
export type DoctorChatFileUrl =
  ClinicGetResponse<'/branch/chats/{conversationId}/messages/{messageId}/file'>['data'];
export type DoctorChatRealtimeConfig = ClinicGetResponse<'/branch/chats/realtime'>['data'];

export interface SendDoctorChatReplyArg {
  conversationId: string | null;
  body: string;
  file: File | null;
}

export interface DoctorChatFileArg {
  conversationId: string;
  messageId: string;
}

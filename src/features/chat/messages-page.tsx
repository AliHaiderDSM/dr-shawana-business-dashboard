import {
  FileImage,
  FileText,
  FolderHeart,
  Loader2,
  MessagesSquare,
  Mic,
  Paperclip,
  Play,
  Send,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { openSignedUrl } from '@/components/shared/attachment-list';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toastError } from '@/lib/api/errors';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { baseApi } from '@redux/api/baseApi';
import {
  chatFileUrl,
  useConversations,
  useSendDoctorChatReplyMutation,
  useThread,
  type ChatConversation,
  type ChatMessage,
} from '@redux/features/chat';
import { useAppDispatch } from '@redux/hooks';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const MAX_BYTES = 10 * 1024 * 1024;

function time(value: string) {
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function ConversationList({
  items,
  activeId,
  onOpen,
}: {
  items: ChatConversation[];
  activeId: string | null;
  onOpen: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const shown = term
    ? items.filter((c) => c.patient.name.toLowerCase().includes(term) || c.patient.phone.includes(term))
    : items;
  return (
    <div className="flex min-h-0 flex-col border-b lg:border-r lg:border-b-0">
      <div className="border-b p-3">
        <Input
          placeholder="Search patient or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
        {shown.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onOpen(c.id)}
              className={cn(
                'flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-muted/50',
                c.id === activeId && 'bg-primary-soft/40',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('truncate text-sm', c.unread ? 'font-semibold' : 'font-medium')}>
                    {c.patient.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDate(c.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted-foreground">{c.lastMessage ?? ''}</span>
                  {c.unread ? (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                      {c.unread > 99 ? '99+' : c.unread}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          </li>
        ))}
        {shown.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">No conversations</li>
        ) : null}
      </ul>
    </div>
  );
}

function VoiceMessage({
  message,
  conversationId,
  mine,
}: {
  message: ChatMessage;
  conversationId: string;
  mine: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setUrl((await chatFileUrl(conversationId, message.id)).url);
    } catch (error) {
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  if (url) {
    return <audio controls autoPlay src={url} className="h-10 w-64 max-w-full" aria-label="Voice message" />;
  }
  return (
    <button
      type="button"
      onClick={() => void load()}
      disabled={loading}
      className={cn(
        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left',
        mine ? 'bg-primary-foreground/15' : 'bg-muted',
      )}
    >
      {loading ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Play className="size-4 shrink-0" />}
      <Mic className="size-4 shrink-0" />
      <span>Voice message</span>
    </button>
  );
}

function Bubble({ message, conversationId }: { message: ChatMessage; conversationId: string }) {
  const mine = message.sender === 'doctor';
  const Icon = message.file?.type.startsWith('image/') ? FileImage : FileText;
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] space-y-1.5 rounded-2xl px-3 py-2 text-sm shadow-xs',
          mine ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border bg-card',
        )}
      >
        {message.file?.type.startsWith('audio/') ? (
          <VoiceMessage message={message} conversationId={conversationId} mine={mine} />
        ) : message.file ? (
          <button
            type="button"
            onClick={() => void openSignedUrl(() => chatFileUrl(conversationId, message.id))}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left',
              mine ? 'bg-primary-foreground/15' : 'bg-muted',
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="truncate underline-offset-2 hover:underline">{message.file.name}</span>
          </button>
        ) : null}
        {message.body ? <p className="break-words whitespace-pre-wrap">{message.body}</p> : null}
        <div
          className={cn(
            'text-right text-[11px]',
            mine ? 'text-primary-foreground/75' : 'text-muted-foreground',
          )}
        >
          {time(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

function Thread({ conversation }: { conversation: ChatConversation }) {
  const dispatch = useAppDispatch();
  const thread = useThread(conversation.id);
  const [sendReply, send] = useSendDoctorChatReplyMutation();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const pages = thread.data?.pages ?? [];
  const messages = [...pages].reverse().flatMap((p) => p.items);
  const lastId = messages.at(-1)?.id;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  useEffect(() => {
    dispatch(baseApi.util.invalidateTags(['sidebar-badges']));
  }, [conversation.id, dispatch]);

  const submit = () => {
    if (send.isLoading || (!text.trim() && !file)) return;
    sendReply({ conversationId: conversation.id, body: text, file })
      .unwrap()
      .then(() => {
        setText('');
        setFile(null);
      })
      .catch(toastError);
  };

  let lastDay = '';
  return (
    <div className="flex min-h-0 flex-col">
      <Link
        to={`/patients/${conversation.patient.id}?tab=records`}
        title="Open this patient's medical records"
        className="group flex items-center justify-between gap-3 border-b px-4 py-3 transition-colors hover:bg-muted/50"
      >
        <div className="min-w-0">
          <div className="truncate font-semibold group-hover:text-primary">{conversation.patient.name}</div>
          <div className="text-xs text-muted-foreground">
            {conversation.patient.phone} · Tap for medical records
          </div>
        </div>
        <FolderHeart className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" />
      </Link>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-muted/30 p-4">
        {thread.hasNextPage ? (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              disabled={thread.isFetchingNextPage}
              onClick={() => void thread.fetchNextPage()}
            >
              {thread.isFetchingNextPage ? <Loader2 className="animate-spin" /> : null}
              Load earlier messages
            </Button>
          </div>
        ) : null}
        {thread.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="ml-auto h-10 w-1/2" />
          </div>
        ) : (
          messages.map((m) => {
            const day = formatDate(m.createdAt);
            const divider = day !== lastDay;
            lastDay = day;
            return (
              <div key={m.id} className="space-y-2">
                {divider ? (
                  <div className="text-center">
                    <span className="rounded-full bg-card px-2.5 py-0.5 text-[11px] text-muted-foreground shadow-xs">
                      {day}
                    </span>
                  </div>
                ) : null}
                <Bubble message={m} conversationId={conversation.id} />
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>
      <div className="space-y-2 border-t p-3">
        {file ? (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm">
            <Paperclip className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Remove file"
              onClick={() => setFile(null)}
            >
              <X />
            </Button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => {
              const picked = e.target.files?.[0] ?? null;
              e.target.value = '';
              if (!picked) return;
              if (picked.size > MAX_BYTES) {
                toast.error('The file is larger than 10 MB.');
                return;
              }
              setFile(picked);
            }}
          />
          <Button
            variant="outline"
            size="icon"
            aria-label="Attach a PDF or photo"
            onClick={() => fileInput.current?.click()}
          >
            <Paperclip />
          </Button>
          <Textarea
            rows={1}
            value={text}
            maxLength={4000}
            placeholder="Write a reply…"
            className="max-h-40 min-h-10 flex-1 resize-none"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button aria-label="Send" disabled={send.isLoading || (!text.trim() && !file)} onClick={submit}>
            {send.isLoading ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Enter sends, Shift + Enter adds a line. The patient gets a notification on the app.
        </p>
      </div>
    </div>
  );
}

export function MessagesPage() {
  const { me } = useAuth();
  const conversations = useConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const items = conversations.data ?? [];
  const active = items.find((c) => c.id === activeId) ?? null;

  if (me?.role !== 'doctor') {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="For doctors only"
        description="Patients message the doctors who saw them. Only the doctor can read and reply."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Patient Messages"
        description="Messages from your patients in the mobile app. Only you can read and reply."
      />
      <div className="grid h-[calc(100vh-14rem)] min-h-[28rem] overflow-hidden rounded-xl border bg-card shadow-xs lg:grid-cols-[20rem_minmax(0,1fr)]">
        {conversations.isLoading ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ConversationList items={items} activeId={activeId} onOpen={setActiveId} />
        )}
        {active ? (
          <Thread key={active.id} conversation={active} />
        ) : (
          <div className="hidden items-center justify-center p-6 text-center text-sm text-muted-foreground lg:flex">
            {items.length ? 'Choose a patient to read and reply.' : 'No messages from patients yet.'}
          </div>
        )}
      </div>
    </div>
  );
}

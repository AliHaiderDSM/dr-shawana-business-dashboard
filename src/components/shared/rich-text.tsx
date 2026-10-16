import DOMPurify from 'dompurify';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  type LucideIcon,
} from 'lucide-react';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li'];

const RICH_TEXT_CLASSES =
  'text-sm leading-relaxed break-words [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5';

const isHtml = (value: string) => /<\/?(p|ul|ol|li|strong|em|u|s|br)\b/i.test(value);

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function toRichHtml(value: string | null | undefined) {
  if (!value) return '';
  if (isHtml(value)) return DOMPurify.sanitize(value, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export function richTextIsEmpty(value: string | null | undefined) {
  return (
    !value ||
    toRichHtml(value)
      .replace(/<[^>]*>/g, '')
      .trim().length === 0
  );
}

export function RichTextView({ value, className }: { value: string | null | undefined; className?: string }) {
  if (richTextIsEmpty(value)) return null;
  return (
    <div
      className={cn(RICH_TEXT_CLASSES, className)}
      dangerouslySetInnerHTML={{ __html: toRichHtml(value) }}
    />
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        active && 'bg-primary-soft text-primary-soft-foreground',
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

function Toolbar({ editor, disabled }: { editor: Editor; disabled?: boolean }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const run = (action: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) =>
    action(editor.chain().focus()).run();
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
      <ToolButton
        icon={Bold}
        label="Bold"
        active={state.bold}
        disabled={disabled}
        onClick={() => run((c) => c.toggleBold())}
      />
      <ToolButton
        icon={Italic}
        label="Italic"
        active={state.italic}
        disabled={disabled}
        onClick={() => run((c) => c.toggleItalic())}
      />
      <ToolButton
        icon={UnderlineIcon}
        label="Underline"
        active={state.underline}
        disabled={disabled}
        onClick={() => run((c) => c.toggleUnderline())}
      />
      <ToolButton
        icon={Strikethrough}
        label="Strikethrough"
        active={state.strike}
        disabled={disabled}
        onClick={() => run((c) => c.toggleStrike())}
      />
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton
        icon={List}
        label="Bullet list"
        active={state.bullet}
        disabled={disabled}
        onClick={() => run((c) => c.toggleBulletList())}
      />
      <ToolButton
        icon={ListOrdered}
        label="Numbered list"
        active={state.ordered}
        disabled={disabled}
        onClick={() => run((c) => c.toggleOrderedList())}
      />
      <span className="mx-1 h-5 w-px bg-border" />
      <ToolButton
        icon={Undo2}
        label="Undo"
        disabled={disabled || !state.canUndo}
        onClick={() => run((c) => c.undo())}
      />
      <ToolButton
        icon={Redo2}
        label="Redo"
        disabled={disabled || !state.canRedo}
        onClick={() => run((c) => c.redo())}
      />
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  invalid,
  id,
}: {
  value: string | null | undefined;
  onChange: (html: string | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder?: string;
  invalid?: boolean;
  id?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        link: false,
      }),
    ],
    content: toRichHtml(value),
    editable: !disabled,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        ...(id ? { id } : {}),
        'aria-multiline': 'true',
        'aria-invalid': invalid ? 'true' : 'false',
        ...(placeholder ? { 'aria-placeholder': placeholder } : {}),
        class: cn(RICH_TEXT_CLASSES, 'min-h-28 px-3 py-2 outline-none'),
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? null : e.getHTML()),
    onBlur: () => onBlur?.(),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = toRichHtml(value);
    if (next !== (editor.isEmpty ? '' : editor.getHTML()))
      editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border bg-background shadow-xs focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
        invalid && 'border-destructive',
        disabled && 'opacity-60',
      )}
    >
      {editor ? <Toolbar editor={editor} disabled={disabled} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}

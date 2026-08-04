"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import {
  TextB,
  TextItalic,
  List,
  ListNumbers,
  TextHOne,
  TextHTwo,
  TextHThree,
  Table as TableIcon,
  ArrowCounterClockwise,
  ArrowClockwise,
} from "@/components/icons";
import { useEffect, useState, type ReactNode } from "react";

type ElevatedRichTextEditorProps = {
  value?: string;
  onChange?: (html: string) => void;
  onBlur?: () => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

const MenuButton = ({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: ReactNode;
  title?: string;
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`
        p-2 rounded-lg transition-all duration-200
        ${
          isActive
            ? "bg-border text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {children}
    </button>
  );
};

export default function ElevatedRichTextEditor({
  value = "",
  onChange,
  onBlur,
  label = "Description",
  placeholder = "Detalhe o produto, beneficios e requisitos",
  disabled = false,
  className = "",
}: ElevatedRichTextEditorProps) {
  const [focused, setFocused] = useState(false);
  const [hasContent, setHasContent] = useState(() => {
    return value !== "" && value !== null && value !== undefined;
  });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "border-collapse border border-foreground/20 my-4",
        },
      }),
      TableRow,
      TableHeader.configure({
        HTMLAttributes: {
          class: "border border-foreground/20 bg-muted px-4 py-2 font-semibold",
        },
      }),
      TableCell.configure({
        HTMLAttributes: {
          class: "border border-foreground/20 px-4 py-2",
        },
      }),
    ],
    content: value || "",
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHasContent(html !== "<p></p>" && html.trim() !== "");
      onChange?.(html);
    },
    onFocus: () => {
      setFocused(true);
    },
    onBlur: () => {
      setFocused(false);
      onBlur?.();
    },
    editorProps: {
      attributes: {
        class:
          `prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3 ${
            hasContent || focused ? "" : "text-transparent"
          }`.trim(),
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
      const html = editor.getHTML();
      queueMicrotask(() => {
        setHasContent(html !== "<p></p>" && html.trim() !== "");
      });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const isFloating = focused || hasContent;

  const addTable = () => {
    editor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
  };

  const shadowDisabled =
    "inset 0 1px 0 hsl(var(--rule-strong)), 0 1px 0 hsl(var(--card) / 0.6)";
  const shadowEnabled =
    "inset 0 1px 0 hsl(var(--rule-strong)), 0 1px 0 hsl(var(--card) / 0.6)";

  return (
    <div className={`${className} relative flex flex-col`}>
      {}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-muted border border-border rounded-t-2xl border-b-0">
        <div className="flex items-center gap-1 border-r border-foreground/20 pr-2 mr-1">
          <MenuButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            disabled={disabled}
            title="Negrito"
          >
            <TextB weight="bold" className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            disabled={disabled}
            title="Itálico"
          >
            <TextItalic weight="bold" className="h-4 w-4" />
          </MenuButton>
        </div>

        <div className="flex items-center gap-1 border-r border-foreground/20 pr-2 mr-1">
          <MenuButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            isActive={editor.isActive("heading", { level: 1 })}
            disabled={disabled}
            title="Título 1"
          >
            <TextHOne weight="bold" className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            isActive={editor.isActive("heading", { level: 2 })}
            disabled={disabled}
            title="Título 2"
          >
            <TextHTwo weight="bold" className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            isActive={editor.isActive("heading", { level: 3 })}
            disabled={disabled}
            title="Título 3"
          >
            <TextHThree weight="bold" className="h-4 w-4" />
          </MenuButton>
        </div>

        <div className="flex items-center gap-1 border-r border-foreground/20 pr-2 mr-1">
          <MenuButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            disabled={disabled}
            title="Lista com marcadores"
          >
            <List weight="bold" className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            disabled={disabled}
            title="Lista numerada"
          >
            <ListNumbers weight="bold" className="h-4 w-4" />
          </MenuButton>
        </div>

        <div className="flex items-center gap-1 border-r border-foreground/20 pr-2 mr-1">
          <MenuButton
            onClick={addTable}
            disabled={disabled}
            title="Inserir tabela"
          >
            <TableIcon weight="fill" className="h-4 w-4" />
          </MenuButton>
        </div>

        <div className="flex items-center gap-1">
          <MenuButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={disabled || !editor.can().undo()}
            title="Desfazer"
          >
            <ArrowCounterClockwise weight="bold" className="h-4 w-4" />
          </MenuButton>
          <MenuButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={disabled || !editor.can().redo()}
            title="Refazer"
          >
            <ArrowClockwise weight="bold" className="h-4 w-4" />
          </MenuButton>
        </div>
      </div>

      {}
      <div
        className={`
          relative w-full
          border border-border
          bg-transparent
          rounded-b-2xl rounded-tr-2xl
          focus-within:shadow-sm
          focus-within:border-foreground/20
          transition-all duration-200
          min-h-[200px]
          ${disabled ? "opacity-60 cursor-not-allowed bg-muted" : ""}
        `}
        style={{
          boxShadow: disabled ? shadowDisabled : shadowEnabled,
        }}
      >
        <EditorContent editor={editor} />

        {}
        {!hasContent && !focused && (
          <div className="absolute top-3 left-4 text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}

        {}
        <label
          className={`
            absolute pointer-events-none
            transition-all duration-200 ease-out
            left-4
            ${
              isFloating
                ? `top-0 text-xs ${
                    disabled ? "text-muted-foreground" : "text-muted-foreground"
                  } bg-background px-1 -ml-1 -translate-y-1/2 z-10`
                : `top-3 ${disabled ? "text-muted-foreground" : "text-muted-foreground"}`
            }
          `}
          style={{
            transformOrigin: "left center",
          }}
        >
          {label}
        </label>
      </div>

      {}
      <style jsx global>{`
        .ProseMirror {
          outline: none;
          min-height: 200px;
          padding-top: 2rem;
        }

        .ProseMirror p {
          margin: 0.5rem 0;
        }

        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }

        .ProseMirror h1 {
          font-size: 1.875rem;
          font-weight: 700;
          margin: 1rem 0;
        }

        .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0.875rem 0;
        }

        .ProseMirror h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 0.75rem 0;
        }

        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }

        .ProseMirror ul {
          list-style-type: disc;
        }

        .ProseMirror ol {
          list-style-type: decimal;
        }

        .ProseMirror li {
          margin: 0.25rem 0;
        }

        .ProseMirror table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }

        .ProseMirror table td,
        .ProseMirror table th {
          border: 1px solid #d1d5db;
          padding: 0.5rem;
        }

        .ProseMirror table th {
          background-color: #f9fafb;
          font-weight: 600;
        }

        .ProseMirror strong {
          font-weight: 700;
        }

        .ProseMirror em {
          font-style: italic;
        }
      `}</style>
    </div>
  );
}

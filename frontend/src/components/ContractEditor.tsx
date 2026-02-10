"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { marked } from "marked";
import TurndownService from "turndown";

/* ───────────────── Types ───────────────── */

export type OptimizeRequest = {
  selectedText: string;
  fullContext: string;
};

type ContractEditorProps = {
  /** Markdown content from AI generation */
  content: string;
  /** Called when the user edits the document (returns markdown) */
  onUpdate?: (markdown: string) => void;
  /** Called when user clicks "Mejorar con IA" on selected text */
  onOptimizeRequest?: (request: OptimizeRequest) => void;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Whether AI optimization is in progress */
  isOptimizing?: boolean;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  className?: string;
};

/* ───────── Markdown ↔ HTML helpers ───────── */

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  strongDelimiter: "**",
});

// Preserve heading hierarchy
turndown.addRule("headings", {
  filter: ["h1", "h2", "h3", "h4", "h5", "h6"],
  replacement(content, node) {
    const el = node as HTMLElement;
    const level = parseInt(el.tagName.replace("H", ""), 10);
    const prefix = "#".repeat(level);
    return `\n\n${prefix} ${content.trim()}\n\n`;
  },
});

function markdownToHtml(md: string): string {
  if (!md?.trim()) return "";
  const result = marked.parse(md, { async: false, gfm: true, breaks: false });
  return typeof result === "string" ? result : "";
}

function htmlToMarkdown(html: string): string {
  if (!html?.trim()) return "";
  return turndown.turndown(html).trim();
}

/* ───────── Toolbar button ───────── */

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        isActive
          ? "bg-emerald-100 text-emerald-800"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

/* ───────── Main Component ───────── */

export function ContractEditor({
  content,
  onUpdate,
  onOptimizeRequest,
  readOnly = false,
  isOptimizing = false,
  placeholder = "El contrato generado aparecerá aquí…",
  className,
}: ContractEditorProps) {
  const [mode, setMode] = useState<"editor" | "preview">("editor");
  const [hasSelection, setHasSelection] = useState(false);

  const initialHtml = useMemo(() => markdownToHtml(content), [content]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder }),
      Typography,
    ],
    content: initialHtml,
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      if (onUpdate) {
        const md = htmlToMarkdown(ed.getHTML());
        onUpdate(md);
      }
    },
    onSelectionUpdate: ({ editor: ed }) => {
      setHasSelection(!ed.state.selection.empty);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-slate max-w-none min-h-[320px] focus:outline-none " +
          "px-4 py-3 text-slate-800 " +
          "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-slate-900 " +
          "[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-slate-900 " +
          "[&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-slate-800 " +
          "[&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-slate-800 " +
          "[&_ul]:list-disc [&_ol]:list-decimal " +
          "[&_li]:text-sm [&_p]:text-sm [&_p]:leading-relaxed " +
          "[&_strong]:text-slate-900 [&_mark]:bg-yellow-200 [&_mark]:px-0.5",
      },
    },
  });

  // Sync external content changes (new generation)
  useEffect(() => {
    if (!editor) return;
    const currentMd = htmlToMarkdown(editor.getHTML());
    if (currentMd !== content) {
      const html = markdownToHtml(content);
      editor.commands.setContent(html, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

  // Toggle editable when readOnly changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  const handleOptimize = useCallback(() => {
    if (!editor || !onOptimizeRequest) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;
    const fullContext = htmlToMarkdown(editor.getHTML());
    onOptimizeRequest({ selectedText, fullContext });
  }, [editor, onOptimizeRequest]);

  const insertOptimizedText = useCallback(
    (optimizedHtml: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(optimizedHtml).run();
    },
    [editor]
  );

  const getMarkdown = useCallback((): string => {
    if (!editor) return content;
    return htmlToMarkdown(editor.getHTML());
  }, [editor, content]);

  // Expose methods to parent via ref-like pattern
  useEffect(() => {
    (window as any).__contractEditorApi = {
      insertOptimizedText,
      getMarkdown,
    };
    return () => {
      delete (window as any).__contractEditorApi;
    };
  }, [insertOptimizedText, getMarkdown]);

  if (!editor) return null;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className ?? ""}`}>
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-3 py-2">
        {/* Mode toggle */}
        <div className="mr-2 flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          <button
            type="button"
            onClick={() => setMode("editor")}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "editor"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Editor
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              mode === "preview"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Preview
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200" />

        {/* Format buttons */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          disabled={readOnly}
          title="Negrita (Ctrl+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          disabled={readOnly}
          title="Cursiva (Ctrl+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive("highlight")}
          disabled={readOnly}
          title="Resaltar"
        >
          🖍
        </ToolbarButton>

        <div className="h-5 w-px bg-slate-200" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          disabled={readOnly}
          title="Título 1"
        >
          H1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          disabled={readOnly}
          title="Título 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          disabled={readOnly}
          title="Título 3"
        >
          H3
        </ToolbarButton>

        <div className="h-5 w-px bg-slate-200" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          disabled={readOnly}
          title="Lista con viñetas"
        >
          • Lista
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          disabled={readOnly}
          title="Lista numerada"
        >
          1. Lista
        </ToolbarButton>

        <div className="h-5 w-px bg-slate-200" />

        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          disabled={readOnly}
          title="Línea horizontal"
        >
          ─
        </ToolbarButton>

        {/* Spacer */}
        <div className="flex-1" />

        {/* AI optimize button */}
        {onOptimizeRequest && (
          <button
            type="button"
            onClick={handleOptimize}
            disabled={readOnly || isOptimizing || !hasSelection}
            title="Selecciona texto y haz clic para mejorar la cláusula con IA"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:from-violet-400 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isOptimizing ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Optimizando…
              </>
            ) : (
              <>✦ Mejorar con IA</>
            )}
          </button>
        )}
      </div>

      {/* ── Content area ── */}
      {mode === "editor" ? (
        <div className="max-h-[520px] overflow-auto">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto px-4 py-3">
          <div
            className="prose prose-sm prose-slate max-w-none text-slate-800"
            dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
          />
        </div>
      )}

      {/* ── Footer status ── */}
      <div className="flex items-center justify-between border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">
        <span>
          {editor.storage.characterCount?.characters?.() ??
            editor.state.doc.textContent.length}{" "}
          caracteres
        </span>
        <span>{readOnly ? "Solo lectura" : "Editable"}</span>
      </div>
    </div>
  );
}

export { markdownToHtml, htmlToMarkdown };

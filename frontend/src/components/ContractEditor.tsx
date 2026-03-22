"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
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

export type ContractEditorHandle = {
  insertOptimizedText: (html: string) => void;
  getMarkdown: () => string;
};

type ContractEditorProps = {
  /** Contenido markdown de la generación IA */
  content: string;
  /** Se invoca cada vez que el usuario edita el documento (devuelve markdown) */
  onUpdate?: (markdown: string) => void;
  /** Se invoca al hacer clic en «Mejorar con IA» sobre texto seleccionado */
  onOptimizeRequest?: (request: OptimizeRequest) => void;
  /** Indica si el editor es solo lectura */
  readOnly?: boolean;
  /** Indica si la optimización IA está en curso */
  isOptimizing?: boolean;
  /** Texto de referencia cuando el editor está vacío */
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

/* ───────── Botón de barra de herramientas ───────── */

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
          ? "bg-blue-100 text-blue-800"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

/* ───────── Componente principal ───────── */

export const ContractEditor = forwardRef<ContractEditorHandle, ContractEditorProps>(
  function ContractEditor(
    {
      content,
      onUpdate,
      onOptimizeRequest,
      readOnly = false,
      isOptimizing = false,
      placeholder = "El contrato generado aparecerá aquí…",
      className,
    },
    ref,
  ) {
  const [mode, setMode] = useState<"editor" | "preview">("editor");
  const [hasSelection, setHasSelection] = useState(false);

  const initialHtml = useMemo(() => markdownToHtml(content), [content]);

  const editor = useEditor({
    immediatelyRender: false,
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
          "prose prose-sm prose-slate max-w-none min-h-[420px] focus:outline-none " +
          "px-5 py-4 text-slate-800 " +
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

  /* ── Sincronizar contenido externo ── */
  useEffect(() => {
    if (!editor) return;
    const currentMd = htmlToMarkdown(editor.getHTML());
    if (currentMd !== content) {
      const html = markdownToHtml(content);
      editor.commands.setContent(html, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor]);

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

  /* ── Exponer métodos al padre vía ref (forwardRef) ── */
  useImperativeHandle(ref, () => ({ insertOptimizedText, getMarkdown }), [
    insertOptimizedText,
    getMarkdown,
  ]);

  if (!editor) return null;

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className ?? ""}`}>
      {/* ── Barra de herramientas ── */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-3 py-2">
        {/* Selector de modo */}
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
            Edición
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
            Vista previa
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200" />

        {/* Botones de formato */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          disabled={readOnly}
          title="Negrita (Ctrl+B)"
        >
          <strong>N</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          disabled={readOnly}
          title="Cursiva (Ctrl+I)"
        >
          <em>K</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          isActive={editor.isActive("highlight")}
          disabled={readOnly}
          title="Resaltar texto"
        >
          🖍
        </ToolbarButton>

        <div className="h-5 w-px bg-slate-200" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          disabled={readOnly}
          title="Título principal"
        >
          T1
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          disabled={readOnly}
          title="Subtítulo"
        >
          T2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          disabled={readOnly}
          title="Sección menor"
        >
          T3
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
          title="Línea separadora"
        >
          ─
        </ToolbarButton>

        {/* Espaciador */}
        <div className="flex-1" />

        {/* Botón de mejora con IA */}
        {onOptimizeRequest && (
          <button
            type="button"
            onClick={handleOptimize}
            disabled={readOnly || isOptimizing || !hasSelection}
            title="Selecciona texto y haz clic para mejorar la cláusula con IA"
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:from-blue-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
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

      {/* ── Área de contenido ── */}
      {mode === "editor" ? (
        <div className="max-h-[75vh] overflow-auto">
          <EditorContent editor={editor} />
        </div>
      ) : (
        <div className="max-h-[75vh] overflow-auto px-5 py-4">
          <div
            className="prose prose-sm prose-slate max-w-none text-slate-800"
            dangerouslySetInnerHTML={{ __html: editor.getHTML() }}
          />
        </div>
      )}

      {/* ── Pie de estado ── */}
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
  },
);

export { markdownToHtml, htmlToMarkdown };

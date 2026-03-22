"use client";

import { useCallback, useRef, useState } from "react";

// ── Detecta si la cadena parece una URL válida ────────────────────────────
function isValidUrl(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Detecta el proveedor de la URL para mostrar ícono ────────────────────
type UrlProvider = "drive" | "docs" | "sheets" | "slides" | "dropbox" | "onedrive" | "sharepoint" | "notion" | "generic";

function detectProvider(url: string): UrlProvider {
  if (/drive\.google\.com/.test(url)) return "drive";
  if (/docs\.google\.com\/document/.test(url)) return "docs";
  if (/docs\.google\.com\/spreadsheets/.test(url)) return "sheets";
  if (/docs\.google\.com\/presentation/.test(url)) return "slides";
  if (/dropbox\.com/.test(url)) return "dropbox";
  if (/1drv\.ms|onedrive\.live|sharepoint\.com/.test(url)) return "onedrive";
  if (/notion\.so/.test(url)) return "notion";
  return "generic";
}

const PROVIDER_LABELS: Record<UrlProvider, string> = {
  drive: "Google Drive",
  docs: "Google Docs",
  sheets: "Google Sheets",
  slides: "Google Slides",
  dropbox: "Dropbox",
  onedrive: "OneDrive / SharePoint",
  sharepoint: "SharePoint",
  notion: "Notion",
  generic: "Enlace externo",
};

const PROVIDER_ICONS: Record<UrlProvider, string> = {
  drive: "📁",
  docs: "📄",
  sheets: "📊",
  slides: "📽️",
  dropbox: "📦",
  onedrive: "☁️",
  sharepoint: "☁️",
  notion: "📝",
  generic: "🔗",
};

// ── Props ─────────────────────────────────────────────────────────────────
export type PasteUrlFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tailwind class for the input element */
  className?: string;
  /** ID para el label htmlFor */
  id?: string;
};

// ── Component ─────────────────────────────────────────────────────────────
export function PasteUrlField({
  value,
  onChange,
  placeholder = "https://drive.google.com/…",
  className = "",
  id,
}: PasteUrlFieldProps) {
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [pasted, setPasted] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Lee el clipboard cuando el campo recibe foco
  const handleFocus = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (isValidUrl(text) && text !== value) {
        setClipboardUrl(text.trim());
      } else {
        setClipboardUrl(null);
      }
    } catch {
      // El usuario no otorgó permiso de lectura del clipboard — ignorar
      setClipboardUrl(null);
    }
  }, [value]);

  const handlePasteFromClipboard = () => {
    if (!clipboardUrl) return;
    onChange(clipboardUrl);
    setClipboardUrl(null);
    setPasted(true);
    setTimeout(() => setPasted(false), 2000);
  };

  // Drag & drop de texto/URL
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const text = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
    if (text && isValidUrl(text)) {
      onChange(text.trim());
      setPasted(true);
      setTimeout(() => setPasted(false), 2000);
    }
  };

  // Detecta cuando el usuario pega directamente con Ctrl+V
  const handleNativePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (isValidUrl(text)) {
      e.preventDefault();
      onChange(text.trim());
      setClipboardUrl(null);
      setPasted(true);
      setTimeout(() => setPasted(false), 2000);
    }
  };

  const provider = value && isValidUrl(value) ? detectProvider(value) : null;
  const hasValue = value && isValidUrl(value);

  return (
    <div className="space-y-1.5">
      {/* Input + indicador de proveedor */}
      <div
        className={`relative flex items-center rounded-xl transition-all ${
          dragging ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-slate-800" : ""
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {/* Ícono del proveedor o el clip */}
        <span className="absolute left-3 text-sm select-none pointer-events-none">
          {hasValue && provider ? (
            <span title={PROVIDER_LABELS[provider]}>{PROVIDER_ICONS[provider]}</span>
          ) : (
            <span className="text-slate-500">🔗</span>
          )}
        </span>

        <input
          ref={inputRef}
          id={id}
          type="url"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setClipboardUrl(null);
          }}
          onFocus={handleFocus}
          onPaste={handleNativePaste}
          placeholder={placeholder}
          className={`w-full pl-9 pr-3 ${className}`}
          autoComplete="off"
          spellCheck={false}
        />

        {/* Indicador "pegado" */}
        {pasted && (
          <span className="absolute right-3 flex items-center gap-1 text-[11px] font-bold text-emerald-400 animate-in fade-in duration-150">
            ✓ Pegado
          </span>
        )}

        {/* Botón "Ver" cuando hay URL válida */}
        {hasValue && !pasted && (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            className="absolute right-3 flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-400 transition"
            title="Abrir en nueva pestaña"
          >
            ↗
          </a>
        )}
      </div>

      {/* Botón "Pegar desde portapapeles" cuando hay URL detectada */}
      {clipboardUrl && !hasValue && (
        <button
          type="button"
          onClick={handlePasteFromClipboard}
          className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/20 transition animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <span>📋</span>
          <span className="truncate">Pegar: {clipboardUrl}</span>
          <span className="ml-auto shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px]">Ctrl+V</span>
        </button>
      )}

      {/* Badge de proveedor cuando ya hay URL */}
      {hasValue && provider && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-500">Vinculado a:</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-700/60 border border-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">
            {PROVIDER_ICONS[provider]} {PROVIDER_LABELS[provider]}
          </span>
        </div>
      )}
    </div>
  );
}

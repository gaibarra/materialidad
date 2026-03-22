"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  BarChart3,
  FileText,
  Users,
  Shield,
  Settings,
  AlertTriangle,
  BookOpen,
  Scale,
  Building2,
  ClipboardCheck,
  Briefcase,
  Hexagon,
  X,
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  keywords: string[];
  category: string;
}

const COMMANDS: CommandItem[] = [
  {
    id: "dashboard",
    label: "Inteligencia Fiscal",
    description: "Resumen principal con métricas de salud fiscal",
    href: "/dashboard",
    icon: <BarChart3 className="h-4 w-4" />,
    keywords: ["inicio", "dashboard", "resumen", "métricas", "salud"],
    category: "Principal",
  },
  {
    id: "operaciones",
    label: "Operaciones",
    description: "Captura y validación de servicios y facturación",
    href: "/dashboard/operaciones",
    icon: <Briefcase className="h-4 w-4" />,
    keywords: ["operaciones", "facturas", "servicios", "captura"],
    category: "Principal",
  },
  {
    id: "expedientes",
    label: "Expedientes Digitales",
    description: "Expediente integrado con documentos y soporte",
    href: "/dashboard/expedientes",
    icon: <FileText className="h-4 w-4" />,
    keywords: ["expedientes", "dossier", "defensa", "documentos"],
    category: "Principal",
  },
  {
    id: "proveedores",
    label: "Proveedores",
    description: "Gestión y validación de proveedores",
    href: "/dashboard/proveedores",
    icon: <Users className="h-4 w-4" />,
    keywords: ["proveedores", "RFC", "validación", "69B"],
    category: "Actores",
  },
  {
    id: "contratos",
    label: "Contratos",
    description: "Gestión de contratos con soporte fiscal",
    href: "/dashboard/contratos",
    icon: <ClipboardCheck className="h-4 w-4" />,
    keywords: ["contratos", "acuerdos", "legal"],
    category: "Documentación",
  },
  {
    id: "razon-negocio",
    label: "Razón de Negocio",
    description: "Documentación Art. 5-A CFF",
    href: "/dashboard/razon-negocio",
    icon: <BookOpen className="h-4 w-4" />,
    keywords: ["razón", "negocio", "5-A", "CFF", "sustancia"],
    category: "Documentación",
  },
  {
    id: "comparador",
    label: "Comparador de Precios",
    description: "Análisis de precios de mercado",
    href: "/dashboard/comparador-precios",
    icon: <BarChart3 className="h-4 w-4" />,
    keywords: ["comparador", "precios", "mercado", "benchmark"],
    category: "Análisis",
  },
  {
    id: "alertas-csd",
    label: "Alertas SAT / CSD",
    description: "Monitoreo de listas 69-B y sellos digitales",
    href: "/dashboard/alertas-csd",
    icon: <AlertTriangle className="h-4 w-4" />,
    keywords: ["alertas", "SAT", "CSD", "69B", "sellos", "riesgo"],
    category: "Control Fiscal",
  },
  {
    id: "alertas",
    label: "Alertas ESG",
    description: "Alertas ambientales, sociales y de gobernanza",
    href: "/dashboard/alertas",
    icon: <Shield className="h-4 w-4" />,
    keywords: ["alertas", "ESG", "gobernanza", "ambiental"],
    category: "Control Fiscal",
  },
  {
    id: "empresas",
    label: "Organizaciones",
    description: "Gestión de empresas del grupo",
    href: "/dashboard/admin/organizaciones",
    icon: <Building2 className="h-4 w-4" />,
    keywords: ["empresas", "organizaciones", "grupo", "admin"],
    category: "Administración",
  },
  {
    id: "configuracion",
    label: "Configuración",
    description: "Ajustes generales del sistema",
    href: "/dashboard/administracion",
    icon: <Settings className="h-4 w-4" />,
    keywords: ["configuración", "ajustes", "sistema", "admin"],
    category: "Administración",
  },
  {
    id: "fdi-runs",
    label: "Runs FDI",
    description: "Historial operativo de snapshots y refresh de proyecciones",
    href: "/dashboard/administracion/fdi-runs",
    icon: <Hexagon className="h-4 w-4" />,
    keywords: ["fdi", "runs", "jobs", "snapshots", "proyecciones", "operación"],
    category: "Administración",
  },
];

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return { open, setOpen };
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const filtered = query.trim()
    ? COMMANDS.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description.toLowerCase().includes(q) ||
          cmd.keywords.some((k) => k.includes(q))
        );
      })
    : COMMANDS;

  const grouped = filtered.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    },
    {} as Record<string, CommandItem[]>,
  );

  const flatFiltered = Object.values(grouped).flat();

  const navigate = useCallback(
    (item: CommandItem) => {
      onClose();
      setQuery("");
      router.push(item.href);
    },
    [router, onClose],
  );

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
      setQuery("");
    }
  }, [open]);

  // Reset selection on query change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && flatFiltered[selectedIndex]) {
      e.preventDefault();
      navigate(flatFiltered[selectedIndex]);
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.querySelector("[data-selected=true]");
      selected?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => { onClose(); setQuery(""); }}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-lg mx-4 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200"
        role="dialog"
        aria-label="Búsqueda rápida"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
          <Search className="h-5 w-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar módulos, funciones..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-400"
            aria-label="Buscar"
          />
          <button
            onClick={() => { onClose(); setQuery(""); }}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Cerrar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {flatFiltered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No se encontraron resultados para &quot;{query}&quot;
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {category}
                </div>
                {items.map((item) => {
                  const globalIdx = flatFiltered.indexOf(item);
                  const isSelected = globalIdx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected}
                      onClick={() => navigate(item)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className={`shrink-0 ${isSelected ? "text-indigo-500" : "text-slate-400"}`}>
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{item.label}</div>
                        <div className={`text-xs truncate ${isSelected ? "text-indigo-400" : "text-slate-400"}`}>
                          {item.description}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-[10px] text-indigo-400 shrink-0">Enter ↵</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400">
          <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono">↑↓</kbd> Navegar</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono">Enter</kbd> Abrir</span>
          <span><kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-mono">Esc</kbd> Cerrar</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  Building2,
  Calculator,
  CheckCircle2,
  Download,
  FolderSearch,
  History,
  Landmark,
  Loader2,
  Plus,
  RotateCcw,
  Scale,
  Save,
  Sparkles,
  Trash2,
  XCircle,
} from "lucide-react";

import { DashboardShell } from "../../../components/DashboardShell";
import { GuiaContador } from "../../../components/GuiaContador";
import {
  fetchAuditMaterialityVersions,
  restoreAuditMaterialityVersion,
  type AuditMaterialityDossierVersion,
  exportAuditMaterialityDocx,
  exportAuditMaterialityPdf,
  fetchAuditMaterialityDossier,
  upsertAuditMaterialityDossier,
} from "../../../lib/audit-materiality-api";
import { fetchEmpresas, type EmpresaLite } from "../../../lib/providers";
import {
  AUDIT_FINDING_TEMPLATES,
  currency,
  deriveAuditMateriality,
  summarizeFindings,
  type AuditBenchmarkInput,
  type AuditBenchmarkKey,
  type AuditFinding,
  type AuditFindingImpact,
  type AuditFindingSeverity,
} from "../../../lib/audit-materiality";

const inputCls =
  "w-full rounded-xl border border-[rgba(200,192,177,0.8)] bg-white px-3 py-2 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)]/70 focus:border-[var(--fiscal-accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.12)] transition";

const textareaCls =
  "w-full min-h-[110px] rounded-xl border border-[rgba(200,192,177,0.8)] bg-white px-3 py-2 text-sm text-[var(--fiscal-ink)] placeholder:text-[var(--fiscal-muted)]/70 focus:border-[var(--fiscal-accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(45,91,136,0.12)] transition";

const selectCls = `${inputCls} appearance-none`;

const defaultBenchmarkInput: AuditBenchmarkInput = {
  utilidadAntesImpuestos: 0,
  ingresos: 0,
  activos: 0,
  capital: 0,
  gastos: 0,
};

const scenarioTemplates: Array<{ label: string; description: string; values: AuditBenchmarkInput }> = [
  {
    label: "Operativa rentable",
    description: "Compañía de servicios con utilidad estable y crecimiento controlado.",
    values: {
      utilidadAntesImpuestos: 12500000,
      ingresos: 248000000,
      activos: 91000000,
      capital: 44500000,
      gastos: 229000000,
    },
  },
  {
    label: "Margen volátil",
    description: "Entidad con resultados estrechos donde ingresos explican mejor la escala del negocio.",
    values: {
      utilidadAntesImpuestos: 1850000,
      ingresos: 196000000,
      activos: 103000000,
      capital: 51000000,
      gastos: 191000000,
    },
  },
  {
    label: "Intensiva en activos",
    description: "Operación industrial o patrimonial donde balance y solvencia son relevantes.",
    values: {
      utilidadAntesImpuestos: 4200000,
      ingresos: 118000000,
      activos: 286000000,
      capital: 143000000,
      gastos: 111000000,
    },
  },
];

const findingDraftDefault = {
  titulo: "",
  area: "",
  impactoMonto: "",
  impactoTipo: "cuantificable" as AuditFindingImpact,
  severidad: "media" as AuditFindingSeverity,
  descripcion: "",
  recomendacion: "",
};

type DossierPayload = {
  version: number;
  benchmarkInput: AuditBenchmarkInput;
  selectedBenchmarkKey?: AuditBenchmarkKey;
  metRate: string;
  trivialRate: string;
  findings: AuditFinding[];
  mg: number;
  met: number;
  clearlyTrivial: number;
};

type ToastState = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
};

function getEmptyDossierPayload(): DossierPayload {
  return {
    version: 1,
    benchmarkInput: { ...defaultBenchmarkInput },
    selectedBenchmarkKey: undefined,
    metRate: "75",
    trivialRate: "5",
    findings: [],
    mg: 0,
    met: 0,
    clearlyTrivial: 0,
  };
}

function normalizeDossierPayload(payload?: Record<string, unknown> | null): DossierPayload {
  const empty = getEmptyDossierPayload();
  const benchmarkInput = (payload?.benchmarkInput ?? {}) as Partial<AuditBenchmarkInput>;
  return {
    version: typeof payload?.version === "number" ? payload.version : 1,
    benchmarkInput: {
      utilidadAntesImpuestos: Number(benchmarkInput.utilidadAntesImpuestos ?? empty.benchmarkInput.utilidadAntesImpuestos) || 0,
      ingresos: Number(benchmarkInput.ingresos ?? empty.benchmarkInput.ingresos) || 0,
      activos: Number(benchmarkInput.activos ?? empty.benchmarkInput.activos) || 0,
      capital: Number(benchmarkInput.capital ?? empty.benchmarkInput.capital) || 0,
      gastos: Number(benchmarkInput.gastos ?? empty.benchmarkInput.gastos) || 0,
    },
    selectedBenchmarkKey: typeof payload?.selectedBenchmarkKey === "string"
      ? (payload.selectedBenchmarkKey as AuditBenchmarkKey)
      : undefined,
    metRate: typeof payload?.metRate === "string" ? payload.metRate : empty.metRate,
    trivialRate: typeof payload?.trivialRate === "string" ? payload.trivialRate : empty.trivialRate,
    findings: Array.isArray(payload?.findings) ? (payload?.findings as AuditFinding[]) : [],
    mg: Number(payload?.mg ?? empty.mg) || 0,
    met: Number(payload?.met ?? empty.met) || 0,
    clearlyTrivial: Number(payload?.clearlyTrivial ?? empty.clearlyTrivial) || 0,
  };
}

function Section({
  title,
  badge,
  icon,
  children,
}: {
  title: string;
  badge: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-panel overflow-hidden rounded-[1.75rem] shadow-fiscal">
      <div className="flex items-center gap-3 border-b border-[rgba(200,192,177,0.5)] px-6 py-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[rgba(184,137,70,0.22)] bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-gold)]">
          {icon}
        </div>
        <div>
          <p className="kicker-label">{badge}</p>
          <h2 className="font-display text-xl font-semibold tracking-tight text-[var(--fiscal-ink)]">{title}</h2>
        </div>
      </div>
      <div className="px-6 py-6">{children}</div>
    </section>
  );
}

function Kpi({ label, value, tone = "slate", help }: { label: string; value: string; tone?: "slate" | "blue" | "gold" | "red"; help?: string }) {
  const toneMap = {
    slate: "border-[rgba(25,36,52,0.08)] bg-white text-[var(--fiscal-ink)]",
    blue: "border-[rgba(45,91,136,0.18)] bg-[rgba(45,91,136,0.08)] text-[var(--fiscal-accent)]",
    gold: "border-[rgba(184,137,70,0.25)] bg-[rgba(184,137,70,0.12)] text-[var(--fiscal-gold)]",
    red: "border-[rgba(170,44,44,0.2)] bg-[rgba(170,44,44,0.08)] text-[var(--fiscal-danger)]",
  } as const;

  return (
    <div className={`rounded-[1.4rem] border p-4 shadow-[0_14px_34px_rgba(15,23,42,0.04)] ${toneMap[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fiscal-muted)]">{label}</p>
      <p className="mt-3 text-2xl font-semibold">{value}</p>
      {help ? <p className="mt-2 text-sm text-slate-600">{help}</p> : null}
    </div>
  );
}

function FloatingToast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;

  const toneMap = {
    success: {
      shell: "border-[rgba(31,122,90,0.22)] bg-[rgba(31,122,90,0.10)] text-[var(--fiscal-success)]",
      icon: <CheckCircle2 className="h-5 w-5" />,
    },
    error: {
      shell: "border-[rgba(170,44,44,0.22)] bg-[rgba(170,44,44,0.10)] text-[var(--fiscal-danger)]",
      icon: <XCircle className="h-5 w-5" />,
    },
    info: {
      shell: "border-[rgba(45,91,136,0.22)] bg-[rgba(45,91,136,0.10)] text-[var(--fiscal-accent)]",
      icon: <Sparkles className="h-5 w-5" />,
    },
  } as const;

  const tone = toneMap[toast.kind];
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 max-w-sm">
      <div className={`rounded-[1.15rem] border px-4 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur-sm ${tone.shell}`}>
        <div className="flex items-center gap-3">
          {tone.icon}
          <p className="text-sm font-semibold leading-6">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function nextFindingId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `hallazgo-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

export default function MaterialidadAuditoriaPage() {
  const currentYear = new Date().getFullYear();
  const [empresas, setEmpresas] = useState<EmpresaLite[]>([]);
  const [loadingEmpresas, setLoadingEmpresas] = useState(true);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | null>(null);
  const [ejercicio, setEjercicio] = useState(String(currentYear));
  const [benchmarkInput, setBenchmarkInput] = useState<AuditBenchmarkInput>(defaultBenchmarkInput);
  const [selectedBenchmarkKey, setSelectedBenchmarkKey] = useState<AuditBenchmarkKey | undefined>(undefined);
  const [metRate, setMetRate] = useState("75");
  const [trivialRate, setTrivialRate] = useState("5");
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [findingDraft, setFindingDraft] = useState(findingDraftDefault);
  const [dossierId, setDossierId] = useState<number | null>(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [savingDossier, setSavingDossier] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<"pdf" | "docx" | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "unsaved" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const [lastPersistedSignature, setLastPersistedSignature] = useState(JSON.stringify(getEmptyDossierPayload()));
  const [lastEditedByName, setLastEditedByName] = useState("");
  const [lastEditedByEmail, setLastEditedByEmail] = useState("");
  const [lastEditedAt, setLastEditedAt] = useState("");
  const [versions, setVersions] = useState<AuditMaterialityDossierVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [findingValidationRequested, setFindingValidationRequested] = useState(false);

  const showToast = useCallback((kind: ToastState["kind"], message: string) => {
    setToast({ id: Date.now(), kind, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadVersions = useCallback(async (dossierPk: number | null) => {
    if (!dossierPk) {
      setVersions([]);
      return;
    }
    setVersionsLoading(true);
    try {
      const data = await fetchAuditMaterialityVersions(dossierPk);
      setVersions(data);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadEmpresas = async () => {
      setLoadingEmpresas(true);
      try {
        const data = await fetchEmpresas();
        if (cancelled) return;
        setEmpresas(data);
        setSelectedEmpresaId((current) => current ?? data[0]?.id ?? null);
      } catch {
        if (!cancelled) {
          setEmpresas([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingEmpresas(false);
        }
      }
    };

    void loadEmpresas();
    return () => {
      cancelled = true;
    };
  }, []);

  const thresholds = useMemo(
    () => deriveAuditMateriality(benchmarkInput, selectedBenchmarkKey, parseMoneyInput(metRate) / 100, parseMoneyInput(trivialRate) / 100),
    [benchmarkInput, metRate, selectedBenchmarkKey, trivialRate]
  );

  const dossierPayload = useMemo<DossierPayload>(() => ({
    version: 1,
    benchmarkInput,
    selectedBenchmarkKey,
    metRate,
    trivialRate,
    findings,
    mg: thresholds.mg,
    met: thresholds.met,
    clearlyTrivial: thresholds.clearlyTrivial,
  }), [benchmarkInput, findings, metRate, selectedBenchmarkKey, thresholds, trivialRate]);

  const dossierSignature = useMemo(() => JSON.stringify(dossierPayload), [dossierPayload]);

  useEffect(() => {
    let cancelled = false;

    const applyPayload = (payload?: Record<string, unknown> | null) => {
      const normalized = normalizeDossierPayload(payload);
      setBenchmarkInput(normalized.benchmarkInput);
      setSelectedBenchmarkKey(normalized.selectedBenchmarkKey);
      setMetRate(normalized.metRate);
      setTrivialRate(normalized.trivialRate);
      setFindings(normalized.findings);
      setLastPersistedSignature(JSON.stringify(normalized));
      return normalized;
    };

    const loadDossier = async () => {
      if (!selectedEmpresaId || ejercicio.length !== 4) {
        const empty = applyPayload(null);
        setDossierId(null);
        setSaveStatus("idle");
        setSaveError("");
        setLastPersistedSignature(JSON.stringify(empty));
        return;
      }

      setLoadingDossier(true);
      setSaveError("");
      try {
        const record = await fetchAuditMaterialityDossier(selectedEmpresaId, ejercicio);
        if (cancelled) return;

        if (record) {
          const normalized = applyPayload(record.payload);
          setDossierId(record.id);
          setLastEditedByEmail(record.last_edited_by_email || "");
          setLastEditedByName(record.last_edited_by_name || "");
          setLastEditedAt(record.updated_at || "");
          void loadVersions(record.id);
          setSaveStatus("saved");
          setLastPersistedSignature(JSON.stringify(normalized));
        } else {
          const empty = applyPayload(null);
          setDossierId(null);
          setLastEditedByEmail("");
          setLastEditedByName("");
          setLastEditedAt("");
          setVersions([]);
          setSaveStatus("idle");
          setLastPersistedSignature(JSON.stringify(empty));
        }
      } catch (error) {
        if (cancelled) return;
        const empty = applyPayload(null);
        setDossierId(null);
        setLastEditedByEmail("");
        setLastEditedByName("");
        setLastEditedAt("");
        setVersions([]);
        setSaveStatus("error");
        setSaveError((error as Error).message || "No pudimos cargar el expediente");
        setLastPersistedSignature(JSON.stringify(empty));
      } finally {
        if (!cancelled) {
          setLoadingDossier(false);
        }
      }
    };

    void loadDossier();
    return () => {
      cancelled = true;
    };
  }, [ejercicio, loadVersions, selectedEmpresaId]);

  useEffect(() => {
    if (!selectedEmpresaId || ejercicio.length !== 4 || loadingDossier) return;
    if (dossierSignature !== lastPersistedSignature) {
      setSaveStatus("unsaved");
    } else if (dossierId) {
      setSaveStatus("saved");
    }
  }, [dossierId, dossierSignature, ejercicio, lastPersistedSignature, loadingDossier, selectedEmpresaId]);

  const selectedEmpresa = useMemo(
    () => empresas.find((empresa) => empresa.id === selectedEmpresaId) ?? null,
    [empresas, selectedEmpresaId]
  );

  useEffect(() => {
    if (!selectedBenchmarkKey && thresholds.selectedBenchmark.key) {
      setSelectedBenchmarkKey(thresholds.selectedBenchmark.key);
    }
  }, [selectedBenchmarkKey, thresholds.selectedBenchmark.key]);

  const findingsSummary = useMemo(() => summarizeFindings(findings, thresholds), [findings, thresholds]);
  const canAddFinding = Boolean(selectedEmpresaId) && ejercicio.length === 4 && Boolean(findingDraft.titulo.trim()) && Boolean(findingDraft.area.trim());
  const missingContext = !selectedEmpresaId || ejercicio.length !== 4;
  const missingFindingTitle = !findingDraft.titulo.trim();
  const missingFindingArea = !findingDraft.area.trim();

  const quantifiedVsMet = thresholds.met > 0 ? findingsSummary.quantifiedImpact / thresholds.met : 0;
  const quantifiedVsMg = thresholds.mg > 0 ? findingsSummary.quantifiedImpact / thresholds.mg : 0;

  const handleBenchmarkValueChange = (field: keyof AuditBenchmarkInput, value: string) => {
    setBenchmarkInput((current) => ({
      ...current,
      [field]: parseMoneyInput(value),
    }));
  };

  const handleApplyScenario = (values: AuditBenchmarkInput) => {
    setBenchmarkInput(values);
    setSelectedBenchmarkKey(undefined);
  };

  const handleAddFinding = () => {
    setFindingValidationRequested(true);

    if (!selectedEmpresaId || ejercicio.length !== 4) {
      showToast("error", "Selecciona empresa y ejercicio antes de registrar un hallazgo");
      return;
    }

    if (!findingDraft.titulo.trim() || !findingDraft.area.trim()) {
      showToast("error", "Captura al menos título y área para agregar el hallazgo");
      return;
    }

    const nextFinding: AuditFinding = {
      id: nextFindingId(),
      titulo: findingDraft.titulo.trim(),
      area: findingDraft.area.trim(),
      impactoMonto: parseMoneyInput(findingDraft.impactoMonto),
      impactoTipo: findingDraft.impactoTipo,
      severidad: findingDraft.severidad,
      descripcion: findingDraft.descripcion.trim(),
      recomendacion: findingDraft.recomendacion.trim(),
    };
    setFindings((current) => [nextFinding, ...current]);
    setFindingDraft(findingDraftDefault);
    setFindingValidationRequested(false);
    showToast("success", `Hallazgo agregado: ${nextFinding.titulo}`);
  };

  const handleAddTemplate = (index: number) => {
    const template = AUDIT_FINDING_TEMPLATES[index];
    if (!template) return;
    setFindings((current) => [{ ...template, id: nextFindingId() }, ...current]);
  };

  const handleRemoveFinding = (id: string) => {
    setFindings((current) => current.filter((finding) => finding.id !== id));
  };

  const persistDossier = useCallback(async (mode: "manual" | "autosave" = "manual") => {
    if (!selectedEmpresaId || ejercicio.length !== 4) return false;
    setSavingDossier(true);
    setSaveError("");
    try {
      const record = await upsertAuditMaterialityDossier({
        empresa: selectedEmpresaId,
        ejercicio: Number(ejercicio),
        payload: {
          ...dossierPayload,
          saveMode: mode,
        },
      });
      setDossierId(record.id);
      setLastEditedByEmail(record.last_edited_by_email || "");
      setLastEditedByName(record.last_edited_by_name || "");
      setLastEditedAt(record.updated_at || "");
      setLastPersistedSignature(JSON.stringify(normalizeDossierPayload(record.payload)));
      void loadVersions(record.id);
      setSaveStatus("saved");
      showToast("success", mode === "autosave" ? "Autosave sincronizado" : "Expediente guardado correctamente");
      return record;
    } catch (error) {
      setSaveStatus("error");
      setSaveError((error as Error).message || "No pudimos guardar el expediente");
      showToast("error", "No pudimos sincronizar el expediente");
      return false;
    } finally {
      setSavingDossier(false);
    }
  }, [dossierPayload, ejercicio, loadVersions, selectedEmpresaId, showToast]);

  useEffect(() => {
    if (!selectedEmpresaId || ejercicio.length !== 4 || loadingDossier) return;
    if (saveStatus !== "unsaved") return;
    const timer = window.setTimeout(() => {
      void persistDossier("autosave");
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [ejercicio, loadingDossier, persistDossier, saveStatus, selectedEmpresaId]);

  const handleSaveDossier = async () => {
    await persistDossier("manual");
  };

  const handleExport = async (format: "pdf" | "docx") => {
    const canReuseCurrent = dossierSignature === lastPersistedSignature && dossierId;
    setExportingFormat(format);
    try {
      let exportId = dossierId;
      if (!canReuseCurrent) {
        const saved = await persistDossier();
        if (!saved || typeof saved === "boolean") return;
        exportId = saved.id;
      }
      if (!exportId) return;
      if (format === "pdf") {
        await exportAuditMaterialityPdf(exportId);
      } else {
        await exportAuditMaterialityDocx(exportId);
      }
      showToast("info", `Exportación ${format.toUpperCase()} lista`);
    } catch {
      showToast("error", `No pudimos exportar el expediente en ${format.toUpperCase()}`);
    } finally {
      setExportingFormat(null);
    }
  };

  const handleRestoreVersion = async (versionId: number) => {
    if (!dossierId) return;
    setRestoringVersionId(versionId);
    try {
      const record = await restoreAuditMaterialityVersion(dossierId, versionId);
      const normalized = normalizeDossierPayload(record.payload);
      setBenchmarkInput(normalized.benchmarkInput);
      setSelectedBenchmarkKey(normalized.selectedBenchmarkKey);
      setMetRate(normalized.metRate);
      setTrivialRate(normalized.trivialRate);
      setFindings(normalized.findings);
      setLastPersistedSignature(JSON.stringify(normalized));
      setLastEditedByEmail(record.last_edited_by_email || "");
      setLastEditedByName(record.last_edited_by_name || "");
      setLastEditedAt(record.updated_at || "");
      setSaveStatus("saved");
      void loadVersions(record.id);
      showToast("success", "Versión restaurada correctamente");
    } catch (error) {
      showToast("error", (error as Error).message || "No pudimos restaurar la versión seleccionada");
    } finally {
      setRestoringVersionId(null);
    }
  };

  const lastEditedLabel = useMemo(() => {
    if (!lastEditedAt) return "Sin edición registrada todavía";
    try {
      return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(lastEditedAt));
    } catch {
      return lastEditedAt;
    }
  }, [lastEditedAt]);

  const exerciseLabel = `${ejercicio} · ${selectedEmpresa?.razon_social ?? "Sin empresa"}`;
  const sourceLabelMap: Record<AuditMaterialityDossierVersion["source"], string> = {
    MANUAL: "Manual",
    AUTOSAVE: "Autosave",
    RESTORE: "Restauración",
  };

  return (
    <DashboardShell>
      <FloatingToast toast={toast} />
      <div className="space-y-6 px-4 py-6 sm:px-6 xl:px-8">
        <section className="surface-panel overflow-hidden rounded-[2rem] border border-[rgba(184,137,70,0.16)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,244,235,0.94))] shadow-fiscal">
          <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.3fr_0.9fr] lg:px-8 lg:py-8">
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(184,137,70,0.25)] bg-[rgba(184,137,70,0.14)] text-[var(--fiscal-gold)]">
                  <Landmark className="h-6 w-6" />
                </div>
                <div>
                  <p className="kicker-label">Materialidad de Auditoría</p>
                  <h1 className="font-display text-[1.9rem] font-semibold tracking-tight text-[var(--fiscal-ink)] sm:text-[2.2rem]">
                    Fase 1 — criterio, cálculo MG/MET y expediente de hallazgos
                  </h1>
                </div>
              </div>

              <p className="max-w-3xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                Esta vista traduce la lógica de NIA 320 y NIA 450 a un flujo operativo simple: definir la base de materialidad,
                fijar una materialidad global, documentar la materialidad de ejecución y concentrar hallazgos cuantificables y cualitativos
                en un expediente de trabajo por empresa y ejercicio.
              </p>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[1.4rem] border border-[rgba(45,91,136,0.18)] bg-[rgba(45,91,136,0.08)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--fiscal-accent)]">MG</p>
                  <p className="mt-2 text-sm text-slate-700">Importe máximo de error o incorrección que podría influir en usuarios razonables.</p>
                </div>
                <div className="rounded-[1.4rem] border border-[rgba(184,137,70,0.22)] bg-[rgba(184,137,70,0.10)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--fiscal-gold)]">MET</p>
                  <p className="mt-2 text-sm text-slate-700">Umbral operativo para planear pruebas y reducir la probabilidad de errores agregados materiales.</p>
                </div>
                <div className="rounded-[1.4rem] border border-[rgba(170,44,44,0.16)] bg-[rgba(170,44,44,0.07)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--fiscal-danger)]">NIA 450</p>
                  <p className="mt-2 text-sm text-slate-700">Los hallazgos se acumulan y evalúan en conjunto, no solo por incidencia aislada.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-[1.75rem] border border-[rgba(25,36,52,0.08)] bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-2 text-[var(--fiscal-accent)]">
                <Sparkles className="h-5 w-5" />
                <p className="text-sm font-semibold">Expediente persistido por empresa/ejercicio</p>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  La configuración ahora se guarda en backend por tenant para que el equipo comparta el mismo expediente inicial de
                  materialidad mientras aterrizamos el workspace completo de auditoría.
                </p>
                <p>
                  Selecciona una empresa, captura importes base, elige la referencia más defendible y usa el expediente para acumular
                  desviaciones, riesgos de control y asuntos cualitativos.
                </p>
              </div>
              <div className="rounded-[1.4rem] border border-[rgba(200,192,177,0.55)] bg-[rgba(248,244,235,0.9)] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fiscal-muted)]">Contexto activo</p>
                <p className="mt-2 text-sm font-semibold text-[var(--fiscal-ink)]">{exerciseLabel}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {!selectedEmpresaId
                    ? "Selecciona una empresa para iniciar"
                    : loadingDossier
                      ? "Cargando expediente guardado"
                      : dossierId
                        ? `Expediente #${dossierId} cargado`
                        : "Aún no existe expediente guardado para este ejercicio"}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Última edición: {lastEditedByName || lastEditedByEmail ? `${lastEditedByName || lastEditedByEmail} · ${lastEditedLabel}` : lastEditedLabel}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {saveStatus === "saved" && "Autosave al día en backend"}
                    {saveStatus === "unsaved" && "Cambios detectados; autosave en curso"}
                    {saveStatus === "error" && (saveError || "No pudimos sincronizar el expediente")}
                    {saveStatus === "idle" && "Expediente nuevo listo para capturarse"}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleExport("pdf")}
                      disabled={!selectedEmpresaId || ejercicio.length !== 4 || loadingDossier || savingDossier || exportingFormat !== null}
                      className="inline-flex items-center gap-2 rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--fiscal-ink)] transition hover:border-[rgba(184,137,70,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {exportingFormat === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleExport("docx")}
                      disabled={!selectedEmpresaId || ejercicio.length !== 4 || loadingDossier || savingDossier || exportingFormat !== null}
                      className="inline-flex items-center gap-2 rounded-full border border-[rgba(25,36,52,0.12)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--fiscal-ink)] transition hover:border-[rgba(184,137,70,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {exportingFormat === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      Word
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDossier}
                      disabled={!selectedEmpresaId || ejercicio.length !== 4 || savingDossier || loadingDossier}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--fiscal-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingDossier ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      {savingDossier ? "Guardando..." : "Guardar ahora"}
                    </button>
                  </div>
                </div>
              </div>
              <GuiaContador
                section="Materialidad de Auditoría"
                defaultOpen
                steps={[
                  {
                    title: "Escoge la base correcta",
                    description: "Parte de la base que mejor explique qué observan los usuarios: utilidad, ingresos, activos, capital o gasto.",
                  },
                  {
                    title: "Documenta la lógica MG/MET",
                    description: "Conserva una relación explícita entre base, porcentaje, materialidad global y materialidad de ejecución.",
                  },
                  {
                    title: "Acumula hallazgos en conjunto",
                    description: "No cierres por montos aislados; suma los efectos cuantificados y anota banderas cualitativas de control, fraude o revelación.",
                  },
                ]}
                concepts={[
                  { term: "MG", definition: "Materialidad global para los estados financieros en su conjunto." },
                  { term: "MET", definition: "Materialidad de ejecución usada para diseñar procedimientos y evaluar errores acumulados." },
                  { term: "Claramente trivial", definition: "Umbral menor para errores no relevantes que no requieren acumulación extensa." },
                ]}
                tips={[
                  "Usa <strong>utilidad antes de impuestos</strong> cuando exista estabilidad y la entidad opere con fines de lucro.",
                  "Prefiere <strong>ingresos o activos</strong> cuando la utilidad sea demasiado pequeña, errática o no represente la dimensión del negocio.",
                  "Marca como crítico cualquier hallazgo con posible impacto en <strong>fraude, revelación o continuidad</strong>, aunque su cuantificación sea baja.",
                ]}
              />
            </div>
          </div>
        </section>

        <Section title="Configuración del ejercicio" badge="Paso 1" icon={<Building2 className="h-5 w-5" />}>
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_180px]">
            <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
              <span className="inline-flex items-center gap-2">
                Empresa
                <span className="rounded-full bg-[rgba(170,44,44,0.08)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fiscal-danger)]">
                  Obligatorio
                </span>
              </span>
              <select
                className={`${selectCls} ${findingValidationRequested && !selectedEmpresaId ? "border-[rgba(170,44,44,0.35)] bg-[rgba(170,44,44,0.04)]" : ""}`}
                value={selectedEmpresaId ?? ""}
                onChange={(event) => setSelectedEmpresaId(event.target.value ? Number(event.target.value) : null)}
                disabled={loadingEmpresas}
              >
                <option value="">{loadingEmpresas ? "Cargando empresas..." : "Selecciona una empresa"}</option>
                {empresas.map((empresa) => (
                  <option key={empresa.id} value={empresa.id}>
                    {empresa.razon_social} · {empresa.rfc}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
              <span className="inline-flex items-center gap-2">
                Ejercicio
                <span className="rounded-full bg-[rgba(170,44,44,0.08)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fiscal-danger)]">
                  Obligatorio
                </span>
              </span>
              <input
                className={`${inputCls} ${findingValidationRequested && ejercicio.length !== 4 ? "border-[rgba(170,44,44,0.35)] bg-[rgba(170,44,44,0.04)]" : ""}`}
                value={ejercicio}
                onChange={(event) => setEjercicio(event.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                placeholder="2025"
              />
            </label>

            <div className="rounded-[1.4rem] border border-[rgba(200,192,177,0.55)] bg-[rgba(248,244,235,0.82)] p-4 text-sm text-slate-600">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--fiscal-muted)]">Persistencia</p>
              <p className="mt-2">Cada combinación empresa/ejercicio conserva su borrador local de forma independiente.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 xl:grid-cols-3">
            {scenarioTemplates.map((scenario) => (
              <button
                key={scenario.label}
                type="button"
                onClick={() => handleApplyScenario(scenario.values)}
                className="rounded-[1.4rem] border border-[rgba(25,36,52,0.08)] bg-white p-4 text-left shadow-[0_14px_34px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[rgba(184,137,70,0.28)]"
              >
                <p className="text-sm font-semibold text-[var(--fiscal-ink)]">{scenario.label}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{scenario.description}</p>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Calculadora guiada MG / MET" badge="Paso 2" icon={<Calculator className="h-5 w-5" />}>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                  Utilidad antes de impuestos
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={benchmarkInput.utilidadAntesImpuestos || ""}
                    onChange={(event) => handleBenchmarkValueChange("utilidadAntesImpuestos", event.target.value)}
                    placeholder="12500000"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                  Ingresos
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={benchmarkInput.ingresos || ""}
                    onChange={(event) => handleBenchmarkValueChange("ingresos", event.target.value)}
                    placeholder="248000000"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                  Activos totales
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={benchmarkInput.activos || ""}
                    onChange={(event) => handleBenchmarkValueChange("activos", event.target.value)}
                    placeholder="91000000"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                  Capital contable
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={benchmarkInput.capital || ""}
                    onChange={(event) => handleBenchmarkValueChange("capital", event.target.value)}
                    placeholder="44500000"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                  Gasto total
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={benchmarkInput.gastos || ""}
                    onChange={(event) => handleBenchmarkValueChange("gastos", event.target.value)}
                    placeholder="229000000"
                  />
                </label>
                <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                  Materialidad de ejecución (%)
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={metRate}
                    onChange={(event) => setMetRate(event.target.value)}
                    placeholder="75"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                  Umbral claramente trivial (%)
                  <input
                    className={inputCls}
                    inputMode="decimal"
                    value={trivialRate}
                    onChange={(event) => setTrivialRate(event.target.value)}
                    placeholder="5"
                  />
                </label>
                <div className="rounded-[1.4rem] border border-[rgba(200,192,177,0.55)] bg-[rgba(248,244,235,0.82)] p-4 text-sm text-slate-600">
                  Ajusta los porcentajes si tu metodología interna requiere un criterio más conservador.
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fiscal-ink)]">
                  <Scale className="h-4 w-4 text-[var(--fiscal-accent)]" />
                  Selecciona la base defendible para este encargo
                </div>
                <div className="grid gap-3">
                  {thresholds.options.length ? (
                    thresholds.options.map((option) => (
                      <label
                        key={option.key}
                        className={`rounded-[1.35rem] border p-4 transition ${selectedBenchmarkKey === option.key
                          ? "border-[rgba(45,91,136,0.28)] bg-[rgba(45,91,136,0.08)]"
                          : "border-[rgba(25,36,52,0.08)] bg-white"
                          }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="benchmark"
                            checked={selectedBenchmarkKey === option.key}
                            onChange={() => setSelectedBenchmarkKey(option.key)}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-[var(--fiscal-ink)]">{option.label}</p>
                              <span className="rounded-full bg-[rgba(184,137,70,0.12)] px-2.5 py-1 text-xs font-semibold text-[var(--fiscal-gold)]">
                                {(option.rate * 100).toFixed(1)}%
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-slate-600">{option.rationale}</p>
                            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                              <span>Base: {currency(option.value)}</span>
                              <span>MG sugerida: {currency(option.suggestedMg)}</span>
                            </div>
                          </div>
                        </div>
                      </label>
                    ))
                  ) : (
                    <div className="rounded-[1.35rem] border border-dashed border-[rgba(200,192,177,0.8)] bg-[rgba(248,244,235,0.75)] p-5 text-sm text-slate-600">
                      Captura al menos una base positiva para obtener recomendaciones de materialidad.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <Kpi label="Materialidad global" value={currency(thresholds.mg)} tone="blue" help="Resultado de la base elegida por el porcentaje sugerido." />
                <Kpi label="Materialidad de ejecución" value={currency(thresholds.met)} tone="gold" help="Se usa para planear y acumular errores antes del cierre." />
                <Kpi label="Claramente trivial" value={currency(thresholds.clearlyTrivial)} help="Errores menores que normalmente no requieren seguimiento extenso." />
              </div>

              <div className="rounded-[1.5rem] border border-[rgba(25,36,52,0.08)] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fiscal-muted)]">Lectura de planeación</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Para <strong>{selectedEmpresa?.razon_social ?? "la entidad seleccionada"}</strong>, la base activa es
                  <strong> {thresholds.selectedBenchmark.label}</strong>. Esta referencia produce una MG de
                  <strong> {currency(thresholds.mg)}</strong> y una MET de <strong>{currency(thresholds.met)}</strong>.
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Usa esta justificación como texto inicial de tus papeles de trabajo y ajusta el porcentaje si tu matriz de riesgo,
                  usuarios previstos o condiciones del encargo exigen una postura más prudente.
                </p>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Expediente inicial de hallazgos" badge="Paso 3" icon={<FolderSearch className="h-5 w-5" />}>
          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                <Kpi
                  label="Impacto cuantificado"
                  value={currency(findingsSummary.quantifiedImpact)}
                  tone={findingsSummary.metExceeded ? "red" : "slate"}
                  help={`${(quantifiedVsMet * 100).toFixed(0)}% de la MET y ${(quantifiedVsMg * 100).toFixed(0)}% de la MG.`}
                />
                <Kpi
                  label="Hallazgos altos o críticos"
                  value={String(findingsSummary.highSeverityCount)}
                  tone={findingsSummary.highSeverityCount > 0 ? "gold" : "slate"}
                  help={`${findingsSummary.criticalCount} críticos identificados.`}
                />
              </div>

              <div className="rounded-[1.5rem] border border-[rgba(25,36,52,0.08)] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--fiscal-muted)]">Conclusión preliminar</p>
                <p className="mt-3 text-sm leading-7 text-slate-700">{findingsSummary.recommendedConclusion}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {findingsSummary.qualitativeFlags.length ? (
                    findingsSummary.qualitativeFlags.map((flag) => (
                      <span
                        key={flag}
                        className="inline-flex items-center rounded-full border border-[rgba(184,137,70,0.2)] bg-[rgba(184,137,70,0.1)] px-3 py-1 text-xs font-medium text-[var(--fiscal-ink)]"
                      >
                        {flag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">Sin banderas cualitativas relevantes por ahora.</span>
                  )}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[rgba(25,36,52,0.08)] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fiscal-ink)]">
                  <BookOpenCheck className="h-4 w-4 text-[var(--fiscal-accent)]" />
                  Plantillas rápidas
                </div>
                <div className="mt-4 grid gap-3">
                  {AUDIT_FINDING_TEMPLATES.map((template, index) => (
                    <button
                      key={`${template.titulo}-${index}`}
                      type="button"
                      onClick={() => handleAddTemplate(index)}
                      className="rounded-[1.25rem] border border-[rgba(200,192,177,0.55)] bg-[rgba(248,244,235,0.72)] p-4 text-left transition hover:border-[rgba(184,137,70,0.25)]"
                    >
                      <p className="text-sm font-semibold text-[var(--fiscal-ink)]">{template.titulo}</p>
                      <p className="mt-2 text-sm text-slate-600">{template.descripcion}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-[1.5rem] border border-[rgba(25,36,52,0.08)] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fiscal-ink)]">
                  <Plus className="h-4 w-4 text-[var(--fiscal-accent)]" />
                  Nuevo hallazgo
                </div>
                <p className="mt-2 text-xs font-medium text-[var(--fiscal-muted)]">
                  Los campos marcados como obligatorios deben completarse para habilitar el registro.
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                    <span className="inline-flex items-center gap-2">
                      Título
                      <span className="rounded-full bg-[rgba(170,44,44,0.08)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fiscal-danger)]">
                        Obligatorio
                      </span>
                    </span>
                    <input
                      className={`${inputCls} ${findingValidationRequested && missingFindingTitle ? "border-[rgba(170,44,44,0.35)] bg-[rgba(170,44,44,0.04)]" : ""}`}
                      value={findingDraft.titulo}
                      onChange={(event) => setFindingDraft((current) => ({ ...current, titulo: event.target.value }))}
                      placeholder="Reconocimiento de ingresos al cierre"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                    <span className="inline-flex items-center gap-2">
                      Área
                      <span className="rounded-full bg-[rgba(170,44,44,0.08)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--fiscal-danger)]">
                        Obligatorio
                      </span>
                    </span>
                    <input
                      className={`${inputCls} ${findingValidationRequested && missingFindingArea ? "border-[rgba(170,44,44,0.35)] bg-[rgba(170,44,44,0.04)]" : ""}`}
                      value={findingDraft.area}
                      onChange={(event) => setFindingDraft((current) => ({ ...current, area: event.target.value }))}
                      placeholder="Ingresos"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                    Impacto estimado
                    <input
                      className={inputCls}
                      inputMode="decimal"
                      value={findingDraft.impactoMonto}
                      onChange={(event) => setFindingDraft((current) => ({ ...current, impactoMonto: event.target.value }))}
                      placeholder="420000"
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)]">
                    Tipo de impacto
                    <select
                      className={selectCls}
                      value={findingDraft.impactoTipo}
                      onChange={(event) => setFindingDraft((current) => ({ ...current, impactoTipo: event.target.value as AuditFindingImpact }))}
                    >
                      <option value="cuantificable">Cuantificable</option>
                      <option value="potencial">Potencial</option>
                      <option value="cualitativo">Cualitativo</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)] md:col-span-2">
                    Severidad
                    <select
                      className={selectCls}
                      value={findingDraft.severidad}
                      onChange={(event) => setFindingDraft((current) => ({ ...current, severidad: event.target.value as AuditFindingSeverity }))}
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="critica">Crítica</option>
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)] md:col-span-2">
                    Descripción
                    <textarea
                      className={textareaCls}
                      value={findingDraft.descripcion}
                      onChange={(event) => setFindingDraft((current) => ({ ...current, descripcion: event.target.value }))}
                      placeholder="Describe el origen del hallazgo, evidencia observada y posible distorsión."
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--fiscal-ink)] md:col-span-2">
                    Recomendación / siguiente paso
                    <textarea
                      className={textareaCls}
                      value={findingDraft.recomendacion}
                      onChange={(event) => setFindingDraft((current) => ({ ...current, recomendacion: event.target.value }))}
                      placeholder="Indica pruebas adicionales, ajuste propuesto o escalamiento."
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    {missingContext
                      ? "Selecciona empresa y ejercicio para vincular el hallazgo al expediente."
                      : missingFindingTitle || missingFindingArea
                        ? "Completa título y área para habilitar el registro del hallazgo."
                        : "La captura queda vinculada al contexto activo y se acumula en el expediente preliminar."}
                  </p>
                  <button
                    type="button"
                    onClick={handleAddFinding}
                    disabled={!canAddFinding}
                    aria-disabled={!canAddFinding}
                    className="inline-flex items-center gap-2 rounded-full bg-[var(--fiscal-accent)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar hallazgo
                  </button>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-[rgba(25,36,52,0.08)] bg-white p-5 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fiscal-ink)]">
                    <AlertTriangle className="h-4 w-4 text-[var(--fiscal-gold)]" />
                    Hallazgos acumulados
                  </div>
                  <span className="rounded-full bg-[rgba(45,91,136,0.08)] px-3 py-1 text-xs font-semibold text-[var(--fiscal-accent)]">
                    {findings.length} registro(s)
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {findings.length ? (
                    findings.map((finding) => (
                      <article
                        key={finding.id}
                        className="rounded-[1.3rem] border border-[rgba(200,192,177,0.55)] bg-[rgba(248,244,235,0.72)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--fiscal-ink)]">{finding.titulo}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-[var(--fiscal-muted)]">{finding.area}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFinding(finding.id)}
                            className="rounded-full border border-[rgba(170,44,44,0.18)] p-2 text-[var(--fiscal-danger)] transition hover:bg-[rgba(170,44,44,0.08)]"
                            aria-label={`Eliminar ${finding.titulo}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
                          <span className="rounded-full bg-white px-3 py-1 text-slate-600">{finding.impactoTipo}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-slate-600">{finding.severidad}</span>
                          <span className="rounded-full bg-white px-3 py-1 text-slate-600">Impacto {currency(finding.impactoMonto)}</span>
                        </div>
                        {finding.descripcion ? <p className="mt-3 text-sm leading-6 text-slate-600">{finding.descripcion}</p> : null}
                        {finding.recomendacion ? <p className="mt-2 text-sm leading-6 text-slate-700"><strong>Próximo paso:</strong> {finding.recomendacion}</p> : null}
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[1.3rem] border border-dashed border-[rgba(200,192,177,0.8)] bg-[rgba(248,244,235,0.72)] p-5 text-sm text-slate-600">
                      Todavía no hay hallazgos. Usa una plantilla o registra el primero para empezar a acumular errores y banderas cualitativas.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Historial del expediente" badge="Paso 4" icon={<History className="h-5 w-5" />}>
          <div className="space-y-4">
            <div className="rounded-[1.4rem] border border-[rgba(200,192,177,0.55)] bg-[rgba(248,244,235,0.72)] p-4 text-sm text-slate-600">
              Cada guardado relevante crea un snapshot del expediente. Puedes revisar las últimas versiones y restaurar un punto anterior si necesitas rehacer el análisis.
            </div>

            <div className="space-y-3">
              {versionsLoading ? (
                <div className="flex items-center gap-2 rounded-[1.25rem] border border-[rgba(200,192,177,0.55)] bg-white p-4 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando historial del expediente...
                </div>
              ) : versions.length ? (
                versions.map((version) => {
                  const versionDate = (() => {
                    try {
                      return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.created_at));
                    } catch {
                      return version.created_at;
                    }
                  })();

                  return (
                    <article
                      key={version.id}
                      className="flex flex-col gap-3 rounded-[1.3rem] border border-[rgba(25,36,52,0.08)] bg-white p-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)] lg:flex-row lg:items-center lg:justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[var(--fiscal-ink)]">Versión {version.version_number}</p>
                          <span className="rounded-full bg-[rgba(45,91,136,0.08)] px-2.5 py-1 text-xs font-semibold text-[var(--fiscal-accent)]">
                            {sourceLabelMap[version.source]}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {version.edited_by_name || version.edited_by_email || "Sistema"} · {versionDate}
                        </p>
                        <p className="text-xs text-slate-500">
                          {Array.isArray(version.payload?.findings) ? version.payload.findings.length : 0} hallazgo(s) · base {(version.payload?.selectedBenchmarkKey as string) || "sin definir"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRestoreVersion(version.id)}
                        disabled={restoringVersionId === version.id || savingDossier || loadingDossier}
                        className="inline-flex items-center gap-2 rounded-full border border-[rgba(184,137,70,0.25)] bg-[rgba(184,137,70,0.10)] px-4 py-2 text-sm font-semibold text-[var(--fiscal-ink)] transition hover:border-[rgba(184,137,70,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {restoringVersionId === version.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Restaurar
                      </button>
                    </article>
                  );
                })
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-[rgba(200,192,177,0.72)] bg-[rgba(248,244,235,0.62)] p-5 text-sm text-slate-600">
                  Aún no hay versiones disponibles. El historial empezará a poblarse conforme guardes o se active el autosave.
                </div>
              )}
            </div>
          </div>
        </Section>
      </div>
    </DashboardShell>
  );
}

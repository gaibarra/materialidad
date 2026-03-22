export type AuditBenchmarkKey =
  | "utilidad_antes_impuestos"
  | "ingresos"
  | "activos"
  | "capital"
  | "gastos";

export type AuditFindingImpact = "cuantificable" | "potencial" | "cualitativo";
export type AuditFindingSeverity = "baja" | "media" | "alta" | "critica";

export type AuditBenchmarkInput = {
  utilidadAntesImpuestos: number;
  ingresos: number;
  activos: number;
  capital: number;
  gastos: number;
};

export type AuditFinding = {
  id: string;
  titulo: string;
  area: string;
  impactoMonto: number;
  impactoTipo: AuditFindingImpact;
  severidad: AuditFindingSeverity;
  descripcion: string;
  recomendacion: string;
};

export type AuditBenchmarkOption = {
  key: AuditBenchmarkKey;
  label: string;
  rate: number;
  rationale: string;
  value: number;
  suggestedMg: number;
};

export type AuditMaterialityResult = {
  selectedBenchmark: AuditBenchmarkOption;
  options: AuditBenchmarkOption[];
  mg: number;
  met: number;
  clearlyTrivial: number;
};

export type AuditFindingsSummary = {
  totalImpact: number;
  quantifiedImpact: number;
  highSeverityCount: number;
  criticalCount: number;
  metExceeded: boolean;
  mgExceeded: boolean;
  qualitativeFlags: string[];
  recommendedConclusion: string;
};

const BENCHMARK_META: Record<AuditBenchmarkKey, { label: string; rate: number; rationale: string }> = {
  utilidad_antes_impuestos: {
    label: "Utilidad antes de impuestos",
    rate: 0.05,
    rationale: "Referencia típica cuando la entidad opera con utilidades relativamente estables.",
  },
  ingresos: {
    label: "Ingresos",
    rate: 0.01,
    rationale: "Útil cuando la utilidad es volátil o no representa la escala operativa del ejercicio.",
  },
  activos: {
    label: "Activos totales",
    rate: 0.01,
    rationale: "Conveniente en entidades intensivas en activos o con foco en solvencia y balance.",
  },
  capital: {
    label: "Capital contable",
    rate: 0.02,
    rationale: "Ayuda cuando la atención de usuarios se concentra en patrimonio y cumplimiento financiero.",
  },
  gastos: {
    label: "Gasto total",
    rate: 0.01,
    rationale: "Buena alternativa para entidades sin fines de lucro o con operaciones centradas en ejecución presupuestal.",
  },
};

const SEVERITY_WEIGHT: Record<AuditFindingSeverity, number> = {
  baja: 1,
  media: 2,
  alta: 3,
  critica: 4,
};

const QUALITATIVE_FLAG_MAP: Record<AuditFindingSeverity, string> = {
  baja: "Seguimiento normal en cierre de hallazgos.",
  media: "Revisar revelaciones y respuesta de la administración.",
  alta: "Escalar al socio y evaluar ampliación de procedimientos.",
  critica: "Posible efecto en opinión, continuidad o fraude; documentar de inmediato.",
};

export function currency(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function sanitize(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function buildBenchmarkOptions(input: AuditBenchmarkInput): AuditBenchmarkOption[] {
  const values: Record<AuditBenchmarkKey, number> = {
    utilidad_antes_impuestos: sanitize(input.utilidadAntesImpuestos),
    ingresos: sanitize(input.ingresos),
    activos: sanitize(input.activos),
    capital: sanitize(input.capital),
    gastos: sanitize(input.gastos),
  };

  return (Object.entries(BENCHMARK_META) as Array<[AuditBenchmarkKey, (typeof BENCHMARK_META)[AuditBenchmarkKey]]>)
    .map(([key, meta]) => ({
      key,
      label: meta.label,
      rate: meta.rate,
      rationale: meta.rationale,
      value: values[key],
      suggestedMg: values[key] * meta.rate,
    }))
    .filter((option) => option.value > 0)
    .sort((left, right) => right.suggestedMg - left.suggestedMg);
}

export function deriveAuditMateriality(
  input: AuditBenchmarkInput,
  benchmarkKey?: AuditBenchmarkKey,
  metRate = 0.75,
  trivialRate = 0.05,
): AuditMaterialityResult {
  const options = buildBenchmarkOptions(input);
  const fallback = options[0] ?? {
    key: "ingresos" as AuditBenchmarkKey,
    label: BENCHMARK_META.ingresos.label,
    rate: BENCHMARK_META.ingresos.rate,
    rationale: BENCHMARK_META.ingresos.rationale,
    value: 0,
    suggestedMg: 0,
  };

  const selectedBenchmark = options.find((option) => option.key === benchmarkKey) ?? fallback;
  const mg = selectedBenchmark.suggestedMg;
  const met = mg * metRate;
  const clearlyTrivial = mg * trivialRate;

  return {
    selectedBenchmark,
    options,
    mg,
    met,
    clearlyTrivial,
  };
}

export function summarizeFindings(
  findings: AuditFinding[],
  thresholds: Pick<AuditMaterialityResult, "mg" | "met">
): AuditFindingsSummary {
  const totalImpact = findings.reduce((sum, finding) => sum + sanitize(finding.impactoMonto), 0);
  const quantifiedImpact = findings
    .filter((finding) => finding.impactoTipo !== "cualitativo")
    .reduce((sum, finding) => sum + sanitize(finding.impactoMonto), 0);
  const highSeverityCount = findings.filter((finding) => SEVERITY_WEIGHT[finding.severidad] >= 3).length;
  const criticalCount = findings.filter((finding) => finding.severidad === "critica").length;
  const qualitativeFlags = Array.from(
    new Set(findings.filter((finding) => finding.impactoTipo === "cualitativo" || finding.severidad !== "baja").map((finding) => QUALITATIVE_FLAG_MAP[finding.severidad]))
  );

  const metExceeded = quantifiedImpact >= thresholds.met && thresholds.met > 0;
  const mgExceeded = quantifiedImpact >= thresholds.mg && thresholds.mg > 0;

  let recommendedConclusion = "Hallazgos dentro de tolerancia; mantener seguimiento y cierre documental.";
  if (criticalCount > 0) {
    recommendedConclusion = "Existe al menos un hallazgo crítico; escalar al socio y documentar posible efecto en la opinión.";
  } else if (mgExceeded) {
    recommendedConclusion = "La suma cuantificada rebasa la materialidad global; revaluar estrategia de auditoría y ajustes propuestos.";
  } else if (metExceeded || highSeverityCount >= 2) {
    recommendedConclusion = "La suma se aproxima o rebasa la materialidad de ejecución; ampliar pruebas y seguimiento con la administración.";
  }

  return {
    totalImpact,
    quantifiedImpact,
    highSeverityCount,
    criticalCount,
    metExceeded,
    mgExceeded,
    qualitativeFlags,
    recommendedConclusion,
  };
}

export const AUDIT_FINDING_TEMPLATES: Array<Omit<AuditFinding, "id">> = [
  {
    titulo: "Ingresos devengados sin soporte suficiente",
    area: "Ingresos",
    impactoMonto: 420000,
    impactoTipo: "cuantificable",
    severidad: "alta",
    descripcion: "Se detectan pólizas cercanas al cierre sin evidencia robusta de entrega o aceptación del servicio.",
    recomendacion: "Extender pruebas de corte y confirmar evidencia externa antes de concluir ingresos reconocidos.",
  },
  {
    titulo: "Deterioro potencial de cuentas por cobrar",
    area: "Cuentas por cobrar",
    impactoMonto: 180000,
    impactoTipo: "potencial",
    severidad: "media",
    descripcion: "La antigüedad de saldos sugiere pérdida esperada superior a la reconocida por la administración.",
    recomendacion: "Actualizar matriz de incobrabilidad y revisar hechos posteriores de cobranza.",
  },
  {
    titulo: "Acceso privilegiado sin segregación",
    area: "TI / Controles generales",
    impactoMonto: 0,
    impactoTipo: "cualitativo",
    severidad: "critica",
    descripcion: "El mismo usuario administra altas, cambios maestros y aprobación de pólizas críticas.",
    recomendacion: "Diseñar control compensatorio, revisar bitácoras y valorar impacto en riesgo de fraude.",
  },
];

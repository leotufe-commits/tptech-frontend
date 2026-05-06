// src/pages/InventarioArticulosMovimientos.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Ban, Calendar, Eye, Filter, Package, PackageOpen, Plus, Printer, SlidersHorizontal, Tag, Trash2, X } from "lucide-react";
import { cn } from "../components/ui/tp";

import TPSectionShell from "../components/ui/TPSectionShell";
import { TPButton } from "../components/ui/TPButton";
import { TPIconButton } from "../components/ui/TPIconButton";
import { TPBadge } from "../components/ui/TPBadges";
import { type SortDir } from "../components/ui/TPSort";
import TPDateRangeInline, { type TPDateRangeValue } from "../components/ui/TPDateRangeInline";
import { TPFilterPopover, type TPFilterOption } from "../components/ui/TPFilterPopover";
import TPComboFixed from "../components/ui/TPComboFixed";
import ArticleVariantSearchSelect, { type VariantSelectResult } from "../components/ui/ArticleVariantSearchSelect";
import {
  TPTablePaginated,
  TPTr,
  TPTh,
  TPTd,
} from "../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPField } from "../components/ui/TPField";
import TPInput from "../components/ui/TPInput";
import TPNumberInput from "../components/ui/TPNumberInput";
import Modal from "../components/ui/Modal";
import { TPCard } from "../components/ui/TPCard";
import TPImageLightbox from "../components/ui/TPImageLightbox";

import { apiFetch } from "../lib/api";
import { toast } from "../lib/toast";
import { fmtNumberSmart, fmtMoney2 } from "../lib/format";
import { printMovement } from "../lib/movementPrint";
import { documentTemplatesApi } from "../services/document-templates";
import { useAuth } from "../context/AuthContext";

import {
  articleMovementsApi,
  type ArticleMovementKind,
  type ArticleMovementRow,
  type CreateMovementLine,
} from "../services/article-movements";
import type { ArticleRow } from "../services/articles";

/* =========================================================
   Column definitions
========================================================= */
const COL_KEY = "tptech_col_art_movimientos";

const KIND_OPTIONS: TPFilterOption<ArticleMovementKind | "">[] = [
  { value: "",          label: "Todos los tipos" },
  { value: "IN",        label: "Entrada" },
  { value: "OUT",       label: "Salida" },
  { value: "TRANSFER",  label: "Transferencia" },
  { value: "ADJUST",    label: "Ajuste" },
  { value: "OPENING",   label: "Apertura" },
];

const KIND_CHIPS: {
  value: ArticleMovementKind;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}[] = [
  { value: "IN",       label: "Entrada",       icon: ArrowDownToLine,   activeClass: "bg-green-50  border-green-400  text-green-700"  },
  { value: "OUT",      label: "Salida",         icon: ArrowUpFromLine,   activeClass: "bg-red-50    border-red-400    text-red-700"    },
  { value: "TRANSFER", label: "Transferencia",  icon: ArrowLeftRight,    activeClass: "bg-blue-50   border-blue-400   text-blue-700"   },
  { value: "ADJUST",   label: "Ajuste",         icon: SlidersHorizontal, activeClass: "bg-amber-50  border-amber-400  text-amber-700"  },
  { value: "OPENING",  label: "Apertura",       icon: PackageOpen,       activeClass: "bg-violet-50 border-violet-400 text-violet-700" },
];

const COLS: TPColDef[] = [
  { key: "date",      label: "Fecha",            canHide: false, sortKey: "date" },
  { key: "status",    label: "Estado",                           sortKey: "status" },
  { key: "type",      label: "Tipo",                             sortKey: "type" },
  { key: "code",      label: "Comprobante",                      sortKey: "code" },
  { key: "user",      label: "Usuario",                          sortKey: "user" },
  { key: "warehouse", label: "Almacén",                          sortKey: "warehouse" },
  { key: "articles",  label: "Artículos" },
  { key: "qty",       label: "Cant. total" },
  { key: "impact",    label: "Impacto" },
  { key: "note",      label: "Nota",              visible: false },
  { key: "actions",   label: "Acciones",          canHide: false, align: "right" },
];

/* =========================================================
   Helpers
========================================================= */
type SortCol = "date" | "code" | "type" | "status" | "user" | "warehouse";

function s(v: any) { return String(v ?? "").trim(); }

function fmtDateTime(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-AR");
}

// Muestra solo la fecha (sin hora) — usar para effectiveAt que el usuario ingresó como fecha
function fmtDate(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-AR");
}

// Fecha + hora compacta para segunda línea en tabla: "10/04 14:23"
function fmtDateTimeShort(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function dateToIso(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

// Retorna la fecha local de hoy en formato YYYY-MM-DD (evita el desfase UTC de toISOString)
function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function movementTone(kind: string): "success" | "danger" | "info" | "warning" | "primary" | "neutral" {
  switch (kind) {
    case "IN":       return "success";
    case "OUT":      return "danger";
    case "TRANSFER": return "info";
    case "ADJUST":   return "warning";
    case "OPENING":  return "primary";
    default:         return "neutral";
  }
}

function movementLabel(kind: ArticleMovementKind) {
  const MAP: Record<ArticleMovementKind, string> = {
    IN: "Entrada", OUT: "Salida", TRANSFER: "Transferencia", ADJUST: "Ajuste", OPENING: "Apertura",
  };
  return MAP[kind] ?? kind;
}

function warehouseLabel(m: ArticleMovementRow): string {
  if (m.kind === "TRANSFER") {
    const from = s(m.fromWarehouse?.name ?? m.fromWarehouse?.code) || "—";
    const to   = s(m.toWarehouse?.name   ?? m.toWarehouse?.code)   || "—";
    return `${from} → ${to}`;
  }
  return s(m.warehouse?.name ?? m.warehouse?.code) || "—";
}

type ImpactInfo = { label: string; textClass: string; bgClass: string };

function getImpact(m: ArticleMovementRow): ImpactInfo {
  const lines = m.lines ?? [];
  const total = lines.reduce((sum, l) => sum + Number(l.quantity), 0);
  const fmt   = (n: number) => Math.abs(n).toLocaleString("es-AR");
  switch (m.kind) {
    case "IN":
      return { label: `+${fmt(total)}`,  textClass: "text-green-700",  bgClass: "bg-green-500/10 border-green-400/30" };
    case "OPENING":
      return { label: `+${fmt(total)}`,  textClass: "text-violet-700", bgClass: "bg-violet-500/10 border-violet-400/30" };
    case "OUT":
      return { label: `-${fmt(total)}`,  textClass: "text-red-700",    bgClass: "bg-red-500/10 border-red-400/30" };
    case "ADJUST":
      if (total > 0) return { label: `+${fmt(total)}`, textClass: "text-amber-700", bgClass: "bg-amber-500/10 border-amber-400/30" };
      if (total < 0) return { label: `-${fmt(total)}`, textClass: "text-amber-700", bgClass: "bg-amber-500/10 border-amber-400/30" };
      return { label: "±0", textClass: "text-muted", bgClass: "bg-surface2/20 border-border" };
    case "TRANSFER":
      return { label: `\u21C4 ${fmt(total)}`, textClass: "text-blue-700", bgClass: "bg-blue-500/10 border-blue-400/30" };
    default:
      return { label: fmt(total), textClass: "text-muted", bgClass: "bg-surface2/20 border-border" };
  }
}

function movementTotalQty(m: ArticleMovementRow): number {
  return (m.lines ?? []).reduce((sum, l) => sum + Math.abs(Number(l.quantity)), 0);
}

/* =========================================================
   Impresión de movimiento (usa plantilla PDF configurada)
========================================================= */

async function handlePrint(m: ArticleMovementRow, jewelry: Record<string, any> | null) {
  const data = {
    title:        "Movimiento de stock",
    code:         s(m.code) || m.id,
    kindLabel:    movementLabel(m.kind),
    isVoided:     Boolean(m.voidedAt),
    effectiveAt:  m.effectiveAt ?? "",
    createdAt:    m.createdAt   ?? "",
    createdByName: s(m.createdBy?.name ?? m.createdBy?.email) || "",
    warehouse:    warehouseLabel(m),
    note:         s(m.note || ""),
    voidedAt:     m.voidedAt     ?? "",
    voidedByName: s(m.voidedBy?.name ?? m.voidedBy?.email) || "",
    voidedNote:   s(m.voidedNote || ""),
    lines: (m.lines ?? []).map(l => ({
      description: s(l.article?.name    ?? l.articleId) || "—",
      variant:     s(l.variant?.name)   || "—",
      code:        s(l.variant?.code    ?? l.article?.code) || "—",
      sku:         s(l.variant?.sku)    || "—",
      quantity:    Number(l.quantity),
      unit:        "un.",
      weight:      null as number | null,
    })),
  };

  try {
    await printMovement(
      data,
      jewelry,
      () => documentTemplatesApi.get("MOVIMIENTO_STOCK", "A4")
    );
  } catch (e: any) {
    if (e?.message === "blocked") {
      toast.error("El navegador bloqueó la ventana de impresión. Permitir popups para este sitio.");
    }
  }
}

/* =========================================================
   Types para el modal nuevo movimiento
========================================================= */
type WarehouseOption = { id: string; name: string; code: string };

type DraftLine = {
  articleId: string;
  articleName: string;
  articleCode: string;
  articleRow: ArticleRow | null;
  variantId: string | null;      // resuelto al seleccionar en el combo
  variantName: string | null;    // etiqueta display de la variante
  variantSku: string | null;     // SKU real de la variante seleccionada
  quantity: number | null;          // para IN / OUT / OPENING / TRANSFER
  newStock: number | null;          // para ADJUST: stock deseado
  refWeightPerUnit: number | null;  // peso de referencia de la variante/artículo (fijo, no editable)
  weightPerUnit: number | null;     // peso unitario editable (pre-cargado desde refWeight)
  totalWeight: number | null;       // peso total editable (= quantity × weightPerUnit); bidireccional
  /** true cuando el ítem seleccionado tiene composición metálica real */
  hasMetal: boolean;
};

const EMPTY_LINE: DraftLine = {
  articleId: "", articleName: "", articleCode: "",
  articleRow: null,
  variantId: null, variantName: null, variantSku: null,
  quantity: null, newStock: null,
  refWeightPerUnit: null,
  weightPerUnit: null,
  totalWeight: null,
  hasMetal: false,
};

/* =========================================================
   Helpers de unidad
========================================================= */
const GRAM_UNITS = new Set(["g", "gr", "gramos"]);
function isGramUnit(u: string): boolean {
  return GRAM_UNITS.has(u.toLowerCase().trim());
}

/* =========================================================
   itemHasMetal — detecta si el artículo seleccionado tiene metal
   Regla: solo mostrar campos de peso cuando el ítem tiene metal real.
   Fuentes de verdad (en orden de confiabilidad):
   1. costCalculationMode === "METAL_MERMA_HECHURA"  → siempre tiene metal
   2. costComposition con al menos una línea tipo "METAL"
   3. compositions (tabla legada) con al menos una entrada
   Excluye: servicios (SERVICE nunca tienen metal relevante para movimientos)
========================================================= */
function itemHasMetal(articleRow: ArticleRow | null | undefined): boolean {
  if (!articleRow) return false;
  if (articleRow.articleType === "SERVICE") return false;
  // Solo retornar true si costComposition tiene al menos una línea METAL con quantity > 0.
  // No usar costCalculationMode como atajo (el modo puede estar sin composiciones asignadas).
  // No usar el campo legacy "compositions" (puede tener datos de artículos ya migrados
  // que el usuario no considera metálicos en el sistema actual).
  return (articleRow.costComposition ?? []).some(
    (c) => c.type === "METAL" && parseFloat(String(c.quantity ?? "0")) > 0
  );
}

/* =========================================================
   resolveItemGrams — gramaje total del ítem seleccionado
   Prioridad:
   1. Suma de líneas METAL   (costComposition tipo METAL — fuente de verdad principal)
   2. variantWeightOverride  (override explícito de la variante)
   3. article.weight         (campo legacy; puede representar peso físico, no metal)
   Retorna null si no hay ninguna fuente válida.
========================================================= */
function resolveItemGrams(
  articleRow: ArticleRow | null | undefined,
  variantWeightOverride: string | null | undefined
): number | null {
  if (!articleRow) return null;

  // 1. Suma de líneas METAL en costComposition (fuente más confiable)
  const metalLines = (articleRow.costComposition ?? []).filter(
    (c) => c.type === "METAL" && parseFloat(String(c.quantity ?? "0")) > 0
  );
  if (metalLines.length > 0) {
    const total = metalLines.reduce((acc, c) => acc + parseFloat(String(c.quantity)), 0);
    if (Number.isFinite(total) && total > 0) return total;
  }

  // 2. weightOverride de variante
  if (variantWeightOverride != null) {
    const v = parseFloat(String(variantWeightOverride));
    if (Number.isFinite(v) && v > 0) return v;
  }

  // 3. weight del artículo padre (legacy — puede ser peso físico, no necesariamente metal)
  if ((articleRow as any).weight != null) {
    const w = parseFloat(String((articleRow as any).weight));
    if (Number.isFinite(w) && w > 0) return w;
  }

  return null;
}

/* =========================================================
   WeightRow — fila de peso unitario (solo para artículos en unidades)
========================================================= */
function WeightRow({
  weightPerUnit,
  onChange,
}: {
  weightPerUnit: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="pt-3 border-t border-border/50">
      <div className="flex flex-col gap-1 w-36">
        <p className="text-xs text-muted">Peso unitario (g)</p>
        <TPNumberInput
          value={weightPerUnit}
          onChange={onChange}
          min={0}
          step={0.001}
          decimals={3}
          placeholder="0,000"
        />
      </div>
    </div>
  );
}

/* =========================================================
   Componente principal
========================================================= */
export default function InventarioArticulosMovimientos() {
  const { jewelry } = useAuth();

  /* ---- lista ---- */
  const [loading, setLoading]   = useState(false);
  const [rows, setRows]         = useState<ArticleMovementRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(30);

  /* ---- filtros ---- */
  const [q,                setQ]                = useState("");
  const [kind,             setKind]             = useState<ArticleMovementKind | "">("");
  const [dateRange,        setDateRange]        = useState<TPDateRangeValue>({ from: null, to: null });
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [dateOpen,          setDateOpen]          = useState(false);
  const [articleFilterOpen, setArticleFilterOpen] = useState(false);
  const [filterArticleId,   setFilterArticleId]   = useState<string | null>(null);
  const [filterArticleName, setFilterArticleName] = useState<string>("");
  const [filterVariantId,   setFilterVariantId]   = useState<string | null>(null);
  const [filterVariantName, setFilterVariantName] = useState<string>("");
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  /* ---- sort ---- */
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  /* ---- datos comunes ---- */
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  /* ---- detail modal ---- */
  const [viewTarget,   setViewTarget]   = useState<ArticleMovementRow | null>(null);
  const [lightboxSrc,  setLightboxSrc]  = useState<string | null>(null);

  /* ---- void modal ---- */
  const [voidTarget, setVoidTarget] = useState<ArticleMovementRow | null>(null);
  const [voidNote,   setVoidNote]   = useState("");
  const [voidBusy,   setVoidBusy]   = useState(false);
  const [voidSubmitted, setVoidSubmitted] = useState(false);

  /* ---- modal nuevo movimiento ---- */
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [mvKind,            setMvKind]            = useState<ArticleMovementKind>("IN");
  const [mvWarehouseId,     setMvWarehouseId]     = useState("");
  const [mvFromWarehouseId, setMvFromWarehouseId] = useState("");
  const [mvToWarehouseId,   setMvToWarehouseId]   = useState("");
  const [mvDate,            setMvDate]            = useState(() => localDateStr());
  const [mvNote,            setMvNote]            = useState("");
  const [lines,             setLines]             = useState<DraftLine[]>([{ ...EMPTY_LINE }]);

  /* ---- moneda base (símbolo para costo / precio) ---- */
  const [baseCurrencySymbol, setBaseCurrencySymbol] = useState("$");

  /* ---- lightbox imagen ---- */
  const [zoomedImg, setZoomedImg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<any>("/valuation/currencies")
      .then((res) => {
        const list: any[] = Array.isArray(res) ? res : (res.rows ?? res.currencies ?? []);
        const base = list.find((c: any) => c.isBase);
        if (base?.symbol) setBaseCurrencySymbol(base.symbol);
      })
      .catch(() => { /* silencioso: ya hay fallback "$" */ });
  }, []);

  /* ---- stock map para ADJUST ---- */
  // Cargado desde /warehouses/:id/article-stock cuando kind=ADJUST + warehouse elegido.
  // Clave: `${articleId}|${variantId ?? ""}` → cantidad actual.
  const [warehouseStockMap, setWarehouseStockMap] = useState<Record<string, number>>({});
  const [loadingStockMap,   setLoadingStockMap]   = useState(false);
  const [toWarehouseStockMap, setToWarehouseStockMap] = useState<Record<string, number>>({});
  const [loadingToStockMap,   setLoadingToStockMap]   = useState(false);

  const searchTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  /* ------------------------------------------------------------------ */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await articleMovementsApi.list({
        page,
        pageSize,
        q: s(q),
        kind: kind || undefined,
        articleId: filterArticleId || undefined,
        variantId: filterVariantId || undefined,
        from: dateToIso(dateRange.from),
        to: dateToIso(dateRange.to),
      });
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total ?? 0));
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudieron cargar movimientos.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, q, kind, dateRange, filterArticleId, filterVariantId]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setPage(1); }, [q, kind, dateRange, pageSize, filterArticleId, filterVariantId]);

  /* ---- atajo rápido desde sidebar ---- */
  useEffect(() => {
    function onQuickCreate(e: Event) {
      const { screen } = (e as CustomEvent).detail ?? {};
      if (screen === "movimientos-articulos") openModal();
    }
    window.addEventListener("tptech:sidebar_quick_create", onQuickCreate);
    return () => window.removeEventListener("tptech:sidebar_quick_create", onQuickCreate);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- cargar almacenes al montar ---- */
  useEffect(() => {
    apiFetch<any>("/warehouses", { method: "GET" })
      .then((res) => {
        const list: any[] = Array.isArray((res as any)?.rows) ? (res as any).rows : Array.isArray(res) ? res : [];
        const active = list.filter((w: any) => w.isActive && !w.deletedAt);
        setWarehouses(active);
      })
      .catch(() => {});
  }, []);

  /* ---- cargar stock del almacén (principal / origen) ---- */
  useEffect(() => {
    if (!showModal) { setWarehouseStockMap({}); return; }
    const whId = mvKind === "TRANSFER" ? mvFromWarehouseId : mvWarehouseId;
    if (!whId) { setWarehouseStockMap({}); return; }
    setLoadingStockMap(true);
    apiFetch<any>(`/warehouses/${whId}/article-stock`, { method: "GET" })
      .then((rows: any) => {
        const arr: any[] = Array.isArray(rows) ? rows : [];
        const map: Record<string, number> = {};
        arr.forEach((r: any) => {
          const key = `${r.article.id}|${r.variant?.id ?? ""}`;
          map[key] = Number(r.quantity) || 0;
        });
        setWarehouseStockMap(map);
      })
      .catch(() => setWarehouseStockMap({}))
      .finally(() => setLoadingStockMap(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mvKind, mvWarehouseId, mvFromWarehouseId, showModal]);

  /* ---- cargar stock del almacén destino (solo TRANSFER) ---- */
  useEffect(() => {
    if (!showModal || mvKind !== "TRANSFER" || !mvToWarehouseId) {
      setToWarehouseStockMap({});
      return;
    }
    setLoadingToStockMap(true);
    apiFetch<any>(`/warehouses/${mvToWarehouseId}/article-stock`, { method: "GET" })
      .then((rows: any) => {
        const arr: any[] = Array.isArray(rows) ? rows : [];
        const map: Record<string, number> = {};
        arr.forEach((r: any) => {
          const key = `${r.article.id}|${r.variant?.id ?? ""}`;
          map[key] = Number(r.quantity) || 0;
        });
        setToWarehouseStockMap(map);
      })
      .catch(() => setToWarehouseStockMap({}))
      .finally(() => setLoadingToStockMap(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mvKind, mvToWarehouseId, showModal]);

  /* ---- sort cliente ---- */
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date")      cmp = new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime();
      if (sortCol === "code")      cmp = s(a.code).localeCompare(s(b.code), "es");
      if (sortCol === "type")      cmp = a.kind.localeCompare(b.kind, "es");
      if (sortCol === "status")    cmp = (a.voidedAt ? 1 : 0) - (b.voidedAt ? 1 : 0);
      if (sortCol === "user")      cmp = s(a.createdBy?.name ?? a.createdBy?.email).localeCompare(s(b.createdBy?.name ?? b.createdBy?.email), "es");
      if (sortCol === "warehouse") cmp = warehouseLabel(a).localeCompare(warehouseLabel(b), "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const activeDateFilter = dateRange.from != null || dateRange.to != null;

  /* ── chips de filtros activos ─────────────────────────────────────────── */
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (filterArticleId) {
      const articleLabel = filterVariantId && filterVariantName
        ? `${filterArticleName || filterArticleId} — ${filterVariantName}`
        : filterArticleName || filterArticleId;
      chips.push({
        key: "article",
        label: `Artículo: ${articleLabel}`,
        onRemove: () => {
          setFilterArticleId(null);
          setFilterArticleName("");
          setFilterVariantId(null);
          setFilterVariantName("");
        },
      });
    }

    if (kind !== "") {
      const label = KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind;
      chips.push({ key: "kind", label: `Tipo: ${label}`, onRemove: () => setKind("") });
    }

    if (activeDateFilter) {
      const fmt = (d: Date) => d.toLocaleDateString("es-AR");
      const from = dateRange.from ? fmt(dateRange.from) : null;
      const to   = dateRange.to   ? fmt(dateRange.to)   : null;
      const label = from && to ? `${from} — ${to}` : from ? `Desde ${from}` : `Hasta ${to}`;
      chips.push({ key: "date", label: `Fecha: ${label}`, onRemove: () => setDateRange({ from: null, to: null }) });
    }

    return chips;
  }, [filterArticleId, filterArticleName, filterVariantId, filterVariantName, kind, activeDateFilter, dateRange]);

  function clearAllFilters() {
    setFilterArticleId(null);
    setFilterArticleName("");
    setFilterVariantId(null);
    setFilterVariantName("");
    setArticleFilterOpen(false);
    setKind("");
    setDateRange({ from: null, to: null });
    setQ("");
  }

  /* ---- toggle filtros (solo uno abierto a la vez) ---- */
  function toggleFilterPopover() {
    setFilterPopoverOpen((v) => !v);
    setDateOpen(false);
    setArticleFilterOpen(false);
  }

  function toggleDateOpen() {
    setDateOpen((v) => !v);
    setFilterPopoverOpen(false);
    setArticleFilterOpen(false);
  }

  function toggleArticleFilter() {
    setArticleFilterOpen((v) => !v);
    setFilterPopoverOpen(false);
    setDateOpen(false);
  }

  /* ------------------------------------------------------------------ */
  /* VOID                                                                  */
  /* ------------------------------------------------------------------ */
  async function handleVoid() {
    setVoidSubmitted(true);
    if (!voidNote.trim()) return;
    if (!voidTarget) return;

    setVoidBusy(true);
    try {
      await articleMovementsApi.voidMovement(voidTarget.id, voidNote.trim());
      toast.success("Movimiento anulado.");
      setVoidTarget(null);
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo anular el movimiento.");
    } finally {
      setVoidBusy(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* CREATE MODAL                                                          */
  /* ------------------------------------------------------------------ */
  function openModal() {
    setMvKind("IN");
    setMvWarehouseId(warehouses[0]?.id ?? "");
    setMvFromWarehouseId(warehouses[0]?.id ?? "");
    setMvToWarehouseId(warehouses[1]?.id ?? warehouses[0]?.id ?? "");
    setMvDate(localDateStr());
    setMvNote("");
    setLines([{ ...EMPTY_LINE }]);
    setSubmitted(false);
    setWarehouseStockMap({});
    setToWarehouseStockMap({});
    setShowModal(true);
  }

  function handleVariantSelect(idx: number, result: VariantSelectResult) {
    // Detectar duplicado: ¿otra línea (índice distinto) ya tiene la misma clave?
    const incomingKey = result.variantId ?? result.articleId;
    const isDuplicate = lines.some((l, i) => {
      if (i === idx || !l.articleId) return false;
      return (l.variantId ?? l.articleId) === incomingKey;
    });
    if (isDuplicate) {
      toast.error("Este artículo ya fue agregado al movimiento.");
      return;
    }

    const dq = Number(result.defaultQuantity) || 0;
    const autoQty = dq > 0 ? dq : 1;

    const gm = isGramUnit((result.articleRow as any)?.unitOfMeasure ?? "");

    // Detectar si el ítem tiene metal real (variante, simple o servicio)
    const hasMetal = itemHasMetal(result.articleRow);

    // Pre-cargar peso:
    // - Solo para artículos en unidades (no gramos)
    // - Solo si el ítem tiene metal real
    // - resolveItemGrams resuelve: weightOverride → article.weight → suma de líneas METAL
    const rawWeight = !gm && hasMetal
      ? resolveItemGrams(result.articleRow, result.variantWeightOverride)
      : null;
    const autoWeight = rawWeight != null && rawWeight > 0 ? rawWeight : null;
    const initQty    = gm ? null : autoQty;
    const autoTotal  = initQty != null && autoWeight != null ? initQty * autoWeight : null;

    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        articleId:    result.articleId,
        articleName:  result.articleName,
        articleCode:  result.articleCode,
        articleRow:   result.articleRow,
        variantId:    result.variantId,
        variantName:  result.variantName,
        variantSku:   result.variantSku,
        quantity:         initQty,
        newStock:         null,
        hasMetal,
        refWeightPerUnit: autoWeight,
        weightPerUnit:    autoWeight,
        totalWeight:      autoTotal,
      };
      return copy;
    });
  }

  function clearArticle(idx: number) {
    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...EMPTY_LINE };
      return copy;
    });
  }

  function setLineField<K extends keyof DraftLine>(idx: number, field: K, value: DraftLine[K]) {
    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  function addLine() { setLines((prev) => [...prev, { ...EMPTY_LINE }]); }
  function removeLine(idx: number) { setLines((prev) => prev.filter((_, i) => i !== idx)); }

  function swapWarehouses() {
    const from = mvFromWarehouseId;
    const to   = mvToWarehouseId;
    setMvFromWarehouseId(to);
    setMvToWarehouseId(from);
  }

  async function handleSave() {
    setSubmitted(true);

    if (mvKind === "TRANSFER") {
      if (!mvFromWarehouseId || !mvToWarehouseId) return;
      if (mvFromWarehouseId === mvToWarehouseId) return;
    } else {
      if (!mvWarehouseId) return;
    }
    if (!mvDate) return;
    if (lines.length === 0) return;
    if (lines.some(l => !l.articleId)) return;

    // Validación específica por tipo
    if (mvKind === "ADJUST") {
      if (lines.some(l => l.newStock == null || l.newStock < 0)) return;
    } else {
      if (lines.some(l => l.quantity == null || l.quantity === 0)) return;
    }

    // Detectar líneas duplicadas (misma clave variantId ?? articleId)
    const lineKeys = lines.map(l => l.variantId ?? l.articleId).filter(Boolean);
    if (lineKeys.length !== new Set(lineKeys).size) {
      toast.error("Hay artículos duplicados en el movimiento. Revisá las líneas antes de guardar.");
      return;
    }

    // OPENING: ningún artículo puede tener stock/historial previo en el almacén
    if (mvKind === "OPENING") {
      const hasConflict = lines.some(l => {
        if (!l.articleId) return false;
        const key = `${l.articleId}|${l.variantId ?? ""}`;
        return warehouseStockMap[key] !== undefined;
      });
      if (hasConflict) {
        toast.error("Uno o más artículos ya tienen historial en este almacén. Usá Ajuste para corregir el stock.");
        return;
      }
    }

    setSaving(true);
    try {
      // Para ADJUST: calcular delta = newStock - currentStock
      const payload: CreateMovementLine[] = lines.map(l => {
        // Artículos en gramos: weightPerUnit = 1 (totalWeight = quantity × 1 = quantity)
        const gm  = isGramUnit((l.articleRow as any)?.unitOfMeasure ?? "");
        const wpu = gm ? 1 : (l.weightPerUnit ?? undefined);
        if (mvKind === "ADJUST") {
          const stockKey     = `${l.articleId}|${l.variantId ?? ""}`;
          const currentStock = warehouseStockMap[stockKey] ?? 0;
          const delta        = (l.newStock ?? 0) - currentStock;
          return { articleId: l.articleId, variantId: l.variantId || null, quantity: delta, weightPerUnit: wpu };
        }
        return { articleId: l.articleId, variantId: l.variantId || null, quantity: l.quantity!, weightPerUnit: wpu };
      });

      let hasNegativeStock = false;

      if (mvKind === "TRANSFER") {
        await articleMovementsApi.transfer({
          fromWarehouseId: mvFromWarehouseId,
          toWarehouseId:   mvToWarehouseId,
          effectiveAt:     new Date(`${mvDate}T00:00:00`).toISOString(),
          note:            mvNote,
          lines:           payload,
        });
      } else {
        const result = await articleMovementsApi.create({
          kind:        mvKind as Exclude<ArticleMovementKind, "TRANSFER">,
          warehouseId: mvWarehouseId,
          effectiveAt: new Date(`${mvDate}T00:00:00`).toISOString(),
          note:        mvNote,
          lines:       payload,
        });
        hasNegativeStock = result.hasNegativeStock === true;
      }

      toast.success("Movimiento registrado.");
      if (hasNegativeStock) {
        toast.warning("Atención: el stock de uno o más artículos quedó en negativo.");
      }
      setShowModal(false);
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  /* ================================================================== */
  const canTransfer = warehouses.length >= 2;
  const hasAnyOpeningConflict =
    mvKind === "OPENING" &&
    !loadingStockMap &&
    lines.some(l => {
      if (!l.articleId) return false;
      const key = `${l.articleId}|${l.variantId ?? ""}`;
      return warehouseStockMap[key] !== undefined;
    });

  return (
    <TPSectionShell
      title="Movimientos de artículos"
      subtitle="Entradas, salidas, transferencias, ajustes y aperturas de stock."
    >
      <TPTableKit
        rows={sortedRows}
        columns={COLS}
        storageKey={COL_KEY}
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar por nota, comprobante…"
        sortKey={sortCol}
        sortDir={sortDir}
        onSort={(key) => handleSort(key as SortCol)}
        loading={loading}
        onRowClick={(m) => setViewTarget(m)}
        emptyText="No hay movimientos."
        countLabel="movimientos"
        pagination={{
          page,
          pageSize,
          totalItems: total,
          onPageChange: setPage,
          onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
          pageSizeOptions: [10, 30, 50, 100],
        }}
        headerLeft={
          <div className="flex items-center gap-1.5">
            {/* ── Botón filtro tipo ── */}
            <div className="relative shrink-0">
              <TPIconButton
                ref={filterBtnRef}
                onClick={toggleFilterPopover}
                active={filterPopoverOpen || kind !== ""}
                title="Filtrar por tipo"
              >
                <Filter size={15} />
              </TPIconButton>
              {kind !== "" && (
                <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none flex items-center justify-center px-1">
                  1
                </span>
              )}
            </div>


            {/* ── Control de fecha unificado (botón + selector inline) ── */}
            <div className="flex items-center shrink-0">
              <div className="relative shrink-0">
                <TPIconButton
                  onClick={toggleDateOpen}
                  active={dateOpen || activeDateFilter}
                  title="Filtrar por fecha"
                >
                  <Calendar size={15} />
                </TPIconButton>
                {activeDateFilter && (
                  <span className="pointer-events-none absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-primary text-white text-[9px] font-bold leading-none flex items-center justify-center px-1">
                    1
                  </span>
                )}
              </div>
              {dateOpen && (
                <div className="ml-1.5 shrink-0">
                  <TPDateRangeInline
                    value={dateRange}
                    onChange={setDateRange}
                    showPresets
                    defaultPresetDays={0}
                  />
                </div>
              )}
            </div>
          </div>
        }
        belowHeader={
          activeChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-border bg-surface2/20">
              {activeChips.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs px-2.5 py-0.5"
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                    title="Quitar filtro"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-xs text-muted hover:text-primary transition-colors ml-1"
              >
                Limpiar todo
              </button>
            </div>
          ) : undefined
        }
        actions={
          <TPButton iconLeft={<Plus size={14} />} onClick={openModal}>
            Nuevo movimiento
          </TPButton>
        }
        renderRow={(m, vis) => {
          const isVoided   = Boolean(m.voidedAt);
          const who        = s(m.createdBy?.name ?? m.createdBy?.email) || "—";
          const wh         = warehouseLabel(m);

          return (
            <TPTr
              key={m.id}
              className={cn("border-b border-border", isVoided && "opacity-60")}
            >
              {vis.date     && (
                <TPTd>
                  <div className="flex flex-col gap-0.5">
                    <span className={isVoided ? "line-through text-text" : "text-text"}>
                      {fmtDate(m.effectiveAt)}
                    </span>
                    <span className="text-xs text-muted">
                      reg. {fmtDateTimeShort(m.createdAt)}
                    </span>
                  </div>
                </TPTd>
              )}
              {vis.status   && (
                <TPTd>
                  {isVoided
                    ? <TPBadge tone="danger">Anulado</TPBadge>
                    : <TPBadge tone="success">Confirmado</TPBadge>
                  }
                </TPTd>
              )}
              {vis.type      && <TPTd><TPBadge tone={movementTone(m.kind)}>{movementLabel(m.kind)}</TPBadge></TPTd>}
              {vis.code      && <TPTd className="text-muted font-mono text-xs">{s(m.code) || "—"}</TPTd>}
              {vis.user      && <TPTd>{who}</TPTd>}
              {vis.warehouse && (
                <TPTd>
                  {m.kind === "TRANSFER" ? (
                    <span className="text-xs">
                      <span className="text-text">{s(m.fromWarehouse?.name ?? m.fromWarehouse?.code) || "—"}</span>
                      <span className="text-muted mx-1">→</span>
                      <span className="text-text">{s(m.toWarehouse?.name ?? m.toWarehouse?.code) || "—"}</span>
                    </span>
                  ) : (
                    <span className="text-muted">{wh}</span>
                  )}
                </TPTd>
              )}
              {vis.articles && (
                <TPTd>
                  {(() => {
                    const mvLines = m.lines ?? [];
                    if (mvLines.length === 0) return <span className="text-xs text-muted">—</span>;
                    const first = mvLines[0];
                    const firstName = first.article?.name ?? "—";
                    if (mvLines.length === 1) {
                      const v = first.variant?.name ? ` — ${first.variant.name}` : "";
                      return <span className="text-xs text-text truncate max-w-[180px] block">{firstName}{v}</span>;
                    }
                    return (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-text truncate max-w-[140px]">{firstName}</span>
                        <span className="shrink-0 text-[10px] font-medium text-muted bg-surface2/30 border border-border px-1.5 py-0.5 rounded-full">
                          +{mvLines.length - 1} más
                        </span>
                      </div>
                    );
                  })()}
                </TPTd>
              )}
              {vis.qty && (
                <TPTd>
                  <span className="text-sm text-text tabular-nums">
                    {movementTotalQty(m).toLocaleString("es-AR")}
                    <span className="text-xs text-muted ml-0.5">u.</span>
                  </span>
                </TPTd>
              )}
              {vis.impact && (
                <TPTd>
                  {(() => {
                    const imp = getImpact(m);
                    return (
                      <span className={cn(
                        "inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border",
                        imp.bgClass, imp.textClass
                      )}>
                        {imp.label}
                      </span>
                    );
                  })()}
                </TPTd>
              )}
              {vis.note      && <TPTd className="text-muted">{s(m.note) || "—"}</TPTd>}
              {vis.actions   && (
                <TPTd className="text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <TPButton
                      variant="ghost"
                      onClick={() => setViewTarget(m)}
                      title="Ver detalle"
                    >
                      <Eye size={14} />
                    </TPButton>
                    {!isVoided && (
                      <TPButton
                        variant="ghost"
                        onClick={() => { setVoidTarget(m); setVoidNote(""); setVoidSubmitted(false); }}
                        title="Anular movimiento"
                      >
                        <Ban size={14} />
                      </TPButton>
                    )}
                  </div>
                </TPTd>
              )}
            </TPTr>
          );
        }}
      />

      {/* ================================================================
          Modal — detalle de movimiento
      ================================================================ */}
      <Modal
        open={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        title="Detalle del movimiento"
        maxWidth="5xl"
        resizable
        maximizable
        maximizedMode="embedded"
        modalKey="inventario-articulos-movimientos-view"
        footer={
          <div className="flex w-full items-center justify-between">
            <TPButton
              variant="ghost"
              iconLeft={<Printer size={14} />}
              onClick={() => { if (viewTarget) handlePrint(viewTarget, jewelry); }}
            >
              Imprimir
            </TPButton>
            <TPButton variant="secondary" onClick={() => setViewTarget(null)}>Cerrar</TPButton>
          </div>
        }
      >
        {viewTarget && (
          <div className="space-y-4">
            {/* Header */}
            <TPCard className="p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs text-muted mb-0.5">Comprobante</div>
                  <div className="font-mono text-sm font-semibold text-text">{s(viewTarget.code) || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted mb-0.5">Tipo</div>
                  <TPBadge tone={movementTone(viewTarget.kind)}>{movementLabel(viewTarget.kind)}</TPBadge>
                </div>
                <div>
                  <div className="text-xs text-muted mb-0.5">Estado</div>
                  {viewTarget.voidedAt
                    ? <TPBadge tone="danger">Anulado</TPBadge>
                    : <TPBadge tone="success">Confirmado</TPBadge>
                  }
                </div>
                <div>
                  <div className="text-xs text-muted mb-0.5">Fecha efectiva</div>
                  <div className="text-sm text-text">{fmtDate(viewTarget.effectiveAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted mb-0.5">Registrado el</div>
                  <div className="text-sm text-text">{fmtDateTime(viewTarget.createdAt)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted mb-0.5">Creado por</div>
                  <div className="text-sm text-text">{s(viewTarget.createdBy?.name ?? viewTarget.createdBy?.email) || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted mb-0.5">Almacén</div>
                  <div className="text-sm text-text">{warehouseLabel(viewTarget)}</div>
                </div>
                {viewTarget.note && (
                  <div className="col-span-2 md:col-span-3">
                    <div className="text-xs text-muted mb-0.5">Nota</div>
                    <div className="text-sm text-text">{viewTarget.note}</div>
                  </div>
                )}
                {viewTarget.voidedAt && (
                  <>
                    <div>
                      <div className="text-xs text-muted mb-0.5">Anulado el</div>
                      <div className="text-sm text-text">{fmtDateTime(viewTarget.voidedAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted mb-0.5">Anulado por</div>
                      <div className="text-sm text-text">{s(viewTarget.voidedBy?.name ?? viewTarget.voidedBy?.email) || "—"}</div>
                    </div>
                    {viewTarget.voidedNote && (
                      <div className="col-span-2 md:col-span-3">
                        <div className="text-xs text-muted mb-0.5">Motivo de anulación</div>
                        <div className="text-sm text-text">{viewTarget.voidedNote}</div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TPCard>

            {/* Líneas */}
            {(() => {
              const hasWeight = viewTarget.lines.some(
                l => l.weightPerUnit != null && Number(l.weightPerUnit) > 0
              );
              const colSpan = hasWeight ? 6 : 4;
              const totalQty   = viewTarget.lines.reduce((sum, l) => sum + Number(l.quantity), 0);
              const totalGrams = viewTarget.lines.reduce((sum, l) => sum + (l.totalWeight != null ? Number(l.totalWeight) : 0), 0);

              // Desglose global por variante de metal.
              // metals[] viene del backend (NO se recalcula aquí).
              const metalGramMap = new Map<string, { name: string; grams: number }>();
              for (const l of viewTarget.lines) {
                for (const m of l.metals) {
                  const key = m.metalVariantId ?? m.name;
                  const entry = metalGramMap.get(key);
                  if (entry) entry.grams += m.gramsTotal;
                  else metalGramMap.set(key, { name: m.name, grams: m.gramsTotal });
                }
              }
              const metalGramEntries = Array.from(metalGramMap.values());
              return (
                <>
                <TPTablePaginated
                  rows={viewTarget.lines}
                  colSpan={colSpan}
                  headerLeft="Artículos"
                  emptyText="Sin líneas."
                  hideFooter
                  renderHead={() => (
                    <tr>
                      <TPTh>Artículo</TPTh>
                      <TPTh>SKU</TPTh>
                      <TPTh>Variante</TPTh>
                      <TPTh className="text-right">Cantidad</TPTh>
                      {hasWeight && <TPTh className="text-right">Gramos unit.</TPTh>}
                      {hasWeight && <TPTh className="text-right">Gramos total</TPTh>}
                    </tr>
                  )}
                  renderRow={(l) => {
                    const imgSrc = l.variant?.imageUrl || l.article?.mainImageUrl || null;
                    const sku    = l.variant?.sku || l.article?.sku || null;
                    return (
                      <TPTr key={l.id}>
                        {/* Artículo con miniatura */}
                        <TPTd className="text-sm text-text">
                          <div className="flex items-center gap-2">
                            <div
                              className={`shrink-0 w-12 h-12 rounded overflow-hidden border border-border bg-surface2 flex items-center justify-center ${imgSrc ? "cursor-zoom-in" : ""}`}
                              onClick={imgSrc ? (e) => { e.stopPropagation(); setLightboxSrc(imgSrc); } : undefined}
                            >
                              {imgSrc
                                ? <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                                : <Package size={12} className="text-muted opacity-50" />
                              }
                            </div>
                            <span>{l.article?.name ?? l.articleId}</span>
                          </div>
                        </TPTd>
                        {/* SKU */}
                        <TPTd className="text-muted font-mono text-xs whitespace-nowrap">
                          {sku || "—"}
                        </TPTd>
                        {/* Variante */}
                        <TPTd className="text-sm text-muted">
                          {l.variant?.name ?? "—"}
                        </TPTd>
                        {/* Cantidad */}
                        <TPTd className="text-right font-semibold text-sm">
                          {fmtNumberSmart(Number(l.quantity))}
                        </TPTd>
                        {/* Gramos unitario — desglose por variante de metal (viene del backend) */}
                        {hasWeight && (
                          <TPTd className="text-sm text-muted">
                            {l.weightPerUnit != null && Number(l.weightPerUnit) > 0 ? (
                              <div className="flex flex-col items-end gap-0.5">
                                <span className="tabular-nums">
                                  {fmtNumberSmart(Number(l.weightPerUnit))} g
                                </span>
                                {l.metals.length > 1 && (
                                  <ul className="w-full space-y-0.5 border-t border-border/50 pt-0.5 text-[11px] text-muted/70">
                                    {l.metals.map((m) => (
                                      <li key={m.metalVariantId ?? m.name} className="flex justify-between gap-2">
                                        <span className="truncate">{m.name}</span>
                                        <span className="tabular-nums shrink-0">
                                          {fmtNumberSmart(m.gramsUnit)} g
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {l.metals.length === 1 && (
                                  <span className="text-[11px] text-muted/70">{l.metals[0].name}</span>
                                )}
                              </div>
                            ) : "—"}
                          </TPTd>
                        )}
                        {/* Gramos total */}
                        {hasWeight && (
                          <TPTd className="text-right text-sm text-muted tabular-nums">
                            {l.totalWeight != null && Number(l.totalWeight) > 0
                              ? `${fmtNumberSmart(Number(l.totalWeight))} g`
                              : "—"}
                          </TPTd>
                        )}
                      </TPTr>
                    );
                  }}
                  renderFooter={() => {
                    const n = viewTarget.lines.length;
                    return (
                      <tr className="border-t-2 border-border bg-surface2/40 font-semibold text-sm">
                        <td className="px-4 py-2">
                          <span className="text-xs text-muted">
                            {n} {n === 1 ? "artículo" : "artículos"}
                          </span>
                        </td>
                        <td />
                        <td />
                        <td className="px-4 py-2 text-right tabular-nums">
                          {fmtNumberSmart(totalQty)}{" "}
                          <span className="text-muted font-normal">u.</span>
                        </td>
                        {hasWeight && <td />}
                        {hasWeight && (
                          <td className="px-4 py-2 text-right tabular-nums">
                            {fmtNumberSmart(totalGrams)}{" "}
                            <span className="text-muted font-normal">g</span>
                          </td>
                        )}
                      </tr>
                    );
                  }}
                />

                {/* Resumen metálico */}
                {hasWeight && metalGramEntries.length > 0 && (
                  <div className="mx-4 mb-4 rounded-lg border border-border bg-surface2/30 overflow-hidden">
                    {/* Cabecera — resumen general */}
                    <div className="flex items-center justify-between gap-4 border-b border-border/60 px-4 py-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                        Resumen metálico
                      </span>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span>
                          {metalGramEntries.length}{" "}
                          {metalGramEntries.length === 1 ? "variante" : "variantes"}
                        </span>
                        <span className="text-border">·</span>
                        <span className="tabular-nums font-semibold text-text">
                          {fmtNumberSmart(totalGrams)}{" "}
                          <span className="font-normal text-muted">g totales</span>
                        </span>
                      </div>
                    </div>
                    {/* Desglose por variante */}
                    <div className="divide-y divide-border/40 px-4">
                      {metalGramEntries.map((m) => (
                        <div key={m.name} className="flex items-center justify-between gap-4 py-2 text-sm">
                          <span className="text-muted">{m.name}</span>
                          <span className="tabular-nums font-semibold text-text">
                            {fmtNumberSmart(m.grams)}{" "}
                            <span className="font-normal text-muted">g</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                </>
              );
            })()}
          </div>
        )}
      </Modal>
      <TPImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

      {/* ================================================================
          Modal — anular movimiento
      ================================================================ */}
      <Modal
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title="Anular movimiento"
        subtitle="Esta acción revierte el efecto del movimiento sobre el stock y no se puede deshacer."
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="secondary" onClick={() => setVoidTarget(null)} disabled={voidBusy}>
              Cancelar
            </TPButton>
            <TPButton variant="danger" loading={voidBusy} onClick={() => void handleVoid()}>
              Anular
            </TPButton>
          </div>
        }
      >
        {voidTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              Movimiento <span className="font-mono font-semibold">{s(voidTarget.code)}</span> —{" "}
              {movementLabel(voidTarget.kind)} del {fmtDate(voidTarget.effectiveAt)}
            </div>
            <TPField
              label="Motivo de anulación"
              required
              error={voidSubmitted && !voidNote.trim() ? "El motivo es obligatorio." : null}
            >
              <TPInput
                value={voidNote}
                onChange={setVoidNote}
                placeholder="Describí el motivo de la anulación…"
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleVoid(); }
                }}
              />
            </TPField>
          </div>
        )}
      </Modal>

      {/* ================================================================
          Modal — nuevo movimiento
      ================================================================ */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo movimiento de artículos"
        maxWidth="5xl"
        resizable
        maximizable
        maximizedMode="embedded"
        modalKey="inventario-articulos-movimientos-editor"
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="secondary" onClick={() => setShowModal(false)} disabled={saving} iconLeft={<X size={14} />}>
              Cancelar
            </TPButton>
            <TPButton
              onClick={() => void handleSave()}
              loading={saving}
              disabled={saving || (mvKind === "ADJUST" && loadingStockMap) || hasAnyOpeningConflict}
            >
              Registrar
            </TPButton>
          </div>
        }
      >
        <div className="space-y-4">
          {/* ── Selector visual de tipo ───────────────────────────────────── */}
          <TPCard title="Tipo de movimiento">
            <div className="flex gap-2">
              {KIND_CHIPS.map((chip) => {
                const active     = mvKind === chip.value;
                const isDisabled = chip.value === "TRANSFER" && !canTransfer;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => { if (!isDisabled) setMvKind(chip.value); }}
                    title={isDisabled ? "Necesitás al menos 2 almacenes activos para transferir stock." : undefined}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center gap-1.5 rounded-xl border h-28 px-2 font-medium transition-all",
                      isDisabled
                        ? "opacity-40 cursor-not-allowed border-border bg-card text-muted"
                        : active
                          ? cn(chip.activeClass, "scale-[1.02]")
                          : "border-border bg-card text-muted hover:bg-primary/5 hover:text-text hover:border-primary/30"
                    )}
                  >
                    <chip.icon size={22} />
                    <span className="text-sm leading-none">{chip.label}</span>
                    {isDisabled && (
                      <span className="text-[10px] leading-none opacity-70">2+ almacenes</span>
                    )}
                  </button>
                );
              })}
            </div>
          </TPCard>

          {/* Tipo (sincronizado) + Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TPField label="Tipo" required>
              <TPComboFixed
                value={mvKind}
                onChange={(v) => setMvKind(v as ArticleMovementKind)}
                options={[
                  { value: "IN",       label: "Entrada" },
                  { value: "OUT",      label: "Salida" },
                  { value: "ADJUST",   label: "Ajuste" },
                  { value: "OPENING",  label: "Apertura de stock" },
                  { value: "TRANSFER", label: "Transferencia entre almacenes" },
                ]}
              />
            </TPField>

            <TPField label="Fecha" required>
              <TPInput type="date" value={mvDate} onChange={setMvDate} />
            </TPField>
          </div>

          {/* Almacén(es) */}
          {mvKind === "TRANSFER" ? (
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <TPField
                  label="Almacén origen"
                  required
                  error={submitted && !mvFromWarehouseId ? "Seleccioná almacén origen." : null}
                >
                  <TPComboFixed
                    value={mvFromWarehouseId}
                    onChange={setMvFromWarehouseId}
                    options={warehouses.map(w => ({ value: w.id, label: `${w.code} — ${w.name}` }))}
                    placeholder="Seleccioná almacén…"
                  />
                </TPField>
              </div>

              <button
                type="button"
                title="Intercambiar almacenes"
                onClick={swapWarehouses}
                className="shrink-0 h-[42px] w-[42px] rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 flex items-center justify-center text-muted hover:text-primary transition-colors"
              >
                <ArrowLeftRight size={15} />
              </button>

              <div className="flex-1 min-w-0">
                <TPField
                  label="Almacén destino"
                  required
                  error={
                    submitted && !mvToWarehouseId ? "Seleccioná almacén destino." :
                    submitted && mvFromWarehouseId === mvToWarehouseId ? "Origen y destino deben ser distintos." : null
                  }
                >
                  <TPComboFixed
                    value={mvToWarehouseId}
                    onChange={setMvToWarehouseId}
                    options={warehouses.map(w => ({ value: w.id, label: `${w.code} — ${w.name}` }))}
                    placeholder="Seleccioná almacén…"
                  />
                </TPField>
              </div>
            </div>
          ) : (
            <TPField
              label="Almacén"
              required
              error={submitted && !mvWarehouseId ? "Seleccioná un almacén." : null}
            >
              <TPComboFixed
                value={mvWarehouseId}
                onChange={setMvWarehouseId}
                options={warehouses.map(w => ({ value: w.id, label: `${w.code} — ${w.name}` }))}
                placeholder="Seleccioná almacén…"
              />
            </TPField>
          )}

          {/* Nota aclaratoria según tipo */}
          {mvKind === "OPENING" && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary opacity-90">
              <span className="font-semibold">Apertura de stock:</span> registra el inventario inicial de un artículo en el almacén. Usarlo solo la primera vez por variante/almacén.
            </div>
          )}
          {mvKind === "ADJUST" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              <span className="font-semibold">Ajuste de stock:</span> ingresá el stock final deseado. El sistema calcula y registra automáticamente la diferencia.
              {loadingStockMap && <span className="ml-2 opacity-70">Cargando stock actual…</span>}
            </div>
          )}

          {/* Líneas */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-text">Artículos</p>

            {submitted && lines.length === 0 && (
              <p className="text-xs text-red-500">Agregá al menos una línea.</p>
            )}

            {lines.map((line, idx) => {
              // Detectar si esta línea es duplicado de otra (para mostrar error visual)
              const isDuplicateLine = line.articleId !== "" && lines.some(
                (other, i) => i !== idx && other.articleId !== "" &&
                  (other.variantId ?? other.articleId) === (line.variantId ?? line.articleId)
              );

              const stockKey     = `${line.articleId}|${line.variantId ?? ""}`;
              const currentStock = line.articleId ? (warehouseStockMap[stockKey] ?? 0) : null;
              const toCurrentStock = (line.articleId && mvKind === "TRANSFER")
                ? (toWarehouseStockMap[stockKey] ?? 0)
                : null;
              const hasOpeningConflict =
                mvKind === "OPENING" &&
                !!line.articleId &&
                !loadingStockMap &&
                warehouseStockMap[stockKey] !== undefined;

              // ADJUST: diferencia entre stock deseado y actual
              const adjustDiff = mvKind === "ADJUST" && line.newStock != null && currentStock !== null
                ? line.newStock - currentStock
                : null;

              // IN / OUT / OPENING / TRANSFER: stock proyectado
              const qty = line.quantity ?? 0;
              let projectedFrom: number | null = null;
              let projectedTo: number | null = null;
              if (currentStock !== null && line.articleId && mvKind !== "ADJUST" && qty > 0) {
                if (mvKind === "IN" || mvKind === "OPENING") {
                  projectedFrom = currentStock + qty;
                } else if (mvKind === "OUT") {
                  projectedFrom = currentStock - qty;
                } else if (mvKind === "TRANSFER") {
                  projectedFrom = currentStock - qty;
                  if (toCurrentStock !== null) projectedTo = toCurrentStock + qty;
                }
              }
              const willGoNegative = projectedFrom !== null && projectedFrom < 0;

              const art = line.articleRow as any;
              const costVal  = art ? (Number(art.computedCostBase  ?? 0) || null) : null;
              const priceVal = art ? (Number(art.resolvedSalePrice ?? 0) || null) : null;

              // ── Gramos ──────────────────────────────────────────────────
              const refWeight      = line.refWeightPerUnit;
              const effectiveWeight = line.weightPerUnit;
              const isCustomWeight  = effectiveWeight != null && refWeight != null
                && Math.abs(effectiveWeight - refWeight) > 0.0001;

              const fmtG = (g: number) =>
                g.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              const stockGrams          = effectiveWeight != null && currentStock !== null
                ? currentStock * effectiveWeight : null;
              const newStockGrams       = effectiveWeight != null && line.newStock != null
                ? line.newStock * effectiveWeight : null;
              const adjustDiffGrams     = effectiveWeight != null && adjustDiff != null
                ? adjustDiff * effectiveWeight : null;
              const movementGrams       = line.totalWeight != null && qty > 0
                ? line.totalWeight
                : effectiveWeight != null && qty > 0
                  ? qty * effectiveWeight : null;
              const projectedFromGrams  = effectiveWeight != null && projectedFrom !== null
                ? projectedFrom * effectiveWeight : null;
              const projectedToGrams    = effectiveWeight != null && projectedTo !== null
                ? projectedTo * effectiveWeight : null;

              // ── Costo recalculado según peso real ────────────────────────
              const recalcCost = costVal != null && effectiveWeight != null && refWeight != null && refWeight > 0
                ? costVal * effectiveWeight / refWeight
                : costVal;
              const costIsRecalc = recalcCost != null && costVal != null
                && Math.abs(recalcCost - costVal) > 0.001;

              // Precio sugerido: aplica el mismo ratio precio/costo sobre el costo real
              // Solo se muestra cuando el costo fue recalculado (el peso real difiere del de referencia)
              const suggestedPrice = costIsRecalc && recalcCost != null && priceVal != null
                && costVal != null && costVal > 0
                ? recalcCost * (priceVal / costVal)
                : null;

              // Margen real: (precio lista − costo real) / costo real × 100
              const realMargin = recalcCost != null && recalcCost > 0 && priceVal != null
                ? (priceVal - recalcCost) / recalcCost * 100
                : null;

              // ── Col-span: Bloque ID (SKU + Variante + Peso) ──────────────
              // Peso siempre ocupa fila propia (col-span-2) cuando está presente.
              // El bloque financiero es un grid separado → no afecta este conteo.

              // ── Imagen del ítem seleccionado ────────────────────────────────
              // Prioridad: imagen principal de la variante → imageUrl de la variante
              //            → imagen principal del artículo padre → null
              const lineImgUrl: string | null = (() => {
                const artRow = line.articleRow as any;
                if (!artRow) return null;
                // Buscar la variante seleccionada dentro del artículo
                const variant = line.variantId
                  ? (artRow.variants as any[] | undefined)?.find((v: any) => v.id === line.variantId)
                  : null;
                if (variant) {
                  // Imagen principal de la variante
                  const mainVImg = (variant.images as any[] | undefined)?.find((img: any) => img.isMain);
                  if (mainVImg?.url) return mainVImg.url;
                  if (variant.imageUrl) return variant.imageUrl;
                }
                // Imagen principal del artículo padre
                const mainAImg = (artRow.images as any[] | undefined)?.find((img: any) => img.isMain);
                if (mainAImg?.url) return mainAImg.url;
                if (artRow.mainImageUrl) return artRow.mainImageUrl;
                return null;
              })();

              // ── Modo gramo ──────────────────────────────────────────────────
              const gramMode  = isGramUnit((line.articleRow as any)?.unitOfMeasure ?? "");
              const unitLabel = gramMode ? "Gramos" : "Cantidad";

              // ── Tiene metales: recalculado en render desde articleRow ────────────────
              // No usar line.hasMetal (puede estar desactualizado si el artículo cambió
              // con lógica anterior). Siempre evaluar directo sobre los datos actuales.
              const hasMetals = line.articleId ? itemHasMetal(line.articleRow) : false;

              return (
                <div key={idx} className="rounded-xl border border-border bg-surface2/20 p-3 space-y-3">
                  {/* Artículo/variante + Cantidad/Gramos + Peso inline (unit-mode) + Eliminar */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <TPField
                        label="Artículo / variante"
                        required
                        error={
                          submitted && !line.articleId ? "Seleccioná un artículo." :
                          isDuplicateLine ? "Este artículo ya fue agregado al movimiento." : null
                        }
                      >
                        <ArticleVariantSearchSelect
                          selected={line.articleId ? { articleName: line.articleName, variantName: line.variantName } : null}
                          onSelect={(result) => handleVariantSelect(idx, result)}
                          onClear={() => clearArticle(idx)}
                          stockMap={warehouseStockMap}
                        />
                      </TPField>
                    </div>

                    {mvKind !== "ADJUST" && (
                      <div className={cn("shrink-0", gramMode ? "w-32" : "w-28")}>
                        <TPField
                          label={unitLabel}
                          required
                          error={submitted && (line.quantity == null || line.quantity === 0) ? "Requerido." : null}
                        >
                          <TPNumberInput
                            value={line.quantity}
                            onChange={(v: number | null) => {
                              const newTotal = v != null && line.weightPerUnit != null ? v * line.weightPerUnit : null;
                              setLines(prev => {
                                const copy = [...prev];
                                copy[idx] = { ...copy[idx], quantity: v, totalWeight: newTotal };
                                return copy;
                              });
                            }}
                            min={0}
                            step={1}
                            decimals={gramMode ? 3 : 2}
                          />
                        </TPField>
                      </div>
                    )}

                    {mvKind !== "ADJUST" && !gramMode && hasMetals && (
                      <div className="w-28 shrink-0">
                        <TPField label="Peso unit. (g)">
                          <TPNumberInput
                            value={line.weightPerUnit}
                            onChange={(v: number | null) => {
                              const newTotal = v != null && line.quantity != null ? line.quantity * v : null;
                              setLines(prev => {
                                const copy = [...prev];
                                copy[idx] = { ...copy[idx], weightPerUnit: v, totalWeight: newTotal };
                                return copy;
                              });
                            }}
                            min={0}
                            step={0.1}
                            decimals={2}
                            placeholder="0,00"
                          />
                        </TPField>
                      </div>
                    )}

                    {mvKind !== "ADJUST" && !gramMode && hasMetals && (
                      <div className="w-28 shrink-0">
                        <TPField label="Peso total (g)">
                          <TPNumberInput
                            value={line.totalWeight}
                            onChange={(v: number | null) => {
                              const qty = line.quantity;
                              const newWpu = v != null && qty != null && qty > 0 ? v / qty : line.weightPerUnit;
                              setLines(prev => {
                                const copy = [...prev];
                                copy[idx] = { ...copy[idx], totalWeight: v, weightPerUnit: newWpu ?? null };
                                return copy;
                              });
                            }}
                            min={0}
                            step={0.1}
                            decimals={2}
                            placeholder="0,00"
                          />
                        </TPField>
                      </div>
                    )}

                    {lines.length > 1 && (
                      <TPIconButton
                        onClick={() => removeLine(idx)}
                        title="Eliminar línea"
                        className="mt-6 shrink-0 h-8 w-8 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10"
                      >
                        <Trash2 size={13} />
                      </TPIconButton>
                    )}
                  </div>

                  {/* Alerta de conflicto OPENING */}
                  {hasOpeningConflict && (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AlertTriangle size={16} className="shrink-0 text-amber-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-amber-700 leading-snug">
                            Este artículo ya tiene stock o historial en este almacén.
                          </p>
                          <p className="text-xs text-amber-600 mt-0.5">
                            Usá un movimiento de Ajuste para corregirlo.
                          </p>
                        </div>
                        <TPButton variant="secondary" onClick={() => setMvKind("ADJUST")}>
                          Cambiar a Ajuste
                        </TPButton>
                      </div>
                    </div>
                  )}

                  {/* ── Panel unificado: info artículo + impacto en stock ── */}
                  {line.articleId && (
                    <div className="rounded-xl border border-border bg-surface2/20 p-3 space-y-3">

                      {/* Bloque 1a: identificación — Imagen · SKU · Variante · Peso */}
                      <div className="flex items-start gap-3">
                        {/* Miniatura del ítem */}
                        <div
                          className={cn(
                            "shrink-0 w-[76px] h-[76px] rounded-lg overflow-hidden border border-border bg-surface2 flex items-center justify-center",
                            lineImgUrl && "cursor-zoom-in hover:opacity-90 transition-opacity"
                          )}
                          onClick={() => lineImgUrl && setZoomedImg(lineImgUrl)}
                        >
                          {lineImgUrl
                            ? <img src={lineImgUrl} alt="" className="w-full h-full object-cover" />
                            : <Package className="w-6 h-6 text-muted opacity-50" />
                          }
                        </div>

                        {/* Info textual */}
                        <div className="flex-1 min-w-0 grid grid-cols-2 gap-2">
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-muted">SKU</p>
                            <p className="text-xs font-mono text-text">
                              {line.variantSku || (line.articleRow as any)?.sku || "\u2014"}
                            </p>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-muted">Variante</p>
                            {line.variantName
                              ? <p className="text-xs text-text">{line.variantName}</p>
                              : <p className="text-xs text-muted opacity-60">Sin variantes</p>
                            }
                          </div>
                          {effectiveWeight != null && (
                            <div className="col-span-2 flex flex-col gap-0.5">
                              <p className="text-xs text-muted">Peso unitario</p>
                              <p className="text-xs text-text flex items-center gap-1 flex-wrap">
                                {fmtG(effectiveWeight)} g
                                {isCustomWeight && (
                                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium leading-none">
                                    personalizado
                                  </span>
                                )}
                              </p>
                              {isCustomWeight && refWeight != null && (
                                <p className="text-[10px] text-muted opacity-60">ref: {fmtG(refWeight)} g</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Bloque 1b: financiero — Costo · Precio · Sugerido · Margen */}
                      {(recalcCost != null || priceVal != null) && (
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30 mt-1">
                          {/* Fila 1: Costo real | P. venta ref. */}
                          {recalcCost != null && (
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs text-muted">Costo</p>
                              <p className="text-xs text-text">
                                {fmtMoney2(baseCurrencySymbol, recalcCost)}
                                {costIsRecalc && (
                                  <span className="ml-1 text-[10px] text-primary opacity-80">(ajustado)</span>
                                )}
                              </p>
                            </div>
                          )}
                          {priceVal != null && (
                            <div className={cn("flex flex-col gap-0.5", recalcCost == null && "col-span-2")}>
                              <p className="text-xs text-muted">P. venta ref.</p>
                              <p className="text-xs text-text">{fmtMoney2(baseCurrencySymbol, priceVal)}</p>
                            </div>
                          )}

                          {/* Fila 2 (solo cuando el costo fue recalculado): Precio sugerido | Margen real */}
                          {costIsRecalc && suggestedPrice != null && (
                            <div className="flex flex-col gap-0.5">
                              <p className="text-xs text-muted">P. sugerido</p>
                              <p className="text-xs font-medium text-text">
                                {fmtMoney2(baseCurrencySymbol, suggestedPrice)}
                              </p>
                            </div>
                          )}
                          {costIsRecalc && realMargin != null && (
                            <div className={cn("flex flex-col gap-0.5", suggestedPrice == null && "col-span-2")}>
                              <p className="text-xs text-muted">Margen real</p>
                              <p className={cn(
                                "text-xs font-semibold",
                                realMargin >= 0 ? "text-green-600" : "text-red-500"
                              )}>
                                {realMargin >= 0 ? "+" : ""}{realMargin.toFixed(1)}%
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Separador */}
                      <div className="border-t border-border/50" />

                      {/* Bloque 2: impacto en stock */}
                      {mvKind === "ADJUST" ? (

                        /* ADJUST: stock actual → stock nuevo → diferencia */
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-2">

                            {/* Stock actual — solo lectura, fondo muted */}
                            <div className="flex flex-col gap-1">
                              <p className="text-xs text-muted">{gramMode ? "Stock actual (g)" : "Stock actual"}</p>
                              <div className="h-[42px] rounded-xl border border-border px-3 flex items-center text-sm text-muted bg-surface2/30 tabular-nums">
                                {loadingStockMap ? "…" : gramMode ? fmtG(currentStock ?? 0) : fmtNumberSmart(currentStock ?? 0)}
                              </div>
                            </div>

                            {/* Stock nuevo — TPNumberInput (42px, igual que tp-input) */}
                            <div className="flex flex-col gap-1">
                              <p className="text-xs text-muted">{gramMode ? "Stock nuevo (g) *" : "Stock nuevo *"}</p>
                              <TPNumberInput
                                value={line.newStock}
                                onChange={(v) => setLineField(idx, "newStock", v)}
                                min={0}
                                step={gramMode ? 0.001 : 1}
                                decimals={gramMode ? 3 : 0}
                                error={
                                  submitted && line.newStock == null ? "Requerido." :
                                  submitted && line.newStock != null && line.newStock < 0 ? "Debe ser \u2265 0." :
                                  null
                                }
                              />
                            </div>

                            {/* Diferencia — resultado dinámico, énfasis semibold */}
                            <div className="flex flex-col gap-1">
                              <p className="text-xs text-muted">Diferencia{gramMode ? " (g)" : ""}</p>
                              <div className={cn(
                                "h-[42px] rounded-xl border px-3 flex items-center text-sm font-semibold tabular-nums",
                                adjustDiff == null ? "border-border text-muted bg-surface2/20"
                                : adjustDiff > 0   ? "border-green-400/50 text-green-600 bg-green-500/10"
                                : adjustDiff < 0   ? "border-red-400/50 text-red-600 bg-red-500/10"
                                :                    "border-border text-muted bg-surface2/20"
                              )}>
                                {adjustDiff == null
                                  ? "\u2014"
                                  : `${adjustDiff >= 0 ? "+" : ""}${gramMode ? fmtG(adjustDiff) : fmtNumberSmart(adjustDiff)}`
                                }
                              </div>
                            </div>

                          </div>

                          {/* Peso unitario — solo para artículos en unidades CON metal */}
                          {!gramMode && hasMetals && (
                            <WeightRow
                              weightPerUnit={line.weightPerUnit}
                              onChange={v => setLineField(idx, "weightPerUnit", v)}
                            />
                          )}

                          {/* Sub-fila de gramos (Stock actual g / Stock nuevo g / Diferencia g) — solo unit-mode */}
                          {!gramMode && effectiveWeight != null && (
                            <div className="grid grid-cols-3 gap-2">
                              <p className="text-[10px] text-muted text-center tabular-nums">
                                {stockGrams != null && !loadingStockMap
                                  ? `${fmtG(stockGrams)} g`
                                  : "\u2014"}
                              </p>
                              <p className="text-[10px] text-muted text-center tabular-nums">
                                {newStockGrams != null ? `${fmtG(newStockGrams)} g` : "\u2014"}
                              </p>
                              <p className={cn(
                                "text-[10px] text-center font-medium tabular-nums",
                                adjustDiffGrams == null ? "text-muted"
                                : adjustDiffGrams > 0  ? "text-green-600"
                                : adjustDiffGrams < 0  ? "text-red-600"
                                : "text-muted"
                              )}>
                                {adjustDiffGrams != null
                                  ? `${adjustDiffGrams >= 0 ? "+" : ""}${fmtG(adjustDiffGrams)} g`
                                  : "\u2014"}
                              </p>
                            </div>
                          )}
                        </div>

                      ) : (

                        /* IN / OUT / OPENING / TRANSFER: mini KPIs */
                        <div className="space-y-2">
                          {mvKind === "TRANSFER" && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted">Origen</span>
                              {mvFromWarehouseId && (
                                <span className="text-xs font-medium text-text bg-surface2/20 border border-border px-2 py-0.5 rounded-full">
                                  {warehouses.find(w => w.id === mvFromWarehouseId)?.name ?? "\u2014"}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2">
                            {/* Stock actual */}
                            <div className="rounded-lg border border-border bg-surface2/20 px-3 py-2 text-center">
                              <p className="text-[10px] text-muted uppercase tracking-wide mb-1">
                                {mvKind === "TRANSFER" ? "Stock" : "Stock actual"}
                              </p>
                              <p className="text-sm font-semibold text-text">
                                {loadingStockMap ? "\u2026" : gramMode ? `${fmtG(currentStock ?? 0)} g` : fmtNumberSmart(currentStock ?? 0)}
                              </p>
                              {!gramMode && stockGrams != null && !loadingStockMap && (
                                <p className="text-[10px] text-muted mt-0.5 tabular-nums">{fmtG(stockGrams)} g</p>
                              )}
                            </div>

                            {/* Movimiento */}
                            <div className={cn(
                              "rounded-lg border px-3 py-2 text-center",
                              qty > 0
                                ? (mvKind === "OUT" || mvKind === "TRANSFER")
                                  ? "border-red-400/30 bg-red-500/5"
                                  : "border-green-400/30 bg-green-500/5"
                                : "border-border bg-surface2/20"
                            )}>
                              <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Movimiento</p>
                              <p className={cn(
                                "text-sm font-semibold",
                                qty > 0
                                  ? (mvKind === "OUT" || mvKind === "TRANSFER") ? "text-red-500" : "text-green-500"
                                  : "text-muted"
                              )}>
                                {qty > 0
                                  ? `${(mvKind === "OUT" || mvKind === "TRANSFER") ? "\u2212" : "+"}${gramMode ? `${fmtG(qty)} g` : fmtNumberSmart(qty)}`
                                  : "\u2014"
                                }
                              </p>
                              {!gramMode && movementGrams != null && qty > 0 && (
                                <p className={cn(
                                  "text-[10px] mt-0.5 tabular-nums",
                                  (mvKind === "OUT" || mvKind === "TRANSFER") ? "text-red-400" : "text-green-600"
                                )}>
                                  {(mvKind === "OUT" || mvKind === "TRANSFER") ? "\u2212" : "+"}{fmtG(movementGrams)} g
                                </p>
                              )}
                            </div>

                            {/* Resultado */}
                            <div className={cn(
                              "rounded-lg border px-3 py-2 text-center",
                              projectedFrom !== null
                                ? willGoNegative ? "border-red-400/30 bg-red-500/5" : "border-green-400/30 bg-green-500/5"
                                : "border-border bg-surface2/20"
                            )}>
                              <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Resultado</p>
                              <p className={cn(
                                "text-sm font-semibold",
                                projectedFrom !== null
                                  ? willGoNegative ? "text-red-500" : "text-green-500"
                                  : "text-muted"
                              )}>
                                {projectedFrom !== null ? (
                                  <>{gramMode ? `${fmtG(projectedFrom)} g` : fmtNumberSmart(projectedFrom)}{willGoNegative && <span title="El stock quedar\u00EDa en negativo"> \u26A0</span>}</>
                                ) : "\u2014"}
                              </p>
                              {!gramMode && projectedFromGrams != null && (
                                <p className={cn(
                                  "text-[10px] mt-0.5 tabular-nums",
                                  willGoNegative ? "text-red-400" : "text-green-600"
                                )}>
                                  {fmtG(projectedFromGrams)} g
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Fila destino — solo TRANSFER */}
                          {mvKind === "TRANSFER" && qty > 0 && toCurrentStock !== null && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-muted">Destino</span>
                                {mvToWarehouseId && (
                                  <span className="text-xs font-medium text-green-700 bg-green-500/10 border border-green-400/30 px-2 py-0.5 rounded-full">
                                    {warehouses.find(w => w.id === mvToWarehouseId)?.name ?? "\u2014"}
                                  </span>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-lg border border-border bg-surface2/20 px-3 py-2 text-center">
                                  <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Stock</p>
                                  <p className="text-sm font-semibold text-text">
                                    {loadingToStockMap ? "\u2026" : gramMode ? `${fmtG(toCurrentStock ?? 0)} g` : fmtNumberSmart(toCurrentStock)}
                                  </p>
                                  {!gramMode && effectiveWeight != null && toCurrentStock != null && !loadingToStockMap && (
                                    <p className="text-[10px] text-muted mt-0.5 tabular-nums">
                                      {fmtG(toCurrentStock * effectiveWeight)} g
                                    </p>
                                  )}
                                </div>
                                <div className="rounded-lg border border-green-400/30 bg-green-500/5 px-3 py-2 text-center">
                                  <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Movimiento</p>
                                  <p className="text-sm font-semibold text-green-500">+{gramMode ? `${fmtG(qty)} g` : fmtNumberSmart(qty)}</p>
                                  {!gramMode && movementGrams != null && (
                                    <p className="text-[10px] text-green-600 mt-0.5 tabular-nums">+{fmtG(movementGrams)} g</p>
                                  )}
                                </div>
                                <div className={cn(
                                  "rounded-lg border px-3 py-2 text-center",
                                  projectedTo !== null ? "border-green-400/30 bg-green-500/5" : "border-border bg-surface2/20"
                                )}>
                                  <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Resultado</p>
                                  <p className="text-sm font-semibold text-green-500">
                                    {projectedTo !== null ? (gramMode ? `${fmtG(projectedTo)} g` : fmtNumberSmart(projectedTo)) : "\u2014"}
                                  </p>
                                  {!gramMode && projectedToGrams != null && (
                                    <p className="text-[10px] text-green-600 mt-0.5 tabular-nums">{fmtG(projectedToGrams)} g</p>
                                  )}
                                </div>
                              </div>
                            </>
                          )}

                        </div>

                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={addLine}
              className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted hover:text-primary"
            >
              <Plus size={14} />
              Agregar
            </button>
          </div>

          {/* Nota — al final, es un dato complementario */}
          <TPField label="Nota">
            <TPInput value={mvNote} onChange={setMvNote} placeholder="Observaciones opcionales…" />
          </TPField>
        </div>
      </Modal>

      {/* ── Popover filtro por tipo ── */}
      <TPFilterPopover
        open={filterPopoverOpen}
        onClose={() => setFilterPopoverOpen(false)}
        anchorRef={filterBtnRef}
        title="Tipo de movimiento"
        options={KIND_OPTIONS}
        value={kind}
        onChange={(v) => setKind(v)}
      />

      {/* ── Lightbox imagen ── */}
      {zoomedImg && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setZoomedImg(null)}
        >
          <button
            type="button"
            onClick={() => setZoomedImg(null)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
          <img
            src={zoomedImg}
            alt=""
            className="max-w-[90vw] max-h-[85vh] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </TPSectionShell>
  );
}

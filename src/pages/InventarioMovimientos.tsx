// src/pages/InventarioMovimientos.tsx
// Módulo de movimientos de metales — sigue el mismo patrón que InventarioArticulosMovimientos.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine,
  Ban, Calendar, Eye, Filter, Plus, Printer, SlidersHorizontal, Trash2, X,
} from "lucide-react";
import { cn } from "../components/ui/tp";

import TPSectionShell from "../components/ui/TPSectionShell";
import { TPButton } from "../components/ui/TPButton";
import { TPIconButton } from "../components/ui/TPIconButton";
import { TPBadge } from "../components/ui/TPBadges";
import { type SortDir } from "../components/ui/TPSort";
import TPDateRangeInline, { type TPDateRangeValue } from "../components/ui/TPDateRangeInline";
import { TPFilterPopover, type TPFilterOption } from "../components/ui/TPFilterPopover";
import TPComboFixed from "../components/ui/TPComboFixed";
import MetalVariantTreeSelect, { type MetalVariantSelectOption } from "../components/ui/MetalVariantTreeSelect";
import { TPTablePaginated, TPTr, TPTh, TPTd } from "../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPField } from "../components/ui/TPField";
import TPInput from "../components/ui/TPInput";
import TPNumberInput from "../components/ui/TPNumberInput";
import Modal from "../components/ui/Modal";
import { TPCard } from "../components/ui/TPCard";

import { apiFetch } from "../lib/api";
import { toast } from "../lib/toast";
import { fmtNumberSmart, fmtMoney2, fmtPurity3, formatGrams } from "../lib/pricing/format";
import { printMovement } from "../lib/movementPrint";
import { documentTemplatesApi } from "../services/document-templates";
import { useAuth } from "../context/AuthContext";

import {
  metalMovementsApi,
  type MetalMovementKind,
  type MetalMovementRow,
  type CreateMetalLine,
} from "../services/metal-movements";

/* =========================================================
   Column definitions
========================================================= */
const COL_KEY = "tptech_col_metal_movimientos";

const KIND_OPTIONS: TPFilterOption<MetalMovementKind | "">[] = [
  { value: "",          label: "Todos los tipos" },
  { value: "IN",        label: "Entrada" },
  { value: "OUT",       label: "Salida" },
  { value: "TRANSFER",  label: "Transferencia" },
  { value: "ADJUST",    label: "Ajuste" },
];

const KIND_CHIPS: {
  value: MetalMovementKind;
  label: string;
  icon: React.ElementType;
  activeClass: string;
}[] = [
  { value: "IN",       label: "Entrada",      icon: ArrowDownToLine,   activeClass: "bg-green-50  border-green-400  text-green-700"  },
  { value: "OUT",      label: "Salida",        icon: ArrowUpFromLine,   activeClass: "bg-red-50    border-red-400    text-red-700"    },
  { value: "TRANSFER", label: "Transferencia", icon: ArrowLeftRight,    activeClass: "bg-blue-50   border-blue-400   text-blue-700"   },
  { value: "ADJUST",   label: "Ajuste",        icon: SlidersHorizontal, activeClass: "bg-amber-50  border-amber-400  text-amber-700"  },
];

const COLS: TPColDef[] = [
  { key: "date",      label: "Fecha",            canHide: false, sortKey: "date" },
  { key: "status",    label: "Estado",                           sortKey: "status" },
  { key: "type",      label: "Tipo",                             sortKey: "type" },
  { key: "code",      label: "Comprobante",                      sortKey: "code" },
  { key: "metal",     label: "Metal" },
  { key: "warehouse", label: "Origen / Destino",                 sortKey: "warehouse" },
  { key: "grams",     label: "Gramos",           align: "right" },
  { key: "user",      label: "Usuario",                          sortKey: "user" },
  { key: "note",      label: "Nota",             visible: false },
  { key: "actions",   label: "Acciones",         canHide: false, align: "right" },
];

/* =========================================================
   Types
========================================================= */
type WarehouseOption = { id: string; name: string; code: string };

type VariantOption = {
  id: string;
  metalId: string;
  metalName: string;
  metalCode: string;
  variantName: string;
  sku: string;
  purity: number;
  finalSalePrice: number | null;
  displayLabel: string;
};

type DraftLine = {
  variantId: string;
  grams: number | null;     // para IN / OUT / TRANSFER
  newGrams: number | null;  // para ADJUST: gramos totales deseados
};

const EMPTY_LINE: DraftLine = { variantId: "", grams: null, newGrams: null };

type SortCol = "date" | "code" | "type" | "status" | "user" | "warehouse";

/* =========================================================
   Helpers
========================================================= */
function s(v: any) { return String(v ?? "").trim(); }

function fmtDate(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-AR");
}

function fmtDateTime(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-AR");
}

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

function localDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function movementTone(kind: string): "success" | "danger" | "info" | "warning" | "neutral" {
  switch (kind) {
    case "IN":       return "success";
    case "OUT":      return "danger";
    case "TRANSFER": return "info";
    case "ADJUST":   return "warning";
    default:         return "neutral";
  }
}

function movementLabel(kind: MetalMovementKind) {
  const MAP: Record<MetalMovementKind, string> = {
    IN: "Entrada", OUT: "Salida", TRANSFER: "Transferencia", ADJUST: "Ajuste",
  };
  return MAP[kind] ?? kind;
}

function warehouseLabel(m: MetalMovementRow): string {
  if (m.kind === "TRANSFER") {
    const from = s(m.fromWarehouse?.name ?? m.fromWarehouse?.code) || "—";
    const to   = s(m.toWarehouse?.name   ?? m.toWarehouse?.code)   || "—";
    return `${from} → ${to}`;
  }
  return s(m.warehouse?.name ?? m.warehouse?.code) || "—";
}

function fmtGrams(n: number): string {
  return formatGrams(Math.abs(n), 3);
}

function getGramsDisplay(m: MetalMovementRow): { label: string; textClass: string } {
  const lines = m.lines ?? [];
  const total = lines.reduce((sum, l) => sum + Number(l.grams), 0);

  switch (m.kind) {
    case "IN":
      return { label: `+${fmtGrams(total)} g`, textClass: "text-green-600" };
    case "OUT":
      return { label: `-${fmtGrams(total)} g`, textClass: "text-red-600" };
    case "ADJUST":
      if (total > 0) return { label: `+${fmtGrams(total)} g`, textClass: "text-amber-600" };
      if (total < 0) return { label: `-${fmtGrams(total)} g`, textClass: "text-amber-600" };
      return { label: "\u00B10,000 g", textClass: "text-muted" };
    case "TRANSFER":
      return { label: `${fmtGrams(total)} g`, textClass: "text-blue-600" };
    default:
      return { label: `${fmtGrams(total)} g`, textClass: "text-muted" };
  }
}

/* =========================================================
   Impresión (usa plantilla PDF configurada)
========================================================= */

async function handlePrint(m: MetalMovementRow, jewelry: Record<string, any> | null) {
  const data = {
    title:         "Movimiento de metales",
    code:          s(m.code) || m.id,
    kindLabel:     movementLabel(m.kind),
    isVoided:      Boolean(m.deletedAt || m.voidedAt),
    effectiveAt:   m.effectiveAt ?? "",
    createdAt:     m.createdAt   ?? "",
    createdByName: s(m.createdBy?.name ?? m.createdBy?.email) || "",
    warehouse:     warehouseLabel(m),
    note:          s(m.note || ""),
    voidedAt:      m.voidedAt     ?? "",
    voidedByName:  s(m.voidedBy?.name ?? m.voidedBy?.email) || "",
    voidedNote:    s(m.voidedNote || ""),
    lines: (m.lines ?? []).map(l => ({
      description: s(l.variant?.metal?.name) || "—",
      variant:     s(l.variant?.name)        || "—",
      code:        "",
      sku:         s(l.variant?.sku)         || "—",
      quantity:    null as number | null,
      unit:        "g",
      weight:      Number(l.grams),
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
   Componente principal
========================================================= */
export default function InventarioMovimientos() {
  const { jewelry } = useAuth();

  /* ---- lista ---- */
  const [loading, setLoading]   = useState(false);
  const [rows, setRows]         = useState<MetalMovementRow[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(30);

  /* ---- filtros ---- */
  const [q,                setQ]                = useState("");
  const [kind,             setKind]             = useState<MetalMovementKind | "">("");
  const [dateRange,        setDateRange]        = useState<TPDateRangeValue>({ from: null, to: null });
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false);
  const [dateOpen,          setDateOpen]          = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  /* ---- sort ---- */
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  }

  /* ---- datos comunes ---- */
  const [warehouses,   setWarehouses]   = useState<WarehouseOption[]>([]);
  const [allVariants,  setAllVariants]  = useState<VariantOption[]>([]);
  const [baseCurrencySymbol, setBaseCurrencySymbol] = useState("$");

  const variantMap = useMemo(
    () => new Map(allVariants.map(v => [v.id, v])),
    [allVariants]
  );

  const treeSelectOptions = useMemo(
    (): MetalVariantSelectOption[] => allVariants.map(v => ({
      variantId:   v.id,
      metalId:     v.metalId,
      metalName:   v.metalName,
      metalCode:   v.metalCode,
      variantName: v.variantName,
      sku:         v.sku,
    })),
    [allVariants]
  );

  /* ---- detail / void modals ---- */
  const [viewTarget,    setViewTarget]    = useState<MetalMovementRow | null>(null);
  const [voidTarget,    setVoidTarget]    = useState<MetalMovementRow | null>(null);
  const [voidNote,      setVoidNote]      = useState("");
  const [voidBusy,      setVoidBusy]      = useState(false);
  const [voidSubmitted, setVoidSubmitted] = useState(false);

  /* ---- modal nuevo movimiento ---- */
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [mvKind,            setMvKind]            = useState<MetalMovementKind>("IN");
  const [mvWarehouseId,     setMvWarehouseId]     = useState("");
  const [mvFromWarehouseId, setMvFromWarehouseId] = useState("");
  const [mvToWarehouseId,   setMvToWarehouseId]   = useState("");
  const [mvDate,            setMvDate]            = useState(() => localDateStr());
  const [mvNote,            setMvNote]            = useState("");
  const [lines,             setLines]             = useState<DraftLine[]>([{ ...EMPTY_LINE }]);

  /* ---- stock metálico por almacén ---- */
  const [warehouseStockMap,   setWarehouseStockMap]   = useState<Record<string, number>>({});
  const [loadingStockMap,     setLoadingStockMap]     = useState(false);
  const [toWarehouseStockMap, setToWarehouseStockMap] = useState<Record<string, number>>({});
  const [loadingToStockMap,   setLoadingToStockMap]   = useState(false);

  /* ================================================================== */
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await metalMovementsApi.list({
        page,
        pageSize,
        q: s(q),
        kind: kind || undefined,
        from: dateToIso(dateRange.from),
        to:   dateToIso(dateRange.to),
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
  }, [page, pageSize, q, kind, dateRange]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { setPage(1); }, [q, kind, dateRange, pageSize]);

  /* ---- cargar almacenes al montar ---- */
  useEffect(() => {
    apiFetch<any>("/warehouses", { method: "GET" })
      .then(res => {
        const list: any[] = Array.isArray(res?.rows) ? res.rows : Array.isArray(res) ? res : [];
        setWarehouses(list.filter((w: any) => w.isActive && !w.deletedAt));
      })
      .catch(() => {});
  }, []);

  /* ---- cargar moneda base ---- */
  useEffect(() => {
    apiFetch<any>("/valuation/currencies")
      .then(res => {
        const list: any[] = Array.isArray(res) ? res : (res.rows ?? res.currencies ?? []);
        const base = list.find((c: any) => c.isBase);
        if (base?.symbol) setBaseCurrencySymbol(base.symbol);
      })
      .catch(() => {});
  }, []);

  /* ---- cargar variantes de metal al abrir modal ---- */
  useEffect(() => {
    if (!showModal || allVariants.length > 0) return;

    apiFetch<any>("/valuation/metals")
      .then(async res => {
        const metals: any[] = Array.isArray(res) ? res : (res.rows ?? res.metals ?? []);
        const active = metals.filter((m: any) => m.isActive && !m.deletedAt);

        const arrays = await Promise.all(
          active.map((metal: any) =>
            apiFetch<any>(`/valuation/metals/${metal.id}/variants`)
              .then((vRes: any) => {
                const variants: any[] = Array.isArray(vRes) ? vRes : (vRes.rows ?? vRes.variants ?? []);
                return variants
                  .filter((v: any) => v.isActive && !v.deletedAt)
                  .map((v: any): VariantOption => ({
                    id:             v.id,
                    metalId:        metal.id,
                    metalName:      metal.name,
                    metalCode:      s(metal.code ?? ""),
                    variantName:    v.name,
                    sku:            v.sku,
                    purity:         Number(v.purity),
                    finalSalePrice: v.finalSalePrice != null ? Number(v.finalSalePrice) : null,
                    displayLabel:   `${metal.name} \u2014 ${v.name}`,
                  }));
              })
              .catch(() => [] as VariantOption[])
          )
        );
        setAllVariants(arrays.flat());
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);

  /* ---- cargar stock metálico del almacén principal / origen ---- */
  useEffect(() => {
    if (!showModal) { setWarehouseStockMap({}); return; }
    const whId = mvKind === "TRANSFER" ? mvFromWarehouseId : mvWarehouseId;
    if (!whId) { setWarehouseStockMap({}); return; }
    setLoadingStockMap(true);
    apiFetch<any>(`/warehouses/${whId}/metal-stock`)
      .then((res: any) => {
        const arr: any[] = Array.isArray(res) ? res : [];
        const map: Record<string, number> = {};
        arr.forEach((r: any) => { map[r.variantId] = Number(r.grams) || 0; });
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
    apiFetch<any>(`/warehouses/${mvToWarehouseId}/metal-stock`)
      .then((res: any) => {
        const arr: any[] = Array.isArray(res) ? res : [];
        const map: Record<string, number> = {};
        arr.forEach((r: any) => { map[r.variantId] = Number(r.grams) || 0; });
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
      if (sortCol === "status")    cmp = ((a.deletedAt || a.voidedAt) ? 1 : 0) - ((b.deletedAt || b.voidedAt) ? 1 : 0);
      if (sortCol === "user")      cmp = s(a.createdBy?.name ?? a.createdBy?.email).localeCompare(s(b.createdBy?.name ?? b.createdBy?.email), "es");
      if (sortCol === "warehouse") cmp = warehouseLabel(a).localeCompare(warehouseLabel(b), "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const activeDateFilter = dateRange.from != null || dateRange.to != null;

  /* ── chips de filtros activos ─────────────────────────────────────── */
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (kind !== "") {
      const label = KIND_OPTIONS.find(o => o.value === kind)?.label ?? kind;
      chips.push({ key: "kind", label: `Tipo: ${label}`, onRemove: () => setKind("") });
    }
    if (activeDateFilter) {
      const fmt = (d: Date) => d.toLocaleDateString("es-AR");
      const from = dateRange.from ? fmt(dateRange.from) : null;
      const to   = dateRange.to   ? fmt(dateRange.to)   : null;
      const label = from && to ? `${from} \u2014 ${to}` : from ? `Desde ${from}` : `Hasta ${to}`;
      chips.push({ key: "date", label: `Fecha: ${label}`, onRemove: () => setDateRange({ from: null, to: null }) });
    }
    return chips;
  }, [kind, activeDateFilter, dateRange]);

  function clearAllFilters() { setKind(""); setDateRange({ from: null, to: null }); setQ(""); }

  function toggleFilterPopover() { setFilterPopoverOpen(v => !v); setDateOpen(false); }
  function toggleDateOpen() { setDateOpen(v => !v); setFilterPopoverOpen(false); }

  /* ================================================================== */
  /* VOID                                                                 */
  /* ================================================================== */
  async function handleVoid() {
    setVoidSubmitted(true);
    if (!voidNote.trim() || !voidTarget) return;
    setVoidBusy(true);
    try {
      await metalMovementsApi.voidMovement(voidTarget.id, voidNote.trim());
      toast.success("Movimiento anulado.");
      setVoidTarget(null);
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo anular el movimiento.");
    } finally {
      setVoidBusy(false);
    }
  }

  /* ================================================================== */
  /* CREATE MODAL                                                          */
  /* ================================================================== */
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

  function setLineField<K extends keyof DraftLine>(idx: number, field: K, value: DraftLine[K]) {
    setLines(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  function addLine()            { setLines(prev => [...prev, { ...EMPTY_LINE }]); }
  function removeLine(idx: number) { setLines(prev => prev.filter((_, i) => i !== idx)); }

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
    if (lines.some(l => !l.variantId)) return;

    if (mvKind === "ADJUST") {
      if (lines.some(l => l.newGrams == null || l.newGrams < 0)) return;
    } else {
      if (lines.some(l => l.grams == null || l.grams <= 0)) return;
    }

    setSaving(true);
    try {
      const payload: CreateMetalLine[] = lines.map(l => {
        if (mvKind === "ADJUST") {
          const current = warehouseStockMap[l.variantId] ?? 0;
          const delta   = (l.newGrams ?? 0) - current;
          return { variantId: l.variantId, grams: delta };
        }
        return { variantId: l.variantId, grams: l.grams! };
      });

      if (mvKind === "TRANSFER") {
        await metalMovementsApi.transfer({
          fromWarehouseId: mvFromWarehouseId,
          toWarehouseId:   mvToWarehouseId,
          effectiveAt:     new Date(`${mvDate}T00:00:00`).toISOString(),
          note:            mvNote,
          lines:           payload,
        });
      } else if (mvKind === "OUT") {
        await metalMovementsApi.createOut({
          warehouseId: mvWarehouseId,
          effectiveAt: new Date(`${mvDate}T00:00:00`).toISOString(),
          note:        mvNote,
          lines:       payload,
        });
      } else if (mvKind === "ADJUST") {
        await metalMovementsApi.adjust({
          warehouseId: mvWarehouseId,
          effectiveAt: new Date(`${mvDate}T00:00:00`).toISOString(),
          note:        mvNote,
          lines:       payload,
        });
      } else {
        await metalMovementsApi.create({
          warehouseId: mvWarehouseId,
          effectiveAt: new Date(`${mvDate}T00:00:00`).toISOString(),
          note:        mvNote,
          lines:       payload,
        });
      }

      toast.success("Movimiento registrado.");
      setShowModal(false);
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  const canTransfer = warehouses.length >= 2;

  /* ================================================================== */
  return (
    <TPSectionShell
      title="Movimientos de metales"
      subtitle="Entradas, salidas, transferencias y ajustes de stock en gramos."
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
        onSort={key => handleSort(key as SortCol)}
        loading={loading}
        onRowClick={(m) => setViewTarget(m)}
        emptyText="No hay movimientos."
        countLabel="movimientos"
        pagination={{
          page,
          pageSize,
          totalItems: total,
          onPageChange: setPage,
          onPageSizeChange: sz => { setPageSize(sz); setPage(1); },
          pageSizeOptions: [10, 30, 50, 100],
        }}
        headerLeft={
          <div className="flex items-center gap-1.5">
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
              <TPFilterPopover
                open={filterPopoverOpen}
                options={KIND_OPTIONS}
                value={kind}
                onChange={v => { setKind(v); setFilterPopoverOpen(false); }}
                onClose={() => setFilterPopoverOpen(false)}
                anchorRef={filterBtnRef}
              />
            </div>

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
              {activeChips.map(chip => (
                <span key={chip.key} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs px-2.5 py-0.5">
                  {chip.label}
                  <button type="button" onClick={chip.onRemove} className="ml-0.5 rounded-full hover:bg-primary/20 p-0.5 transition-colors" title="Quitar filtro">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <button type="button" onClick={clearAllFilters} className="text-xs text-muted hover:text-primary transition-colors ml-1">
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
          const isVoided = Boolean(m.deletedAt || m.voidedAt);
          const who      = s(m.createdBy?.name ?? m.createdBy?.email) || "—";
          const gDisplay = getGramsDisplay(m);

          return (
            <TPTr
              key={m.id}
              className={cn("border-b border-border", isVoided && "opacity-60")}
            >
              {vis.date && (
                <TPTd>
                  <div className="flex flex-col gap-0.5">
                    <span className={isVoided ? "line-through text-text" : "text-text"}>{fmtDate(m.effectiveAt)}</span>
                    <span className="text-xs text-muted">reg. {fmtDateTimeShort(m.createdAt)}</span>
                  </div>
                </TPTd>
              )}
              {vis.status && (
                <TPTd>
                  {isVoided ? <TPBadge tone="danger">Anulado</TPBadge> : <TPBadge tone="success">Confirmado</TPBadge>}
                </TPTd>
              )}
              {vis.type      && <TPTd><TPBadge tone={movementTone(m.kind)}>{movementLabel(m.kind)}</TPBadge></TPTd>}
              {vis.code      && <TPTd className="text-muted font-mono text-xs">{s(m.code) || "—"}</TPTd>}
              {vis.metal && (
                <TPTd>
                  {(() => {
                    const mvLines = m.lines ?? [];
                    if (mvLines.length === 0) return <span className="text-xs text-muted">—</span>;
                    const first     = mvLines[0];
                    const metalName = first.variant?.metal?.name ?? "";
                    const varName   = first.variant?.name ?? "—";
                    const label     = metalName ? `${metalName} \u2014 ${varName}` : varName;
                    if (mvLines.length === 1) return <span className="text-xs text-text">{label}</span>;
                    return (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs text-text truncate max-w-[140px]">{varName}</span>
                        <span className="shrink-0 text-[10px] font-medium text-muted bg-surface2/30 border border-border px-1.5 py-0.5 rounded-full">
                          +{mvLines.length - 1} m\u00E1s
                        </span>
                      </div>
                    );
                  })()}
                </TPTd>
              )}
              {vis.warehouse && (
                <TPTd>
                  {m.kind === "TRANSFER" ? (
                    <span className="text-xs">
                      <span className="text-text">{s(m.fromWarehouse?.name ?? m.fromWarehouse?.code) || "—"}</span>
                      <span className="text-muted mx-1">&rarr;</span>
                      <span className="text-text">{s(m.toWarehouse?.name ?? m.toWarehouse?.code) || "—"}</span>
                    </span>
                  ) : (
                    <span className="text-muted">{warehouseLabel(m)}</span>
                  )}
                </TPTd>
              )}
              {vis.grams && (
                <TPTd className="text-right">
                  <span className={cn("text-sm font-semibold tabular-nums", gDisplay.textClass)}>
                    {gDisplay.label}
                  </span>
                </TPTd>
              )}
              {vis.user  && <TPTd>{who}</TPTd>}
              {vis.note  && <TPTd className="text-muted">{s(m.note) || "—"}</TPTd>}
              {vis.actions && (
                <TPTd className="text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <TPButton variant="ghost" onClick={() => setViewTarget(m)} title="Ver detalle">
                      <Eye size={14} />
                    </TPButton>
                    {!isVoided && (
                      <TPButton variant="ghost" onClick={() => { setVoidTarget(m); setVoidNote(""); setVoidSubmitted(false); }} title="Anular movimiento">
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
        maxWidth="3xl"
        resizable
        maximizable
        maximizedMode="embedded"
        modalKey="inventario-movimientos-metales-view"
        footer={
          <div className="flex w-full items-center justify-between">
            <TPButton variant="ghost" iconLeft={<Printer size={14} />} onClick={() => { if (viewTarget) handlePrint(viewTarget, jewelry); }}>
              Imprimir
            </TPButton>
            <TPButton variant="secondary" onClick={() => setViewTarget(null)}>Cerrar</TPButton>
          </div>
        }
      >
        {viewTarget && (
          <div className="space-y-4">
            <TPCard className="p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <div><div className="text-xs text-muted mb-0.5">Comprobante</div><div className="font-mono text-sm font-semibold text-text">{s(viewTarget.code) || "—"}</div></div>
                <div><div className="text-xs text-muted mb-0.5">Tipo</div><TPBadge tone={movementTone(viewTarget.kind)}>{movementLabel(viewTarget.kind)}</TPBadge></div>
                <div>
                  <div className="text-xs text-muted mb-0.5">Estado</div>
                  {(viewTarget.deletedAt || viewTarget.voidedAt) ? <TPBadge tone="danger">Anulado</TPBadge> : <TPBadge tone="success">Confirmado</TPBadge>}
                </div>
                <div><div className="text-xs text-muted mb-0.5">Fecha efectiva</div><div className="text-sm text-text">{fmtDate(viewTarget.effectiveAt)}</div></div>
                <div><div className="text-xs text-muted mb-0.5">Registrado el</div><div className="text-sm text-text">{fmtDateTime(viewTarget.createdAt)}</div></div>
                <div><div className="text-xs text-muted mb-0.5">Creado por</div><div className="text-sm text-text">{s(viewTarget.createdBy?.name ?? viewTarget.createdBy?.email) || "—"}</div></div>
                <div className="col-span-2 md:col-span-3">
                  <div className="text-xs text-muted mb-0.5">Almacén</div>
                  <div className="text-sm text-text">{warehouseLabel(viewTarget)}</div>
                </div>
                {viewTarget.note && (
                  <div className="col-span-2 md:col-span-3">
                    <div className="text-xs text-muted mb-0.5">Nota</div>
                    <div className="text-sm text-text">{viewTarget.note}</div>
                  </div>
                )}
                {(viewTarget.deletedAt || viewTarget.voidedAt) && (
                  <>
                    <div><div className="text-xs text-muted mb-0.5">Anulado el</div><div className="text-sm text-text">{fmtDateTime(viewTarget.voidedAt ?? "")}</div></div>
                    <div><div className="text-xs text-muted mb-0.5">Anulado por</div><div className="text-sm text-text">{s(viewTarget.voidedBy?.name ?? viewTarget.voidedBy?.email) || "—"}</div></div>
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

            <TPCard title="Metales / variantes">
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-xs text-muted font-medium">Metal</th>
                      <th className="text-left py-2 px-3 text-xs text-muted font-medium">Variante</th>
                      <th className="text-left py-2 px-3 text-xs text-muted font-medium">SKU</th>
                      <th className="text-right py-2 px-3 text-xs text-muted font-medium">Gramos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewTarget.lines ?? []).map(l => {
                      const g = Number(l.grams);
                      return (
                        <tr key={l.id} className="border-b border-border/50">
                          <td className="py-2 px-3 text-text">{l.variant?.metal?.name ?? "—"}</td>
                          <td className="py-2 px-3 text-text">{l.variant?.name ?? "—"}</td>
                          <td className="py-2 px-3 font-mono text-xs text-muted">{s(l.variant?.sku) || "—"}</td>
                          <td className="py-2 px-3 text-right font-semibold tabular-nums">
                            {fmtGrams(g)} g
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TPCard>
          </div>
        )}
      </Modal>

      {/* ================================================================
          Modal — anular movimiento
      ================================================================ */}
      <Modal
        open={Boolean(voidTarget)}
        onClose={() => setVoidTarget(null)}
        title="Anular movimiento"
        maxWidth="sm"
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="secondary" onClick={() => setVoidTarget(null)} disabled={voidBusy}>Cancelar</TPButton>
            <TPButton variant="danger" onClick={handleVoid} loading={voidBusy}>
              Confirmar anulación
            </TPButton>
          </div>
        }
      >
        {voidTarget && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-400/30">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-text">
                Esta acción anulará el movimiento <span className="font-mono font-semibold">{s(voidTarget.code) || voidTarget.id}</span> y revertirá su impacto en el stock. No se puede deshacer.
              </p>
            </div>
            <TPField label="Motivo de anulación" required error={voidSubmitted && !voidNote.trim() ? "Requerido." : null}>
              <TPInput
                value={voidNote}
                onChange={setVoidNote}
                placeholder="Ej: Error de carga, devuelto…"
                autoFocus
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
        title="Nuevo movimiento de metales"
        maxWidth="5xl"
        resizable
        maximizable
        maximizedMode="embedded"
        modalKey="inventario-movimientos-metales-editor"
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="secondary" onClick={() => setShowModal(false)} disabled={saving} iconLeft={<X size={14} />}>
              Cancelar
            </TPButton>
            <TPButton
              onClick={() => void handleSave()}
              loading={saving}
              disabled={saving || (mvKind === "ADJUST" && loadingStockMap)}
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
              {KIND_CHIPS.map(chip => {
                const active     = mvKind === chip.value;
                const isDisabled = chip.value === "TRANSFER" && !canTransfer;
                return (
                  <button
                    key={chip.value}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => { if (!isDisabled) setMvKind(chip.value); }}
                    title={isDisabled ? "Necesit\u00E1s al menos 2 almacenes activos para transferir." : undefined}
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

          {/* Tipo (select sincronizado) + Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TPField label="Tipo" required>
              <TPComboFixed
                value={mvKind}
                onChange={v => setMvKind(v as MetalMovementKind)}
                options={[
                  { value: "IN",       label: "Entrada" },
                  { value: "OUT",      label: "Salida" },
                  { value: "ADJUST",   label: "Ajuste" },
                  { value: "TRANSFER", label: "Transferencia entre almacenes" },
                ]}
              />
            </TPField>
            <TPField label="Fecha" required error={submitted && !mvDate ? "Requerido." : null}>
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
                  error={submitted && !mvFromWarehouseId ? "Seleccion\u00E1 almac\u00E9n origen." : null}
                >
                  <TPComboFixed
                    value={mvFromWarehouseId}
                    onChange={setMvFromWarehouseId}
                    options={warehouses.map(w => ({ value: w.id, label: `${w.code} \u2014 ${w.name}` }))}
                    placeholder="Seleccion\u00E1 almac\u00E9n\u2026"
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
                    submitted && !mvToWarehouseId ? "Seleccion\u00E1 almac\u00E9n destino." :
                    submitted && mvFromWarehouseId === mvToWarehouseId ? "Origen y destino deben ser distintos." : null
                  }
                >
                  <TPComboFixed
                    value={mvToWarehouseId}
                    onChange={setMvToWarehouseId}
                    options={warehouses.map(w => ({ value: w.id, label: `${w.code} \u2014 ${w.name}` }))}
                    placeholder="Seleccion\u00E1 almac\u00E9n\u2026"
                  />
                </TPField>
              </div>
            </div>
          ) : (
            <TPField
              label="Almacén"
              required
              error={submitted && !mvWarehouseId ? "Seleccion\u00E1 un almac\u00E9n." : null}
            >
              <TPComboFixed
                value={mvWarehouseId}
                onChange={setMvWarehouseId}
                options={warehouses.map(w => ({ value: w.id, label: `${w.code} \u2014 ${w.name}` }))}
                placeholder="Seleccion\u00E1 almac\u00E9n\u2026"
              />
            </TPField>
          )}

          {/* Banner ADJUST */}
          {mvKind === "ADJUST" && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
              <span className="font-semibold">Ajuste de stock:</span> ingres\u00E1 los gramos finales deseados. El sistema calcula y registra autom\u00E1ticamente la diferencia.
              {loadingStockMap && <span className="ml-2 opacity-70">Cargando stock actual\u2026</span>}
            </div>
          )}

          {/* Líneas */}
          <div className="space-y-3">
            <p className="text-sm font-medium text-text">Metales</p>

            {submitted && lines.length === 0 && (
              <p className="text-xs text-red-500">Agreg\u00E1 al menos una l\u00EDnea.</p>
            )}

            {lines.map((line, idx) => {
              const variant        = variantMap.get(line.variantId);
              const pricePerGram   = variant?.finalSalePrice ?? null;
              const currentGrams   = warehouseStockMap[line.variantId] ?? 0;
              const toCurrentGrams = mvKind === "TRANSFER"
                ? (toWarehouseStockMap[line.variantId] ?? 0)
                : null;

              // ADJUST
              const adjustDelta  = mvKind === "ADJUST" && line.newGrams != null
                ? line.newGrams - currentGrams : null;
              const adjustValue  = adjustDelta != null && pricePerGram != null
                ? adjustDelta * pricePerGram : null;

              // IN / OUT / TRANSFER
              const grams          = line.grams ?? 0;
              const isOutLike      = mvKind === "OUT" || mvKind === "TRANSFER";
              let projectedFrom: number | null = null;
              let projectedTo:   number | null = null;
              if (line.variantId && mvKind !== "ADJUST" && grams > 0) {
                projectedFrom = isOutLike ? currentGrams - grams : currentGrams + grams;
                if (mvKind === "TRANSFER" && toCurrentGrams !== null) {
                  projectedTo = toCurrentGrams + grams;
                }
              }
              const willGoNegative = projectedFrom !== null && projectedFrom < 0;
              const movementValue  = grams > 0 && pricePerGram != null ? grams * pricePerGram : null;

              return (
                <div key={idx} className="rounded-xl border border-border bg-surface2/20 p-3 space-y-3">

                  {/* Metal/variante + Gramos + Eliminar */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <TPField
                        label="Metal / variante"
                        required
                        error={submitted && !line.variantId ? "Seleccion\u00E1 una variante." : null}
                      >
                        <MetalVariantTreeSelect
                          value={line.variantId}
                          onChange={v => setLineField(idx, "variantId", v)}
                          options={treeSelectOptions}
                          stockMap={warehouseStockMap}
                          loadingStock={loadingStockMap}
                        />
                      </TPField>
                    </div>

                    {mvKind !== "ADJUST" && (
                      <div className="w-36 shrink-0">
                        <TPField
                          label="Gramos"
                          required
                          error={
                            submitted && (line.grams == null || line.grams <= 0) ? "Requerido." : null
                          }
                        >
                          <TPNumberInput
                            value={line.grams}
                            onChange={v => setLineField(idx, "grams", v)}
                            min={0.001}
                            step={0.001}
                            decimals={3}
                          />
                        </TPField>
                      </div>
                    )}

                    {lines.length > 1 && (
                      <TPIconButton
                        onClick={() => removeLine(idx)}
                        title="Eliminar l\u00EDnea"
                        className="mt-6 shrink-0 h-8 w-8 hover:text-red-400 hover:border-red-400/30 hover:bg-red-400/10"
                      >
                        <Trash2 size={13} />
                      </TPIconButton>
                    )}
                  </div>

                  {/* Panel de info + impacto */}
                  {line.variantId && variant && (
                    <div className="rounded-xl border border-border bg-surface2/20 p-3 space-y-3">

                      {/* Bloque 1: contexto de la variante */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs text-muted">Metal</p>
                          <p className="text-xs text-text">{variant.metalName || "\u2014"}</p>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs text-muted">Ley / pureza</p>
                          <p className="text-xs text-text">{fmtPurity3(variant.purity)}</p>
                        </div>
                        {pricePerGram != null && (
                          <div className="flex flex-col gap-0.5">
                            <p className="text-xs text-muted">Valor / g</p>
                            <p className="text-xs text-text">{fmtMoney2(baseCurrencySymbol, pricePerGram)}</p>
                          </div>
                        )}
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs text-muted">SKU</p>
                          <p className="text-xs font-mono text-text">{variant.sku || "\u2014"}</p>
                        </div>
                      </div>

                      {/* Separador */}
                      <div className="border-t border-border/50" />

                      {/* Bloque 2: ADJUST vs IN/OUT/TRANSFER */}
                      {mvKind === "ADJUST" ? (

                        /* ADJUST: stock actual → stock nuevo → diferencia */
                        <div className="grid grid-cols-3 gap-2">
                          <div className="flex flex-col gap-1">
                            <p className="text-xs text-muted">Stock actual</p>
                            <div className="h-[42px] rounded-xl border border-border px-3 flex items-center text-sm text-muted bg-surface2/30 tabular-nums">
                              {loadingStockMap ? "\u2026" : `${fmtGrams(currentGrams)} g`}
                            </div>
                          </div>

                          <div className="flex flex-col gap-1">
                            <p className="text-xs text-muted">Stock nuevo *</p>
                            <TPNumberInput
                              value={line.newGrams}
                              onChange={v => setLineField(idx, "newGrams", v)}
                              min={0}
                              step={0.001}
                              decimals={3}
                              error={
                                submitted && line.newGrams == null ? "Requerido." :
                                submitted && line.newGrams != null && line.newGrams < 0 ? "Debe ser \u2265 0." :
                                null
                              }
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <p className="text-xs text-muted">Diferencia</p>
                            <div className={cn(
                              "h-[42px] rounded-xl border px-3 flex items-center text-sm font-semibold tabular-nums",
                              adjustDelta == null  ? "border-border text-muted bg-surface2/20"
                              : adjustDelta > 0    ? "border-green-400/50 text-green-600 bg-green-500/10"
                              : adjustDelta < 0    ? "border-red-400/50 text-red-600 bg-red-500/10"
                              :                      "border-border text-muted bg-surface2/20"
                            )}>
                              {adjustDelta == null
                                ? "\u2014"
                                : `${adjustDelta >= 0 ? "+" : ""}${fmtGrams(adjustDelta)} g`
                              }
                            </div>
                          </div>

                          {adjustValue != null && (
                            <div className="col-span-3 flex items-center gap-1.5">
                              <span className="text-xs text-muted">Impacto econ\u00F3mico:</span>
                              <span className={cn(
                                "text-xs font-semibold",
                                adjustValue > 0 ? "text-green-600" : adjustValue < 0 ? "text-red-600" : "text-muted"
                              )}>
                                {fmtMoney2(baseCurrencySymbol, adjustValue)}
                              </span>
                            </div>
                          )}
                        </div>

                      ) : (

                        /* IN / OUT / TRANSFER: KPI tiles */
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
                            <div className="rounded-lg border border-border bg-surface2/20 px-3 py-2 text-center">
                              <p className="text-[10px] text-muted uppercase tracking-wide mb-1">
                                {mvKind === "TRANSFER" ? "Stock" : "Stock actual"}
                              </p>
                              <p className="text-sm font-semibold text-text tabular-nums">
                                {loadingStockMap ? "\u2026" : `${fmtGrams(currentGrams)} g`}
                              </p>
                            </div>
                            <div className={cn(
                              "rounded-lg border px-3 py-2 text-center",
                              grams > 0
                                ? isOutLike
                                  ? "border-red-400/30 bg-red-500/5"
                                  : "border-green-400/30 bg-green-500/5"
                                : "border-border bg-surface2/20"
                            )}>
                              <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Movimiento</p>
                              <p className={cn(
                                "text-sm font-semibold tabular-nums",
                                grams > 0
                                  ? isOutLike ? "text-red-500" : "text-green-500"
                                  : "text-muted"
                              )}>
                                {grams > 0
                                  ? `${isOutLike ? "\u2212" : "+"}${fmtGrams(grams)} g`
                                  : "\u2014"
                                }
                              </p>
                            </div>
                            <div className={cn(
                              "rounded-lg border px-3 py-2 text-center",
                              projectedFrom !== null
                                ? willGoNegative ? "border-red-400/30 bg-red-500/5" : "border-green-400/30 bg-green-500/5"
                                : "border-border bg-surface2/20"
                            )}>
                              <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Resultado</p>
                              <p className={cn(
                                "text-sm font-semibold tabular-nums",
                                projectedFrom !== null
                                  ? willGoNegative ? "text-red-500" : "text-green-500"
                                  : "text-muted"
                              )}>
                                {projectedFrom !== null
                                  ? <>{fmtGrams(projectedFrom)} g{willGoNegative && <span title="El stock quedar\u00EDa en negativo"> \u26A0</span>}</>
                                  : "\u2014"
                                }
                              </p>
                            </div>
                          </div>

                          {/* Impacto económico */}
                          {movementValue != null && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted">Impacto econ\u00F3mico:</span>
                              <span className={cn(
                                "text-xs font-semibold",
                                isOutLike ? "text-red-600" : "text-green-600"
                              )}>
                                {isOutLike ? "\u2212" : "+"}{fmtMoney2(baseCurrencySymbol, movementValue)}
                              </span>
                            </div>
                          )}

                          {/* Fila destino — solo TRANSFER */}
                          {mvKind === "TRANSFER" && grams > 0 && toCurrentGrams !== null && (
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
                                  <p className="text-sm font-semibold text-text tabular-nums">
                                    {loadingToStockMap ? "\u2026" : `${fmtGrams(toCurrentGrams)} g`}
                                  </p>
                                </div>
                                <div className="rounded-lg border border-green-400/30 bg-green-500/5 px-3 py-2 text-center">
                                  <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Movimiento</p>
                                  <p className="text-sm font-semibold text-green-500 tabular-nums">+{fmtGrams(grams)} g</p>
                                </div>
                                <div className={cn(
                                  "rounded-lg border px-3 py-2 text-center",
                                  projectedTo !== null ? "border-green-400/30 bg-green-500/5" : "border-border bg-surface2/20"
                                )}>
                                  <p className="text-[10px] text-muted uppercase tracking-wide mb-1">Resultado</p>
                                  <p className="text-sm font-semibold text-green-500 tabular-nums">
                                    {projectedTo !== null ? `${fmtGrams(projectedTo)} g` : "\u2014"}
                                  </p>
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
            <TPInput value={mvNote} onChange={setMvNote} placeholder="Observaciones opcionales\u2026" />
          </TPField>
        </div>
      </Modal>
    </TPSectionShell>
  );
}

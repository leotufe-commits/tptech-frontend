// src/pages/InventarioReposicion.tsx
// ============================================================================
// Reposición — vista consultiva.
//
// Muestra artículos que requieren reposición:
//   · stock ≤ 0  → estado OUT (sin stock)
//   · 0 < stock ≤ minStock → estado LOW (bajo mínimo)
//
// Reutiliza el endpoint existente GET /warehouses/:id/article-stock y la
// lógica de carga/aplanado que ya usa "Stock por depósito". NO escribe datos.
//
// Queda preparada para evolucionar a pedidos automáticos, compras y sugerencias
// inteligentes: las acciones (por fila y masivas) son placeholders que muestran
// toasts "próximamente" hasta que llegue la lógica real.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { formatQty } from "../lib/pricing/format";
import { useNavigate } from "react-router-dom";
import {
  Package,
  PackageX,
  AlertTriangle,
  DollarSign,
  ExternalLink,
  History,
  ShoppingCart,
  CheckCircle,
  FileText,
  Printer,
  Download,
} from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPBadge } from "../components/ui/TPBadges";
import { TPButton } from "../components/ui/TPButton";
import { TPActionsMenu, type TPActionsMenuItem } from "../components/ui/TPActionsMenu";
import TPTableImage from "../components/ui/TPTableImage";
import TPSelect from "../components/ui/TPSelect";

import { warehousesApi, type ArticleStockRow } from "./InventarioAlmacenes/warehouses.api";
import type { WarehouseRow } from "./InventarioAlmacenes/types";
import { toast } from "../lib/toast";
import { cn } from "../components/ui/tp";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────────────────────────────────────

type ReposStatus = "LOW" | "OUT";

type ReposRow = {
  id: string;            // `${warehouseId}:${stockRowId}`
  articleId: string;
  articleName: string;
  articleCode: string;
  articleSku: string;
  variantId: string | null;
  variantName: string;
  variantSku: string;
  variantCode: string;
  warehouseId: string;
  warehouseName: string;
  stock: number;
  minStock: number | null;
  /** minStock - stock, clamp a 0. Si minStock es null, se usa stock ausente → se sugiere 1. */
  diff: number;
  /** Igual a `diff`. Separado para que el día de mañana la política sugerida pueda diferir. */
  suggested: number;
  status: ReposStatus;
  imageUrl: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function fmtQty(n: number): string {
  return formatQty(n);
}

function statusBadge(s: ReposStatus) {
  if (s === "OUT") return <TPBadge tone="danger" size="sm">Sin stock</TPBadge>;
  return <TPBadge tone="warning" size="sm">Bajo mínimo</TPBadge>;
}

/**
 * Convierte una fila de stock del backend a una fila de Reposición,
 * o devuelve null si el artículo NO requiere reposición.
 */
function toReposRow(row: ArticleStockRow, warehouse: WarehouseRow): ReposRow | null {
  const stock = toNum(row.quantity);
  const minStock =
    row.variant?.reorderPoint != null
      ? toNum(row.variant.reorderPoint)
      : row.article.reorderPoint != null
      ? toNum(row.article.reorderPoint)
      : null;

  // Solo interesa lo que requiere reposición
  const isOut = stock <= 0;
  const isLow = minStock != null && stock > 0 && stock <= minStock;
  if (!isOut && !isLow) return null;

  // Diferencia y cantidad sugerida:
  //   · Si hay minStock → diff = max(minStock - stock, 0)
  //   · Si no hay minStock y está OUT → sugerencia mínima de 1
  const diff =
    minStock != null ? Math.max(minStock - stock, 0) : isOut ? 1 : 0;

  return {
    id:            `${warehouse.id}:${row.id}`,
    articleId:     row.article.id,
    articleName:   row.article.name,
    articleCode:   row.article.code,
    articleSku:    row.article.sku ?? "",
    variantId:     row.variant?.id ?? null,
    variantName:   row.variant?.name ?? "",
    variantSku:    row.variant?.sku ?? "",
    variantCode:   row.variant?.code ?? "",
    warehouseId:   warehouse.id,
    warehouseName: warehouse.name,
    stock,
    minStock,
    diff,
    suggested:     diff,
    status:        isOut ? "OUT" : "LOW",
    imageUrl:      null,  // preparado — cuando el endpoint exponga la imagen, enchufar aquí
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "image",     label: "",             width: "44px",  canHide: false },
  { key: "code",      label: "Código",       width: "110px", sortKey: "code" },
  { key: "article",   label: "Artículo",                     sortKey: "article" },
  { key: "variant",   label: "Variante",     width: "140px" },
  { key: "warehouse", label: "Almacén",      width: "160px", sortKey: "warehouse" },
  { key: "stock",     label: "Stock actual", width: "110px", align: "right", sortKey: "stock" },
  { key: "minStock",  label: "Stock mínimo", width: "110px", align: "right" },
  { key: "diff",      label: "Diferencia",   width: "110px", align: "right", sortKey: "diff" },
  { key: "suggested", label: "Sugerido",     width: "110px", align: "right", sortKey: "suggested" },
  { key: "status",    label: "Estado",       width: "120px" },
  { key: "actions",   label: "",             width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | "OUT" | "LOW";

export default function InventarioReposicion() {
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [rows, setRows]             = useState<ReposRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [q, setQ]                             = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter]       = useState<StatusFilter>("ALL");

  // Selección masiva (TPTableKit ya gestiona la UI del modo + bulk bar)
  const [selectable, setSelectable]     = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  // ── Carga ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const whs = await warehousesApi.list();
        const activeWhs = whs.filter((w) => w.isActive !== false);
        if (cancel) return;
        setWarehouses(activeWhs);

        const perWarehouse = await Promise.all(
          activeWhs.map((w) =>
            warehousesApi
              .getArticleStock(w.id)
              .then((rs) =>
                rs
                  .map((r) => toReposRow(r, w))
                  .filter((x): x is ReposRow => x != null),
              )
              .catch(() => [] as ReposRow[]),
          ),
        );
        if (cancel) return;
        setRows(perWarehouse.flat());
      } catch (err: any) {
        if (cancel) return;
        setError(err?.message ?? "No se pudo cargar la reposición.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();

    return () => { cancel = true; };
  }, []);

  // ── Filtrado client-side ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (warehouseFilter !== "ALL" && r.warehouseId !== warehouseFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = [
        r.articleName, r.articleCode, r.articleSku,
        r.variantName, r.variantCode, r.variantSku,
      ].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, q, warehouseFilter, statusFilter]);

  // ── KPIs (calculados sobre TODO el set, no sólo lo filtrado) ─────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const out = rows.filter((r) => r.status === "OUT").length;
    const low = rows.filter((r) => r.status === "LOW").length;
    const totalSuggested = rows.reduce((s, r) => s + r.suggested, 0);

    return [
      { id: "items",     label: "Ítems a reponer",   value: rows.length,        hint: "Total de líneas",            tone: rows.length > 0 ? "primary" : "neutral", icon: <Package size={12} />,       loading },
      { id: "out",       label: "Sin stock",         value: out,                hint: "Stock ≤ 0",                  tone: out > 0 ? "danger" : "neutral",  icon: <PackageX size={12} />,      loading },
      { id: "low",       label: "Bajo mínimo",       value: low,                hint: "Stock ≤ mínimo",             tone: low > 0 ? "warning" : "neutral", icon: <AlertTriangle size={12} />, loading },
      { id: "suggested", label: "Cant. sugerida",    value: fmtQty(totalSuggested), hint: "Para volver al mínimo",   tone: "info",    icon: <ShoppingCart size={12} />,  loading },
      { id: "value",     label: "Valor estimado",    value: "—",                hint: "Pendiente de cálculo",       tone: "neutral", icon: <DollarSign size={12} />,    loading },
    ];
  }, [rows, loading]);

  // ── Filtros de header ────────────────────────────────────────────────────
  const warehouseOptions = useMemo(
    () => [
      { value: "ALL", label: "Todos los almacenes" },
      ...warehouses.map((w) => ({ value: w.id, label: w.name })),
    ],
    [warehouses],
  );

  const statusOptions = [
    { value: "ALL", label: "Todos los estados" },
    { value: "OUT", label: "Sin stock" },
    { value: "LOW", label: "Bajo mínimo" },
  ];

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(r: ReposRow): TPActionsMenuItem[] {
    return [
      {
        label: "Ver artículo",
        icon: <ExternalLink size={14} />,
        onClick: () => navigate(`/articulos/articulos?focus=${encodeURIComponent(r.articleId)}`),
      },
      {
        label: "Ver movimientos",
        icon: <History size={14} />,
        onClick: () => navigate(`/inventario/movimientos-articulos?warehouseId=${encodeURIComponent(r.warehouseId)}`),
      },
      { type: "separator" },
      {
        label: "Generar pedido",
        icon: <ShoppingCart size={14} />,
        onClick: () => toast.info("Generación de pedido — próximamente"),
      },
      {
        label: "Marcar como revisado",
        icon: <CheckCircle size={14} />,
        onClick: () => toast.info("Marcar como revisado — próximamente"),
      },
    ];
  }

  // ── Bulk actions (aparecen cuando hay selección > 0) ────────────────────
  const bulkActions = (
    <div className="flex items-center gap-2">
      <TPButton
        variant="primary"
        onClick={() => toast.info(`Generar pedido de compra para ${selectedIds.size} ítem(s) — próximamente`)}
        iconLeft={<ShoppingCart size={14} />}
        className="h-8 text-sm"
      >
        Generar pedido
      </TPButton>
      <TPButton
        variant="secondary"
        onClick={() => toast.info("Exportar selección — próximamente")}
        iconLeft={<Download size={14} />}
        className="h-8 text-sm"
      >
        Exportar
      </TPButton>
      <TPButton
        variant="secondary"
        onClick={() => toast.info("Imprimir selección — próximamente")}
        iconLeft={<Printer size={14} />}
        className="h-8 text-sm"
      >
        Imprimir
      </TPButton>
    </div>
  );

  // ── Menú superior (acciones globales, sin depender de selección) ────────
  const menuItems: TPActionsMenuItem[] = [
    {
      label: "Exportar listado",
      icon: <FileText size={14} />,
      onClick: () => toast.info("Exportar listado — próximamente"),
    },
    {
      label: "Imprimir listado",
      icon: <Printer size={14} />,
      onClick: () => toast.info("Imprimir listado — próximamente"),
    },
  ];

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    r: ReposRow,
    vis: Record<string, boolean>,
    sel?: { checked: boolean; onCheck: () => void },
    orderedKeys?: string[],
  ) {
    const cells: Record<string, React.ReactNode> = {
      image: (
        <TPTd className="px-2">
          <TPTableImage src={r.imageUrl} alt={r.articleName} />
        </TPTd>
      ),
      code: (
        <TPTd className="font-mono text-xs text-muted">{r.articleCode}</TPTd>
      ),
      article: (
        <TPTd>
          <div className="font-medium text-sm text-text truncate">{r.articleName}</div>
          {r.articleSku && <div className="text-[11px] text-muted truncate">SKU {r.articleSku}</div>}
        </TPTd>
      ),
      variant: (
        <TPTd className="text-sm text-text/80">
          {r.variantName ? r.variantName : <span className="text-muted">—</span>}
        </TPTd>
      ),
      warehouse: (
        <TPTd className="text-sm text-text/80 truncate">{r.warehouseName}</TPTd>
      ),
      stock: (
        <TPTd className={cn(
          "text-right tabular-nums font-medium",
          r.status === "OUT" ? "text-red-500" : "text-amber-500",
        )}>
          {fmtQty(r.stock)}
        </TPTd>
      ),
      minStock: (
        <TPTd className="text-right tabular-nums text-muted">
          {r.minStock != null ? fmtQty(r.minStock) : "—"}
        </TPTd>
      ),
      diff: (
        <TPTd className="text-right tabular-nums font-semibold text-text">
          {r.diff > 0 ? fmtQty(r.diff) : "—"}
        </TPTd>
      ),
      suggested: (
        <TPTd className="text-right tabular-nums font-bold text-primary">
          {r.suggested > 0 ? fmtQty(r.suggested) : "—"}
        </TPTd>
      ),
      status: (
        <TPTd>{statusBadge(r.status)}</TPTd>
      ),
      actions: (
        <TPTd className="text-right px-2" data-tp-actions>
          <TPActionsMenu items={rowActions(r)} title="Acciones" />
        </TPTd>
      ),
    };

    const keys = orderedKeys && orderedKeys.length > 0
      ? orderedKeys
      : COLS.filter((c) => vis[c.key] !== false).map((c) => c.key);

    return (
      <TPTr key={r.id}>
        {sel && (
          <TPTd className="px-3">
            <input
              type="checkbox"
              checked={sel.checked}
              onChange={sel.onCheck}
              className="h-4 w-4 accent-primary cursor-pointer"
              aria-label="Seleccionar fila"
            />
          </TPTd>
        )}
        {keys.map((k) => (
          <React.Fragment key={k}>{cells[k]}</React.Fragment>
        ))}
      </TPTr>
    );
  }

  // ── Filtros (headerLeft de TPTableKit) ───────────────────────────────────
  const filters = (
    <div className="flex items-center gap-2">
      <div className="w-44">
        <TPSelect
          value={warehouseFilter}
          onChange={setWarehouseFilter}
          options={warehouseOptions}
        />
      </div>
      <div className="w-44">
        <TPSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
          options={statusOptions}
        />
      </div>
    </div>
  );

  return (
    <TPSectionShell
      title="Reposición"
      subtitle="Artículos que requieren reposición según stock mínimo"
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<ReposRow>
          rows={filtered}
          columns={COLS}
          storageKey="tp_reposition_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por nombre, código o SKU…",
            debounceMs: 200,
          }}
          sortPersistKey="tp_reposition_table"
          columnPicker
          headerLeft={filters}
          loading={loading}
          loadingMode="skeleton"
          error={error ?? undefined}
          selectable={selectable}
          getRowId={(r) => r.id}
          onSelectionChange={setSelectedIds}
          onToggleSelectable={() => setSelectable((v) => !v)}
          bulkActions={bulkActions}
          menuItems={menuItems}
          countLabel={(n) => `${n} ${n === 1 ? "ítem a reponer" : "ítems a reponer"}`}
          emptyText={
            q || warehouseFilter !== "ALL" || statusFilter !== "ALL"
              ? "Sin resultados con los filtros aplicados."
              : "No hay artículos que requieran reposición."
          }
          renderRow={renderRow}
        />
      </div>
    </TPSectionShell>
  );
}

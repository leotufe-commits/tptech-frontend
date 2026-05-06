// src/pages/InventarioStockPorDeposito.tsx
// ============================================================================
// Stock por depósito — vista consultiva.
//
// Agrega el stock de todos los almacenes activos en una tabla unificada.
// Consume el endpoint existente GET /warehouses/:id/article-stock (uno por
// almacén) y aplana el resultado. No escribe stock desde el frontend.
//
// Este es el primer candidato que usa los nuevos estándares:
//   · TPSectionShell para el header
//   · TPKpiBar para los indicadores
//   · TPTableKit v2 con search + sortPersistKey + columnPicker integrados
//
// Acciones por fila son placeholders hoy — quedan preparadas para que cuando
// lleguen Ajustes / Transferencias / Reposición puedan conectarse sin rediseñar.
// ============================================================================

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  BoxSelect,
  PackageCheck,
  AlertTriangle,
  DollarSign,
  ExternalLink,
  History,
  SlidersHorizontal,
  ArrowLeftRight,
  Tag,
} from "lucide-react";

import { TPSectionShell } from "../components/ui/TPSectionShell";
import { TPKpiBar, type TPKpiItem } from "../components/ui/TPKpiBar";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPTr, TPTd } from "../components/ui/TPTable";
import { TPBadge } from "../components/ui/TPBadges";
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

type StockStatus = "OK" | "LOW" | "OUT";

type StockRow = {
  /** id único a nivel fila = `${warehouseId}:${stockRowId}` */
  id: string;
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
  reserved: number;
  available: number;
  minStock: number | null;
  status: StockStatus;
  /** imagen del artículo — hoy no viene en el endpoint actual (preparado para cuando se agregue) */
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

function resolveStatus(stock: number, minStock: number | null): StockStatus {
  if (stock <= 0) return "OUT";
  if (minStock != null && stock <= minStock) return "LOW";
  return "OK";
}

function statusBadge(s: StockStatus) {
  if (s === "OUT") return <TPBadge tone="danger" size="sm">Sin stock</TPBadge>;
  if (s === "LOW") return <TPBadge tone="warning" size="sm">Bajo mínimo</TPBadge>;
  return <TPBadge tone="success" size="sm">OK</TPBadge>;
}

function fmtQty(n: number): string {
  return n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function mapArticleStockRow(row: ArticleStockRow, warehouse: WarehouseRow): StockRow {
  const stock    = toNum(row.quantity);
  const reserved = toNum(row.reservedQty);
  const available = Math.max(0, stock - reserved);
  const minStock =
    row.variant?.reorderPoint != null
      ? toNum(row.variant.reorderPoint)
      : row.article.reorderPoint != null
      ? toNum(row.article.reorderPoint)
      : null;

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
    reserved,
    available,
    minStock,
    status:        resolveStatus(stock, minStock),
    imageUrl:      null,  // preparado: cuando el endpoint exponga mainImageUrl, enchufar aquí
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Columnas de la tabla
// ─────────────────────────────────────────────────────────────────────────────

const COLS: TPColDef[] = [
  { key: "image",     label: "",            width: "44px",  canHide: false },
  { key: "code",      label: "Código",      width: "110px", sortKey: "code" },
  { key: "article",   label: "Artículo",                    sortKey: "article" },
  { key: "variant",   label: "Variante",    width: "140px" },
  { key: "warehouse", label: "Almacén",     width: "160px", sortKey: "warehouse" },
  { key: "stock",     label: "Stock actual",width: "110px", align: "right", sortKey: "stock" },
  { key: "reserved",  label: "Reservado",   width: "110px", align: "right", sortKey: "reserved" },
  { key: "available", label: "Disponible",  width: "110px", align: "right", sortKey: "available" },
  { key: "minStock",  label: "Stock mínimo",width: "110px", align: "right" },
  { key: "status",    label: "Estado",      width: "120px" },
  { key: "actions",   label: "",            width: "48px",  canHide: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Pantalla
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = "ALL" | "OK" | "LOW" | "OUT";

export default function InventarioStockPorDeposito() {
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [rows, setRows]             = useState<StockRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [q, setQ]                       = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("ALL");

  // ── Carga: lista de almacenes + stock de cada uno en paralelo ───────────
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

        const stockByWarehouse = await Promise.all(
          activeWhs.map((w) =>
            warehousesApi
              .getArticleStock(w.id)
              .then((rs) => rs.map((r) => mapArticleStockRow(r, w)))
              .catch(() => [] as StockRow[]),
          ),
        );
        if (cancel) return;
        setRows(stockByWarehouse.flat());
      } catch (err: any) {
        if (cancel) return;
        setError(err?.message ?? "No se pudo cargar el stock.");
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

  // ── KPIs ─────────────────────────────────────────────────────────────────
  const kpis: TPKpiItem[] = useMemo(() => {
    const totalStock     = rows.reduce((s, r) => s + r.stock, 0);
    const totalReserved  = rows.reduce((s, r) => s + r.reserved, 0);
    const totalAvailable = rows.reduce((s, r) => s + r.available, 0);
    const lowOrOut       = rows.filter((r) => r.status !== "OK").length;

    return [
      { id: "total",     label: "Stock total",    value: fmtQty(totalStock),     hint: "Todos los almacenes",    tone: "primary", icon: <Package size={12} />,       loading },
      { id: "reserved",  label: "Reservado",      value: fmtQty(totalReserved),  hint: "Apartado por ventas",    tone: "info",    icon: <BoxSelect size={12} />,     loading },
      { id: "available", label: "Disponible",     value: fmtQty(totalAvailable), hint: "Stock − reservado",      tone: "success", icon: <PackageCheck size={12} />,  loading },
      { id: "low",       label: "Bajo mínimo",    value: lowOrOut,               hint: "Requiere reposición",    tone: lowOrOut > 0 ? "warning" : "neutral", icon: <AlertTriangle size={12} />, loading },
      { id: "value",     label: "Valor estimado", value: "—",                    hint: "Pendiente de cálculo",   tone: "neutral", icon: <DollarSign size={12} />,    loading },
    ];
  }, [rows, loading]);

  // ── Opciones de filtros ──────────────────────────────────────────────────
  const warehouseOptions = useMemo(
    () => [
      { value: "ALL", label: "Todos los almacenes" },
      ...warehouses.map((w) => ({ value: w.id, label: w.name })),
    ],
    [warehouses],
  );

  const statusOptions = [
    { value: "ALL", label: "Todos los estados" },
    { value: "OK",  label: "Con stock" },
    { value: "LOW", label: "Bajo mínimo" },
    { value: "OUT", label: "Sin stock" },
  ];

  // ── Row actions ──────────────────────────────────────────────────────────
  function rowActions(r: StockRow): TPActionsMenuItem[] {
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
        label: "Ajustar stock",
        icon: <SlidersHorizontal size={14} />,
        onClick: () => toast.info("Ajuste de stock — próximamente"),
      },
      {
        label: "Transferir",
        icon: <ArrowLeftRight size={14} />,
        onClick: () => toast.info("Transferencia — próximamente"),
      },
      {
        label: "Imprimir etiqueta",
        icon: <Tag size={14} />,
        onClick: () => toast.info("Impresión de etiqueta — próximamente"),
      },
    ];
  }

  // ── Render row ───────────────────────────────────────────────────────────
  function renderRow(
    r: StockRow,
    vis: Record<string, boolean>,
    _sel?: unknown,
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
        <TPTd className="text-right tabular-nums font-medium">{fmtQty(r.stock)}</TPTd>
      ),
      reserved: (
        <TPTd className="text-right tabular-nums text-muted">{r.reserved > 0 ? fmtQty(r.reserved) : "—"}</TPTd>
      ),
      available: (
        <TPTd className={cn(
          "text-right tabular-nums font-semibold",
          r.available <= 0 ? "text-red-500" : r.status === "LOW" ? "text-amber-500" : "text-text",
        )}>
          {fmtQty(r.available)}
        </TPTd>
      ),
      minStock: (
        <TPTd className="text-right tabular-nums text-muted">
          {r.minStock != null ? fmtQty(r.minStock) : "—"}
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
        {keys.map((k) => (
          <React.Fragment key={k}>{cells[k]}</React.Fragment>
        ))}
      </TPTr>
    );
  }

  // ── Header filters (se inyectan en headerLeft del TPTableKit) ────────────
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
      title="Stock por depósito"
      subtitle="Existencias actuales por almacén"
    >
      <div className="space-y-4">
        <TPKpiBar items={kpis} columns={5} />

        <TPTableKit<StockRow>
          rows={filtered}
          columns={COLS}
          storageKey="tp_stock_by_deposit_cols"
          search={{
            value: q,
            onChange: setQ,
            placeholder: "Buscar por nombre, código o SKU…",
            debounceMs: 200,
          }}
          sortPersistKey="tp_stock_by_deposit"
          columnPicker
          headerLeft={filters}
          loading={loading}
          loadingMode="skeleton"
          error={error ?? undefined}
          countLabel={(n) => `${n} ${n === 1 ? "ítem" : "ítems"}`}
          emptyText={q || warehouseFilter !== "ALL" || statusFilter !== "ALL"
            ? "Sin resultados con los filtros aplicados."
            : "No hay stock registrado en ningún almacén."}
          renderRow={renderRow}
        />
      </div>
    </TPSectionShell>
  );
}

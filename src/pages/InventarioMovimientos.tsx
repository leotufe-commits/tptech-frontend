// src/pages/InventarioMovimientos.tsx
import React, { useEffect, useMemo, useState } from "react";

import TPSectionShell from "../components/ui/TPSectionShell";
import TPSelect from "../components/ui/TPSelect";
import TPInput from "../components/ui/TPInput";
import { TPButton } from "../components/ui/TPButton";
import { TPBadge } from "../components/ui/TPBadges";
import { type SortDir } from "../components/ui/TPSort";
import TPDateRangeInline, { type TPDateRangeValue } from "../components/ui/TPDateRangeInline";
import { TPTd } from "../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";

import { cn } from "../components/ui/tp";
import { apiFetch } from "../lib/api";
import { toast } from "../lib/toast";
import { fmtNumberSmart } from "../lib/format";

/* =========================================================
   Column definitions
========================================================= */
const COL_KEY = "tptech_col_movimientos";

const MOV_COLS: TPColDef[] = [
  { key: "date",      label: "Fecha",            canHide: false, sortKey: "date" },
  { key: "type",      label: "Tipo",             sortKey: "type" },
  { key: "code",      label: "Comprobante",      sortKey: "code" },
  { key: "user",      label: "Usuario" },
  { key: "warehouse", label: "Origen / Destino" },
  { key: "grams",     label: "Gramos",           align: "right" },
  { key: "note",      label: "Nota" },
];

/* =========================================================
   Types
========================================================= */
type MovementKind = "IN" | "OUT" | "TRANSFER" | "ADJUST";

type MovementRow = {
  id: string;
  kind: MovementKind;
  code?: string;
  note?: string;
  effectiveAt: string;

  warehouse?: { id: string; name: string; code?: string } | null;
  fromWarehouse?: { id: string; name: string; code?: string } | null;
  toWarehouse?: { id: string; name: string; code?: string } | null;

  createdBy?: { id: string; email: string; name?: string | null } | null;

  lines?: Array<{ grams: any }> | null;

  voidedAt?: string | null;
  deletedAt?: string | null;
};

/* =========================================================
   Helpers
========================================================= */
function s(v: any) {
  return String(v ?? "").trim();
}

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtDateTime(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR");
}

function movementTone(kind: string) {
  switch (kind) {
    case "IN":
      return "success";
    case "OUT":
      return "danger";
    case "TRANSFER":
      return "info";
    case "ADJUST":
      return "warning";
    default:
      return "neutral";
  }
}

function gramsForMovement(m: MovementRow) {
  const total =
    (m.lines ?? []).reduce((acc, l) => acc + toNum((l as any)?.grams, 0), 0) || 0;
  return total;
}

function readQueryParam(name: string) {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function dateToIso(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

async function fetchMovements(body: any) {
  return apiFetch("/movimientos/list", { method: "POST", body }) as Promise<{
    rows: MovementRow[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

/* =========================================================
   Sort state type
========================================================= */
type SortCol = "date" | "code" | "type";

export default function InventarioMovimientos() {
  // si venimos desde un almacén (WarehouseViewModal)
  const initialWarehouseId = useMemo(() => readQueryParam("warehouseId"), []);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<MovementKind | "">("");
  const [warehouseId, setWarehouseId] = useState<string>(initialWarehouseId);

  /* ---------- date range filter ---------- */
  const [dateRange, setDateRange] = useState<TPDateRangeValue>({ from: null, to: null });

  /* ---------- sort ---------- */
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  // pagination simple
  const [page, setPage] = useState(1);
  const pageSize = 30;

  async function refresh() {
    setLoading(true);
    try {
      const data = await fetchMovements({
        page,
        pageSize,
        q: s(q),
        kind: kind || null,
        warehouseId: s(warehouseId) || null,
        from: dateToIso(dateRange.from),
        to: dateToIso(dateRange.to),
      });

      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotal(Number(data?.total || 0));
    } catch (e: any) {
      toast.error(e?.message || "No se pudieron cargar movimientos.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // cuando cambian filtros → volvemos a page 1 y recargamos
  useEffect(() => {
    setPage(1);
    const t = setTimeout(() => void refresh(), 160);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind, warehouseId, dateRange]);

  /* ---------- client-side sort of current page results ---------- */
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date") {
        cmp = new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime();
      } else if (sortCol === "code") {
        cmp = s(a.code).localeCompare(s(b.code), "es");
      } else if (sortCol === "type") {
        cmp = a.kind.localeCompare(b.kind, "es");
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const pageInfo = useMemo(() => {
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    if (total <= 0) return "—";
    return `${from}-${to} de ${total}`;
  }, [page, pageSize, total]);

  return (
    <TPSectionShell
      title="Movimientos"
      subtitle="Entradas / salidas / transferencias / ajustes. (Historial + documento futuro)"
    >
      <TPTableKit
        rows={sortedRows}
        columns={MOV_COLS}
        storageKey={COL_KEY}
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Buscar por nota, comprobante, usuario…"
        sortKey={sortCol}
        sortDir={sortDir}
        onSort={(key) => handleSort(key as SortCol)}
        loading={loading}
        emptyText="No hay movimientos."
        countLabel={(n) => `${n} ${n === 1 ? "registro" : "registros"} en esta página${total > 0 ? ` · ${total} en total` : ""}`}
        belowHeader={
          <div className="px-4 pb-3">
            <TPDateRangeInline
              value={dateRange}
              onChange={setDateRange}
              showPresets
              defaultPresetDays={30}
              fromLabel="Desde"
              toLabel="Hasta"
              className="flex-wrap"
            />
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <TPSelect
              value={kind}
              onChange={(v) => setKind(v as MovementKind | "")}
              options={[
                { value: "", label: "Todos los tipos" },
                { value: "IN", label: "Entrada" },
                { value: "OUT", label: "Salida" },
                { value: "TRANSFER", label: "Transferencia" },
                { value: "ADJUST", label: "Ajuste" },
              ]}
            />
            <TPInput
              value={warehouseId}
              onChange={setWarehouseId}
              placeholder="ID de almacén (filtro)"
              className="md:w-[200px]"
            />
            <div className="text-xs text-muted whitespace-nowrap">
              {loading ? "Cargando…" : pageInfo}
            </div>
          </div>
        }
        renderRow={(m, vis) => {
          const who = s(m.createdBy?.name || m.createdBy?.email) || "—";
          const wh =
            m.kind === "TRANSFER"
              ? `${s(m.fromWarehouse?.code || m.fromWarehouse?.name) || "—"} → ${s(m.toWarehouse?.code || m.toWarehouse?.name) || "—"}`
              : s(m.warehouse?.code || m.warehouse?.name) || "—";
          const grams = gramsForMovement(m);
          return (
            <tr key={m.id} className="border-b border-border cursor-pointer hover:bg-surface2/40 transition-colors">
              {vis.date     && <TPTd className="text-muted">{fmtDateTime(m.effectiveAt)}</TPTd>}
              {vis.type     && <TPTd><TPBadge tone={movementTone(m.kind)}>{m.kind}</TPBadge></TPTd>}
              {vis.code     && <TPTd className="text-muted">{s(m.code) || "—"}</TPTd>}
              {vis.user     && <TPTd>{who}</TPTd>}
              {vis.warehouse && <TPTd className="text-muted">{wh}</TPTd>}
              {vis.grams    && <TPTd className="text-right font-semibold text-text">{fmtNumberSmart(grams)}</TPTd>}
              {vis.note     && <TPTd className="text-muted">{s(m.note) || "—"}</TPTd>}
            </tr>
          );
        }}
      />

      {/* ---- paginación ---- */}
      <div className="mt-3 flex items-center justify-between">
        <TPButton
          variant="secondary"
          disabled={loading || page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ← Anterior
        </TPButton>

        <div className="text-xs text-muted">Página {page}</div>

        <TPButton
          variant="secondary"
          disabled={loading || page * pageSize >= total}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente →
        </TPButton>
      </div>
    </TPSectionShell>
  );
}

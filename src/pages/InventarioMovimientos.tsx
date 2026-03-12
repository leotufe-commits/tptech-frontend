// src/pages/InventarioMovimientos.tsx
import React, { useEffect, useMemo, useState } from "react";

import TPSectionShell from "../components/ui/TPSectionShell";
import TPSearchInput from "../components/ui/TPSearchInput";
import TPSelect from "../components/ui/TPSelect";
import TPInput from "../components/ui/TPInput";
import { TPButton } from "../components/ui/TPButton";
import { TPBadge } from "../components/ui/TPBadges";
import { TPColumnPicker, type ColPickerDef } from "../components/ui/TPColumnPicker";
import { SortArrows, type SortDir } from "../components/ui/TPSort";
import TPDateRangeInline, { type TPDateRangeValue } from "../components/ui/TPDateRangeInline";
import {
  TPTableWrap,
  TPTableHeader,
  TPTableFooter,
  TPTableXScroll,
  TPTableElBase,
  TPThead,
  TPTbody,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../components/ui/TPTable";

import { cn } from "../components/ui/tp";
import { apiFetch } from "../lib/api";
import { toast } from "../lib/toast";
import { fmtNumberSmart } from "../lib/format";

/* =========================================================
   Column picker
========================================================= */
const COL_KEY = "tptech_col_movimientos";

const PICKABLE_COLS: ColPickerDef[] = [
  { key: "date", label: "Fecha", canHide: false },
  { key: "type", label: "Tipo" },
  { key: "code", label: "Comprobante" },
  { key: "user", label: "Usuario" },
  { key: "warehouse", label: "Origen / Destino" },
  { key: "grams", label: "Gramos" },
  { key: "note", label: "Nota" },
];

function loadColVis(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COL_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { date: true, type: true, code: true, user: true, warehouse: true, grams: true, note: true };
}

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

  /* ---------- column picker ---------- */
  const [colVis, setColVis] = useState<Record<string, boolean>>(loadColVis);

  function handleColChange(key: string, visible: boolean) {
    setColVis((prev) => {
      const next = { ...prev, [key]: visible };
      try { localStorage.setItem(COL_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

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
      <TPTableWrap>
        {/* ---- header ---- */}
        <TPTableHeader
          left={
            <div className="flex items-center gap-2 flex-wrap">
              <TPColumnPicker
                columns={PICKABLE_COLS}
                visibility={colVis}
                onChange={handleColChange}
              />
              <TPSearchInput
                value={q}
                onChange={setQ}
                placeholder="Buscar por nota, comprobante, usuario…"
                className="w-full md:w-64"
              />
            </div>
          }
          right={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Filtro por tipo */}
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

              {/* Filtro por almacén (campo libre por ahora) */}
              <TPInput
                value={warehouseId}
                onChange={setWarehouseId}
                placeholder="ID de almacén (filtro)"
                className="md:w-[200px]"
              />

              {/* Paginación info */}
              <div className="text-xs text-muted whitespace-nowrap">
                {loading ? "Cargando…" : pageInfo}
              </div>
            </div>
          }
        />

        {/* ---- filtro de fechas ---- */}
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

        {/* ---- tabla ---- */}
        <TPTableXScroll>
          <TPTableElBase responsive="scroll">
            <TPThead>
              <tr>
                {/* Fecha — siempre visible, sorteable */}
                <TPTh>
                  <button
                    type="button"
                    onClick={() => handleSort("date")}
                    className="inline-flex items-center gap-1.5 hover:text-text transition-colors"
                  >
                    Fecha
                    <SortArrows dir={sortDir} active={sortCol === "date"} />
                  </button>
                </TPTh>

                {/* Tipo — sorteable */}
                {colVis.type !== false && (
                  <TPTh>
                    <button
                      type="button"
                      onClick={() => handleSort("type")}
                      className="inline-flex items-center gap-1.5 hover:text-text transition-colors"
                    >
                      Tipo
                      <SortArrows dir={sortDir} active={sortCol === "type"} />
                    </button>
                  </TPTh>
                )}

                {/* Comprobante — sorteable */}
                {colVis.code !== false && (
                  <TPTh>
                    <button
                      type="button"
                      onClick={() => handleSort("code")}
                      className="inline-flex items-center gap-1.5 hover:text-text transition-colors"
                    >
                      Comprobante
                      <SortArrows dir={sortDir} active={sortCol === "code"} />
                    </button>
                  </TPTh>
                )}

                {colVis.user !== false && <TPTh>Usuario</TPTh>}
                {colVis.warehouse !== false && <TPTh>Origen / Destino</TPTh>}
                {colVis.grams !== false && <TPTh className="text-right">Gramos</TPTh>}
                {colVis.note !== false && <TPTh>Nota</TPTh>}
              </tr>
            </TPThead>

            <TPTbody>
              {sortedRows.map((m) => {
                const who = s(m.createdBy?.name || m.createdBy?.email) || "—";

                const wh =
                  m.kind === "TRANSFER"
                    ? `${s(m.fromWarehouse?.code || m.fromWarehouse?.name) || "—"} → ${
                        s(m.toWarehouse?.code || m.toWarehouse?.name) || "—"
                      }`
                    : s(m.warehouse?.code || m.warehouse?.name) || "—";

                const grams = gramsForMovement(m);

                return (
                  <tr
                    key={m.id}
                    className="border-b border-border cursor-pointer hover:bg-surface2/40 transition-colors"
                  >
                    {/* Fecha */}
                    <TPTd className="text-muted">{fmtDateTime(m.effectiveAt)}</TPTd>

                    {/* Tipo */}
                    {colVis.type !== false && (
                      <TPTd>
                        <TPBadge tone={movementTone(m.kind)}>{m.kind}</TPBadge>
                      </TPTd>
                    )}

                    {/* Comprobante */}
                    {colVis.code !== false && (
                      <TPTd className="text-muted">{s(m.code) || "—"}</TPTd>
                    )}

                    {/* Usuario */}
                    {colVis.user !== false && <TPTd>{who}</TPTd>}

                    {/* Origen / Destino */}
                    {colVis.warehouse !== false && (
                      <TPTd className="text-muted">{wh}</TPTd>
                    )}

                    {/* Gramos */}
                    {colVis.grams !== false && (
                      <TPTd className="text-right font-semibold text-text">
                        {fmtNumberSmart(grams)}
                      </TPTd>
                    )}

                    {/* Nota */}
                    {colVis.note !== false && (
                      <TPTd className="text-muted">{s(m.note) || "—"}</TPTd>
                    )}
                  </tr>
                );
              })}

              {!loading && rows.length === 0 && (
                <TPEmptyRow colSpan={7} text="No hay movimientos." />
              )}
            </TPTbody>
          </TPTableElBase>
        </TPTableXScroll>

        {/* ---- footer con conteo ---- */}
        <TPTableFooter>
          <span>
            {rows.length}{" "}
            {rows.length === 1 ? "registro" : "registros"} en esta página
            {total > 0 && ` · ${total} en total`}
          </span>
        </TPTableFooter>
      </TPTableWrap>

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

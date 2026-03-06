// src/pages/InventarioMovimientos.tsx
import React, { useEffect, useMemo, useState } from "react";

import TPSectionShell from "../components/ui/TPSectionShell";
import { TPCard } from "../components/ui/TPCard";
import TPSearchInput from "../components/ui/TPSearchInput";
import { TPButton } from "../components/ui/TPButton";
import { TPBadge } from "../components/ui/TPBadges";
import {
  TPTableWrap,
  TPTableHeader,
  TPTable,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../components/ui/TPTable";

import { cn } from "../components/ui/tp";
import { apiFetch } from "../lib/api";
import { toast } from "../lib/toast";
import { fmtNumberSmart } from "../lib/format";

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

async function fetchMovements(body: any) {
  return apiFetch("/movimientos/list", { method: "POST", body }) as Promise<{
    rows: MovementRow[];
    total: number;
    page: number;
    pageSize: number;
  }>;
}

export default function InventarioMovimientos() {
  // ✅ si venimos desde un almacén (WarehouseViewModal)
  const initialWarehouseId = useMemo(() => readQueryParam("warehouseId"), []);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [total, setTotal] = useState(0);

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<MovementKind | "">("");
  const [warehouseId, setWarehouseId] = useState<string>(initialWarehouseId);

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
        // from/to quedan listos para futuro (filtros por fecha)
        from: null,
        to: null,
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
  }, [q, kind, warehouseId]);

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
      <TPCard className="mt-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="w-full md:max-w-xl">
            <TPSearchInput
              value={q}
              onChange={setQ}
              placeholder="Buscar por nota, comprobante, usuario…"
            />
          </div>

          <div className="flex w-full flex-col gap-2 md:flex-row md:items-center md:justify-end">
            <select
              className={cn(
                "h-10 rounded-xl border border-border bg-card px-3 text-sm text-text outline-none",
                "focus:ring-2 focus:ring-primary/20"
              )}
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
            >
              <option value="">Todos</option>
              <option value="IN">Entrada</option>
              <option value="OUT">Salida</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="ADJUST">Ajuste</option>
            </select>

            <input
              className={cn(
                "h-10 w-full rounded-xl border border-border bg-card px-3 text-sm text-text outline-none md:w-[260px]",
                "focus:ring-2 focus:ring-primary/20"
              )}
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              placeholder="warehouseId (por ahora)"
            />

            <div className="text-xs text-muted md:ml-2">
              {loading ? "Cargando…" : pageInfo}
            </div>
          </div>
        </div>

        <div className="mt-3">
          <TPTableWrap>
            <TPTableHeader left={`Movimientos: ${rows.length}`} />

            <TPTable>
              <TPThead>
                <TPTr>
                  <TPTh>Fecha</TPTh>
                  <TPTh>Tipo</TPTh>
                  <TPTh>Comprobante</TPTh>
                  <TPTh>Usuario</TPTh>
                  <TPTh>Origen / Destino</TPTh>
                  <TPTh className="text-right">Gramos</TPTh>
                  <TPTh>Nota</TPTh>
                </TPTr>
              </TPThead>

              <TPTbody>
                {rows.map((m) => {
                  const who = s(m.createdBy?.name || m.createdBy?.email) || "—";

                  const wh =
                    m.kind === "TRANSFER"
                      ? `${s(m.fromWarehouse?.code || m.fromWarehouse?.name) || "—"} → ${
                          s(m.toWarehouse?.code || m.toWarehouse?.name) || "—"
                        }`
                      : s(m.warehouse?.code || m.warehouse?.name) || "—";

                  const grams = gramsForMovement(m);

                  return (
                    <TPTr
                      key={m.id}
                      className="cursor-pointer hover:bg-surface2/40"
                      onClick={() => {
                        // ✅ futuro: abrir documento del movimiento (modal o page)
                        console.log("Abrir documento movimiento:", m.id);
                      }}
                    >
                      <TPTd className="text-muted">{fmtDateTime(m.effectiveAt)}</TPTd>

                      <TPTd>
                        <TPBadge tone={movementTone(m.kind)}>{m.kind}</TPBadge>
                      </TPTd>

                      <TPTd className="text-muted">{s(m.code) || "—"}</TPTd>

                      <TPTd>{who}</TPTd>

                      <TPTd className="text-muted">{wh}</TPTd>

                      <TPTd className="text-right font-semibold text-text">
                        {fmtNumberSmart(grams)}
                      </TPTd>

                      <TPTd className="text-muted">{s(m.note) || "—"}</TPTd>
                    </TPTr>
                  );
                })}

                {!loading && rows.length === 0 && (
                  <TPEmptyRow colSpan={7} text="No hay movimientos." />
                )}
              </TPTbody>
            </TPTable>
          </TPTableWrap>
        </div>

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
      </TPCard>
    </TPSectionShell>
  );
}
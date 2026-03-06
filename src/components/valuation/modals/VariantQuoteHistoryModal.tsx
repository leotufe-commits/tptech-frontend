// src/components/valuation/modals/VariantQuoteHistoryModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, User2, Tag, X } from "lucide-react";

import { ModalShell, cn } from "../valuation.ui";
import TPDateRangeInline, { type TPDateRangeValue } from "../../ui/TPDateRangeInline";

function fmtDateTime(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("es-AR");
}

function fmtNum(v: any, digits = 6) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-AR", { maximumFractionDigits: digits });
}

function money(sym: string, v: any, digits = 6) {
  const s = String(sym || "").trim();
  const n = fmtNum(v, digits);
  return s ? `${s} ${n}` : n;
}

function toTs(v?: string) {
  if (!v) return NaN;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : NaN;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function CardRow({
  label,
  value,
  title,
  right,
  className,
}: {
  label: string;
  value: React.ReactNode;
  title?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="text-[11px] text-muted font-semibold">{label}</div>
        <div className="mt-0.5 text-sm text-text truncate" title={title}>
          {value}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function HistoryCard({ r }: { r: any }) {
  const sym = String(r?.currency?.symbol || r?.currencySymbol || "").trim();
  const code = String(r?.currency?.code || r?.currencyCode || "").trim();
  const curLabel = code ? `${code}${sym ? ` (${sym})` : ""}` : sym || "—";

  const u = r?.user;
  const userLabel = u
    ? String(u?.name || "").trim()
      ? `${String(u?.name || "").trim()}${u?.email ? ` · ${u.email}` : ""}`
      : String(u?.email || "").trim() || "—"
    : "—";

  const reason = String(r?.reason || "").trim() || "—";

  const buy = r?.finalPurchasePrice ?? r?.purchasePrice ?? r?.suggestedPrice;
  const sell = r?.finalSalePrice ?? r?.salePrice;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted font-semibold">Vigencia</div>
          <div className="mt-0.5 text-sm text-text tabular-nums whitespace-nowrap">
            {fmtDateTime(r?.effectiveAt)}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs text-muted font-semibold">Venta</div>
          <div className="mt-0.5 text-sm font-semibold text-text tabular-nums whitespace-nowrap">
            {money(sym, sell, 6)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface2 p-3">
          <CardRow
            label="Compra"
            value={<span className="font-semibold tabular-nums whitespace-nowrap">{money(sym, buy, 6)}</span>}
          />
        </div>

        <div className="rounded-xl border border-border bg-surface2 p-3">
          <CardRow label="Moneda" value={curLabel} title={curLabel} />
        </div>

        <div className="rounded-xl border border-border bg-surface2 p-3">
          <CardRow label="Tipo" value={reason} title={reason} right={<Tag size={14} className="text-muted" />} />
        </div>

        <div className="rounded-xl border border-border bg-surface2 p-3">
          <CardRow
            label="Usuario"
            value={userLabel}
            title={userLabel}
            right={<User2 size={14} className="text-muted" />}
          />
        </div>

        <div className="rounded-xl border border-border bg-surface2 p-3 sm:col-span-2">
          <CardRow label="Creado" value={<span className="tabular-nums whitespace-nowrap">{fmtDateTime(r?.createdAt)}</span>} />
        </div>
      </div>
    </div>
  );
}

export default function VariantQuoteHistoryModal({
  open,
  onClose,
  variant,
  onLoad,
}: {
  open: boolean;
  onClose: () => void;
  variant: any | null;
  onLoad: (variantId: string, take?: number) => Promise<{
    ok: boolean;
    rows: any[];
    error?: string;
    variant?: any | null;
    current?: any | null;
  }>;
}) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [serverVariant, setServerVariant] = useState<any | null>(null);

  const reqSeqRef = useRef(0);
  const dataForIdRef = useRef<string | null>(null);

  // ✅ default: último mes → hoy
  const [range, setRange] = useState<TPDateRangeValue>({ from: null, to: null });

  const title = useMemo(() => {
    const name = String(variant?.name || "Variante").trim();
    const sku = String(variant?.sku || "").trim();
    return sku ? `Detalle · ${name} (${sku})` : `Detalle · ${name}`;
  }, [variant]);

  const subtitle = useMemo(() => {
    const metalName = String(serverVariant?.metal?.name || "").trim();
    const sku = String(serverVariant?.sku || variant?.sku || "").trim();
    const vName = String(serverVariant?.name || variant?.name || "").trim();

    const left = vName ? vName : "Variante";
    const mid = sku ? `SKU ${sku}` : "";
    const right = metalName ? `Metal: ${metalName}` : "";

    return [left, mid, right].filter(Boolean).join(" · ") || "Valor actual e historial.";
  }, [variant, serverVariant]);

  const showLoading = loading || (open && !!variant?.id && dataForIdRef.current !== String(variant?.id || "") && !err);

  useEffect(() => {
    if (!open) return;
    setErr(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const id = String(variant?.id || "").trim();
    if (!id) {
      setErr("Variante inválida.");
      setRows([]);
      setServerVariant(null);
      return;
    }

    const myReq = ++reqSeqRef.current;
    let alive = true;

    (async () => {
      try {
        dataForIdRef.current = null;

        setErr(null);
        setLoading(true);
        setRows([]);
        setServerVariant(null);

        // ✅ rango default: 30 días atrás → hoy (sin horas)
        const today = startOfDay(new Date());
        const from = startOfDay(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));
        setRange({ from, to: today });

        const r = await onLoad(id, 200);

        if (!alive || myReq !== reqSeqRef.current) return;

        if (!r?.ok) {
          setErr(r?.error || "No se pudo cargar el historial.");
          setRows([]);
          setServerVariant(null);
          return;
        }

        setRows(r.rows || []);
        setServerVariant(r.variant ?? null);
        dataForIdRef.current = id;
      } catch (e: any) {
        if (!alive || myReq !== reqSeqRef.current) return;
        setErr(e?.message || "Error cargando historial.");
      } finally {
        if (!alive || myReq !== reqSeqRef.current) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, variant, onLoad]);

  // ✅ Filtrado por DÍA (ignora horas)
  const filteredRows = useMemo(() => {
    const from = range.from ? startOfDay(range.from).getTime() : null;
    const to = range.to ? endOfDay(range.to).getTime() : null;

    if (!from && !to) return rows;

    return (rows || []).filter((r: any) => {
      const t = toTs(r?.effectiveAt) || toTs(r?.createdAt);
      if (!Number.isFinite(t)) return false;
      if (from != null && t < from) return false;
      if (to != null && t > to) return false;
      return true;
    });
  }, [rows, range]);

  const current = useMemo(() => {
    const list = filteredRows || [];
    if (!list.length) return null;

    return [...list].sort((a: any, b: any) => {
      const ta = toTs(a?.effectiveAt) || toTs(a?.createdAt) || -Infinity;
      const tb = toTs(b?.effectiveAt) || toTs(b?.createdAt) || -Infinity;
      return tb - ta;
    })[0];
  }, [filteredRows]);

  const curSym = String(current?.currency?.symbol || current?.currencySymbol || "").trim();
  const curCode = String(current?.currency?.code || current?.currencyCode || "").trim();
  const curLabel = curCode ? `${curCode}${curSym ? ` (${curSym})` : ""}` : curSym || "—";

  const currentEdited = fmtDateTime(current?.effectiveAt || current?.createdAt);

  const currentUserLabel = useMemo(() => {
    const u = current?.user;
    if (!u) return "—";
    const name = String(u?.name || "").trim();
    const email = String(u?.email || "").trim();
    return name ? `${name}${email ? ` · ${email}` : ""}` : email || "—";
  }, [current]);

  const currentReason = String(current?.reason || "").trim() || "—";

  return (
    <ModalShell
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      busy={false}
      maxWidth="4xl"
      footer={
        <button
          type="button"
          className="tp-btn-secondary h-10 inline-flex items-center gap-2"
          onClick={onClose}
          disabled={showLoading}
        >
          <X size={16} />
          Cerrar
        </button>
      }
    >
      <div className="w-full min-w-0">
        {err && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">
            {err}
          </div>
        )}

        {showLoading ? (
          <div className="p-6 text-center text-sm text-muted">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Cargando…
          </div>
        ) : (
          <>
            {/* Card “valor actual” */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="text-xs text-muted text-center">Venta actual</div>

              <div className="mt-2 flex items-center justify-center">
                <div className="rounded-2xl border border-border bg-surface2 px-6 py-5 text-center">
                  <div className="text-4xl font-semibold text-text tabular-nums whitespace-nowrap">
                    {current?.finalSalePrice != null
                      ? money(curSym, current.finalSalePrice, 6)
                      : current?.salePrice != null
                      ? money(curSym, current.salePrice, 6)
                      : "—"}
                  </div>

                  <div className="mt-2 text-xs text-muted tabular-nums whitespace-nowrap">
                    Compra:{" "}
                    <span className="text-text font-semibold">
                      {current?.finalPurchasePrice != null
                        ? money(curSym, current.finalPurchasePrice, 6)
                        : current?.purchasePrice != null
                        ? money(curSym, current.purchasePrice, 6)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="text-xs text-muted font-semibold">Última edición</div>
                  <div className="mt-1 text-text tabular-nums whitespace-nowrap">{current ? currentEdited : "—"}</div>
                </div>

                <div className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="text-xs text-muted font-semibold">Moneda</div>
                  <div className="mt-1 text-text truncate" title={curLabel}>
                    {current ? curLabel : "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="text-xs text-muted font-semibold inline-flex items-center gap-2">
                    <User2 size={14} /> Creado por
                  </div>
                  <div className="mt-1 text-text truncate" title={currentUserLabel}>
                    {current ? currentUserLabel : "—"}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-surface2 p-3">
                  <div className="text-xs text-muted font-semibold inline-flex items-center gap-2">
                    <Tag size={14} /> Tipo
                  </div>
                  <div className="mt-1 text-text truncate" title={currentReason}>
                    {current ? currentReason : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Historial + filtro */}
            <div className="mt-6 min-w-0">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-muted">Historial</div>
                  <div className="text-[11px] text-muted">Filtra por vigencia (effectiveAt). Si falta, se usa creado.</div>
                </div>

                <div className="w-full lg:w-[560px]">
                  <TPDateRangeInline
                    value={range}
                    onChange={setRange}
                    showPresets
                    presets={[1, 7, 30]}
                    mode="auto"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="mt-3">
                {filteredRows.length === 0 ? (
                  <div className="text-sm text-muted">Sin historial para el filtro actual.</div>
                ) : (
                  <div className="max-w-full">
                    {/* ✅ scroll vertical cómodo dentro del modal */}
                    <div
                      className={cn("max-h-[42vh] overflow-y-auto overscroll-contain touch-pan-y rounded-2xl")}
                      style={{ WebkitOverflowScrolling: "touch" as any }}
                    >
                      <div className="space-y-3">
                        {filteredRows.map((r: any) => (
                          <HistoryCard key={String(r?.id || `${r?.effectiveAt}-${r?.createdAt}`)} r={r} />
                        ))}
                      </div>
                    </div>

                    <div
                      className={cn(
                        "flex items-center justify-between border-t border-border bg-surface2/30 px-5 py-3 text-xs text-muted"
                      )}
                    >
                      <div>
                        {filteredRows.length} registro{filteredRows.length === 1 ? "" : "s"}
                      </div>
                      <div className="min-w-0 text-right">
                        Actual:{" "}
                        <span className="text-text font-semibold tabular-nums whitespace-nowrap">
                          {current ? `${curLabel} · ${money(curSym, current?.finalSalePrice ?? current?.salePrice, 6)}` : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 text-[11px] text-muted">
                  Tip: el filtro aplica por día (sin horas). Usa Vigencia y si falta, Creado.
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}
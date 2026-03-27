// src/pages/InventarioArticulosMovimientos.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";

import TPSectionShell from "../components/ui/TPSectionShell";
import TPSelect from "../components/ui/TPSelect";
import { TPButton } from "../components/ui/TPButton";
import { TPBadge } from "../components/ui/TPBadges";
import { type SortDir } from "../components/ui/TPSort";
import TPDateRangeInline, { type TPDateRangeValue } from "../components/ui/TPDateRangeInline";
import { TPTd } from "../components/ui/TPTable";
import { TPTableKit, type TPColDef } from "../components/ui/TPTableKit";
import { TPField } from "../components/ui/TPField";
import TPInput from "../components/ui/TPInput";
import TPNumberInput from "../components/ui/TPNumberInput";
import Modal from "../components/ui/Modal";

import { apiFetch } from "../lib/api";
import { toast } from "../lib/toast";

import {
  articleMovementsApi,
  type ArticleMovementKind,
  type ArticleMovementRow,
  type CreateMovementLine,
} from "../services/article-movements";
import {
  articlesApi,
  variantLabel,
  type ArticleRow,
  type ArticleVariant,
} from "../services/articles";

/* =========================================================
   Column definitions
========================================================= */
const COL_KEY = "tptech_col_art_movimientos";

const COLS: TPColDef[] = [
  { key: "date",      label: "Fecha",            canHide: false, sortKey: "date" },
  { key: "type",      label: "Tipo",             sortKey: "type" },
  { key: "code",      label: "Comprobante",      sortKey: "code" },
  { key: "user",      label: "Usuario" },
  { key: "warehouse", label: "Almacén" },
  { key: "articles",  label: "Artículos" },
  { key: "note",      label: "Nota" },
];

/* =========================================================
   Helpers
========================================================= */
type SortCol = "date" | "code" | "type";

function s(v: any) { return String(v ?? "").trim(); }

function fmtDateTime(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-AR");
}

function dateToIso(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function movementTone(kind: string) {
  switch (kind) {
    case "IN":       return "success";
    case "OUT":      return "danger";
    case "TRANSFER": return "info";
    case "ADJUST":   return "warning";
    case "OPENING":  return "neutral";
    default:         return "neutral";
  }
}

function movementLabel(kind: ArticleMovementKind) {
  const MAP: Record<ArticleMovementKind, string> = {
    IN: "Entrada", OUT: "Salida", TRANSFER: "Transferencia", ADJUST: "Ajuste", OPENING: "Apertura",
  };
  return MAP[kind] ?? kind;
}


/* =========================================================
   Types para el modal nuevo movimiento
========================================================= */
type WarehouseOption = { id: string; name: string; code: string };

type DraftLine = {
  /* artículo seleccionado */
  articleId: string;
  articleName: string;
  articleCode: string;
  variantId: string | null;
  quantity: number | null;
  variants: ArticleVariant[];
  /* buscador inline */
  searchQ: string;
  searchResults: ArticleRow[];
  searching: boolean;
  showDropdown: boolean;
};

const EMPTY_LINE: DraftLine = {
  articleId:     "",
  articleName:   "",
  articleCode:   "",
  variantId:     null,
  quantity:      null,
  variants:      [],
  searchQ:       "",
  searchResults: [],
  searching:     false,
  showDropdown:  false,
};

/* =========================================================
   Componente principal
========================================================= */
export default function InventarioArticulosMovimientos() {
  /* ---- lista ---- */
  const [loading, setLoading] = useState(false);
  const [rows, setRows]       = useState<ArticleMovementRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const pageSize = 30;

  /* ---- filtros ---- */
  const [q,         setQ]         = useState("");
  const [kind,      setKind]      = useState<ArticleMovementKind | "">("");
  const [dateRange, setDateRange] = useState<TPDateRangeValue>({ from: null, to: null });

  /* ---- sort ---- */
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(col: SortCol) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  /* ---- datos comunes ---- */
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  /* ---- modal nuevo movimiento ---- */
  const [showModal, setShowModal] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [mvKind,        setMvKind]        = useState<Exclude<ArticleMovementKind, "TRANSFER" | "OPENING">>("IN");
  const [mvWarehouseId, setMvWarehouseId] = useState("");
  const [mvDate,        setMvDate]        = useState(() => new Date().toISOString().slice(0, 10));
  const [mvNote,        setMvNote]        = useState("");
  const [lines,         setLines]         = useState<DraftLine[]>([{ ...EMPTY_LINE }]);

  /* debounce timers por línea */
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
  }, [page, q, kind, dateRange]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => { setPage(1); }, [q, kind, dateRange]);

  /* ---- cargar almacenes al montar ---- */
  useEffect(() => {
    apiFetch<WarehouseOption[]>("/warehouses", { method: "GET" })
      .then((list) => {
        const active = (list ?? []).filter((w: any) => w.isActive && !w.deletedAt);
        setWarehouses(active);
      })
      .catch(() => {});
  }, []);

  /* ---- sort cliente ---- */
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date")  cmp = new Date(a.effectiveAt).getTime() - new Date(b.effectiveAt).getTime();
      if (sortCol === "code")  cmp = s(a.code).localeCompare(s(b.code), "es");
      if (sortCol === "type")  cmp = a.kind.localeCompare(b.kind, "es");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortCol, sortDir]);

  const pageInfo = useMemo(() => {
    const from = (page - 1) * pageSize + 1;
    const to   = Math.min(page * pageSize, total);
    if (total <= 0) return "—";
    return `${from}-${to} de ${total}`;
  }, [page, pageSize, total]);

  /* ------------------------------------------------------------------ */
  /* Lógica del modal                                                     */
  /* ------------------------------------------------------------------ */
  function openModal() {
    setMvKind("IN");
    setMvWarehouseId(warehouses[0]?.id ?? "");
    setMvDate(new Date().toISOString().slice(0, 10));
    setMvNote("");
    setLines([{ ...EMPTY_LINE }]);
    setSubmitted(false);
    setShowModal(true);
  }

  /* Búsqueda de artículo con debounce por línea */
  function handleLineSearch(idx: number, q: string) {
    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], searchQ: q, showDropdown: true };
      return copy;
    });

    clearTimeout(searchTimers.current[idx]);
    if (!q.trim()) {
      setLines((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], searchResults: [], searching: false };
        return copy;
      });
      return;
    }

    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], searching: true };
      return copy;
    });

    searchTimers.current[idx] = setTimeout(async () => {
      try {
        const res = await articlesApi.list({
          q: q.trim(),
          take: 12,
          status: "ACTIVE",
          stockMode: "BY_ARTICLE",
        });
        setLines((prev) => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], searchResults: res.rows ?? [], searching: false };
          return copy;
        });
      } catch {
        setLines((prev) => {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], searchResults: [], searching: false };
          return copy;
        });
      }
    }, 280);
  }

  /* Seleccionar artículo desde el dropdown */
  async function selectArticle(idx: number, article: ArticleRow) {
    // Carga detalle para obtener variantes con attributeValues
    let variants: ArticleVariant[] = [];
    try {
      const detail = await articlesApi.getOne(article.id);
      variants = (detail.variants ?? []).filter(v => v.isActive);
    } catch {
      variants = [];
    }

    setLines((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        articleId:    article.id,
        articleName:  article.name,
        articleCode:  article.code,
        variantId:    null,
        variants,
        searchQ:      "",
        searchResults: [],
        searching:    false,
        showDropdown: false,
      };
      return copy;
    });
  }

  /* Limpiar artículo seleccionado en una línea */
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

  function addLine() {
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSubmitted(true);

    if (!mvWarehouseId) return;
    if (!mvDate) return;
    if (lines.length === 0) return;
    if (lines.some(l => !l.articleId)) return;
    if (lines.some(l => l.quantity == null || l.quantity === 0)) return;
    // Si el artículo tiene variantes activas, variantId obligatorio
    if (lines.some(l => l.variants.length > 0 && !l.variantId)) return;

    setSaving(true);
    try {
      const payload: CreateMovementLine[] = lines.map(l => ({
        articleId: l.articleId,
        variantId: l.variantId || null,
        quantity: l.quantity!,
      }));

      await articleMovementsApi.create({
        kind: mvKind,
        warehouseId: mvWarehouseId,
        effectiveAt: new Date(mvDate).toISOString(),
        note: mvNote,
        lines: payload,
      });

      toast.success("Movimiento registrado.");
      setShowModal(false);
      void refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  /* ================================================================== */
  return (
    <TPSectionShell
      title="Movimientos de artículos"
      subtitle="Entradas, salidas y ajustes de stock de artículos."
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
              onChange={(v) => setKind(v as ArticleMovementKind | "")}
              options={[
                { value: "",        label: "Todos los tipos" },
                { value: "IN",      label: "Entrada" },
                { value: "OUT",     label: "Salida" },
                { value: "ADJUST",  label: "Ajuste" },
              ]}
            />
            <div className="text-xs text-muted whitespace-nowrap">
              {loading ? "Cargando…" : pageInfo}
            </div>
            <TPButton iconLeft={<Plus size={14} />} onClick={openModal}>
              Nuevo movimiento
            </TPButton>
          </div>
        }
        renderRow={(m, vis) => {
          const who = s(m.createdBy?.name ?? m.createdBy?.email) || "—";
          const wh  = s(m.warehouse?.code ?? m.warehouse?.name) || "—";
          const articlesSummary = (m.lines ?? [])
            .map(l => {
              const name    = l.article?.name ?? l.articleId;
              const variant = l.variant ? ` (${l.variant.name})` : "";
              return `${name}${variant} ×${Number(l.quantity).toLocaleString("es-AR")}`;
            })
            .join(", ");

          return (
            <tr key={m.id} className="border-b border-border hover:bg-surface2/40 transition-colors">
              {vis.date      && <TPTd className="text-muted">{fmtDateTime(m.effectiveAt)}</TPTd>}
              {vis.type      && <TPTd><TPBadge tone={movementTone(m.kind)}>{movementLabel(m.kind)}</TPBadge></TPTd>}
              {vis.code      && <TPTd className="text-muted font-mono text-xs">{s(m.code) || "—"}</TPTd>}
              {vis.user      && <TPTd>{who}</TPTd>}
              {vis.warehouse && <TPTd className="text-muted">{wh}</TPTd>}
              {vis.articles  && <TPTd className="text-xs text-muted max-w-xs truncate">{articlesSummary || "—"}</TPTd>}
              {vis.note      && <TPTd className="text-muted">{s(m.note) || "—"}</TPTd>}
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

      {/* ================================================================
          Modal nuevo movimiento
      ================================================================ */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Nuevo movimiento de artículos"
        footer={
          <div className="flex justify-end gap-2">
            <TPButton variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>
              Cancelar
            </TPButton>
            <TPButton onClick={() => void handleSave()} loading={saving}>
              Registrar
            </TPButton>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Tipo + Almacén */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TPField label="Tipo" required>
              <TPSelect
                value={mvKind}
                onChange={(v) => setMvKind(v as typeof mvKind)}
                options={[
                  { value: "IN",     label: "Entrada" },
                  { value: "OUT",    label: "Salida" },
                  { value: "ADJUST", label: "Ajuste" },
                ]}
              />
            </TPField>

            <TPField label="Almacén" required error={submitted && !mvWarehouseId ? "Seleccioná un almacén." : null}>
              <TPSelect
                value={mvWarehouseId}
                onChange={setMvWarehouseId}
                options={warehouses.map(w => ({ value: w.id, label: `${w.code} — ${w.name}` }))}
              />
            </TPField>
          </div>

          {/* Fecha + Nota */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <TPField label="Fecha" required>
              <TPInput type="date" value={mvDate} onChange={setMvDate} />
            </TPField>
            <TPField label="Nota">
              <TPInput value={mvNote} onChange={setMvNote} placeholder="Observaciones (opcional)" />
            </TPField>
          </div>

          {/* Líneas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-text">Artículos</p>
              <TPButton variant="ghost" iconLeft={<Plus size={13} />} onClick={addLine}>
                Agregar línea
              </TPButton>
            </div>

            {submitted && lines.length === 0 && (
              <p className="text-xs text-red-500">Agregá al menos una línea.</p>
            )}

            {lines.map((line, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-surface2/20 p-3 space-y-3">

                {/* ── Buscador de artículo ── */}
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    {line.articleId ? (
                      /* Artículo seleccionado → pill con botón clear */
                      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text truncate">{line.articleName}</p>
                          <p className="text-xs text-muted">{line.articleCode}</p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 h-5 w-5 rounded grid place-items-center text-muted hover:text-red-400 transition"
                          onClick={() => clearArticle(idx)}
                          title="Cambiar artículo"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      /* Campo de búsqueda con dropdown */
                      <div className="relative">
                        <TPField
                          label="Artículo"
                          required
                          error={submitted && !line.articleId ? "Seleccioná un artículo." : null}
                        >
                          <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                            <TPInput
                              value={line.searchQ}
                              onChange={(v) => handleLineSearch(idx, v)}
                              onFocus={() => setLineField(idx, "showDropdown", true as any)}
                              onBlur={() => {
                                // Delay para permitir click en dropdown
                                setTimeout(() => setLineField(idx, "showDropdown", false as any), 180);
                              }}
                              placeholder="Buscar por nombre, código o SKU…"
                              className="pl-8"
                            />
                          </div>
                        </TPField>

                        {/* Dropdown de resultados */}
                        {line.showDropdown && (line.searchQ.trim() || line.searchResults.length > 0) && (
                          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                            {line.searching && (
                              <div className="px-4 py-3 text-xs text-muted">Buscando…</div>
                            )}
                            {!line.searching && line.searchResults.length === 0 && line.searchQ.trim() && (
                              <div className="px-4 py-3 text-xs text-muted">Sin resultados.</div>
                            )}
                            {!line.searching && line.searchResults.map(art => (
                              <button
                                key={art.id}
                                type="button"
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface2 transition-colors"
                                onMouseDown={(e) => { e.preventDefault(); void selectArticle(idx, art); }}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-text truncate">{art.name}</p>
                                  <p className="text-xs text-muted">{art.code}{art.sku ? ` · ${art.sku}` : ""}</p>
                                </div>
                                {art.category && (
                                  <span className="shrink-0 text-[10px] text-muted border border-border rounded px-1.5 py-0.5">
                                    {art.category.name}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Cantidad */}
                  <div className="w-28 shrink-0">
                    <TPField
                      label="Cantidad"
                      required
                      error={submitted && (line.quantity == null || line.quantity === 0) ? "Requerido." : null}
                    >
                      <TPNumberInput
                        value={line.quantity}
                        onChange={(v: number | null) => setLineField(idx, "quantity", v)}
                        min={mvKind === "ADJUST" ? undefined : 1}
                        step={1}
                      />
                    </TPField>
                  </div>

                  {/* Eliminar línea */}
                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="mt-6 h-8 w-8 rounded grid place-items-center text-muted hover:text-red-400 hover:bg-surface2 transition"
                      onClick={() => removeLine(idx)}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* ── Selector de variante (solo si el artículo tiene variantes activas) ── */}
                {line.articleId && line.variants.length > 0 && (
                  <TPField
                    label="Variante"
                    required
                    error={submitted && !line.variantId ? "Seleccioná una variante." : null}
                  >
                    <TPSelect
                      value={line.variantId ?? ""}
                      onChange={(v) => setLineField(idx, "variantId", v || null)}
                      options={[
                        { value: "", label: "Seleccioná una variante…" },
                        ...line.variants.map(v => ({
                          value: v.id,
                          label: variantLabel(v),
                        })),
                      ]}
                    />
                  </TPField>
                )}

                {/* Aviso: artículo sin variantes */}
                {line.articleId && line.variants.length === 0 && (
                  <p className="text-xs text-muted opacity-70">
                    Este artículo no tiene variantes activas — el stock se registra a nivel de artículo.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </TPSectionShell>
  );
}

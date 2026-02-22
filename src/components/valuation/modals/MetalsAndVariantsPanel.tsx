// src/components/valuation/modals/MetalsAndVariantsPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Eye,
  Loader2,
  Pencil,
  Plus,
  ShieldBan,
  ShieldCheck,
  Star,
  Trash2,
} from "lucide-react";

import type { MetalRow, VariantRow } from "../../../hooks/useValuation";
import { cn, norm, Pill, ModalShell } from "../valuation.ui";

import { SortArrows } from "../../ui/TPSort";
import { TPButton } from "../../ui/TPButton";
import { TPSearchInput } from "../../ui/TPSearchInput";
import {
  TPTableWrap,
  TPTableEl,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../../ui/TPTable";

function fmtNum(n: any, digits = 6) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("es-AR", { maximumFractionDigits: digits });
}

function fmtMoney(symbol: string, n: any, digits = 6) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const s = String(symbol || "").trim();
  const num = v.toLocaleString("es-AR", { maximumFractionDigits: digits });
  return s ? `${s} ${num}` : num;
}

function toNum(v: any, fallback = NaN) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ✅ sort variantes
type VarSortKey = "name" | "purity" | "suggested" | "sell" | "status";
type VarSortDir = "asc" | "desc";

function IconBtn({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TPButton
      variant="secondary"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-9 w-9 !p-0 grid place-items-center"
    >
      {children}
    </TPButton>
  );
}

export default function MetalsAndVariantsPanel({
  loading,
  saving,
  metals,

  baseCurrencySymbol,

  getVariants,
  createVariant: _createVariant, // compat (no se usa acá)
  toggleVariantActive,
  setFavoriteVariant,

  onOpenMetalCreate,
  onOpenVariantCreate,
  onSelectedMetalChange,

  onOpenMetalEdit,
  onToggleMetal,
  onDeleteMetal,

  onMoveMetal,
  getMetalRefHistory,

  onDeleteVariant,

  // ✅ abrir view / edit de variante
  onOpenVariantView,
  onOpenVariantEdit,
}: {
  loading: boolean;
  saving: boolean;
  metals: MetalRow[];

  baseCurrencySymbol?: string;

  getVariants: (
    metalId: string,
    params?: { q?: string; isActive?: boolean; onlyFavorites?: boolean }
  ) => Promise<{ ok: boolean; rows: VariantRow[]; error?: string }>;

  createVariant: (data: { metalId: string; name: string; sku: string; purity: number }) => Promise<{
    ok: boolean;
    error?: string;
  }>;

  toggleVariantActive: (variantId: string, isActive: boolean) => Promise<{ ok: boolean; error?: string }>;

  /**
   * ✅ permitir null para "dejar sin favorito".
   * - string => setear favorito
   * - null => limpiar favorito del metal
   */
  setFavoriteVariant: (variantId: string | null) => Promise<{ ok: boolean; error?: string }>;

  onOpenMetalCreate: () => void;
  onOpenVariantCreate: () => void;

  onSelectedMetalChange?: (metalId: string, metalName: string, metalReferenceValue?: number | null) => void;

  onOpenMetalEdit?: (metal: MetalRow) => void;
  onToggleMetal?: (metalId: string, isActive: boolean) => Promise<{ ok: boolean; error?: string }>;
  onDeleteMetal?: (metal: MetalRow) => Promise<{ ok: boolean; error?: string }>;

  onMoveMetal?: (metalId: string, dir: "UP" | "DOWN") => Promise<{ ok: boolean; error?: string }>;
  getMetalRefHistory?: (
    metalId: string,
    take?: number
  ) => Promise<{
    ok: boolean;
    metal?: MetalRow;
    current?: any;
    history?: Array<{
      id: string;
      referenceValue: number;
      effectiveAt: string;
      createdAt: string;
      user: { id: string; name: string | null; email: string } | null;
    }>;
    error?: string;
  }>;

  onDeleteVariant?: (variant: VariantRow) => Promise<{ ok: boolean; error?: string }>;

  onOpenVariantView?: (variant: VariantRow) => void;
  onOpenVariantEdit?: (variant: VariantRow) => void;
}) {
  const [qMetal, setQMetal] = useState("");
  const [selectedMetalId, setSelectedMetalId] = useState("");

  const selectedMetal = useMemo(
    () => metals.find((m: any) => m.id === selectedMetalId) ?? null,
    [metals, selectedMetalId]
  );

  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantsErr, setVariantsErr] = useState<string | null>(null);

  const [qVar, setQVar] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);

  const [varSortKey, setVarSortKey] = useState<VarSortKey>("name");
  const [varSortDir, setVarSortDir] = useState<VarSortDir>("asc");

  // Historial ref value (metal)
  const [refHistOpen, setRefHistOpen] = useState(false);
  const [refHistLoading, setRefHistLoading] = useState(false);
  const [refHistErr, setRefHistErr] = useState<string | null>(null);
  const [refHistRows, setRefHistRows] = useState<
    Array<{
      id: string;
      referenceValue: number;
      effectiveAt: string;
      createdAt: string;
      user: { id: string; name: string | null; email: string } | null;
    }>
  >([]);
  const [refHistMetal, setRefHistMetal] = useState<MetalRow | null>(null);

  useEffect(() => {
    if (selectedMetalId) return;
    if (!metals.length) return;
    setSelectedMetalId((metals[0] as any).id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metals.length]);

  useEffect(() => {
    if (!selectedMetalId) return;
    const m: any = metals.find((x: any) => x.id === selectedMetalId);
    if (!m) return;

    onSelectedMetalChange?.(m.id, m.name, (m as any)?.referenceValue ?? null);
  }, [selectedMetalId, metals, onSelectedMetalChange]);

  const metalsFiltered = useMemo(() => {
    const s = norm(qMetal);

    const list = [...metals].sort((a: any, b: any) => {
      const ao = Number((a as any).sortOrder ?? 0);
      const bo = Number((b as any).sortOrder ?? 0);
      if (ao !== bo) return ao - bo;
      return String((a as any).name || "").localeCompare(String((b as any).name || ""));
    });

    return s ? list.filter((m: any) => norm(m.name).includes(s) || norm(m.symbol).includes(s)) : list;
  }, [metals, qMetal]);

  async function loadVariants() {
    if (!selectedMetalId) return;
    setVariantsErr(null);

    try {
      setVariantsLoading(true);
      const r = await getVariants(selectedMetalId, {
        q: qVar.trim() || undefined,
        onlyFavorites: onlyFav || undefined,
      });

      if (!r.ok) {
        setVariantsErr(r.error || "No se pudieron cargar las variantes.");
        setVariants([]);
        return;
      }
      setVariants(r.rows || []);
    } finally {
      setVariantsLoading(false);
    }
  }

  useEffect(() => {
    void loadVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMetalId, qVar, onlyFav]);

  function toggleVarSort(nextKey: VarSortKey) {
    if (varSortKey === nextKey) {
      setVarSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setVarSortKey(nextKey);
    setVarSortDir(nextKey === "status" ? "desc" : "asc");
  }

  // ✅ precios
  const ref = toNum((selectedMetal as any)?.referenceValue, NaN);

  function suggestedOf(v: any) {
    const s = toNum((v as any)?.suggestedPrice, NaN);
    if (Number.isFinite(s)) return s;

    const p = toNum((v as any)?.purity, NaN);
    if (!Number.isFinite(ref) || !Number.isFinite(p)) return NaN;
    if (p <= 0 || p > 1) return NaN;
    return ref * p;
  }

  function finalSellOf(v: any) {
    const n = toNum((v as any)?.finalSalePrice, NaN);
    if (Number.isFinite(n)) return n;

    const sug = suggestedOf(v);
    const sf = toNum((v as any)?.saleFactor, 1);
    if (!Number.isFinite(sug) || !Number.isFinite(sf)) return NaN;
    return sug * sf;
  }

  function pricingModeOf(v: any) {
    const mode = String((v as any)?.pricingMode || "").toUpperCase();
    if (mode === "OVERRIDE") return "Manual";
    return "Auto";
  }

  function leyOf(purity: any) {
    const p = toNum(purity, NaN);
    if (!Number.isFinite(p) || p <= 0) return "—";
    return String(Math.round(p * 1000));
  }

  const variantsList = useMemo(() => {
    const rows = [...(variants || [])];
    const dir = varSortDir === "asc" ? 1 : -1;

    rows.sort((a: any, b: any) => {
      if (varSortKey === "name") return dir * String(a.name || "").localeCompare(String(b.name || ""));
      if (varSortKey === "purity") return dir * (Number(a.purity || 0) - Number(b.purity || 0));
      if (varSortKey === "suggested") return dir * (suggestedOf(a) - suggestedOf(b));
      if (varSortKey === "sell") return dir * (finalSellOf(a) - finalSellOf(b));
      const aa = a.isActive !== false ? 1 : 0;
      const bb = b.isActive !== false ? 1 : 0;
      return dir * (aa - bb);
    });

    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variants, varSortKey, varSortDir, selectedMetalId]);

  async function onToggleVariant(row: VariantRow) {
    const next = !(row as any).isActive;
    const r = await toggleVariantActive(row.id, next);
    if (r.ok) await loadVariants();
    return r;
  }

  async function onFavorite(row: VariantRow) {
    // ✅ si ya es favorita => limpiar (que no quede ninguna)
    const isFav = !!(row as any).isFavorite;
    const r = await setFavoriteVariant(isFav ? null : row.id);
    if (r.ok) await loadVariants();
    return r;
  }

  async function onToggleMetalClick(e: React.MouseEvent, m: MetalRow) {
    e.stopPropagation();
    if (!onToggleMetal) return;
    const next = !(m as any).isActive;
    await onToggleMetal((m as any).id, next);
  }

  async function onEditMetalClick(e: React.MouseEvent, m: MetalRow) {
    e.stopPropagation();
    onOpenMetalEdit?.(m);
  }

  async function onDeleteMetalClick(e: React.MouseEvent, m: MetalRow) {
    e.stopPropagation();
    if (!onDeleteMetal) return;
    await onDeleteMetal(m);
  }

  async function onMoveMetalClick(e: React.MouseEvent, m: MetalRow, dir: "UP" | "DOWN") {
    e.stopPropagation();
    if (!onMoveMetal) return;
    await onMoveMetal((m as any).id, dir);
  }

  async function openRefHistory(e: React.MouseEvent, m: MetalRow) {
    e.stopPropagation();
    setRefHistMetal(m);

    if (!getMetalRefHistory) {
      setRefHistErr("Falta conectar getMetalRefHistory en el frontend.");
      setRefHistRows([]);
      setRefHistOpen(true);
      return;
    }

    setRefHistErr(null);
    setRefHistRows([]);
    setRefHistOpen(true);

    setRefHistLoading(true);
    try {
      const r = await getMetalRefHistory((m as any).id, 80);
      if (!r?.ok) {
        setRefHistErr(r?.error || "No se pudo cargar el historial.");
        setRefHistRows([]);
      } else {
        setRefHistRows((r.history as any) || []);
      }
    } finally {
      setRefHistLoading(false);
    }
  }

  async function onAskDeleteVariant(row: VariantRow) {
    if (!onDeleteVariant) return;
    if (saving || variantsLoading) return;
    await onDeleteVariant(row);
    await loadVariants();
  }

  function symbolText(m: any) {
    const s = String(m?.symbol || "").trim();
    if (s) return s;
    const nm = String(m?.name || "").trim();
    return nm ? nm.slice(0, 2).toUpperCase() : "—";
  }

  const baseSym = String(baseCurrencySymbol || "").trim();

  const VarSortBtn = ({ k, label }: { k: VarSortKey; label: string }) => {
    const active = varSortKey === k;
    return (
      <button
        type="button"
        onClick={() => toggleVarSort(k)}
        className={cn("inline-flex items-center gap-1.5 select-none hover:text-text transition")}
        title="Ordenar"
      >
        <span>{label}</span>
        <SortArrows dir={varSortDir} active={active} />
      </button>
    );
  };

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow)" }}>
        <div className="min-w-0">
          <div className="text-sm text-muted">Configuración</div>
          <div className="text-lg font-bold text-text">Metales</div>
          <div className="text-sm text-muted">Metales + variantes + precios (por gramo).</div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[420px,1fr]">
          {/* LEFT: Metales */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-bold text-text">Listado</div>
                <div className="text-sm text-muted">Seleccioná un metal para ver sus variantes.</div>
              </div>

              <TPButton variant="primary" onClick={onOpenMetalCreate} disabled={saving} iconLeft={<Plus size={16} />}>
                Nuevo
              </TPButton>
            </div>

            <div className="mt-4">
              <TPSearchInput
                value={qMetal}
                onChange={setQMetal}
                placeholder="Buscar (nombre / símbolo)…"
                disabled={saving}
                className="h-11"
              />
            </div>

            <div className="mt-4 space-y-2">
              {loading ? (
                <div className="p-6 text-center text-sm text-muted">
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Cargando…
                </div>
              ) : metalsFiltered.length === 0 ? (
                <div className="p-4 text-sm text-muted">No hay metales cargados.</div>
              ) : (
                metalsFiltered.map((m: any, idx: number) => {
                  const active = m.id === selectedMetalId;
                  const isActive = m.isActive !== false;

                  const refv = m.referenceValue;
                  const refText = Number.isFinite(Number(refv)) ? fmtMoney(baseSym, refv, 2) : "—";

                  const canUp = idx > 0;
                  const canDown = idx < metalsFiltered.length - 1;

                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMetalId(m.id)}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left transition relative",
                        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                        active
                          ? "border-primary/50 bg-surface2 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
                          : "border-border bg-card hover:bg-surface2"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <div className="absolute right-3 top-3">
                        {isActive ? <Pill tone="ok">Activo</Pill> : <Pill tone="off">Inactivo</Pill>}
                      </div>

                      <div className="flex items-start gap-3 min-w-0 pr-14">
                        <div
                          className={cn(
                            "grid h-10 w-10 place-items-center rounded-xl border bg-bg font-bold shrink-0",
                            active ? "border-primary/40 text-primary" : "border-border text-primary"
                          )}
                          title={String(m.symbol || "")}
                        >
                          <span className="text-sm">{symbolText(m)}</span>
                        </div>

                        <div className="min-w-0">
                          <div className="font-semibold text-text truncate">{m.name}</div>

                          <div className="mt-1 text-xs text-muted flex items-center gap-1 whitespace-nowrap">
                            <span>Valor ref.:</span>
                            <span className="font-semibold text-text tabular-nums">{refText}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <IconBtn
                            title="Subir"
                            onClick={(e) => onMoveMetalClick(e, m, "UP")}
                            disabled={saving || !onMoveMetal || !canUp}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </IconBtn>

                          <IconBtn
                            title="Bajar"
                            onClick={(e) => onMoveMetalClick(e, m, "DOWN")}
                            disabled={saving || !onMoveMetal || !canDown}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </IconBtn>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          <IconBtn title="Ver historial valor ref." onClick={(e) => void openRefHistory(e, m)} disabled={saving}>
                            <Eye className="h-4 w-4" />
                          </IconBtn>

                          <IconBtn title="Editar" onClick={(e) => onEditMetalClick(e, m)} disabled={saving}>
                            <Pencil className="h-4 w-4" />
                          </IconBtn>

                          <IconBtn
                            title={isActive ? "Desactivar" : "Activar"}
                            onClick={(e) => onToggleMetalClick(e, m)}
                            disabled={saving}
                          >
                            {isActive ? <ShieldBan className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                          </IconBtn>

                          <IconBtn title="Eliminar" onClick={(e) => onDeleteMetalClick(e, m)} disabled={saving}>
                            <Trash2 className="h-4 w-4" />
                          </IconBtn>

                          <ChevronRight size={18} className={cn(active ? "text-text" : "text-muted")} />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Variantes */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="min-w-0 text-left">
              <div className="text-lg font-bold text-text truncate text-left">
                Variantes {selectedMetal ? <>— {selectedMetal.name}</> : null}
              </div>
              <div className="text-sm text-muted mt-0.5 text-left">Pureza/Ley + valores + estado.</div>
            </div>

            {/* ✅ Search + ⭐ + Nueva variante alineados, mismo alto */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <TPSearchInput
                  value={qVar}
                  onChange={setQVar}
                  placeholder="Buscar (SKU / nombre)…"
                  disabled={saving || !selectedMetalId}
                  className="h-11"
                />
              </div>

              <div className="ml-auto flex items-center gap-2 shrink-0">
                <TPButton
                  variant="secondary"
                  onClick={() => setOnlyFav((vv) => !vv)}
                  disabled={saving || !selectedMetalId}
                  title={onlyFav ? "Mostrando favoritas" : "Mostrar solo favoritas"}
                  className="h-11 w-11 !p-0 grid place-items-center"
                >
                  <Star
                    size={16}
                    className={cn(
                      "stroke-current",
                      onlyFav ? "fill-current text-yellow-400" : "fill-transparent text-text/80"
                    )}
                  />
                </TPButton>

                <TPButton
                  variant="primary"
                  onClick={onOpenVariantCreate}
                  disabled={saving || !selectedMetalId}
                  iconLeft={<Plus size={16} />}
                  className="h-11"
                >
                  Nueva variante
                </TPButton>
              </div>
            </div>

            {variantsErr ? <div className="mt-3 text-sm text-red-600">{variantsErr}</div> : null}

            <div className="mt-4">
              <TPTableWrap>
                <TPTableEl>
                  <table className="w-full">
                    <TPThead>
                      <tr>
                        <TPTh className="text-left">
                          <VarSortBtn k="name" label="Variante" />
                        </TPTh>

                        <TPTh className="text-right tabular-nums w-[150px]">
                          <span className="inline-flex justify-end w-full">
                            <VarSortBtn k="purity" label="Pureza / Ley" />
                          </span>
                        </TPTh>

                        <TPTh className="text-left w-[260px]">
                          <span className="inline-flex items-center gap-1.5">
                            <VarSortBtn k="suggested" label="Valores" />
                          </span>
                        </TPTh>

                        <TPTh className="text-left w-[110px]">
                          <VarSortBtn k="status" label="Estado" />
                        </TPTh>

                        <TPTh className="text-right w-[260px]">Acciones</TPTh>
                      </tr>
                    </TPThead>

                    <TPTbody>
                      {variantsLoading ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted">
                            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                            Cargando variantes…
                          </td>
                        </tr>
                      ) : variantsList.length === 0 ? (
                        <TPEmptyRow
                          colSpan={5}
                          text={onlyFav ? "No hay variantes favoritas para este metal." : "No hay variantes para este metal."}
                        />
                      ) : (
                        variantsList.map((v: any) => {
                          const isActive = v.isActive !== false;
                          const isFav = !!v.isFavorite;
                          const lockActions = saving || variantsLoading;

                          const sug = suggestedOf(v);
                          const sell = finalSellOf(v);

                          const modeTxt = pricingModeOf(v);
                          const isManual = modeTxt === "Manual";
                          const sf = toNum(v.saleFactor, 1);

                          return (
                            <TPTr key={v.id}>
                              <TPTd className="text-left">
                                <div className="font-semibold text-text">{v.name}</div>
                                <div className="text-xs text-muted">SKU: {v.sku}</div>
                                <div className="mt-1 text-xs text-muted">
                                  Modo:{" "}
                                  <span className={cn("font-semibold", isManual ? "text-yellow-400" : "text-text")}>
                                    {modeTxt}
                                  </span>{" "}
                                  · Ajuste venta:{" "}
                                  <span className="tabular-nums text-text">{Number.isFinite(sf) ? sf.toFixed(2) : "—"}</span>
                                </div>
                              </TPTd>

                              <TPTd className="text-right tabular-nums">
                                <div className="text-text">{fmtNum(v.purity, 4)}</div>
                                <div className="text-xs text-muted">{leyOf(v.purity)}</div>
                              </TPTd>

                              <TPTd className="text-left">
                                <div className="text-sm text-text tabular-nums">{fmtMoney(baseSym, sug, 2)}</div>
                                <div className="text-xs text-muted tabular-nums">
                                  Venta: <span className="text-text">{fmtMoney(baseSym, sell, 2)}</span>
                                </div>
                              </TPTd>

                              <TPTd className="text-left">
                                {isActive ? <Pill tone="ok">Activa</Pill> : <Pill tone="off">Inactiva</Pill>}
                              </TPTd>

                              <TPTd className="text-right">
                                <div className="flex justify-end gap-2">
                                  <TPButton
                                    variant="secondary"
                                    onClick={() => void onFavorite(v)}
                                    disabled={lockActions}
                                    title={isFav ? "Quitar favorito" : "Marcar favorita"}
                                    className="h-9 w-9 !p-0 grid place-items-center"
                                  >
                                    <Star
                                      size={16}
                                      className={cn(
                                        "stroke-current",
                                        isFav ? "fill-current text-yellow-400" : "fill-transparent text-text/80"
                                      )}
                                    />
                                  </TPButton>

                                  <IconBtn
                                    title="Ver"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenVariantView?.(v);
                                    }}
                                    disabled={lockActions || !onOpenVariantView}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </IconBtn>

                                  <IconBtn
                                    title="Editar"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenVariantEdit?.(v);
                                    }}
                                    disabled={lockActions || !onOpenVariantEdit}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </IconBtn>

                                  <IconBtn
                                    title={isActive ? "Desactivar" : "Activar"}
                                    onClick={() => void onToggleVariant(v as any) as any}
                                    disabled={lockActions}
                                  >
                                    {isActive ? <ShieldBan className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                  </IconBtn>

                                  {onDeleteVariant ? (
                                    <IconBtn
                                      title="Eliminar"
                                      onClick={() => void onAskDeleteVariant(v as any) as any}
                                      disabled={lockActions}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </IconBtn>
                                  ) : null}
                                </div>
                              </TPTd>
                            </TPTr>
                          );
                        })
                      )}
                    </TPTbody>
                  </table>
                </TPTableEl>

                <div className="flex items-center justify-between border-t border-border bg-surface2/30 px-5 py-3 text-xs text-muted">
                  <div>
                    {variantsList.length} variante{variantsList.length === 1 ? "" : "s"}
                  </div>
                  <div>Tip: ordená desde el encabezado.</div>
                </div>
              </TPTableWrap>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Historial Reference Value (sin cambios) */}
      <ModalShell
        open={refHistOpen}
        title={refHistMetal ? `Historial — ${refHistMetal.name}` : "Historial"}
        subtitle="Cambios del valor de referencia (moneda base)"
        onClose={() => {
          setRefHistOpen(false);
          setRefHistErr(null);
          setRefHistRows([]);
          setRefHistMetal(null);
        }}
        busy={refHistLoading}
        maxWidth="3xl"
      >
        {refHistErr ? <div className="mb-3 text-sm text-red-600">{refHistErr}</div> : null}

        {refHistLoading ? (
          <div className="p-6 text-center text-sm text-muted">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            Cargando historial…
          </div>
        ) : refHistRows.length === 0 ? (
          <div className="p-4 text-sm text-muted">Todavía no hay historial para este metal.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-border">
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Vigencia</th>
                  <th className="py-2 pr-3">Creado</th>
                  <th className="py-2 pr-0">Usuario</th>
                </tr>
              </thead>
              <tbody>
                {refHistRows.map((h: any) => (
                  <tr key={h.id} className="border-b border-border/60 last:border-b-0">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-text tabular-nums">{fmtMoney(baseSym, h.referenceValue, 2)}</div>
                    </td>
                    <td className="py-3 pr-3">{h.effectiveAt ? new Date(h.effectiveAt).toLocaleString("es-AR") : "—"}</td>
                    <td className="py-3 pr-3">{h.createdAt ? new Date(h.createdAt).toLocaleString("es-AR") : "—"}</td>
                    <td className="py-3 pr-0">
                      {h.user ? (
                        <div className="text-sm text-text">
                          <div className="font-semibold">{h.user.name || h.user.email}</div>
                          {h.user.name ? <div className="text-xs text-muted">{h.user.email}</div> : null}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ModalShell>
    </section>
  );
}
// src/components/valuation/modals/MetalsAndVariantsPanel.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { TPRowActions } from "../../ui/TPRowActions";

import type { MetalRow, VariantRow } from "../../../hooks/useValuation";
import { cn, norm, Pill, ModalShell } from "../valuation.ui";
import TPStatusPill from "../../ui/TPStatusPill";

import { SortArrows } from "../../ui/TPSort";
import { TPColumnPicker } from "../../ui/TPColumnPicker";
import { TPButton } from "../../ui/TPButton";
import { TPSearchInput } from "../../ui/TPSearchInput";
import TPDateRangeInline from "../../ui/TPDateRangeInline";
import {
  TPTableWrap,
  TPTable,
  TPTableXScroll,
  TPTableElBase,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../../ui/TPTable";

import { TPTECH_VALUATION_CHANGED, type ValuationChangedDetail } from "../../../services/valuation";

import { fmtMoneySmart, fmtNumber2, fmtNumberSmart, fmtPurity2, purityKey2 } from "../../../lib/format";

import {
  type VarSortKey,
  type VarSortDir,
  type RefSortKey,
  type RefSortDir,
  type DateRange,
  toNum,
  fmtDateTime,
  userLabel,
  startOfDay,
  endOfDay,
  useLatest,
} from './metalsPanel.utils';

/* ── Definición de columnas ─────────────────────────────────── */
type ColDef<SK extends string = string> = {
  key: string;
  label: string;
  width?: string;
  visible: boolean;
  canHide?: boolean;
  align?: "left" | "right";
  sortKey?: SK;
};

const VAR_COLUMNS: ColDef<VarSortKey>[] = [
  { key: "name",    label: "Variante",     visible: true,  canHide: false, sortKey: "name" },
  { key: "purity",  label: "Pureza / Ley", visible: true,  width: "150px", align: "right", sortKey: "purity" },
  { key: "values",  label: "Valores",      visible: true,  width: "260px", sortKey: "suggested" },
  { key: "status",  label: "Estado",       visible: true,  width: "110px" },
  { key: "actions", label: "Acciones",     visible: true,  canHide: false, width: "260px", align: "right" },
];

const REF_COLUMNS: ColDef<RefSortKey>[] = [
  { key: "edited",  label: "Editado",  visible: true, sortKey: "edited" },
  { key: "user",    label: "Usuario",  visible: true, sortKey: "user" },
  { key: "value",   label: "Valor",    visible: true, align: "right", sortKey: "value" },
  { key: "created", label: "Creado",   visible: true, sortKey: "created" },
];

const VAR_COL_LS_KEY = "tptech_col_variants";

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
    current?: {
      id: string;
      referenceValue: number;
      effectiveAt?: string;
      createdAt?: string;
      user: { id: string; name: string | null; email: string } | null;
    } | null;
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
  /* =========================
     UI state
  ========================= */
  const [qMetal, setQMetal] = useState("");
  const [selectedMetalId, setSelectedMetalId] = useState("");

  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [variantsErr, setVariantsErr] = useState<string | null>(null);

  const [qVar, setQVar] = useState("");

  const [varSortKey, setVarSortKey] = useState<VarSortKey>("name");
  const [varSortDir, setVarSortDir] = useState<VarSortDir>("asc");

  // ── Visibilidad de columnas de variantes ──
  const [varColVis, setVarColVis] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(VAR_COL_LS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return Object.fromEntries(VAR_COLUMNS.map((c) => [c.key, c.visible]));
  });
  function toggleVarCol(key: string, visible: boolean) {
    setVarColVis((prev) => {
      const next = { ...prev, [key]: visible };
      try { localStorage.setItem(VAR_COL_LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }
  const visibleVarCols = VAR_COLUMNS.filter((c) => varColVis[c.key] !== false);
  const varColSpan = visibleVarCols.length;
  const visibleRefCols = REF_COLUMNS.filter((c) => c.visible);

  const [variantsCountByMetal, setVariantsCountByMetal] = useState<Record<string, number>>({});

  /* =========================
     Refs + timers (limpio)
  ========================= */
  const latestSelectedMetalId = useLatest(selectedMetalId);
  const latestQVar = useLatest(qVar);

  const refreshTimerRef = useRef<any>(null);
  const countTimerRef = useRef<any>(null);

  /* =========================
     Selected metal
  ========================= */
  const selectedMetal = useMemo(
    () => metals.find((m: any) => String(m.id) === String(selectedMetalId)) ?? null,
    [metals, selectedMetalId]
  );

  // auto-select first metal
  useEffect(() => {
    if (selectedMetalId) return;
    if (!metals.length) return;
    setSelectedMetalId(String((metals[0] as any).id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metals.length]);

  // notify parent selection
  useEffect(() => {
    if (!selectedMetalId) return;
    const m: any = metals.find((x: any) => String(x.id) === String(selectedMetalId));
    if (!m) return;
    onSelectedMetalChange?.(m.id, m.name, (m as any)?.referenceValue ?? null);
  }, [selectedMetalId, metals, onSelectedMetalChange]);

  /* =========================
     Metals list filtered + sorted
  ========================= */
  const metalsFiltered = useMemo(() => {
    const s = norm(qMetal);

    const list = [...metals].sort((a: any, b: any) => {
      const ao = Number((a as any).sortOrder ?? 0);
      const bo = Number((b as any).sortOrder ?? 0);
      if (ao !== bo) return ao - bo;
      return String((a as any).name || "").localeCompare(String((b as any).name || ""));
    });

    if (!s) return list;
    return list.filter((m: any) => norm(m.name).includes(s) || norm(m.symbol).includes(s));
  }, [metals, qMetal]);

  /* =========================
     Load variants (selected metal)
  ========================= */
  const loadVariants = useCallback(async () => {
    const mid = String(latestSelectedMetalId.current || "").trim();
    if (!mid) return;

    setVariantsErr(null);

    try {
      setVariantsLoading(true);

      const q = latestQVar.current.trim() || undefined;

      const r = await getVariants(mid, { q });

      if (!r.ok) {
        setVariantsErr(r.error || "No se pudieron cargar las variantes.");
        setVariants([]);
        return;
      }

      const rows = r.rows || [];
      setVariants(rows);

      const hasFilters = Boolean(q);
      if (!hasFilters) {
        setVariantsCountByMetal((prev) => ({ ...prev, [mid]: rows.length }));
      }
    } finally {
      setVariantsLoading(false);
    }
  }, [getVariants, latestQVar, latestSelectedMetalId]);

  useEffect(() => {
    void loadVariants();
  }, [loadVariants, selectedMetalId, qVar]);

  /* =========================
     Preload counts (metals list)
  ========================= */
  useEffect(() => {
    if (!metalsFiltered.length) return;

    if (countTimerRef.current) clearTimeout(countTimerRef.current);

    countTimerRef.current = setTimeout(() => {
      countTimerRef.current = null;

      const missing = metalsFiltered
        .map((m: any) => String(m?.id || ""))
        .filter((id) => id && typeof variantsCountByMetal[id] !== "number");

      if (!missing.length) return;

      const batch = missing.slice(0, 12);

      batch.forEach((mid) => {
        void (async () => {
          try {
            const r = await getVariants(mid, {});
            if (!r?.ok) return;
            const count = Array.isArray(r.rows) ? r.rows.length : 0;
            setVariantsCountByMetal((prev) => {
              if (typeof prev[mid] === "number") return prev;
              return { ...prev, [mid]: count };
            });
          } catch {
            // noop
          }
        })();
      });
    }, 160);

    return () => {
      if (countTimerRef.current) {
        clearTimeout(countTimerRef.current);
        countTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metalsFiltered, getVariants, variantsCountByMetal]);

  /* =========================
     Auto-refresh variants on global event
  ========================= */
  useEffect(() => {
    function scheduleRefresh() {
      const mid = String(latestSelectedMetalId.current || "").trim();
      if (!mid) return;

      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        void loadVariants();

        if (!latestQVar.current.trim()) {
          void (async () => {
            const r = await getVariants(mid, {});
            if (r?.ok) {
              const count = Array.isArray(r.rows) ? r.rows.length : 0;
              setVariantsCountByMetal((prev) => ({ ...prev, [mid]: count }));
            }
          })();
        }
      }, 120);
    }

    function shouldRefresh(detail: ValuationChangedDetail | undefined) {
      if (!detail || typeof (detail as any).kind !== "string") return true;

      const kind = (detail as any).kind as ValuationChangedDetail["kind"];
      const mid = String((detail as any).metalId || "").trim();
      const selected = String(latestSelectedMetalId.current || "").trim();

      if (mid && selected && mid !== selected) return false;

      if (kind.startsWith("variants:")) return true;
      if (kind.startsWith("quotes:")) return true;
      if (kind === "currencies:base-changed") return true;
      if (kind === "metals:updated" || kind === "metals:active-changed") return true;

      return false;
    }

    function onValuationChanged(e: any) {
      const detail = (e as any)?.detail as ValuationChangedDetail | undefined;
      if (!shouldRefresh(detail)) return;
      scheduleRefresh();
    }

    if (typeof window !== "undefined") {
      window.addEventListener(TPTECH_VALUATION_CHANGED, onValuationChanged as any);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(TPTECH_VALUATION_CHANGED, onValuationChanged as any);
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [getVariants, loadVariants, latestQVar, latestSelectedMetalId]);

  /* =========================
     Variant sorting helpers
  ========================= */
  function toggleVarSort(nextKey: VarSortKey) {
    if (varSortKey === nextKey) {
      setVarSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setVarSortKey(nextKey);
    setVarSortDir(nextKey === "status" ? "desc" : "asc");
  }

  const baseSym = String(baseCurrencySymbol || "").trim();

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

  function leyOf(purity: any) {
    const p = toNum(purity, NaN);
    if (!Number.isFinite(p) || p <= 0) return "—";
    const key = purityKey2(p);
    if (!Number.isFinite(key)) return "—";
    return String(Math.round(key * 1000));
  }

  function roundMoney2(n: any) {
    const v = Number(n);
    if (!Number.isFinite(v)) return NaN;
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }

  const variantsList = useMemo(() => {
    const rows = [...(variants || [])];
    const dir = varSortDir === "asc" ? 1 : -1;

    rows.sort((a: any, b: any) => {
      if (varSortKey === "name") return dir * String(a.name || "").localeCompare(String(b.name || ""));
      if (varSortKey === "purity") return dir * (purityKey2(a.purity) - purityKey2(b.purity));
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

  function onEditMetalClick(e: React.MouseEvent, m: MetalRow) {
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

  function symbolText(m: any) {
    const s = String(m?.symbol || "").trim();
    if (s) return s;
    const nm = String(m?.name || "").trim();
    return nm ? nm.slice(0, 2).toUpperCase() : "—";
  }

  /* =========================
     Ref history modal state
  ========================= */
  const [refHistOpen, setRefHistOpen] = useState(false);
  const [refHistLoading, setRefHistLoading] = useState(false);
  const [refHistErr, setRefHistErr] = useState<string | null>(null);

  const [refHistMetal, setRefHistMetal] = useState<MetalRow | null>(null);
  const [refHistCurrent, setRefHistCurrent] = useState<any>(null);
  const [refHistRows, setRefHistRows] = useState<
    Array<{
      id: string;
      referenceValue: number;
      effectiveAt: string;
      createdAt: string;
      user: { id: string; name: string | null; email: string } | null;
    }>
  >([]);

  const [refSortKey, setRefSortKey] = useState<RefSortKey>("edited");
  const [refSortDir, setRefSortDir] = useState<RefSortDir>("desc");

  const [refRange, setRefRange] = useState<DateRange>({ from: null, to: null });

  function toggleRefSort(k: RefSortKey) {
    if (refSortKey === k) {
      setRefSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setRefSortKey(k);
    if (k === "edited" || k === "created") setRefSortDir("desc");
    else setRefSortDir("asc");
  }

  const ThRefBtn = ({ k, label, align }: { k: RefSortKey; label: string; align?: "left" | "right" }) => {
    const active = refSortKey === k;
    return (
      <button
        type="button"
        onClick={() => toggleRefSort(k)}
        className={cn(
          "inline-flex items-center gap-2 select-none hover:text-text transition",
          align === "right" ? "ml-auto" : ""
        )}
        title="Ordenar"
      >
        <span>{label}</span>
        <SortArrows dir={refSortDir} active={active} />
      </button>
    );
  };

  const refHistorySorted = useMemo(() => {
    const rows = [...(refHistRows || [])];
    const dir = refSortDir === "asc" ? 1 : -1;

    const asTime = (v: any) => {
      const t = new Date(v).getTime();
      return Number.isFinite(t) ? t : -Infinity;
    };

    rows.sort((a: any, b: any) => {
      if (refSortKey === "edited") return dir * (asTime(a?.effectiveAt) - asTime(b?.effectiveAt));
      if (refSortKey === "created") return dir * (asTime(a?.createdAt) - asTime(b?.createdAt));

      if (refSortKey === "value") {
        const av = Number(a?.referenceValue);
        const bv = Number(b?.referenceValue);
        return dir * ((Number.isFinite(av) ? av : -Infinity) - (Number.isFinite(bv) ? bv : -Infinity));
      }

      if (refSortKey === "user") return dir * userLabel(a?.user).localeCompare(userLabel(b?.user));

      return 0;
    });

    return rows;
  }, [refHistRows, refSortKey, refSortDir]);

  const refHistory = useMemo(() => {
    const from = refRange.from ? startOfDay(refRange.from).getTime() : null;
    const to = refRange.to ? endOfDay(refRange.to).getTime() : null;

    if (from == null && to == null) return refHistorySorted;

    return refHistorySorted.filter((r: any) => {
      const t = new Date(r?.effectiveAt ?? r?.createdAt).getTime();
      if (!Number.isFinite(t)) return false;
      if (from != null && t < from) return false;
      if (to != null && t > to) return false;
      return true;
    });
  }, [refHistorySorted, refRange.from, refRange.to]);

  async function openRefHistory(e: React.MouseEvent | null, m: MetalRow) {
    e?.stopPropagation();

    setRefHistMetal(m);

    if (!getMetalRefHistory) {
      setRefHistErr("Falta conectar getMetalRefHistory en el frontend.");
      setRefHistCurrent(null);
      setRefHistRows([]);
      setRefHistOpen(true);
      return;
    }

    setRefHistErr(null);
    setRefHistCurrent(null);
    setRefHistRows([]);
    setRefHistOpen(true);
    setRefRange({ from: null, to: null });

    setRefHistLoading(true);
    try {
      const r = await getMetalRefHistory((m as any).id, 80);

      if (!r?.ok) {
        setRefHistErr(r?.error || "No se pudo cargar el historial.");
        setRefHistCurrent(null);
        setRefHistRows([]);
        return;
      }

      const rows = (r.history as any) || [];
      setRefHistRows(rows);

      if (r.current) {
        setRefHistCurrent(r.current);
        return;
      }

      const best = [...rows].sort((a: any, b: any) => {
        const ta = new Date(a?.effectiveAt || a?.createdAt || 0).getTime();
        const tb = new Date(b?.effectiveAt || b?.createdAt || 0).getTime();
        return (Number.isFinite(tb) ? tb : -Infinity) - (Number.isFinite(ta) ? ta : -Infinity);
      })[0];

      setRefHistCurrent(best || null);
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

  const refTitle = useMemo(() => {
    if (!refHistMetal) return "Detalle";
    return `Detalle · ${String((refHistMetal as any)?.symbol || (refHistMetal as any)?.name || "Metal").trim()}`;
  }, [refHistMetal]);

  const refSubtitle = useMemo(() => {
    if (!refHistMetal) return "Valor actual e historial.";
    const nm = String((refHistMetal as any)?.name || "").trim();
    const sym = String((refHistMetal as any)?.symbol || "").trim();
    return sym ? `${sym} · ${nm || "Metal"}` : nm ? nm : "Metal";
  }, [refHistMetal]);

  const currentRefLabel = useMemo(() => {
    const sym = String((refHistMetal as any)?.symbol || "").trim();
    const nm = String((refHistMetal as any)?.name || "").trim();
    if (sym) return `Valor actual de 1g ${sym}`;
    if (nm) return `Valor actual de 1g ${nm}`;
    return "Valor actual";
  }, [refHistMetal]);

  const currentRefUserLabel = refHistCurrent?.user ? userLabel(refHistCurrent.user) : "—";
  const showRefLoading = refHistLoading || (refHistOpen && !refHistErr && !refHistCurrent && refHistRows.length === 0);
  const hasRefRange = Boolean(refRange.from || refRange.to);

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-border bg-card p-4 overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
        <div className="min-w-0">
          <div className="text-sm text-muted">Configuración</div>
          <div className="text-lg font-bold text-text">Metales</div>
          <div className="text-sm text-muted">Metales + variantes + precios (por gramo).</div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[420px,1fr] min-w-0">
          {/* LEFT: Metales */}
          <div className="rounded-2xl border border-border bg-card p-4 min-w-0 overflow-hidden">
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
              <TPSearchInput value={qMetal} onChange={setQMetal} placeholder="Buscar (nombre / símbolo)…" disabled={saving} className="h-11" />
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
                  const refText = refv != null && Number.isFinite(Number(refv)) ? fmtMoneySmart(baseSym, refv) : "—";

                  const canUp = idx > 0;
                  const canDown = idx < metalsFiltered.length - 1;

                  const vCount = typeof variantsCountByMetal[m.id] === "number" ? variantsCountByMetal[m.id] : null;
                  const hasNoVariants = vCount === 0;

                  return (
                    <div
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedMetalId(m.id)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedMetalId(m.id); }}
                      className={cn(
                        "w-full rounded-2xl border p-3 text-left transition relative overflow-hidden cursor-pointer",
                        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                        active
                          ? "border-primary/50 bg-surface2 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]"
                          : "border-border bg-card hover:bg-surface2"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <div className="absolute right-3 top-3 flex items-center gap-2">
                        {hasNoVariants ? <Pill tone="off">Sin variantes</Pill> : null}
                        <TPStatusPill active={isActive} />
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

                          {vCount != null ? (
                            <div className="mt-1 text-[11px] text-muted">
                              {vCount === 0 ? "Sin variantes configuradas." : `${vCount} variante${vCount === 1 ? "" : "s"}.`}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-3 -mx-1 px-1 max-w-full overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" as any }}>
                        <div className="min-w-max flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <IconBtn title="Subir" onClick={(e) => onMoveMetalClick(e, m, "UP")} disabled={saving || !onMoveMetal || !canUp}>
                              <ArrowUp className="h-4 w-4" />
                            </IconBtn>

                            <IconBtn title="Bajar" onClick={(e) => onMoveMetalClick(e, m, "DOWN")} disabled={saving || !onMoveMetal || !canDown}>
                              <ArrowDown className="h-4 w-4" />
                            </IconBtn>
                          </div>

                          <div className="flex items-center justify-end gap-2">
                              <TPRowActions
                              onView={() => void openRefHistory(null, m)}
                              onEdit={() => onOpenMetalEdit?.(m)}
                              onToggle={() => { if (onToggleMetal) void onToggleMetal((m as any).id, !isActive); }}
                              isActive={isActive}
                              onDelete={onDeleteMetal ? () => void onDeleteMetal!(m) : undefined}
                            />

                            <ChevronRight size={18} className={cn(active ? "text-text" : "text-muted")} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT: Variantes */}
          <div className="rounded-2xl border border-border bg-card p-4 min-w-0 overflow-hidden">
            <div className="min-w-0 text-left">
              <div className="text-lg font-bold text-text truncate text-left">
                Variantes {selectedMetal ? <>— {selectedMetal.name}</> : null}
              </div>
              <div className="text-sm text-muted mt-0.5 text-left">Pureza/Ley + valores + estado.</div>
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <TPColumnPicker
                  columns={VAR_COLUMNS.map((c) => ({ key: c.key, label: c.label, canHide: c.canHide }))}
                  visibility={varColVis}
                  onChange={toggleVarCol}
                />
                <div className="flex-1 min-w-0">
                  <TPSearchInput
                    value={qVar}
                    onChange={setQVar}
                    placeholder="Buscar (SKU / nombre)…"
                    disabled={saving || !selectedMetalId}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="sm:ml-auto flex items-center gap-2 shrink-0">
                <TPButton
                  variant="primary"
                  onClick={onOpenVariantCreate}
                  disabled={saving || !selectedMetalId}
                  iconLeft={<Plus size={16} />}
                  className="h-11 w-full sm:w-auto"
                >
                  Nueva variante
                </TPButton>
              </div>
            </div>

            {variantsErr ? <div className="mt-3 text-sm text-red-600">{variantsErr}</div> : null}

            <div className="mt-4 min-w-0">
              <TPTableWrap>
                <TPTable>
                  <TPTableXScroll>
                    <TPTableElBase responsive="stack">
                      <TPThead>
                        <tr>
                          {visibleVarCols.map((col) => (
                            <TPTh
                              key={col.key}
                              style={col.width ? { width: col.width } : undefined}
                              className={col.align === "right" ? "text-right tabular-nums" : "text-left"}
                            >
                              {col.sortKey ? (
                                <span className={cn("inline-flex items-center gap-1.5", col.align === "right" ? "justify-end w-full" : "")}>
                                  <VarSortBtn k={col.sortKey as VarSortKey} label={col.label} />
                                </span>
                              ) : (
                                col.label
                              )}
                            </TPTh>
                          ))}
                        </tr>
                      </TPThead>

                      <TPTbody>
                        {variantsLoading ? (
                          <TPTr>
                            <TPTd colSpan={varColSpan}>
                              <div className="px-0 md:px-5 py-10 text-center text-sm text-muted">
                                <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
                                Cargando variantes…
                              </div>
                            </TPTd>
                          </TPTr>
                        ) : variantsList.length === 0 ? (
                          <TPEmptyRow colSpan={varColSpan} text="No hay variantes para este metal." />
                        ) : (
                          variantsList.map((v: any) => {
                            const isActive = v.isActive !== false;
                            const isFav = !!v.isFavorite;
                            const lockActions = saving || variantsLoading;

                            const sug = suggestedOf(v);
                            const sell = finalSellOf(v);

                            const sugR = roundMoney2(sug);
                            const sellR = roundMoney2(sell);
                            const showTwoValues = Number.isFinite(sugR) && Number.isFinite(sellR) && sugR !== sellR;

                            const sf = toNum(v.saleFactor, 1);

                            const leyTxt = leyOf(v.purity);

                            return (
                              <TPTr key={v.id}>
                                <TPTd label="Variante" className="text-left">
                                  <div className="font-semibold text-text">{v.name}</div>
                                  <div className="text-xs text-muted">SKU: {v.sku}</div>
                                  {Number.isFinite(sf) && Math.abs(sf - 1) > 0.000001 && (
                                    <div className="mt-1 text-xs text-muted">
                                      Factor:{" "}
                                      <span className="tabular-nums text-text">{fmtNumber2(sf)}</span>
                                    </div>
                                  )}
                                </TPTd>

                                {varColVis["purity"] !== false && (
                                  <TPTd label="Pureza / Ley" className="text-right tabular-nums">
                                    <div className="text-text">{fmtPurity2(v.purity)}</div>
                                    <div className="text-xs text-muted">{leyTxt === "—" ? "—" : `${leyTxt}/1000`}</div>
                                  </TPTd>
                                )}

                                {varColVis["values"] !== false && (
                                  <TPTd label="Valores" className="text-left">
                                    {showTwoValues ? (
                                      <>
                                        <div className="text-sm font-semibold text-text tabular-nums">{fmtMoneySmart(baseSym, sell)}</div>
                                        <div className="text-xs text-muted tabular-nums line-through">{fmtMoneySmart(baseSym, sug)}</div>
                                      </>
                                    ) : (
                                      <div className="text-sm text-text tabular-nums">
                                        {Number.isFinite(sell) ? fmtMoneySmart(baseSym, sell) : fmtMoneySmart(baseSym, sug)}
                                      </div>
                                    )}
                                  </TPTd>
                                )}

                                {varColVis["status"] !== false && (
                                  <TPTd label="Estado" className="text-left">
                                    <TPStatusPill active={isActive} activeLabel="Activa" inactiveLabel="Inactiva" />
                                  </TPTd>
                                )}

                                <TPTd label="Acciones" className="text-right">
                                  {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events */}
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <TPRowActions
                                      onFavorite={() => void onFavorite(v)}
                                      isFavorite={isFav}
                                      busyFavorite={lockActions}
                                      onView={onOpenVariantView ? () => onOpenVariantView(v) : undefined}
                                      onEdit={onOpenVariantEdit ? () => onOpenVariantEdit(v) : undefined}
                                      onToggle={() => void onToggleVariant(v as any)}
                                      isActive={isActive}
                                      onDelete={onDeleteVariant ? () => void onAskDeleteVariant(v as any) : undefined}
                                    />
                                  </div>
                                </TPTd>
                              </TPTr>
                            );
                          })
                        )}
                      </TPTbody>
                    </TPTableElBase>
                  </TPTableXScroll>
                </TPTable>

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

      {/* Modal: Detalle/Historial Reference Value (Metal) */}
      <ModalShell
        open={refHistOpen}
        title={refTitle}
        subtitle={refSubtitle}
        onClose={() => {
          setRefHistOpen(false);
          setRefHistErr(null);
          setRefHistCurrent(null);
          setRefHistRows([]);
          setRefHistMetal(null);
          setRefSortKey("edited");
          setRefSortDir("desc");
          setRefRange({ from: null, to: null });
        }}
        busy={false}
        maxWidth="4xl"
        footer={
          <button
            type="button"
            className="tp-btn-secondary h-10 inline-flex items-center gap-2"
            onClick={() => {
              setRefHistOpen(false);
              setRefHistErr(null);
              setRefHistCurrent(null);
              setRefHistRows([]);
              setRefHistMetal(null);
              setRefSortKey("edited");
              setRefSortDir("desc");
              setRefRange({ from: null, to: null });
            }}
            disabled={showRefLoading}
          >
            <X size={16} />
            Cerrar
          </button>
        }
      >
        <div className="w-full min-w-0">
          {refHistErr && (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-text">{refHistErr}</div>
          )}

          {showRefLoading ? (
            <div className="p-6 text-center text-sm text-muted">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Cargando…
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-border bg-card p-6 overflow-hidden">
                <div className="text-xs text-muted text-center">{currentRefLabel}</div>

                <div className="mt-2 flex items-center justify-center">
                  <div className="rounded-2xl border border-border bg-surface2 px-6 py-5 text-center">
                    <div className="text-4xl font-semibold text-text tabular-nums whitespace-nowrap">
                      {refHistCurrent?.referenceValue != null ? (
                        <>
                          {baseSym ? <span className="mr-2">{baseSym}</span> : null}
                          {fmtNumberSmart(refHistCurrent.referenceValue)}
                        </>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="rounded-xl border border-border bg-surface2 p-3">
                    <div className="text-xs text-muted font-semibold">Última edición</div>
                    <div className="mt-1 text-text tabular-nums whitespace-nowrap">
                      {fmtDateTime(refHistCurrent?.effectiveAt || refHistCurrent?.createdAt)}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-surface2 p-3">
                    <div className="text-xs text-muted font-semibold">Usuario</div>
                    <div className="mt-1 text-text truncate" title={currentRefUserLabel}>
                      {currentRefUserLabel}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 min-w-0">
                <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
                  <div className="text-xs font-semibold text-muted">Historial</div>

                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[260px]">
                      <TPDateRangeInline value={refRange} onChange={setRefRange} />
                    </div>
                  </div>
                </div>

                {refHistory.length === 0 ? (
                  <div className="text-sm text-muted">{hasRefRange ? "Sin resultados para ese rango." : "Sin historial."}</div>
                ) : (
                  <div className="max-w-full">
                    <div
                      className={cn("max-h-[42vh] overflow-y-auto overscroll-contain touch-pan-y rounded-2xl")}
                      style={{ WebkitOverflowScrolling: "touch" as any }}
                    >
                      <TPTableWrap>
                        <TPTable>
                          <TPTableXScroll>
                            {/* ✅ MOBILE: stack cards / DESKTOP: tabla */}
                            <TPTableElBase responsive="stack" className="w-full">
                              <TPThead className="sticky top-0 z-20">
                                <tr>
                                  {visibleRefCols.map((col) => (
                                    <TPTh
                                      key={col.key}
                                      style={col.width ? { width: col.width } : undefined}
                                      className={col.align === "right" ? "text-right" : "text-left"}
                                    >
                                      {col.sortKey ? (
                                        <span className={cn("inline-flex items-center gap-1.5", col.align === "right" ? "justify-end w-full" : "")}>
                                          <ThRefBtn k={col.sortKey as RefSortKey} label={col.label} align={col.align} />
                                        </span>
                                      ) : (
                                        col.label
                                      )}
                                    </TPTh>
                                  ))}
                                </tr>
                              </TPThead>

                              <TPTbody>
                                {refHistory.map((r: any) => {
                                  const uLabel = userLabel(r?.user);

                                  // ✅ IMPORTANTE: NO usar TPTr acá (evita "doble card" en mobile)
                                  return (
                                    <tr key={r.id}>
                                      <TPTd label="Editado" className="tabular-nums whitespace-nowrap">
                                        {fmtDateTime(r.effectiveAt)}
                                      </TPTd>

                                      <TPTd label="Usuario">
                                        <div className="max-w-[420px] truncate" title={uLabel}>
                                          {uLabel}
                                        </div>
                                      </TPTd>

                                      <TPTd label="Valor" className="text-right font-semibold tabular-nums whitespace-nowrap">
                                        {baseSym ? <span className="mr-1">{baseSym}</span> : null}
                                        {fmtNumberSmart(r.referenceValue)}
                                      </TPTd>

                                      <TPTd label="Creado" className="tabular-nums whitespace-nowrap">
                                        {fmtDateTime(r.createdAt)}
                                      </TPTd>
                                    </tr>
                                  );
                                })}
                              </TPTbody>
                            </TPTableElBase>
                          </TPTableXScroll>
                        </TPTable>
                      </TPTableWrap>
                    </div>
                  </div>
                )}

                <div className="mt-3 text-[11px] text-muted">Los valores están expresados en la moneda base.</div>
              </div>
            </>
          )}
        </div>
      </ModalShell>
    </section>
  );
}
// src/pages/entity-detail/EntityBalanceMovementsView.tsx
// =============================================================================
// T61–T62 (Fase 4.3 + 4.4) — Vista canónica de Cuenta Corriente.
//
// READ-ONLY. NO calcula. NO convierte. Solo lee `CurrentAccountMovement` +
// `AccountMovementMetalEntry` desde el endpoint canónico.
//
// Features:
//   · Filtros UX (tipo, documento, modo, moneda, metal) — Fase 4.4.
//   · Resumen agregado superior (gramos por padre + monetario por moneda).
//   · Cards UNIFIED / BREAKDOWN con tag visual.
//   · "Ver origen" → modal premium read-only — Fase 4.4.
//   · Skeleton loading premium — Fase 4.4.
//   · Paginación "Cargar más" — Fase 4.4.
//   · Print/PDF friendly (clase `no-print` en controles) — Fase 4.4.
// =============================================================================

import { useEffect, useState, useMemo, useCallback } from "react";
import { AlertCircle, ExternalLink, Plus } from "lucide-react";
import { TPCard } from "../../components/ui/TPCard";
import { TPButton } from "../../components/ui/TPButton";
import {
  commercialEntitiesApi,
  type BalanceMovementDTO,
  type BalanceMovementsListResponse,
} from "../../services/commercial-entities";
import { formatByType } from "../../lib/pricing/format";
import { vt } from "../../lib/pricing/visualTokens";
import {
  aggregateMovements,
  filterMovements,
  buildFilterOptions,
  sourceDocumentLabel,
  sourceTypeLabel,
  kindLabel,
  fmtDate,
  type MovementsAggregate,
  type MovementsFilter,
} from "./balance-movements-helpers";
import { BalanceMovementOriginModal } from "./BalanceMovementOriginModal";

// Re-export para back-compat con tests previos que importaban estos helpers
// desde este archivo.
export {
  aggregateMovements,
  filterMovements,
  buildFilterOptions,
} from "./balance-movements-helpers";
export type {
  AggregatedMetal,
  AggregatedMonetary,
  MovementsAggregate,
  MovementsFilter,
  FilterOptions,
} from "./balance-movements-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface EntityBalanceMovementsViewProps {
  entityId:    string;
  fromDate?:   string;
  toDate?:     string;
  /** Datos pre-cargados (tests/SSR). Si se proveen, NO se llama al API. */
  initialData?: BalanceMovementsListResponse | null;
  /** Override del cliente HTTP (tests). */
  fetcher?: (
    entityId: string,
    params: { from?: string; to?: string; skip?: number; take?: number },
  ) => Promise<BalanceMovementsListResponse>;
  /** Tamaño de página para "Cargar más". Default 25. */
  pageSize?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filtros UI
// ─────────────────────────────────────────────────────────────────────────────

interface FiltersBarProps {
  movements: BalanceMovementDTO[];
  filter:    MovementsFilter;
  onChange:  (f: MovementsFilter) => void;
}

function FiltersBar({ movements, filter, onChange }: FiltersBarProps) {
  const opts = useMemo(() => buildFilterOptions(movements), [movements]);
  const update = (patch: Partial<MovementsFilter>) =>
    onChange({ ...filter, ...patch });

  // Helper select para no repetir el mismo markup.
  const SelectFilter = (props: {
    label:    string;
    value:    string;
    options:  { value: string; label: string }[];
    onChange: (v: string) => void;
    testId:   string;
  }) => (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted">{props.label}</span>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="rounded-md border border-border/50 bg-background px-2 py-1 text-xs"
        data-testid={props.testId}
      >
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div
      className="flex flex-wrap items-end gap-2 no-print"
      data-testid="balance-movements-filters"
    >
      <SelectFilter
        label="Tipo"
        value={filter.kind ?? "ALL"}
        onChange={(v) => update({ kind: v as MovementsFilter["kind"] })}
        options={[
          { value: "ALL",    label: "Todos" },
          { value: "DEBIT",  label: "Débitos" },
          { value: "CREDIT", label: "Créditos" },
        ]}
        testId="filter-kind"
      />
      <SelectFilter
        label="Documento"
        value={filter.documentType ?? "ALL"}
        onChange={(v) => update({ documentType: v })}
        options={opts.documentTypes}
        testId="filter-doctype"
      />
      <SelectFilter
        label="Modo"
        value={filter.balanceMode ?? "ALL"}
        onChange={(v) => update({ balanceMode: v as MovementsFilter["balanceMode"] })}
        options={[
          { value: "ALL",       label: "Todos" },
          { value: "UNIFIED",   label: "Unificado" },
          { value: "BREAKDOWN", label: "Desglosado" },
        ]}
        testId="filter-balance-mode"
      />
      <SelectFilter
        label="Moneda"
        value={filter.currencyCode ?? "ALL"}
        onChange={(v) => update({ currencyCode: v })}
        options={opts.currencies}
        testId="filter-currency"
      />
      <SelectFilter
        label="Metal"
        value={filter.metalParentId ?? "ALL"}
        onChange={(v) => update({ metalParentId: v })}
        options={opts.metals}
        testId="filter-metal"
      />
      <TPButton
        variant="ghost"
        onClick={() => onChange({})}
        className="!px-2 !py-1 !text-xs"
        data-testid="filter-clear"
      >
        Limpiar
      </TPButton>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loading premium
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonState() {
  // 1 summary skeleton + 3 cards skeleton.
  return (
    <div
      className="space-y-4 animate-pulse"
      data-testid="balance-movements-skeleton"
    >
      <div className="rounded-lg border border-border/40 p-4 bg-muted/10">
        <div className="h-3 w-20 bg-muted/40 rounded mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="h-2.5 w-16 bg-muted/30 rounded mb-2" />
            <div className="h-3 w-32 bg-muted/40 rounded mb-1.5" />
            <div className="h-3 w-28 bg-muted/40 rounded" />
          </div>
          <div>
            <div className="h-2.5 w-20 bg-muted/30 rounded mb-2" />
            <div className="h-3 w-36 bg-muted/40 rounded mb-1.5" />
            <div className="h-3 w-32 bg-muted/40 rounded" />
          </div>
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-lg border border-border/40 p-3 bg-muted/5"
        >
          <div className="h-3 w-40 bg-muted/30 rounded mb-2" />
          <div className="h-2.5 w-24 bg-muted/20 rounded mb-3" />
          <div className="flex items-center justify-between">
            <div className="h-2.5 w-16 bg-muted/20 rounded" />
            <div className="h-3 w-24 bg-muted/30 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen superior
// ─────────────────────────────────────────────────────────────────────────────

function MovementsSummaryBlock({
  agg,
  truncated,
}: {
  agg: MovementsAggregate;
  /** Si la lista mostrada es paginada (subset del total del backend), avisamos
   *  al operador que el resumen refleja solo lo cargado en pantalla. */
  truncated?: boolean;
}) {
  const hasMetals   = agg.metals.length > 0;
  const hasMonetary = agg.monetary.length > 0;
  if (!hasMetals && !hasMonetary) {
    return (
      <div data-testid="balance-movements-summary-empty">
        <TPCard className="p-4">
          <div className="text-xs text-muted">
            Sin saldos {truncated ? "en los movimientos cargados" : "en el período seleccionado"}.
          </div>
        </TPCard>
      </div>
    );
  }
  return (
    <div data-testid="balance-movements-summary">
      <TPCard className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className={vt.text.subtotalRow}>SALDOS</div>
          {truncated && (
            <span
              className="text-[10px] uppercase tracking-wide text-muted"
              data-testid="balance-movements-summary-truncated"
            >
              Sobre movimientos cargados
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div data-testid="summary-metals">
            <div className="text-xs text-muted mb-1">Metales</div>
            {hasMetals ? (
              <ul className="space-y-1">
                {agg.metals.map((m) => (
                  <li
                    key={m.metalParentId ?? m.metalParentName}
                    className={vt.row.flexBetween}
                    data-testid={`summary-metal-row-${m.metalParentId ?? m.metalParentName}`}
                  >
                    <span className={vt.text.formula}>{m.metalParentName}</span>
                    <span className={vt.text.totalCard}>
                      {formatByType(m.totalGramsPure, "METAL_GRAMS")}{" gr"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted">Sin gramos.</div>
            )}
          </div>
          <div data-testid="summary-monetary">
            <div className="text-xs text-muted mb-1">Monetario</div>
            {hasMonetary ? (
              <ul className="space-y-1">
                {agg.monetary.map((m) => (
                  <li
                    key={m.currencyCode}
                    className={vt.row.flexBetween}
                    data-testid={`summary-money-row-${m.currencyCode}`}
                  >
                    <span className={vt.text.formula}>{m.currencyCode}</span>
                    <span className={vt.text.totalCard}>
                      {m.currencyCode}{" "}{formatByType(m.amount, "MONEY")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted">Sin saldo monetario.</div>
            )}
          </div>
        </div>
      </TPCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Card de movimiento
// ─────────────────────────────────────────────────────────────────────────────

interface MovementCardProps {
  movement: BalanceMovementDTO;
  onViewOrigin?: (mov: BalanceMovementDTO) => void;
}

function MovementCard({ movement, onViewOrigin }: MovementCardProps) {
  const isBreakdown =
    movement.balanceMode === "BREAKDOWN" && movement.metalEntries.length > 0;
  const docLabel = sourceDocumentLabel(movement.sourceDocumentType);
  const ref      = movement.notes || sourceTypeLabel(movement.source);
  const canViewOrigin =
    !!movement.sourceDocumentId && !!movement.sourceDocumentType;

  return (
    <div
      data-testid={`movement-card-${movement.id}`}
      data-balance-mode={movement.balanceMode}
    >
      <TPCard className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={vt.text.subtotalRow}>{docLabel}</span>
              <span className="text-xs text-muted">·</span>
              <span className="text-xs text-muted">{fmtDate(movement.movementDate)}</span>
              <span className="text-xs text-muted">·</span>
              <span className="text-xs text-muted">{kindLabel(movement.kind)}</span>
              {isBreakdown && (
                <span
                  className="inline-flex items-center rounded-sm bg-primary/15 px-1 text-[10px] font-semibold uppercase tracking-wide text-primary"
                  data-testid="movement-mode-tag"
                >
                  Desglosado
                </span>
              )}
            </div>
            {ref && (
              <div className="text-xs text-muted mt-0.5 truncate" title={ref}>
                {ref}
              </div>
            )}
          </div>
          {canViewOrigin && onViewOrigin && (
            <TPButton
              variant="ghost"
              onClick={() => onViewOrigin(movement)}
              className="!px-2 !py-1 !text-xs no-print"
              data-testid={`movement-view-origin-${movement.id}`}
            >
              <ExternalLink size={12} className="mr-1" />
              Ver origen
            </TPButton>
          )}
        </div>

        {isBreakdown && (
          <div className="mt-2" data-testid="movement-metals">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">
              Metales
            </div>
            <ul className="space-y-0.5">
              {movement.metalEntries.map((e) => (
                <li
                  key={e.id}
                  className={vt.row.flexBetween}
                  data-testid={`movement-${movement.id}-metal-${e.metalParentId ?? e.metalParentName}`}
                >
                  <span className={vt.text.formula}>{e.metalParentName}</span>
                  <span className={vt.text.totalCard}>
                    {formatByType(e.gramsPure, "METAL_GRAMS")}{" gr"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          className={`mt-2 ${vt.row.flexBetween}`}
          data-testid="movement-monetary"
        >
          <span className="text-[10px] uppercase tracking-wide text-muted">
            Saldo monetario
          </span>
          <span className={vt.text.totalCard}>
            {movement.currencyCode || "BASE"}{" "}
            {formatByType(movement.amountOriginal, "MONEY")}
          </span>
        </div>
      </TPCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function EntityBalanceMovementsView({
  entityId,
  fromDate,
  toDate,
  initialData,
  fetcher,
  pageSize = 25,
}: EntityBalanceMovementsViewProps) {
  const [data, setData]       = useState<BalanceMovementsListResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<MovementsFilter>({});
  const [originModalOpen, setOriginModalOpen] = useState(false);
  const [originMovement, setOriginMovement]   = useState<BalanceMovementDTO | null>(null);

  // Carga inicial (sin initialData) — pide la primera página.
  useEffect(() => {
    if (initialData !== undefined && initialData !== null) {
      setData(initialData);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    const params = { from: fromDate, to: toDate, skip: 0, take: pageSize };
    const exec = fetcher
      ? fetcher(entityId, params)
      : commercialEntitiesApi.getBalanceMovements(entityId, params);
    exec
      .then((res) => { if (alive) setData(res); })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message ?? "No se pudo cargar la cuenta corriente.");
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [entityId, fromDate, toDate, fetcher, pageSize, initialData]);

  // "Cargar más": pide la siguiente página y append.
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = useCallback(async () => {
    if (!data) return;
    const nextSkip = data.data.length;
    setLoadingMore(true);
    try {
      const params = { from: fromDate, to: toDate, skip: nextSkip, take: pageSize };
      const res = fetcher
        ? await fetcher(entityId, params)
        : await commercialEntitiesApi.getBalanceMovements(entityId, params);
      setData({
        ...res,
        data: [...data.data, ...res.data],
      });
    } catch (e: any) {
      setError(e?.message ?? "No se pudieron cargar más movimientos.");
    } finally {
      setLoadingMore(false);
    }
  }, [data, entityId, fromDate, toDate, fetcher, pageSize]);

  // Movimientos filtrados + agregado.
  const filteredMovements = useMemo(
    () => filterMovements(data?.data ?? [], filter),
    [data, filter],
  );
  const agg = useMemo(
    () => aggregateMovements(filteredMovements),
    [filteredMovements],
  );

  // Ver origen → abre modal (la navegación al documento la maneja el modal).
  const handleViewOrigin = useCallback((mov: BalanceMovementDTO) => {
    setOriginMovement(mov);
    setOriginModalOpen(true);
  }, []);

  // Estados visuales
  if (loading) return <SkeletonState />;

  if (error) {
    return (
      <div
        className="flex items-center gap-2 text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-3"
        data-testid="balance-movements-error"
      >
        <AlertCircle size={16} className="shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  const loadedCount   = data?.data.length ?? 0;
  const total         = data?.total ?? 0;
  const hasMore       = loadedCount < total;
  const isPaginated   = total > loadedCount || loadedCount > 0;
  const truncated     = isPaginated && (hasMore || filteredMovements.length < (data?.data.length ?? 0));

  return (
    <div className="space-y-4" data-testid="balance-movements-view">
      {/* Filtros */}
      <FiltersBar
        movements={data?.data ?? []}
        filter={filter}
        onChange={setFilter}
      />

      {/* Resumen agregado */}
      <MovementsSummaryBlock agg={agg} truncated={truncated} />

      {/* Lista de movimientos */}
      {filteredMovements.length === 0 ? (
        <div
          className="text-sm text-muted text-center py-12 border border-dashed border-border rounded-xl"
          data-testid="balance-movements-empty"
        >
          {loadedCount === 0
            ? "No hay movimientos en el período seleccionado."
            : "Ningún movimiento cumple con los filtros aplicados."}
        </div>
      ) : (
        <div className="space-y-2" data-testid="balance-movements-list">
          {filteredMovements.map((m) => (
            <MovementCard
              key={m.id}
              movement={m}
              onViewOrigin={handleViewOrigin}
            />
          ))}
        </div>
      )}

      {/* Paginación: "Cargar más" */}
      {hasMore && (
        <div className="flex justify-center pt-2 no-print">
          <TPButton
            variant="secondary"
            onClick={loadMore}
            disabled={loadingMore}
            data-testid="balance-movements-load-more"
            className="!text-xs"
          >
            <Plus size={14} className="mr-1.5" />
            {loadingMore
              ? "Cargando…"
              : `Cargar más (${loadedCount}/${total})`}
          </TPButton>
        </div>
      )}

      {/* Modal Ver origen */}
      <BalanceMovementOriginModal
        open={originModalOpen}
        movement={originMovement}
        onClose={() => setOriginModalOpen(false)}
      />
    </div>
  );
}

export default EntityBalanceMovementsView;

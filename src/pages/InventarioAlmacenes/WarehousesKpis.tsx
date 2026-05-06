import React from "react";
import { TPCard } from "../../components/ui/TPCard";
import { fmtNumberSmart } from "../../lib/format";

export default function WarehousesKpis({
  total,
  active,
  inactive,
  totalGrams,
  totalPieces,
}: {
  total: number;
  active: number;
  inactive: number;
  totalGrams: number;
  totalPieces: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <TPCard className="p-4">
        <div className="text-xs text-muted">Total</div>
        <div className="mt-1 text-2xl font-semibold text-text tabular-nums">
          {total}
        </div>
      </TPCard>

      <TPCard className="p-4">
        <div className="text-xs text-muted">Activos</div>
        <div className="mt-1 text-2xl font-semibold text-text tabular-nums">
          {active}
        </div>
      </TPCard>

      <TPCard className="p-4">
        <div className="text-xs text-muted">Inactivos</div>
        <div className="mt-1 text-2xl font-semibold text-text tabular-nums">
          {inactive}
        </div>
      </TPCard>

      <TPCard className="p-4">
        <div className="text-xs text-muted mb-2">Stock total</div>
        <div className="space-y-1.5 tabular-nums">
          <div>
            <div className="text-[10px] text-muted leading-none mb-0.5">Piezas</div>
            <div className="text-xl font-semibold text-text leading-tight">
              {fmtNumberSmart(totalPieces)}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted leading-none mb-0.5">Metales padre</div>
            <div className="text-xl font-semibold text-text leading-tight">
              {fmtNumberSmart(totalGrams)}
              <span className="text-xs font-normal text-muted ml-1">g</span>
            </div>
          </div>
        </div>
      </TPCard>
    </div>
  );
}
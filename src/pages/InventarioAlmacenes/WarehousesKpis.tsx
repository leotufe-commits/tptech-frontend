import React from "react";
import { TPCard } from "../../components/ui/TPCard";

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
        <div className="text-xs text-muted">Stock</div>
        <div className="mt-1 text-sm text-text tabular-nums">
          <div>{totalGrams} g</div>
          <div>{totalPieces} piezas</div>
        </div>
      </TPCard>
    </div>
  );
}
// src/context/InventoryContext.tsx
// Contexto mínimo — solo expone lista de almacenes reales para componentes globales
// (UserView, useUsersPage). Las páginas de inventario usan sus propios hooks/api.
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "../lib/api";

/* =========================
   Events
========================= */
export const TPTECH_WAREHOUSES_CHANGED = "tptech:warehouses-changed";
export const TPTECH_MOVEMENTS_CHANGED = "tptech:movements-changed";
export const TPTECH_INVENTORY_CHANGED = "tptech:inventory-changed";

/* =========================
   Types
========================= */
export type TipoMov = "Entrada" | "Salida" | "Ajuste";

export type WarehouseRow = {
  id: string;
  jewelryId?: string;
  name: string;
  code: string;
  notes?: string;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // compat legacy
  nombre?: string;
  codigo?: string;
  ubicacion?: string;
  activo?: boolean;
};

type InventoryState = {
  almacenes: WarehouseRow[];
  loadingWarehouses: boolean;
  favoriteWarehouseId: string | null;
  refetch: () => Promise<void>;
};

const Ctx = createContext<InventoryState | null>(null);

function normRow(x: any): WarehouseRow {
  const name = String(x?.name ?? x?.nombre ?? "").trim();
  const code = String(x?.code ?? x?.codigo ?? "").trim();
  const notes = String(x?.notes ?? x?.ubicacion ?? x?.location ?? "").trim();
  const isActive =
    typeof x?.isActive === "boolean" ? x.isActive : typeof x?.activo === "boolean" ? x.activo : true;
  return {
    id: String(x?.id ?? ""),
    jewelryId: x?.jewelryId ? String(x.jewelryId) : undefined,
    name, code, notes, isActive,
    deletedAt: x?.deletedAt ?? null,
    createdAt: x?.createdAt,
    updatedAt: x?.updatedAt,
    nombre: name,
    codigo: code,
    ubicacion: notes,
    activo: isActive,
  };
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);
  const [favoriteWarehouseId, setFavoriteWarehouseId] = useState<string | null>(null);

  async function refetch() {
    setLoadingWarehouses(true);
    try {
      const r = await apiFetch("/warehouses", { method: "GET" as any });
      const rows: any[] = Array.isArray((r as any)?.rows) ? (r as any).rows : Array.isArray(r) ? (r as any) : [];
      setWarehouses(rows.map(normRow));

      try {
        const me = await apiFetch("/auth/me", { method: "GET" as any });
        const fav = (me as any)?.user?.favoriteWarehouseId ?? (me as any)?.favoriteWarehouseId ?? null;
        setFavoriteWarehouseId(fav ? String(fav) : null);
      } catch {
        // noop
      }
    } catch {
      // noop — no romper el layout si falla
    } finally {
      setLoadingWarehouses(false);
    }
  }

  useEffect(() => {
    void refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onChange = () => void refetch();
    window.addEventListener(TPTECH_WAREHOUSES_CHANGED, onChange);
    window.addEventListener(TPTECH_MOVEMENTS_CHANGED, onChange);
    window.addEventListener(TPTECH_INVENTORY_CHANGED, onChange);
    return () => {
      window.removeEventListener(TPTECH_WAREHOUSES_CHANGED, onChange);
      window.removeEventListener(TPTECH_MOVEMENTS_CHANGED, onChange);
      window.removeEventListener(TPTECH_INVENTORY_CHANGED, onChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<InventoryState>(
    () => ({ almacenes: warehouses, loadingWarehouses, favoriteWarehouseId, refetch }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [warehouses, loadingWarehouses, favoriteWarehouseId]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInventory() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInventory debe usarse dentro de InventoryProvider");
  return ctx;
}

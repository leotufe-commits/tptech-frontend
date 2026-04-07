// src/context/InventoryContext.tsx
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiFetch } from "../lib/api";

/* =========================
   Events (auto refresh)
========================= */
export const TPTECH_WAREHOUSES_CHANGED = "tptech:warehouses-changed";
export const TPTECH_MOVEMENTS_CHANGED = "tptech:movements-changed";
export const TPTECH_INVENTORY_CHANGED = "tptech:inventory-changed"; // fallback

/* =========================
   Types (legacy demo)
========================= */
export type Categoria = "Anillos" | "Cadenas" | "Aros" | "Pulseras" | "Dijes" | "Otros";
export type Metal = "Oro amarillo" | "Oro blanco" | "Oro rosa" | "Plata";
export type TipoMov = "Entrada" | "Salida" | "Ajuste";

export type Almacen = {
  id: string;
  nombre: string;
  codigo: string;
  ubicacion: string;
  activo: boolean;
};

export type Articulo = {
  id: string;
  sku: string;
  nombre: string;
  categoria: Categoria;
  metal: Metal;
  precio: number; // ARS
  activo: boolean;

  // stock por almacén
  stockByAlmacen: Record<string, number>;
};

export type Movimiento = {
  id: string;
  fechaISO: string;
  tipo: TipoMov;
  articuloId: string;
  almacenId: string;
  cantidad: number;
  observacion: string;
};

/* =========================
   Types (real backend)
========================= */
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

  // compat UI (para pantallas viejas / mixto)
  nombre?: string;
  codigo?: string;
  ubicacion?: string;
  activo?: boolean;
};

type InventoryState = {
  // ✅ real
  almacenes: WarehouseRow[];

  // (legacy demo)
  articulos: Articulo[];
  movimientos: Movimiento[];

  // UX helpers
  loadingWarehouses: boolean;
  refetch: () => Promise<void>;

  // favorites
  favoriteWarehouseId: string | null;
  setFavoriteWarehouse: (warehouseId: string) => Promise<void>;

  // Warehouses CRUD (real)
  createWarehouse: (data: { name: string; code?: string; notes?: string }) => Promise<WarehouseRow>;
  updateWarehouse: (id: string, data: { name: string; code?: string; notes?: string }) => Promise<WarehouseRow>;
  toggleWarehouseActive: (id: string) => Promise<WarehouseRow>;
  deleteWarehouse: (id: string) => Promise<WarehouseRow>;

  // helpers (legacy demo)
  getStockTotal: (articulo: Articulo) => number;

  // CRUD almacenes (legacy demo, mantenemos para no romper otras pantallas)
  addAlmacen: (a: Omit<Almacen, "id">) => void;
  updateAlmacen: (id: string, patch: Partial<Omit<Almacen, "id">>) => void;
  deleteAlmacen: (id: string) => void;

  // CRUD artículos (legacy demo)
  addArticulo: (a: Omit<Articulo, "id" | "stockByAlmacen"> & { stockTotal?: number }) => void;
  updateArticulo: (id: string, patch: Partial<Omit<Articulo, "id" | "stockByAlmacen">>) => void;
  deleteArticulo: (id: string) => void;

  // Movimientos (legacy demo)
  addMovimiento: (m: Omit<Movimiento, "id" | "fechaISO">) => { ok: boolean; error?: string };
};

const Ctx = createContext<InventoryState | null>(null);

/* =========================
   Seed (legacy demo)
========================= */
const seedAlmacenes: Almacen[] = [
  { id: "a1", nombre: "Depósito Central", codigo: "DEP-CEN", ubicacion: "Casa Central", activo: true },
  { id: "a2", nombre: "Showroom", codigo: "SHW-01", ubicacion: "Local", activo: true },
];

const seedArticulos: Articulo[] = [
  {
    id: "p1",
    sku: "A195",
    nombre: "Anillo cinta",
    categoria: "Anillos",
    metal: "Oro amarillo",
    precio: 245000,
    activo: true,
    stockByAlmacen: { a1: 2, a2: 1 },
  },
  {
    id: "p2",
    sku: "A197",
    nombre: "Anillo corazón",
    categoria: "Anillos",
    metal: "Oro amarillo",
    precio: 289000,
    activo: true,
    stockByAlmacen: { a1: 0, a2: 0 },
  },
  {
    id: "p3",
    sku: "C07R",
    nombre: "Cadena rolo",
    categoria: "Cadenas",
    metal: "Oro amarillo",
    precio: 180000,
    activo: true,
    stockByAlmacen: { a1: 12, a2: 0 },
  },
];

function sumStock(stockByAlmacen: Record<string, number>) {
  return Object.values(stockByAlmacen || {}).reduce((acc, n) => acc + (Number.isFinite(n) ? n : 0), 0);
}

function normWarehouseRow(x: any): WarehouseRow {
  const name = String(x?.name ?? x?.nombre ?? "").trim();
  const code = String(x?.code ?? x?.codigo ?? "").trim();
  const notes = String(x?.notes ?? x?.ubicacion ?? x?.location ?? "").trim();

  const isActive =
    typeof x?.isActive === "boolean" ? x.isActive : typeof x?.activo === "boolean" ? x.activo : true;

  const row: WarehouseRow = {
    id: String(x?.id ?? ""),
    jewelryId: x?.jewelryId ? String(x.jewelryId) : undefined,

    name,
    code,
    notes,

    isActive,
    deletedAt: x?.deletedAt ?? null,

    createdAt: x?.createdAt,
    updatedAt: x?.updatedAt,

    // compat
    nombre: name,
    codigo: code,
    ubicacion: notes,
    activo: isActive,
  };

  return row;
}

/* =========================
   Provider
========================= */
export function InventoryProvider({ children }: { children: ReactNode }) {
  // ✅ real
  const [warehouses, setWarehouses] = useState<WarehouseRow[]>([]);
  const [favoriteWarehouseId, setFavoriteWarehouseId] = useState<string | null>(null);
  const [loadingWarehouses, setLoadingWarehouses] = useState(false);

  // (legacy demo)
  const [almacenesDemo, setAlmacenesDemo] = useState<Almacen[]>(seedAlmacenes);
  const [articulos, setArticulos] = useState<Articulo[]>(seedArticulos);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  const getStockTotal = (articulo: Articulo) => sumStock(articulo.stockByAlmacen);

  async function refetch() {
    setLoadingWarehouses(true);
    try {
      // ✅ Warehouses
      let rows: any[] = [];
      const r = await apiFetch("/warehouses", { method: "GET" as any });
      rows = Array.isArray((r as any)?.rows) ? (r as any).rows : Array.isArray(r) ? (r as any) : [];

      const normalized = (rows || []).map(normWarehouseRow);

      // si todavía no hay backend o está vacío, mantenemos el demo como fallback visual (mixto)
      if (normalized.length > 0) {
        setWarehouses(normalized);
      } else if (warehouses.length === 0) {
        setWarehouses(
          almacenesDemo.map((a) =>
            normWarehouseRow({
              id: a.id,
              name: a.nombre,
              code: a.codigo,
              notes: a.ubicacion,
              isActive: a.activo,
              deletedAt: null,
            })
          )
        );
      }

      // ✅ Favorite (si existe endpoint)
      try {
        const me = await apiFetch("/auth/me", { method: "GET" as any });
        const fav = (me as any)?.user?.favoriteWarehouseId ?? (me as any)?.favoriteWarehouseId ?? null;
        setFavoriteWarehouseId(fav ? String(fav) : null);
      } catch {
        // noop
      }
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

  // -------------------------
  // REAL: Warehouses API
  // -------------------------
  async function createWarehouse(data: { name: string; code?: string; notes?: string }) {
    // backend típico: POST /warehouses/create
    const r = await apiFetch("/warehouses/create", { method: "POST", body: data });
    const row = normWarehouseRow(r);
    await refetch();
    window.dispatchEvent(new CustomEvent(TPTECH_WAREHOUSES_CHANGED, { detail: { kind: "created", id: row.id } }));
    return row;
  }

  async function updateWarehouse(id: string, data: { name: string; code?: string; notes?: string }) {
    // backend típico: POST /warehouses/:id/update  (o PUT)
    let r: any;
    try {
      r = await apiFetch(`/warehouses/${encodeURIComponent(id)}/update`, { method: "POST", body: data });
    } catch {
      r = await apiFetch(`/warehouses/${encodeURIComponent(id)}`, { method: "PUT" as any, body: data });
    }
    const row = normWarehouseRow(r);
    await refetch();
    window.dispatchEvent(new CustomEvent(TPTECH_WAREHOUSES_CHANGED, { detail: { kind: "updated", id } }));
    return row;
  }

  async function toggleWarehouseActive(id: string) {
    // backend típico: POST /warehouses/:id/toggle
    let r: any;
    try {
      r = await apiFetch(`/warehouses/${encodeURIComponent(id)}/toggle`, { method: "POST", body: {} });
    } catch {
      r = await apiFetch(`/warehouses/${encodeURIComponent(id)}/toggle`, { method: "PATCH" as any, body: {} });
    }
    const row = normWarehouseRow(r);
    await refetch();
    window.dispatchEvent(
      new CustomEvent(TPTECH_WAREHOUSES_CHANGED, { detail: { kind: "active-changed", id, isActive: row.isActive } })
    );
    return row;
  }

  async function deleteWarehouse(id: string) {
    // backend típico: POST /warehouses/:id/delete  (soft delete)
    let r: any;
    try {
      r = await apiFetch(`/warehouses/${encodeURIComponent(id)}/delete`, { method: "POST", body: {} });
    } catch {
      r = await apiFetch(`/warehouses/${encodeURIComponent(id)}`, { method: "DELETE" as any });
    }
    const row = normWarehouseRow(r);
    await refetch();
    window.dispatchEvent(new CustomEvent(TPTECH_WAREHOUSES_CHANGED, { detail: { kind: "deleted", id } }));
    return row;
  }

  async function setFavoriteWarehouse(warehouseId: string) {
    const id = String(warehouseId || "").trim();
    if (!id) return;

    // intentamos endpoint estándar
    try {
      await apiFetch("/users/me/favorite-warehouse", { method: "POST", body: { warehouseId: id } });
      setFavoriteWarehouseId(id);
      window.dispatchEvent(new CustomEvent(TPTECH_WAREHOUSES_CHANGED, { detail: { kind: "favorite", id } }));
      return;
    } catch {
      // fallback: solo UI
      setFavoriteWarehouseId(id);
      window.dispatchEvent(new CustomEvent(TPTECH_WAREHOUSES_CHANGED, { detail: { kind: "favorite", id } }));
    }
  }

  // -------------------------
  // LEGACY DEMO CRUD (kept)
  // -------------------------
  function addAlmacen(a: Omit<Almacen, "id">) {
    const id = `al_${Date.now()}`;
    const nuevo: Almacen = { id, ...a };

    setAlmacenesDemo((prev) => [nuevo, ...prev]);

    setArticulos((prev) =>
      prev.map((art) => ({
        ...art,
        stockByAlmacen: {
          ...(art.stockByAlmacen || {}),
          [id]: art.stockByAlmacen?.[id] ?? 0,
        },
      }))
    );
  }

  function updateAlmacen(id: string, patch: Partial<Omit<Almacen, "id">>) {
    setAlmacenesDemo((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function deleteAlmacen(id: string) {
    setAlmacenesDemo((prev) => prev.filter((a) => a.id !== id));

    setArticulos((prev) =>
      prev.map((art) => {
        const next = { ...(art.stockByAlmacen || {}) };
        delete next[id];
        return { ...art, stockByAlmacen: next };
      })
    );

    setMovimientos((prev) => prev.filter((m) => m.almacenId !== id));
  }

  function addArticulo(a: Omit<Articulo, "id" | "stockByAlmacen"> & { stockTotal?: number }) {
    const id = `p_${Date.now()}`;
    const firstAlmacenId = almacenesDemo[0]?.id;

    const stockTotal = Math.max(0, a.stockTotal ?? 0);
    const stockByAlmacen: Record<string, number> = {};

    if (firstAlmacenId) stockByAlmacen[firstAlmacenId] = stockTotal;

    for (const al of almacenesDemo) {
      if (stockByAlmacen[al.id] == null) stockByAlmacen[al.id] = 0;
    }

    setArticulos((prev) => [
      {
        id,
        sku: a.sku,
        nombre: a.nombre,
        categoria: a.categoria,
        metal: a.metal,
        precio: a.precio,
        activo: a.activo,
        stockByAlmacen,
      },
      ...prev,
    ]);
  }

  function updateArticulo(id: string, patch: Partial<Omit<Articulo, "id" | "stockByAlmacen">>) {
    setArticulos((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }

  function deleteArticulo(id: string) {
    setArticulos((prev) => prev.filter((x) => x.id !== id));
    setMovimientos((prev) => prev.filter((m) => m.articuloId !== id));
  }

  function addMovimiento(m: Omit<Movimiento, "id" | "fechaISO">) {
    const art = articulos.find((a) => a.id === m.articuloId);
    const al = almacenesDemo.find((a) => a.id === m.almacenId);
    if (!art) return { ok: false, error: "Artículo no encontrado." };
    if (!al) return { ok: false, error: "Almacén no encontrado." };

    const qty = Math.floor(m.cantidad);
    if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Cantidad inválida." };

    const current = art.stockByAlmacen?.[m.almacenId] ?? 0;

    let next = current;
    if (m.tipo === "Entrada") next = current + qty;
    if (m.tipo === "Salida") next = current - qty;
    if (m.tipo === "Ajuste") next = qty;

    if (next < 0) return { ok: false, error: "Stock insuficiente para realizar la salida." };

    setArticulos((prev) =>
      prev.map((x) =>
        x.id !== m.articuloId
          ? x
          : {
              ...x,
              stockByAlmacen: {
                ...(x.stockByAlmacen || {}),
                [m.almacenId]: next,
              },
            }
      )
    );

    const newMov: Movimiento = {
      id: `m_${Date.now()}`,
      fechaISO: new Date().toISOString(),
      tipo: m.tipo,
      articuloId: m.articuloId,
      almacenId: m.almacenId,
      cantidad: qty,
      observacion: (m.observacion ?? "").trim(),
    };

    setMovimientos((prev) => [newMov, ...prev]);

    return { ok: true as const };
  }

  // ✅ Lo que exportamos como "almacenes" para la app es el modelo REAL normalizado
  const almacenes = warehouses.length > 0 ? warehouses : [];

  const value = useMemo<InventoryState>(
    () => ({
      almacenes,

      articulos,
      movimientos,

      loadingWarehouses,
      refetch,

      favoriteWarehouseId,
      setFavoriteWarehouse,

      createWarehouse,
      updateWarehouse,
      toggleWarehouseActive,
      deleteWarehouse,

      // legacy
      getStockTotal,
      addAlmacen,
      updateAlmacen,
      deleteAlmacen,
      addArticulo,
      updateArticulo,
      deleteArticulo,
      addMovimiento,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [almacenes, articulos, movimientos, loadingWarehouses, favoriteWarehouseId]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInventory() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInventory debe usarse dentro de InventoryProvider");
  return ctx;
}
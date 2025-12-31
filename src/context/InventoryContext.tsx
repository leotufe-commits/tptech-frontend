import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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

type InventoryState = {
  almacenes: Almacen[];
  articulos: Articulo[];
  movimientos: Movimiento[];

  getStockTotal: (articulo: Articulo) => number;

  // CRUD almacenes
  addAlmacen: (a: Omit<Almacen, "id">) => void;
  updateAlmacen: (id: string, patch: Partial<Omit<Almacen, "id">>) => void;
  deleteAlmacen: (id: string) => void;

  // CRUD artículos
  addArticulo: (a: Omit<Articulo, "id" | "stockByAlmacen"> & { stockTotal?: number }) => void;
  updateArticulo: (id: string, patch: Partial<Omit<Articulo, "id" | "stockByAlmacen">>) => void;
  deleteArticulo: (id: string) => void;

  // Movimientos
  addMovimiento: (m: Omit<Movimiento, "id" | "fechaISO">) => { ok: boolean; error?: string };
};

const Ctx = createContext<InventoryState | null>(null);

function sumStock(stockByAlmacen: Record<string, number>) {
  return Object.values(stockByAlmacen || {}).reduce(
    (acc, n) => acc + (Number.isFinite(n) ? n : 0),
    0
  );
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [almacenes, setAlmacenes] = useState<Almacen[]>(seedAlmacenes);
  const [articulos, setArticulos] = useState<Articulo[]>(seedArticulos);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);

  const getStockTotal = (articulo: Articulo) => sumStock(articulo.stockByAlmacen);

  // -------------------------
  // CRUD ALMACENES
  // -------------------------
  function addAlmacen(a: Omit<Almacen, "id">) {
    const id = `al_${Date.now()}`;
    const nuevo: Almacen = { id, ...a };

    setAlmacenes((prev) => [nuevo, ...prev]);

    // asegurar la key en todos los artículos
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
    setAlmacenes((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function deleteAlmacen(id: string) {
    setAlmacenes((prev) => prev.filter((a) => a.id !== id));

    setArticulos((prev) =>
      prev.map((art) => {
        const next = { ...(art.stockByAlmacen || {}) };
        delete next[id];
        return { ...art, stockByAlmacen: next };
      })
    );

    setMovimientos((prev) => prev.filter((m) => m.almacenId !== id));
  }

  // -------------------------
  // CRUD ARTICULOS
  // -------------------------
  function addArticulo(a: Omit<Articulo, "id" | "stockByAlmacen"> & { stockTotal?: number }) {
    const id = `p_${Date.now()}`;
    const firstAlmacenId = almacenes[0]?.id;

    const stockTotal = Math.max(0, a.stockTotal ?? 0);
    const stockByAlmacen: Record<string, number> = {};

    if (firstAlmacenId) stockByAlmacen[firstAlmacenId] = stockTotal;

    for (const al of almacenes) {
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

  // -------------------------
  // MOVIMIENTOS
  // -------------------------
  function addMovimiento(m: Omit<Movimiento, "id" | "fechaISO">) {
    const art = articulos.find((a) => a.id === m.articuloId);
    const al = almacenes.find((a) => a.id === m.almacenId);
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

  const value = useMemo<InventoryState>(
    () => ({
      almacenes,
      articulos,
      movimientos,
      getStockTotal,
      addAlmacen,
      updateAlmacen,
      deleteAlmacen,
      addArticulo,
      updateArticulo,
      deleteArticulo,
      addMovimiento,
    }),
    [almacenes, articulos, movimientos]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInventory() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useInventory debe usarse dentro de InventoryProvider");
  return ctx;
}

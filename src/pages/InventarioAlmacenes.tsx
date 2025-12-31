import { useMemo, useState } from "react";
import { useInventory } from "../context/InventoryContext";

function sumByAlmacen(articulos: any[], almacenId: string) {
  return articulos.reduce(
    (acc, a) => acc + (a.stockByAlacen?.[almacenId] ?? a.stockByAlmacen?.[almacenId] ?? 0),
    0
  );
}

function StockBadge({ n }: { n: number }) {
  if (n === 0) {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
        0
      </span>
    );
  }
  if (n <= 5) {
    return (
      <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
        {n}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
      {n}
    </span>
  );
}

export default function InventarioAlmacenes() {
  const { almacenes, articulos, getStockTotal } = useInventory();

  const [q, setQ] = useState("");
  const [openDetail, setOpenDetail] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dq, setDq] = useState("");

  const filteredAlmacenes = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return almacenes;
    return almacenes.filter(
      (x) =>
        x.nombre.toLowerCase().includes(qq) ||
        x.codigo.toLowerCase().includes(qq) ||
        x.ubicacion.toLowerCase().includes(qq)
    );
  }, [almacenes, q]);

  const detailAlmacen = useMemo(() => {
    if (!detailId) return null;
    return almacenes.find((a) => a.id === detailId) ?? null;
  }, [almacenes, detailId]);

  const detailRows = useMemo(() => {
    if (!detailId) return [];
    const qq = dq.trim().toLowerCase();

    const rows = articulos.map((a: any) => {
      const stockHere = a.stockByAlmacen?.[detailId] ?? 0;
      return {
        id: a.id,
        sku: a.sku,
        nombre: a.nombre,
        metal: a.metal,
        categoria: a.categoria,
        activo: a.activo,
        stockHere,
        stockTotal: getStockTotal(a),
      };
    });

    if (!qq) return rows;

    return rows.filter(
      (r) =>
        r.sku.toLowerCase().includes(qq) ||
        r.nombre.toLowerCase().includes(qq) ||
        r.metal.toLowerCase().includes(qq) ||
        r.categoria.toLowerCase().includes(qq)
    );
  }, [articulos, detailId, dq, getStockTotal]);

  function openAlmacen(id: string) {
    setDetailId(id);
    setDq("");
    setOpenDetail(true);
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-zinc-500">Inventario</div>
        <div className="text-lg font-semibold text-zinc-900">Almacenes</div>
        <div className="mt-1 text-sm text-zinc-600">
          Stock por depósito / local (✅ conectado a Movimientos).
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="text-xs font-medium text-zinc-600">Buscar almacén</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, código, ubicación…"
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <div className="text-sm font-medium text-zinc-900">
            Almacenes: {filteredAlmacenes.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">Código</th>
                <th className="px-5 py-3">Ubicación</th>
                <th className="px-5 py-3">Stock total</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200">
              {filteredAlmacenes.map((x) => {
                const stock = sumByAlmacen(articulos as any[], x.id);
                return (
                  <tr key={x.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 font-semibold text-zinc-900">{x.nombre}</td>
                    <td className="px-5 py-3 text-zinc-700">{x.codigo}</td>
                    <td className="px-5 py-3 text-zinc-700">{x.ubicacion}</td>
                    <td className="px-5 py-3">
                      <StockBadge n={stock} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
                        onClick={() => openAlmacen(x.id)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                );
              })}

              {filteredAlmacenes.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-zinc-500"
                  >
                    No hay almacenes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {openDetail && detailAlmacen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-zinc-900/40"
            onClick={() => setOpenDetail(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
              <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
                <div>
                  <div className="text-xs font-medium text-zinc-500">Detalle de almacén</div>
                  <div className="text-sm font-semibold text-zinc-900">
                    {detailAlmacen.nombre} ({detailAlmacen.codigo})
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">{detailAlmacen.ubicacion}</div>
                </div>

                <button
                  onClick={() => setOpenDetail(false)}
                  className="rounded-lg px-2 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                >
                  ✕
                </button>
              </div>

              <div className="p-5">
                <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
                  <label className="text-xs font-medium text-zinc-600">Buscar artículo</label>
                  <input
                    value={dq}
                    onChange={(e) => setDq(e.target.value)}
                    placeholder="SKU, nombre, metal, categoría…"
                    className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
                  />
                </div>

                <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                  <div className="border-b border-zinc-200 px-5 py-4">
                    <div className="text-sm font-medium text-zinc-900">
                      Artículos en este almacén: {detailRows.length}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                        <tr>
                          <th className="px-5 py-3">SKU</th>
                          <th className="px-5 py-3">Nombre</th>
                          <th className="px-5 py-3">Categoría</th>
                          <th className="px-5 py-3">Metal</th>
                          <th className="px-5 py-3">Stock aquí</th>
                          <th className="px-5 py-3">Stock total</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-zinc-200">
                        {detailRows.map((r) => (
                          <tr key={r.id} className="hover:bg-zinc-50">
                            <td className="px-5 py-3 font-semibold text-zinc-900">{r.sku}</td>
                            <td className="px-5 py-3 text-zinc-700">{r.nombre}</td>
                            <td className="px-5 py-3 text-zinc-700">{r.categoria}</td>
                            <td className="px-5 py-3 text-zinc-700">{r.metal}</td>
                            <td className="px-5 py-3">
                              <StockBadge n={r.stockHere} />
                            </td>
                            <td className="px-5 py-3">
                              <StockBadge n={r.stockTotal} />
                            </td>
                          </tr>
                        ))}

                        {detailRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-5 py-10 text-center text-sm text-zinc-500"
                            >
                              No hay resultados.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="mt-4 text-xs text-zinc-500">
                  Tip: si registrás un movimiento en este almacén, acá lo vas a ver reflejado al instante.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useInventory, type TipoMov } from "../context/InventoryContext";

function fmtFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

function badgeTipo(t: TipoMov) {
  const base = "rounded-full px-2 py-1 text-xs font-semibold";
  if (t === "Entrada")
    return <span className={`${base} bg-emerald-50 text-emerald-700`}>Entrada</span>;
  if (t === "Salida")
    return <span className={`${base} bg-red-50 text-red-700`}>Salida</span>;
  return <span className={`${base} bg-orange-50 text-orange-700`}>Ajuste</span>;
}

export default function InventarioMovimientos() {
  const { articulos, almacenes, movimientos, addMovimiento } = useInventory();

  const [tipo, setTipo] = useState<TipoMov>("Entrada");
  const [articuloId, setArticuloId] = useState<string>("");
  const [almacenId, setAlmacenId] = useState<string>("");
  const [cantidad, setCantidad] = useState<string>("1");
  const [observacion, setObservacion] = useState<string>("");
  const [q, setQ] = useState("");
  const [errorTop, setErrorTop] = useState<string>("");

  // ✅ asegurar defaults cuando cargan/cambian artículos/almacenes
  useEffect(() => {
    if (!articuloId && articulos.length > 0) {
      setArticuloId(articulos[0].id);
      return;
    }
    if (articuloId && articulos.length > 0 && !articulos.some((a) => a.id === articuloId)) {
      setArticuloId(articulos[0].id);
    }
  }, [articulos, articuloId]);

  useEffect(() => {
    if (!almacenId && almacenes.length > 0) {
      setAlmacenId(almacenes[0].id);
      return;
    }
    if (almacenId && almacenes.length > 0 && !almacenes.some((a) => a.id === almacenId)) {
      setAlmacenId(almacenes[0].id);
    }
  }, [almacenes, almacenId]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return movimientos;

    return movimientos.filter((m) => {
      const a = articulos.find((x) => x.id === m.articuloId);
      const al = almacenes.find((x) => x.id === m.almacenId);
      return (
        m.tipo.toLowerCase().includes(qq) ||
        (a?.sku ?? "").toLowerCase().includes(qq) ||
        (a?.nombre ?? "").toLowerCase().includes(qq) ||
        (al?.codigo ?? "").toLowerCase().includes(qq) ||
        (al?.nombre ?? "").toLowerCase().includes(qq) ||
        (m.observacion ?? "").toLowerCase().includes(qq)
      );
    });
  }, [movimientos, q, articulos, almacenes]);

  function registrar() {
    setErrorTop("");

    if (!articuloId) {
      setErrorTop("Seleccioná un artículo.");
      return;
    }
    if (!almacenId) {
      setErrorTop("Seleccioná un almacén.");
      return;
    }

    const qty = Number(onlyDigits(cantidad));
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrorTop("Cantidad inválida.");
      return;
    }

    const res = addMovimiento({
      tipo,
      articuloId,
      almacenId,
      cantidad: qty,
      observacion,
    });

    if (!res.ok) {
      setErrorTop(res.error || "No se pudo registrar.");
      return;
    }

    setCantidad("1");
    setObservacion("");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-zinc-500">Inventario</div>
        <div className="text-lg font-semibold text-zinc-900">Movimientos</div>
        <div className="mt-1 text-sm text-zinc-600">
          Entradas / salidas / ajustes (✅ impactan el stock real).
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        {errorTop && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {errorTop}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-zinc-600">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoMov)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            >
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
              <option value="Ajuste">Ajuste</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="text-xs font-medium text-zinc-600">Artículo</label>
            <select
              value={articuloId}
              onChange={(e) => setArticuloId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            >
              {articulos.length === 0 ? (
                <option value="">(Sin artículos)</option>
              ) : (
                articulos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.sku} — {a.nombre}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-xs font-medium text-zinc-600">Almacén</label>
            <select
              value={almacenId}
              onChange={(e) => setAlmacenId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            >
              {almacenes.length === 0 ? (
                <option value="">(Sin almacenes)</option>
              ) : (
                almacenes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} — {a.nombre}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-medium text-zinc-600">Cantidad</label>
            <input
              value={cantidad}
              onChange={(e) => setCantidad(onlyDigits(e.target.value))}
              inputMode="numeric"
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <div className="md:col-span-10">
            <label className="text-xs font-medium text-zinc-600">Observación</label>
            <input
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: ingreso por compra / salida a cliente / ajuste..."
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={registrar}
              className="w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              disabled={articulos.length === 0 || almacenes.length === 0}
            >
              Registrar
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <label className="text-xs font-medium text-zinc-600">Buscar</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tipo, SKU, artículo, almacén, observación…"
          className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <div className="text-sm font-medium text-zinc-900">Movimientos: {filtered.length}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Tipo</th>
                <th className="px-5 py-3">Artículo</th>
                <th className="px-5 py-3">Almacén</th>
                <th className="px-5 py-3">Cantidad</th>
                <th className="px-5 py-3">Observación</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200">
              {filtered.map((m) => {
                const a = articulos.find((x) => x.id === m.articuloId);
                const al = almacenes.find((x) => x.id === m.almacenId);
                return (
                  <tr key={m.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 text-zinc-700">{fmtFecha(m.fechaISO)}</td>
                    <td className="px-5 py-3">{badgeTipo(m.tipo)}</td>
                    <td className="px-5 py-3 text-zinc-700">
                      <div className="font-semibold text-zinc-900">{a?.sku ?? "—"}</div>
                      <div className="text-xs text-zinc-500">{a?.nombre ?? ""}</div>
                    </td>
                    <td className="px-5 py-3 text-zinc-700">
                      <div className="font-semibold text-zinc-900">{al?.codigo ?? "—"}</div>
                      <div className="text-xs text-zinc-500">{al?.nombre ?? ""}</div>
                    </td>
                    <td className="px-5 py-3 font-semibold text-zinc-900">{m.cantidad}</td>
                    <td className="px-5 py-3 text-zinc-700">{m.observacion || "—"}</td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td className="px-5 py-10 text-center text-sm text-zinc-500" colSpan={6}>
                    No hay movimientos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useInventory, type TipoMov } from "../context/InventoryContext";
import { TP_INPUT, TP_SELECT, TP_BTN_PRIMARY, cn } from "../components/ui/tp";
import {
  TPTableWrap,
  TPTableHeader,
  TPTableEl,
  TPThead,
  TPTbody,
  TPTr,
  TPTh,
  TPTd,
  TPEmptyRow,
} from "../components/ui/TPTable";
import { TPTipoMovBadge } from "../components/ui/TPBadges";

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

export default function InventarioMovimientos() {
  const { articulos, almacenes, movimientos, addMovimiento } = useInventory();

  const [tipo, setTipo] = useState<TipoMov>("Entrada");
  const [articuloId, setArticuloId] = useState<string>("");
  const [almacenId, setAlmacenId] = useState<string>("");
  const [cantidad, setCantidad] = useState<string>("1");
  const [observacion, setObservacion] = useState<string>("");
  const [q, setQ] = useState("");
  const [errorTop, setErrorTop] = useState<string>("");

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

    if (!articuloId) return setErrorTop("Seleccioná un artículo.");
    if (!almacenId) return setErrorTop("Seleccioná un almacén.");

    const qty = Number(onlyDigits(cantidad));
    if (!Number.isFinite(qty) || qty <= 0) return setErrorTop("Cantidad inválida.");

    const res = addMovimiento({
      tipo,
      articuloId,
      almacenId,
      cantidad: qty,
      observacion,
    });

    if (!res.ok) return setErrorTop(res.error || "No se pudo registrar.");

    setCantidad("1");
    setObservacion("");
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-medium text-muted">Inventario</div>
        <div className="text-lg font-semibold text-text">Movimientos</div>
        <div className="mt-1 text-sm text-muted">
          Entradas / salidas / ajustes (✅ impactan el stock real).
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        {errorTop && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400">
            {errorTop}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div className="md:col-span-3">
            <label className="text-xs font-medium text-muted">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMov)} className={TP_SELECT}>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
              <option value="Ajuste">Ajuste</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <label className="text-xs font-medium text-muted">Artículo</label>
            <select value={articuloId} onChange={(e) => setArticuloId(e.target.value)} className={TP_SELECT}>
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
            <label className="text-xs font-medium text-muted">Almacén</label>
            <select value={almacenId} onChange={(e) => setAlmacenId(e.target.value)} className={TP_SELECT}>
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
            <label className="text-xs font-medium text-muted">Cantidad</label>
            <input
              value={cantidad}
              onChange={(e) => setCantidad(onlyDigits(e.target.value))}
              inputMode="numeric"
              className={TP_INPUT}
            />
          </div>

          <div className="md:col-span-10">
            <label className="text-xs font-medium text-muted">Observación</label>
            <input
              value={observacion}
              onChange={(e) => setObservacion(e.target.value)}
              placeholder="Ej: ingreso por compra / salida a cliente / ajuste..."
              className={TP_INPUT}
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={registrar}
              className={cn("w-full", TP_BTN_PRIMARY)}
              disabled={articulos.length === 0 || almacenes.length === 0}
            >
              Registrar
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs font-medium text-muted">Buscar</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Tipo, SKU, artículo, almacén, observación…"
          className={TP_INPUT}
        />
      </div>

      <TPTableWrap>
        <TPTableHeader left={`Movimientos: ${filtered.length}`} />

        <TPTableEl>
          <TPThead>
            <TPTr>
              <TPTh>Fecha</TPTh>
              <TPTh>Tipo</TPTh>
              <TPTh>Artículo</TPTh>
              <TPTh>Almacén</TPTh>
              <TPTh>Cantidad</TPTh>
              <TPTh>Observación</TPTh>
            </TPTr>
          </TPThead>

          <TPTbody>
            {filtered.map((m) => {
              const a = articulos.find((x) => x.id === m.articuloId);
              const al = almacenes.find((x) => x.id === m.almacenId);

              return (
                <TPTr key={m.id}>
                  <TPTd className="text-muted">{fmtFecha(m.fechaISO)}</TPTd>
                  <TPTd>
                    <TPTipoMovBadge tipo={m.tipo} />
                  </TPTd>

                  <TPTd>
                    <div className="font-semibold text-text">{a?.sku ?? "—"}</div>
                    <div className="text-xs text-muted">{a?.nombre ?? ""}</div>
                  </TPTd>

                  <TPTd>
                    <div className="font-semibold text-text">{al?.codigo ?? "—"}</div>
                    <div className="text-xs text-muted">{al?.nombre ?? ""}</div>
                  </TPTd>

                  <TPTd className="font-semibold text-text">{m.cantidad}</TPTd>
                  <TPTd className="text-muted">{m.observacion || "—"}</TPTd>
                </TPTr>
              );
            })}

            {filtered.length === 0 && <TPEmptyRow colSpan={6} text="No hay movimientos." />}
          </TPTbody>
        </TPTableEl>
      </TPTableWrap>
    </div>
  );
}

import { useMemo, useState, type ReactNode } from "react";
import { useInventory } from "../context/InventoryContext";
import { TP_INPUT, TP_BTN_LINK_PRIMARY, cn } from "../components/ui/tp";
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
import { TPStockBadge } from "../components/ui/TPBadges";

/* ---------------- utils ---------------- */
function sumByAlmacen(articulos: any[], almacenId: string) {
  return (articulos || []).reduce((acc, a) => {
    const by1 = a?.stockByAlmacen?.[almacenId];
    const by2 = a?.stockByAlacen?.[almacenId]; // tolerancia typo viejo
    return acc + (by1 ?? by2 ?? 0);
  }, 0);
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-border bg-surface2/30 px-5 py-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">{title}</div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:bg-surface2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              ✕
            </button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
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

    const rows = (articulos || []).map((a: any) => {
      const stockHere = a.stockByAlmacen?.[detailId] ?? a.stockByAlacen?.[detailId] ?? 0;
      return {
        id: a.id,
        sku: a.sku,
        nombre: a.nombre,
        metal: a.metal,
        categoria: a.categoria,
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
        <div className="text-xs font-medium text-muted">Inventario</div>
        <div className="text-lg font-semibold text-text">Almacenes</div>
        <div className="mt-1 text-sm text-muted">
          Stock por depósito / local (✅ conectado a Movimientos).
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <label className="text-xs font-medium text-muted">Buscar almacén</label>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, código, ubicación…"
          className={TP_INPUT}
        />
      </div>

      <TPTableWrap>
        <TPTableHeader left={`Almacenes: ${filteredAlmacenes.length}`} />

        <TPTableEl>
          <TPThead>
            <TPTr>
              <TPTh>Nombre</TPTh>
              <TPTh>Código</TPTh>
              <TPTh>Ubicación</TPTh>
              <TPTh>Stock total</TPTh>
              <TPTh className="text-right">Acciones</TPTh>
            </TPTr>
          </TPThead>

          <TPTbody>
            {filteredAlmacenes.map((x) => {
              const stock = sumByAlmacen(articulos as any[], x.id);
              return (
                <TPTr key={x.id}>
                  <TPTd className="font-semibold text-text">{x.nombre}</TPTd>
                  <TPTd className="text-muted">{x.codigo}</TPTd>
                  <TPTd className="text-muted">{x.ubicacion}</TPTd>
                  <TPTd>
                    <TPStockBadge n={stock} />
                  </TPTd>
                  <TPTd className="text-right">
                    <button className={TP_BTN_LINK_PRIMARY} onClick={() => openAlmacen(x.id)}>
                      Ver detalle
                    </button>
                  </TPTd>
                </TPTr>
              );
            })}

            {filteredAlmacenes.length === 0 && <TPEmptyRow colSpan={5} text="No hay almacenes." />}
          </TPTbody>
        </TPTableEl>
      </TPTableWrap>

      <Modal
        open={openDetail && !!detailAlmacen}
        title={
          detailAlmacen
            ? `Detalle de almacén — ${detailAlmacen.nombre} (${detailAlmacen.codigo})`
            : "Detalle de almacén"
        }
        onClose={() => setOpenDetail(false)}
      >
        {!detailAlmacen ? (
          <div className="text-sm text-muted">Almacén no encontrado.</div>
        ) : (
          <div className="space-y-4">
            <div className="text-sm text-muted">{detailAlmacen.ubicacion}</div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <label className="text-xs font-medium text-muted">Buscar artículo</label>
              <input
                value={dq}
                onChange={(e) => setDq(e.target.value)}
                placeholder="SKU, nombre, metal, categoría…"
                className={TP_INPUT}
              />
            </div>

            <TPTableWrap>
              <TPTableHeader left={`Artículos en este almacén: ${detailRows.length}`} />

              <TPTableEl>
                <TPThead>
                  <TPTr>
                    <TPTh>SKU</TPTh>
                    <TPTh>Nombre</TPTh>
                    <TPTh>Categoría</TPTh>
                    <TPTh>Metal</TPTh>
                    <TPTh>Stock aquí</TPTh>
                    <TPTh>Stock total</TPTh>
                  </TPTr>
                </TPThead>

                <TPTbody>
                  {detailRows.map((r) => (
                    <TPTr key={r.id}>
                      <TPTd className="font-semibold text-text">{r.sku}</TPTd>
                      <TPTd className="text-muted">{r.nombre}</TPTd>
                      <TPTd className="text-muted">{r.categoria}</TPTd>
                      <TPTd className="text-muted">{r.metal}</TPTd>
                      <TPTd>
                        <TPStockBadge n={r.stockHere} />
                      </TPTd>
                      <TPTd>
                        <TPStockBadge n={r.stockTotal} />
                      </TPTd>
                    </TPTr>
                  ))}

                  {detailRows.length === 0 && <TPEmptyRow colSpan={6} text="No hay resultados." />}
                </TPTbody>
              </TPTableEl>
            </TPTableWrap>

            <div className={cn("text-xs text-muted")}>
              Tip: si registrás un movimiento en este almacén, acá lo vas a ver reflejado al instante.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

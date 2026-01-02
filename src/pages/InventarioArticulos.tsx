import { useMemo, useState, type ReactNode } from "react";
import { useInventory, type Categoria, type Metal, type Articulo } from "../context/InventoryContext";

import {
  TP_INPUT,
  TP_SELECT,
  TP_BTN_PRIMARY,
  TP_BTN_SECONDARY,
  TP_BTN_LINK_PRIMARY,
  TP_BTN_DANGER,
  cn,
} from "../components/ui/tp";

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

import { TPStockBadge, TPStockLabelBadge, TPActiveBadge } from "../components/ui/TPBadges";

/* ---------------- utils ---------------- */
function moneyARS(n: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);
}

function onlyDigits(v: string) {
  return v.replace(/[^\d]/g, "");
}

function sumStock(stockByAlmacen: Record<string, number>) {
  return Object.values(stockByAlmacen || {}).reduce(
    (acc, n) => acc + (Number.isFinite(n) ? n : 0),
    0
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: unknown) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCSV(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(",")),
  ];
  return lines.join("\r\n");
}

function rowsToHTMLTable(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "<table></table>";
  const headers = Object.keys(rows[0]);

  const ths = headers.map((h) => `<th>${String(h)}</th>`).join("");
  const trs = rows
    .map((r) => {
      const tds = headers
        .map((h) => `<td>${String(r[h] ?? "")}</td>`)
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");

  return `<table border="1"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

/* ---------------- Modal + Field ---------------- */
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
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-surface2/30">
            <div className="text-sm font-semibold text-text">{title}</div>
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-muted">{label}</div>
      {children}
      {error && <div className="mt-1 text-xs font-medium text-red-500">{error}</div>}
    </div>
  );
}

/* ---------------- types ---------------- */
type SortKey = "sku" | "stock" | "precio";
type SortDir = "asc" | "desc";

export default function InventarioArticulos() {
  const { almacenes, articulos, getStockTotal, addArticulo, updateArticulo, deleteArticulo } =
    useInventory();

  // Modal stock por almacén
  const [openStockModal, setOpenStockModal] = useState(false);
  const [stockModalId, setStockModalId] = useState<string | null>(null);

  function openStock(id: string) {
    setStockModalId(id);
    setOpenStockModal(true);
  }

  // filtros
  const [q, setQ] = useState("");
  const [categoria, setCategoria] = useState<Categoria | "Todas">("Todas");
  const [soloActivos, setSoloActivos] = useState(true);

  // orden
  const [sortKey, setSortKey] = useState<SortKey>("sku");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // paginación
  const pageSize = 10;
  const [page, setPage] = useState(1);

  // modales
  const [openNew, setOpenNew] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // forms
  const [newForm, setNewForm] = useState({
    sku: "",
    nombre: "",
    categoria: "Anillos" as Categoria,
    metal: "Oro amarillo" as Metal,
    stockTotal: "0",
    precio: "0",
    activo: true,
  });

  const [editForm, setEditForm] = useState({
    sku: "",
    nombre: "",
    categoria: "Anillos" as Categoria,
    metal: "Oro amarillo" as Metal,
    precio: "0",
    activo: true,
  });

  const [newErrors, setNewErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  function resetPage() {
    setPage(1);
  }

  const filteredSorted = useMemo(() => {
    const qq = q.trim().toLowerCase();

    const filtered = articulos
      .filter((x) => (soloActivos ? x.activo : true))
      .filter((x) => (categoria === "Todas" ? true : x.categoria === categoria))
      .filter((x) => {
        if (!qq) return true;
        return (
          x.sku.toLowerCase().includes(qq) ||
          x.nombre.toLowerCase().includes(qq) ||
          x.metal.toLowerCase().includes(qq)
        );
      });

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const stockA = getStockTotal(a);
      const stockB = getStockTotal(b);

      if (sortKey === "sku") return a.sku.localeCompare(b.sku) * dir;
      if (sortKey === "stock") return (stockA - stockB) * dir;
      return (a.precio - b.precio) * dir;
    });

    return sorted;
  }, [articulos, q, categoria, soloActivos, sortKey, sortDir, getStockTotal]);

  const total = filteredSorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page]);

  function toggleSort(key: SortKey) {
    resetPage();
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  // ---- EXPORT (sin xlsx) ----
  function buildRows() {
    return filteredSorted.map((x) => ({
      SKU: x.sku,
      Nombre: x.nombre,
      Categoría: x.categoria,
      Metal: x.metal,
      Stock_Total: getStockTotal(x),
      Precio_ARS: x.precio,
      Activo: x.activo ? "Sí" : "No",
    }));
  }

  function exportCSV() {
    const rows = buildRows();
    const csv = rowsToCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, `articulos_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  // Excel “simple” (HTML -> .xls) para evitar dependencias
  function exportExcel() {
    const rows = buildRows();
    const table = rowsToHTMLTable(rows);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
</head>
<body>
${table}
</body>
</html>`;

    const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
    downloadBlob(blob, `articulos_${new Date().toISOString().slice(0, 10)}.xls`);
  }

  // ---- MODALES ----
  function openNewModal() {
    setNewErrors({});
    setNewForm({
      sku: "",
      nombre: "",
      categoria: "Anillos",
      metal: "Oro amarillo",
      stockTotal: "0",
      precio: "0",
      activo: true,
    });
    setOpenNew(true);
  }

  function validateNew() {
    const e: Record<string, string> = {};
    const sku = newForm.sku.trim();
    const nombre = newForm.nombre.trim();
    const stockTotal = Number(onlyDigits(newForm.stockTotal));
    const precio = Number(onlyDigits(newForm.precio));

    if (!sku) e.sku = "SKU es obligatorio.";
    if (sku && sku.length < 2) e.sku = "SKU demasiado corto.";
    if (!nombre) e.nombre = "Nombre es obligatorio.";
    if (stockTotal < 0) e.stockTotal = "Stock inválido.";
    if (precio <= 0) e.precio = "Precio debe ser mayor a 0.";

    const skuUpper = sku.toUpperCase();
    if (sku && articulos.some((x) => x.sku.toUpperCase() === skuUpper)) {
      e.sku = "Ese SKU ya existe.";
    }

    setNewErrors(e);
    return Object.keys(e).length === 0;
  }

  function saveNew() {
    if (!validateNew()) return;

    addArticulo({
      sku: newForm.sku.trim(),
      nombre: newForm.nombre.trim(),
      categoria: newForm.categoria,
      metal: newForm.metal,
      precio: Number(onlyDigits(newForm.precio)),
      activo: newForm.activo,
      stockTotal: Number(onlyDigits(newForm.stockTotal)),
    });

    setOpenNew(false);
    resetPage();
  }

  function openEditModal(item: Articulo) {
    setEditErrors({});
    setEditId(item.id);
    setEditForm({
      sku: item.sku,
      nombre: item.nombre,
      categoria: item.categoria,
      metal: item.metal,
      precio: String(item.precio),
      activo: item.activo,
    });
    setOpenEdit(true);
  }

  function validateEdit() {
    const e: Record<string, string> = {};
    const sku = editForm.sku.trim();
    const nombre = editForm.nombre.trim();
    const precio = Number(onlyDigits(editForm.precio));

    if (!sku) e.sku = "SKU es obligatorio.";
    if (sku && sku.length < 2) e.sku = "SKU demasiado corto.";
    if (!nombre) e.nombre = "Nombre es obligatorio.";
    if (precio <= 0) e.precio = "Precio debe ser mayor a 0.";

    const skuUpper = sku.toUpperCase();
    if (sku && articulos.some((x) => x.id !== editId && x.sku.toUpperCase() === skuUpper)) {
      e.sku = "Ese SKU ya existe.";
    }

    setEditErrors(e);
    return Object.keys(e).length === 0;
  }

  function saveEdit() {
    if (!editId) return;
    if (!validateEdit()) return;

    updateArticulo(editId, {
      sku: editForm.sku.trim(),
      nombre: editForm.nombre.trim(),
      categoria: editForm.categoria,
      metal: editForm.metal,
      precio: Number(onlyDigits(editForm.precio)),
      activo: editForm.activo,
    });

    setOpenEdit(false);
  }

  function deleteCurrent() {
    if (!editId) return;
    if (!confirm("¿Eliminar este artículo?")) return;
    deleteArticulo(editId);
    setOpenEdit(false);
    resetPage();
  }

  const stockModalItem = useMemo(() => {
    if (!stockModalId) return null;
    return articulos.find((a) => a.id === stockModalId) ?? null;
  }, [stockModalId, articulos]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-medium text-muted">Inventario</div>
          <div className="text-lg font-semibold text-text">Artículos</div>
          <div className="mt-1 text-sm text-muted">(✅ Stock se actualiza por Movimientos)</div>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <button className={TP_BTN_SECONDARY} onClick={exportCSV}>
            Exportar CSV
          </button>
          <button className={TP_BTN_SECONDARY} onClick={exportExcel}>
            Exportar Excel
          </button>
          <button className={TP_BTN_PRIMARY} onClick={openNewModal}>
            + Nuevo artículo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-12">
        <div className="md:col-span-6">
          <label className="text-xs font-medium text-muted">Buscar</label>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
            placeholder="SKU, nombre, metal…"
            className={TP_INPUT}
          />
        </div>

        <div className="md:col-span-4">
          <label className="text-xs font-medium text-muted">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value as any);
              resetPage();
            }}
            className={TP_SELECT}
          >
            <option value="Todas">Todas</option>
            <option value="Anillos">Anillos</option>
            <option value="Cadenas">Cadenas</option>
            <option value="Aros">Aros</option>
            <option value="Pulseras">Pulseras</option>
            <option value="Dijes">Dijes</option>
            <option value="Otros">Otros</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted">Estado</label>
          <button
            type="button"
            onClick={() => {
              setSoloActivos((v) => !v);
              resetPage();
            }}
            className={cn(
              "mt-1 w-full rounded-xl border px-3 py-2 text-sm font-medium transition",
              "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
              soloActivos
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border bg-card text-text hover:bg-surface2"
            )}
          >
            {soloActivos ? "Activos" : "Todos"}
          </button>
        </div>
      </div>

      {/* Tabla Base TP */}
      <TPTableWrap>
        <TPTableHeader
          left={`Resultados: ${total}`}
          right={
            <>
              <div className="text-xs text-muted">
                Página {page} / {totalPages}
              </div>
              <button
                className={TP_BTN_SECONDARY}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </button>
              <button
                className={TP_BTN_SECONDARY}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Siguiente
              </button>
            </>
          }
        />

        <TPTableEl>
          <table className="min-w-full text-left text-sm">
            <TPThead>
              <TPTr>
                <TPTh>
                  <button className="font-semibold hover:text-primary" onClick={() => toggleSort("sku")}>
                    SKU{sortIndicator("sku")}
                  </button>
                </TPTh>
                <TPTh>Nombre</TPTh>
                <TPTh>Categoría</TPTh>
                <TPTh>Metal</TPTh>
                <TPTh>
                  <button className="font-semibold hover:text-primary" onClick={() => toggleSort("stock")}>
                    Stock{sortIndicator("stock")}
                  </button>
                </TPTh>
                <TPTh>
                  <button className="font-semibold hover:text-primary" onClick={() => toggleSort("precio")}>
                    Precio{sortIndicator("precio")}
                  </button>
                </TPTh>
                <TPTh>Estado</TPTh>
                <TPTh className="text-right">Acciones</TPTh>
              </TPTr>
            </TPThead>

            <TPTbody>
              {pageItems.map((x) => {
                const stock = getStockTotal(x);
                return (
                  <TPTr key={x.id}>
                    <TPTd className="font-semibold text-text">{x.sku}</TPTd>
                    <TPTd className="text-muted">{x.nombre}</TPTd>
                    <TPTd className="text-muted">{x.categoria}</TPTd>
                    <TPTd className="text-muted">{x.metal}</TPTd>
                    <TPTd>
                      <TPStockLabelBadge n={stock} low={2} />
                    </TPTd>
                    <TPTd className="text-muted">{moneyARS(x.precio)}</TPTd>
                    <TPTd>
                      <TPActiveBadge active={x.activo} />
                    </TPTd>
                    <TPTd className="text-right">
                      <button
                        className={cn("text-text hover:bg-surface2", TP_BTN_LINK_PRIMARY)}
                        onClick={() => openStock(x.id)}
                      >
                        Stock
                      </button>
                      <button className={cn("ml-2", TP_BTN_LINK_PRIMARY)} onClick={() => openEditModal(x)}>
                        Editar
                      </button>
                    </TPTd>
                  </TPTr>
                );
              })}

              {pageItems.length === 0 && <TPEmptyRow colSpan={8} text="No hay resultados con esos filtros." />}
            </TPTbody>
          </table>
        </TPTableEl>

        <div className="flex items-center justify-between border-t border-border bg-surface2/30 px-5 py-4">
          <div className="text-xs text-muted">
            Mostrando {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className={TP_BTN_SECONDARY}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </button>
            <button
              className={TP_BTN_SECONDARY}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      </TPTableWrap>

      {/* Modal: Nuevo */}
      <Modal open={openNew} title="Nuevo artículo" onClose={() => setOpenNew(false)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="SKU" error={newErrors.sku}>
            <input
              value={newForm.sku}
              onChange={(e) => setNewForm((p) => ({ ...p, sku: e.target.value }))}
              placeholder="Ej: A195"
              className={cn(
                TP_INPUT,
                newErrors.sku && "border-red-400/40 focus:border-red-400/40 focus:ring-red-500/15"
              )}
            />
          </Field>

          <Field label="Nombre" error={newErrors.nombre}>
            <input
              value={newForm.nombre}
              onChange={(e) => setNewForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Anillo cinta"
              className={cn(
                TP_INPUT,
                newErrors.nombre && "border-red-400/40 focus:border-red-400/40 focus:ring-red-500/15"
              )}
            />
          </Field>

          <Field label="Categoría">
            <select
              value={newForm.categoria}
              onChange={(e) => setNewForm((p) => ({ ...p, categoria: e.target.value as Categoria }))}
              className={TP_SELECT}
            >
              <option value="Anillos">Anillos</option>
              <option value="Cadenas">Cadenas</option>
              <option value="Aros">Aros</option>
              <option value="Pulseras">Pulseras</option>
              <option value="Dijes">Dijes</option>
              <option value="Otros">Otros</option>
            </select>
          </Field>

          <Field label="Metal">
            <select
              value={newForm.metal}
              onChange={(e) => setNewForm((p) => ({ ...p, metal: e.target.value as Metal }))}
              className={TP_SELECT}
            >
              <option value="Oro amarillo">Oro amarillo</option>
              <option value="Oro blanco">Oro blanco</option>
              <option value="Oro rosa">Oro rosa</option>
              <option value="Plata">Plata</option>
            </select>
          </Field>

          <Field label="Stock total inicial" error={newErrors.stockTotal}>
            <input
              value={newForm.stockTotal}
              onChange={(e) => setNewForm((p) => ({ ...p, stockTotal: onlyDigits(e.target.value) }))}
              inputMode="numeric"
              className={cn(
                TP_INPUT,
                newErrors.stockTotal && "border-red-400/40 focus:border-red-400/40 focus:ring-red-500/15"
              )}
            />
          </Field>

          <Field label="Precio (ARS)" error={newErrors.precio}>
            <input
              value={newForm.precio}
              onChange={(e) => setNewForm((p) => ({ ...p, precio: onlyDigits(e.target.value) }))}
              inputMode="numeric"
              className={cn(
                TP_INPUT,
                newErrors.precio && "border-red-400/40 focus:border-red-400/40 focus:ring-red-500/15"
              )}
            />
          </Field>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={newForm.activo}
                onChange={(e) => setNewForm((p) => ({ ...p, activo: e.target.checked }))}
                className="h-4 w-4 rounded border-border bg-surface"
              />
              Activo
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
          <button className={TP_BTN_SECONDARY} onClick={() => setOpenNew(false)}>
            Cancelar
          </button>
          <button className={TP_BTN_PRIMARY} onClick={saveNew}>
            Guardar
          </button>
        </div>
      </Modal>

      {/* Modal: Editar */}
      <Modal open={openEdit} title="Editar artículo" onClose={() => setOpenEdit(false)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="SKU" error={editErrors.sku}>
            <input
              value={editForm.sku}
              onChange={(e) => setEditForm((p) => ({ ...p, sku: e.target.value }))}
              className={cn(
                TP_INPUT,
                editErrors.sku && "border-red-400/40 focus:border-red-400/40 focus:ring-red-500/15"
              )}
            />
          </Field>

          <Field label="Nombre" error={editErrors.nombre}>
            <input
              value={editForm.nombre}
              onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
              className={cn(
                TP_INPUT,
                editErrors.nombre && "border-red-400/40 focus:border-red-400/40 focus:ring-red-500/15"
              )}
            />
          </Field>

          <Field label="Categoría">
            <select
              value={editForm.categoria}
              onChange={(e) => setEditForm((p) => ({ ...p, categoria: e.target.value as Categoria }))}
              className={TP_SELECT}
            >
              <option value="Anillos">Anillos</option>
              <option value="Cadenas">Cadenas</option>
              <option value="Aros">Aros</option>
              <option value="Pulseras">Pulseras</option>
              <option value="Dijes">Dijes</option>
              <option value="Otros">Otros</option>
            </select>
          </Field>

          <Field label="Metal">
            <select
              value={editForm.metal}
              onChange={(e) => setEditForm((p) => ({ ...p, metal: e.target.value as Metal }))}
              className={TP_SELECT}
            >
              <option value="Oro amarillo">Oro amarillo</option>
              <option value="Oro blanco">Oro blanco</option>
              <option value="Oro rosa">Oro rosa</option>
              <option value="Plata">Plata</option>
            </select>
          </Field>

          <Field label="Precio (ARS)" error={editErrors.precio}>
            <input
              value={editForm.precio}
              onChange={(e) => setEditForm((p) => ({ ...p, precio: onlyDigits(e.target.value) }))}
              inputMode="numeric"
              className={cn(
                TP_INPUT,
                editErrors.precio && "border-red-400/40 focus:border-red-400/40 focus:ring-red-500/15"
              )}
            />
          </Field>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={editForm.activo}
                onChange={(e) => setEditForm((p) => ({ ...p, activo: e.target.checked }))}
                className="h-4 w-4 rounded border-border bg-surface"
              />
              Activo
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-between">
          <button className={TP_BTN_DANGER} onClick={deleteCurrent}>
            Eliminar
          </button>

          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <button className={TP_BTN_SECONDARY} onClick={() => setOpenEdit(false)}>
              Cancelar
            </button>
            <button className={TP_BTN_PRIMARY} onClick={saveEdit}>
              Guardar cambios
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Stock por almacén */}
      <Modal open={openStockModal} title="Stock por almacén" onClose={() => setOpenStockModal(false)}>
        {!stockModalItem ? (
          <div className="text-sm text-muted">Artículo no encontrado.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="text-xs font-medium text-muted">Artículo</div>
              <div className="mt-1 text-sm font-semibold text-text">
                {stockModalItem.sku} — {stockModalItem.nombre}
              </div>
              <div className="mt-2 text-sm text-muted">
                Total: <span className="font-semibold text-text">{sumStock(stockModalItem.stockByAlmacen)}</span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <TPThead>
                    <TPTr>
                      <TPTh>Almacén</TPTh>
                      <TPTh>Código</TPTh>
                      <TPTh>Ubicación</TPTh>
                      <TPTh>Stock</TPTh>
                    </TPTr>
                  </TPThead>
                  <TPTbody>
                    {almacenes.map((al) => {
                      const n = stockModalItem.stockByAlmacen?.[al.id] ?? 0;
                      return (
                        <TPTr key={al.id}>
                          <TPTd className="font-semibold text-text">{al.nombre}</TPTd>
                          <TPTd className="text-muted">{al.codigo}</TPTd>
                          <TPTd className="text-muted">{al.ubicacion}</TPTd>
                          <TPTd>
                            <TPStockBadge n={n} size="sm" />
                          </TPTd>
                        </TPTr>
                      );
                    })}
                  </TPTbody>
                </table>
              </div>
            </div>

            <div className="text-xs text-muted">
              Tip: registrá un movimiento (Entrada/Salida/Ajuste) y este detalle se actualiza solo.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

import { useMemo, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  useInventory,
  type Categoria,
  type Metal,
  type Articulo,
} from "../context/InventoryContext";

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

function StockMiniBadge({ n }: { n: number }) {
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
      <div
        className="absolute inset-0 bg-zinc-900/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
            <div className="text-sm font-semibold text-zinc-900">{title}</div>
            <button
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
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
      <div className="text-xs font-medium text-zinc-600">{label}</div>
      {children}
      {error && (
        <div className="mt-1 text-xs font-medium text-red-600">{error}</div>
      )}
    </div>
  );
}

type SortKey = "sku" | "stock" | "precio";
type SortDir = "asc" | "desc";

export default function InventarioArticulos() {
  const {
    almacenes,
    articulos,
    getStockTotal,
    addArticulo,
    updateArticulo,
    deleteArticulo,
  } = useInventory();

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

  // ---- EXPORT ----
  function exportExcel() {
    const rows = filteredSorted.map((x) => ({
      SKU: x.sku,
      Nombre: x.nombre,
      Categoría: x.categoria,
      Metal: x.metal,
      Stock_Total: getStockTotal(x),
      Precio_ARS: x.precio,
      Activo: x.activo ? "Sí" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Articulos");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `articulos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportCSV() {
    const rows = filteredSorted.map((x) => ({
      SKU: x.sku,
      Nombre: x.nombre,
      Categoría: x.categoria,
      Metal: x.metal,
      Stock_Total: getStockTotal(x),
      Precio_ARS: x.precio,
      Activo: x.activo ? "Sí" : "No",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, `articulos_${new Date().toISOString().slice(0, 10)}.csv`);
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
    if (
      sku &&
      articulos.some((x) => x.id !== editId && x.sku.toUpperCase() === skuUpper)
    ) {
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

  // badges
  function stockBadge(stock: number) {
    if (stock === 0) {
      return (
        <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
          Sin stock
        </span>
      );
    }
    if (stock <= 2) {
      return (
        <span className="rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
          Bajo ({stock})
        </span>
      );
    }
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
        {stock} u.
      </span>
    );
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
          <div className="text-xs font-medium text-zinc-500">Inventario</div>
          <div className="text-lg font-semibold text-zinc-900">Artículos</div>
          <div className="mt-1 text-sm text-zinc-600">
            (✅ Stock se actualiza por Movimientos)
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
          <button
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            onClick={exportCSV}
          >
            Exportar CSV
          </button>
          <button
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            onClick={exportExcel}
          >
            Exportar Excel
          </button>
          <button
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            onClick={openNewModal}
          >
            + Nuevo artículo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-zinc-200 bg-white p-4 md:grid-cols-12">
        <div className="md:col-span-6">
          <label className="text-xs font-medium text-zinc-600">Buscar</label>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              resetPage();
            }}
            placeholder="SKU, nombre, metal…"
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
          />
        </div>

        <div className="md:col-span-4">
          <label className="text-xs font-medium text-zinc-600">Categoría</label>
          <select
            value={categoria}
            onChange={(e) => {
              setCategoria(e.target.value as any);
              resetPage();
            }}
            className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
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
          <label className="text-xs font-medium text-zinc-600">Estado</label>
          <button
            type="button"
            onClick={() => {
              setSoloActivos((v) => !v);
              resetPage();
            }}
            className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm font-medium transition ${
              soloActivos
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            }`}
          >
            {soloActivos ? "Activos" : "Todos"}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm font-medium text-zinc-900">
            Resultados: {total}
          </div>

          <div className="flex items-center gap-2">
            <div className="text-xs text-zinc-500">
              Página {page} / {totalPages}
            </div>
            <button
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </button>
            <button
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-5 py-3">
                  <button
                    className="font-semibold hover:text-orange-600"
                    onClick={() => toggleSort("sku")}
                  >
                    SKU{sortIndicator("sku")}
                  </button>
                </th>
                <th className="px-5 py-3">Nombre</th>
                <th className="px-5 py-3">Categoría</th>
                <th className="px-5 py-3">Metal</th>
                <th className="px-5 py-3">
                  <button
                    className="font-semibold hover:text-orange-600"
                    onClick={() => toggleSort("stock")}
                  >
                    Stock{sortIndicator("stock")}
                  </button>
                </th>
                <th className="px-5 py-3">
                  <button
                    className="font-semibold hover:text-orange-600"
                    onClick={() => toggleSort("precio")}
                  >
                    Precio{sortIndicator("precio")}
                  </button>
                </th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3 text-right">Acciones</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-200">
              {pageItems.map((x) => {
                const stock = getStockTotal(x);
                return (
                  <tr key={x.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 font-semibold text-zinc-900">
                      {x.sku}
                    </td>
                    <td className="px-5 py-3 text-zinc-700">{x.nombre}</td>
                    <td className="px-5 py-3 text-zinc-700">{x.categoria}</td>
                    <td className="px-5 py-3 text-zinc-700">{x.metal}</td>
                    <td className="px-5 py-3">{stockBadge(stock)}</td>
                    <td className="px-5 py-3 text-zinc-700">
                      {moneyARS(x.precio)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          x.activo
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-zinc-100 text-zinc-700"
                        }`}
                      >
                        {x.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>

                    <td className="px-5 py-3 text-right">
                      <button
                        className="rounded-lg px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
                        onClick={() => openStock(x.id)}
                      >
                        Stock
                      </button>

                      <button
                        className="ml-2 rounded-lg px-3 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
                        onClick={() => openEditModal(x)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}

              {pageItems.length === 0 && (
                <tr>
                  <td
                    className="px-5 py-10 text-center text-sm text-zinc-500"
                    colSpan={8}
                  >
                    No hay resultados con esos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 px-5 py-4">
          <div className="text-xs text-zinc-500">
            Mostrando{" "}
            {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Anterior
            </button>
            <button
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Nuevo */}
      <Modal open={openNew} title="Nuevo artículo" onClose={() => setOpenNew(false)}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="SKU" error={newErrors.sku}>
            <input
              value={newForm.sku}
              onChange={(e) => setNewForm((p) => ({ ...p, sku: e.target.value }))}
              placeholder="Ej: A195"
              className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-4 ${
                newErrors.sku
                  ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                  : "border-zinc-200 focus:border-orange-300 focus:ring-orange-100"
              }`}
            />
          </Field>

          <Field label="Nombre" error={newErrors.nombre}>
            <input
              value={newForm.nombre}
              onChange={(e) => setNewForm((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Ej: Anillo cinta"
              className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-4 ${
                newErrors.nombre
                  ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                  : "border-zinc-200 focus:border-orange-300 focus:ring-orange-100"
              }`}
            />
          </Field>

          <Field label="Categoría">
            <select
              value={newForm.categoria}
              onChange={(e) => setNewForm((p) => ({ ...p, categoria: e.target.value as Categoria }))}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
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
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
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
              className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-4 ${
                newErrors.stockTotal
                  ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                  : "border-zinc-200 focus:border-orange-300 focus:ring-orange-100"
              }`}
            />
          </Field>

          <Field label="Precio (ARS)" error={newErrors.precio}>
            <input
              value={newForm.precio}
              onChange={(e) => setNewForm((p) => ({ ...p, precio: onlyDigits(e.target.value) }))}
              inputMode="numeric"
              className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-4 ${
                newErrors.precio
                  ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                  : "border-zinc-200 focus:border-orange-300 focus:ring-orange-100"
              }`}
            />
          </Field>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={newForm.activo}
                onChange={(e) => setNewForm((p) => ({ ...p, activo: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Activo
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
          <button
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            onClick={() => setOpenNew(false)}
          >
            Cancelar
          </button>
          <button
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
            onClick={saveNew}
          >
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
              className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-4 ${
                editErrors.sku
                  ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                  : "border-zinc-200 focus:border-orange-300 focus:ring-orange-100"
              }`}
            />
          </Field>

          <Field label="Nombre" error={editErrors.nombre}>
            <input
              value={editForm.nombre}
              onChange={(e) => setEditForm((p) => ({ ...p, nombre: e.target.value }))}
              className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-4 ${
                editErrors.nombre
                  ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                  : "border-zinc-200 focus:border-orange-300 focus:ring-orange-100"
              }`}
            />
          </Field>

          <Field label="Categoría">
            <select
              value={editForm.categoria}
              onChange={(e) => setEditForm((p) => ({ ...p, categoria: e.target.value as Categoria }))}
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
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
              className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-300 focus:ring-4 focus:ring-orange-100"
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
              className={`mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm outline-none focus:ring-4 ${
                editErrors.precio
                  ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                  : "border-zinc-200 focus:border-orange-300 focus:ring-orange-100"
              }`}
            />
          </Field>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={editForm.activo}
                onChange={(e) => setEditForm((p) => ({ ...p, activo: e.target.checked }))}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Activo
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-between">
          <button
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            onClick={deleteCurrent}
          >
            Eliminar
          </button>

          <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
            <button
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              onClick={() => setOpenEdit(false)}
            >
              Cancelar
            </button>
            <button
              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              onClick={saveEdit}
            >
              Guardar cambios
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Stock por almacén */}
      <Modal
        open={openStockModal}
        title="Stock por almacén"
        onClose={() => setOpenStockModal(false)}
      >
        {!stockModalItem ? (
          <div className="text-sm text-zinc-600">Artículo no encontrado.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="text-xs font-medium text-zinc-500">Artículo</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {stockModalItem.sku} — {stockModalItem.nombre}
              </div>
              <div className="mt-2 text-sm text-zinc-700">
                Total:{" "}
                <span className="font-semibold">
                  {sumStock(stockModalItem.stockByAlmacen)}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-5 py-3">Almacén</th>
                    <th className="px-5 py-3">Código</th>
                    <th className="px-5 py-3">Ubicación</th>
                    <th className="px-5 py-3">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {almacenes.map((al) => {
                    const n = stockModalItem.stockByAlmacen?.[al.id] ?? 0;
                    return (
                      <tr key={al.id} className="hover:bg-zinc-50">
                        <td className="px-5 py-3 font-semibold text-zinc-900">
                          {al.nombre}
                        </td>
                        <td className="px-5 py-3 text-zinc-700">{al.codigo}</td>
                        <td className="px-5 py-3 text-zinc-700">
                          {al.ubicacion}
                        </td>
                        <td className="px-5 py-3">
                          <StockMiniBadge n={n} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="text-xs text-zinc-500">
              Tip: registrá un movimiento (Entrada/Salida/Ajuste) y este detalle se actualiza solo.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

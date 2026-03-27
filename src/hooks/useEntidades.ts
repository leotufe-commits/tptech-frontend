// src/hooks/useEntidades.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { commercialEntitiesApi, type EntityRow } from "../services/commercial-entities";
import { toast } from "../lib/toast";

type Role = "client" | "supplier";
type SortKey = string;

export function useEntidades(role: Role) {
  const [rows, setRows]       = useState<EntityRow[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(false);

  // Paginación
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Búsqueda y orden (se envían al servidor)
  const [q, setQ]               = useState("");
  const [sortKey, setSortKey]   = useState<SortKey>("displayName");
  const [sortDir, setSortDir]   = useState<"asc" | "desc">("asc");

  // Delete
  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityRow | null>(null);
  const [busyDelete, setBusyDelete]     = useState(false);

  // Modal edición
  const [modalOpen, setModalOpen]         = useState(false);
  const [modalMode, setModalMode]         = useState<"CREATE" | "EDIT">("CREATE");
  const [modalEntityId, setModalEntityId] = useState<string | null>(null);

  // Ref con los params actuales — permite leer valores frescos desde callbacks
  const paramsRef = useRef({ page, pageSize, q, sortKey, sortDir });
  paramsRef.current = { page, pageSize, q, sortKey, sortDir };

  // Función de carga: usa paramsRef para evitar closures obsoletos
  const load = useCallback(async () => {
    const { page: p, pageSize: ps, q: search, sortKey: sk, sortDir: sd } = paramsRef.current;
    setLoading(true);
    try {
      const result = await commercialEntitiesApi.list({
        role,
        q: search,
        skip: (p - 1) * ps,
        take: ps,
        sortKey: sk,
        sortDir: sd,
      });
      setRows(result.rows);
      setTotal(result.total);
    } catch (e: any) {
      toast.error(e?.message || `Error al cargar ${role === "client" ? "clientes" : "proveedores"}.`);
    } finally {
      setLoading(false);
    }
  }, [role]);

  // Recargar cuando cambia cualquier parámetro
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, page, pageSize, q, sortKey, sortDir]);

  // ── Búsqueda ─────────────────────────────────────────────────────────────
  function handleSetQ(newQ: string) {
    setQ(newQ);
    setPage(1); // volver a página 1 al buscar
  }

  // ── Ordenamiento ─────────────────────────────────────────────────────────
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  // ── Paginación controlada ─────────────────────────────────────────────────
  function handlePageChange(p: number) {
    setPage(p);
  }

  function handlePageSizeChange(ps: number) {
    setPageSize(ps);
    setPage(1);
  }

  // ── Toggle activo/inactivo ────────────────────────────────────────────────
  async function handleToggle(row: EntityRow) {
    // optimistic update
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)));
    try {
      const updated = await commercialEntitiesApi.toggle(row.id);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e: any) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: row.isActive } : r)));
      toast.error(e?.message || "Error al cambiar estado.");
    }
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyDelete(true);
    try {
      await commercialEntitiesApi.remove(deleteTarget.id);
      setDeleteOpen(false);
      setDeleteTarget(null);
      toast.success(`${role === "client" ? "Cliente" : "Proveedor"} eliminado.`);
      // Ajustar página si la actual quedó vacía
      const newTotal = total - 1;
      const newTotalPages = Math.max(1, Math.ceil(newTotal / paramsRef.current.pageSize));
      const safePage = Math.min(paramsRef.current.page, newTotalPages);
      if (safePage !== paramsRef.current.page) {
        setPage(safePage); // el effect recargará
      } else {
        void load(); // misma página, recargar manualmente
      }
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

  // ── Modal ─────────────────────────────────────────────────────────────────
  function openCreate() {
    setModalMode("CREATE");
    setModalEntityId(null);
    setModalOpen(true);
  }

  function openEdit(row: EntityRow) {
    setModalMode("EDIT");
    setModalEntityId(row.id);
    setModalOpen(true);
  }

  function openDelete(row: EntityRow) {
    setDeleteTarget(row);
    setDeleteOpen(true);
  }

  function closeDelete() {
    if (!busyDelete) {
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
  }

  // ── Eliminación masiva ────────────────────────────────────────────────────
  async function handleBulkDelete(ids: string[]): Promise<void> {
    const result = await commercialEntitiesApi.bulkDelete(ids);
    const { deleted, blocked } = result;
    if (deleted > 0) {
      const suffix = blocked > 0 ? ` ${blocked} no se pudieron eliminar (tienen movimientos).` : "";
      toast.success(`${deleted} ${deleted === 1 ? "registro eliminado" : "registros eliminados"}.${suffix}`);
    } else {
      toast.error(`No se pudo eliminar ningún registro: todos tienen movimientos asociados.`);
    }
    const newTotal = total - deleted;
    const newTotalPages = Math.max(1, Math.ceil(newTotal / paramsRef.current.pageSize));
    const safePage = Math.min(paramsRef.current.page, newTotalPages);
    if (safePage !== paramsRef.current.page) {
      setPage(safePage);
    } else {
      void load();
    }
  }

  // ── Otras funcionalidades ─────────────────────────────────────────────────
  const [mergeOpen, setMergeOpen]         = useState(false);
  const [relateOpen, setRelateOpen]       = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  return {
    // datos
    rows,
    total,
    loading,
    // búsqueda / orden
    q,
    setQ: handleSetQ,
    sortKey,
    sortDir,
    toggleSort,
    // paginación controlada
    page,
    pageSize,
    onPageChange: handlePageChange,
    onPageSizeChange: handlePageSizeChange,
    // modal edición
    modalOpen, setModalOpen, modalMode, modalEntityId,
    openCreate, openEdit,
    // delete
    deleteOpen, deleteTarget, busyDelete,
    openDelete, closeDelete, handleDelete,
    handleBulkDelete,
    handleToggle,
    // combinar / relacionar / importar
    mergeOpen, setMergeOpen,
    relateOpen, setRelateOpen,
    bulkImportOpen, setBulkImportOpen,
    // recarga manual (para usar después de guardar)
    load,
  };
}

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users } from "lucide-react";

import { TPSectionShell } from "../../components/ui/TPSectionShell";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { toast } from "../../lib/toast";
import { commercialEntitiesApi, type EntityRow } from "../../services/commercial-entities";

import { EntidadesTable } from "./clientes/EntidadesTable";
import { ENTITY_COLS, CLIENT_COL_LS_KEY } from "./clientes/clientes.constants";
import type { SortKey } from "./clientes/clientes.types";
import EntityEditModal from "./clientes/EntityEditModal";

export default function ConfiguracionSistemaClientes() {
  const navigate = useNavigate();

  const [rows, setRows]       = useState<EntityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ]             = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("displayName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [deleteOpen, setDeleteOpen]     = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EntityRow | null>(null);
  const [busyDelete, setBusyDelete]     = useState(false);

  const [modalOpen, setModalOpen]       = useState(false);
  const [modalMode, setModalMode]       = useState<"CREATE" | "EDIT">("CREATE");
  const [modalEntityId, setModalEntityId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const result = await commercialEntitiesApi.list({ role: "client", take: 200 });
      setRows(result.rows);
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar clientes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = term
      ? rows.filter(
          (r) =>
            r.displayName.toLowerCase().includes(term) ||
            r.code.toLowerCase().includes(term) ||
            r.email.toLowerCase().includes(term) ||
            r.documentNumber.toLowerCase().includes(term) ||
            r.phone.toLowerCase().includes(term)
        )
      : rows;

    return [...base].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      return String((a as any)[sortKey] ?? "").localeCompare(
        String((b as any)[sortKey] ?? ""),
        "es"
      ) * mul;
    });
  }, [rows, q, sortKey, sortDir]);

  async function handleToggle(row: EntityRow) {
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r)));
    try {
      const updated = await commercialEntitiesApi.toggle(row.id);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e: any) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: row.isActive } : r)));
      toast.error(e?.message || "Error al cambiar estado.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyDelete(true);
    try {
      await commercialEntitiesApi.remove(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      toast.success("Cliente eliminado.");
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

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

  return (
    <TPSectionShell
      title="Clientes"
      subtitle="Gestioná la base de clientes de la joyería"
      icon={<Users size={22} />}
    >
      <EntidadesTable
        rows={filtered}
        loading={loading}
        q={q}
        onSearchChange={setQ}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        storageKey={CLIENT_COL_LS_KEY}
        columns={ENTITY_COLS}
        onEdit={openEdit}
        onToggle={handleToggle}
        onDelete={(row) => { setDeleteTarget(row); setDeleteOpen(true); }}
        onNew={openCreate}
        detailBasePath="clientes"
        newLabel="Nuevo cliente"
        countLabel={(n) => `${n} ${n === 1 ? "cliente" : "clientes"}`}
        searchPlaceholder="Buscar por nombre, CUIT, email…"
        emptyText="Todavía no hay clientes registrados."
      />

      <EntityEditModal
        open={modalOpen}
        mode={modalMode}
        entityId={modalEntityId}
        isClientContext
        onClose={() => setModalOpen(false)}
        onSaved={() => { void load(); }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Eliminar "${deleteTarget?.displayName ?? ""}"`}
        description="¿Estás seguro? Solo podés eliminar clientes sin movimientos en cuenta corriente."
        confirmText="Eliminar"
        busy={busyDelete}
        onClose={() => { if (!busyDelete) { setDeleteOpen(false); setDeleteTarget(null); } }}
        onConfirm={handleDelete}
      />
    </TPSectionShell>
  );
}

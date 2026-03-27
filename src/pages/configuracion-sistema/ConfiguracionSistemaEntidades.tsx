// src/pages/configuracion-sistema/ConfiguracionSistemaEntidades.tsx
// Componente unificado para Clientes y Proveedores — usar a través de los wrappers.
import React from "react";
import { TPSectionShell } from "../../components/ui/TPSectionShell";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import { useEntidades } from "../../hooks/useEntidades";
import { EntidadesTable } from "./clientes/EntidadesTable";
import { ENTITY_COLS, CLIENT_COL_LS_KEY, SUPPLIER_COL_LS_KEY } from "./clientes/clientes.constants";
import type { SortKey } from "./clientes/clientes.types";
import EntityEditModal from "./clientes/EntityEditModal";
import MergeModal from "./clientes/MergeModal";
import RelateModal from "./clientes/RelateModal";
import BulkImportModal from "./clientes/BulkImportModal";

interface Props {
  role: "client" | "supplier";
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  detailBasePath: string;
  newLabel: string;
  countLabel: (n: number) => string;
  searchPlaceholder: string;
  emptyText: string;
  deleteDescription: string;
}

export default function ConfiguracionSistemaEntidades({
  role,
  title,
  subtitle,
  icon,
  detailBasePath,
  newLabel,
  countLabel,
  searchPlaceholder,
  emptyText,
  deleteDescription,
}: Props) {
  const {
    rows, total, loading,
    q, setQ, sortKey, sortDir, toggleSort,
    page, pageSize, onPageChange, onPageSizeChange,
    modalOpen, setModalOpen, modalMode, modalEntityId,
    openCreate, openEdit,
    deleteOpen, deleteTarget, busyDelete,
    openDelete, closeDelete, handleDelete,
    handleBulkDelete,
    handleToggle, load,
    mergeOpen, setMergeOpen,
    relateOpen, setRelateOpen,
    bulkImportOpen, setBulkImportOpen,
  } = useEntidades(role);

  const storageKey       = role === "client" ? CLIENT_COL_LS_KEY : SUPPLIER_COL_LS_KEY;
  const isClientContext  = role === "client";
  const isSupplierContext = role === "supplier";
  const entityLabel      = role === "client" ? "clientes" : "proveedores";

  return (
    <TPSectionShell title={title} subtitle={subtitle} icon={icon}>
      <EntidadesTable
        rows={rows}
        total={total}
        loading={loading}
        q={q}
        onSearchChange={setQ}
        sortKey={sortKey as SortKey}
        sortDir={sortDir}
        onSort={toggleSort as (key: SortKey) => void}
        page={page}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        storageKey={storageKey}
        columns={ENTITY_COLS}
        onEdit={openEdit}
        onToggle={handleToggle}
        onDelete={openDelete}
        onNew={openCreate}
        onCombine={() => setMergeOpen(true)}
        onRelate={() => setRelateOpen(true)}
        onBulkImport={() => setBulkImportOpen(true)}
        onBulkDelete={handleBulkDelete}
        detailBasePath={detailBasePath}
        newLabel={newLabel}
        countLabel={countLabel}
        searchPlaceholder={searchPlaceholder}
        emptyText={emptyText}
        entityLabel={entityLabel}
      />

      <EntityEditModal
        key={modalEntityId ?? "create"}
        open={modalOpen}
        mode={modalMode}
        entityId={modalEntityId}
        isClientContext={isClientContext}
        isSupplierContext={isSupplierContext}
        onClose={() => setModalOpen(false)}
        onSaved={() => { void load(); }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Eliminar "${deleteTarget?.displayName ?? ""}"`}
        description={deleteDescription}
        confirmText="Eliminar"
        busy={busyDelete}
        onClose={closeDelete}
        onConfirm={handleDelete}
      />

      <MergeModal
        open={mergeOpen}
        role={role}
        onClose={() => setMergeOpen(false)}
        onMerged={() => { setMergeOpen(false); void load(); }}
      />

      <RelateModal
        open={relateOpen}
        role={role}
        onClose={() => setRelateOpen(false)}
        onRelated={() => { setRelateOpen(false); void load(); }}
      />

      <BulkImportModal
        open={bulkImportOpen}
        role={role}
        onClose={() => setBulkImportOpen(false)}
        onImported={() => { void load(); }}
      />
    </TPSectionShell>
  );
}

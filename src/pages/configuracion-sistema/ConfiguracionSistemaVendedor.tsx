import React, { useEffect, useMemo, useRef, useState } from "react";
import { Users } from "lucide-react";

import { TPSectionShell } from "../../components/ui/TPSectionShell";
import ConfirmDeleteDialog from "../../components/ui/ConfirmDeleteDialog";
import type { TPAttachmentItem } from "../../components/ui/TPAttachmentList";
import { toast } from "../../lib/toast";
import { apiFetch } from "../../lib/api";
import { sellersApi, type SellerRow } from "../../services/sellers";

import { VendedoresTable } from "./vendedor/VendedoresTable";
import { VendedorEditModal } from "./vendedor/VendedorEditModal";
import { VendedorViewModal } from "./vendedor/VendedorViewModal";
import { EMPTY_DRAFT, COL_LS_KEY } from "./vendedor/vendedor.constants";
import { loadColVis } from "./vendedor/vendedor.helpers";
import type { SellerDraft, SortKey, WarehouseOption } from "./vendedor/vendedor.types";

export default function ConfiguracionSistemaVendedor() {
  /* ---- datos ---- */
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);

  /* ---- tabla ---- */
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("displayName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [colVis, setColVis] = useState<Record<string, boolean>>(loadColVis);

  /* ---- modales ---- */
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SellerRow | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<SellerRow | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SellerRow | null>(null);

  /* ---- busy ---- */
  const [busySave, setBusySave] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyFavorite, setBusyFavorite] = useState<string | null>(null);
  const [busyAvatar, setBusyAvatar] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);

  /* ---- draft ---- */
  const [draft, setDraft] = useState<SellerDraft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  /* ---- carga ---- */
  async function load() {
    setLoading(true);
    try {
      setRows(await sellersApi.list());
    } catch (e: any) {
      toast.error(e?.message || "Error al cargar vendedores.");
    } finally {
      setLoading(false);
    }
  }

  async function loadWarehouses() {
    try {
      const data = await apiFetch<WarehouseOption[]>("/warehouses", {
        method: "GET",
        on401: "throw",
      });
      setWarehouses(Array.isArray(data) ? data : []);
    } catch {
      setWarehouses([]);
    }
  }

  useEffect(() => {
    void load();
    void loadWarehouses();
  }, []);

  /* ---- sort ---- */
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  /* ---- filtrado + orden ---- */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s
      ? rows.filter(
          (r) =>
            r.displayName.toLowerCase().includes(s) ||
            r.firstName.toLowerCase().includes(s) ||
            r.lastName.toLowerCase().includes(s) ||
            r.email.toLowerCase().includes(s) ||
            r.documentNumber.toLowerCase().includes(s)
        )
      : rows;

    return [...base].sort((a, b) => {
      const mul = sortDir === "asc" ? 1 : -1;
      const va = String((a as any)[sortKey] ?? "");
      const vb = String((b as any)[sortKey] ?? "");
      return va.localeCompare(vb, "es") * mul;
    });
  }, [rows, q, sortKey, sortDir]);

  /* ---- columnas ---- */
  function handleColChange(key: string, visible: boolean) {
    const next = { ...colVis, [key]: visible };
    setColVis(next);
    localStorage.setItem(COL_LS_KEY, JSON.stringify(next));
  }

  /* ---- draft helpers ---- */
  function set<K extends keyof SellerDraft>(key: K, value: SellerDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function toggleWarehouse(id: string) {
    setDraft((prev) => ({
      ...prev,
      warehouseIds: prev.warehouseIds.includes(id)
        ? prev.warehouseIds.filter((x) => x !== id)
        : [...prev.warehouseIds, id],
    }));
  }

  /* ---- abrir modales ---- */
  function openCreate() {
    setEditTarget(null);
    setDraft({ ...EMPTY_DRAFT });
    setSubmitted(false);
    setEditOpen(true);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }

  function openEdit(row: SellerRow) {
    setEditTarget(row);
    setDraft({
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: row.displayName,
      documentType: row.documentType,
      documentNumber: row.documentNumber,
      email: row.email,
      phone: row.phone,
      street: row.street ?? "",
      streetNumber: row.streetNumber ?? "",
      city: row.city ?? "",
      province: row.province ?? "",
      country: row.country ?? "",
      postalCode: row.postalCode ?? "",
      commissionType: row.commissionType,
      commissionValue:
        row.commissionValue !== null ? parseFloat(row.commissionValue) : null,
      commissionBase: row.commissionBase ?? "NET",
      isActive: row.isActive,
      isFavorite: row.isFavorite,
      notes: row.notes,
      warehouseIds: row.warehouses.map((w) => w.warehouseId),
      contactName: "",
      contactPhone: "",
      contactEmail: "",
    });
    setSubmitted(false);
    setEditOpen(true);
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }

  /* ---- guardar ---- */
  async function handleSave() {
    setSubmitted(true);

    if (!draft.firstName.trim() || !draft.lastName.trim()) return;

    if (
      draft.commissionType !== "NONE" &&
      (draft.commissionValue === null || draft.commissionValue <= 0)
    ) {
      return;
    }

    const payload = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      displayName: draft.displayName.trim() || undefined,
      documentType: draft.documentType.trim() || undefined,
      documentNumber: draft.documentNumber.trim() || undefined,
      email: draft.email.trim() || undefined,
      phone: draft.phone.trim() || undefined,
      street: draft.street.trim() || undefined,
      streetNumber: draft.streetNumber.trim() || undefined,
      city: draft.city.trim() || undefined,
      province: draft.province.trim() || undefined,
      country: draft.country.trim() || undefined,
      postalCode: draft.postalCode.trim() || undefined,
      commissionType: draft.commissionType,
      commissionValue:
        draft.commissionType !== "NONE" && draft.commissionValue !== null
          ? String(draft.commissionValue)
          : null,
      commissionBase: draft.commissionBase,
      isActive: draft.isActive,
      isFavorite: draft.isFavorite,
      notes: draft.notes.trim() || undefined,
      warehouseIds: draft.warehouseIds,
    };

    setBusySave(true);
    try {
      if (editTarget) {
        const updated = await sellersApi.update(editTarget.id, payload);
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        toast.success("Vendedor actualizado.");
      } else {
        const created = await sellersApi.create(payload);
        setRows((prev) => [created, ...prev]);
        toast.success("Vendedor creado.");
      }
      setEditOpen(false);
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al guardar.");
    } finally {
      setBusySave(false);
    }
  }

  /* ---- avatar ---- */
  async function handleAvatarUpload(file: File) {
    if (!editTarget) return;
    setBusyAvatar(true);
    try {
      const updated = await sellersApi.uploadAvatar(editTarget.id, file);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setEditTarget(updated);
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al subir imagen.");
    } finally {
      setBusyAvatar(false);
    }
  }

  /* ---- adjuntos ---- */
  async function handleAddAttachment(file: File) {
    if (!editTarget) return;
    try {
      const att = await sellersApi.addAttachment(editTarget.id, file);
      const updated: SellerRow = {
        ...editTarget,
        attachments: [...(editTarget.attachments ?? []), att],
      };
      setEditTarget(updated);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      toast.success("Adjunto agregado.");
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al subir adjunto.");
    }
  }

  async function handleDeleteAttachment(item: TPAttachmentItem) {
    if (!editTarget) return;
    setDeletingAttachmentId(item.id);
    try {
      await sellersApi.deleteAttachment(editTarget.id, item.id);
      const updated: SellerRow = {
        ...editTarget,
        attachments: (editTarget.attachments ?? []).filter((a) => a.id !== item.id),
      };
      setEditTarget(updated);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? "Error al eliminar adjunto.");
    } finally {
      setDeletingAttachmentId(null);
    }
  }

  /* ---- toggle activo ---- */
  async function handleToggle(row: SellerRow) {
    setRows((prev) =>
      prev.map((r) => (r.id === row.id ? { ...r, isActive: !r.isActive } : r))
    );
    try {
      const updated = await sellersApi.toggle(row.id);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, isActive: row.isActive } : r))
      );
      toast.error(e?.message || "Error al cambiar estado.");
    }
  }

  /* ---- favorito ---- */
  async function handleFavorite(row: SellerRow) {
    if (busyFavorite) return;
    setBusyFavorite(row.id);
    try {
      const updated = await sellersApi.setFavorite(row.id);
      setRows((prev) =>
        prev.map((r) => {
          if (r.id === updated.id) return updated;
          if (r.isFavorite) return { ...r, isFavorite: false };
          return r;
        })
      );
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar favorito.");
    } finally {
      setBusyFavorite(null);
    }
  }

  /* ---- eliminar ---- */
  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyDelete(true);
    try {
      await sellersApi.remove(deleteTarget.id);
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      toast.success("Vendedor eliminado.");
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar.");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <TPSectionShell
      title="Vendedores"
      subtitle="Gestioná el equipo de vendedores y sus comisiones"
      icon={<Users size={22} />}
    >
      <VendedoresTable
        rows={filtered}
        loading={loading}
        q={q}
        onSearchChange={setQ}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={toggleSort}
        colVis={colVis}
        onColChange={handleColChange}
        busyFavorite={busyFavorite}
        onFavorite={handleFavorite}
        onView={(row) => {
          setViewTarget(row);
          setViewOpen(true);
        }}
        onEdit={openEdit}
        onToggle={handleToggle}
        onDelete={(row) => {
          setDeleteTarget(row);
          setDeleteOpen(true);
        }}
        onNewSeller={openCreate}
      />

      <VendedorEditModal
        open={editOpen}
        editTarget={editTarget}
        draft={draft}
        set={set}
        toggleWarehouse={toggleWarehouse}
        submitted={submitted}
        busySave={busySave}
        busyAvatar={busyAvatar}
        warehouses={warehouses}
        deletingAttachmentId={deletingAttachmentId}
        onAvatarUpload={handleAvatarUpload}
        onAddAttachment={handleAddAttachment}
        onDeleteAttachment={handleDeleteAttachment}
        onSave={handleSave}
        onClose={() => !busySave && setEditOpen(false)}
        firstInputRef={firstInputRef}
      />

      <VendedorViewModal
        open={viewOpen}
        seller={viewTarget}
        onClose={() => setViewOpen(false)}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Eliminar "${deleteTarget?.displayName ?? ""}"`}
        description="¿Estás seguro? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        busy={busyDelete}
        onClose={() => {
          if (!busyDelete) {
            setDeleteOpen(false);
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleDelete}
      />
    </TPSectionShell>
  );
}
// src/pages/InventarioAlmacenes.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";

import TPSectionShell from "../components/ui/TPSectionShell";
import { TPCard } from "../components/ui/TPCard";
import { TPButton } from "../components/ui/TPButton";
import TPSearchInput from "../components/ui/TPSearchInput";
import ConfirmDeleteDialog from "../components/ui/ConfirmDeleteDialog";
import Modal from "../components/ui/Modal";
import TPAlert from "../components/ui/TPAlert";

import { toast } from "../lib/toast";

import type { SortDir, SortKey, WarehouseDraft, WarehouseRow } from "./InventarioAlmacenes/types";
import { warehousesApi } from "./InventarioAlmacenes/warehouses.api";

import {
  TPTECH_WAREHOUSES_CHANGED,
  EMPTY_DRAFT,
  cmpStr,
  draftPayload,
  emitWarehousesChanged,
  isRowActive,
  rowToDraft,
  s,
  toNum,
} from "./InventarioAlmacenes/warehouses.utils";

import WarehousesKpis from "./InventarioAlmacenes/WarehousesKpis";
import WarehousesTable, { WH_COLUMNS, WH_COL_LS_KEY } from "./InventarioAlmacenes/WarehousesTable";
import WarehouseViewModal from "./InventarioAlmacenes/WarehouseViewModal";
import WarehouseEditModal from "./InventarioAlmacenes/WarehouseEditModal";
import { TPColumnPicker } from "../components/ui/TPColumnPicker";

function cleanErrMsg(msg: any) {
  const m = String(msg ?? "").trim();
  if (!m) return "No se pudo eliminar.";

  // si se filtró algo "técnico"
  if (m === "HTTP 500" || m.toLowerCase() === "internal server error") return "No se pudo eliminar.";

  return m;
}

export default function InventarioAlmacenes() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<WarehouseRow[]>([]);
  const [q, setQ] = useState("");

  // ── Visibilidad de columnas ──
  const [whColVis, setWhColVis] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(WH_COL_LS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return Object.fromEntries(WH_COLUMNS.map((c) => [c.key, c.visible]));
  });
  function toggleWhCol(key: string, visible: boolean) {
    setWhColVis((prev) => {
      const next = { ...prev, [key]: visible };
      try { localStorage.setItem(WH_COL_LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState<WarehouseDraft>({ ...EMPTY_DRAFT });
  const [busySave, setBusySave] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<WarehouseRow | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WarehouseRow | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const [deleteErrorOpen, setDeleteErrorOpen] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState("");

  // ✅ busy states para íconos
  const [busyFavoriteId, setBusyFavoriteId] = useState<string | null>(null);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  const editKey = draft.id ? `edit:${draft.id}` : "new";

  async function refresh() {
    setLoading(true);
    try {
      const data = await warehousesApi.list();
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cargar almacenes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    let t: any = null;
    const onChanged = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void refresh(), 180);
    };

    window.addEventListener(TPTECH_WAREHOUSES_CHANGED, onChanged as any);

    return () => {
      if (t) clearTimeout(t);
      window.removeEventListener(TPTECH_WAREHOUSES_CHANGED, onChanged as any);
    };
  }, []);

  function toggleSort(k: SortKey) {
    setSortKey((prev) => {
      if (prev !== k) {
        setSortDir("asc");
        return k;
      }
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return prev;
    });
  }

  const filtered = useMemo(() => {
    const needle = s(q).toLowerCase();

    const base = !needle
      ? rows
      : rows.filter((r) => {
          const name = s(r.name).toLowerCase();
          const code = s(r.code).toLowerCase();
          const loc = s(r.location).toLowerCase();
          const city = s(r.city).toLowerCase();
          return name.includes(needle) || code.includes(needle) || loc.includes(needle) || city.includes(needle);
        });

    const dir = sortDir === "asc" ? 1 : -1;

    return [...base].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return cmpStr(a.name, b.name) * dir;

        case "code":
          return cmpStr(a.code, b.code) * dir;

        case "location":
          return cmpStr(a.location, b.location) * dir;

        case "isActive": {
          const A = a.deletedAt ? 0 : a.isActive ? 2 : 1;
          const B = b.deletedAt ? 0 : b.isActive ? 2 : 1;
          return (A - B) * dir;
        }

        case "stockGrams":
          return (toNum(a.stockGrams, 0) - toNum(b.stockGrams, 0)) * dir;

        case "stockPieces":
          return (toNum(a.stockPieces, 0) - toNum(b.stockPieces, 0)) * dir;

        default:
          return 0;
      }
    });
  }, [rows, q, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => isRowActive(r)).length;
    const inactive = rows.filter((r) => !isRowActive(r) && !r.deletedAt).length;

    const totalGrams = rows.reduce((acc, r) => acc + toNum(r.stockGrams, 0), 0);
    const totalPieces = rows.reduce((acc, r) => acc + toNum(r.stockPieces, 0), 0);

    return { total, active, inactive, totalGrams, totalPieces };
  }, [rows]);

  function openCreate() {
    setDraft({ ...EMPTY_DRAFT });
    setEditOpen(true);
  }

  function openEdit(r: WarehouseRow) {
    setDraft(rowToDraft(r));
    setEditOpen(true);
  }

  function openView(r: WarehouseRow) {
    const latest = rows.find((x) => x.id === r.id) || r;
    setViewTarget(latest);
    setViewOpen(true);
  }

  async function save() {
    const name = s(draft.name);
    if (!name) return toast.error("Ingresá el nombre del almacén.");

    setBusySave(true);
    try {
      const payload = draftPayload(draft);

      if (draft.id) {
        const updated = await warehousesApi.update(draft.id, payload);
        setRows((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
        toast.success("Almacén actualizado.");
      } else {
        const created = await warehousesApi.create(payload);
        setRows((prev) => [...prev, created]);
        toast.success("Almacén creado.");
      }

      setEditOpen(false);
      emitWarehousesChanged();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar.");
    } finally {
      setBusySave(false);
    }
  }

  // ✅ FAVORITO
  async function favorite(r: WarehouseRow) {
    const active = isRowActive(r);
    if (!active) return;
    if (busyFavoriteId || busyRowId) return;

    try {
      setBusyFavoriteId(r.id);

      const out = await warehousesApi.favorite(r.id);

      setRows((prev) =>
        prev.map((x) => ({
          ...x,
          isFavorite: x.id === out.favoriteWarehouseId,
        }))
      );

      emitWarehousesChanged();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo marcar favorito.");
    } finally {
      setBusyFavoriteId(null);
    }
  }

  // ✅ ACTIVAR / DESACTIVAR
  async function toggleActive(r: WarehouseRow) {
    if (busyRowId || busyFavoriteId) return;

    try {
      setBusyRowId(r.id);

      const updated = await warehousesApi.toggle(r.id);

      setRows((prev) =>
        prev.map((x) => (x.id === updated.id ? { ...x, ...updated, isFavorite: x.isFavorite } : x))
      );

      if (r.isFavorite && updated.isActive === false) {
        await refresh();
      }

      emitWarehousesChanged();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo cambiar el estado.");
    } finally {
      setBusyRowId(null);
    }
  }

  function askDelete(r: WarehouseRow) {
    setDeleteTarget(r);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      setBusyDelete(true);
      setBusyRowId(deleteTarget.id);

      await warehousesApi.remove(deleteTarget.id);

      // ✅ actualiza UI sin F5
      setRows((prev) => prev.filter((x) => x.id !== deleteTarget.id));

      toast.success("Almacén eliminado.");
      setDeleteOpen(false);
      setDeleteTarget(null);

      emitWarehousesChanged();
    } catch (e: any) {
      const msg = cleanErrMsg(e?.message || e?.error || e);
      setDeleteOpen(false);
      setDeleteErrorMsg(msg);
      setDeleteErrorOpen(true);
    } finally {
      setBusyDelete(false);
      setBusyRowId(null);
    }
  }

  function onFormKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter") return;

    const tag = ((e.target as HTMLElement | null)?.tagName || "").toLowerCase();
    if (tag === "textarea") return;
    if ((e as any).shiftKey) return;

    e.preventDefault();
    if (!busySave) void save();
  }

  return (
    <TPSectionShell title="Almacenes" subtitle="Depósitos / locales. Stock por almacén (gramos y piezas).">
      <WarehousesKpis
        total={kpis.total}
        active={kpis.active}
        inactive={kpis.inactive}
        totalGrams={kpis.totalGrams}
        totalPieces={kpis.totalPieces}
      />

      <TPCard className="mt-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-1 min-w-0 md:max-w-xl">
              <TPSearchInput value={q} onChange={setQ} placeholder="Buscar por nombre, código, ubicación, ciudad…" />
            </div>
            <TPColumnPicker
              columns={WH_COLUMNS.map((c) => ({ key: c.key, label: c.label, canHide: c.canHide }))}
              visibility={whColVis}
              onChange={toggleWhCol}
            />
          </div>

          <div className="flex w-full items-center gap-3 md:justify-end md:w-auto">
            <div className="ml-auto text-xs text-muted">
              {loading ? "Cargando…" : `Mostrando: ${filtered.length} / ${rows.length}`}
            </div>

            <TPButton onClick={openCreate} iconLeft={<Plus className="h-4 w-4" />}>
              Nuevo almacén
            </TPButton>
          </div>
        </div>

        <div className="mt-3">
          <WarehousesTable
            loading={loading}
            rows={filtered}
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={toggleSort}
            busyFavoriteId={busyFavoriteId}
            busyRowId={busyRowId}
            onFavorite={favorite}
            onView={openView}
            onEdit={openEdit}
            onToggleActive={toggleActive}
            onAskDelete={askDelete}
            colVis={whColVis}
          />
        </div>
      </TPCard>

      <WarehouseViewModal open={viewOpen} onClose={() => setViewOpen(false)} target={viewTarget} />

      <WarehouseEditModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        draft={draft}
        setDraft={setDraft}
        busySave={busySave}
        onSave={save}
        editKey={editKey}
        onFormKeyDown={onFormKeyDown}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        title="Eliminar almacén"
        description={
          deleteTarget
            ? `Vas a eliminar "${deleteTarget.name}". Esta acción no se puede deshacer.`
            : "Vas a eliminar este almacén. Esta acción no se puede deshacer."
        }
        dangerHint="Para confirmar, debés escribir ELIMINAR."
        requireTypeToConfirm
        typeToConfirmText="ELIMINAR"
        confirmText={busyDelete ? "Eliminando…" : "Eliminar"}
        cancelText="Cancelar"
        busy={busyDelete}
        onConfirm={confirmDelete}
        onClose={() => {
          if (busyDelete) return;
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
      />

      <Modal
        open={deleteErrorOpen}
        onClose={() => setDeleteErrorOpen(false)}
        title="No se puede eliminar"
        subtitle="Revisá el motivo y volvé a intentar."
        maxWidth="md"
        footer={
          <div className="flex w-full items-center justify-end">
            <TPButton variant="secondary" onClick={() => setDeleteErrorOpen(false)}>
              Entendido
            </TPButton>
          </div>
        }
      >
        <div className="space-y-3">
          <TPAlert
            tone="danger"
            title="Motivo"
          >
            {deleteErrorMsg || "No se pudo eliminar."}
          </TPAlert>

          <TPCard className="p-4">
            <div className="text-xs text-muted">
              Reglas:
              <br />• No se puede eliminar el último almacén activo.
              <br />• No se puede eliminar si tiene movimientos.
              <br />• No se puede eliminar si el stock neto (gramos) es distinto de 0.
            </div>
          </TPCard>
        </div>
      </Modal>
    </TPSectionShell>
  );
}
import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Lock, X, Check, Save } from "lucide-react";

import { Modal } from "../../components/ui/Modal";
import TPCheckbox from "../../components/ui/TPCheckbox";
import TPButton from "../../components/ui/TPButton";
import TPInput from "../../components/ui/TPInput";
import { cn } from "../../components/ui/tp";
import type { Permission } from "../../services/permissions";

/* =========================
   Labels permisos (humanos)
========================= */
const MODULE_LABEL: Record<string, string> = {
  USERS_ROLES: "Usuarios y roles",
  INVENTORY: "Inventario",
  MOVEMENTS: "Movimientos",
  CLIENTS: "Clientes",
  SALES: "Ventas",
  SUPPLIERS: "Proveedores",
  PURCHASES: "Compras",
  CURRENCIES: "Monedas",
  COMPANY_SETTINGS: "Configuración",
  REPORTS: "Reportes",
  WAREHOUSES: "Almacenes",
  PROFILE: "Perfil",
};

const ACTION_LABEL: Record<string, string> = {
  VIEW: "Ver",
  CREATE: "Crear",
  EDIT: "Editar",
  DELETE: "Eliminar",
  EXPORT: "Exportar",
  ADMIN: "Administrar",
};

const ACTION_ORDER = ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "ADMIN"] as const;

function prettyPerm(module: string, action: string) {
  return `${ACTION_LABEL[action] ?? action} ${MODULE_LABEL[module] ?? module}`;
}

function groupPermsByModule(all: Permission[]) {
  const map = new Map<string, Permission[]>();
  for (const p of all) map.set(p.module, [...(map.get(p.module) ?? []), p]);

  const entries = Array.from(map.entries()).sort((a, b) => {
    const la = MODULE_LABEL[a[0]] ?? a[0];
    const lb = MODULE_LABEL[b[0]] ?? b[0];
    return la.localeCompare(lb, "es", { sensitivity: "base" });
  });

  for (const [, list] of entries) {
    list.sort((x, y) => ACTION_ORDER.indexOf(x.action as any) - ACTION_ORDER.indexOf(y.action as any));
  }

  return entries;
}

export default function RoleEditorModal({
  open,
  title,
  initialName,
  allPerms,
  initialSelectedIds,
  loadingPerms,
  saving,
  submitLabel,
  nameInputRef,
  onClose,
  onSubmit,
  permissionsDisabled,
  errorMsg,
}: {
  open: boolean;
  title: string;
  initialName: string;
  allPerms: Permission[];
  initialSelectedIds: string[];
  loadingPerms: boolean;
  saving: boolean;
  submitLabel: string;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onSubmit: (name: string, selectedIds: string[]) => Promise<void>;
  permissionsDisabled?: boolean;
  errorMsg?: string | null;
}) {
  const permsByModule = useMemo(() => groupPermsByModule(allPerms), [allPerms]);

  const [name, setName] = useState(initialName);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(() => new Set(initialSelectedIds));

  const initializedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;

    setName(initialName);
    setSelectedSet(new Set(initialSelectedIds));
    initializedRef.current = true;
  }, [open, initialName, initialSelectedIds]);

  const toggleOne = useCallback((permId: string, checked: boolean) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (checked) next.add(permId);
      else next.delete(permId);
      return next;
    });
  }, []);

  const toggleModule = useCallback((modulePerms: Permission[], checked: boolean) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (checked) for (const p of modulePerms) next.add(p.id);
      else for (const p of modulePerms) next.delete(p.id);
      return next;
    });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(name, Array.from(selectedSet));
  }

  const isGuardar = submitLabel.toLowerCase().includes("guardar");

  return (
    <Modal open={open} title={title} onClose={onClose} wide>
      {loadingPerms ? (
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando permisos…
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {errorMsg && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
              {errorMsg}
            </div>
          )}

          <TPInput
            label="Nombre del rol"
            value={name}
            onChange={setName}
            placeholder="Ej: Caja, Depósito, Ventas…"
            inputRef={nameInputRef}
          />

          <div
            className={cn(
              "space-y-4 max-h-[55vh] overflow-auto tp-scroll pr-1",
              permissionsDisabled && "opacity-60 pointer-events-none select-none"
            )}
          >
            {permsByModule.map(([module, listRaw]) => {
              const list = listRaw.filter((p) => p.action !== "ADMIN");

              const ids = list.map((p) => p.id);
              const total = ids.length;

              let selectedCount = 0;
              for (const id of ids) if (selectedSet.has(id)) selectedCount++;

              const fully = total > 0 && selectedCount === total;
              const indeterminate = selectedCount > 0 && selectedCount < total;

              return (
                <div key={module} className="tp-card p-3">
                  <div className="pb-4 flex items-start justify-between gap-3">
                    <TPCheckbox
                      checked={fully}
                      indeterminate={indeterminate}
                      onChange={(checked) => toggleModule(list, checked)}
                      disabled={permissionsDisabled}
                      label={
                        <span className="text-sm font-semibold underline underline-offset-4">
                          {MODULE_LABEL[module] ?? module}
                        </span>
                      }
                    />
                    <div className="text-xs text-muted">
                      {selectedCount}/{total}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {list.map((p) => {
                      const checked = selectedSet.has(p.id);
                      const techCode = `${p.module}:${p.action}`;

                      return (
                        <TPCheckbox
                          key={p.id}
                          checked={checked}
                          disabled={permissionsDisabled}
                          onChange={(v) => toggleOne(p.id, v)}
                          title={techCode}
                          label={<span className="text-sm">{prettyPerm(p.module, p.action)}</span>}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* BOTONES */}
          <div className="pt-2 flex justify-end gap-2">
            <TPButton
              variant="secondary"
              onClick={onClose}
              type="button"
              iconLeft={<X size={16} />}
              disabled={saving}
            >
              Cancelar
            </TPButton>

            <TPButton
              variant="primary"
              type="submit"
              loading={saving}
              iconLeft={
                !saving
                  ? isGuardar
                    ? <Save size={16} />
                    : <Check size={16} />
                  : undefined
              }
              disabled={saving}
            >
              {submitLabel}
            </TPButton>
          </div>
        </form>
      )}
    </Modal>
  );
}
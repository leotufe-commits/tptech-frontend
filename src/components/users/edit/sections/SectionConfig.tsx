// tptech-frontend/src/components/users/edit/sections/SectionConfig.tsx
import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { TPSegmentedPills } from "../../../ui/TPBadges";
import { cn, Section, effectLabel, permLabelByModuleAction } from "../../users.ui";

import type { Override, OverrideEffect, Role } from "../../../../services/users";
import type { Permission } from "../../../../services/permissions";

import DeletePinConfirmModal from "../partials/DeletePinConfirmModal";
import PinConfigSection from "../partials/PinConfigSection";
import { isPin4 } from "../helpers/sectionConfig.helpers";

type Props = {
  modalMode: "CREATE" | "EDIT";
  disableAdminDangerZone: boolean;
  confirmOverlay: string;

  canAdmin: boolean;
  isOwner: boolean;

  detailHasQuickPin: boolean;
  detailPinEnabled: boolean;

  pinFlowOpen: boolean;
  openPinFlow: () => void;
  closePinFlow: () => void;

  hasPin: boolean;
  pinFlowStep: "NEW" | "CONFIRM";
  setPinFlowStep: (v: "NEW" | "CONFIRM") => void;

  pinDraft: string;
  setPinDraft: (v: string) => void;
  pinDraft2: string;
  setPinDraft2: (v: string) => void;

  pinBusy: boolean;
  pinToggling: boolean;
  pinPillsDisabled: boolean;

  pinMsg: string | null;
  showPinMessage: boolean;

  pinNew: string;
  pinNew2: string;
  setPinNew: (v: string) => void;
  setPinNew2: (v: string) => void;

  adminSetOrResetPin: (opts?: { currentPin?: string }) => Promise<void>;
  adminTogglePinEnabled: (next: boolean, opts?: { confirmRemoveOverrides?: boolean }) => Promise<void>;
  adminRemovePin: (opts?: { confirmRemoveOverrides?: boolean; currentPin?: string }) => Promise<void>;

  specialListSorted: Override[];
  setConfirmDisablePinClearsSpecialOpen: (v: boolean) => void;

  specialBlocked: boolean;
  specialEnabled: boolean;
  setSpecialEnabled: (v: boolean) => void;

  specialPermPick: string;
  setSpecialPermPick: (v: string) => void;

  specialEffectPick: OverrideEffect;
  setSpecialEffectPick: (v: OverrideEffect) => void;

  specialSaving: boolean;
  specialClearing: boolean;

  allPerms: Permission[];
  permsLoading: boolean;

  addOrUpdateSpecial: () => Promise<void>;
  removeSpecial: (permissionId: string) => Promise<void>;

  labelByPermId: (permissionId: string) => string;

  setConfirmDisableSpecialOpen: (v: boolean) => void;

  fFavWarehouseId: string;
  setFFavWarehouseId: (v: string) => void;
  activeAlmacenes: Array<{ id: string; nombre: string; codigo: string }>;
  warehouseLabelById: (id?: string | null) => string | null;

  roles: Role[];
  rolesLoading: boolean;
  fRoleIds: string[];
  setFRoleIds: React.Dispatch<React.SetStateAction<string[]>>;
  roleLabel: (r: any) => string;

  isSelf: boolean;
  ownerRoleId: string | null;
  selfOwnerChecked: boolean;
};

export default function SectionConfig(props: Props) {
  const {
    modalMode,
    disableAdminDangerZone,
    confirmOverlay,

    canAdmin,
    isOwner,

    detailHasQuickPin,
    detailPinEnabled,

    pinFlowOpen,
    openPinFlow,
    closePinFlow,

    pinFlowStep,
    setPinFlowStep,
    pinDraft,
    setPinDraft,
    pinDraft2,
    setPinDraft2,

    pinBusy,
    pinToggling,
    pinPillsDisabled,

    pinMsg,
    showPinMessage,

    pinNew,
    pinNew2,
    setPinNew,
    setPinNew2,

    adminSetOrResetPin,
    adminTogglePinEnabled,
    adminRemovePin,

    specialListSorted,
    setConfirmDisablePinClearsSpecialOpen,

    specialBlocked,
    specialEnabled,
    setSpecialEnabled,
    specialPermPick,
    setSpecialPermPick,
    specialEffectPick,
    setSpecialEffectPick,

    specialSaving,
    specialClearing,

    allPerms,
    permsLoading,
    addOrUpdateSpecial,
    removeSpecial,
    labelByPermId,
    setConfirmDisableSpecialOpen,

    fFavWarehouseId,
    setFFavWarehouseId,
    activeAlmacenes,
    warehouseLabelById,

    roles,
    rolesLoading,
    fRoleIds,
    setFRoleIds,
    roleLabel,

    isSelf,
    ownerRoleId,
    selfOwnerChecked,
  } = props;

  // ✅ OPCIÓN A (solo visual)
  const [pinRemovedVisual, setPinRemovedVisual] = useState(false);

  // ✅ modal para pedir PIN ACTUAL al borrar (SELF)
  const [showDeletePinConfirm, setShowDeletePinConfirm] = useState(false);
  const [deletePinCurrent, setDeletePinCurrent] = useState("");
  const [deletePinErr, setDeletePinErr] = useState<string | null>(null);

  useEffect(() => {
    setPinRemovedVisual(false);
    setShowDeletePinConfirm(false);
    setDeletePinCurrent("");
    setDeletePinErr(null);
  }, [detailHasQuickPin, modalMode]);

  const busyDeleteSelf = pinBusy || pinToggling;

  return (
    <div className="w-full space-y-4">
      <DeletePinConfirmModal
        open={showDeletePinConfirm}
        busy={busyDeleteSelf}
        current={deletePinCurrent}
        setCurrent={setDeletePinCurrent}
        err={deletePinErr}
        setErr={setDeletePinErr}
        onClose={() => {
          if (busyDeleteSelf) return;
          setShowDeletePinConfirm(false);
          setDeletePinCurrent("");
          setDeletePinErr(null);
        }}
        onConfirm={(currentPin) => {
          if (!isPin4(currentPin)) {
            setDeletePinErr("Ingresá un PIN válido de 4 dígitos.");
            return;
          }

          void adminRemovePin({ currentPin }).then(() => {
            setPinNew("");
            setPinNew2("");
            setPinRemovedVisual(true);

            setShowDeletePinConfirm(false);
            setDeletePinCurrent("");
            setDeletePinErr(null);
          });
        }}
      />

      <PinConfigSection
        modalMode={modalMode}
        confirmOverlay={confirmOverlay}
        canAdmin={canAdmin}
        isOwner={isOwner}
        isSelf={isSelf}
        detailHasQuickPin={detailHasQuickPin}
        detailPinEnabled={detailPinEnabled}
        pinFlowOpen={pinFlowOpen}
        openPinFlow={openPinFlow}
        closePinFlow={closePinFlow}
        pinFlowStep={pinFlowStep}
        setPinFlowStep={setPinFlowStep}
        pinDraft={pinDraft}
        setPinDraft={setPinDraft}
        pinDraft2={pinDraft2}
        setPinDraft2={setPinDraft2}
        pinBusy={pinBusy}
        pinToggling={pinToggling}
        pinPillsDisabled={pinPillsDisabled}
        pinMsg={pinMsg}
        showPinMessage={showPinMessage}
        pinNew={pinNew}
        pinNew2={pinNew2}
        setPinNew={setPinNew}
        setPinNew2={setPinNew2}
        adminSetOrResetPin={adminSetOrResetPin}
        adminTogglePinEnabled={adminTogglePinEnabled}
        adminRemovePin={adminRemovePin}
        specialListSorted={specialListSorted}
        setConfirmDisablePinClearsSpecialOpen={setConfirmDisablePinClearsSpecialOpen}
        pinRemovedVisual={pinRemovedVisual}
        setPinRemovedVisual={setPinRemovedVisual}
        onAskDeleteSelf={() => {
          setDeletePinCurrent("");
          setDeletePinErr(null);
          setShowDeletePinConfirm(true);
        }}
      />

      {/* ✅ Almacén favorito */}
      <Section title="Almacén favorito" desc="Se usará por defecto en operaciones.">
        <select className="tp-input" value={fFavWarehouseId} onChange={(e) => setFFavWarehouseId(e.target.value)}>
          <option value="">Sin favorito</option>
          {activeAlmacenes.map((a) => {
            const isSelected = String(fFavWarehouseId) === String(a.id);
            return (
              <option key={a.id} value={a.id} disabled={isSelected}>
                {a.nombre} {a.codigo ? `(${a.codigo})` : ""}
                {isSelected ? " (seleccionado)" : ""}
              </option>
            );
          })}
        </select>

        <div className="mt-2 text-xs text-muted">
          {fFavWarehouseId
            ? `Seleccionado: ${warehouseLabelById(fFavWarehouseId) ?? fFavWarehouseId}`
            : "Sin almacén favorito"}
        </div>
      </Section>

      {/* ✅ Mensaje entre Almacén y Roles */}
      {disableAdminDangerZone ? (
        <div
          className="tp-card p-3 text-sm flex gap-3 items-start"
          style={{
            border: "1px solid color-mix(in oklab, var(--primary) 22%, var(--border))",
            background: "color-mix(in oklab, var(--card) 88%, var(--bg))",
          }}
        >
          <div className="min-w-0">
            <div className="font-semibold">Configuración restringida</div>
            <div className="text-xs text-muted">
              Estás editando tu propio usuario. Para evitar perder acceso o expirar la sesión, desde acá no podés cambiar
              roles/permisos.
              <br />
              ✅ Tu PIN y tu almacén favorito sí los podés gestionar.
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ Roles */}
      <Section title="Roles del usuario" desc="Selección múltiple.">
        <div className={cn("tp-card p-3 max-h-[260px] overflow-auto tp-scroll", disableAdminDangerZone && "opacity-60")}>
          {rolesLoading ? (
            <div className="text-sm text-muted flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando roles…
            </div>
          ) : roles.length === 0 ? (
            <div className="text-sm text-muted">No hay roles.</div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {roles.map((r: any) => {
                const rid = String(r?.id);
                const checked = fRoleIds.includes(rid);

                const disableThis =
                  disableAdminDangerZone || Boolean(isSelf && ownerRoleId && rid === ownerRoleId && selfOwnerChecked);

                return (
                  <label key={rid} className={cn("flex items-center gap-2 text-sm", disableThis && "cursor-not-allowed")}>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      disabled={disableThis}
                      onChange={(e) =>
                        setFRoleIds((prev) => (e.target.checked ? [...prev, rid] : prev.filter((id) => id !== rid)))
                      }
                    />
                    <span className={cn(disableThis && "text-muted")}>{roleLabel(r)}</span>
                    {isSelf && ownerRoleId && rid === ownerRoleId && selfOwnerChecked ? (
                      <span className="ml-2 text-[11px] text-muted">(obligatorio)</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {disableAdminDangerZone ? (
          <p className="mt-2 text-xs text-muted">Para cambiar tus roles necesitás que otro Admin/Owner lo haga por vos.</p>
        ) : (
          <p className="mt-2 text-xs text-muted">Si no seleccionás roles, queda sin permisos hasta asignar.</p>
        )}
      </Section>

      {/* ✅ Permisos especiales */}
      <Section
        title={<span className="inline-flex items-center gap-2">Permisos especiales</span>}
        right={
          <div className="ml-auto">
            <TPSegmentedPills
              value={specialEnabled}
              onChange={(next) => {
                if (!canAdmin) return;
                if (specialBlocked) return;

                if (!next && specialListSorted.length > 0) {
                  setConfirmDisableSpecialOpen(true);
                  return;
                }

                setSpecialEnabled(next);
                if (!next) {
                  setSpecialPermPick("");
                  setSpecialEffectPick("ALLOW");
                }
              }}
              disabled={!canAdmin || specialBlocked || specialClearing}
              labels={{
                on: "Permisos habilitados",
                off: isOwner ? "Bloqueado (Propietario)" : "Permisos deshabilitados",
              }}
            />
          </div>
        }
        desc="Opcional: Permitir/Denegar por permiso."
      >
        <div className="space-y-3">
          {isOwner ? (
            <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
              Los <b>Propietarios</b> no pueden tener permisos especiales (overrides). Se gestionan únicamente por roles.
            </div>
          ) : disableAdminDangerZone ? (
            <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm text-muted">
              Bloqueado al editar tu usuario (evita invalidar permisos y expirar sesión).
            </div>
          ) : null}

          <div className={cn("grid grid-cols-1 md:grid-cols-12 gap-2 items-end", specialBlocked && "opacity-60")}>
            <div className="md:col-span-7">
              <label className="mb-1 block text-xs text-muted">Permiso</label>
              <select
                className="tp-input"
                value={specialPermPick}
                onChange={(e) => setSpecialPermPick(e.target.value)}
                disabled={permsLoading || !specialEnabled || specialBlocked || specialClearing}
              >
                <option value="">{specialEnabled ? "Seleccionar…" : "Permisos especiales deshabilitados"}</option>
                {allPerms.map((p) => {
                  const alreadyAdded = specialListSorted.some((x) => x.permissionId === p.id);
                  return (
                    <option key={p.id} value={p.id} disabled={alreadyAdded}>
                      {permLabelByModuleAction(p.module, p.action)}
                      {alreadyAdded ? " (ya agregado)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="md:col-span-5">
              <label className="mb-1 block text-xs text-muted">Acción</label>

              <div className="flex gap-2">
                <select
                  className="tp-input"
                  value={specialEffectPick}
                  onChange={(e) => setSpecialEffectPick(e.target.value as any)}
                  disabled={!specialEnabled || specialBlocked || specialClearing}
                >
                  <option value="ALLOW">Permitir</option>
                  <option value="DENY">Denegar</option>
                </select>

                <button
                  type="button"
                  onClick={() => void addOrUpdateSpecial()}
                  disabled={!specialEnabled || !specialPermPick || specialBlocked || specialClearing || specialSaving}
                  className={cn(
                    "tp-btn-primary",
                    "h-[42px] w-[42px] px-0 grid place-items-center",
                    specialSaving && "opacity-60"
                  )}
                  title="Agregar / Actualizar"
                  aria-label="Agregar / Actualizar"
                >
                  {specialSaving ? "…" : "+"}
                </button>
              </div>
            </div>

            <div className="md:col-span-12">
              <p className="mt-2 text-xs text-muted">* Denegar pisa Permitir y pisa permisos heredados por roles.</p>
            </div>
          </div>

          <div className="tp-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left">Permiso</th>
                  <th className="px-3 py-2 text-left">Acción</th>
                  <th className="px-3 py-2 text-right">Quitar</th>
                </tr>
              </thead>

              <tbody>
                {!specialEnabled ? (
                  <tr>
                    <td className="px-3 py-3 text-muted" colSpan={3}>
                      Permisos especiales deshabilitados.
                    </td>
                  </tr>
                ) : specialListSorted.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-muted" colSpan={3}>
                      Sin permisos especiales.
                    </td>
                  </tr>
                ) : (
                  specialListSorted.map((ov) => (
                    <tr key={ov.permissionId} className="border-t border-border">
                      <td className="px-3 py-2">{labelByPermId(ov.permissionId)}</td>

                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                            ov.effect === "ALLOW"
                              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                              : "border-red-500/30 bg-red-500/15 text-red-300"
                          )}
                        >
                          {effectLabel(ov.effect)}
                        </span>
                      </td>

                      <td className="px-3 py-2 text-right">
                        <button
                          className={cn("tp-btn", (specialSaving || specialBlocked || specialClearing) && "opacity-60")}
                          type="button"
                          disabled={specialSaving || specialBlocked || specialClearing}
                          onClick={() => void removeSpecial(ov.permissionId)}
                          title={specialBlocked ? "No disponible para Propietario / Self edit." : "Quitar"}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </div>
  );
}

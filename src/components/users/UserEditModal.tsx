// tptech-frontend/src/components/users/UserEditModal.tsx
import React, { type FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, KeyRound, ShieldOff, AlertTriangle } from "lucide-react";

import EyeIcon from "../EyeIcon";
import { TPSegmentedPills } from "../ui/TPBadges";

// ✅ Modal ya NO se importa desde users.ui
import { Modal } from "../ui/Modal";

import {
  cn,
  Section,
  Tabs,
  type TabKey,
  initialsFrom,
  formatBytes,
  safeFileLabel,
  absUrl,
  effectLabel,
  permLabelByModuleAction,
} from "./users.ui";

import type { Override, OverrideEffect, UserAttachment, UserDetail, Role } from "../../services/users";
import type { Permission } from "../../services/permissions";

/* =========================
   PROPS
========================= */
type Props = {
  open: boolean;
  wide?: boolean;
  modalMode: "CREATE" | "EDIT";
  modalBusy: boolean;
  modalLoading: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (e?: FormEvent) => Promise<void> | void;

  // permissions
  canAdmin: boolean;
  isSelfEditing: boolean;

  // detail/state
  detail: UserDetail | null;

  tab: TabKey;
  setTab: (v: TabKey) => void;

  // fields
  fEmail: string;
  setFEmail: (v: string) => void;
  fName: string;
  setFName: (v: string) => void;
  fPassword: string;
  setFPassword: (v: string) => void;

  fPhoneCountry: string;
  setFPhoneCountry: (v: string) => void;
  fPhoneNumber: string;
  setFPhoneNumber: (v: string) => void;
  fDocType: string;
  setFDocType: (v: string) => void;
  fDocNumber: string;
  setFDocNumber: (v: string) => void;

  fStreet: string;
  setFStreet: (v: string) => void;
  fNumber: string;
  setFNumber: (v: string) => void;
  fCity: string;
  setFCity: (v: string) => void;
  fProvince: string;
  setFProvince: (v: string) => void;
  fPostalCode: string;
  setFPostalCode: (v: string) => void;
  fCountry: string;
  setFCountry: (v: string) => void;

  fNotes: string;
  setFNotes: (v: string) => void;

  // avatar
  avatarBusy: boolean;
  avatarImgLoading: boolean;
  setAvatarImgLoading: (v: boolean) => void;
  avatarPreview: string;
  setAvatarPreview: React.Dispatch<React.SetStateAction<string>>;
  avatarInputModalRef: React.RefObject<HTMLInputElement>;
  pickAvatarForModal: (file: File) => Promise<void>;
  modalRemoveAvatar: () => Promise<void>;
  setAvatarFileDraft: (f: File | null) => void;

  // attachments
  attInputRef: React.RefObject<HTMLInputElement>;
  uploadingAttachments: boolean;
  deletingAttId: string | null;
  attachmentsDraft: File[];
  removeDraftAttachmentByIndex: (idx: number) => void;
  addAttachments: (files: File[]) => Promise<void>;
  removeSavedAttachment: (id: string) => Promise<void>;
  savedAttachments: UserAttachment[];

  // pin
  pinBusy: boolean;
  pinMsg: string | null;
  pinNew: string;
  setPinNew: (v: string) => void;
  pinNew2: string;
  setPinNew2: (v: string) => void;
  adminTogglePinEnabled: (next: boolean, opts?: { confirmRemoveOverrides?: boolean }) => Promise<void>;
  adminSetOrResetPin: () => Promise<void>;
  adminRemovePin: (opts?: { confirmRemoveOverrides?: boolean }) => Promise<void>;

  // warehouse
  fFavWarehouseId: string;
  setFFavWarehouseId: (v: string) => void;
  activeAlmacenes: Array<{ id: string; nombre: string; codigo: string }>;
  warehouseLabelById: (id?: string | null) => string | null;

  // roles
  roles: Role[];
  rolesLoading: boolean;
  fRoleIds: string[];
  setFRoleIds: React.Dispatch<React.SetStateAction<string[]>>;
  roleLabel: (r: any) => string;

  // special perms
  allPerms: Permission[];
  permsLoading: boolean;

  specialEnabled: boolean;
  setSpecialEnabled: (v: boolean) => void;
  specialPermPick: string;
  setSpecialPermPick: (v: string) => void;
  specialEffectPick: OverrideEffect;
  setSpecialEffectPick: (v: OverrideEffect) => void;
  specialSaving: boolean;
  specialListSorted: Override[];
  addOrUpdateSpecial: () => Promise<void>;
  removeSpecial: (permissionId: string) => Promise<void>;
};

/* =========================
   INPUT CON OJO
========================= */
function InputWithEye({
  value,
  onChange,
  placeholder,
  disabled,
  inputMode,
  maxLength,
  onlyDigits,
  show,
  setShow,
  autoComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onlyDigits?: boolean;
  show: boolean;
  setShow: (v: boolean) => void;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        className="tp-input pr-10"
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => {
          let next = e.target.value;
          if (onlyDigits) next = next.replace(/\D/g, "");
          if (typeof maxLength === "number") next = next.slice(0, maxLength);
          onChange(next);
        }}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={autoComplete ?? "off"}
        spellCheck={false}
      />

      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text"
        aria-label={show ? "Ocultar" : "Mostrar"}
        title={show ? "Ocultar" : "Mostrar"}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}

function shouldHidePinMsg(msg?: string | null) {
  const m = String(msg || "").toLowerCase();
  if (!m) return true;
  return m.includes("sesión expirada") || m.includes("sesion expirada");
}

export default function UserEditModal(props: Props) {
  const {
    open,
    wide,
    modalMode,
    modalBusy,
    modalLoading,
    title,
    onClose,
    onSubmit,

    canAdmin,
    isSelfEditing,
    detail,

    tab,
    setTab,

    fEmail,
    setFEmail,
    fName,
    setFName,
    fPassword,
    setFPassword,

    fPhoneCountry,
    setFPhoneCountry,
    fPhoneNumber,
    setFPhoneNumber,
    fDocType,
    setFDocType,
    fDocNumber,
    setFDocNumber,

    fStreet,
    setFStreet,
    fNumber,
    setFNumber,
    fCity,
    setFCity,
    fProvince,
    setFProvince,
    fPostalCode,
    setFPostalCode,
    fCountry,
    setFCountry,

    fNotes,
    setFNotes,

    avatarBusy,
    avatarImgLoading,
    setAvatarImgLoading,
    avatarPreview,
    setAvatarPreview,
    avatarInputModalRef,
    pickAvatarForModal,
    modalRemoveAvatar,
    setAvatarFileDraft,

    attInputRef,
    uploadingAttachments,
    deletingAttId,
    attachmentsDraft,
    removeDraftAttachmentByIndex,
    addAttachments,
    removeSavedAttachment,
    savedAttachments,

    pinBusy,
    pinMsg,
    pinNew,
    setPinNew,
    pinNew2,
    setPinNew2,
    adminTogglePinEnabled,
    adminSetOrResetPin,
    adminRemovePin,

    fFavWarehouseId,
    setFFavWarehouseId,
    activeAlmacenes,
    warehouseLabelById,

    roles,
    rolesLoading,
    fRoleIds,
    setFRoleIds,
    roleLabel,

    allPerms,
    permsLoading,

    specialEnabled,
    setSpecialEnabled,
    specialPermPick,
    setSpecialPermPick,
    specialEffectPick,
    setSpecialEffectPick,

    specialSaving,
    specialListSorted,
    addOrUpdateSpecial,
    removeSpecial,
  } = props;

  const [showPassword, setShowPassword] = useState(false);
  const [showPin1, setShowPin1] = useState(false);
  const [showPin2, setShowPin2] = useState(false);

  // previews attachments draft
  const [draftPreviewByKey, setDraftPreviewByKey] = useState<Record<string, string>>({});
  function draftKey(f: File) {
    return `${f.name}-${f.size}-${f.lastModified}`;
  }

  const [hiddenSavedAttIds, setHiddenSavedAttIds] = useState<Set<string>>(new Set());
  const [forceHideDetailAvatar, setForceHideDetailAvatar] = useState(false);

  // confirm: deshabilitar permisos especiales
  const [confirmDisableSpecialOpen, setConfirmDisableSpecialOpen] = useState(false);
  const [specialClearing, setSpecialClearing] = useState(false);

  // confirm: deshabilitar PIN borra permisos especiales
  const [confirmDisablePinClearsSpecialOpen, setConfirmDisablePinClearsSpecialOpen] = useState(false);
  const [pinToggling, setPinToggling] = useState(false);

  const isSelf = Boolean(isSelfEditing);
  const disableAdminDangerZone = isSelf;

  // ✅ Owner detection (para bloquear permisos especiales si es Propietario)
  const isOwner = Boolean(
    detail?.roles?.some((r) => String((r as any)?.code || (r as any)?.name || "").toUpperCase().trim() === "OWNER")
  );

  // ✅ Mantiene sincronizados los objectURL con attachmentsDraft
  useEffect(() => {
    setDraftPreviewByKey((prev) => {
      const next: Record<string, string> = { ...prev };
      const alive = new Set<string>();

      for (const f of attachmentsDraft) {
        const k = draftKey(f);
        alive.add(k);

        const isImg = String((f as any)?.type || "").startsWith("image/");
        if (isImg && !next[k]) {
          try {
            next[k] = URL.createObjectURL(f);
          } catch {}
        }
      }

      for (const k of Object.keys(next)) {
        if (!alive.has(k)) {
          try {
            URL.revokeObjectURL(next[k]);
          } catch {}
          delete next[k];
        }
      }

      return next;
    });
  }, [attachmentsDraft]);

  // reset state cuando abre/cambia user
  useEffect(() => {
    if (!open) return;
    setHiddenSavedAttIds(new Set());
    setForceHideDetailAvatar(false);
    setConfirmDisableSpecialOpen(false);
    setSpecialClearing(false);
    setConfirmDisablePinClearsSpecialOpen(false);
    setPinToggling(false);
    setShowPassword(false);
    setShowPin1(false);
    setShowPin2(false);
  }, [open, detail?.id]);

  function safeClose() {
    try {
      if (typeof avatarPreview === "string" && avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    } catch {}
    try {
      for (const u of Object.values(draftPreviewByKey)) URL.revokeObjectURL(u);
    } catch {}

    setAvatarPreview("");
    setAvatarFileDraft(null);
    setDraftPreviewByKey({});

    setHiddenSavedAttIds(new Set());
    setForceHideDetailAvatar(false);
    setConfirmDisableSpecialOpen(false);
    setSpecialClearing(false);
    setConfirmDisablePinClearsSpecialOpen(false);
    setPinToggling(false);
    setShowPassword(false);
    setShowPin1(false);
    setShowPin2(false);

    onClose();
  }

  const canShowPinToggle = Boolean(detail?.hasQuickPin);

  // ✅ el PIN no debe quedar “bloqueado” por permisos especiales
  const pinPillsDisabled = pinBusy || pinToggling || !canAdmin || !canShowPinToggle || disableAdminDangerZone;

  const detailAvatar = !forceHideDetailAvatar && detail?.avatarUrl ? absUrl(String(detail.avatarUrl)) : "";
  const avatarSrc = avatarPreview || detailAvatar;

  const showPinMessage = !shouldHidePinMsg(pinMsg);

  // role owner id (para el “obligatorio” cuando editás tu usuario)
  const ownerRoleId = useMemo(() => {
    const r =
      roles.find((x: any) => String((x as any)?.code || "").toUpperCase() === "OWNER") ??
      roles.find((x: any) => String((x as any)?.name || "").toUpperCase() === "OWNER");
    return (r as any)?.id ? String((r as any).id) : null;
  }, [roles]);

  const selfOwnerChecked = Boolean(isSelf && ownerRoleId && fRoleIds.includes(ownerRoleId));

  const filteredSavedAttachments = useMemo(() => {
    if (!savedAttachments?.length) return [];
    if (!hiddenSavedAttIds.size) return savedAttachments;
    return savedAttachments.filter((a) => !hiddenSavedAttIds.has(String(a.id)));
  }, [savedAttachments, hiddenSavedAttIds]);

  const permById = useMemo(() => {
    const m = new Map<string, Permission>();
    for (const p of allPerms || []) m.set(String(p.id), p);
    return m;
  }, [allPerms]);

  function labelByPermId(permissionId: string) {
    const p = permById.get(String(permissionId));
    if (!p) return "Permiso desconocido";
    return permLabelByModuleAction(p.module, p.action);
  }

  async function handleRemoveSavedAttachment(id: string) {
    if (!id) return;
    try {
      setHiddenSavedAttIds((prev) => {
        const next = new Set(prev);
        next.add(String(id));
        return next;
      });
      await removeSavedAttachment(String(id));
    } catch (e) {
      setHiddenSavedAttIds((prev) => {
        const next = new Set(prev);
        next.delete(String(id));
        return next;
      });
      throw e;
    }
  }

  async function handleRemoveAvatar() {
    if (avatarBusy || modalBusy) return;

    if (avatarPreview) {
      setAvatarPreview((prev) => {
        if (String(prev || "").startsWith("blob:")) URL.revokeObjectURL(String(prev));
        return "";
      });
      setAvatarFileDraft(null);
      setForceHideDetailAvatar(false);
      return;
    }

    if (modalMode === "EDIT" && detail?.avatarUrl) {
      await modalRemoveAvatar();
      setForceHideDetailAvatar(true);
      setAvatarPreview((prev) => {
        if (String(prev || "").startsWith("blob:")) URL.revokeObjectURL(String(prev));
        return "";
      });
      setAvatarFileDraft(null);
    }
  }

  async function clearAllSpecialOverrides() {
    const ids = specialListSorted.map((x) => String(x.permissionId)).filter(Boolean);
    for (const pid of ids) {
      await removeSpecial(pid);
    }
  }

  async function confirmDisableSpecialAndClear() {
    if (disableAdminDangerZone) return;
    setSpecialClearing(true);
    try {
      await clearAllSpecialOverrides();
      setSpecialPermPick("");
      setSpecialEffectPick("ALLOW");
      setSpecialEnabled(false);
      setConfirmDisableSpecialOpen(false);
    } finally {
      setSpecialClearing(false);
    }
  }

  async function confirmDisablePinAndClearSpecial() {
    if (disableAdminDangerZone) return;

    setPinToggling(true);
    try {
      await adminTogglePinEnabled(false, { confirmRemoveOverrides: true });

      // reset UI permisos especiales
      setSpecialPermPick("");
      setSpecialEffectPick("ALLOW");
      setSpecialEnabled(false);

      setConfirmDisablePinClearsSpecialOpen(false);
    } finally {
      setPinToggling(false);
    }
  }

  // ✅ Bloqueo total permisos especiales si es OWNER o self-edit
  const specialBlocked = disableAdminDangerZone || isOwner;

  // ✅ Confirm overlays más oscuros SOLO para estos confirm (no afecta otros modales)
  const confirmOverlay = "bg-black/70 backdrop-blur-[1px]";

  return (
    <>
      {/* ✅ Confirm modal: deshabilitar PIN borra permisos especiales */}
      <Modal
        open={confirmDisablePinClearsSpecialOpen}
        title="Deshabilitar PIN"
        onClose={() => {
          if (pinToggling || specialClearing) return;
          setConfirmDisablePinClearsSpecialOpen(false);
        }}
        wide={false}
        overlayClassName={confirmOverlay}
      >
        <div className="space-y-3">
          <div
            className="tp-card p-3 text-sm flex gap-3 items-start"
            style={{
              border: "1px solid color-mix(in oklab, #ef4444 20%, var(--border))",
              background: "color-mix(in oklab, var(--card) 88%, var(--bg))",
            }}
          >
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold">Se eliminarán permisos especiales</div>
              <div className="text-xs text-muted">
                Este usuario tiene <b>{specialListSorted.length}</b> permiso(s) especial(es). Si deshabilitás el PIN y confirmás, se
                borrarán permanentemente. ¿Deseás continuar?
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              className="tp-btn-secondary"
              type="button"
              disabled={pinToggling || specialClearing}
              onClick={() => setConfirmDisablePinClearsSpecialOpen(false)}
            >
              Cancelar
            </button>

            <button
              className={cn("tp-btn-primary", (pinToggling || specialClearing) && "opacity-60")}
              type="button"
              disabled={pinToggling || specialClearing}
              onClick={() => void confirmDisablePinAndClearSpecial()}
              title="Deshabilitar PIN y borrar permisos"
            >
              {pinToggling || specialClearing ? "Procesando…" : "Deshabilitar y borrar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ✅ Confirm modal: deshabilitar permisos especiales borra asignaciones */}
      <Modal
        open={confirmDisableSpecialOpen}
        title="Deshabilitar permisos especiales"
        onClose={() => {
          if (specialClearing) return;
          setConfirmDisableSpecialOpen(false);
        }}
        wide={false}
        overlayClassName={confirmOverlay}
      >
        <div className="space-y-3">
          <div
            className="tp-card p-3 text-sm flex gap-3 items-start"
            style={{
              border: "1px solid color-mix(in oklab, #ef4444 20%, var(--border))",
              background: "color-mix(in oklab, var(--card) 88%, var(--bg))",
            }}
          >
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold">Se eliminarán permisos asignados</div>
              <div className="text-xs text-muted">
                Este usuario tiene <b>{specialListSorted.length}</b> permiso(s) especial(es). Si deshabilitás la píldora, se borrarán
                permanentemente. ¿Deseás continuar?
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button className="tp-btn-secondary" type="button" disabled={specialClearing} onClick={() => setConfirmDisableSpecialOpen(false)}>
              Cancelar
            </button>

            <button
              className={cn("tp-btn-primary", specialClearing && "opacity-60")}
              type="button"
              disabled={specialClearing}
              onClick={() => void confirmDisableSpecialAndClear()}
              title="Deshabilitar y borrar permisos"
            >
              {specialClearing ? "Borrando…" : "Deshabilitar y borrar"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ✅ Modal principal */}
      <Modal open={open} wide={wide} title={title} onClose={safeClose}>
        {modalLoading ? (
          <div className="tp-card p-4 text-sm text-muted flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {/* Avatar */}
            <div className="tp-card p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <button
                      type="button"
                      className={cn(
                        "h-16 w-16 rounded-2xl grid place-items-center relative overflow-hidden",
                        "focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]",
                        (avatarBusy || modalBusy) && "opacity-60 cursor-not-allowed"
                      )}
                      style={{
                        border: "1px solid var(--border)",
                        background: "color-mix(in oklab, var(--card) 80%, var(--bg))",
                        color: "var(--muted)",
                      }}
                      title={detail?.avatarUrl || avatarPreview ? "Editar avatar" : "Agregar avatar"}
                      onClick={() => {
                        if (!avatarBusy && !modalBusy) avatarInputModalRef.current?.click();
                      }}
                      disabled={avatarBusy || modalBusy}
                    >
                      {(avatarBusy || avatarImgLoading) && (
                        <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(0,0,0,0.22)" }}>
                          <div className="h-6 w-6 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        </div>
                      )}

                      {avatarSrc ? (
                        <img
                          src={avatarSrc}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                          onLoadStart={() => setAvatarImgLoading(true)}
                          onLoad={() => setAvatarImgLoading(false)}
                          onError={() => setAvatarImgLoading(false)}
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-sm font-bold text-primary">
                          {initialsFrom(fName || fEmail || "U")}
                        </div>
                      )}

                      <div
                        className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity", "grid place-items-center")}
                        style={{ background: "rgba(0,0,0,0.28)" }}
                        aria-hidden="true"
                      >
                        <span className="text-white text-[11px] px-2 text-center leading-tight">
                          {avatarBusy ? "SUBIENDO…" : avatarPreview || detail?.avatarUrl ? "EDITAR" : "AGREGAR"}
                        </span>
                      </div>
                    </button>

                    {(avatarPreview || (modalMode === "EDIT" && detail?.avatarUrl && !forceHideDetailAvatar)) && (
                      <button
                        type="button"
                        onClick={() => void handleRemoveAvatar()}
                        className={cn("absolute top-2 right-2 h-6 w-6 rounded-full grid place-items-center", "opacity-0 group-hover:opacity-100 transition-opacity")}
                        style={{
                          background: "rgba(255,255,255,0.75)",
                          border: "1px solid rgba(0,0,0,0.08)",
                          backdropFilter: "blur(6px)",
                        }}
                        title={avatarPreview ? "Descartar" : "Eliminar avatar"}
                        aria-label={avatarPreview ? "Descartar" : "Eliminar avatar"}
                        disabled={avatarBusy || modalBusy}
                      >
                        <span className="text-[11px] leading-none">✕</span>
                      </button>
                    )}

                    <input
                      ref={avatarInputModalRef}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (!f) return;

                        setForceHideDetailAvatar(false);
                        void pickAvatarForModal(f);
                      }}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-semibold">Imagen de Perfil</div>
                    <div className="text-xs text-muted">
                      {modalMode === "CREATE" ? "Podés elegirlo ahora (se sube al crear)." : "Elegí uno nuevo para actualizar al instante."}
                    </div>
                  </div>
                </div>

                {avatarPreview && (
                  <button className="tp-btn" type="button" onClick={() => void handleRemoveAvatar()} disabled={avatarBusy || modalBusy}>
                    Descartar
                  </button>
                )}
              </div>
            </div>

            {/* aviso self */}
            {modalMode === "EDIT" && isSelf && (
              <div
                className="tp-card p-3 text-sm flex gap-3 items-start"
                style={{
                  border: "1px solid color-mix(in oklab, var(--primary) 22%, var(--border))",
                  background: "color-mix(in oklab, var(--card) 88%, var(--bg))",
                }}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-semibold">Estás editando tu propio usuario</div>
                  <div className="text-xs text-muted">
                    Para evitar perder acceso o expirar la sesión, desde acá no podés cambiar roles/permisos/almacén favorito/PIN. Eso debe
                    hacerlo otro Admin/Owner.
                  </div>
                </div>
              </div>
            )}

            <Tabs value={tab} onChange={setTab} configBadge={disableAdminDangerZone ? "Restringida" : undefined} />

            {/* TAB DATA */}
            {tab === "DATA" ? (
              <div className="space-y-4">
                <Section title="Cuenta" desc="Email y contraseña inicial.">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="md:col-span-1">
                      <label className="mb-1 block text-xs text-muted">Email</label>
                      <input
                        className="tp-input"
                        value={fEmail}
                        onChange={(e) => setFEmail(e.target.value)}
                        placeholder="usuario@correo.com"
                        disabled={modalMode === "EDIT"}
                        autoComplete="email"
                      />
                      {modalMode === "EDIT" ? <p className="mt-1 text-[11px] text-muted">(El email no se edita desde aquí)</p> : null}
                    </div>

                    <div className="md:col-span-1">
                      <label className="mb-1 block text-xs text-muted">
                        {modalMode === "CREATE" ? "Contraseña (opcional)" : "Nueva contraseña (opcional)"}
                      </label>

                      <InputWithEye
                        value={fPassword}
                        onChange={setFPassword}
                        placeholder={modalMode === "CREATE" ? "Si la dejás vacía, queda Inactivo" : "Dejar vacía para no cambiar"}
                        disabled={false}
                        show={showPassword}
                        setShow={setShowPassword}
                        autoComplete="new-password"
                      />

                      {modalMode === "CREATE" ? (
                        <p className="mt-1 text-[11px] text-muted">
                          Si la contraseña está vacía, el usuario queda <b>Inactivo</b> (PENDING en backend).
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-muted">(Solo se cambia si escribís una nueva)</p>
                      )}
                    </div>
                  </div>
                </Section>

                <Section title="Datos personales" desc="Nombre, documento y dirección (como Empresa).">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-12">
                      <label className="mb-1 block text-xs text-muted">Nombre y apellido *</label>
                      <input className="tp-input" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Nombre Apellido" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-muted">Tipo doc.</label>
                      <input className="tp-input" value={fDocType} onChange={(e) => setFDocType(e.target.value)} placeholder="DNI / PAS / CUIT" />
                    </div>

                    <div className="md:col-span-4">
                      <label className="mb-1 block text-xs text-muted">Nro. doc.</label>
                      <input className="tp-input" value={fDocNumber} onChange={(e) => setFDocNumber(e.target.value)} placeholder="12345678" />
                    </div>

                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs text-muted">Tel. país</label>
                      <input className="tp-input" value={fPhoneCountry} onChange={(e) => setFPhoneCountry(e.target.value)} placeholder="+54" />
                    </div>

                    <div className="md:col-span-4">
                      <label className="mb-1 block text-xs text-muted">Teléfono</label>
                      <input className="tp-input" value={fPhoneNumber} onChange={(e) => setFPhoneNumber(e.target.value)} placeholder="11 1234 5678" />
                    </div>

                    <div className="md:col-span-12 mt-2">
                      <div className="tp-card p-4">
                        <div className="text-sm font-semibold mb-3">Domicilio</div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                          <div className="md:col-span-5">
                            <label className="mb-1 block text-xs text-muted">Calle</label>
                            <input className="tp-input" value={fStreet} onChange={(e) => setFStreet(e.target.value)} placeholder="Calle" />
                          </div>

                          <div className="md:col-span-2">
                            <label className="mb-1 block text-xs text-muted">Número</label>
                            <input className="tp-input" value={fNumber} onChange={(e) => setFNumber(e.target.value)} placeholder="123" />
                          </div>

                          <div className="md:col-span-5">
                            <label className="mb-1 block text-xs text-muted">Ciudad</label>
                            <input className="tp-input" value={fCity} onChange={(e) => setFCity(e.target.value)} placeholder="Ciudad" />
                          </div>

                          <div className="md:col-span-4">
                            <label className="mb-1 block text-xs text-muted">Provincia</label>
                            <input className="tp-input" value={fProvince} onChange={(e) => setFProvince(e.target.value)} placeholder="Provincia" />
                          </div>

                          <div className="md:col-span-4">
                            <label className="mb-1 block text-xs text-muted">Código postal</label>
                            <input className="tp-input" value={fPostalCode} onChange={(e) => setFPostalCode(e.target.value)} placeholder="1012" />
                          </div>

                          <div className="md:col-span-4">
                            <label className="mb-1 block text-xs text-muted">País</label>
                            <input className="tp-input" value={fCountry} onChange={(e) => setFCountry(e.target.value)} placeholder="Argentina" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Section title="Notas" desc="Notas internas.">
                    <textarea className="tp-input min-h-[180px]" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Notas internas…" />
                  </Section>

                  <Section title="Adjuntos" desc="Archivos del usuario (PDF, imágenes, etc.).">
                    <div className="space-y-3">
                      <button
                        type="button"
                        className="block w-full cursor-pointer"
                        onClick={() => attInputRef.current?.click()}
                        disabled={uploadingAttachments || modalBusy}
                      >
                        <div
                          className="min-h-[180px] flex items-center justify-center border border-dashed rounded-2xl"
                          style={{
                            borderColor: "var(--border)",
                            background: "color-mix(in oklab, var(--card) 82%, var(--bg))",
                            color: "var(--muted)",
                          }}
                        >
                          {uploadingAttachments ? "Subiendo…" : "Click para agregar archivos +"}
                        </div>
                      </button>

                      <input
                        ref={attInputRef}
                        type="file"
                        multiple
                        hidden
                        onChange={(e) => {
                          const picked = Array.from(e.currentTarget.files ?? []);
                          e.currentTarget.value = "";
                          void addAttachments(picked);
                        }}
                      />

                      {attachmentsDraft.length > 0 && (
                        <div>
                          <div className="text-xs text-[color:var(--muted)] mb-2">Seleccionados</div>
                          <div className="space-y-2">
                            {attachmentsDraft.map((f, idx) => {
                              const isImg = String((f as any)?.type || "").startsWith("image/");
                              const k = draftKey(f);
                              const previewUrl = isImg ? draftPreviewByKey[k] : "";

                              return (
                                <div
                                  key={k}
                                  className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                                  style={{
                                    border: "1px solid var(--border)",
                                    background: "color-mix(in oklab, var(--card) 90%, var(--bg))",
                                  }}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {isImg && previewUrl ? (
                                      <img
                                        src={previewUrl}
                                        alt={safeFileLabel(f.name)}
                                        className="h-10 w-10 rounded-lg object-cover border"
                                        style={{ borderColor: "var(--border)" }}
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div
                                        className="h-10 w-10 rounded-lg grid place-items-center border text-xs"
                                        style={{
                                          borderColor: "var(--border)",
                                          color: "var(--muted)",
                                          background: "color-mix(in oklab, var(--card) 85%, var(--bg))",
                                        }}
                                      >
                                        DOC
                                      </div>
                                    )}

                                    <div className="min-w-0">
                                      <div className="text-sm text-text truncate">{safeFileLabel(f.name)}</div>
                                      <div className="text-xs text-muted">{formatBytes(f.size)}</div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className={cn("h-8 w-8 rounded-full grid place-items-center", "opacity-0 group-hover:opacity-100 transition-opacity")}
                                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                                    title="Quitar del borrador"
                                    aria-label="Quitar del borrador"
                                    disabled={modalBusy || uploadingAttachments}
                                    onClick={() => removeDraftAttachmentByIndex(idx)}
                                  >
                                    <span className="text-xs">✕</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {modalMode === "EDIT" && filteredSavedAttachments.length > 0 && (
                        <div>
                          <div className="text-xs text-[color:var(--muted)] mb-2">Guardados</div>
                          <div className="space-y-2">
                            {filteredSavedAttachments.map((a) => {
                              const busy = deletingAttId === a.id;
                              const url = absUrl(a.url || "");
                              const isImg = String(a.mimeType || "").startsWith("image/");

                              return (
                                <div
                                  key={a.id}
                                  className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2"
                                  style={{
                                    border: "1px solid var(--border)",
                                    background: "color-mix(in oklab, var(--card) 90%, var(--bg))",
                                  }}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {isImg && url ? (
                                      <img
                                        src={url}
                                        alt={safeFileLabel(a.filename)}
                                        className="h-10 w-10 rounded-lg object-cover border"
                                        style={{ borderColor: "var(--border)" }}
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div
                                        className="h-10 w-10 rounded-lg grid place-items-center border text-xs"
                                        style={{
                                          borderColor: "var(--border)",
                                          color: "var(--muted)",
                                          background: "color-mix(in oklab, var(--card) 85%, var(--bg))",
                                        }}
                                      >
                                        DOC
                                      </div>
                                    )}

                                    <div className="min-w-0">
                                      <div className="text-sm text-text truncate">{safeFileLabel(a.filename)}</div>
                                      <div className="text-xs text-muted flex gap-2">
                                        <span className="truncate">{formatBytes(a.size)}</span>
                                        {url && (
                                          <a
                                            className="underline underline-offset-2"
                                            href={url}
                                            target="_blank"
                                            rel="noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Abrir
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    className={cn("h-8 w-8 rounded-full grid place-items-center", "opacity-0 group-hover:opacity-100 transition-opacity")}
                                    style={{ background: "var(--card)", border: "1px solid var(--border)" }}
                                    title="Eliminar adjunto"
                                    aria-label="Eliminar adjunto"
                                    disabled={busy}
                                    onClick={() => void handleRemoveSavedAttachment(a.id)}
                                  >
                                    <span className="text-xs">{busy ? "…" : "✕"}</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {attachmentsDraft.length === 0 && (modalMode !== "EDIT" || filteredSavedAttachments.length === 0) && !uploadingAttachments ? (
                        <div className="text-xs text-muted">Todavía no hay adjuntos.</div>
                      ) : null}
                    </div>
                  </Section>
                </div>
              </div>
            ) : null}

            {/* TAB CONFIG */}
            {tab === "CONFIG" ? (
              <div className="w-full space-y-4">
                {disableAdminDangerZone && (
                  <div
                    className="tp-card p-3 text-sm flex gap-3 items-start"
                    style={{
                      border: "1px solid color-mix(in oklab, var(--primary) 22%, var(--border))",
                      background: "color-mix(in oklab, var(--card) 88%, var(--bg))",
                    }}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-semibold">Configuración restringida</div>
                      <div className="text-xs text-muted">
                        Estás editando tu propio usuario. Para evitar perder acceso o expirar la sesión, desde acá no podés cambiar
                        roles/permisos/almacén favorito/PIN. Esto debe hacerlo otro Admin/Owner.
                      </div>
                    </div>
                  </div>
                )}

                {modalMode === "EDIT" ? (
  <Section
    title="Clave rápida (PIN)"
    desc="PIN de 4 dígitos para desbloqueo rápido."
    right={
      detail?.hasQuickPin ? (
        <TPSegmentedPills
          value={Boolean(detail?.pinEnabled)}
          disabled={pinPillsDisabled}
          onChange={(v) => {
            if (pinBusy || pinToggling) return;
            if (!canAdmin || disableAdminDangerZone) return;

            if (!v && specialListSorted.length > 0) {
              setConfirmDisablePinClearsSpecialOpen(true);
              return;
            }

            setPinToggling(true);
            void adminTogglePinEnabled(v).finally(() => setPinToggling(false));
          }}
          labels={{ on: "Activo", off: "Inactivo" }}
        />
      ) : (
        <span className="text-xs text-muted">Sin PIN</span>
      )
    }
  >
    <div className="space-y-3">
      {/* Inputs PIN */}
      <div
        className={cn(
          "flex items-center gap-2",
          (!canAdmin || disableAdminDangerZone) && "opacity-60"
        )}
      >
        <input
          className="tp-input text-center tracking-[0.3em] w-[120px]"
          placeholder="••••"
          value={pinNew}
          onChange={(e) => setPinNew(e.target.value.replace(/\D/g, "").slice(0, 4))}
          disabled={pinBusy || pinToggling || !canAdmin || disableAdminDangerZone}
          inputMode="numeric"
        />

        <input
          className="tp-input text-center tracking-[0.3em] w-[120px]"
          placeholder="••••"
          value={pinNew2}
          onChange={(e) => setPinNew2(e.target.value.replace(/\D/g, "").slice(0, 4))}
          disabled={pinBusy || pinToggling || !canAdmin || disableAdminDangerZone}
          inputMode="numeric"
        />
      </div>

      {/* Acciones sutiles */}
      <div className="flex items-center gap-3 text-xs">
        <button
          type="button"
          className={cn(
            "underline underline-offset-2 hover:opacity-80",
            (pinBusy || pinToggling || !canAdmin || disableAdminDangerZone) && "opacity-50"
          )}
          disabled={pinBusy || pinToggling || !canAdmin || disableAdminDangerZone}
          onClick={() => void adminSetOrResetPin()}
        >
          {detail?.hasQuickPin ? "Actualizar PIN" : "Crear PIN"}
        </button>

        {detail?.hasQuickPin && (
          <button
            type="button"
            className="text-muted hover:text-red-400 underline underline-offset-2"
            disabled={pinBusy || pinToggling || !canAdmin || disableAdminDangerZone}
            onClick={() => {
              if (specialListSorted.length > 0) {
                setConfirmDisablePinClearsSpecialOpen(true);
                return;
              }
              void adminRemovePin();
            }}
          >
            Eliminar
          </button>
        )}
      </div>
    </div>
  </Section>
) : null}


                <Section title="Almacén favorito" desc="Se usará por defecto en operaciones.">
                  <select
                    className="tp-input"
                    value={fFavWarehouseId}
                    onChange={(e) => setFFavWarehouseId(e.target.value)}
                    disabled={!canAdmin || disableAdminDangerZone}
                    title={disableAdminDangerZone ? "No se puede cambiar en tu propio usuario (evita perder acceso)." : undefined}
                  >
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
                    {disableAdminDangerZone
                      ? "Bloqueado al editar tu usuario."
                      : fFavWarehouseId
                      ? `Seleccionado: ${warehouseLabelById(fFavWarehouseId) ?? fFavWarehouseId}`
                      : "Sin almacén favorito"}
                  </div>
                </Section>

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
                        {roles.map((r) => {
                          const rid = String((r as any).id);
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
                                onChange={(e) => setFRoleIds((prev) => (e.target.checked ? [...prev, rid] : prev.filter((id) => id !== rid)))}
                              />
                              <span className={cn(disableThis && "text-muted")}>{roleLabel(r as any)}</span>
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

                {/* ⛔️ PARTE 1/2 termina aquí (antes de "Permisos especiales") */}
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

                    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-2", specialBlocked && "opacity-60")}>
                      <div className="md:col-span-2">
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

                      <div>
                        <label className="mb-1 block text-xs text-muted">Acción</label>
                        <select
                          className="tp-input"
                          value={specialEffectPick}
                          onChange={(e) => setSpecialEffectPick(e.target.value as any)}
                          disabled={!specialEnabled || specialBlocked || specialClearing}
                        >
                          <option value="ALLOW">Permitir</option>
                          <option value="DENY">Denegar</option>
                        </select>
                      </div>

                      <div className="md:col-span-3">
                        <button
                          className={cn(
                            "tp-btn-primary w-full",
                            (!specialEnabled || !specialPermPick || specialSaving || specialBlocked || specialClearing) && "opacity-60"
                          )}
                          type="button"
                          disabled={!specialEnabled || !specialPermPick || specialSaving || specialBlocked || specialClearing}
                          onClick={() => void addOrUpdateSpecial()}
                        >
                          {specialSaving ? "Guardando…" : "Agregar / Actualizar"}
                        </button>

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
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button className="tp-btn-secondary" type="button" onClick={safeClose} disabled={modalBusy}>
                Cancelar
              </button>

              <button className={cn("tp-btn-primary", modalBusy && "opacity-60")} type="submit" disabled={modalBusy}>
                {modalBusy ? "Guardando…" : modalMode === "CREATE" ? "Crear" : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

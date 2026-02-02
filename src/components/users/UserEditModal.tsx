// tptech-frontend/src/components/users/UserEditModal.tsx
import React, { type FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

import { Modal } from "../ui/Modal";
import UserEditFooter from "./edit/UserEditFooter";

import SectionData from "./edit/sections/SectionData";
import SectionConfig from "./edit/sections/SectionConfig";
import { ConfirmModals } from "./edit/sections/ConfirmModals";

import { cn, Tabs, type TabKey, initialsFrom, absUrl, permLabelByModuleAction } from "./users.ui";

import type { Override, OverrideEffect, Role, UserAttachment, UserDetail } from "../../services/users";
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

  // pin (draft)
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
   HELPERS
========================= */
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

  const isSelf = Boolean(isSelfEditing);
  const disableAdminDangerZone = isSelf;

  const [showPassword, setShowPassword] = useState(false);

  // ✅ Owner detection (para bloquear permisos especiales si es Propietario)
  const isOwner = Boolean(
    detail?.roles?.some((r) => String((r as any)?.code || (r as any)?.name || "").toUpperCase().trim() === "OWNER")
  );

  // ===== PIN FLOW (UI) =====
  const [pinFlowOpen, setPinFlowOpen] = useState(false);
  const [pinFlowStep, setPinFlowStep] = useState<"NEW" | "CONFIRM">("NEW");
  const [pinDraft, setPinDraft] = useState("");
  const [pinDraft2, setPinDraft2] = useState("");

  function openPinFlow() {
    setPinDraft("");
    setPinDraft2("");
    setPinFlowStep("NEW");
    setPinFlowOpen(true);

    // drafts limpios hasta confirmar
    setPinNew("");
    setPinNew2("");
  }

  function closePinFlow() {
    if (pinBusy || pinToggling) return;
    setPinFlowOpen(false);
    setPinDraft("");
    setPinDraft2("");
    setPinFlowStep("NEW");
  }

  // ✅ BLOQUEA submit del form mientras el PIN modal está abierto
  function handleSubmit(e?: FormEvent) {
    if (e && pinFlowOpen) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    return onSubmit(e);
  }

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

    // ✅ reset PIN flow
    setPinFlowOpen(false);
    setPinFlowStep("NEW");
    setPinDraft("");
    setPinDraft2("");
    setPinNew("");
    setPinNew2("");
  }, [open, detail?.id, setPinNew, setPinNew2]);

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

    // ✅ reset PIN flow
    setPinFlowOpen(false);
    setPinFlowStep("NEW");
    setPinDraft("");
    setPinDraft2("");
    setPinNew("");
    setPinNew2("");

    onClose();
  }

  // ✅ EL ESTADO REAL DEL PIN VIENE SOLO DEL DETAIL (no optimista)
  const detailHasQuickPin = Boolean(detail?.hasQuickPin);
  const detailPinEnabled = Boolean(detail?.pinEnabled);
  const hasPin = detailHasQuickPin;

  const canShowPinToggle = Boolean(detailHasQuickPin);
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
      <ConfirmModals
        confirmOverlay={confirmOverlay}
        confirmDisablePinClearsSpecialOpen={confirmDisablePinClearsSpecialOpen}
        setConfirmDisablePinClearsSpecialOpen={setConfirmDisablePinClearsSpecialOpen}
        pinToggling={pinToggling}
        specialClearing={specialClearing}
        specialCount={specialListSorted.length}
        onConfirmDisablePinAndClearSpecial={() => void confirmDisablePinAndClearSpecial()}
        confirmDisableSpecialOpen={confirmDisableSpecialOpen}
        setConfirmDisableSpecialOpen={setConfirmDisableSpecialOpen}
        onConfirmDisableSpecialAndClear={() => void confirmDisableSpecialAndClear()}
      />

      {/* ✅ Modal principal */}
      <Modal open={open} wide={wide} title={title} onClose={safeClose}>
        {modalLoading ? (
          <div className={cn("tp-card p-4 text-sm text-muted flex items-center gap-2")}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Avatar */}
            <div className={cn("tp-card p-4")}>
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
                        className={cn(
                          "absolute top-2 right-2 h-6 w-6 rounded-full grid place-items-center",
                          "opacity-0 group-hover:opacity-100 transition-opacity"
                        )}
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
            {modalMode === "EDIT" && isSelf ? (
              <div
                className={cn("tp-card p-3 text-sm flex gap-3 items-start")}
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
            ) : null}

            <Tabs value={tab} onChange={setTab} configBadge={disableAdminDangerZone ? "Restringida" : undefined} />

            {/* TAB DATA */}
            {tab === "DATA" ? (
              <SectionData
                modalMode={modalMode}
                modalBusy={modalBusy}
                fEmail={fEmail}
                setFEmail={setFEmail}
                fPassword={fPassword}
                setFPassword={setFPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                fName={fName}
                setFName={setFName}
                fDocType={fDocType}
                setFDocType={setFDocType}
                fDocNumber={fDocNumber}
                setFDocNumber={setFDocNumber}
                fPhoneCountry={fPhoneCountry}
                setFPhoneCountry={setFPhoneCountry}
                fPhoneNumber={fPhoneNumber}
                setFPhoneNumber={setFPhoneNumber}
                fStreet={fStreet}
                setFStreet={setFStreet}
                fNumber={fNumber}
                setFNumber={setFNumber}
                fCity={fCity}
                setFCity={setFCity}
                fProvince={fProvince}
                setFProvince={setFProvince}
                fPostalCode={fPostalCode}
                setFPostalCode={setFPostalCode}
                fCountry={fCountry}
                setFCountry={setFCountry}
                fNotes={fNotes}
                setFNotes={setFNotes}
                attInputRef={attInputRef}
                uploadingAttachments={uploadingAttachments}
                deletingAttId={deletingAttId}
                attachmentsDraft={attachmentsDraft}
                removeDraftAttachmentByIndex={removeDraftAttachmentByIndex}
                addAttachments={addAttachments}
                filteredSavedAttachments={filteredSavedAttachments}
                handleRemoveSavedAttachment={handleRemoveSavedAttachment}
                draftKey={draftKey}
                draftPreviewByKey={draftPreviewByKey}
              />
            ) : null}

            {/* TAB CONFIG */}
            {tab === "CONFIG" ? (
              <SectionConfig
                modalMode={modalMode}
                disableAdminDangerZone={disableAdminDangerZone}
                confirmOverlay={confirmOverlay}
                canAdmin={canAdmin}
                isOwner={isOwner}
                detailHasQuickPin={detailHasQuickPin}
                detailPinEnabled={detailPinEnabled}
                pinFlowOpen={pinFlowOpen}
                openPinFlow={openPinFlow}
                closePinFlow={closePinFlow}
                hasPin={hasPin}
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
                setPinNew={setPinNew}
                setPinNew2={setPinNew2}
                pinNew={pinNew}
                pinNew2={pinNew2}
                adminSetOrResetPin={adminSetOrResetPin}
                adminTogglePinEnabled={adminTogglePinEnabled}
                adminRemovePin={adminRemovePin}
                specialListSorted={specialListSorted}
                setConfirmDisablePinClearsSpecialOpen={setConfirmDisablePinClearsSpecialOpen}
                specialBlocked={specialBlocked}
                specialEnabled={specialEnabled}
                setSpecialEnabled={setSpecialEnabled}
                specialPermPick={specialPermPick}
                setSpecialPermPick={setSpecialPermPick}
                specialEffectPick={specialEffectPick}
                setSpecialEffectPick={setSpecialEffectPick}
                specialSaving={specialSaving}
                specialClearing={specialClearing}
                allPerms={allPerms}
                permsLoading={permsLoading}
                addOrUpdateSpecial={addOrUpdateSpecial}
                removeSpecial={removeSpecial}
                labelByPermId={labelByPermId}
                setConfirmDisableSpecialOpen={setConfirmDisableSpecialOpen}
                fFavWarehouseId={fFavWarehouseId}
                setFFavWarehouseId={setFFavWarehouseId}
                activeAlmacenes={activeAlmacenes}
                warehouseLabelById={warehouseLabelById}
                roles={roles}
                rolesLoading={rolesLoading}
                fRoleIds={fRoleIds}
                setFRoleIds={setFRoleIds}
                roleLabel={roleLabel}
                isSelf={isSelf}
                ownerRoleId={ownerRoleId}
                selfOwnerChecked={selfOwnerChecked}
              />
            ) : null}

            {/* footer */}
            <UserEditFooter modalBusy={modalBusy} modalMode={modalMode} onCancel={safeClose} />
          </form>
        )}
      </Modal>
    </>
  );
}
